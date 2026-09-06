import React, { useState } from 'react';
import type { Trail, Review } from '../../types.js';
import { MapView } from '../map/MapView.js';
import { submitReview } from '../../services/api.js';
import { OptimizedImage } from '../common/OptimizedImage.js';
import { ElevationProfileSVG } from './ElevationProfileSVG.js';
import { WeatherTab } from './WeatherTab.js';
import { GearChecklistTab } from './GearChecklistTab.js';
import { ItineraryTab } from './ItineraryTab.js';
import { TrailConditionSection } from './TrailConditionSection.js';
import {
  IconPhone,
  IconAlertTriangle,
  IconStar,
  IconShieldAlert,
  IconCheckCircle,
  IconMapPin,
  IconUsers,
  IconClock,
  IconMountain,
  IconDroplet,
  IconCloudFog,
  IconTrees,
  IconCompass,
  IconX,
} from '../common/SvgIcons.js';

interface TrailDetailViewProps {
  trail: Trail;
  onBack: () => void;
  onOpenIncidentModal: () => void;
  incidents?: any[];
  currentUser?: any;
  onRequireLogin?: (actionName: string) => void;
}

export const TrailDetailView: React.FC<TrailDetailViewProps> = ({
  trail,
  onBack,
  onOpenIncidentModal,
  incidents = [],
  currentUser,
  onRequireLogin,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'weather' | 'checklist' | 'itinerary' | 'guides' | 'reviews' | 'conditions'>('overview');
  const [reviewsList, setReviewsList] = useState<Review[]>(trail.reviews || []);
  const [guidesList, setGuidesList] = useState<any[]>(trail.guides || []);
  const [newRating, setNewRating] = useState(5);
  const [newDiffRating, setNewDiffRating] = useState(trail.difficultyLevel || 3);
  const [newContent, setNewContent] = useState('');
  const [newSafetyNote, setNewSafetyNote] = useState('');
  const [selectedEvidencePhoto, setSelectedEvidencePhoto] = useState<string | null>(null);

  const getIncidentTypeMeta = (type?: string) => {
    switch (type) {
      case 'landslide':
        return {
          label: 'Sạt lở đất đá & Đứt gãy đường mòn',
          tag: 'Sạt lở địa hình',
          Icon: IconMountain,
          color: '#ef4444',
        };
      case 'flood':
      case 'flash_flood':
        return {
          label: 'Mưa to ngập lũ & Nước suối dâng xiết',
          tag: 'Lũ quét suối dâng',
          Icon: IconDroplet,
          color: '#0ea5e9',
        };
      case 'weather':
      case 'bad_weather':
        return {
          label: 'Thời tiết cực đoan, giông lốc & sương mù dày',
          tag: 'Thiên tai thời tiết',
          Icon: IconCloudFog,
          color: '#f59e0b',
        };
      case 'wildlife':
        return {
          label: 'Động vật rừng hoang dã & Rắn/Ong độc',
          tag: 'Sinh vật hoang dã',
          Icon: IconTrees,
          color: '#10b981',
        };
      case 'lost':
        return {
          label: 'Mất dấu mòn định hướng & Nguy cơ lạc đường',
          tag: 'Cảnh báo lạc đường',
          Icon: IconCompass,
          color: '#8b5cf6',
        };
      default:
        return {
          label: 'Sự cố an toàn địa hình thực địa',
          tag: 'Cảnh báo thực địa',
          Icon: IconAlertTriangle,
          color: '#ef4444',
        };
    }
  };

  const getIncidentSeverityMeta = (sev?: string) => {
    switch (sev) {
      case 'critical':
        return {
          levelCode: 'CẤP 1 - KHẨN CẤP',
          directive: 'Nguy hiểm tính mạng - Tạm dừng & Đình chỉ hành trình',
          bg: '#dc2626',
          border: '#ef4444',
          textColor: '#ffffff',
        };
      case 'high':
        return {
          levelCode: 'CẤP 2 - NGUY CẤP',
          directive: 'Rủi ro cao - Cân nhắc quay lại hoặc dừng chân tại trạm',
          bg: '#ea580c',
          border: '#f97316',
          textColor: '#ffffff',
        };
      case 'medium':
        return {
          levelCode: 'CẤP 3 - TRUNG BÌNH',
          directive: 'Cần quan sát địa hình kỹ & Chuẩn bị phương án dự phòng',
          bg: '#d97706',
          border: '#f59e0b',
          textColor: '#ffffff',
        };
      default:
        return {
          levelCode: 'CẤP 4 - LƯU Ý',
          directive: 'Địa hình trơn trượt - Chú ý an toàn khi di chuyển',
          bg: '#0284c7',
          border: '#38bdf8',
          textColor: '#ffffff',
        };
    }
  };

  // Find active safety incident matching this trail
  const matchingIncident = React.useMemo(() => {
    if (!incidents || incidents.length === 0) return null;
    const tid = trail.id || (trail as any)._id;
    return incidents.find((inc) => {
      if (!inc) return false;
      if (inc.trailId && (inc.trailId === tid || inc.trailId === trail.id)) return true;
      if (inc.trailName && trail.name) {
        const normInc = inc.trailName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normTrail = trail.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normInc.includes(normTrail) || normTrail.includes(normInc)) return true;
      }
      return false;
    }) || null;
  }, [trail, incidents]);

  React.useEffect(() => {
    const fetchReviews = async () => {
      try {
        const res = await fetch(`/api/trails/${trail.id}/reviews`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setReviewsList(data.data);
        }
      } catch (err) {}
    };
    const fetchGuides = async () => {
      try {
        const res = await fetch(`/api/trails/${trail.id}/guides`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setGuidesList(data.data);
        }
      } catch (err) {}
    };
    fetchReviews();
    fetchGuides();
  }, [trail.id]);

  const steepnessPercent = Math.round((trail.elevationGainM / (trail.distanceKm * 1000)) * 100);

  // GPX 1.1 Download Generator
  const handleDownloadGpx = () => {
    if (!currentUser && !localStorage.getItem('trekmap_token')) {
      if (onRequireLogin) onRequireLogin('tải file GPX Offline');
      return;
    }

    if (!trail.gpxTrack || trail.gpxTrack.length === 0) {
      alert('Tuyến đường này chưa có dữ liệu GPS Tracklog chi tiết để xuất file.');
      return;
    }

    const trackPointsXml = (trail.gpxTrack || [])
      .map((pt: any) => {
        const lat = Array.isArray(pt) ? pt[0] : pt.lat;
        const lng = Array.isArray(pt) ? pt[1] : pt.lng;
        const ele = Array.isArray(pt) ? (pt[2] || 0) : (pt.elevationM || 0);
        return `      <trkpt lat="${lat}" lon="${lng}"><ele>${ele}</ele></trkpt>`;
      })
      .join('\n');

    const gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrekMap Vietnam - https://trekmap.vn">
  <metadata>
    <name>${trail.name}</name>
    <desc>${trail.description}</desc>
    <author><name>TrekMap Community</name></author>
  </metadata>
  <trk>
    <name>${trail.name} Trail Track</name>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxXml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${trail.id}_TrekMap.gpx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser && !localStorage.getItem('trekmap_token')) {
      if (onRequireLogin) onRequireLogin('gửi đánh giá chuyến đi');
      return;
    }
    if (!newContent.trim()) return;

    const payload = {
      trailId: trail.id,
      rating: newRating,
      difficultyRating: newDiffRating,
      content: newContent,
      safetyNote: newSafetyNote || undefined,
    };

    const res: any = await submitReview(trail.id, payload as any);
    if (res && res._id) {
      setReviewsList([res, ...reviewsList]);
    } else {
      const mockRev: Review = {
        id: `rev-${Date.now()}`,
        trailId: trail.id,
        userId: currentUser?.id || 'user-temp',
        userName: currentUser?.fullName || 'Trekker Ẩn Danh',
        userAvatar: currentUser?.avatarUrl || currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
        rating: newRating,
        difficultyRating: newDiffRating,
        content: newContent,
        safetyNote: newSafetyNote || undefined,
        tripDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      setReviewsList([mockRev, ...reviewsList]);
    }

    setNewContent('');
    setNewSafetyNote('');
  };

  // Best season calendar calculation
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentMonth = new Date().getMonth() + 1;

  // Transportation steps
  const transportSteps = trail.transportationInfo
    ? trail.transportationInfo.split(/\.\s+/)
    : [
        `Di chuyển từ trung tâm TP. ${trail.province} bằng xe khách/xe máy đến điểm hẹn.`,
        'Bắt đầu chặng đi bộ từ cổng Vườn Quốc Gia / Cửa rừng.',
        'Làm thủ tục đăng ký với Trạm Kiểm Lâm địa phương.',
      ];

  const isOver3000m = trail.maxAltitudeM >= 3000;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 60px 20px' }}>
      {/* Navigation & Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0',
        marginBottom: 16,
      }}>
        <button className="btn btn-outline" onClick={onBack} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Quay lại danh sách</span>
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline" onClick={handleDownloadGpx} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Tải GPX Offline</span>
          </button>
          <button className="btn btn-danger" onClick={onOpenIncidentModal} style={{ gap: 8, display: 'inline-flex', alignItems: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>Báo cáo nguy hiểm</span>
          </button>
        </div>
      </div>

      {/* ⚠️ Tactical Emergency Safety Incident Banner (Prominently displayed when an incident exists) */}
      {matchingIncident && (() => {
        const typeMeta = getIncidentTypeMeta(matchingIncident.type);
        const sevMeta = getIncidentSeverityMeta(matchingIncident.severity);
        const IncidentIcon = typeMeta.Icon;
        const confirmationsCount = matchingIncident.confirmations || 1;
        const reporterDisplayName = matchingIncident.reporterName || matchingIncident.userName || matchingIncident.reportedBy || 'Trekker thực địa';
        const reporterDisplayRole = matchingIncident.reporterRole || 'Thành viên cộng đồng TrekMap';
        const locationDisplayName = matchingIncident.locationNote || `${trail.name} (${trail.province})`;
        const elevationDisplay = matchingIncident.elevationM || trail.maxAltitudeM;
        const hotlinePhone = trail.rescueContact?.phone || '02343.871.330';
        const rangerUnit = trail.rescueContact?.rangerContact || `Trạm Kiểm Lâm ${trail.province}`;

        return (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, var(--color-bg-card) 65%, rgba(15, 23, 42, 0.98) 100%)',
              border: '1.5px solid rgba(239, 68, 68, 0.65)',
              borderRadius: 20,
              padding: '22px 24px',
              marginBottom: 26,
              boxShadow: '0 0 35px rgba(239, 68, 68, 0.2), 0 16px 40px rgba(0, 0, 0, 0.55)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              animation: 'fadeIn 0.3s ease',
            }}
          >
            {/* 1. Header Bar: Title, Badges & Quick Action Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'rgba(239, 68, 68, 0.22)',
                    border: '1.5px solid #ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    boxShadow: '0 0 16px rgba(239, 68, 68, 0.45)',
                    flexShrink: 0,
                  }}
                >
                  <IconShieldAlert size={24} color="#ef4444" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ef4444', letterSpacing: '0.01em' }}>
                      CẢNH BÁO AN TOÀN THỰC ĐỊA TRÊN CUNG ĐƯỜNG
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: sevMeta.bg,
                        color: sevMeta.textColor,
                        padding: '3px 10px',
                        borderRadius: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        boxShadow: `0 0 10px ${sevMeta.bg}80`,
                      }}
                    >
                      {sevMeta.levelCode}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.5)',
                        color: '#34d399',
                        padding: '2px 8px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <IconCheckCircle size={12} color="#34d399" />
                      <span>{confirmationsCount} Xác thực hiện trường</span>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', marginTop: 3 }}>
                    Hồ sơ cảnh báo khẩn cấp dành cho người leo núi & đơn vị cứu hộ thực địa • {sevMeta.directive}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <a
                  href={`tel:${hotlinePhone}`}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    color: '#fca5a5',
                    borderRadius: 10,
                    padding: '7px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <IconPhone size={14} color="#fca5a5" />
                  <span>Gọi cứu nạn: {hotlinePhone}</span>
                </a>

                <button
                  type="button"
                  onClick={onOpenIncidentModal}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: 10,
                    padding: '7px 16px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <IconAlertTriangle size={14} color="#ffffff" />
                  <span>Cập nhật tình hình mới</span>
                </button>
              </div>
            </div>

            {/* 2. 4 Telemetry Bento Metric Tiles */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: 12,
              }}
            >
              {/* Tile 1: Incident Category */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${typeMeta.color}22`,
                    border: `1px solid ${typeMeta.color}66`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: typeMeta.color,
                    flexShrink: 0,
                  }}
                >
                  <IncidentIcon size={18} color={typeMeta.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Phân loại hiểm họa
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2, lineHeight: 1.35 }}>
                    {typeMeta.label}
                  </div>
                </div>
              </div>

              {/* Tile 2: Location & Elevation */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(56, 189, 248, 0.18)',
                    border: '1px solid rgba(56, 189, 248, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                    flexShrink: 0,
                  }}
                >
                  <IconMapPin size={18} color="#38bdf8" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Khu vực & Cao độ
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2, lineHeight: 1.35 }}>
                    {locationDisplayName}
                  </div>
                  {elevationDisplay && (
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      Cao độ: ~{elevationDisplay}m
                    </div>
                  )}
                </div>
              </div>

              {/* Tile 3: Reporter Credentials */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(168, 85, 247, 0.18)',
                    border: '1px solid rgba(168, 85, 247, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a855f7',
                    flexShrink: 0,
                  }}
                >
                  <IconUsers size={18} color="#a855f7" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Nguồn báo cáo
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2, lineHeight: 1.35 }}>
                    {reporterDisplayName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#a855f7' }}>
                    {reporterDisplayRole}
                  </div>
                </div>
              </div>

              {/* Tile 4: Recorded Time & State */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'rgba(245, 158, 11, 0.18)',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b',
                    flexShrink: 0,
                  }}
                >
                  <IconClock size={18} color="#f59e0b" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Thời gian & Hiệu lực
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: 2 }}>
                    {matchingIncident.reportedAt || 'Gần đây'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>
                    Đang có hiệu lực khẩn
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Detailed Incident Description Box */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.45)',
                borderLeft: '4px solid #ef4444',
                borderRadius: '0 12px 12px 0',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#fca5a5', fontWeight: 800, letterSpacing: '0.04em' }}>
                Diễn biến chi tiết tại hiện trường:
              </div>
              <div style={{ fontSize: '0.94rem', color: '#fef2f2', lineHeight: 1.65, fontWeight: 500 }}>
                {matchingIncident.description}
              </div>
            </div>

            {/* 4. Field Evidence Photos (if any) */}
            {matchingIncident.images && matchingIncident.images.length > 0 && (
              <div>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-text-dim)', fontWeight: 800, letterSpacing: '0.04em', marginBottom: 8 }}>
                  Ảnh bằng chứng ghi nhận tại hiện trường ({matchingIncident.images.length} ảnh):
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {matchingIncident.images.map((img: string, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedEvidencePhoto(img)}
                      style={{
                        position: 'relative',
                        width: 90,
                        height: 65,
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '1.5px solid rgba(239, 68, 68, 0.4)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <img src={img} alt={`Hiện trường ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Actionable Field Safety Directives (Chuẩn Kiểm Lâm & Cứu Hộ) */}
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px dashed rgba(239, 68, 68, 0.35)',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fca5a5', fontWeight: 800, fontSize: '0.78rem' }}>
                <IconAlertTriangle size={15} color="#fca5a5" />
                <span>CHỈ DẪN AN TOÀN BẮT BUỘC DÀNH CHO TREKKER TRÊN TUYẾN</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 10,
                  fontSize: '0.78rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.5,
                }}
              >
                <div>
                  <strong style={{ color: 'var(--color-text-main)' }}>1. Vượt suối & sạt lở:</strong> Tuyệt đối không mạo hiểm vượt suối khi nước cao ngang đùi hoặc chảy đục xiết. Tránh xa các vách taluy đất yếu.
                </div>
                <div>
                  <strong style={{ color: 'var(--color-text-main)' }}>2. Tracklog & Đội hình:</strong> Bám sát đường mòn GPX đã tải Offline, luôn đi theo đoàn tối thiểu 3 người, không tự ý tách nhóm mở lối tắt.
                </div>
                <div>
                  <strong style={{ color: 'var(--color-text-main)' }}>3. Liên lạc & Cứu hộ:</strong> Tiết kiệm pin thiết bị, giữ ấm cơ thể và chuẩn bị còi cứu sinh SOS khi thời tiết xấu hoặc mất định hướng.
                </div>
              </div>
            </div>

            {/* 6. Emergency Contacts & National Hotline Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                paddingTop: 8,
                borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '0.8rem',
                color: 'var(--color-text-dim)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#fca5a5', fontWeight: 800 }}>
                  <IconPhone size={14} color="#fca5a5" />
                  <span>Cứu Nạn Quốc Gia: <strong>114 / 115 (24/7)</strong></span>
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {rangerUnit}: <strong style={{ color: 'var(--color-text-main)' }}>{hotlinePhone}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.74rem', color: '#94a3b8' }}>
                <span>Mã sự cố: <code style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4 }}>TM-{matchingIncident.id ? matchingIncident.id.slice(-6).toUpperCase() : 'ALERT'}</code></span>
                <span>Cập nhật: {matchingIncident.reportedAt || 'Gần đây'}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Hero Header Section */}
      <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', height: 380, marginBottom: 24 }}>
        <OptimizedImage
          src={trail.coverImage}
          alt={trail.name}
          targetWidth={1280}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(5, 12, 20, 0.95) 0%, rgba(5, 12, 20, 0.3) 60%, transparent 100%)',
        }} />

        <div style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span className="badge badge-success">{trail.region}</span>
              <span className="badge badge-stream">{trail.province}</span>
              {trail.permitRequired && (
                <span className="badge badge-danger">Yêu cầu Giấy phép Kiểm Lâm</span>
              )}
            </div>

            <h1 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.2 }}>
              {trail.name}
            </h1>
            {trail.altNames && trail.altNames.length > 0 && (
              <div style={{ color: 'var(--color-text-dim)', fontSize: '0.95rem', marginTop: 4 }}>
                Tên gọi khác: {trail.altNames.join(', ')}
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--color-bg-glass)',
            backdropFilter: 'blur(12px)',
            padding: '12px 20px',
            borderRadius: 16,
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Đánh giá cộng đồng</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-sun)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {reviewsList.length > 0 ? (
                  <>
                    <IconStar size={18} color="var(--color-sun)" fill="var(--color-sun)" /> {(reviewsList.reduce((acc, r) => acc + (r.rating || 5), 0) / reviewsList.length).toFixed(1)}{' '}
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', fontWeight: 500 }}>
                      ({reviewsList.length} bài)
                    </span>
                  </>
                ) : (trail.reviewCount && trail.reviewCount > 0 && trail.rating && trail.rating > 0 && trail.reviewCount !== 1) ? (
                  <>
                    <IconStar size={18} color="var(--color-sun)" fill="var(--color-sun)" /> {Number(trail.rating).toFixed(1)}{' '}
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', fontWeight: 500 }}>
                      ({trail.reviewCount} bài)
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Chưa có đánh giá</span>
                )}
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: 16 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Mức độ khó</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: trail.difficultyLevel >= 4 ? 'var(--color-error)' : 'var(--color-primary)' }}>
                Cấp {trail.difficultyLevel}/5
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* P2-1: Enhanced Stats Bar */}
      <div className="card" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 16,
        marginBottom: 28,
        textAlign: 'center',
      }}>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Chiều dài</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)' }}>{trail.distanceKm} km</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Vừa sức 2 ngày</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Độ cao tích lũy</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-sky)' }}>+{trail.elevationGainM} m</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Độ dốc ~{steepnessPercent}%</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Cao độ đỉnh</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-stream)' }}>{trail.maxAltitudeM} m</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-sun)' }}>{isOver3000m ? 'Gấp 3x Bà Nà' : 'Top Đỉnh Mây'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Thời gian trung bình</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-sun)' }}>{trail.durationHoursNote}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{trail.durationDays} ngày {trail.durationDays - 1} đêm</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.78rem' }}>Đặc tính tiện ích</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            {trail.hasCampsite && <span className="badge badge-stream" title="Có bãi cắm trại">Camp</span>}
            {trail.hasWaterSource && <span className="badge badge-cloud" title="Có nguồn nước">Nước</span>}
            {trail.kidFriendly && <span className="badge badge-success" title="Phù hợp trẻ em">Kid</span>}
          </div>
        </div>
      </div>

      {/* 7 Tab Navigation Header */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 24,
        overflowX: 'auto',
      }}>
        {[
          { id: 'overview', label: 'Tổng quan', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          ) },
          { id: 'map', label: 'Bản đồ GPX 3D', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          ) },
          { id: 'weather', label: 'Thời tiết 7 ngày & Săn mây' },
          { id: 'checklist', label: 'Danh mục đồ đạc', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          ) },
          { id: 'itinerary', label: 'Lịch trình & Chia sẻ Zalo' },
          { id: 'guides', label: 'Hướng dẫn viên & Porter', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ) },
          { id: 'reviews', label: `Nhận xét (${reviewsList.length})`, icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ) },
          { id: 'conditions', label: 'Tình trạng thực địa (7 ngày)', icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '12px 18px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sliding Tab Contents */}
      <div key={activeTab} className="tab-content-slide">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28 }}>
          <div>
            {/* SVG Elevation Profile Graph */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 12 }}>
                Đồ Thị Trắc Diện Cao Độ (Elevation Profile)
              </h3>
              <ElevationProfileSVG
                gpxTrack={trail.gpxTrack}
                elevationGainM={trail.elevationGainM}
                maxAltitudeM={trail.maxAltitudeM}
              />
            </div>

            {/* Description */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 12 }}>
                Giới thiệu cung đường
              </h3>
              <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                {trail.description}
              </p>
            </div>

            {/* P2-4: Transportation Guide Stepper */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Hướng Dẫn Di Chuyển Đến Điểm Xuất Phát
                </h3>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${trail.startLat},${trail.startLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Mở Google Maps chỉ đường
                </a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {transportSteps.map((stepText: string, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ background: 'var(--color-primary)', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {idx + 1}
                    </span>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.5, paddingTop: 2 }}>
                      {stepText.trim()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* P2-3: Best Season Calendar */}
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 6 }}>
                Lịch Mùa Trekking Trong Năm
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)', marginBottom: 16 }}>
                Xanh lá = Mùa đẹp nhất • Viền Vàng nhấp nháy = Tháng hiện tại (T{currentMonth}) • Đỏ = Tránh đi do mưa lũ
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, textAlign: 'center' }}>
                {months.map((m) => {
                  const isBest = trail.bestMonths.includes(m);
                  const isAvoid = trail.avoidMonths.includes(m);
                  const isCurrent = m === currentMonth;

                  let bg = '#142f3b';
                  let color = '#94a3b8';
                  let tooltip = `Tháng ${m}: Thời tiết bình thường`;

                  if (isBest) {
                    bg = '#059669';
                    color = '#fff';
                    tooltip = `Tháng ${m}: Mùa vàng lý tưởng, nắng đẹp, ít mưa`;
                  }
                  if (isAvoid) {
                    bg = '#dc2626';
                    color = '#fff';
                    tooltip = `Tháng ${m}: Mưa lớn, nguy cơ sạt lở & trơn trượt`;
                  }

                  return (
                    <div
                      key={m}
                      title={tooltip}
                      style={{
                        background: bg,
                        color,
                        padding: '10px 2px',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        border: isCurrent ? '2px solid var(--color-sun)' : '1px solid transparent',
                        boxShadow: isCurrent ? '0 0 10px rgba(250, 204, 21, 0.6)' : 'none',
                        cursor: 'help',
                      }}
                    >
                      <div>T{m}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div>
            {/* P2-5: Permit & Ranger Note Alert */}
            <div
              className="card"
              style={{
                border: `1px solid ${trail.permitRequired ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                marginBottom: 20,
              }}
            >
              <h4
                style={{
                  color: trail.permitRequired ? 'var(--color-error)' : 'var(--color-primary)',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {trail.permitRequired ? 'Yêu cầu Giấy phép VQG' : 'Tự do trekking'}
              </h4>

              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
                {trail.permitRequired
                  ? trail.permitInfo || 'Cần đăng ký danh sách thông tin đoàn và nộp phí bảo tồn với Trạm Kiểm Lâm trước khi trekking.'
                  : 'Cung đường mở tự do, không yêu cầu giấy phép xin trước.'}
              </p>

              {trail.permitRequired && (
                <div style={{ background: 'var(--color-bg-main)', padding: 10, borderRadius: 8, fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>- Đăng ký CCCD/CMND các thành viên</div>
                  <div>- Nộp phí vé tham quan Vườn Quốc Gia</div>
                  <div>- Bắt buộc có Porter/HDV địa phương dẫn đường</div>
                </div>
              )}
            </div>

            {/* Local Rescue & Ranger Contact */}
            <div className="card" style={{ border: '1px solid rgba(239, 68, 68, 0.4)' }}>
              <h4 style={{ color: 'var(--color-error)', fontSize: '1.05rem', fontWeight: 700, marginBottom: 12 }}>
                Hotline Cứu hộ địa phương
              </h4>
              <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem' }}>Đội cứu hộ khu vực:</div>
                  <strong style={{ color: 'var(--color-text-main)' }}>{trail.rescueContact?.name || 'Cứu hộ 114'}</strong>
                  <div>
                    <a href={`tel:${trail.rescueContact?.phone || '114'}`} style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 }}>
                      SĐT: {trail.rescueContact?.phone || '114'}
                    </a>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
                  <div style={{ color: 'var(--color-text-dim)', fontSize: '0.75rem' }}>Trạm kiểm lâm:</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>{trail.rescueContact?.rangerContact || 'Trạm Kiểm Lâm Cửa Rừng'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MAP & LIVE GPS */}
      {activeTab === 'map' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700 }}>
              Bản đồ GPS Tuyến đường & Live GPS Tracking
            </h3>
          </div>

          <MapView trails={[trail]} selectedTrail={trail} incidents={incidents} height="550px" />

          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', marginBottom: 12 }}>Danh sách điểm mốc (Waypoints)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {trail.waypoints?.map((wp) => (
                <div key={wp.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <strong style={{ color: 'var(--color-primary)', fontSize: '0.95rem' }}>{wp.name}</strong>
                    <span className="badge badge-cloud">{wp.type}</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{wp.description}</p>
                  {wp.elevationM && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: 6 }}>
                      Cao độ: {wp.elevationM}m
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: WEATHER & CLOUD HUNTING */}
      {activeTab === 'weather' && <WeatherTab trail={trail} />}

      {/* TAB 4: GEAR CHECKLIST & BALO CALCULATOR */}
      {activeTab === 'checklist' && <GearChecklistTab trail={trail} />}

      {/* TAB 5: EXPEDITION TIMELINE & SHARE */}
      {activeTab === 'itinerary' && <ItineraryTab trail={trail} />}

      {/* TAB 6: GUIDES & PORTERS */}
      {activeTab === 'guides' && (
        <div>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 16 }}>
            Hướng dẫn viên & Porter địa phương uy tín
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {(guidesList.length > 0 ? guidesList : trail.guides || []).map((guide) => (
              <div key={guide.id || guide._id} className="card" style={{ border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--color-text-main)', fontWeight: 700 }}>{guide.name}</h4>
                  {guide.verified ? (
                    <span className="badge badge-success" style={{ background: 'var(--color-primary)', color: '#ffffff', fontSize: '0.75rem', padding: '3px 10px', borderRadius: 12 }}>
                      Đã Xác Minh
                    </span>
                  ) : (
                    <span className="badge badge-cloud" style={{ fontSize: '0.75rem' }}>Porter Địa Phương</span>
                  )}
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  Khu vực phụ trách: {guide.region} • Đánh giá: {guide.rating || 5.0}/5
                </div>

                <div style={{ background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', padding: 10, borderRadius: 8, fontSize: '0.8rem', color: 'var(--color-primary)', marginBottom: 16, fontWeight: 600 }}>
                  Chi phí / Giá dịch vụ: {guide.priceNote || '500,000đ - 700,000đ / ngày'}
                </div>

                <a
                  href={`tel:${guide.phone || '0988888888'}`}
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center', borderRadius: 8, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <IconPhone size={14} color="var(--color-primary)" />
                  Liên hệ trực tiếp
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: TRAIL CONDITIONS (REAL-TIME) */}
      {activeTab === 'conditions' && (
        <div style={{ marginTop: 24 }}>
          <TrailConditionSection trailId={trail.id} />
        </div>
      )}

      {/* TAB 7: COMMUNITY REVIEWS */}
      {activeTab === 'reviews' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 28 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 16 }}>
              Cộng đồng Đánh giá ({reviewsList.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {reviewsList.map((rev) => (
                <div key={rev.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {(() => {
                        const isSelfReview = Boolean(
                          currentUser && (
                            (rev.userId && currentUser.id && String(rev.userId) === String(currentUser.id)) ||
                            (currentUser.fullName && rev.userName.toLowerCase().includes(currentUser.fullName.toLowerCase()))
                          )
                        );
                        const effectiveRevAvatar = (isSelfReview && (currentUser?.avatarUrl || currentUser?.avatar))
                          ? (currentUser.avatarUrl || currentUser.avatar)
                          : (rev.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80');

                        return (
                          <img
                            src={effectiveRevAvatar}
                            alt={rev.userName}
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                          />
                        );
                      })()}
                      <div>
                        <strong style={{ color: 'var(--color-text-main)', fontSize: '0.95rem' }}>{rev.userName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>Ngày đi: {rev.tripDate}</div>
                      </div>
                    </div>

                    <div style={{ color: 'var(--color-sun)', fontWeight: 700, fontSize: '0.9rem' }}>
                      Đánh giá: {rev.rating}/5
                    </div>
                  </div>

                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: 10 }}>
                    {rev.content}
                  </p>

                  {rev.safetyNote && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.12)', borderLeft: '4px solid var(--color-error)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px 14px', fontSize: '0.85rem', color: 'var(--color-text-main)', borderRadius: 8, marginTop: 8 }}>
                      <strong style={{ color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <IconAlertTriangle size={15} color="var(--color-error)" />
                        CẢNH BÁO AN TOÀN TỪ TREKKER:
                      </strong>
                      {rev.safetyNote}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ height: 'fit-content' }}>
            <h4 style={{ fontSize: '1.1rem', color: 'var(--color-text-main)', fontWeight: 700, marginBottom: 14 }}>
              Gửi đánh giá chuyến đi
            </h4>

            <form onSubmit={handleReviewSubmit}>
              <div className="form-group">
                <label className="form-label">Đánh giá chung (1 - 5 sao)</label>
                <select className="form-select" value={newRating} onChange={(e) => setNewRating(Number(e.target.value))}>
                  <option value={5}>5 sao - Tuyệt vời</option>
                  <option value={4}>4 sao - Rất tốt</option>
                  <option value={3}>3 sao - Trung bình</option>
                  <option value={2}>2 sao - Khó</option>
                  <option value={1}>1 sao - Nguy hiểm</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Đánh giá độ khó thực tế (1 - 5)</label>
                <select className="form-select" value={newDiffRating} onChange={(e) => setNewDiffRating(Number(e.target.value))}>
                  <option value={1}>1/5 - Rất dễ</option>
                  <option value={2}>2/5 - Dễ</option>
                  <option value={3}>3/5 - Trung bình</option>
                  <option value={4}>4/5 - Khó</option>
                  <option value={5}>5/5 - Cực khó</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Cảm nhận chi tiết chuyến đi</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Chia sẻ về tình trạng đường xá, cảnh đẹp, lán nghỉ..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Cảnh báo an toàn (nếu có)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: Đoạn qua suối trơn, trạm 2800m hết nước..."
                  value={newSafetyNote}
                  onChange={(e) => setNewSafetyNote(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Gửi đánh giá cho cộng đồng
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Evidence Photo Preview Lightbox */}
      {selectedEvidencePhoto && (
        <div
          onClick={() => setSelectedEvidencePhoto(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '85vh',
              background: 'var(--color-bg-card)',
              borderRadius: 16,
              overflow: 'hidden',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            }}
          >
            <button
              onClick={() => setSelectedEvidencePhoto(null)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 2,
              }}
            >
              <IconX size={16} />
            </button>
            <img
              src={selectedEvidencePhoto}
              alt="Hiện trường sự cố"
              style={{
                width: '100%',
                maxHeight: '85vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
