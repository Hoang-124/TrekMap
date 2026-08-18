import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Types } from 'mongoose';
import { CommunityMessageModel } from '../models/CommunityMessage.js';
import { UserModel } from '../models/User.js';
import { verifyToken } from '../utils/auth.js';
import { sanitizeInput } from '../utils/validation.js';
import { containsProfanity } from '../utils/profanityFilter.js';

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

  // Socket.io Authentication Middleware for secure Handshake
  io.use((socket: Socket, next) => {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    const token = rawToken && typeof rawToken === 'string' && rawToken.startsWith('Bearer ')
      ? rawToken.substring(7)
      : (typeof rawToken === 'string' ? rawToken : null);

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        (socket as any).data = {
          user: decoded,
          userId: String(decoded.userId),
          email: decoded.email,
          role: decoded.role,
        };
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    console.log(`⚡ [Socket.io] Client connected: ${socket.id}`);

    // Auto-join authenticated user room upon verified handshake
    const authenticatedUid = (socket as any).data?.userId;
    if (authenticatedUid) {
      const uid = String(authenticatedUid);
      const roomName = `user:${uid}`;
      socket.join(roomName);
      socketToUser.set(socket.id, uid);
      if (!userSockets.has(uid)) {
        userSockets.set(uid, new Set());
      }
      userSockets.get(uid)?.add(socket.id);

      io?.emit('userStatus', { userId: uid, isOnline: true });
      socket.emit('onlineUsersList', Array.from(userSockets.keys()));
    }

    // Join user room with strict identity authorization check (Anti-spoofing)
    socket.on('join', (userId: string) => {
      const authUid = (socket as any).data?.userId;
      const requestedUid = String(userId || '');

      // Allow joining if client is verified as that user OR if running in local session
      if (authUid && requestedUid === authUid) {
        const roomName = `user:${authUid}`;
        socket.join(roomName);
        socketToUser.set(socket.id, authUid);
        if (!userSockets.has(authUid)) {
          userSockets.set(authUid, new Set());
        }
        userSockets.get(authUid)?.add(socket.id);

        io?.emit('userStatus', { userId: authUid, isOnline: true });
        socket.emit('onlineUsersList', Array.from(userSockets.keys()));
      } else if (!authUid) {
        console.warn(`⚠️ [Socket Security]: Unauthenticated client ${socket.id} attempted to join user room "${requestedUid}".`);
      } else {
        console.warn(`⚠️ [Socket Security Alert]: User ${authUid} attempted to spoof room "${requestedUid}". Blocked.`);
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

    // Broadcast Radio Transmit Message to all listeners (single emit to avoid duplicates)
    socket.on('radioMessage', (msgData: any) => {
      const ch = msgData.channel || 'Channel 1';
      io?.emit('radioMessage', msgData);
    });

    // Join Public Community Chatroom
    socket.on('joinCommunityChat', () => {
      socket.join('room:community_chat');
      const count = io?.sockets.adapter.rooms.get('room:community_chat')?.size || 1;
      io?.to('room:community_chat').emit('communityOnlineCount', count);
      console.log(`💬 [Community Chat] Socket ${socket.id} joined room:community_chat (Online: ${count})`);
    });

    // Leave Public Community Chatroom
    socket.on('leaveCommunityChat', () => {
      socket.leave('room:community_chat');
      const count = io?.sockets.adapter.rooms.get('room:community_chat')?.size || 0;
      io?.to('room:community_chat').emit('communityOnlineCount', count);
    });

    // Send Public Community Chat Message (H3: sanitized, H4: identity from socket.data)
    socket.on('sendCommunityChatMessage', async (msgData: any) => {
      try {
        if (!msgData || !msgData.text) return;

        // Sanitize message text and enforce max length
        const cleanText = sanitizeInput(String(msgData.text)).slice(0, 1000);
        if (!cleanText.trim()) return;

        // Reject profanity
        if (containsProfanity(cleanText)) {
          socket.emit('chatError', { message: 'Tin nhắn chứa từ ngữ vi phạm quy chuẩn cộng đồng.' });
          return;
        }

        // H4: Extract verified sender identity from socket handshake auth, NOT from client body
        const authUser = (socket as any).data?.user || (socket as any).data;
        let trustedSenderId: Types.ObjectId | undefined;
        let trustedSenderName = 'Trekker Ẩn Danh';
        let trustedSenderAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80';
        let trustedSenderBadge = 'Trekker';
        let trustedNameColor = 'var(--color-primary)';

        if (authUser?.userId) {
          trustedSenderId = Types.ObjectId.isValid(String(authUser.userId))
            ? new Types.ObjectId(String(authUser.userId))
            : undefined;
          // Fetch live user data from DB for authoritative name/avatar
          try {
            const dbUser = await UserModel.findById(authUser.userId).select('fullName avatarUrl role').lean();
            if (dbUser) {
              trustedSenderName = dbUser.fullName || trustedSenderName;
              trustedSenderAvatar = dbUser.avatarUrl || trustedSenderAvatar;
              trustedSenderBadge = dbUser.role === 'admin' ? 'BQT TrekMap' : 'Trekker';
              trustedNameColor = dbUser.role === 'admin' ? 'var(--color-sky)' : 'var(--color-primary)';
            }
          } catch (dbErr) {
            // Fallback to token data
            trustedSenderName = authUser.email?.split('@')[0] || trustedSenderName;
          }
        }

        const validQuote = msgData.quote && typeof msgData.quote === 'object' && msgData.quote.author && msgData.quote.text
          ? { author: sanitizeInput(String(msgData.quote.author)), text: sanitizeInput(String(msgData.quote.text)) }
          : undefined;

        const savedDoc = await CommunityMessageModel.create({
          senderId: trustedSenderId,
          senderName: trustedSenderName,
          senderAvatar: trustedSenderAvatar,
          senderBadge: trustedSenderBadge,
          nameColor: trustedNameColor,
          text: cleanText,
          quote: validQuote,
        });

        const newMsg = {
          id: (savedDoc as any)._id?.toString() || `msg-${Date.now()}`,
          senderId: trustedSenderId?.toString() || msgData.senderId,
          senderName: savedDoc.senderName,
          senderAvatar: savedDoc.senderAvatar,
          senderBadge: savedDoc.senderBadge,
          nameColor: savedDoc.nameColor,
          text: savedDoc.text,
          quote: validQuote,
          createdAt: savedDoc.createdAt ? new Date(savedDoc.createdAt).toISOString() : new Date().toISOString(),
        };

        // Single broadcast to community chat room (no duplicate io.emit)
        io?.to('room:community_chat').emit('newCommunityMessage', newMsg);
      } catch (err) {
        console.error('[Community Chat Socket Error]:', err);
      }
    });

    socket.on('disconnecting', () => {
      if (socket.rooms.has('room:community_chat')) {
        const currentSize = io?.sockets.adapter.rooms.get('room:community_chat')?.size || 1;
        const remainingCount = Math.max(0, currentSize - 1);
        socket.to('room:community_chat').emit('communityOnlineCount', remainingCount);
        io?.emit('communityOnlineCount', remainingCount);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] Client disconnected: ${socket.id}`);

      // Recalculate and broadcast online count for community chat
      const remainingCommunity = io?.sockets.adapter.rooms.get('room:community_chat')?.size || 0;
      io?.to('room:community_chat').emit('communityOnlineCount', remainingCommunity);
      io?.emit('communityOnlineCount', remainingCommunity);

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
