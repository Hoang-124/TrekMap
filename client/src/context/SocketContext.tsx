import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { UserProfile } from '../types.js';
import { fetchWithTimeout } from '../utils/sessionHeaders.js';
import { clearSensitiveSessionStorage, safeLocalStorageGet, safeLocalStorageRemove } from '../utils/storageScope.js';

interface SocketConnectionContextType {
  socket: Socket | null;
  isConnected: boolean;
}

interface SocketContextType extends SocketConnectionContextType {
  onlineUsers: Set<string>;
  isUserOnline: (userId?: string, userEmail?: string) => boolean;
}

const EMPTY_ONLINE_USERS = new Set<string>();
const NOOP_IS_ONLINE = () => false;

const SocketConnectionContext = createContext<SocketConnectionContextType>({
  socket: null,
  isConnected: false,
});

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: EMPTY_ONLINE_USERS,
  isUserOnline: NOOP_IS_ONLINE,
});

interface SocketProviderProps {
  currentUser: UserProfile | null;
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ currentUser, children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set());

  // Depend strictly on primitive identity so profile object re-renders do not tear down sockets
  const currentUserId =
    currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || null;
  const currentUserEmail = currentUser?.email?.toLowerCase() || null;
  const userIdentityRef = useRef({ id: currentUserId, email: currentUserEmail });

  useEffect(() => {
    userIdentityRef.current = { id: currentUserId, email: currentUserEmail };
  }, [currentUserId, currentUserEmail]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? safeLocalStorageGet('lost_token') : null;
    const configuredUrl = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL;
    const socketUrl =
      configuredUrl && configuredUrl.trim()
        ? configuredUrl.trim()
        : typeof window !== 'undefined'
          ? window.location.origin
          : 'http://localhost:5000';

    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: token || undefined },
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      setIsConnected((prev) => (prev ? prev : true));
      setSocket((prev) => (prev === socketInstance ? prev : socketInstance));

      const userId = userIdentityRef.current.id || userIdentityRef.current.email;
      if (userId) {
        socketInstance.emit('join', String(userId));
      }
    });

    const pingInterval = setInterval(() => {
      if (socketInstance.connected && !document.hidden) {
        socketInstance.emit('ping');
      }
    }, 30000);

    socketInstance.on('onlineUsersList', (users: string[]) => {
      const normalized = Array.isArray(users) ? users.map(String) : [];
      setOnlineUsers((prev) => {
        const nextSet = new Set(normalized);
        if (prev.size === nextSet.size) {
          let identical = true;
          for (const id of nextSet) {
            if (!prev.has(id)) {
              identical = false;
              break;
            }
          }
          if (identical) return prev;
        }
        return nextSet;
      });
    });

    socketInstance.on('userStatus', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      const key = String(userId);
      setOnlineUsers((prev) => {
        const alreadyOnline = prev.has(key);
        if (Boolean(isOnline) === alreadyOnline) {
          return prev;
        }
        const next = new Set(prev);
        if (isOnline) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
    });

    const unmountController = new AbortController();
    let banRedirectTimer: ReturnType<typeof setTimeout> | null = null;

    socketInstance.on('userBanned', (data: { userId?: string; email?: string; reason?: string }) => {
      const myId = userIdentityRef.current.id;
      const myEmail = userIdentityRef.current.email;
      if (
        (data.userId && myId && String(myId) === String(data.userId)) ||
        (data.email && myEmail && myEmail === data.email.toLowerCase())
      ) {
        clearSensitiveSessionStorage();
        safeLocalStorageRemove('lost_token');
        window.dispatchEvent(new CustomEvent('lost:auth-changed'));
        window.dispatchEvent(
          new CustomEvent('lost:show-toast', {
            detail: {
              message:
                data.reason ||
                'Tài khoản của bạn đã bị Ban Quản Trị khóa do vi phạm quy định cộng đồng.',
              type: 'error',
            },
          })
        );
        if (banRedirectTimer) clearTimeout(banRedirectTimer);
        banRedirectTimer = setTimeout(() => {
          banRedirectTimer = null;
          window.location.href = '/';
        }, 1200);
      }
    });

    socketInstance.on('userRoleUpdated', async (data: { userId?: string; role?: string }) => {
      const myId = userIdentityRef.current.id;
      if (data.userId && myId && String(myId) !== String(data.userId)) return;
      try {
        const res = await fetchWithTimeout(
          '/api/auth/refresh',
          {
            method: 'POST',
            credentials: 'include',
            signal: unmountController.signal,
          },
          10_000
        );
        if (unmountController.signal.aborted) return;
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json?.token) {
            localStorage.setItem('lost_token', json.token);
          }
        }
      } catch {
        if (unmountController.signal.aborted) return;
        // Non-fatal: user will refresh on next navigation
      }
      if (unmountController.signal.aborted) return;
      window.dispatchEvent(new CustomEvent('lost:auth-changed'));
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: {
            message: `Quyền tài khoản của bạn đã được cập nhật${data.role ? ` (${data.role})` : ''}. Phiên đã tự động đồng bộ.`,
            type: 'info',
          },
        })
      );
    });

    socketInstance.on('safetyTimerOverdue', (data: { trailName?: string; message?: string }) => {
      window.dispatchEvent(
        new CustomEvent('lost:show-toast', {
          detail: {
            message:
              data?.message ||
              `Lịch báo bình an${data?.trailName ? ` (${data.trailName})` : ''} đã quá hạn! Hãy mở mục Hẹn giờ an toàn để xác nhận bạn đã an toàn.`,
            type: 'error',
          },
        })
      );
    });

    socketInstance.on('disconnect', () => {
      setIsConnected((prev) => (prev ? false : prev));
    });

    return () => {
      unmountController.abort();
      if (banRedirectTimer) {
        clearTimeout(banRedirectTimer);
        banRedirectTimer = null;
      }
      clearInterval(pingInterval);
      socketInstance.removeAllListeners();
      socketInstance.disconnect();
      setSocket((prev) => (prev === null ? prev : null));
      setIsConnected((prev) => (prev ? false : prev));
    };
  }, [currentUserId]);

  const isUserOnline = useCallback(
    (userId?: string, userEmail?: string): boolean => {
      if (!userId && !userEmail) return false;
      if (userId && onlineUsers.has(String(userId))) return true;
      if (userEmail && onlineUsers.has(String(userEmail))) return true;
      return false;
    },
    [onlineUsers]
  );

  const connectionValue = useMemo<SocketConnectionContextType>(
    () => ({ socket, isConnected }),
    [socket, isConnected]
  );

  const contextValue = useMemo<SocketContextType>(
    () => ({ socket, isConnected, onlineUsers, isUserOnline }),
    [socket, isConnected, onlineUsers, isUserOnline]
  );

  return (
    <SocketConnectionContext.Provider value={connectionValue}>
      <SocketContext.Provider value={contextValue}>
        {children}
      </SocketContext.Provider>
    </SocketConnectionContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- co-exported context hooks imported by App, Navbar, NotificationBell & NotificationsPage
export const useSocketConnection = () => useContext(SocketConnectionContext);

// eslint-disable-next-line react-refresh/only-export-components -- co-exported context hook imported by App, NotificationBell & NotificationsPage
export const useSocket = () => useContext(SocketContext);
