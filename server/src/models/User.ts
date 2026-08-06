import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  avatarUrl: string;
  role: 'user' | 'guide' | 'admin';
  reputationScore: number;
  badges: string[];
  checkedInTrails: Schema.Types.ObjectId[];
  authProvider: 'local' | 'google';
  isEmailVerified: boolean;
  phone?: string;
  bio?: string;
  emergencyContact?: string;
  preferredStyle?: string;
  gearLocker?: string[];
  activationCode?: string;
  activationToken?: string;
  activationExpires?: Date;
  otpFailedAttempts?: number;
  followersCount?: number;
  followingCount?: number;
  tripReportsCount?: number;
  savedTrails?: Schema.Types.ObjectId[];
  resetOtpCode?: string;
  resetOtpExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    avatarUrl: { type: String, default: '' },
    role: { type: String, enum: ['user', 'guide', 'admin'], default: 'user' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local', index: true },
    isEmailVerified: { type: Boolean, default: false },
    phone: { type: String, default: '' },
    bio: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    preferredStyle: { type: String, default: 'Trekking & Camping' },
    gearLocker: [{ type: String }],
    activationCode: { type: String },
    activationToken: { type: String },
    activationExpires: { type: Date },
    otpFailedAttempts: { type: Number, default: 0 },
    reputationScore: { type: Number, default: 50, index: true },
    badges: { type: [String], default: ['Trekker Mới', 'Verified Trekker'] },
    checkedInTrails: [{ type: Schema.Types.ObjectId, ref: 'Trail' }],
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    tripReportsCount: { type: Number, default: 0 },
    savedTrails: [{ type: Schema.Types.ObjectId, ref: 'Trail' }],
    resetOtpCode: { type: String },
    resetOtpExpires: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, email: 1 });

export const UserModel = model<IUser>('User', userSchema);
