import React, { useState, useEffect, useRef } from 'react';
import type { Conversation } from '../../types.js';
import type { RichMessage } from '../../services/messageService.js';
import { uploadImageToCloudinary } from '../../services/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import {
  IconSearch,
  IconImage,
  IconX,
  IconEdit,
  IconTrash,
  IconCheck,
} from '../common/SvgIcons.js';

const Send = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const ArrowLeft = ({ size = 18, color = 'currentColor', style }: { size?: number; color?: string; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

interface TypingUser {
  userId: string;
  userName: string;
}

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: RichMessage[];
  currentUserId: string;
  onSendMessage: (content: string, images?: string[]) => Promise<boolean> | void;
  onEditMessage?: (messageId: string, newContent: string) => Promise<boolean>;
  onDeleteMessage?: (messageId: string) => Promise<boolean>;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onBack?: () => void;
  isLoading?: boolean;
  isSending?: boolean;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

function formatDividerTimestamp(dateInput: string, showFullDate: boolean): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const timePart = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (!showFullDate) return timePart;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return `Hôm nay • ${timePart}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `Hôm qua • ${timePart}`;
  }
  const datePart = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${datePart} • ${timePart}`;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  searchQuery = '',
  onSearchChange,
  onBack,
  isLoading = false,
  isSending = false,
  hasMore = false,
  loadingOlder = false,
  onLoadOlder,
  onShowToast,
}) => {
  const [inputContent, setInputContent] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const messageListRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isNearBottomRef = useRef<boolean>(true);
  const prevLastMsgIdRef = useRef<string | null>(null);
  const prevConvIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const wasLoadingOlderRef = useRef<boolean>(false);

  const { socket, isUserOnline } = useSocket();
  const convId = conversation?._id || null;

  // Reset inline states when switching conversation
  const [trackedConvId, setTrackedConvId] = useState<string | null>(convId);
  if (trackedConvId !== convId) {
    setTrackedConvId(convId);
    setShowSearchBar(false);
    setPendingImages([]);
    setEditingMsgId(null);
    setEditDraft('');
    setConfirmDeleteId(null);
    setPreviewImageUrl(null);
  }

  // Responsive viewport listener so Back button is hidden on desktop (>= 768px)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobileViewport(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Join direct/group conversation room & track actual typer names
  useEffect(() => {
    if (!socket || !convId) return;

    socket.emit('joinConversation', convId);
    const timersMap = remoteTypingTimersRef.current;

    const clearRemoteTimer = (uid: string) => {
      const existing = timersMap.get(uid);
      if (existing) {
        clearTimeout(existing);
        timersMap.delete(uid);
      }
    };

    const handleUserTyping = (data: { conversationId: string; userId: string; userName?: string }) => {
      if (data.conversationId === convId && String(data.userId) !== String(currentUserId)) {
        const uid = String(data.userId);
        const name = (data.userName || '').trim() || 'Thành viên';
        setTypingUsers((prev) => {
          const exists = prev.some((u) => u.userId === uid);
          if (exists) {
            return prev.map((u) => (u.userId === uid ? { ...u, userName: name } : u));
          }
          return [...prev, { userId: uid, userName: name }];
        });
        clearRemoteTimer(uid);
        timersMap.set(
          uid,
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((u) => u.userId !== uid));
            timersMap.delete(uid);
          }, 4500)
        );
      }
    };

    const handleUserStoppedTyping = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId === convId && String(data.userId) !== String(currentUserId)) {
        const uid = String(data.userId);
        clearRemoteTimer(uid);
        setTypingUsers((prev) => prev.filter((u) => u.userId !== uid));
      }
    };

    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      timersMap.forEach((t) => clearTimeout(t));
      timersMap.clear();
      socket.emit('stopTyping', {
        conversationId: convId,
        userId: currentUserId,
      });
      socket.emit('leaveConversation', convId);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
      setTypingUsers([]);
    };
  }, [socket, convId, currentUserId]);

  const handleScroll = () => {
    const el = messageListRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  };

  useEffect(() => {
    const el = messageListRef.current;
    if (wasLoadingOlderRef.current && !loadingOlder && el) {
      const addedHeight = el.scrollHeight - prevScrollHeightRef.current;
      if (addedHeight > 0) {
        el.scrollTop += addedHeight;
      }
      wasLoadingOlderRef.current = false;
    }
  }, [loadingOlder, messages]);

  useEffect(() => {
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const lastId = lastMsg?._id ? String(lastMsg._id) : null;
    const switchedConv = prevConvIdRef.current !== convId;
    const appendedNewBottomMsg = lastId !== null && lastId !== prevLastMsgIdRef.current;

    if (switchedConv) {
      prevConvIdRef.current = convId;
      prevLastMsgIdRef.current = lastId;
      isNearBottomRef.current = true;
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
      }
      return;
    }

    if (appendedNewBottomMsg) {
      prevLastMsgIdRef.current = lastId;
      const senderId = lastMsg ? (typeof lastMsg.sender === 'object' ? lastMsg.sender?._id : lastMsg.sender) : null;
      const sentByMe = String(senderId) === String(currentUserId);
      if (sentByMe || isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, convId, currentUserId]);

  const handleTriggerLoadOlder = () => {
    if (!onLoadOlder || loadingOlder) return;
    if (messageListRef.current) {
      prevScrollHeightRef.current = messageListRef.current.scrollHeight;
    }
    wasLoadingOlderRef.current = true;
    onLoadOlder();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputContent(val);

    if (socket && convId) {
      socket.emit('typing', {
        conversationId: convId,
        userId: currentUserId,
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', {
          conversationId: convId,
          userId: currentUserId,
        });
      }, 2000);
    }
  };

  const handlePickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const slots = Math.max(0, 4 - pendingImages.length);
    if (slots === 0) {
      onShowToast?.('Tối đa 4 hình ảnh mỗi tin nhắn.', 'info');
      e.target.value = '';
      return;
    }

    const picked = Array.from(files).slice(0, slots);
    setIsUploadingImage(true);
    try {
      const uploaded: string[] = [];
      for (const file of picked) {
        if (!file.type.startsWith('image/')) {
          onShowToast?.('Chỉ chấp nhận định dạng ảnh (JPG, PNG, WebP).', 'error');
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          onShowToast?.('Kích thước ảnh tối đa 5MB.', 'error');
          continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'));
          reader.readAsDataURL(file);
        });
        const cloudUrl = await uploadImageToCloudinary(dataUrl, file.name, 'forum');
        uploaded.push(cloudUrl);
      }
      if (uploaded.length > 0) {
        setPendingImages((prev) => [...prev, ...uploaded].slice(0, 4));
      }
    } catch (err: unknown) {
      onShowToast?.(
        err instanceof Error ? err.message : 'Không thể tải ảnh lên máy chủ.',
        'error'
      );
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputContent.trim();
    if ((!trimmed && pendingImages.length === 0) || isSending || isUploadingImage) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (socket && convId) {
      socket.emit('stopTyping', {
        conversationId: convId,
        userId: currentUserId,
      });
    }

    const imagesToSend = [...pendingImages];
    setInputContent('');
    setPendingImages([]);
    const ok = await onSendMessage(trimmed, imagesToSend.length > 0 ? imagesToSend : undefined);
    if (ok === false) {
      setInputContent(trimmed);
      setPendingImages(imagesToSend);
    }
  };

  const handleConfirmEdit = async (msgId: string) => {
    if (!onEditMessage || !editDraft.trim() || savingEditId) return;
    setSavingEditId(msgId);
    try {
      const ok = await onEditMessage(msgId, editDraft.trim());
      if (ok) {
        setEditingMsgId(null);
        setEditDraft('');
      }
    } finally {
      setSavingEditId(null);
    }
  };

  const handleConfirmDelete = async (msgId: string) => {
    if (!onDeleteMessage || deletingMsgId) return;
    setDeletingMsgId(msgId);
    try {
      const ok = await onDeleteMessage(msgId);
      if (ok) {
        setConfirmDeleteId(null);
      }
    } finally {
      setDeletingMsgId(null);
    }
  };

  if (!conversation) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--color-text-muted)',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <h3 className="font-editorial" style={{ fontSize: '1.5rem', fontWeight: 500, margin: '0 0 6px 0', color: 'var(--color-text-main)' }}>
          Tin Nhắn Trực Tiếp
        </h3>
        <p style={{ fontSize: '0.85rem', margin: 0 }}>
          Chọn một cuộc trò chuyện từ danh sách hoặc nhắn tin trực tiếp từ hồ sơ người dùng khác.
        </p>
      </div>
    );
  }

  const isGroup = Boolean(conversation.isGroup);
  const other = conversation.otherParticipant;
  const otherName = isGroup
    ? conversation.groupName || 'Nhóm Đoàn LOST'
    : other?.fullName || other?.username || 'Thành viên LOST';
  const otherAvatar = other?.avatarUrl || '';
  const isOnline = !isGroup && isUserOnline(other?._id, other?.email);

  const typingLabel =
    typingUsers.length === 1
      ? `${typingUsers[0].userName} đang soạn tin nhắn...`
      : typingUsers.length > 1
        ? `${typingUsers.map((u) => u.userName).join(', ')} đang soạn tin nhắn...`
        : '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--color-bg-main)',
        flex: 1,
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--color-bg-card)',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          {onBack && isMobileViewport && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onBack}
              aria-label="Quay lại danh sách hội thoại"
              style={{ padding: 6, display: 'flex', alignItems: 'center', borderRadius: 4 }}
            >
              <ArrowLeft size={18} />
            </button>
          )}

          {isGroup ? (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--color-sky) 16%, transparent)',
                border: '2px solid var(--color-sky)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-sky)',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          ) : otherAvatar ? (
            <img
              loading="lazy"
              decoding="async"
              src={otherAvatar}
              alt={otherName}
              referrerPolicy="no-referrer"
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                objectFit: 'cover',
                border: isOnline ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'color-mix(in srgb, var(--color-primary) 16%, transparent)',
                border: isOnline ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                color: 'var(--color-primary)',
                fontWeight: 800,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {otherName.charAt(0).toUpperCase()}
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {otherName}
            </div>
            {isGroup ? (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-sky)', fontWeight: 700 }}>
                Phòng Chat Nhóm Đoàn • {conversation.participants?.length || 1} thành viên
              </div>
            ) : isOnline ? (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                Trực tuyến
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Ngoại tuyến
              </div>
            )}
          </div>
        </div>

        {onSearchChange && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              if (showSearchBar && searchQuery) {
                onSearchChange('');
              }
              setShowSearchBar((prev) => !prev);
            }}
            aria-label="Tìm kiếm trong hội thoại"
            title="Tìm tin nhắn trong hội thoại"
            style={{
              padding: '6px 9px',
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.74rem',
              fontWeight: 700,
              color: showSearchBar || searchQuery ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderColor: showSearchBar || searchQuery ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          >
            <IconSearch size={14} />
            <span>Tìm</span>
          </button>
        )}
      </div>

      {/* In-Chat Search Bar */}
      {showSearchBar && onSearchChange && (
        <div
          style={{
            padding: '8px 14px',
            background: 'var(--color-surface-elevated)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            className="form-input"
            placeholder="Tìm nội dung tin nhắn trong cuộc trò chuyện này..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoFocus
            style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', borderRadius: 4 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Xóa từ khóa tìm kiếm"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: 4,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>
      )}

      {/* Message List Stream */}
      <div
        ref={messageListRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Pagination button for older messages */}
        {hasMore && onLoadOlder && (
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={loadingOlder}
              onClick={handleTriggerLoadOlder}
              style={{ padding: '5px 14px', fontSize: '0.76rem', fontWeight: 700, borderRadius: 4 }}
            >
              {loadingOlder ? 'Đang tải tin nhắn cũ...' : 'Tải thêm tin nhắn cũ'}
            </button>
          </div>
        )}

        {isLoading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Đang tải tin nhắn...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            {searchQuery.trim()
              ? `Không tìm thấy tin nhắn nào chứa "${searchQuery.trim()}".`
              : `Hãy gửi tin nhắn đầu tiên để bắt đầu trò chuyện với ${otherName}!`}
          </div>
        ) : (
          (() => {
            let lastReadMsgIndex = -1;
            messages.forEach((m, idx) => {
              const senderId = typeof m.sender === 'object' ? m.sender?._id : m.sender;
              const isMe = String(senderId) === String(currentUserId);
              const isReadByOther = m.readBy && m.readBy.some((id) => String(id) !== String(currentUserId));
              if (isMe && isReadByOther) {
                lastReadMsgIndex = idx;
              }
            });

            return messages.map((msg, idx) => {
              const senderObj = typeof msg.sender === 'object' ? msg.sender : null;
              const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender?._id;
              const isMe = String(senderId) === String(currentUserId);
              const senderDisplayName = senderObj?.fullName || senderObj?.username || otherName;
              const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
              const msgAvatar = senderObj?.avatarUrl || otherAvatar;
              const isLastReadMessage = idx === lastReadMsgIndex;
              const isDeleted = Boolean(msg.isDeleted);
              const msgImages = !isDeleted && Array.isArray(msg.images) ? msg.images : [];
              const isEditingThis = editingMsgId === msg._id;
              const isConfirmingDeleteThis = confirmDeleteId === msg._id;

              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;

              const prevSenderId = prevMsg ? (typeof prevMsg.sender === 'object' ? prevMsg.sender?._id : prevMsg.sender) : null;
              const nextSenderId = nextMsg ? (typeof nextMsg.sender === 'object' ? nextMsg.sender?._id : nextMsg.sender) : null;

              const currDate = msg.createdAt ? new Date(msg.createdAt) : null;
              const prevDate = prevMsg?.createdAt ? new Date(prevMsg.createdAt) : null;
              const currTime = currDate && !Number.isNaN(currDate.getTime()) ? currDate.getTime() : 0;
              const prevTime = prevDate && !Number.isNaN(prevDate.getTime()) ? prevDate.getTime() : 0;
              const nextTime = nextMsg?.createdAt ? new Date(nextMsg.createdAt).getTime() : 0;

              const isDifferentDay = Boolean(
                idx === 0 || (currDate && prevDate && currDate.toDateString() !== prevDate.toDateString())
              );
              const showTimeDivider = isDifferentDay || currTime - prevTime > 15 * 60 * 1000;

              const isSameSenderAsNext =
                nextMsg &&
                String(nextSenderId) === String(senderId) &&
                nextTime - currTime <= 5 * 60 * 1000 &&
                (!currDate || new Date(nextMsg.createdAt).toDateString() === currDate.toDateString());

              const showAvatar = !isMe && !isSameSenderAsNext;
              const showBottomTimestamp = !isSameSenderAsNext || isLastReadMessage || isMe;

              return (
                <React.Fragment key={msg._id || idx}>
                  {showTimeDivider && msg.createdAt && (
                    <div
                      style={{
                        textAlign: 'center',
                        margin: '12px 0 6px 0',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <span
                        style={{
                          background: 'var(--color-bg-card)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 4,
                          padding: '2px 10px',
                        }}
                      >
                        {formatDividerTimestamp(msg.createdAt, isDifferentDay)}
                      </span>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-end',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      width: '100%',
                      marginTop: !showTimeDivider && idx > 0 && String(prevSenderId) === String(senderId) ? -4 : 0,
                    }}
                  >
                    {!isMe && (
                      <div style={{ width: 30, height: 30, flexShrink: 0, marginBottom: showBottomTimestamp ? 18 : 0 }}>
                        {showAvatar && (
                          msgAvatar ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={msgAvatar}
                              alt={senderDisplayName}
                              referrerPolicy="no-referrer"
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid var(--color-border)',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: '50%',
                                background: 'color-mix(in srgb, var(--color-sky) 16%, transparent)',
                                border: '1px solid var(--color-border)',
                                color: 'var(--color-sky)',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {senderDisplayName.charAt(0).toUpperCase()}
                            </div>
                          )
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                      }}
                    >
                      {isGroup && !isMe && (idx === 0 || String(prevSenderId) !== String(senderId)) && (
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-sky)', marginBottom: 2, paddingLeft: 4 }}>
                          {senderDisplayName}
                        </div>
                      )}

                      {isEditingThis ? (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            padding: 10,
                            borderRadius: 6,
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-primary)',
                            minWidth: 220,
                          }}
                        >
                          <input
                            type="text"
                            className="form-input"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            disabled={savingEditId === msg._id}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleConfirmEdit(msg._id);
                              } else if (e.key === 'Escape') {
                                setEditingMsgId(null);
                                setEditDraft('');
                              }
                            }}
                            style={{ fontSize: '0.84rem', padding: '6px 10px', borderRadius: 4 }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => {
                                setEditingMsgId(null);
                                setEditDraft('');
                              }}
                              style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: 4 }}
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={!editDraft.trim() || savingEditId === msg._id}
                              onClick={() => handleConfirmEdit(msg._id)}
                              style={{ padding: '3px 10px', fontSize: '0.72rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <IconCheck size={12} />
                              <span>{savingEditId === msg._id ? 'Lưu...' : 'Lưu'}</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: msgImages.length > 0 && !msg.content ? 6 : '9px 14px',
                            borderRadius: 6,
                            background: isDeleted
                              ? 'var(--color-surface-elevated)'
                              : isMe
                                ? 'var(--color-primary)'
                                : 'var(--color-bg-card)',
                            color: isDeleted
                              ? 'var(--color-text-dim)'
                              : isMe
                                ? 'var(--color-on-primary)'
                                : 'var(--color-text-main)',
                            border: isDeleted
                              ? '1px dashed var(--color-border)'
                              : isMe
                                ? '1px solid var(--color-primary)'
                                : '1px solid var(--color-border)',
                            fontSize: '0.88rem',
                            fontStyle: isDeleted ? 'italic' : 'normal',
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            whiteSpace: 'pre-wrap',
                            boxShadow: 'var(--shadow-card)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          {msgImages.length > 0 && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: msgImages.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                                gap: 6,
                                maxWidth: 320,
                              }}
                            >
                              {msgImages.map((imgUrl, imgIdx) => (
                                <button
                                  key={imgIdx}
                                  type="button"
                                  onClick={() => setPreviewImageUrl(imgUrl)}
                                  style={{
                                    padding: 0,
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                    background: 'var(--color-bg-main)',
                                    cursor: 'zoom-in',
                                    height: msgImages.length === 1 ? 180 : 110,
                                  }}
                                >
                                  <img
                                    loading="lazy"
                                    decoding="async"
                                    src={imgUrl}
                                    alt={`Ảnh đính kèm ${imgIdx + 1}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                          {msg.content && <div>{msg.content}</div>}
                        </div>
                      )}

                      {showBottomTimestamp && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: '0.7rem',
                            color: 'var(--color-text-muted)',
                            marginTop: 3,
                            paddingLeft: 4,
                            paddingRight: 4,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>
                            {timeStr}
                            {msg.editedAt && !isDeleted ? ' • đã chỉnh sửa' : ''}
                            {isMe && isLastReadMessage ? ' • Đã xem' : ''}
                          </span>

                          {isMe && !isDeleted && !isEditingThis && (onEditMessage || onDeleteMessage) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              {onEditMessage && msg.content && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMsgId(msg._id);
                                    setEditDraft(msg.content);
                                    setConfirmDeleteId(null);
                                  }}
                                  title="Chỉnh sửa tin nhắn"
                                  aria-label="Chỉnh sửa tin nhắn"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-text-dim)',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    fontSize: '0.68rem',
                                  }}
                                >
                                  <IconEdit size={11} /> Sửa
                                </button>
                              )}

                              {onDeleteMessage && (
                                isConfirmingDeleteThis ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <button
                                      type="button"
                                      disabled={deletingMsgId === msg._id}
                                      onClick={() => handleConfirmDelete(msg._id)}
                                      style={{
                                        background: 'var(--color-error)',
                                        color: 'var(--color-on-primary)',
                                        border: 'none',
                                        borderRadius: 3,
                                        padding: '1px 6px',
                                        fontSize: '0.66rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {deletingMsgId === msg._id ? '...' : 'Thu hồi'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--color-text-muted)',
                                        fontSize: '0.66rem',
                                        cursor: 'pointer',
                                        padding: 0,
                                      }}
                                    >
                                      Hủy
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(msg._id)}
                                    title="Thu hồi tin nhắn"
                                    aria-label="Thu hồi tin nhắn"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--color-error-text, var(--color-error))',
                                      cursor: 'pointer',
                                      padding: 0,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 2,
                                      fontSize: '0.68rem',
                                    }}
                                  >
                                    <IconTrash size={11} /> Xóa
                                  </button>
                                )
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()
        )}

        {typingLabel && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: 'var(--color-bg-card)',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              fontSize: '0.76rem',
              color: 'var(--color-text-dim)',
              marginTop: 6,
              width: 'fit-content',
            }}
          >
            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)' }} />
            </span>
            <span>{typingLabel}</span>
          </div>
        )}

        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>

      {/* Pending Image Attachments Preview Strip */}
      {pendingImages.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            background: 'var(--color-surface-elevated)',
            borderTop: '1px solid var(--color-border)',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          {pendingImages.map((url, idx) => (
            <div
              key={idx}
              style={{
                position: 'relative',
                width: 56,
                height: 56,
                borderRadius: 4,
                overflow: 'hidden',
                border: '1px solid var(--color-border-strong)',
                flexShrink: 0,
              }}
            >
              <img loading="lazy" decoding="async" src={url} alt={`Đính kèm ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => setPendingImages((prev) => prev.filter((_, i) => i !== idx))}
                aria-label="Bỏ ảnh đính kèm"
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--overlay-bg)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-on-media)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <IconX size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={handleSend}
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          background: 'var(--color-bg-card)',
          borderTop: '1px solid var(--color-border)',
          flexShrink: 0,
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          alignItems: 'center',
        }}
      >
        <label
          title={isUploadingImage ? 'Đang tải ảnh lên...' : 'Đính kèm hình ảnh (tối đa 4 ảnh)'}
          style={{
            width: 40,
            height: 40,
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-main)',
            color: pendingImages.length > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isUploadingImage || pendingImages.length >= 4 ? 'not-allowed' : 'pointer',
            opacity: isUploadingImage || pendingImages.length >= 4 ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          <IconImage size={17} />
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isUploadingImage || pendingImages.length >= 4}
            onChange={handlePickImages}
            style={{ display: 'none' }}
          />
        </label>

        <input
          type="text"
          className="form-input"
          placeholder={
            isUploadingImage
              ? 'Đang tải ảnh lên...'
              : isSending
                ? 'Đang gửi tin nhắn...'
                : 'Nhập tin nhắn...'
          }
          value={inputContent}
          disabled={isSending}
          onChange={handleInputChange}
          style={{ flex: 1, padding: '10px 14px', fontSize: '0.88rem', borderRadius: 4 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSending || isUploadingImage || (!inputContent.trim() && pendingImages.length === 0)}
          aria-label="Gửi tin nhắn"
          style={{
            borderRadius: 4,
            width: 42,
            height: 42,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Send size={18} />
        </button>
      </form>

      {/* Inline Image Lightbox Preview */}
      {previewImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh tin nhắn"
          onClick={() => setPreviewImageUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--overlay-bg)',
            zIndex: 'var(--z-lightbox, 4000)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            aria-label="Đóng xem ảnh"
            style={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 38,
              height: 38,
              borderRadius: 4,
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <IconX size={18} />
          </button>
          <img
            loading="lazy"
            decoding="async"
            src={previewImageUrl}
            alt="Ảnh phóng to"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              borderRadius: 6,
              border: '1px solid var(--color-border-strong)',
              objectFit: 'contain',
              boxShadow: 'var(--shadow-3d)',
            }}
          />
        </div>
      )}
    </div>
  );
};
