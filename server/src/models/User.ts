import crypto from 'crypto';
import { Schema, model, Document, Types } from 'mongoose';

export interface IUserAnnualGoals {
  year: number;
  targetKm: number;
  targetElevationM: number;
  targetPeaks: number;
}

export interface IUser extends Document {
  username: string;
  usernameLower?: string;
  passportCode?: string;
  email: string;
  passwordHash: string;
  fullName: string;
  avatarUrl: string;
  role: 'user' | 'guide' | 'moderator' | 'admin';
  reputationScore: number;
  badges: string[];
  checkedInTrails: Types.ObjectId[];
  authProvider: 'local' | 'google';
  isEmailVerified: boolean;
  tokenVersion: number;
  phone?: string;
  bio?: string;
  emergencyContact?: string;
  preferredStyle?: string;
  coverUrl?: string;
  gearLocker?: string[];
  annualGoals?: IUserAnnualGoals;
  activationCode?: string;
  activationToken?: string;
  activationExpires?: Date;
  otpFailedAttempts?: number;
  otpLastSentAt?: Date;
  followersCount?: number;
  followingCount?: number;
  tripReportsCount?: number;
  savedTrails?: Types.ObjectId[];
  isBanned?: boolean;
  banReason?: string;
  resetOtpCode?: string;
  resetOtpExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    usernameLower: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passportCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      match: /^LS-[A-Z0-9]{6,10}$/,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    coverUrl: { type: String, default: '' },
    role: { type: String, enum: ['user', 'guide', 'moderator', 'admin'], default: 'user' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local', index: true },
    isEmailVerified: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    phone: { type: String, default: '' },
    bio: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    preferredStyle: { type: String, default: 'Trekking & Camping' },
    gearLocker: [{ type: String }],
    annualGoals: {
      type: new Schema<IUserAnnualGoals>(
        {
          year: { type: Number, min: 2024, max: 2035 },
          targetKm: { type: Number, min: 10, max: 5000 },
          targetElevationM: { type: Number, min: 500, max: 200000 },
          targetPeaks: { type: Number, min: 1, max: 200 },
        },
        { _id: false }
      ),
      default: undefined,
    },
    activationCode: { type: String, select: false },
    activationToken: { type: String, select: false },
    activationExpires: { type: Date },
    otpFailedAttempts: { type: Number, default: 0 },
    otpLastSentAt: { type: Date },
    reputationScore: { type: Number, default: 50, index: true },
    badges: { type: [String], default: ['Trekker Mới'] },
    checkedInTrails: [{ type: Schema.Types.ObjectId, ref: 'Trail' }],
    followersCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    tripReportsCount: { type: Number, default: 0, min: 0 },
    savedTrails: [{ type: Schema.Types.ObjectId, ref: 'Trail' }],
    isBanned: { type: Boolean, default: false, index: true },
    banReason: { type: String, default: '' },
    resetOtpCode: { type: String, select: false },
    resetOtpExpires: { type: Date },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('validate', function () {
  if (typeof this.username === 'string' && this.username.trim()) {
    this.usernameLower = this.username.trim().toLowerCase();
  }
  if (!this.passportCode) {
    this.passportCode = `LS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
});

userSchema.index({ role: 1, email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ resetPasswordToken: 1 }, { sparse: true });
userSchema.index({ activationToken: 1 }, { sparse: true });

export const UserModel = model<IUser>('User', userSchema);
