import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure official Cloudinary v2 SDK
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dsxbuk4pe',
  api_key: process.env.CLOUDINARY_API_KEY || '434322971269149',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'HyemSH59e0Qjk1bthG4WL2_o_mU',
  secure: true,
});

export { cloudinary };
