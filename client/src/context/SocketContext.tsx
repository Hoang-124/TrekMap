import React, { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('trekmap_token') : null;
    const socketUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? window.location.origin
      : 'http://localhost:5000';

    // Connect to server socket with automatic robust reconnection & authenticated handshake
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
      console.log('⚡ [Socket.io Client] Connected to server:', socketInstance.id);
      setIsConnected(true);

      const userId = currentUser?.id || (currentUser as any)?._id || currentUser?.email;
      if (userId) {
        socketInstance.emit('join', String(userId));
      }
    });

    // Heartbeat Interval
    const pingInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('ping');
      }
    }, 25000);

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

    socketInstance.on('userBanned', (data: { userId?: string; email?: string }) => {
      const myId = currentUser?.id || (currentUser as any)?._id;
      const myEmail = currentUser?.email?.toLowerCase();
      if ((data.userId && String(myId) === String(data.userId)) || (data.email && myEmail === data.email?.toLowerCase())) {
        localStorage.removeItem('trekmap_token');
        alert('Tài khoản của bạn đã bị Ban Quản Trị khóa vĩnh viễn do vi phạm quy định cộng đồng hoặc báo động sai sự thật.');
        window.location.href = '/';
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 [Socket.io Client] Disconnected from server');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      clearInterval(pingInterval);
      socketInstance.disconnect();
    };
  }, [currentUser]);

  // When currentUser changes (login/logout/switch), re-emit join with current userId
  useEffect(() => {
    if (socket && isConnected) {
      const userId = currentUser?.id || (currentUser as any)?._id || currentUser?.email;
      if (userId) {
        socket.emit('join', String(userId));
      }
    }
  }, [currentUser, socket, isConnected]);

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

export const useSocket = () => useContext(SocketContext);
