import crypto from 'crypto';
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import mongoose, { Types } from 'mongoose';
import { CommunityMessageModel } from '../models/CommunityMessage.js';
import { ConversationModel } from '../models/Conversation.js';
import { UserModel } from '../models/User.js';
import { verifyToken } from '../utils/auth.js';
import { sanitizeInput } from '../utils/validation.js';
import { containsProfanity } from '../utils/profanityFilter.js';
import { getAllowedOrigins } from './cors.js';

let io: Server | null = null;

// Track online user sockets
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
const socketToUser = new Map<string, string>(); // socketId -> userId

// Per-user (not only per-socket) rate limiting so reconnects/tabs cannot bypass limits
const userSocketRateLimits = new Map<string, number[]>();
const MAX_RATE_KEYS = 5000;
const MAX_RADIO_CHANNELS_PER_SOCKET = 5;
const SOCKET_AUTH_RECHECK_MS = 5000;

/**
 * Re-verifies authenticated socket against MongoDB so mid-session bans or tokenVersion revocations
 * take effect immediately across joinConversation / typing / radio / community chat events.
 */
async function ensureSocketUserActive(socket: Socket, forceFresh = false): Promise<boolean> {
  const authUid: string | undefined = socket.data?.userId;
  if (!authUid || !Types.ObjectId.isValid(authUid)) return false;
  if (mongoose.connection.readyState !== 1) return false;

  const now = Date.now();
  const lastCheck = typeof socket.data?._lastAuthCheckAt === 'number' ? socket.data._lastAuthCheckAt : 0;
  if (!forceFresh && now - lastCheck < SOCKET_AUTH_RECHECK_MS) {
    return true;
  }

  try {
    const dbUser = await UserModel.findById(authUid)
      .select('isBanned tokenVersion role fullName avatarUrl')
      .lean();
    const currentVersion = typeof dbUser?.tokenVersion === 'number' ? dbUser.tokenVersion : 0;
    const tokenVersion = typeof socket.data?.tokenVersion === 'number' ? socket.data.tokenVersion : 0;
    if (!dbUser || dbUser.isBanned || tokenVersion < currentVersion) {
      socket.emit('chatError', { message: 'Phiên đăng nhập đã hết hiệu lực hoặc tài khoản bị khóa.' });
      socket.disconnect(true);
      return false;
    }
    socket.data._lastAuthCheckAt = now;
    socket.data.role = dbUser.role;
    socket.data.fullName = dbUser.fullName;
    socket.data.avatarUrl = dbUser.avatarUrl;
    return true;
  } catch {
    return false;
  }
}

function checkSocketRateLimit(
  socket: Socket,
  bucket: string,
  maxCount: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const identity = socket.data?.userId ? `u:${socket.data.userId}` : `s:${socket.id}`;
  const key = `${bucket}:${identity}`;
  const existing = userSocketRateLimits.get(key) || [];
  const hits = existing.filter((ts) => now - ts < windowMs);
  if (hits.length >= maxCount) {
    userSocketRateLimits.set(key, hits);
    return false;
  }
  hits.push(now);
  if (userSocketRateLimits.size >= MAX_RATE_KEYS) {
    const oldest = userSocketRateLimits.keys().next().value;
    if (oldest) userSocketRateLimits.delete(oldest);
  }
  userSocketRateLimits.set(key, hits);
  return true;
}

const rateCleanup = setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [k, hits] of userSocketRateLimits.entries()) {
    const recent = hits.filter((ts) => ts > cutoff);
    if (recent.length === 0) userSocketRateLimits.delete(k);
    else userSocketRateLimits.set(k, recent);
  }
}, 60_000);
rateCleanup.unref();

export const initSocketServer = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    },
  });

  // Strict Socket.io Authentication Handshake Middleware (fails closed when DB unavailable or user banned/revoked)
  io.use(async (socket: Socket, next) => {
    try {
      const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      const token =
        rawToken && typeof rawToken === 'string' && rawToken.startsWith('Bearer ')
          ? rawToken.substring(7)
          : typeof rawToken === 'string'
            ? rawToken
            : null;

      if (token && mongoose.connection.readyState === 1) {
        const decoded = verifyToken(token);
        if (decoded?.userId && Types.ObjectId.isValid(decoded.userId)) {
          const dbUser = await UserModel.findById(decoded.userId)
            .select('role isBanned email tokenVersion fullName avatarUrl')
            .lean();
          const currentVersion = typeof dbUser?.tokenVersion === 'number' ? dbUser.tokenVersion : 0;
          const tokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
          if (dbUser && !dbUser.isBanned && tokenVersion >= currentVersion) {
            socket.data = {
              user: { ...decoded, role: dbUser.role },
              userId: dbUser._id.toString(),
              email: dbUser.email,
              role: dbUser.role,
              fullName: dbUser.fullName,
              avatarUrl: dbUser.avatarUrl,
              tokenVersion,
              _lastAuthCheckAt: Date.now(),
            };
          }
        }
      }
    } catch {
      // Fall back to anonymous read-only socket with no auth context
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const authenticatedUid: string | undefined = socket.data?.userId;
    if (authenticatedUid) {
      const uid = String(authenticatedUid);
      socket.join(`user:${uid}`);
      socket.join('room:authenticated');
      socketToUser.set(socket.id, uid);
      if (!userSockets.has(uid)) {
        userSockets.set(uid, new Set());
      }
      userSockets.get(uid)?.add(socket.id);

      io?.to('room:authenticated').emit('userStatus', { userId: uid, isOnline: true });
      socket.emit('onlineUsersList', Array.from(userSockets.keys()));
    }

    // Strict identity check + rate limit for explicit user room join
    socket.on('join', (userId: string) => {
      if (!checkSocketRateLimit(socket, 'join', 5, 10_000)) return;
      const authUid: string | undefined = socket.data?.userId;
      const requestedUid = String(userId || '');
      if (authUid && requestedUid === authUid) {
        socket.join(`user:${authUid}`);
        socket.join('room:authenticated');
        socketToUser.set(socket.id, authUid);
        if (!userSockets.has(authUid)) {
          userSockets.set(authUid, new Set());
        }
        userSockets.get(authUid)?.add(socket.id);
        socket.emit('onlineUsersList', Array.from(userSockets.keys()));
      }
    });

    // Authorized join for private DM / squad group conversation rooms (fail closed if DB offline or revoked)
    socket.on('joinConversation', async (conversationId: string) => {
      const authUid: string | undefined = socket.data?.userId;
      if (
        !authUid ||
        typeof conversationId !== 'string' ||
        !Types.ObjectId.isValid(conversationId) ||
        mongoose.connection.readyState !== 1
      ) {
        return;
      }
      if (!(await ensureSocketUserActive(socket, true))) return;
      try {
        const isMember = await ConversationModel.exists({
          _id: conversationId,
          participants: authUid,
        });
        if (!isMember) return;
        socket.join(`conv:${conversationId}`);
      } catch {
        // Deny join on verification failure
      }
    });

    socket.on('leaveConversation', (conversationId: string) => {
      if (typeof conversationId === 'string' && conversationId) {
        socket.leave(`conv:${conversationId}`);
      }
    });

    // Authenticated & rate-limited typing indicators
    socket.on('typing', async (payload?: { conversationId?: string }) => {
      const authUid: string | undefined = socket.data?.userId;
      const conversationId = payload?.conversationId;
      if (!authUid || !conversationId || !socket.rooms.has(`conv:${conversationId}`)) return;
      if (!checkSocketRateLimit(socket, 'typing', 15, 10_000)) return;
      if (!(await ensureSocketUserActive(socket, false))) return;
      socket.to(`conv:${conversationId}`).emit('userTyping', {
        conversationId,
        userId: authUid,
        userName: socket.data?.fullName || 'Trekker',
      });
    });

    socket.on('stopTyping', (payload?: { conversationId?: string }) => {
      const authUid: string | undefined = socket.data?.userId;
      const conversationId = payload?.conversationId;
      if (!authUid || !conversationId || !socket.rooms.has(`conv:${conversationId}`)) return;
      socket.to(`conv:${conversationId}`).emit('userStoppedTyping', {
        conversationId,
        userId: authUid,
      });
    });

    // Heartbeat ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Authenticated & bounded Radio Basecamp Channel Rooms
    socket.on('joinRadioChannel', async (channel: string) => {
      const authUid: string | undefined = socket.data?.userId;
      if (!authUid || typeof channel !== 'string' || !channel.trim()) return;
      if (!(await ensureSocketUserActive(socket, true))) return;
      const cleanChannel = channel.trim().slice(0, 40);
      const currentRadioRooms = Array.from(socket.rooms).filter((r) => r.startsWith('radio:'));
      if (currentRadioRooms.length >= MAX_RADIO_CHANNELS_PER_SOCKET && !socket.rooms.has(`radio:${cleanChannel}`)) {
        return;
      }
      socket.join(`radio:${cleanChannel}`);
    });

    socket.on('leaveRadioChannel', (channel: string) => {
      if (typeof channel === 'string' && channel.trim()) {
        socket.leave(`radio:${channel.trim().slice(0, 40)}`);
      }
    });

    // Authenticated & channel-scoped Radio Transmit Message (must have joined the channel)
    socket.on('radioMessage', async (msgData?: Record<string, unknown>) => {
      const authUid: string | undefined = socket.data?.userId;
      if (!authUid || !msgData || typeof msgData !== 'object') return;
      if (!checkSocketRateLimit(socket, 'radio', 10, 15_000)) return;

      const ch =
        typeof msgData.channel === 'string' && msgData.channel.trim()
          ? msgData.channel.trim().slice(0, 40)
          : 'Channel 1';
      if (!socket.rooms.has(`radio:${ch}`)) return;
      if (!(await ensureSocketUserActive(socket, false))) return;

      const rawText =
        typeof msgData.text === 'string'
          ? msgData.text
          : typeof msgData.message === 'string'
            ? msgData.message
            : '';
      const cleanText = sanitizeInput(rawText).slice(0, 500);
      if (!cleanText || containsProfanity(cleanText)) return;

      io?.to(`radio:${ch}`).emit('radioMessage', {
        id: `rad-${crypto.randomUUID()}`,
        channel: ch,
        senderId: authUid,
        senderName: socket.data?.fullName || 'Trekker',
        text: cleanText,
        timestamp: new Date().toISOString(),
      });
    });

    // Join / Leave Public Community Chatroom
    socket.on('joinCommunityChat', () => {
      socket.join('room:community_chat');
      const count = io?.sockets.adapter.rooms.get('room:community_chat')?.size || 1;
      io?.to('room:community_chat').emit('communityOnlineCount', count);
    });

    socket.on('leaveCommunityChat', () => {
      const wasInRoom = socket.rooms.has('room:community_chat');
      socket.leave('room:community_chat');
      if (wasInRoom) {
        const count = io?.sockets.adapter.rooms.get('room:community_chat')?.size || 0;
        io?.to('room:community_chat').emit('communityOnlineCount', count);
      }
    });

    // Authenticated Public Community Chat Message with per-user rate limit & DB guard
    socket.on('sendCommunityChatMessage', async (msgData?: Record<string, any>) => {
      try {
        const authUid: string | undefined = socket.data?.userId;
        if (!authUid) {
          socket.emit('chatError', { message: 'Vui lòng đăng nhập để tham gia trò chuyện cộng đồng.' });
          return;
        }
        if (!msgData || typeof msgData.text !== 'string') return;
        if (!socket.rooms.has('room:community_chat')) {
          socket.join('room:community_chat');
          const count = io?.sockets.adapter.rooms.get('room:community_chat')?.size || 1;
          io?.to('room:community_chat').emit('communityOnlineCount', count);
        }
        if (!checkSocketRateLimit(socket, 'community_chat', 8, 10_000)) {
          socket.emit('chatError', { message: 'Bạn gửi tin nhắn quá nhanh. Vui lòng đợi vài giây.' });
          return;
        }

        const cleanText = sanitizeInput(msgData.text).slice(0, 1000);
        if (!cleanText.trim()) return;

        if (containsProfanity(cleanText)) {
          socket.emit('chatError', { message: 'Tin nhắn chứa từ ngữ vi phạm quy chuẩn cộng đồng.' });
          return;
        }

        if (mongoose.connection.readyState !== 1) {
          socket.emit('chatError', { message: 'Hệ thống trò chuyện tạm thời gián đoạn. Vui lòng thử lại.' });
          return;
        }

        const trustedSenderId = Types.ObjectId.isValid(authUid) ? new Types.ObjectId(authUid) : undefined;
        if (!trustedSenderId) {
          socket.emit('chatError', { message: 'Phiên đăng nhập không hợp lệ.' });
          return;
        }

        const dbUser = await UserModel.findById(trustedSenderId)
          .select('fullName avatarUrl role isBanned tokenVersion')
          .lean();
        const currentVersion = typeof dbUser?.tokenVersion === 'number' ? dbUser.tokenVersion : 0;
        const tokenVersion = typeof socket.data?.tokenVersion === 'number' ? socket.data.tokenVersion : 0;
        if (!dbUser || dbUser.isBanned || tokenVersion < currentVersion) {
          socket.emit('chatError', { message: 'Tài khoản không được phép gửi tin nhắn hoặc phiên đã hết hạn.' });
          socket.disconnect(true);
          return;
        }

        const trustedSenderName = dbUser.fullName || socket.data?.fullName || 'Trekker';
        const trustedSenderAvatar =
          dbUser.avatarUrl ||
          socket.data?.avatarUrl ||
          'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';
        const trustedSenderBadge =
          dbUser.role === 'admin' ? 'BQT LOST' : dbUser.role === 'moderator' ? 'Điều phối LOST' : 'Trekker';
        const trustedNameColor =
          dbUser.role === 'admin' || dbUser.role === 'moderator' ? 'var(--color-sky)' : 'var(--color-primary)';

        // Refresh cached name/avatar on socket
        socket.data.fullName = trustedSenderName;
        socket.data.avatarUrl = trustedSenderAvatar;

        const validQuote =
          msgData.quote &&
          typeof msgData.quote === 'object' &&
          typeof msgData.quote.author === 'string' &&
          typeof msgData.quote.text === 'string'
            ? {
                author: sanitizeInput(msgData.quote.author).slice(0, 100),
                text: sanitizeInput(msgData.quote.text).slice(0, 300),
              }
            : undefined;

        const VALID_CHAT_CHANNELS = new Set(['general', 'north', 'central', 'south', 'sos']);
        const channel =
          typeof msgData.channel === 'string' && VALID_CHAT_CHANNELS.has(msgData.channel.trim())
            ? msgData.channel.trim()
            : 'general';
        const rawLat = typeof msgData.gpsLat === 'number' ? msgData.gpsLat : Number(msgData.gpsLat);
        const rawLng = typeof msgData.gpsLng === 'number' ? msgData.gpsLng : Number(msgData.gpsLng);
        const rawAlt = typeof msgData.altitudeM === 'number' ? msgData.altitudeM : Number(msgData.altitudeM);
        const hasValidGps =
          msgData.gpsLat !== undefined &&
          msgData.gpsLng !== undefined &&
          Number.isFinite(rawLat) &&
          Number.isFinite(rawLng) &&
          rawLat >= -90 &&
          rawLat <= 90 &&
          rawLng >= -180 &&
          rawLng <= 180;
        const gpsLat = hasValidGps ? Number(rawLat.toFixed(6)) : undefined;
        const gpsLng = hasValidGps ? Number(rawLng.toFixed(6)) : undefined;
        const altitudeM =
          hasValidGps &&
          msgData.altitudeM !== undefined &&
          Number.isFinite(rawAlt) &&
          rawAlt >= -500 &&
          rawAlt <= 9000
            ? Math.round(rawAlt)
            : undefined;

        const savedDoc = await CommunityMessageModel.create({
          channel,
          senderId: trustedSenderId,
          senderName: trustedSenderName,
          senderAvatar: trustedSenderAvatar,
          senderBadge: trustedSenderBadge,
          nameColor: trustedNameColor,
          text: cleanText,
          gpsLat,
          gpsLng,
          altitudeM,
          quote: validQuote,
        });

        const newMsg = {
          id: savedDoc._id.toString(),
          channel: savedDoc.channel || 'general',
          clientTempId: typeof msgData.id === 'string' ? msgData.id.slice(0, 64) : undefined,
          senderId: trustedSenderId.toString(),
          senderName: savedDoc.senderName,
          senderAvatar: savedDoc.senderAvatar,
          senderBadge: savedDoc.senderBadge,
          nameColor: savedDoc.nameColor,
          text: savedDoc.text,
          gpsLat: savedDoc.gpsLat,
          gpsLng: savedDoc.gpsLng,
          altitudeM: savedDoc.altitudeM,
          quote: validQuote,
          createdAt: savedDoc.createdAt ? new Date(savedDoc.createdAt).toISOString() : new Date().toISOString(),
        };

        io?.to('room:community_chat').emit('newCommunityMessage', newMsg);
      } catch (err) {
        console.error('[Community Chat Socket Error]:', err);
        socket.emit('chatError', { message: 'Không thể gửi tin nhắn lúc này. Vui lòng thử lại.' });
      }
    });

    // Check community room membership BEFORE rooms are cleared on disconnect
    socket.on('disconnecting', () => {
      if (socket.rooms.has('room:community_chat')) {
        const currentSize = io?.sockets.adapter.rooms.get('room:community_chat')?.size || 1;
        io?.to('room:community_chat').emit('communityOnlineCount', Math.max(0, currentSize - 1));
      }
    });

    socket.on('disconnect', () => {
      const uid = socketToUser.get(socket.id);
      if (uid) {
        socketToUser.delete(socket.id);
        const set = userSockets.get(uid);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) {
            userSockets.delete(uid);
            io?.to('room:authenticated').emit('userStatus', { userId: uid, isOnline: false });
          }
        }
      }
    });
  });

  return io;
};

export const getIO = (): Server | null => io;

export const emitToUser = (userId: string, event: string, payload: any) => {
  if (io && userId) {
    io.to(`user:${String(userId)}`).emit(event, payload);
  }
};

export const emitToConversation = (conversationId: string, event: string, payload: any) => {
  if (io && conversationId) {
    io.to(`conv:${String(conversationId)}`).emit(event, payload);
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

/**
 * Evicts all live sockets belonging to a specific user from a room (e.g., when leaving/kicked from squad chat).
 */
export const evictUserFromRoom = (userId: string, roomName: string): void => {
  if (!io || !userId || !roomName) return;
  const socketIds = userSockets.get(String(userId));
  if (!socketIds) return;
  for (const sid of socketIds) {
    const sock = io.sockets.sockets.get(sid);
    if (sock && sock.rooms.has(roomName)) {
      sock.leave(roomName);
    }
  }
};

/**
 * Evicts all live sockets from a room (e.g., when a squad trip & group conversation are deleted).
 */
export const evictAllFromRoom = (roomName: string): void => {
  if (!io || !roomName) return;
  io.in(roomName).socketsLeave(roomName);
};
