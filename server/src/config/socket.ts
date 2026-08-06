import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

// Track online user sockets
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
const socketToUser = new Map<string, string>(); // socketId -> userId

export const initSocketServer = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`⚡ [Socket.io] Client connected: ${socket.id}`);

    // Join user room for targeted notifications & direct messaging
    socket.on('join', (userId: string) => {
      if (userId) {
        const uid = String(userId);
        const roomName = `user:${uid}`;
        socket.join(roomName);

        socketToUser.set(socket.id, uid);
        if (!userSockets.has(uid)) {
          userSockets.set(uid, new Set());
        }
        userSockets.get(uid)?.add(socket.id);

        console.log(`👤 [Socket.io] Socket ${socket.id} joined room ${roomName}`);

        // Broadcast online status change to all connected clients
        io?.emit('userStatus', { userId: uid, isOnline: true });

        // Send current list of online users to the newly connected socket
        socket.emit('onlineUsersList', Array.from(userSockets.keys()));
      }
    });

    // Join Radio Basecamp Channel Room
    socket.on('joinRadioChannel', (channel: string) => {
      if (channel) {
        socket.join(`radio:${channel}`);
        console.log(`📻 [Radio Socket] Socket ${socket.id} joined channel radio:${channel}`);
      }
    });

    // Broadcast Radio Transmit Message to channel room & all listeners
    socket.on('radioMessage', (msgData: any) => {
      const ch = msgData.channel || 'Channel 1';
      io?.to(`radio:${ch}`).emit('radioMessage', msgData);
      io?.emit('radioMessage', msgData);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);

      const uid = socketToUser.get(socket.id);
      if (uid) {
        socketToUser.delete(socket.id);
        const set = userSockets.get(uid);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) {
            userSockets.delete(uid);
            io?.emit('userStatus', { userId: uid, isOnline: false });
          }
        }
      }
    });
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, payload: any) => {
  if (io) {
    const uid = String(userId);
    io.to(`user:${uid}`).emit(event, payload);

    // Backup: emit directly to socket IDs of the target user
    const set = userSockets.get(uid);
    if (set) {
      for (const socketId of set) {
        io.sockets.sockets.get(socketId)?.emit(event, payload);
      }
    }
  }
};

export const broadcastEvent = (event: string, payload: any) => {
  if (io) {
    io.emit(event, payload);
  }
};

export const isUserOnline = (userId: string): boolean => {
  const set = userSockets.get(String(userId));
  return !!set && set.size > 0;
};
