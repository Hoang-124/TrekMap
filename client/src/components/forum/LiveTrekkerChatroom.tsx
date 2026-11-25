import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IconMessageSquare,
  IconSend,
  IconSparkles,
  IconQuote,
  IconClock,
  IconX,
  IconAlertTriangle,
  IconRadio,
  IconMapPin,
  IconMountain,
  IconTrash,
} from '../common/SvgIcons.js';
import { useSocket } from '../../hooks/useSocket.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';
import type { UserProfile } from '../../types.js';
import { safeLocalStorageGet } from '../../utils/storageScope.js';

export type RadioChannelId = 'general' | 'north' | 'central' | 'south' | 'sos';

interface RadioChannelConfig {
  id: RadioChannelId;
  shortLabel: string;
  fullLabel: string;
  isEmergency?: boolean;
}

const RADIO_CHANNELS: RadioChannelConfig[] = [
  { id: 'general', shortLabel: 'Toàn quốc', fullLabel: 'Kênh chung toàn quốc' },
  { id: 'north', shortLabel: 'Miền Bắc', fullLabel: 'Miền Bắc · Hoàng Liên Sơn' },
  { id: 'central', shortLabel: 'Miền Trung', fullLabel: 'Miền Trung · Tây Nguyên' },
  { id: 'south', shortLabel: 'Miền Nam', fullLabel: 'Miền Nam' },
  { id: 'sos', shortLabel: 'Khẩn cấp SOS', fullLabel: 'Kênh khẩn cấp SOS', isEmergency: true },
];

const ALLOWED_NAME_COLOR_TOKENS = new Set<string>([
  'var(--color-primary)',
  'var(--color-sky)',
  'var(--color-earth)',
  'var(--color-sun)',
  'var(--color-stream)',
  'var(--color-text-main)',
  'var(--color-text-muted)',
]);

const MAX_TRACKED_SENT_IDS = 200;
const MAX_CHAT_MESSAGE_LENGTH = 1000;
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

function resolveSafeNameColor(rawColor?: string): string {
  if (!rawColor) return 'var(--color-text-main)';
  const trimmed = rawColor.trim();
  return ALLOWED_NAME_COLOR_TOKENS.has(trimmed) ? trimmed : 'var(--color-text-main)';
}

function isSafeAvatarSrc(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    (trimmed.startsWith('/') && !trimmed.startsWith('//'))
  );
}

function isValidGpsCoords(lat?: number, lng?: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function isValidAltitude(alt?: number): alt is number {
  return typeof alt === 'number' && Number.isFinite(alt) && alt >= -500 && alt <= 9000;
}

function formatGpsCoords(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

function isRateLimitErrorMessage(msg: string): boolean {
  return /quá nhanh|rate|đợi|cooldown|chậm lại|giới hạn/i.test(msg);
}

export interface CommunityChatMessage {
  id: string;
  clientTempId?: string;
  channel?: RadioChannelId | string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  senderBadge?: string;
  nameColor?: string;
  gpsLat?: number;
  gpsLng?: number;
  altitudeM?: number;
  quote?: { author: string; text: string };
  text: string;
  createdAt?: string;
  time?: string;
}

interface GpsTelemetryTag {
  gpsLat: number;
  gpsLng: number;
  altitudeM?: number;
}

interface PendingDraftSnapshot {
  tempId: string;
  channel: RadioChannelId;
  text: string;
  quote: { author: string; text: string } | null;
  gps: GpsTelemetryTag | null;
}

interface LiveTrekkerChatroomProps {
  currentUser?: (UserProfile & { _id?: string; avatar?: string }) | null;
  onRequireLogin?: (actionName: string) => void;
  onOpenAuthorProfile?: (author: { userId?: string; name: string; avatar: string }) => void;
}

export const LiveTrekkerChatroom: React.FC<LiveTrekkerChatroomProps> = ({
  currentUser,
  onRequireLogin,
  onOpenAuthorProfile,
}) => {
  const [activeChannel, setActiveChannel] = useState<RadioChannelId>('general');
  const [messages, setMessages] = useState<CommunityChatMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(false);
  const [loadedChannel, setLoadedChannel] = useState<RadioChannelId | null>(null);
  const [loadingOlder, setLoadingOlder] = useState<boolean>(false);
  const [inputText, setInputText] = useState('');
  const [quoteMessage, setQuoteMessage] = useState<{ author: string; text: string } | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const [chatErrorMsg, setChatErrorMsg] = useState<string>('');
  const [gpsTag, setGpsTag] = useState<GpsTelemetryTag | null>(null);
  const [locatingGps, setLocatingGps] = useState<boolean>(false);
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [failedAvatarKeys, setFailedAvatarKeys] = useState<Record<string, boolean>>({});
  const { socket } = useSocket();
  const [socketConnState, setSocketConnState] = useState<{ sock: typeof socket; connected: boolean } | null>(null);

  const loadingHistory = loadedChannel !== activeChannel;

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sentMessageIds = useRef<Set<string>>(new Set());
  const currentUserRef = useRef(currentUser);
  const activeChannelRef = useRef<RadioChannelId>(activeChannel);
  const pendingDraftRef = useRef<PendingDraftSnapshot | null>(null);
  const loadOlderAbortRef = useRef<AbortController | null>(null);
  const reconnectAbortRef = useRef<AbortController | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const mountedRef = useRef<boolean>(true);

  const scheduleTimer = useCallback((fn: () => void, delayMs: number) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      if (mountedRef.current) {
        fn();
      }
    }, delayMs);
    timersRef.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      if (loadOlderAbortRef.current) {
        loadOlderAbortRef.current.abort();
        loadOlderAbortRef.current = null;
      }
      if (reconnectAbortRef.current) {
        reconnectAbortRef.current.abort();
        reconnectAbortRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const currentUserId = String(currentUser?._id || currentUser?.id || '');
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  // 10-Second Rate Limit Cooldown Interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      });
    }
  }, []);

  // Original Web Audio API 2-tone alpine radio chime (recreates if closed, schedules only when running, disconnects nodes)
  const playIncomingNotificationSound = useCallback(() => {
    try {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      if (audioCtxRef.current && audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = null;
      }
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
        return;
      }
      if (ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const notes = [
        { freq: 783.99, start: 0, dur: 0.11 }, // G5
        { freq: 1046.5, start: 0.1, dur: 0.18 }, // C6
      ];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(0.0001, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.14, now + n.start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            // ignore disconnect errors
          }
        };
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.02);
      }
    } catch {
      // ignore autoplay / audio device restrictions
    }
  }, []);

  const handleSelectChannel = (nextChannel: RadioChannelId) => {
    if (nextChannel === activeChannel) return;
    if (loadOlderAbortRef.current) {
      loadOlderAbortRef.current.abort();
      loadOlderAbortRef.current = null;
    }
    if (reconnectAbortRef.current) {
      reconnectAbortRef.current.abort();
      reconnectAbortRef.current = null;
    }
    setActiveChannel(nextChannel);
    setMessages([]);
    setHasMoreOlder(false);
    setLoadingOlder(false);
    setChatErrorMsg('');
    setGpsTag(null);
    setQuoteMessage(null);
    setConfirmDeleteMsgId(null);
  };

  // Fetch persistent chat history for active channel from MongoDB
  useEffect(() => {
    const controller = new AbortController();
    const requestedChannel = activeChannel;

    const fetchChatHistory = async () => {
      try {
        const res = await fetch(
          `/api/forum/chat-messages?channel=${encodeURIComponent(requestedChannel)}&limit=40`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!controller.signal.aborted && activeChannelRef.current === requestedChannel && data.success && Array.isArray(data.data)) {
          setMessages(data.data);
          setHasMoreOlder(Boolean(data.hasMore));
          scheduleTimer(() => scrollToBottom('auto'), 60);
        }
      } catch (err: unknown) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort && !controller.signal.aborted) {
          console.error('Failed to load community chat history', err);
        }
      } finally {
        if (!controller.signal.aborted && activeChannelRef.current === requestedChannel) {
          setLoadedChannel(requestedChannel);
        }
      }
    };
    void fetchChatHistory();
    return () => controller.abort();
  }, [activeChannel, scheduleTimer, scrollToBottom]);

  const handleLoadOlderMessages = async () => {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const oldest = messages[0];
    const beforeCursor = oldest?.id && OBJECT_ID_REGEX.test(oldest.id) ? oldest.id : oldest?.createdAt || oldest?.id;
    if (!beforeCursor) return;

    const requestedChannel = activeChannel;
    if (loadOlderAbortRef.current) {
      loadOlderAbortRef.current.abort();
    }
    const controller = new AbortController();
    loadOlderAbortRef.current = controller;

    const container = messagesContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;

    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/forum/chat-messages?channel=${encodeURIComponent(requestedChannel)}&before=${encodeURIComponent(beforeCursor)}&limit=40`,
        { signal: controller.signal }
      );
      const data = await res.json();
      if (controller.signal.aborted || activeChannelRef.current !== requestedChannel) return;

      if (res.ok && data.success && Array.isArray(data.data)) {
        const older: CommunityChatMessage[] = data.data;
        setHasMoreOlder(Boolean(data.hasMore));
        if (older.length > 0) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const uniqueOlder = older.filter((m) => !seen.has(m.id));
            return [...uniqueOlder, ...prev];
          });
          window.requestAnimationFrame(() => {
            if (mountedRef.current && container && activeChannelRef.current === requestedChannel) {
              const delta = container.scrollHeight - prevScrollHeight;
              if (delta > 0) container.scrollTop += delta;
            }
          });
        }
      }
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort && !controller.signal.aborted) {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Chưa tải thêm được tin nhắn cũ, bạn thử lại nhé.', type: 'error' },
          })
        );
      }
    } finally {
      if (loadOlderAbortRef.current === controller) {
        loadOlderAbortRef.current = null;
      }
      if (!controller.signal.aborted && activeChannelRef.current === requestedChannel) {
        setLoadingOlder(false);
      }
    }
  };

  // Stabilized Socket.io room join & reconnect backfill effect
  useEffect(() => {
    if (!socket) return;

    const mergeBackfillAfterReconnect = async () => {
      const reqChannel = activeChannelRef.current;
      if (reconnectAbortRef.current) {
        reconnectAbortRef.current.abort();
      }
      const controller = new AbortController();
      reconnectAbortRef.current = controller;
      const shouldAutoScroll = isNearBottom();

      try {
        const res = await fetch(
          `/api/forum/chat-messages?channel=${encodeURIComponent(reqChannel)}&limit=40`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (controller.signal.aborted || activeChannelRef.current !== reqChannel) return;
        if (res.ok && data.success && Array.isArray(data.data)) {
          const incoming: CommunityChatMessage[] = data.data;
          let appendedCount = 0;
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const missed = incoming.filter((m) => !seen.has(m.id));
            if (missed.length === 0) return prev;
            appendedCount = missed.length;
            const merged = [...prev, ...missed];
            merged.sort((a, b) => {
              const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return ta - tb;
            });
            return merged;
          });
          if (appendedCount > 0 && shouldAutoScroll) {
            scheduleTimer(() => scrollToBottom('smooth'), 40);
          }
        }
      } catch {
        // ignore abort or transient backfill failure
      } finally {
        if (reconnectAbortRef.current === controller) {
          reconnectAbortRef.current = null;
        }
      }
    };

    const handleConnect = () => {
      setSocketConnState({ sock: socket, connected: true });
      setChatErrorMsg('');
      socket.emit('joinCommunityChat');
      void mergeBackfillAfterReconnect();
    };

    const handleDisconnect = () => {
      setSocketConnState({ sock: socket, connected: false });
    };

    if (socket.connected) {
      socket.emit('joinCommunityChat');
    }

    const handleNewMessage = (msg: CommunityChatMessage) => {
      const msgChannel = (msg.channel || 'general') as RadioChannelId;
      if (msg.clientTempId && pendingDraftRef.current?.tempId === msg.clientTempId) {
        pendingDraftRef.current = null;
      }
      if (msgChannel !== activeChannelRef.current) return;

      const activeUser = currentUserRef.current;
      const activeUid = String(activeUser?._id || activeUser?.id || '');
      const isFromMe = Boolean(
        (msg.clientTempId && sentMessageIds.current.has(msg.clientTempId)) ||
          sentMessageIds.current.has(msg.id) ||
          (activeUid && msg.senderId && String(msg.senderId) === activeUid)
      );

      if (!isFromMe) {
        playIncomingNotificationSound();
      }

      const shouldAutoScroll = isFromMe || isNearBottom();

      setMessages((prev) => {
        if (
          prev.some(
            (m) =>
              m.id === msg.id ||
              (msg.clientTempId && (m.id === msg.clientTempId || m.clientTempId === msg.clientTempId))
          )
        ) {
          return prev;
        }
        return [...prev, msg];
      });

      if (shouldAutoScroll) {
        scheduleTimer(() => scrollToBottom('smooth'), 40);
      }
    };

    const handleMessageDeleted = (payload: { id?: string }) => {
      if (!payload?.id) return;
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(payload.id)));
      setConfirmDeleteMsgId((prev) => (prev === payload.id ? null : prev));
    };

    const handleOnlineCount = (count: number) => {
      setOnlineCount(Math.max(1, count || 1));
    };

    const handleChatError = (payload: unknown) => {
      const errObj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
      const msg =
        typeof payload === 'string'
          ? payload
          : (typeof errObj?.message === 'string' && errObj.message) ||
            (typeof errObj?.error === 'string' && errObj.error) ||
            'Tin nhắn chưa gửi được, bạn kiểm tra lại nội dung nhé.';
      setChatErrorMsg(msg);

      // Restore unsent draft if user hasn't started typing a new message
      const pending = pendingDraftRef.current;
      if (pending && pending.channel === activeChannelRef.current) {
        setInputText((cur) => (cur ? cur : pending.text));
        if (pending.quote) {
          setQuoteMessage((cur) => cur || pending.quote);
        }
        if (pending.gps) {
          setGpsTag((cur) => cur || pending.gps);
        }
      }
      pendingDraftRef.current = null;

      // Preserve rate-limit cooldown when server reports rate limiting
      if (!isRateLimitErrorMessage(msg)) {
        setCooldown(0);
      }

      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: msg, type: 'error' },
        })
      );
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('communityOnlineCount', handleOnlineCount);
    socket.on('newCommunityMessage', handleNewMessage);
    socket.on('communityMessageDeleted', handleMessageDeleted);
    socket.on('chatError', handleChatError);

    return () => {
      socket.emit('leaveCommunityChat');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('communityOnlineCount', handleOnlineCount);
      socket.off('newCommunityMessage', handleNewMessage);
      socket.off('communityMessageDeleted', handleMessageDeleted);
      socket.off('chatError', handleChatError);
    };
  }, [socket, currentUserId, isNearBottom, playIncomingNotificationSound, scheduleTimer, scrollToBottom]);

  const isOnlineReady = Boolean(
    socket && (socketConnState?.sock === socket ? socketConnState.connected : socket.connected)
  );

  const handleToggleGpsTag = () => {
    if (gpsTag) {
      setGpsTag(null);
      return;
    }
    if (locatingGps) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Trình duyệt này chưa hỗ trợ lấy tọa độ GPS.', type: 'error' },
        })
      );
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!mountedRef.current) return;
        const rawLat = pos.coords.latitude;
        const rawLng = pos.coords.longitude;
        if (!isValidGpsCoords(rawLat, rawLng)) {
          setLocatingGps(false);
          window.dispatchEvent(
            new CustomEvent('lost:show-toast', {
              detail: { message: 'Tọa độ GPS trả về không hợp lệ, bạn thử lại nhé.', type: 'error' },
            })
          );
          return;
        }
        const lat = Number(rawLat.toFixed(5));
        const lng = Number(rawLng.toFixed(5));
        const rawAlt = pos.coords.altitude;
        const alt = typeof rawAlt === 'number' && isValidAltitude(rawAlt) ? Math.round(rawAlt) : undefined;
        setGpsTag({ gpsLat: lat, gpsLng: lng, altitudeM: alt });
        setLocatingGps(false);
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Đã đính kèm tọa độ hiện tại vào tin nhắn sắp gửi.', type: 'success' },
          })
        );
      },
      () => {
        if (!mountedRef.current) return;
        setLocatingGps(false);
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Chưa lấy được vị trí GPS — bạn kiểm tra quyền định vị trên máy nhé.', type: 'error' },
          })
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (deletingMsgId) return;
    setDeletingMsgId(msgId);
    try {
      const res = await fetch(`/api/forum/chat-messages/${encodeURIComponent(msgId)}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setConfirmDeleteMsgId(null);
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: json.message || 'Đã xóa tin nhắn.', type: 'info' },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: json.message || 'Chưa xóa được tin nhắn này, bạn thử lại nhé.', type: 'error' },
          })
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Mất kết nối nên chưa xóa được tin nhắn.', type: 'error' },
        })
      );
    } finally {
      if (mountedRef.current) {
        setDeletingMsgId(null);
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedText = inputText.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
    if (!trimmedText || cooldown > 0) return;

    const token = safeLocalStorageGet('lost_token');
    if (!currentUser && !token) {
      if (onRequireLogin) onRequireLogin('nhắn tin cùng anh em');
      else window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    if (!socket || !socket.connected) {
      const offlineMsg = 'Kênh đang mất sóng — chờ nối lại mạng một chút rồi nhắn tiếp nhé.';
      setChatErrorMsg(offlineMsg);
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: offlineMsg, type: 'error' },
        })
      );
      return;
    }

    setChatErrorMsg('');
    setIsSending(true);
    scheduleTimer(() => setIsSending(false), 300);
    setCooldown(10);

    const senderName = currentUser?.fullName || 'Trekker';
    const senderAvatar = currentUser?.avatarUrl || currentUser?.avatar || '';
    const tempId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const validGps = gpsTag && isValidGpsCoords(gpsTag.gpsLat, gpsTag.gpsLng) ? gpsTag : null;
    const validAlt = validGps && isValidAltitude(validGps.altitudeM) ? validGps.altitudeM : undefined;

    const msgData: CommunityChatMessage = {
      id: tempId,
      clientTempId: tempId,
      channel: activeChannel,
      senderId: currentUserId || undefined,
      senderName,
      senderAvatar,
      senderBadge: currentUser?.role === 'admin' ? 'BQT LOST' : currentUser?.role === 'moderator' ? 'Điều phối LOST' : 'Trekker',
      nameColor: currentUser?.role === 'admin' || currentUser?.role === 'moderator' ? 'var(--color-sky)' : 'var(--color-primary)',
      gpsLat: validGps?.gpsLat,
      gpsLng: validGps?.gpsLng,
      altitudeM: validAlt,
      quote: quoteMessage || undefined,
      text: trimmedText,
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    // Bound tracked temp IDs to prevent unbounded memory growth
    sentMessageIds.current.add(tempId);
    while (sentMessageIds.current.size > MAX_TRACKED_SENT_IDS) {
      const oldestKey = sentMessageIds.current.values().next().value;
      if (oldestKey === undefined) break;
      sentMessageIds.current.delete(oldestKey);
    }

    pendingDraftRef.current = {
      tempId,
      channel: activeChannel,
      text: trimmedText,
      quote: quoteMessage,
      gps: validGps,
    };

    socket.emit('sendCommunityChatMessage', msgData);

    setInputText('');
    setQuoteMessage(null);
    setGpsTag(null);
  };

  const handleOpenSenderProfile = (msg: CommunityChatMessage) => {
    if (onOpenAuthorProfile) {
      onOpenAuthorProfile({
        userId: msg.senderId,
        name: msg.senderName,
        avatar: msg.senderAvatar || '',
      });
      return;
    }
    const target = msg.senderId || msg.senderName;
    if (!target) return;
    const base = `${window.location.pathname}${window.location.search}`;
    window.history.pushState(null, '', `${base}#profile-${encodeURIComponent(target)}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  const handleChannelTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % RADIO_CHANNELS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + RADIO_CHANNELS.length) % RADIO_CHANNELS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = RADIO_CHANNELS.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const targetChannel = RADIO_CHANNELS[nextIdx];
      handleSelectChannel(targetChannel.id);
      tabButtonRefs.current[targetChannel.id]?.focus();
    }
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return 'Vừa xong';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Vừa xong';
    }
  };

  const activeChannelMeta = RADIO_CHANNELS.find((c) => c.id === activeChannel) || RADIO_CHANNELS[0];

  return (
    <div
      className="card"
      style={{
        background: 'var(--color-bg-card)',
        border: activeChannelMeta.isEmergency
          ? '1px solid color-mix(in srgb, var(--color-error) 55%, var(--color-border))'
          : '1px solid var(--color-border)',
        borderRadius: 4,
        overflow: 'hidden',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        height: 580,
      }}
    >
      {/* Chatroom Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 4,
              background: activeChannelMeta.isEmergency
                ? 'color-mix(in srgb, var(--color-error) 14%, var(--color-surface-elevated))'
                : 'var(--color-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: activeChannelMeta.isEmergency
                ? '1px solid var(--color-error)'
                : '1px solid var(--color-border-strong)',
            }}
          >
            {activeChannelMeta.isEmergency ? (
              <IconRadio size={15} color="var(--color-error-text, var(--color-error))" />
            ) : (
              <IconMessageSquare size={15} color="var(--color-primary)" />
            )}
          </div>
          <div>
            <div className="font-editorial" style={{ fontSize: '1.08rem', fontWeight: 500, color: 'var(--color-text-main)', lineHeight: 1.15 }}>
              Kênh liên lạc anh em
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: activeChannelMeta.isEmergency ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-dim)',
                marginTop: 2,
                fontWeight: activeChannelMeta.isEmergency ? 700 : 500,
              }}
            >
              Đang ở kênh: {activeChannelMeta.fullLabel}
            </div>
          </div>
        </div>

        {/* Live Online / Offline Status Badge */}
        <div
          className={`badge ${isOnlineReady ? 'badge-success' : 'badge-error'}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isOnlineReady ? 'var(--color-primary)' : 'var(--color-error)',
            }}
          />
          <span>{isOnlineReady ? `${onlineCount} trực tuyến` : 'Mất kết nối'}</span>
        </div>
      </div>

      {/* 5-Channel Radio Frequency Switcher */}
      <div
        role="tablist"
        aria-label="Chọn kênh liên lạc theo vùng"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          background: 'var(--color-surface-elevated)',
          borderBottom: '1px solid var(--color-border)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {RADIO_CHANNELS.map((ch, idx) => {
          const isSelected = activeChannel === ch.id;
          return (
            <button
              key={ch.id}
              ref={(el) => {
                tabButtonRefs.current[ch.id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              title={ch.fullLabel}
              onClick={() => handleSelectChannel(ch.id)}
              onKeyDown={(e) => handleChannelTabKeyDown(e, idx)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 4,
                fontSize: '0.72rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                background: isSelected
                  ? ch.isEmergency
                    ? 'var(--color-error)'
                    : 'var(--color-primary)'
                  : 'var(--color-bg-card)',
                color: isSelected
                  ? ch.isEmergency
                    ? 'var(--color-on-danger)'
                    : 'var(--color-on-primary)'
                  : ch.isEmergency
                    ? 'var(--color-error-text, var(--color-error))'
                    : 'var(--color-text-muted)',
                border: isSelected
                  ? `1px solid ${ch.isEmergency ? 'var(--color-error)' : 'var(--color-primary)'}`
                  : ch.isEmergency
                    ? '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)'
                    : '1px solid var(--color-border)',
              }}
            >
              <IconRadio size={11} color="currentColor" />
              <span>{ch.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Honest Offline Notice Banner */}
      {!isOnlineReady && (
        <div
          style={{
            padding: '8px 14px',
            background: 'color-mix(in srgb, var(--color-earth) 12%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, var(--color-earth) 35%, transparent)',
            color: 'var(--color-earth)',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconAlertTriangle size={14} color="var(--color-earth)" style={{ flexShrink: 0 }} />
          <span>Kênh chat đang mất kết nối. Bạn vẫn xem lại được tin nhắn gần đây — máy sẽ tự nối lại ngay khi có sóng.</span>
        </div>
      )}

      {/* Server Chat Error Inline Banner */}
      {chatErrorMsg && (
        <div
          style={{
            padding: '8px 14px',
            background: 'var(--banner-danger-bg)',
            borderBottom: '1px solid var(--banner-danger-border)',
            color: 'var(--banner-danger-text)',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>{chatErrorMsg}</span>
          <button
            type="button"
            onClick={() => setChatErrorMsg('')}
            aria-label="Đóng thông báo lỗi"
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
          >
            <IconX size={13} />
          </button>
        </div>
      )}

      {/* Message List Area */}
      <div
        ref={messagesContainerRef}
        role="tabpanel"
        aria-label={activeChannelMeta.fullLabel}
        style={{
          flex: 1,
          padding: '14px 16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: 'var(--color-bg-main)',
        }}
      >
        {/* Cursor Pagination Button for Older Messages */}
        {hasMoreOlder && (
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={loadingOlder}
              onClick={handleLoadOlderMessages}
              style={{ padding: '4px 12px', fontSize: '0.74rem', fontWeight: 700, borderRadius: 4 }}
            >
              {loadingOlder ? 'Đang mở tin cũ...' : 'Xem tin nhắn cũ hơn'}
            </button>
          </div>
        )}

        {loadingHistory ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-dim)', padding: 20, fontSize: '0.82rem' }}>
            Đang tải tin nhắn kênh {activeChannelMeta.fullLabel}...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-dim)', padding: 20 }}>
            <IconSparkles size={28} color="var(--color-primary)" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.6 }} />
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Kênh {activeChannelMeta.fullLabel} đang yên ắng
            </div>
            <div style={{ fontSize: '0.74rem', marginTop: 4 }}>
              Hỏi đường, cập nhật thời tiết trên núi hay nhắn lời chào tới anh em nhé.
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = Boolean(currentUserId && msg.senderId && String(msg.senderId) === currentUserId);
            const canDelete = Boolean((isMe || isStaff) && OBJECT_ID_REGEX.test(msg.id));
            const isConfirmingDelete = confirmDeleteMsgId === msg.id;
            const hasValidQuote = Boolean(msg.quote && msg.quote.author && msg.quote.text && msg.quote.text.trim());
            const hasGps = isValidGpsCoords(msg.gpsLat, msg.gpsLng);
            const hasAlt = hasGps && isValidAltitude(msg.altitudeM);
            const avatarKey = `${msg.id}:${msg.senderAvatar || ''}`;
            const showAvatarImg = isSafeAvatarSrc(msg.senderAvatar) && !failedAvatarKeys[avatarKey];

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '4px 6px',
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  position: 'relative',
                }}
                className="chat-message-row chat-message-pop"
              >
                {showAvatarImg ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={msg.senderAvatar}
                    alt={msg.senderName}
                    referrerPolicy="no-referrer"
                    onError={() => setFailedAvatarKeys((prev) => ({ ...prev, [avatarKey]: true }))}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      border: isMe ? '1.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                      objectFit: 'cover',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: isMe ? 'var(--color-primary)' : 'var(--color-sky)',
                      color: 'var(--color-on-primary)',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                      textTransform: 'uppercase',
                    }}
                  >
                    {(msg.senderName || 'T').charAt(0)}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '100%', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexDirection: isMe ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
                    {isMe ? (
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                        Bạn
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenSenderProfile(msg)}
                        title={`Xem hồ sơ ${msg.senderName}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: resolveSafeNameColor(msg.nameColor),
                        }}
                      >
                        {msg.senderName}
                      </button>
                    )}
                    {msg.senderBadge && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: isMe ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-bg-card)',
                          border: '1px solid var(--color-border)',
                          color: isMe ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        }}
                      >
                        {msg.senderBadge}
                      </span>
                    )}
                    <span style={{ fontSize: '0.66rem', color: 'var(--color-text-dim)' }}>
                      {msg.time || formatMessageTime(msg.createdAt)}
                    </span>

                    <button
                      type="button"
                      title="Trả lời tin nhắn này"
                      onClick={() => {
                        setQuoteMessage({ author: msg.senderName, text: msg.text });
                        scheduleTimer(() => inputRef.current?.focus(), 50);
                      }}
                      style={{
                        background: 'var(--color-bg-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 4,
                        color: 'var(--color-text-muted)',
                        cursor: 'pointer',
                        padding: '2px 5px',
                        fontSize: '0.64rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontWeight: 700,
                      }}
                    >
                      <IconQuote size={10} />
                      <span>Trả lời</span>
                    </button>

                    {canDelete &&
                      (isConfirmingDelete ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={deletingMsgId === msg.id}
                            onClick={() => handleDeleteMessage(msg.id)}
                            style={{
                              padding: '2px 6px',
                              fontSize: '0.64rem',
                              fontWeight: 800,
                              borderRadius: 4,
                              cursor: deletingMsgId === msg.id ? 'wait' : 'pointer',
                            }}
                          >
                            {deletingMsgId === msg.id ? 'Đang xóa...' : 'Xác nhận'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={deletingMsgId === msg.id}
                            onClick={() => setConfirmDeleteMsgId(null)}
                            style={{
                              padding: '2px 6px',
                              fontSize: '0.64rem',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          >
                            Hủy
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={deletingMsgId === msg.id}
                          title="Xóa tin nhắn"
                          aria-label="Xóa tin nhắn"
                          onClick={() => setConfirmDeleteMsgId(msg.id)}
                          style={{
                            background: 'var(--color-bg-card)',
                            border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                            borderRadius: 4,
                            color: 'var(--color-error-text, var(--color-error))',
                            cursor: 'pointer',
                            padding: '2px 5px',
                            fontSize: '0.64rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontWeight: 700,
                          }}
                        >
                          <IconTrash size={10} />
                          <span>Xóa</span>
                        </button>
                      ))}
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      background: isMe ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--color-bg-card)',
                      border: isMe ? '1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)' : '1px solid var(--color-border)',
                      borderRadius: 6,
                      padding: '8px 13px',
                      fontSize: '0.84rem',
                      color: 'var(--color-text-main)',
                      lineHeight: 1.5,
                      display: 'inline-block',
                      maxWidth: '100%',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    {hasValidQuote && msg.quote && (
                      <div
                        style={{
                          background: 'var(--color-surface-elevated)',
                          borderLeft: '3px solid var(--color-primary)',
                          padding: '4px 8px',
                          borderRadius: 4,
                          fontSize: '0.72rem',
                          color: 'var(--color-text-muted)',
                          marginBottom: 6,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <strong style={{ color: 'var(--color-primary)' }}>@{msg.quote.author}:</strong> {msg.quote.text}
                      </div>
                    )}

                    <div style={{ wordBreak: 'break-word', textAlign: isMe ? 'right' : 'left' }}>{msg.text}</div>

                    {/* GPS & Altitude Telemetry Pill */}
                    {hasGps && (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: 'color-mix(in srgb, var(--color-sky) 12%, var(--color-surface-elevated))',
                          border: '1px solid color-mix(in srgb, var(--color-sky) 35%, transparent)',
                          color: 'var(--color-sky)',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <IconMapPin size={11} color="var(--color-sky)" />
                        <span>{formatGpsCoords(msg.gpsLat!, msg.gpsLng!)}</span>
                        {hasAlt && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-primary)' }}>
                            • <IconMountain size={11} color="var(--color-primary)" /> {msg.altitudeM!.toLocaleString('vi-VN')}m
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Active GPS Telemetry Tag Preview Bar */}
      {gpsTag && isValidGpsCoords(gpsTag.gpsLat, gpsTag.gpsLng) && (
        <div
          style={{
            background: 'color-mix(in srgb, var(--color-sky) 10%, var(--color-bg-card))',
            borderTop: '1px solid color-mix(in srgb, var(--color-sky) 35%, transparent)',
            padding: '5px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--color-sky)',
            fontWeight: 700,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
            <IconMapPin size={12} color="var(--color-sky)" />
            <span>
              Đính kèm vị trí: {formatGpsCoords(gpsTag.gpsLat, gpsTag.gpsLng)}
              {isValidAltitude(gpsTag.altitudeM) ? ` • Độ cao ${gpsTag.altitudeM.toLocaleString('vi-VN')}m` : ''}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setGpsTag(null)}
            aria-label="Bỏ đính kèm vị trí GPS"
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0 4px' }}
          >
            <IconX size={12} />
          </button>
        </div>
      )}

      {/* Active Quote Preview Bar */}
      {quoteMessage && (
        <div
          style={{
            background: 'var(--color-bg-card)',
            borderTop: '1px solid var(--color-border)',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <IconQuote size={12} color="var(--color-primary)" />
            <span style={{ color: 'var(--color-text-muted)' }}>
              Đang trả lời <strong style={{ color: 'var(--color-primary)' }}>@{quoteMessage.author}</strong>: {quoteMessage.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setQuoteMessage(null)}
            aria-label="Hủy trả lời"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-dim)',
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            <IconX size={12} />
          </button>
        </div>
      )}

      {/* Input Box Footer */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleToggleGpsTag}
          disabled={!isOnlineReady || locatingGps}
          title={gpsTag ? 'Bấm để bỏ đính kèm vị trí GPS' : 'Đính kèm tọa độ GPS và độ cao hiện tại'}
          aria-label="Đính kèm vị trí GPS và độ cao"
          className="btn btn-outline"
          style={{
            padding: '8px 10px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.74rem',
            fontWeight: 700,
            flexShrink: 0,
            color: gpsTag ? 'var(--color-sky)' : 'var(--color-text-muted)',
            borderColor: gpsTag ? 'var(--color-sky)' : 'var(--color-border)',
            background: gpsTag ? 'color-mix(in srgb, var(--color-sky) 12%, transparent)' : 'var(--color-bg-main)',
          }}
        >
          <IconMapPin size={14} color={gpsTag ? 'var(--color-sky)' : 'currentColor'} />
          <span>{locatingGps ? 'Đang lấy...' : 'GPS'}</span>
        </button>

        <input
          ref={inputRef}
          type="text"
          className="form-input"
          disabled={!isOnlineReady}
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          placeholder={
            !isOnlineReady
              ? 'Đang chờ có sóng để nối lại...'
              : quoteMessage
                ? `Trả lời @${quoteMessage.author}...`
                : `Nhắn lên kênh ${activeChannelMeta.shortLabel} — hỏi đường & gọi bạn...`
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '9px 12px',
            fontSize: '0.84rem',
            borderRadius: 4,
            background: 'var(--color-bg-main)',
            border: quoteMessage ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
          }}
        />

        {cooldown > 0 && (
          <div
            title={`Chờ ${cooldown} giây nữa rồi nhắn tiếp nhé`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--color-sun) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-sun) 35%, transparent)',
              color: 'var(--color-sun)',
              fontSize: '0.74rem',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            <IconClock size={12} color="var(--color-sun)" />
            <span>{cooldown}s</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!isOnlineReady || !inputText.trim() || cooldown > 0}
          title={!isOnlineReady ? 'Đang mất kết nối' : cooldown > 0 ? `Chờ ${cooldown} giây để gửi tiếp` : 'Gửi tin nhắn'}
          aria-label="Gửi tin nhắn"
          className="btn btn-primary interactive-click"
          style={{
            padding: '8px 14px',
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isOnlineReady && inputText.trim() && cooldown === 0 ? 1 : 0.45,
            cursor: isOnlineReady && inputText.trim() && cooldown === 0 ? 'pointer' : 'not-allowed',
            transform: isSending ? 'scale(0.94)' : 'scale(1)',
          }}
        >
          <IconSend size={15} color="var(--color-on-primary)" />
        </button>
      </form>
    </div>
  );
};
