import mongoose from 'mongoose';

let listenersRegistered = false;

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
    console.log(`[MongoDB Connected]: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn(
      `[MongoDB Notice]: Unable to connect to live MongoDB instance. Server will fallback to in-memory data store. Error: ${(error as Error).message}`
    );
    return false;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};
