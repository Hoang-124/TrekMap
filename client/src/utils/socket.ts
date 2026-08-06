import { io, Socket } from 'socket.io-client';

let globalSocket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!globalSocket) {
    globalSocket = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
    });
  }
  return globalSocket;
};
