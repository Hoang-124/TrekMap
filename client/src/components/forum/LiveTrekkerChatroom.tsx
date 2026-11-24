import React, { useState, useEffect, useRef } from 'react';
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

export type RadioChannelId = 'general' | 'north' | 'central' | 'south' | 'sos';

interface RadioChannelConfig {
  id: RadioChannelId;
  shortLabel: string;
  fullLabel: string;
  isEmergency?: boolean;
}

const RADIO_CHANNELS: RadioChannelConfig[] = [
  { id: 'general', shortLabel: 'Toàn Quốc', fullLabel: 'Kênh Chung Toàn Quốc' },
  { id: 'north', shortLabel: 'Miền Bắc', fullLabel: 'Miền Bắc / Hoàng Liên Sơn' },
  { id: 'central', shortLabel: 'Miền Trung', fullLabel: 'Miền Trung / Tây Nguyên' },
  { id: 'south', shortLabel: 'Miền Nam', fullLabel: 'Miền Nam' },
  { id: 'sos', shortLabel: 'SOS Khẩn Cấp', fullLabel: 'Kênh Khẩn Cấp SOS', isEmergency: true },
];

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

interface LiveTrekkerChatroomProps {
  currentUser?: (UserProfile & { _id?: string; avatar?: string }) | null;
  onRequireLogin?: (actionName: string) => void;
}

export const LiveTrekkerChatroom: React.FC<LiveTrekkerChatroomProps> = ({ currentUser, onRequireLogin }) => {
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
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const { socket } = useSocket();
  const [socketConnState, setSocketConnState] = useState<{ sock: typeof socket; connected: boolean } | null>(null);

  const loadingHistory = loadedChannel !== activeChannel;

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const sentMessageIds = useRef<Set<string>>(new Set());
  const currentUserRef = useRef(currentUser);
  const activeChannelRef = useRef<RadioChannelId>(activeChannel);
  const skipNextAutoScrollRef = useRef<boolean>(false);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
  }, [activeChannel]);

  const currentUserId = String(currentUser?._id || currentUser?.id || '');
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  // Preload notification sound
  useEffect(() => {
    try {
      notificationAudioRef.current = new Audio('/audio/notification.mp3');
      notificationAudioRef.current.volume = 0.75;
      notificationAudioRef.current.load();
    } catch {
      // ignore audio init restrictions
    }
  }, []);

  // 10-Second Rate Limit Cooldown Interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const playIncomingNotificationSound = () => {
    try {
      if (notificationAudioRef.current) {
        notificationAudioRef.current.currentTime = 0;
        notificationAudioRef.current.play().catch(() => {});
      }
    } catch {
      // ignore autoplay block
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleSelectChannel = (nextChannel: RadioChannelId) => {
    if (nextChannel === activeChannel) return;
    setActiveChannel(nextChannel);
    setMessages([]);
    setHasMoreOlder(false);
    setChatErrorMsg('');
  };

  // Fetch persistent chat history for active channel from MongoDB
  useEffect(() => {
    const controller = new AbortController();

    const fetchChatHistory = async () => {
      try {
        const res = await fetch(
          `/api/forum/chat-messages?channel=${encodeURIComponent(activeChannel)}&limit=40`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!controller.signal.aborted && data.success && Array.isArray(data.data)) {
          setMessages(data.data);
          setHasMoreOlder(Boolean(data.hasMore));
          setTimeout(scrollToBottom, 100);
        }
      } catch (err: unknown) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort && !controller.signal.aborted) {
          console.error('Failed to load community chat history', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadedChannel(activeChannel);
        }
      }
    };
    void fetchChatHistory();
    return () => controller.abort();
  }, [activeChannel]);

  const handleLoadOlderMessages = async () => {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const oldest = messages[0];
    const beforeCursor = oldest?.createdAt || oldest?.id;
    if (!beforeCursor) return;

    const container = messagesContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;

    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/forum/chat-messages?channel=${encodeURIComponent(activeChannel)}&before=${encodeURIComponent(beforeCursor)}&limit=40`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const older: CommunityChatMessage[] = data.data;
        setHasMoreOlder(Boolean(data.hasMore));
        if (older.length > 0) {
          skipNextAutoScrollRef.current = true;
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const uniqueOlder = older.filter((m) => !seen.has(m.id));
            return [...uniqueOlder, ...prev];
          });
          window.requestAnimationFrame(() => {
            if (container) {
              const delta = container.scrollHeight - prevScrollHeight;
              if (delta > 0) container.scrollTop += delta;
            }
          });
        }
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Không thể tải thêm tin nhắn cũ hơn lúc này.', type: 'error' },
        })
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  // Stabilized Socket.io room join effect (depends ONLY on socket & primitive currentUserId)
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setSocketConnState({ sock: socket, connected: true });
      setChatErrorMsg('');
      socket.emit('joinCommunityChat');
    };

    const handleDisconnect = () => {
      setSocketConnState({ sock: socket, connected: false });
    };

    if (socket.connected) {
      socket.emit('joinCommunityChat');
    }

    const handleNewMessage = (msg: CommunityChatMessage) => {
      const msgChannel = (msg.channel || 'general') as RadioChannelId;
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
      setTimeout(scrollToBottom, 50);
    };

    const handleMessageDeleted = (payload: { id?: string }) => {
      if (!payload?.id) return;
      setMessages((prev) => prev.filter((m) => String(m.id) !== String(payload.id)));
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
            'Tin nhắn không được chấp nhận bởi máy chủ.';
      setChatErrorMsg(msg);
      setCooldown(0);
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
  }, [socket, currentUserId]);

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages.length]);

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
          detail: { message: 'Trình duyệt của bạn không hỗ trợ định vị GPS.', type: 'error' },
        })
      );
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const alt =
          typeof pos.coords.altitude === 'number' && Number.isFinite(pos.coords.altitude)
            ? Math.round(pos.coords.altitude)
            : undefined;
        setGpsTag({ gpsLat: lat, gpsLng: lng, altitudeM: alt });
        setLocatingGps(false);
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Đã gắn tọa độ GPS thực địa vào tin nhắn tiếp theo.', type: 'success' },
          })
        );
      },
      () => {
        setLocatingGps(false);
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: 'Không thể lấy vị trí GPS. Vui lòng cấp quyền vị trí trên thiết bị.', type: 'error' },
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
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: json.message || 'Đã xóa tin nhắn.', type: 'info' },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: { message: json.message || 'Không thể xóa tin nhắn này.', type: 'error' },
          })
        );
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: { message: 'Lỗi kết nối máy chủ khi xóa tin nhắn.', type: 'error' },
        })
      );
    } finally {
      setDeletingMsgId(null);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || cooldown > 0) return;

    const token = localStorage.getItem('lost_token');
    if (!currentUser && !token) {
      if (onRequireLogin) onRequireLogin('gửi tin nhắn trò chuyện cộng đồng');
      else window.dispatchEvent(new CustomEvent('lost:open-auth-modal'));
      return;
    }

    if (!socket || !socket.connected) {
      const offlineMsg = 'Phòng chat trực tuyến đang ngoại tuyến. Vui lòng chờ kết nối lại trước khi gửi tin.';
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
    setTimeout(() => setIsSending(false), 300);
    setCooldown(10);

    const senderName = currentUser?.fullName || 'Trekker';
    const senderAvatar = currentUser?.avatarUrl || currentUser?.avatar || '';
    const tempId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const msgData: CommunityChatMessage = {
      id: tempId,
      clientTempId: tempId,
      channel: activeChannel,
      senderId: currentUserId || undefined,
      senderName,
      senderAvatar,
      senderBadge: currentUser?.role === 'admin' ? 'BQT LOST' : 'Trekker',
      nameColor: currentUser?.role === 'admin' ? 'var(--color-sky)' : 'var(--color-primary)',
      gpsLat: gpsTag?.gpsLat,
      gpsLng: gpsTag?.gpsLng,
      altitudeM: gpsTag?.altitudeM,
      quote: quoteMessage || undefined,
      text: inputText.trim(),
      createdAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    sentMessageIds.current.add(tempId);
    socket.emit('sendCommunityChatMessage', msgData);

    setInputText('');
    setQuoteMessage(null);
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
              <IconRadio size={15} color="var(--color-error)" />
            ) : (
              <IconMessageSquare size={15} color="var(--color-primary)" />
            )}
          </div>
          <div>
            <div className="font-editorial" style={{ fontSize: '1.08rem', fontWeight: 500, color: 'var(--color-text-main)', lineHeight: 1.15 }}>
              Vô Tuyến &amp; Chat Thực Địa 24/7
            </div>
            <div style={{ fontSize: '0.7rem', color: activeChannelMeta.isEmergency ? 'var(--color-error-text, var(--color-error))' : 'var(--color-text-dim)', marginTop: 2, fontWeight: activeChannelMeta.isEmergency ? 700 : 500 }}>
              Tần số hiện tại: {activeChannelMeta.fullLabel}
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
          <span>{isOnlineReady ? `${onlineCount} Trực tuyến` : 'Ngoại tuyến'}</span>
        </div>
      </div>

      {/* 5-Channel Radio Frequency Switcher */}
      <div
        role="tablist"
        aria-label="Kênh vô tuyến thực địa"
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
        {RADIO_CHANNELS.map((ch) => {
          const isSelected = activeChannel === ch.id;
          return (
            <button
              key={ch.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              title={ch.fullLabel}
              onClick={() => handleSelectChannel(ch.id)}
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
                  ? 'var(--color-on-primary)'
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
          <span>Phòng chat thời gian thực đang mất kết nối máy chủ. Bạn vẫn xem được lịch sử gần nhất; hệ thống sẽ tự nối lại khi có mạng.</span>
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
              {loadingOlder ? 'Đang tải tin nhắn cũ...' : 'Tải tin nhắn cũ hơn'}
            </button>
          </div>
        )}

        {loadingHistory ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-dim)', padding: 20, fontSize: '0.82rem' }}>
            Đang đồng bộ tần số {activeChannelMeta.fullLabel}...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-text-dim)', padding: 20 }}>
            <IconSparkles size={28} color="var(--color-primary)" style={{ margin: '0 auto 8px', display: 'block', opacity: 0.6 }} />
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Chưa có tín hiệu trên {activeChannelMeta.fullLabel}
            </div>
            <div style={{ fontSize: '0.74rem', marginTop: 4 }}>
              Hãy gửi thông báo tình trạng tuyến đường hoặc lời chào tới anh em Trekker!
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = Boolean(currentUserId && msg.senderId && String(msg.senderId) === currentUserId);
            const canDelete = Boolean((isMe || isStaff) && /^[a-fA-F0-9]{24}$/.test(msg.id));
            const hasValidQuote = Boolean(msg.quote && msg.quote.author && msg.quote.text && msg.quote.text.trim());
            const hasGps = typeof msg.gpsLat === 'number' && typeof msg.gpsLng === 'number';

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
                {msg.senderAvatar && msg.senderAvatar.startsWith('http') ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={msg.senderAvatar}
                    alt={msg.senderName}
                    referrerPolicy="no-referrer"
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

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexDirection: isMe ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
                    {isMe ? (
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                        Bạn
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const target = msg.senderId || msg.senderName;
                          if (!target) return;
                          window.history.pushState(null, '', `#profile-${encodeURIComponent(target)}`);
                          window.dispatchEvent(new HashChangeEvent('hashchange'));
                        }}
                        title={`Xem hồ sơ ${msg.senderName}`}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: msg.nameColor || 'var(--color-text-main)',
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
                        setTimeout(() => inputRef.current?.focus(), 50);
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

                    {canDelete && (
                      <button
                        type="button"
                        disabled={deletingMsgId === msg.id}
                        title="Xóa tin nhắn"
                        aria-label="Xóa tin nhắn"
                        onClick={() => handleDeleteMessage(msg.id)}
                        style={{
                          background: 'var(--color-bg-card)',
                          border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                          borderRadius: 4,
                          color: 'var(--color-error-text, var(--color-error))',
                          cursor: deletingMsgId === msg.id ? 'wait' : 'pointer',
                          padding: '2px 5px',
                          fontSize: '0.64rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontWeight: 700,
                        }}
                      >
                        <IconTrash size={10} />
                        <span>{deletingMsgId === msg.id ? '...' : 'Xóa'}</span>
                      </button>
                    )}
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
                        <span>
                          {msg.gpsLat!.toFixed(4)}°N, {msg.gpsLng!.toFixed(4)}°E
                        </span>
                        {typeof msg.altitudeM === 'number' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-primary)' }}>
                            • <IconMountain size={11} color="var(--color-primary)" /> {msg.altitudeM.toLocaleString('vi-VN')}m
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
      {gpsTag && (
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
              Đang gắn thẻ GPS: {gpsTag.gpsLat.toFixed(4)}°N, {gpsTag.gpsLng.toFixed(4)}°E
              {gpsTag.altitudeM !== undefined ? ` • Cao độ ${gpsTag.altitudeM.toLocaleString('vi-VN')}m` : ''}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setGpsTag(null)}
            aria-label="Gỡ thẻ GPS"
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
            aria-label="Hủy trích dẫn"
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
          title={gpsTag ? 'Bấm để tắt thẻ GPS & Độ cao' : 'Gắn thẻ GPS & Độ cao thực địa'}
          aria-label="Gắn thẻ GPS và độ cao"
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
          <span>{locatingGps ? 'Định vị...' : 'GPS'}</span>
        </button>

        <input
          ref={inputRef}
          type="text"
          className="form-input"
          disabled={!isOnlineReady}
          placeholder={
            !isOnlineReady
              ? 'Đang chờ kết nối lại phòng chat...'
              : quoteMessage
                ? `Nhập câu trả lời cho @${quoteMessage.author}...`
                : `Phát tín hiệu lên ${activeChannelMeta.shortLabel}...`
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            padding: '9px 12px',
            fontSize: '0.84rem',
            borderRadius: 4,
            background: 'var(--color-bg-main)',
            border: quoteMessage ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
          }}
        />

        {cooldown > 0 && (
          <div
            title={`Vui lòng chờ ${cooldown}s để gửi tin nhắn tiếp theo`}
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
          title={!isOnlineReady ? 'Đang ngoại tuyến' : cooldown > 0 ? `Vui lòng chờ ${cooldown}s để gửi tiếp` : 'Gửi tin nhắn'}
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
