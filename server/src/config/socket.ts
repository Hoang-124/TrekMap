import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

let io: Server | null = null;

// Track online user sockets
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
const socketToUser = new Map<string, string>(); // socketId -> userId

export const initSocketServer = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173',
        'https://trekmap.vn',
        'https://www.trekmap.vn',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
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

    // Join direct conversation room for instant chat delivery & typing status
    socket.on('joinConversation', (conversationId: string) => {
      if (conversationId) {
        socket.join(`conv:${conversationId}`);
        console.log(`💬 [Chat Socket] Socket ${socket.id} joined conv:${conversationId}`);
      }
    });

    socket.on('leaveConversation', (conversationId: string) => {
      if (conversationId) {
        socket.leave(`conv:${conversationId}`);
      }
    });

    // Typing indicators
    socket.on('typing', ({ conversationId, userId, userName }: { conversationId: string; userId: string; userName?: string }) => {
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('userTyping', { conversationId, userId, userName });
      }
    });

    socket.on('stopTyping', ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      if (conversationId) {
        socket.to(`conv:${conversationId}`).emit('userStoppedTyping', { conversationId, userId });
      }
    });

    // Heartbeat ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
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
