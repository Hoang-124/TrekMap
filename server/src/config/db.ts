import mongoose from 'mongoose';

export const connectDB = async (mongoUri?: string): Promise<void> => {
  const uri = mongoUri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekmap';

  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log(`[MongoDB Connected]: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[MongoDB Notice]: Unable to connect to live MongoDB instance. Server will fallback to high-speed in-memory data store. Error: ${(error as Error).message}`);
  }
};
