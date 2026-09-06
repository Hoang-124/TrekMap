import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { UserProfile, Trail, ForumThread } from '../../types.js';
import { fetchTrails } from '../../services/api.js';
import { ThreadDetailModal } from '../forum/ThreadDetailModal.js';
import { AuthorProfileModal } from '../forum/AuthorProfileModal.js';
import { getApiHeaders } from '../../utils/sessionHeaders.js';

const createSvgIcon = (d: string | React.ReactNode, defaultSize = 18) => {
  return ({ size = defaultSize, color = 'currentColor', style, className }: { size?: number; color?: string; style?: React.CSSProperties; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  );
};

const ArrowLeft = createSvgIcon('M19 12H5M12 19l-7-7 7-7');
const Award = createSvgIcon(<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>);
const MapPin = createSvgIcon(<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>);
const User = createSvgIcon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
const Mail = createSvgIcon(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>);
const Phone = createSvgIcon('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z');
const Edit3 = createSvgIcon('M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z');
const Save = createSvgIcon(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>);
const CheckCircle2 = createSvgIcon(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>);
const Lock = createSvgIcon(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>);
const Upload = createSvgIcon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>);
const AlertTriangle = createSvgIcon(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
const QrCode = createSvgIcon(<><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>);
const Compass = createSvgIcon(<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>);
const ShieldCheck = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>);
const Mountain = createSvgIcon(<><path d="M8 3l4 8 5-5 5 15H2L8 3z" /></>);
const Tent = createSvgIcon(<><path d="M19 21L12 3 5 21" /><path d="M12 13l3 8H9l3-8z" /></>);
const ShieldAlert = createSvgIcon(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>);
const Package = createSvgIcon(<><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>);
const MessageSquare = createSvgIcon('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
const ThumbsUp = createSvgIcon('M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3');
const X = createSvgIcon('M18 6L6 18M6 6l12 12');
const Check = createSvgIcon('M20 6L9 17l-5-5');
const Camera = createSvgIcon(<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>);
const Maximize2 = createSvgIcon(<><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>);
const ExternalLink = createSvgIcon(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>);

interface CoverPreset {
  id: string;
  name: string;
  location: string;
  url: string;
}

const DEFAULT_COVER_URL = 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329097/trekmap/trails/trail_cover_trail-fansipan.jpg';

const COVER_PRESETS: CoverPreset[] = [
  {
    id: 'fansipan',
    name: 'Đỉnh Fansipan - Nóc Nhà Đông Dương',
    location: '3,143m • Hoàng Liên Sơn, Lào Cai',
    url: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329097/trekmap/trails/trail_cover_trail-fansipan.jpg',
  },
  {
    id: 'taxua',
    name: 'Sống Lưng Khủng Long Tà Xùa',
    location: '2,865m • Bắc Yên, Sơn La',
    url: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329099/trekmap/trails/trail_cover_trail-taxua.jpg',
  },
  {
    id: 'laothan',
    name: 'Đỉnh Lảo Thẩn - Thiên Đường Săn Mây',
    location: '2,860m • Y Tý, Bát Xát, Lào Cai',
    url: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329100/trekmap/trails/trail_cover_trail-laothan.jpg',
  },
  {
    id: 'kyquansan',
    name: 'Bạch Mộc Lương Tử (Kỳ Quan San)',
    location: '3,046m • Bát Xát & Phong Thổ',
    url: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329101/trekmap/trails/trail_cover_trail-kyquansan.jpg',
  },
  {
    id: 'bachma',
    name: 'Vườn Quốc Gia Bạch Mã',
    location: '1,450m • Phú Lộc, Thừa Thiên Huế',
    url: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329104/trekmap/trails/trail_cover_trail-bachma.jpg',
  },
  {
    id: 'tanangphandung',
    name: 'Cung Trek Tà Năng - Phan Dũng',
    location: '55km • Lâm Đồng - Bình Thuận',
    url: 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329106/trekmap/trails/trail_cover_trail-tanangphandung.jpg',
  },
];

interface ProfileProps {
  currentUser?: UserProfile | null;
  onBack: () => void;
  onSelectTrail: (trail: Trail) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onProfileUpdate?: (user: UserProfile) => void;
  onNavigateToContribute?: () => void;
}

// Gear locker item definition
interface GearItem {
  id: string;
  name: string;
  category: string;
}

const ALL_GEAR_ITEMS: GearItem[] = [
  { id: 'tent', name: 'Lều cắm trại 2-4 người chống nước', category: 'Trú ẩn' },
  { id: 'backpack', name: 'Balo leo núi chuyên dụng 50L', category: 'Chứa đồ' },
  { id: 'boots', name: 'Giày leo núi gót bám địa hình', category: 'Di chuyển' },
  { id: 'flashlight', name: 'Đèn pin đeo đầu siêu sáng 1000lm', category: 'Chiếu sáng' },
  { id: 'firstaid', name: 'Túi y tế & Bộ sơ cứu khẩn cấp SOS', category: 'Y tế & An toàn' },
  { id: 'stove', name: 'Bộ bếp dã ngoại & Bình gas sinh tồn', category: 'Nấu nướng' },
  { id: 'radio', name: 'Bộ đàm sinh tồn & Còi cứu hộ SOS', category: 'Mạng liên lạc' },
  { id: 'rope', name: 'Dây thừng dã ngoại & Móc leo núi', category: 'Bảo hộ' },
];

// Interactive Trekking Style Options
const TREKKING_STYLE_OPTIONS = [
  { id: 'Trekking & Camping', title: 'Trekking & Camping', sub: 'Leo núi & Cắm trại dã ngoại' },
  { id: 'Alpine Ultra Trail', title: 'Alpine Ultra Trail', sub: 'Chạy trail địa hình cao' },
  { id: 'Expedition Survival', title: 'Expedition Survival', sub: 'Sinh tồn mạo hiểm' },
  { id: 'Lightweight Hiking', title: 'Lightweight Hiking', sub: 'Leo núi nhẹ nhàng' },
];

// Comprehensive System Badges Definition with Vibrant Unique Color Themes
interface SystemBadge {
  id: string;
  name: string;
  rarity: 'Phổ Biến' | 'Hiếm' | 'Huyền Thoại';
  unlocked: boolean;
  unlockedAt?: string;
  description: string;
  requirement: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
}

const SYSTEM_BADGES: SystemBadge[] = [
  {
    id: 'b-1',
    name: 'Trekker Mới',
    rarity: 'Phổ Biến',
    unlocked: true,
    unlockedAt: '12/10/2025',
    description: 'Huy hiệu ghi nhận thành viên vừa khởi tạo tài khoản trên TrekMap thành công.',
    requirement: 'Đăng ký tài khoản hệ thống TrekMap.',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.6)',
    glow: '0 0 16px rgba(16, 185, 129, 0.35)',
  },
  {
    id: 'b-2',
    name: 'Verified Trekker',
    rarity: 'Hiếm',
    unlocked: true,
    unlockedAt: '12/10/2025',
    description: 'Huy hiệu xác thực chính chủ dành cho tài khoản đã xác minh Email OTP hoặc Đăng nhập bằng Google.',
    requirement: 'Kích hoạt xác minh OTP Email hoặc Google OAuth thành công.',
    color: '#00ffd5',
    bg: 'rgba(0, 255, 213, 0.14)',
    border: 'rgba(0, 255, 213, 0.7)',
    glow: '0 0 20px rgba(0, 255, 213, 0.4)',
  },
  {
    id: 'b-3',
    name: 'Fansipan Peak Conqueror',
    rarity: 'Huyền Thoại',
    unlocked: true,
    unlockedAt: '18/01/2026',
    description: 'Vượt qua tuyến đường Trạm Tôn chinh phục Nóc nhà Đông Dương ở độ cao 3,143m.',
    requirement: 'Check-in thành công tại đỉnh Fansipan (Lào Cai).',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.15)',
    border: 'rgba(251, 191, 36, 0.8)',
    glow: '0 0 22px rgba(251, 191, 36, 0.45)',
  },
  {
    id: 'b-4',
    name: 'Alpine Master',
    rarity: 'Hiếm',
    unlocked: true,
    unlockedAt: '05/03/2026',
    description: 'Đạt cấp độ sinh tồn cao cấp nhờ tích lũy hơn 50 điểm uy tín và hoàn thành nhiều cung đường trek khó.',
    requirement: 'Đạt từ 50 điểm uy tín (Reputation Score) trở lên.',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.7)',
    glow: '0 0 18px rgba(56, 189, 248, 0.38)',
  },
  {
    id: 'b-5',
    name: 'Emergency Rescue Hero',
    rarity: 'Huyền Thoại',
    unlocked: false,
    description: 'Vinh danh nhà thám hiểm có những đóng góp cảnh báo sự cố sạt lở hoặc hỗ trợ SOS cho cộng đồng.',
    requirement: 'Gửi từ 3 bài cảnh báo sự cố an toàn trên Diễn đàn được cộng đồng xác minh.',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.06)',
    border: 'rgba(239, 68, 68, 0.3)',
    glow: '0 0 15px rgba(239, 68, 68, 0.25)',
  },
  {
    id: 'b-6',
    name: 'Ultra Trail Pioneer',
    rarity: 'Huyền Thoại',
    unlocked: false,
    description: 'Dành riêng cho những nhà thám hiểm bền bỉ chinh phục tổng quãng đường leo núi trên 100 km.',
    requirement: 'Hoàn thành tổng quãng đường trek tích lũy vượt mốc 100 km.',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.06)',
    border: 'rgba(168, 85, 247, 0.3)',
    glow: '0 0 15px rgba(168, 85, 247, 0.25)',
  },
];

// Color Theme Palettes for Conquered Trail Cards
const TRAIL_CARD_THEMES = [
  { color: '#fbbf24', border: 'rgba(251, 191, 36, 0.45)', bg: 'rgba(251, 191, 36, 0.06)', glow: '0 0 20px rgba(251, 191, 36, 0.25)', tag: 'Huyền Thoại 3,143m' },
  { color: '#38bdf8', border: 'rgba(56, 189, 248, 0.45)', bg: 'rgba(56, 189, 248, 0.06)', glow: '0 0 20px rgba(56, 189, 248, 0.25)', tag: 'Săn Mây Đỉnh Cao' },
  { color: '#10b981', border: 'rgba(16, 185, 129, 0.45)', bg: 'rgba(16, 185, 129, 0.06)', glow: '0 0 20px rgba(16, 185, 129, 0.25)', tag: 'Rừng Nguyên Sinh' },
  { color: '#00ffd5', border: 'rgba(0, 255, 213, 0.45)', bg: 'rgba(0, 255, 213, 0.06)', glow: '0 0 20px rgba(0, 255, 213, 0.25)', tag: 'Tuyệt Cảnh Dã Ngoại' },
];



export const UserProfileView: React.FC<ProfileProps> = ({ currentUser, onBack, onSelectTrail, onShowToast, onProfileUpdate, onNavigateToContribute }) => {
  const [profile, setProfile] = useState<UserProfile | null>(currentUser || null);
  const [checkedTrails, setCheckedTrails] = useState<Trail[]>([]);
  const [allAvailableTrails, setAllAvailableTrails] = useState<Trail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'contributions' | 'forum' | 'gear'>('overview');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showGearModal, setShowGearModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<SystemBadge | null>(null);
  const [selectedTrailPassport, setSelectedTrailPassport] = useState<Trail | null>(null);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Cover Photo Customization
  const [customCoverUrl, setCustomCoverUrl] = useState<string>(() => {
    return localStorage.getItem('trekmap_cover_url') || (currentUser as any)?.coverUrl || DEFAULT_COVER_URL;
  });
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [previewCover, setPreviewCover] = useState<string>(customCoverUrl);
  const [customCoverInput, setCustomCoverInput] = useState<string>('');
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox Full Photo View State
  const [fullViewImage, setFullViewImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
    type: 'cover' | 'avatar';
  } | null>(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullViewImage) setFullViewImage(null);
        else if (showCoverModal) setShowCoverModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullViewImage, showCoverModal]);

  useEffect(() => {
    if (currentUser?.coverUrl) {
      setCustomCoverUrl(currentUser.coverUrl);
      setPreviewCover(currentUser.coverUrl);
      try {
        localStorage.setItem('trekmap_cover_url', currentUser.coverUrl);
      } catch (e) {}
    }
  }, [currentUser?.coverUrl]);

  // Gear Locker State (Feature 2)
  const [userGear, setUserGear] = useState<string[]>(['tent', 'backpack', 'boots', 'flashlight', 'firstaid']);

  // User Live Forum Posts State (Feature 3)
  const [userForumPosts, setUserForumPosts] = useState<ForumThread[]>([]);
  const [selectedThreadForModal, setSelectedThreadForModal] = useState<ForumThread | null>(null);
  const [selectedAuthorForModal, setSelectedAuthorForModal] = useState<{ name: string; avatar: string } | null>(null);

  // User Submitted Trail Contributions State
  const [userContributions, setUserContributions] = useState<any[]>(() => {
    return JSON.parse(localStorage.getItem('trekmap_contributions') || '[]');
  });
  const [deletingContribution, setDeletingContribution] = useState<{ id: string; name: string } | null>(null);

  const handleDeleteContribution = (id: string, name: string) => {
    setDeletingContribution({ id, name });
  };

  const confirmDeleteContribution = async () => {
    if (!deletingContribution) return;
    const targetId = deletingContribution.id;
    const targetName = deletingContribution.name;
    const token = localStorage.getItem('trekmap_token');

    // 1. Delete from Server DB if token exists
    try {
      if (token) {
        await fetch(`/api/contributions/${targetId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.warn('Delete contribution API error:', err);
    }

    // 2. Delete from localStorage
    const allContribs: any[] = JSON.parse(localStorage.getItem('trekmap_contributions') || '[]');
    const updatedGlobal = allContribs.filter((item) => (item.id !== targetId && item._id !== targetId));
    localStorage.setItem('trekmap_contributions', JSON.stringify(updatedGlobal));
    
    setUserContributions((prev) => prev.filter((item) => (item.id !== targetId && item._id !== targetId)));
    setDeletingContribution(null);
    if (onShowToast) {
      onShowToast(`Đã xóa bài đóng góp "${targetName}" thành công!`, 'info');
    }
  };

  const handleEditContribution = (contrib: any) => {
    localStorage.setItem('trekmap_editing_contribution', JSON.stringify(contrib));
    if (onNavigateToContribute) {
      onNavigateToContribute();
    }
  };

  // Edit Profile Modal state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editEmergency, setEditEmergency] = useState('');
  const [editStyle, setEditStyle] = useState('Trekking & Camping');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  // Field-specific Inline Error State
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    phone?: string;
    emergencyContact?: string;
    bio?: string;
    avatarUrl?: string;
    general?: string;
  }>({});

  const loadProfileData = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('trekmap_token');

    try {
      if (token) {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success && data.user) {
          setProfile(data.user);
          populateForm(data.user);
          if (data.user.coverUrl) {
            setCustomCoverUrl(data.user.coverUrl);
            setPreviewCover(data.user.coverUrl);
            try {
              localStorage.setItem('trekmap_cover_url', data.user.coverUrl);
            } catch (e) {}
          }
          if (data.user.gearLocker && Array.isArray(data.user.gearLocker)) {
            setUserGear(data.user.gearLocker);
          }

          // Fetch live contributions from Server API and merge with localStorage
          let serverContribs: any[] = [];
          try {
            const cRes = await fetch('/api/contributions', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const cData = await cRes.json();
            if (cData.success && Array.isArray(cData.data)) {
              serverContribs = cData.data;
            }
          } catch (cErr) {
            console.warn('[Profile Contrib API Fetch]:', cErr);
          }

          const localContribs: any[] = JSON.parse(localStorage.getItem('trekmap_contributions') || '[]');
          const contribMap = new Map<string, any>();
          serverContribs.forEach((c) => {
            const key = c.id || c._id;
            if (key) contribMap.set(String(key), c);
          });
          localContribs.forEach((c) => {
            const key = c.id || c._id;
            if (key && !contribMap.has(String(key))) {
              contribMap.set(String(key), c);
            }
          });
          const allContribs = Array.from(contribMap.values());

          const userEmail = (data.user.email || '').toLowerCase().trim();
          const userId = String(data.user._id || data.user.id || '').trim();
          const userName = (data.user.fullName || data.user.username || data.user.name || '').toLowerCase().trim();

          const filtered = allContribs.filter((c: any) => {
            const cEmail = (c.authorEmail || '').toLowerCase().trim();
            const cUserId = String(c.userId || c.createdBy || '').trim();
            const cName = (c.authorName || '').toLowerCase().trim();

            const emailMatch = Boolean(userEmail && cEmail && cEmail === userEmail);
            const idMatch = Boolean(userId && cUserId && cUserId === userId);
            const nameMatch = Boolean(userName && cName && cName === userName);
            const noMeta = !cEmail && !cUserId && (!cName || cName === 'người dùng trekmap');

            return emailMatch || idMatch || nameMatch || noMeta;
          });
          setUserContributions(filtered);
        }
      }
    } catch (err) {
      console.error('[Profile Fetch Error]:', err);
    } finally {
      setIsLoading(false);
    }

    try {
      const allTrails = await fetchTrails();
      setAllAvailableTrails(allTrails);
      setCheckedTrails(allTrails.slice(0, 3));
    } catch (err) {
      console.error('[Trails Fetch Error]:', err);
    }

    try {
      const forumRes = await fetch('/api/forum', {
        headers: getApiHeaders(),
      });
      const forumData = await forumRes.json();
      if (forumData.success && Array.isArray(forumData.data)) {
        setUserForumPosts(forumData.data);
      }
    } catch (err) {
      console.error('[Forum Posts Fetch Error]:', err);
    }
  };

  useEffect(() => {
    const handleGlobalUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.threadId) {
        setUserForumPosts((prevPosts) =>
          prevPosts.map((t) => {
            if (t.id === detail.threadId) {
              return {
                ...t,
                userReaction: detail.userReaction !== undefined ? detail.userReaction : (t as any).userReaction,
                reactions: detail.reactionsSummary || t.reactions,
                upvotes: detail.upvotes !== undefined ? detail.upvotes : t.upvotes,
              };
            }
            return t;
          })
        );
      }
    };
    window.addEventListener('trekmap:forum-updated', handleGlobalUpdate);
    return () => window.removeEventListener('trekmap:forum-updated', handleGlobalUpdate);
  }, []);

  const populateForm = (u: UserProfile) => {
    setEditFullName(u.fullName || u.name || '');
    setEditUsername(u.username || '');
    setEditPhone(u.phone || '');
    setEditBio(u.bio || '');
    setEditEmergency(u.emergencyContact || '');
    setEditStyle(u.preferredStyle || 'Trekking & Camping');
    setEditAvatarUrl(u.avatarUrl || u.avatar || '');
    setFieldErrors({});
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  const handleToggleGear = async (gearId: string) => {
    const nextGear = userGear.includes(gearId)
      ? userGear.filter((g) => g !== gearId)
      : [...userGear, gearId];

    setUserGear(nextGear);
    const token = localStorage.getItem('trekmap_token');

    try {
      if (token) {
        await fetch('/api/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ gearLocker: nextGear }),
        });
      }
      if (onShowToast) {
        onShowToast('Đã cập nhật tủ đồ thiết bị sinh tồn!', 'success');
      }
    } catch (err) {
      console.error('[Gear Save Error]:', err);
    }
  };

  const handleAddCheckInTrail = (trail: Trail) => {
    if (!checkedTrails.some((t) => t.id === trail.id)) {
      setCheckedTrails([trail, ...checkedTrails]);
      if (onShowToast) {
        onShowToast(`Đã thêm check-in thành công cung đường ${trail.name}!`, 'success');
      }
    }
    setShowCheckInModal(false);
  };

  const handleCoverFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      if (onShowToast) onShowToast('Kích thước ảnh bìa không được vượt quá 8MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result;
        setPreviewCover(base64);
        setCustomCoverInput('');
        if (onShowToast) onShowToast('Đã nạp ảnh từ máy tính vào bản xem trước! Nhấn "Lưu & Áp Dụng Ảnh Bìa" để hoàn tất.', 'info');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyCover = async (coverUrlToApply?: string) => {
    const finalUrl = (coverUrlToApply || previewCover || customCoverInput).trim();
    if (!finalUrl) {
      if (onShowToast) onShowToast('Vui lòng chọn hoặc dán đường dẫn ảnh bìa hợp lệ.', 'error');
      return;
    }

    setCustomCoverUrl(finalUrl);
    setPreviewCover(finalUrl);
    try {
      localStorage.setItem('trekmap_cover_url', finalUrl);
    } catch (e) {
      console.warn('[Cover LocalStorage Warning]:', e);
    }
    setShowCoverModal(false);
    if (onShowToast) onShowToast('Đã lưu và cập nhật ảnh bìa mới thành công!', 'success');

    const token = localStorage.getItem('trekmap_token');
    if (token) {
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ coverUrl: finalUrl }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          const persistedCover = data.user.coverUrl || finalUrl;
          setCustomCoverUrl(persistedCover);
          setPreviewCover(persistedCover);
          try {
            localStorage.setItem('trekmap_cover_url', persistedCover);
          } catch (e) {}
          setProfile(data.user);
          if (onProfileUpdate) onProfileUpdate({ ...data.user, coverUrl: persistedCover });
        }
      } catch (err) {
        console.error('[Cover Upload Error]:', err);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, avatarUrl: 'Kích thước tệp ảnh không được vượt quá 5MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result;
        setEditAvatarUrl(base64);
        setFieldErrors((prev) => ({ ...prev, avatarUrl: '' }));
        if (onShowToast) {
          onShowToast('Đang tải và lưu ảnh đại diện mới lên Cloudinary...', 'info');
        }

        // Send to backend profile update handler which performs Cloudinary upload ONCE
        const token = localStorage.getItem('trekmap_token');
        if (token) {
          try {
            const res = await fetch('/api/auth/profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ avatarUrl: base64 }),
            });
            const data = await res.json();
            if (data.success && data.user?.avatarUrl) {
              setEditAvatarUrl(data.user.avatarUrl);
              setProfile(data.user);
              if (onProfileUpdate) onProfileUpdate(data.user);
              if (onShowToast) {
                onShowToast('Đã lưu ảnh đại diện lên Cloudinary CDN thành công!', 'success');
              }
            }
          } catch (err) {
            console.error('[Avatar Update Error]:', err);
          }
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof fieldErrors = {};

    // 1. Full Name Inline Validation
    if (!editFullName.trim() || editFullName.trim().length < 2) {
      newErrors.fullName = 'Họ và tên phải có ít nhất 2 ký tự.';
    }

    // 2. Phone Number Inline Validation (Vietnamese Format)
    if (editPhone.trim()) {
      const cleanPhone = editPhone.trim().replace(/[\s.-]/g, '');
      const phoneRegex = /^(0|\+84)[35789][0-9]{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        newErrors.phone = 'Số điện thoại liên lạc không đúng định dạng Việt Nam (Ví dụ hợp lệ: 0912345678).';
      }
    }

    // 3. Emergency Contact Validation
    if (editEmergency.trim() && editEmergency.trim().length > 100) {
      newErrors.emergencyContact = 'Thông tin liên hệ khẩn cấp không được vượt quá 100 ký tự.';
    }

    // 4. Bio Validation
    if (editBio.trim() && editBio.trim().length > 500) {
      newErrors.bio = 'Tiểu sử cá nhân không được vượt quá 500 ký tự.';
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    setFieldErrors({});
    setIsSaving(true);
    const token = localStorage.getItem('trekmap_token');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: editFullName,
          username: editUsername,
          phone: editPhone,
          bio: editBio,
          emergencyContact: editEmergency,
          preferredStyle: editStyle,
          avatarUrl: editAvatarUrl,
          gearLocker: userGear,
        }),
      });

      const data = await res.json();
      setIsSaving(false);

      if (!res.ok || !data.success) {
        setFieldErrors({ general: data.message || 'Không thể cập nhật hồ sơ cá nhân.' });
        return;
      }

      setProfile(data.user);
      if (onProfileUpdate) onProfileUpdate(data.user);
      setIsEditing(false);
      if (onShowToast) {
        onShowToast(data.message || 'Cập nhật hồ sơ thành công!', 'success');
      }
    } catch (err) {
      setIsSaving(false);
      setFieldErrors({ general: 'Lỗi máy chủ khi cập nhật hồ sơ cá nhân.' });
    }
  };

  const activeProfile: UserProfile = profile || currentUser || {
    id: 'user-8848',
    username: 'Trekker',
    email: 'user@trekmap.vn',
    fullName: 'Nhà Thám Hiểm',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Trekker',
    role: 'user',
    reputationScore: 100,
    badges: ['Trekker Mới', 'Verified Trekker'],
    checkedInTrails: [],
    contributedTrails: [],
    phone: 'Chưa cập nhật',
    bio: 'Đam mê leo núi và khám phá bản đồ địa hình 3D.',
    emergencyContact: 'Chưa cập nhật',
    preferredStyle: 'Trekking & Camping',
    authProvider: 'local',
    isEmailVerified: true,
  };

  // Dynamic Expedition ID computed from user ID
  const expeditionId = `TRK-${(activeProfile.id || '8848').slice(-6).toUpperCase()}`;

  // Is User Verified (via OTP or Google Login)
  const isVerifiedUser = activeProfile.isEmailVerified !== false || activeProfile.authProvider === 'google';

  // Filter equipped gear items
  const equippedGearItems = ALL_GEAR_ITEMS.filter((g) => userGear.includes(g.id));

  // Computed Badges
  const computedBadges = React.useMemo(() => {
    return SYSTEM_BADGES.map((b) => {
      const isUnlocked = Boolean(
        activeProfile.badges?.some(
          (ub: string) => ub.toLowerCase().includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(ub.toLowerCase())
        ) || b.id === 'b-1'
      );
      return { ...b, unlocked: isUnlocked };
    });
  }, [activeProfile.badges]);
  const unlockedBadgesCount = computedBadges.filter((b) => b.unlocked).length;

  // Filter user's own forum posts
  const userOwnPosts = React.useMemo(() => {
    return userForumPosts.filter((post) => {
      const p = post as any;
      if (p.userId && activeProfile.id && String(p.userId) === String(activeProfile.id)) {
        return true;
      }
      if (!p.authorName) return false;
      const authorClean = p.authorName.toLowerCase();
      const nameClean = (activeProfile.fullName || activeProfile.name || '').toLowerCase();
      const userClean = (activeProfile.username || '').toLowerCase();

      return (
        (nameClean && authorClean.includes(nameClean)) ||
        (userClean && authorClean.includes(userClean)) ||
        (nameClean && nameClean.includes(authorClean)) ||
        (userClean && userClean.includes(authorClean))
      );
    });
  }, [userForumPosts, activeProfile]);

  if (isLoading && !profile && !currentUser) {
    return <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-dim)' }}>Đang tải thông tin hồ sơ...</div>;
  }

  return (
    <div style={{ maxWidth: 1040, margin: '20px auto', padding: '0 20px 60px 20px' }}>
      {/* Hidden File Input for Direct Cloudinary Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <button className="btn btn-outline" onClick={onBack} style={{ fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeft size={16} /> Quay lại trang chủ
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {onNavigateToContribute && (
            <button
              className="btn btn-outline"
              onClick={onNavigateToContribute}
              style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Compass size={15} color="var(--color-primary)" /> Đóng Góp Cung Mới
            </button>
          )}

          <button
            className="btn btn-outline"
            onClick={() => setShowQrModal(true)}
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <QrCode size={15} color="var(--color-primary)" /> Mã QR Pass
          </button>

          <button
            className="btn btn-primary"
            onClick={() => {
              setIsEditing(true);
              populateForm(activeProfile);
            }}
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Edit3 size={15} /> Chỉnh sửa hồ sơ
          </button>
        </div>
      </div>

      {/* Hidden File Input for Cover Photo Upload */}
      <input
        type="file"
        ref={coverFileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCoverFileUpload}
      />

      {/* 1. Unified Hero Profile Cockpit */}
      <div
        className="card"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 0,
          marginBottom: 20,
          borderRadius: 22,
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Scenic Mountain Panorama Cover Banner */}
        <div
          onClick={() => {
            setFullViewImage({
              url: customCoverUrl,
              title: 'Ảnh Bìa Cá Nhân',
              subtitle: `${activeProfile.fullName} (@${activeProfile.username || 'trekker'})`,
              type: 'cover',
            });
          }}
          title="Nhấn vào ảnh để xem trọn vẹn kích thước đầy đủ"
          style={{
            height: 155,
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--color-bg-card)',
            cursor: 'pointer',
          }}
        >
          <img
            key={customCoverUrl}
            src={customCoverUrl}
            alt="Profile Cover Banner"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              transition: 'transform 0.25s ease',
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER_URL;
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0.35) 60%, var(--color-bg-card) 100%)',
              pointerEvents: 'none',
            }}
          />

          {/* View Full Hint Badge on Cover */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 14,
              zIndex: 3,
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              padding: '5px 11px',
              borderRadius: 10,
              fontSize: '0.74rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
              pointerEvents: 'none',
            }}
          >
            <Maximize2 size={13} color="var(--color-primary)" /> Nhấn để xem trọn vẹn
          </div>

          {/* Change Cover Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewCover(customCoverUrl);
              setCustomCoverInput('');
              setShowCoverModal(true);
            }}
            title="Đổi ảnh bìa trang cá nhân"
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              zIndex: 3,
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              padding: '6px 13px',
              borderRadius: 10,
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.85)';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(15, 23, 42, 0.72)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
            }}
          >
            <Camera size={14} /> Đổi Ảnh Bìa
          </button>
        </div>

        {/* Identity Information Body */}
        <div
          style={{
            padding: '0 24px 22px 24px',
            marginTop: -46,
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
            {/* Avatar with Status Ring & Upload Trigger */}
            <div
              onClick={() => {
                const currentAvatar = activeProfile.avatarUrl || activeProfile.avatar || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg';
                setFullViewImage({
                  url: currentAvatar,
                  title: 'Ảnh Đại Diện',
                  subtitle: `${activeProfile.fullName} (@${activeProfile.username || 'trekker'})`,
                  type: 'avatar',
                });
              }}
              title="Nhấn để xem ảnh đại diện trọn vẹn"
              style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
            >
              <img
                src={activeProfile.avatarUrl || activeProfile.avatar || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg'}
                alt={activeProfile.fullName}
                style={{
                  width: 98,
                  height: 98,
                  borderRadius: 22,
                  objectFit: 'cover',
                  border: '3px solid var(--color-primary)',
                  boxShadow: '0 0 20px rgba(74, 222, 128, 0.35)',
                  background: 'var(--color-bg-main)',
                  display: 'block',
                }}
              />
              {/* Subtle hover zoom overlay on avatar */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 22,
                  background: 'rgba(0, 0, 0, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s ease',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <Maximize2 size={20} color="#ffffff" />
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                title="Tải ảnh đại diện mới"
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  zIndex: 2,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--color-bg-card)',
                  border: '1.5px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }}
              >
                <Upload size={13} />
              </button>
            </div>

            {/* Profile Details */}
            <div style={{ flex: 1, minWidth: 240, paddingTop: 46 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--color-text-main)', margin: 0 }}>
                  {activeProfile.fullName}
                </h1>
                <span style={{ fontSize: '0.84rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                  @{activeProfile.username || 'trekker'}
                </span>
                <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.72rem', fontWeight: 800 }}>
                  {activeProfile.role}
                </span>
                {isVerifiedUser ? (
                  <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', padding: '3px 9px' }}>
                    <ShieldCheck size={13} color="var(--color-primary)" /> VERIFIED TREKKER
                  </span>
                ) : (
                  <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', padding: '3px 9px' }}>
                    <ShieldAlert size={13} color="var(--color-earth)" /> CHƯA XÁC THỰC EMAIL
                  </span>
                )}
              </div>

              {/* Expedition ID & Contact line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', padding: '3px 10px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  ID Thám Hiểm: #{expeditionId}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-main)', padding: '3px 10px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <Mail size={13} color="var(--color-sky)" /> {activeProfile.email}
                </span>
                <span
                  onClick={() => {
                    setIsEditing(true);
                    populateForm(activeProfile);
                  }}
                  title="Bấm để cập nhật số điện thoại"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-main)', padding: '3px 10px', borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <Phone size={13} color="var(--color-primary)" />
                  <span style={{ color: activeProfile.phone ? 'var(--color-text-main)' : 'var(--color-text-dim)' }}>
                    {activeProfile.phone || 'Thêm SĐT'}
                  </span>
                </span>
                <span
                  onClick={() => {
                    setIsEditing(true);
                    populateForm(activeProfile);
                  }}
                  title="Bấm để thiết lập liên hệ khẩn cấp"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-main)', padding: '3px 10px', borderRadius: 8, border: '1px solid var(--color-border)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <AlertTriangle size={13} color="var(--color-earth)" />
                  <span>SOS: <strong style={{ color: activeProfile.emergencyContact ? 'var(--color-earth)' : 'var(--color-text-dim)' }}>{activeProfile.emergencyContact || 'Chưa thiết lập'}</strong></span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--color-bg-main)', padding: '3px 10px', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <Compass size={13} color="var(--color-sky)" /> {activeProfile.preferredStyle || 'Trekking & Camping'}
                </span>
              </div>

              {/* Bio snippet */}
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)', lineHeight: 1.5, maxWidth: 650 }}>
                {activeProfile.bio ? (
                  <span>"{activeProfile.bio}"</span>
                ) : (
                  <span
                    onClick={() => {
                      setIsEditing(true);
                      populateForm(activeProfile);
                    }}
                    style={{ cursor: 'pointer', fontStyle: 'italic', color: 'var(--color-text-dim)' }}
                  >
                    Chưa cập nhật tiểu sử cá nhân. <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>Bấm vào đây hoặc "Chỉnh sửa hồ sơ" để thêm.</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Quick Action Buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 46, alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setIsEditing(true);
                populateForm(activeProfile);
              }}
              style={{
                fontSize: '0.84rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                fontWeight: 'var(--font-weight-extrabold)',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              <Edit3 size={16} /> Chỉnh sửa hồ sơ
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setShowQrModal(true)}
              style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 12 }}
            >
              <QrCode size={15} color="var(--color-primary)" /> Mã QR Pass
            </button>
          </div>
        </div>
      </div>

      {/* 2. Telemetry Bento Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 22 }}>
        <div className="card" style={{ padding: '16px 18px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Compass size={18} color="var(--color-primary)" />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Tổng Quãng Đường</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-text-main)' }}>58 km</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', marginTop: 2 }}>Đã hoàn thành 3 chuyến trek</div>
        </div>

        <div className="card" style={{ padding: '16px 18px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Mountain size={18} color="var(--color-sky)" />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Đỉnh Cao Nhất</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-text-main)' }}>3,143 m</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-sky)', marginTop: 2 }}>Đỉnh Fansipan (Lào Cai)</div>
        </div>

        <div className="card" style={{ padding: '16px 18px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Tent size={18} color="var(--color-earth)" />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Số Đêm Cắm Trại</span>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--color-text-main)' }}>4 Đêm</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-earth)', marginTop: 2 }}>Basecamp Núi Rừng</div>
        </div>

        <div className="card" style={{ padding: '16px 18px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Award size={18} color="var(--color-primary)" />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Cấp Độ Sinh Tồn</span>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--color-primary)' }}>Alpine Master</div>
          <div style={{ width: '100%', background: 'var(--color-bg-main)', height: 6, borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: '75%', background: 'linear-gradient(90deg, #16a34a, var(--color-primary))', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation Bar */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 4,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {[
          { id: 'overview', label: 'Chiến Tích & Tổng Quan', Icon: Mountain, count: checkedTrails.length },
          { id: 'contributions', label: 'Cung Đường Đóng Góp', Icon: Compass, count: userContributions.length },
          { id: 'forum', label: 'Bài Viết Diễn Đàn', Icon: MessageSquare, count: userOwnPosts.length },
          { id: 'gear', label: 'Tủ Đồ Sinh Tồn', Icon: Package, count: equippedGearItems.length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 16px',
                borderRadius: '10px 10px 0 0',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                background: isActive ? 'rgba(74, 222, 128, 0.08)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <TabIcon size={15} color={isActive ? 'var(--color-primary)' : 'currentColor'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isActive ? 'var(--color-primary)' : 'var(--color-bg-main)',
                    color: isActive ? '#04131b' : 'var(--color-text-dim)',
                    border: isActive ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Tab Panels */}
      {/* Panel 1: Overview & Summits */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, animation: 'fadeIn 0.25s ease' }}>
          {/* Left: Conquered Trails List */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color="var(--color-primary)" /> Cung Đường Đã Chinh Phục ({checkedTrails.length})
              </h3>
              <button
                className="btn btn-outline"
                onClick={() => setShowCheckInModal(true)}
                style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <MapPin size={13} color="var(--color-primary)" /> + Check-in Cung Mới
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {checkedTrails.map((t, idx) => {
                const theme = TRAIL_CARD_THEMES[idx % TRAIL_CARD_THEMES.length];
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTrailPassport(t)}
                    style={{
                      background: 'var(--color-bg-main)',
                      border: `1px solid ${theme.border}`,
                      borderRadius: 14,
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.color;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.border;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                        {t.province} ({t.region}) • {t.distanceKm} km
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: theme.color, background: 'var(--color-bg-card)', padding: '3px 9px', borderRadius: 8, border: `1px solid ${theme.border}`, whiteSpace: 'nowrap', fontWeight: 'var(--font-weight-bold)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Check size={12} color={theme.color} /> {theme.tag}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Badges & Gear Quick Look */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* System Badges */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={18} color="var(--color-primary)" /> Huy Hiệu Danh Dự ({unlockedBadgesCount}/{computedBadges.length})
                </h3>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Bấm xem chi tiết</span>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {computedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge)}
                    style={{
                      background: badge.unlocked ? badge.bg : 'var(--color-bg-main)',
                      border: badge.unlocked ? `1px solid ${badge.border}` : '1px dashed var(--color-border)',
                      borderRadius: 12,
                      padding: '7px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      opacity: badge.unlocked ? 1 : 0.6,
                      boxShadow: badge.unlocked ? badge.glow : 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {badge.unlocked ? (
                      <CheckCircle2 size={15} color={badge.color} />
                    ) : (
                      <Lock size={13} color="var(--color-text-dim)" />
                    )}
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: badge.unlocked ? badge.color : 'var(--color-text-dim)' }}>
                      {badge.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Survival Gear Quick Snapshot */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={18} color="var(--color-sky)" /> Trang Bị Sinh Tồn ({equippedGearItems.length})
                </h3>
                <button
                  className="btn btn-outline"
                  onClick={() => setActiveTab('gear')}
                  style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}
                >
                  Xem tủ đồ ➔
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {equippedGearItems.map((item) => (
                  <span
                    key={item.id}
                    style={{
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      padding: '5px 10px',
                      fontSize: '0.76rem',
                      color: 'var(--color-text-main)',
                      fontWeight: 600,
                    }}
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Personal Explorer Profile & Safety Dossier Card */}
            <div className="card" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={18} color="var(--color-primary)" /> Thông Tin Cá Nhân & An Toàn Thực Địa
                </h3>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setIsEditing(true);
                    populateForm(activeProfile);
                  }}
                  style={{ fontSize: 'var(--font-size-xs)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Edit3 size={13} color="var(--color-primary)" /> Chỉnh Sửa Thông Tin
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 'var(--font-size-xs)' }}>
                <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Họ và tên</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-text-main)', fontSize: '0.86rem' }}>{activeProfile.fullName}</div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Email liên lạc</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-sky)', fontSize: '0.86rem' }}>{activeProfile.email}</div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Số điện thoại cá nhân</div>
                  <div style={{ fontWeight: 700, color: activeProfile.phone ? 'var(--color-primary)' : 'var(--color-text-dim)', fontSize: '0.86rem' }}>
                    {activeProfile.phone || 'Chưa cập nhật'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Liên hệ khẩn cấp (SOS)</div>
                  <div style={{ fontWeight: 700, color: activeProfile.emergencyContact ? 'var(--color-earth)' : 'var(--color-text-dim)', fontSize: '0.86rem' }}>
                    {activeProfile.emergencyContact || 'Chưa thiết lập'}
                  </div>
                </div>

                <div style={{ background: 'var(--color-bg-main)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)', gridColumn: '1 / -1' }}>
                  <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>Giới thiệu bản thân (Bio)</div>
                  <div style={{ color: activeProfile.bio ? 'var(--color-text-main)' : 'var(--color-text-dim)', fontStyle: activeProfile.bio ? 'normal' : 'italic', lineHeight: 1.5 }}>
                    {activeProfile.bio || 'Chưa cập nhật tiểu sử cá nhân. Hãy thêm thông điệp và kinh nghiệm của bạn.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panel 2: Contributed Trails */}
      {activeTab === 'contributions' && (
        <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Compass size={18} color="var(--color-primary)" /> Lịch Sử Đóng Góp Cung Đường Trekking Mới ({userContributions.length})
            </h3>
            <button
              className="btn btn-primary"
              onClick={() => { if (onNavigateToContribute) onNavigateToContribute(); }}
              style={{ padding: '6px 14px', fontSize: '0.78rem' }}
            >
              + Đóng Góp Cung Đường Mới
            </button>
          </div>

          {userContributions.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {userContributions.map((contrib) => (
                <div
                  key={contrib.id}
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <div style={{ height: 120, position: 'relative', overflow: 'hidden', background: '#000' }}>
                    <img
                      src={contrib.coverImage || 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=800&q=80'}
                      alt={contrib.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <span style={{ background: contrib.status === 'approved' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(245, 158, 11, 0.9)', color: '#fff', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>
                        {contrib.status === 'approved' ? 'Đã Duyệt & Công Khai' : 'Chờ BQT Duyệt (+20 PTS)'}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-text-main)', margin: '0 0 4px 0' }}>
                        {contrib.name}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                        Vị trí: {contrib.province}, {contrib.district} ({contrib.region})
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        <span>Chiều dài: {contrib.distanceKm} km</span>
                        <span>Độ cao nâng: +{contrib.elevationGainM}m</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Ngày gửi: {contrib.createdAt}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleEditContribution(contrib)}
                          style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: 6 }}
                        >
                          Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => handleDeleteContribution(contrib.id, contrib.name)}
                          style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: 6, color: 'var(--color-error)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-text-muted)', fontStyle: 'italic', background: 'var(--color-bg-main)', borderRadius: 12, border: '1px dashed var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
              Bạn chưa có bài đóng góp cung đường mới nào. Hãy bấm <strong>"+ Đóng Góp Cung Đường Mới"</strong> để chia sẻ kinh nghiệm và nhận +20 điểm uy tín!
            </div>
          )}
        </div>
      )}

      {/* Panel 4: Forum Posts */}
      {activeTab === 'forum' && (
        <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={18} color="var(--color-sky)" /> Lịch Sử Bài Viết & Đóng Góp Diễn Đàn ({userOwnPosts.length})
            </h3>
          </div>

          {userOwnPosts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {userOwnPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedThreadForModal(post)}
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 14,
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className={post.category === 'Cảnh Báo' ? 'badge badge-error' : 'badge badge-success'}>
                        {post.category}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)' }}>{post.createdAt}</span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'underline', marginLeft: 'auto' }}>Bấm để xem chi tiết & bình luận ➔</span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-main)' }}>{post.title}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ThumbsUp size={15} color="var(--color-primary)" /> {post.upvotes}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MessageSquare size={15} color="var(--color-sky)" /> {post.repliesCount !== undefined ? post.repliesCount : (post as any).replies || 0} phản hồi</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--color-text-muted)', fontStyle: 'italic', background: 'var(--color-bg-main)', borderRadius: 12, border: '1px dashed var(--color-border)', fontSize: 'var(--font-size-sm)' }}>
              Tài khoản này chưa tạo bài viết hoặc bài đóng góp diễn đàn nào. Hãy đăng bài đầu tiên để nhận +10 điểm uy tín!
            </div>
          )}
        </div>
      )}

      {/* Panel 5: Gear Locker */}
      {activeTab === 'gear' && (
        <div className="card" style={{ animation: 'fadeIn 0.25s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={18} color="var(--color-primary)" /> Quản Lý Tủ Đồ Thiết Bị Sinh Tồn ({userGear.length}/{ALL_GEAR_ITEMS.length})
              </h3>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 3 }}>
                Bấm trực tiếp vào từng món trang bị để kích hoạt hoặc hủy kích hoạt trong balô dã ngoại
              </div>
            </div>

            <button
              className="btn btn-outline"
              onClick={() => setShowGearModal(true)}
              style={{ fontSize: 'var(--font-size-xs)', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Edit3 size={14} /> Mở cửa sổ quản lý tủ đồ
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {ALL_GEAR_ITEMS.map((item) => {
              const isOwned = userGear.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleGear(item.id)}
                  style={{
                    background: isOwned ? 'rgba(22, 163, 74, 0.12)' : 'var(--color-bg-main)',
                    border: isOwned ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                  onMouseEnter={(e) => {
                    if (!isOwned) e.currentTarget.style.borderColor = 'var(--color-primary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isOwned) e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.68rem', color: isOwned ? 'var(--color-primary)' : 'var(--color-text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                      {item.category}
                    </span>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: isOwned ? 'var(--color-text-main)' : 'var(--color-text-muted)', marginTop: 2 }}>
                      {item.name}
                    </div>
                  </div>
                  {isOwned ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                      <CheckCircle2 size={16} color="var(--color-primary)" /> Đã trang bị
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                      + Trang bị
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QR Active Pass Detail Modal */}
      {showQrModal && (
        <div className="modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <QrCode size={20} /> Mã Thông Hành QR Active Pass
              </h3>
              <button onClick={() => setShowQrModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#ffffff', padding: 16, borderRadius: 16, textAlign: 'center', margin: '0 auto 16px auto', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid var(--color-primary)' }}>
              <QrCode size={140} color="#04131b" />
            </div>

            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)', textAlign: 'center', marginBottom: 16 }}>
              Mã QR mã hóa ID thám hiểm <strong style={{ color: 'var(--color-primary)' }}>#{expeditionId}</strong> dành cho Đội Cứu Hộ SOS và Cán bộ Trạm Kiểm Lâm quét xác minh danh tính khi tham gia các tuyến trek.
            </div>

            <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 12, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>Trạng Thái: <strong style={{ color: 'var(--color-primary)' }}>{isVerifiedUser ? 'Đã Xác Thực' : 'Chưa Kích Hoạt OTP'}</strong></div>
              <div>Liên Hệ Khẩn Cấp: <strong style={{ color: 'var(--color-text-main)' }}>{activeProfile.emergencyContact || 'Chưa thiết lập'}</strong></div>
              <div>Thời Gian Tạo: <strong style={{ color: 'var(--color-sky)' }}>{new Date().toLocaleDateString('vi-VN')}</strong></div>
            </div>

            <button className="btn btn-outline" onClick={() => setShowQrModal(false)} style={{ width: '100%', marginTop: 16 }}>
              Đóng Cửa Sổ
            </button>
          </div>
        </div>
      )}

      {/* BADGE DETAIL EXPLANATION MODAL */}
      {selectedBadge && (
        <div className="modal-overlay" onClick={() => setSelectedBadge(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, border: `1.5px solid ${selectedBadge.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: selectedBadge.color, fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={20} /> Chi Tiết Huy Hiệu Danh Dự
              </h3>
              <button onClick={() => setSelectedBadge(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--color-bg-main)', borderRadius: 16, padding: 20, textAlign: 'center', border: `1px solid ${selectedBadge.border}`, marginBottom: 16 }}>
              <div style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 20, border: `1px solid ${selectedBadge.color}`, background: 'var(--color-bg-card)' }}>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-extrabold)', color: selectedBadge.color }}>
                  {selectedBadge.name}
                </span>
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 10 }}>
                <span className={selectedBadge.unlocked ? 'badge badge-success' : 'badge badge-amber'} style={{ borderColor: selectedBadge.color, color: selectedBadge.color }}>
                  {selectedBadge.unlocked ? 'Đã Mở Khóa' : 'Chưa Mở Khóa'}
                </span>
                <span className="badge badge-amber" style={{ borderColor: selectedBadge.color }}>Độ Hiếm: {selectedBadge.rarity}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-relaxed)' }}>
              <div>
                <strong style={{ color: selectedBadge.color }}>Nguồn gốc & Ý nghĩa: </strong>
                <span style={{ color: 'var(--color-text-main)' }}>{selectedBadge.description}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--color-sky)' }}>Điều kiện mở khóa: </strong>
                <span style={{ color: 'var(--color-text-main)' }}>{selectedBadge.requirement}</span>
              </div>
              {selectedBadge.unlockedAt && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)', marginTop: 4 }}>
                  Ngày đạt được: {selectedBadge.unlockedAt}
                </div>
              )}
            </div>

            <button className="btn btn-primary" onClick={() => setSelectedBadge(null)} style={{ width: '100%', marginTop: 20 }}>
              Đã Hiểu
            </button>
          </div>
        </div>
      )}

      {/* CONQUERED TRAIL PASSPORT DETAIL MODAL */}
      {selectedTrailPassport && (
        <div className="modal-overlay" onClick={() => setSelectedTrailPassport(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, border: '1.5px solid var(--color-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} /> Chứng Nhận Chinh Phục Cung Đường
              </h3>
              <button onClick={() => setSelectedTrailPassport(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--color-bg-main)', borderRadius: 16, padding: 20, border: '1px dashed var(--color-primary)', textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', textTransform: 'uppercase', letterSpacing: 2 }}>
                OFFICIAL EXPEDITION CHECK-IN PASSPORT
              </div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', marginTop: 4 }}>
                {selectedTrailPassport.name}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {selectedTrailPassport.province} ({selectedTrailPassport.region})
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div style={{ background: 'var(--color-bg-main)', padding: 12, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Chiều Dài Cung Đường</span>
                <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-main)' }}>{selectedTrailPassport.distanceKm} km</strong>
              </div>

              <div style={{ background: 'var(--color-bg-main)', padding: 12, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'block' }}>Độ Khó Địa Hình</span>
                <strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>Trung Bình</strong>
              </div>
            </div>

            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)', marginBottom: 20 }}>
              Dữ liệu được ghi nhận tự động qua hệ thống **GPS Trekking Log** và quét mã QR Check-in tại Trạm Kiểm Lâm cửa rừng.
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setSelectedTrailPassport(null)} style={{ flex: 1 }}>
                Đóng
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const trailToNav = selectedTrailPassport;
                  setSelectedTrailPassport(null);
                  onSelectTrail(trailToNav);
                }}
                style={{ flex: 1 }}
              >
                Mở Bản Đồ 3D Cung Đường
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRM DELETE CONTRIBUTION MODAL */}
      {deletingContribution && (
        <div className="modal-overlay" onClick={() => setDeletingContribution(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, border: '1.5px solid var(--color-error)' }}>
            <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-error)', fontWeight: 'var(--font-weight-extrabold)', margin: '0 0 12px 0' }}>
              Xác nhận xóa bài đóng góp
            </h3>

            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', lineHeight: 1.5, marginBottom: 20 }}>
              Bạn có chắc chắn muốn xóa bài đóng góp cung đường <strong style={{ color: 'var(--color-primary)' }}>"{deletingContribution.name}"</strong> không? Thao tác này sẽ gỡ bài viết khỏi hệ thống và không thể hoàn tác.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-outline"
                onClick={() => setDeletingContribution(null)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                Hủy bỏ
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmDeleteContribution}
                style={{ flex: 1, justifyContent: 'center', background: 'var(--color-error)', borderColor: 'var(--color-error)', color: '#ffffff' }}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHECK-IN NEW TRAIL MODAL */}
      {showCheckInModal && (
        <div className="modal-overlay" onClick={() => setShowCheckInModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} /> Chọn Cung Đường Vừa Chinh Phục
              </h3>
              <button onClick={() => setShowCheckInModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
              {allAvailableTrails.map((trail) => {
                const isAlreadyChecked = checkedTrails.some((t) => t.id === trail.id);
                return (
                  <div
                    key={trail.id}
                    onClick={() => !isAlreadyChecked && handleAddCheckInTrail(trail)}
                    style={{
                      background: isAlreadyChecked ? 'rgba(22, 163, 74, 0.12)' : 'var(--color-bg-main)',
                      border: isAlreadyChecked ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: 12,
                      padding: 14,
                      cursor: isAlreadyChecked ? 'default' : 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)' }}>{trail.name}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{trail.province} ({trail.distanceKm} km)</div>
                    </div>
                    {isAlreadyChecked ? (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-bold)' }}>Đã Check-in</span>
                    ) : (
                      <button className="btn btn-outline" style={{ fontSize: 'var(--font-size-xs)', padding: '4px 10px' }}>
                        + Thêm Check-in
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 720,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Fixed Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={20} /> Điền & Cập Nhật Thông Tin Cá Nhân
              </h3>
              <button type="button" onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            {/* Modal Inner Scrollable Body */}
            <form
              onSubmit={handleSaveProfile}
              style={{
                overflowY: 'auto',
                maxHeight: 'calc(90vh - 100px)',
                paddingRight: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              {fieldErrors.general && (
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--color-error)', borderRadius: 12, padding: '10px 14px', color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)' }}>
                  {fieldErrors.general}
                </div>
              )}

              {/* PERFECT 2-COLUMN SYMMETRICAL INPUT GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
                {/* Immutable Username Input */}
                <div className="form-group">
                  <label className="form-label" style={{ height: 22, display: 'flex', alignItems: 'center', gap: 6, margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>
                    <Lock size={14} color="var(--color-text-dim)" /> Tên tài khoản (Cố định)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editUsername}
                    disabled
                    style={{ background: 'var(--color-bg-main)', color: 'var(--color-text-dim)', cursor: 'not-allowed', border: '1px solid var(--color-border)' }}
                  />
                </div>

                {/* Full Name Input */}
                <div className="form-group">
                  <label className="form-label" style={{ height: 22, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>
                    Họ và tên đầy đủ
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{
                      borderColor: fieldErrors.fullName ? 'var(--color-error)' : undefined,
                      boxShadow: fieldErrors.fullName ? '0 0 12px rgba(239, 68, 68, 0.35)' : undefined,
                    }}
                    value={editFullName}
                    onChange={(e) => {
                      setEditFullName(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, fullName: '' }));
                    }}
                    required
                  />
                  {fieldErrors.fullName && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={14} color="var(--color-error)" style={{ flexShrink: 0 }} />
                      <span>{fieldErrors.fullName}</span>
                    </div>
                  )}
                </div>

                {/* Phone Number Input */}
                <div className="form-group">
                  <label className="form-label" style={{ height: 22, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>
                    Số điện thoại cá nhân (chuẩn VN)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0912 345 678"
                    style={{
                      borderColor: fieldErrors.phone ? 'var(--color-error)' : undefined,
                      boxShadow: fieldErrors.phone ? '0 0 12px rgba(239, 68, 68, 0.35)' : undefined,
                    }}
                    value={editPhone}
                    onChange={(e) => {
                      setEditPhone(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, phone: '' }));
                    }}
                  />
                  {fieldErrors.phone && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={14} color="var(--color-error)" style={{ flexShrink: 0 }} />
                      <span>{fieldErrors.phone}</span>
                    </div>
                  )}
                </div>

                {/* Emergency Contact Input */}
                <div className="form-group">
                  <label className="form-label" style={{ height: 22, display: 'flex', alignItems: 'center', margin: 0, marginBottom: 8, whiteSpace: 'nowrap' }}>
                    Số điện thoại khẩn cấp (SOS Contact)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="0988 776 655 (Người thân)"
                    style={{
                      borderColor: fieldErrors.emergencyContact ? 'var(--color-error)' : undefined,
                      boxShadow: fieldErrors.emergencyContact ? '0 0 12px rgba(239, 68, 68, 0.35)' : undefined,
                    }}
                    value={editEmergency}
                    onChange={(e) => {
                      setEditEmergency(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, emergencyContact: '' }));
                    }}
                  />
                  {fieldErrors.emergencyContact && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={14} color="var(--color-error)" style={{ flexShrink: 0 }} />
                      <span>{fieldErrors.emergencyContact}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* CLEAN VISUAL CARD SELECTOR FOR PHONG CÁCH TREKKING */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>
                  Phong cách Trekking yêu thích (Bấm chọn phong cách của bạn)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {TREKKING_STYLE_OPTIONS.map((style) => {
                    const isSelected = editStyle === style.id;
                    return (
                      <div
                        key={style.id}
                        onClick={() => setEditStyle(style.id)}
                        style={{
                          background: isSelected ? 'rgba(22, 163, 74, 0.12)' : 'var(--color-bg-main)',
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                          borderRadius: 14,
                          padding: '14px 16px',
                          cursor: 'pointer',
                          transition: 'all 0.25s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: isSelected ? '0 0 18px rgba(22, 163, 74, 0.25)' : 'none',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-extrabold)', color: isSelected ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                            {style.title}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {style.sub}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 size={18} color="var(--color-primary)" style={{ flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Avatar Upload from PC & Link URL Input */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: 10, display: 'block' }}>
                  Ảnh Đại Diện (Avatar)
                </label>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <img
                    src={editAvatarUrl || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg'}
                    alt="Preview"
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-primary)', flexShrink: 0 }}
                  />

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: 'var(--font-size-xs)', flexShrink: 0 }}
                  >
                    <Upload size={15} /> Chọn ảnh từ máy tính
                  </button>

                  <div style={{ flex: 1, minWidth: 240 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Hoặc dán đường dẫn ảnh URL (https://...)"
                      value={editAvatarUrl}
                      onChange={(e) => {
                        setEditAvatarUrl(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, avatarUrl: '' }));
                      }}
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        borderColor: fieldErrors.avatarUrl ? '#ef4444' : undefined,
                      }}
                    />
                  </div>
                </div>
                {fieldErrors.avatarUrl && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={14} color="var(--color-error)" style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.avatarUrl}</span>
                  </div>
                )}
              </div>

              {/* Bio Textarea */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                  Giới thiệu bản thân (Bio)
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Chia sẻ kinh nghiệm leo núi, các cung đường đã qua hoặc thông điệp của bạn..."
                  style={{
                    borderColor: fieldErrors.bio ? 'var(--color-error)' : undefined,
                    boxShadow: fieldErrors.bio ? '0 0 12px rgba(239, 68, 68, 0.35)' : undefined,
                  }}
                  value={editBio}
                  onChange={(e) => {
                    setEditBio(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, bio: '' }));
                  }}
                />
                {fieldErrors.bio && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)', fontWeight: 600, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={14} color="var(--color-error)" style={{ flexShrink: 0 }} />
                    <span>{fieldErrors.bio}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsEditing(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  <Save size={16} /> {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi Thông Tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GEAR LOCKER MANAGER MODAL */}
      {showGearModal && (
        <div className="modal-overlay" onClick={() => setShowGearModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-extrabold)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={20} /> Quản Lý Tủ Đồ Thiết Bị Sinh Tồn
                </h3>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Tích chọn các trang bị dã ngoại bạn đang sở hữu ({userGear.length}/{ALL_GEAR_ITEMS.length})
                </div>
              </div>
              <button onClick={() => setShowGearModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {ALL_GEAR_ITEMS.map((item) => {
                const isOwned = userGear.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleGear(item.id)}
                    style={{
                      background: isOwned ? 'rgba(22, 163, 74, 0.12)' : 'var(--color-bg-main)',
                      border: isOwned ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-bold)', color: isOwned ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>{item.name}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: isOwned ? 'var(--color-primary)' : 'var(--color-text-dim)', marginTop: 2 }}>
                        {isOwned ? 'Đã sở hữu' : '+ Bấm để chọn'}
                      </div>
                    </div>
                    {isOwned && <CheckCircle2 size={16} color="var(--color-primary)" style={{ flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>

            <button className="btn btn-primary" onClick={() => setShowGearModal(false)} style={{ width: '100%', marginTop: 20 }}>
              Đã Xong - Lưu Trang Bị Đã Chọn
            </button>
          </div>
        </div>
      )}



      {/* THREAD DETAIL MODAL */}
      {selectedThreadForModal && (
        <ThreadDetailModal
          thread={selectedThreadForModal}
          onClose={() => {
            setSelectedThreadForModal(null);
            fetch('/api/forum', { headers: getApiHeaders() })
              .then((res) => res.json())
              .then((data) => {
                if (data.success && Array.isArray(data.data)) {
                  setUserForumPosts(data.data);
                }
              })
              .catch((err) => console.error('[Profile Forum Refresh Error]:', err));
          }}
          onOpenAuthorProfile={(author) => setSelectedAuthorForModal(author)}
          onUpdateThreadUpvotes={(threadId, newUpvotes) => {
            setUserForumPosts((prev) =>
              prev.map((t) => (t.id === threadId ? { ...t, upvotes: newUpvotes } : t))
            );
          }}
          onUpdateCommentCount={(threadId, newCount) => {
            setUserForumPosts((prev) =>
              prev.map((t) => (t.id === threadId ? { ...t, repliesCount: newCount } : t))
            );
          }}
        />
      )}

      {/* AUTHOR PROFILE MODAL */}
      {selectedAuthorForModal && (
        <AuthorProfileModal
          author={selectedAuthorForModal}
          currentUser={currentUser}
          onClose={() => setSelectedAuthorForModal(null)}
          onStartChat={(targetUserId) => {
            if (targetUserId) {
              localStorage.setItem('trekmap_target_chat_user', targetUserId);
            }
            window.location.hash = '#messages';
          }}
        />
      )}

      {/* CUSTOM COVER PHOTO MODAL */}
      {showCoverModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowCoverModal(false)} style={{ zIndex: 99999999 }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 680,
              padding: '24px 28px',
              border: '1px solid var(--color-border-glow)',
              borderRadius: 20,
              background: 'var(--color-bg-card)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Camera size={20} color="var(--color-primary)" /> Tùy Chỉnh Ảnh Bìa Trang Cá Nhân
                </h3>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Tải ảnh từ máy, chọn danh thắng trekking nổi tiếng Việt Nam hoặc dán đường dẫn ảnh bất kỳ.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCoverModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Live Preview Area */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Bản Xem Trước Ảnh Bìa
              </div>
              <div
                style={{
                  height: 140,
                  borderRadius: 14,
                  overflow: 'hidden',
                  position: 'relative',
                  background: 'var(--color-bg-card)',
                  border: '2px solid var(--color-primary)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                }}
              >
                <img
                  key={previewCover}
                  src={previewCover}
                  alt="Cover Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER_URL;
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(15,23,42,0.85) 100%)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '14px 18px',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, border: '2px solid var(--color-primary)', overflow: 'hidden', flexShrink: 0 }}>
                      <img
                        src={activeProfile.avatarUrl || activeProfile.avatar || 'https://res.cloudinary.com/dsxbuk4pe/image/upload/v1785329093/trekmap/avatars/avatar_user_1.jpg'}
                        alt={activeProfile.fullName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.92rem' }}>{activeProfile.fullName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>@{activeProfile.username || 'trekker'} • {activeProfile.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Option 1: Upload from local file */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Cách 1: Tải Ảnh Lên Từ Thiết Bị
              </div>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => coverFileInputRef.current?.click()}
                style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 'var(--font-size-sm)', borderRadius: 12 }}
              >
                <Upload size={16} color="var(--color-primary)" /> Chọn Tệp Ảnh Từ Máy Tính (PNG, JPG, WebP - Tối đa 8MB)
              </button>
              {previewCover.startsWith('data:image/') && (
                <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <Check size={14} /> Đã chọn ảnh từ máy tính (Đang xem trước ở trên)
                </div>
              )}
            </div>

            {/* Option 2: Choose from iconic Vietnam trekking presets */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Cách 2: Chọn Từ Danh Thắng Trekking Việt Nam
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {COVER_PRESETS.map((preset) => {
                  const isSelected = previewCover === preset.url;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setPreviewCover(preset.url);
                        setCustomCoverInput('');
                      }}
                      style={{
                        position: 'relative',
                        height: 76,
                        borderRadius: 12,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected ? '2.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                        boxShadow: isSelected ? '0 0 14px rgba(74, 222, 128, 0.4)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-primary)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-end',
                          padding: '6px 8px',
                        }}
                      >
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {preset.name}
                        </div>
                        <div style={{ fontSize: '0.64rem', color: 'var(--color-primary)' }}>
                          {preset.location}
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ position: 'absolute', top: 5, right: 5, background: 'var(--color-primary)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Option 3: Direct URL input */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                Cách 3: Dán Đường Dẫn Ảnh (URL Trực Tiếp)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  className="form-input"
                  placeholder="Dán link ảnh https://images.unsplash.com/..."
                  value={customCoverInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomCoverInput(val);
                    if (val.trim()) {
                      setPreviewCover(val.trim());
                    }
                  }}
                  style={{ flex: 1, fontSize: 'var(--font-size-xs)' }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    if (customCoverInput.trim()) {
                      setPreviewCover(customCoverInput.trim());
                      if (onShowToast) onShowToast('Đã áp dụng link ảnh vào bản xem trước!', 'info');
                    }
                  }}
                  style={{ padding: '0 14px', fontSize: 'var(--font-size-xs)' }}
                >
                  Xem Thử Link
                </button>
              </div>
            </div>

            {/* Action Buttons Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 16, flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setPreviewCover(DEFAULT_COVER_URL);
                  handleApplyCover(DEFAULT_COVER_URL);
                }}
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}
              >
                Khôi Phục Mặc Định
              </button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCoverModal(false)}
                  style={{ padding: '8px 18px', fontSize: 'var(--font-size-sm)' }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleApplyCover(previewCover)}
                  style={{ padding: '8px 22px', fontSize: 'var(--font-size-sm)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} /> Lưu & Áp Dụng Ảnh Bìa
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Full-Screen Photo Lightbox Modal */}
      {fullViewImage && createPortal(
        <div
          onClick={() => setFullViewImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(3, 7, 18, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {/* Top Bar with Title & Actions */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              padding: '10px 16px',
              borderRadius: 14,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--color-border)',
              backdropFilter: 'blur(12px)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}
              >
                {fullViewImage.type === 'cover' ? <Camera size={18} /> : <User size={18} />}
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                  {fullViewImage.title}
                </div>
                {fullViewImage.subtitle && (
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                    {fullViewImage.subtitle}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {fullViewImage.type === 'cover' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setFullViewImage(null);
                    setPreviewCover(customCoverUrl);
                    setCustomCoverInput('');
                    setShowCoverModal(true);
                  }}
                  style={{ fontSize: '0.76rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)' }}
                >
                  <Camera size={14} color="var(--color-primary)" /> Đổi Ảnh Bìa
                </button>
              )}
              {fullViewImage.type === 'avatar' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setFullViewImage(null);
                    fileInputRef.current?.click();
                  }}
                  style={{ fontSize: '0.76rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)' }}
                >
                  <Upload size={14} color="var(--color-primary)" /> Đổi Ảnh Đại Diện
                </button>
              )}
              {!fullViewImage.url.startsWith('data:') && (
                <a
                  href={fullViewImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.76rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ffffff', borderColor: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}
                  title="Mở ảnh gốc trong tab mới"
                >
                  <ExternalLink size={14} /> Mở Ảnh Gốc
                </a>
              )}
              <button
                type="button"
                onClick={() => setFullViewImage(null)}
                title="Đóng (Phím Esc)"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Full Image Container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 'min(94vw, 1100px)',
              maxHeight: 'calc(86vh - 80px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 25px 65px rgba(0, 0, 0, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: '#090d16',
            }}
          >
            <img
              src={fullViewImage.url}
              alt={fullViewImage.title}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(86vh - 80px)',
                objectFit: 'contain',
                display: 'block',
                borderRadius: 18,
              }}
            />
          </div>

          {/* Bottom Hint */}
          <div
            style={{
              marginTop: 12,
              fontSize: '0.74rem',
              color: 'rgba(255, 255, 255, 0.65)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>Nhấn phím <strong>ESC</strong> hoặc bấm ra ngoài khoảng tối để đóng xem trọn vẹn</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
