import mongoose from 'mongoose';

let listenersRegistered = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let reconnectStopped = false;

const INITIAL_RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;

export const connectDB = async (mongoUri?: string): Promise<boolean> => {
  const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lost';

  if (!listenersRegistered) {
    listenersRegistered = true;
    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB Error]:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB Disconnected]: Connection lost.');
    });
    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB Reconnected]: Connection restored.');
    });
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      family: 4,
    });
    reconnectAttempts = 0;
    console.log(`[MongoDB Connected]: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn(
      `[MongoDB Notice]: Unable to connect to live MongoDB instance. Server will fallback to in-memory data store. Error: ${(error as Error).message}`
    );
    return false;
  }
};

/**
 * Bounded exponential-backoff retry loop for recovering from an initial MongoDB startup outage
 * (Mongoose does not auto-reconnect when the initial connect() fails).
 */
export const scheduleDbReconnect = (onConnected?: () => Promise<void> | void, mongoUri?: string): void => {
  if (reconnectStopped || reconnectTimer || mongoose.connection.readyState === 1) return;

  const delayMs = Math.min(
    MAX_RECONNECT_DELAY_MS,
    INITIAL_RECONNECT_DELAY_MS * Math.pow(2, Math.min(reconnectAttempts, 4))
  );
  reconnectAttempts++;

  console.warn(`[MongoDB Retry]: Scheduling reconnect attempt #${reconnectAttempts} in ${Math.round(delayMs / 1000)}s...`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (reconnectStopped || mongoose.connection.readyState === 1) return;
    const ok = await connectDB(mongoUri);
    if (ok) {
      try {
        await onConnected?.();
      } catch (err) {
        console.warn('[MongoDB Retry Post-Connect Hook Error]:', (err as Error).message);
      }
    } else if (!reconnectStopped) {
      scheduleDbReconnect(onConnected, mongoUri);
    }
  }, delayMs);
  reconnectTimer.unref();
};

export const cancelDbReconnect = (): void => {
  reconnectStopped = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

export const pingDB = async (timeoutMs = 2500): Promise<{ ok: boolean; latencyMs: number | null }> => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return { ok: false, latencyMs: null };
  }
  const start = Date.now();
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MongoDB ping timeout')), timeoutMs).unref()
      ),
    ]);
    return { ok: true, latencyMs: Math.max(0, Date.now() - start) };
  } catch {
    return { ok: false, latencyMs: null };
  }
};

export const disconnectDB = async (): Promise<void> => {
  cancelDbReconnect();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};
