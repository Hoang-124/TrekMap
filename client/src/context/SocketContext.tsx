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
    // Connect to server socket
    const socketInstance = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('⚡ [Socket.io Client] Connected to server:', socketInstance.id);
      setIsConnected(true);

      const userId = currentUser?.id || (currentUser as any)?._id || currentUser?.email;
      if (userId) {
        socketInstance.emit('join', String(userId));
      }
    });

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

    socketInstance.on('disconnect', () => {
      console.log('🔌 [Socket.io Client] Disconnected from server');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

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
