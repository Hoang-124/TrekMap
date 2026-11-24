import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { UserProfile } from '../types.js';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: Set<string>;
  isUserOnline: (userId?: string, userEmail?: string) => boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Set(),
  isUserOnline: () => false,
});

interface SocketProviderProps {
  currentUser: UserProfile | null;
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ currentUser, children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Depend strictly on primitive identity so profile object re-renders do not tear down sockets
  const currentUserId =
    currentUser?.id || (currentUser as (UserProfile & { _id?: string }) | null)?._id || null;
  const currentUserEmail = currentUser?.email?.toLowerCase() || null;
  const userIdentityRef = useRef({ id: currentUserId, email: currentUserEmail });

  useEffect(() => {
    userIdentityRef.current = { id: currentUserId, email: currentUserEmail };
  }, [currentUserId, currentUserEmail]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('lost_token') : null;
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
      setIsConnected(true);
      setSocket(socketInstance);

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
      setOnlineUsers(new Set(users.map(String)));
    });

    socketInstance.on('userStatus', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (isOnline) {
          next.add(String(userId));
        } else {
          next.delete(String(userId));
        }
        return next;
      });
    });

    socketInstance.on('userBanned', (data: { userId?: string; email?: string; reason?: string }) => {
      const myId = userIdentityRef.current.id;
      const myEmail = userIdentityRef.current.email;
      if (
        (data.userId && myId && String(myId) === String(data.userId)) ||
        (data.email && myEmail && myEmail === data.email.toLowerCase())
      ) {
        localStorage.removeItem('lost_token');
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
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      clearInterval(pingInterval);
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [currentUserId]);

  const isUserOnline = (userId?: string, userEmail?: string): boolean => {
    if (!userId && !userEmail) return false;
    if (userId && onlineUsers.has(String(userId))) return true;
    if (userEmail && onlineUsers.has(String(userEmail))) return true;
    return false;
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, onlineUsers, isUserOnline }}>
      {children}
    </SocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- co-exported context hook imported by App, NotificationBell & NotificationsPage
export const useSocket = () => useContext(SocketContext);
