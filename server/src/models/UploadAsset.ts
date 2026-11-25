import { Schema, model, Document, Types } from 'mongoose';

export interface IUploadAsset extends Document {
  publicId: string;
  uploaderId: Types.ObjectId;
  category: string;
  secureUrl?: string;
  bytes?: number;
  format?: string;
  createdAt: Date;
  updatedAt: Date;
}

const uploadAssetSchema = new Schema<IUploadAsset>(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 220,
    },
    uploaderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
      default: 'trails',
    },
    secureUrl: {
      type: String,
      trim: true,
      maxlength: 1024,
      default: '',
    },
    bytes: {
      type: Number,
      min: 0,
      default: 0,
    },
    format: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },
  },
  { timestamps: true }
);

uploadAssetSchema.index({ uploaderId: 1, createdAt: -1 });
uploadAssetSchema.index({ category: 1, createdAt: -1 });

export const UploadAssetModel = model<IUploadAsset>('UploadAsset', uploadAssetSchema);
