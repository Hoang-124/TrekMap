import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!globalSocket) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('trekmap_token') : null;
    const socketUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? window.location.origin
      : 'http://localhost:5000';

    globalSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: token || undefined },
    });
  }
  return globalSocket;
};
