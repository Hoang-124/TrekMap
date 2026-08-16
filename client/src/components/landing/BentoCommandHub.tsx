import React, { useState, useEffect, useRef } from 'react';
import type { Trail } from '../../types.js';
import {
  IconRadio,
  IconBird,
  IconWind,
  IconDroplet,
  IconFlame,
  IconRadar,
  IconAlertTriangle,
  IconBackpack,
  IconSatellite,
  IconHeartHandshake,
} from '../common/SvgIcons.js';

interface BentoCommandHubProps {
  incidents?: any[];
  trails: Trail[];
  onOpenIncidentModal: () => void;
  onNavigateToForum?: () => void;
  onExploreMap?: () => void;
  onSelectTrail?: (trail: Trail) => void;
}

interface AudioTrack {
  id: string;
  name: string;
  location: string;
  freq: string;
  type: 'rain' | 'wind' | 'birds' | 'campfire';
  isLiveStream: boolean;
  src: string;
  fallbackSrc?: string;
  IconComponent: React.ComponentType<{ size?: number; color?: string; className?: string }>;
}

const AMBIENT_CHANNELS: AudioTrack[] = [
  {
    id: '1',
    name: 'Trạm Quan Trắc Hoàng Liên (Live 24/7)',
    location: 'Trạm Tôn (2.200m)',
    freq: '144.100 MHz',
    type: 'rain',
    isLiveStream: true,
    src: 'https://nature-rex.radioca.st/stream',
    fallbackSrc: '/audio/rain.mp3',
    IconComponent: IconDroplet,
  },
  {
    id: '2',
    name: 'Thung Lũng Sa Pa - Chim Rừng & Suối',
    location: 'Sa Pa Valley',
    freq: '144.350 MHz',
    type: 'birds',
    isLiveStream: true,
    src: 'https://a1.radio.co/s5c5da6a36/listen',
    fallbackSrc: '/audio/birds.mp3',
    IconComponent: IconBird,
  },
  {
    id: '3',
    name: 'Trạm Khí Tượng Đỉnh Núi (Live 24/7)',
    location: 'Đỉnh Tà Xùa (2.875m)',
    freq: '144.800 MHz',
    type: 'wind',
    isLiveStream: true,
    src: 'https://streams.radio.co/s0aa1e6f4a/listen',
    fallbackSrc: '/audio/wind.mp3',
    IconComponent: IconWind,
  },
  {
    id: '4',
    name: 'Lửa Trại Basecamp Lảo Thẩn',
    location: 'Điểm Hạ Trại (2.500m)',
    freq: '145.000 MHz',
    type: 'campfire',
    isLiveStream: false,
    src: '/audio/campfire.mp3',
    IconComponent: IconFlame,
  },
];

export const BentoCommandHub: React.FC<BentoCommandHubProps> = ({
  incidents: propIncidents,
  trails,
  onOpenIncidentModal,
  onNavigateToForum,
  onExploreMap,
}) => {
  // --- 1. Basecamp Radio State & Live Streaming Stream Player ---
  const [activeTrack, setActiveTrack] = useState<AudioTrack>(AMBIENT_CHANNELS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.6);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startTrack = (track: AudioTrack) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(track.src);
    audio.loop = true;
    audio.volume = volume;
    audio.crossOrigin = 'anonymous';

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch((err) => {
        console.warn('Live stream connection issue, failing over to high-bitrate recording:', err);
        if (track.fallbackSrc) {
          const fallbackAudio = new Audio(track.fallbackSrc);
          fallbackAudio.loop = true;
          fallbackAudio.volume = volume;
          fallbackAudio
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
          audioRef.current = fallbackAudio;
        } else {
          setIsPlaying(false);
        }
      });
    audioRef.current = audio;
  };

  const stopTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const togglePlay = (track: AudioTrack) => {
    if (isPlaying && activeTrack.id === track.id) {
      stopTrack();
    } else {
      setActiveTrack(track);
      startTrack(track);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Clean up audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // --- 2. Live Safety Radar Incidents Data ---
  const [incidents, setIncidents] = useState<any[]>(propIncidents || []);
  useEffect(() => {
    if (propIncidents && propIncidents.length > 0) {
      setIncidents(propIncidents.slice(0, 3));
      return;
    }
    const fetchIncidents = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/incidents');
        const data = await res.json();
        if (data.success && data.data) {
          setIncidents(data.data.slice(0, 3));
        }
      } catch (err) {
        // Fallback local alerts
        setIncidents([
          { _id: '1', title: 'Sương mù dày đặc Tà Xùa', location: 'Sống Lưng Khủng Long', severity: 'medium', status: 'verified', createdAt: new Date().toISOString() },
          { _id: '2', title: 'Đoạn suối Pu Ta Leng nước dâng nhẹ', location: 'Km 6 rừng trúc', severity: 'low', status: 'resolved', createdAt: new Date().toISOString() },
        ]);
      }
    };
    fetchIncidents();
  }, [propIncidents]);

  // --- 3. Certified Mountain Porters Data ---
  const [porters, setPorters] = useState<any[]>([]);
  useEffect(() => {
    const fetchPorters = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/guides');
        const data = await res.json();
        if (data.success && data.data) {
          setPorters(data.data.slice(0, 3));
        }
      } catch (err) {
        // Fallback default reputable porter
        setPorters([
          { _id: '1', name: 'A Lềnh', phone: '0984 123 456', region: 'Fansipan & Bạch Mộc', rating: 5.0, verified: true, tripsCount: 142 },
          { _id: '2', name: 'Sùng A Tủa', phone: '0978 654 321', region: 'Tà Xùa & Lảo Thẩn', rating: 4.9, verified: true, tripsCount: 98 },
        ]);
      }
    };
    fetchPorters();
  }, []);

  return (
    <section
      style={{
        padding: '50px 0',
        maxWidth: 1280,
        margin: '0 auto',
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 14px',
            borderRadius: 20,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 800,
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 12,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <IconRadio size={16} color="var(--color-primary)" />
          Hệ Sinh Thái Thám Hiểm
        </div>

        <h2
          style={{
            fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)',
            fontWeight: 900,
            color: 'var(--color-text-main)',
            marginBottom: 10,
          }}
        >
          Trạm Chỉ Huy & Vô Tuyến Basecamp
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', maxWidth: 650, margin: '0 auto' }}>
          Âm thanh thiên nhiên thư giãn, mạng lưới radar cảnh báo an toàn thời gian thực và kết nối porter bản địa.
        </p>
      </div>

      {/* 4-Bento Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
        }}
      >
        {/* CARD 1: Basecamp Ambient Radio */}
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: 24,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    background: 'rgba(5, 150, 105, 0.12)',
                    color: 'var(--color-primary)',
                    padding: 8,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconRadio size={18} color="var(--color-primary)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    Basecamp Radio 24/7
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700 }}>
                      {isPlaying ? '● Đang Phát Sóng Trực Tiếp' : '○ Chế Độ Chờ'}
                    </span>
                    {isPlaying && (
                      <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
                        <span className="audio-bar-1" style={{ width: 2.5, background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span className="audio-bar-2" style={{ width: 2.5, background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span className="audio-bar-3" style={{ width: 2.5, background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span className="audio-bar-4" style={{ width: 2.5, background: 'var(--color-primary)', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'monospace',
                    color: 'var(--color-primary)',
                    background: 'rgba(5, 150, 105, 0.12)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--color-border-glow)',
                    fontWeight: 700,
                  }}
                >
                  VHF {activeTrack.freq}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)' }}>
                  📶 Sóng: 98% (HQ Stereo)
                </span>
              </div>
            </div>

            {/* Radio Station Selector Channels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {AMBIENT_CHANNELS.map((channel) => {
                const isCurrent = activeTrack.id === channel.id;
                const ChannelIcon = channel.IconComponent;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => togglePlay(channel)}
                    className="interactive-click ripple-fx"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: isCurrent && isPlaying ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: isCurrent && isPlaying ? 'rgba(5, 150, 105, 0.12)' : 'var(--color-bg-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: isCurrent && isPlaying ? '0 0 16px rgba(5, 150, 105, 0.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          background: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-bg-card)',
                          color: isCurrent && isPlaying ? '#ffffff' : 'var(--color-text-dim)',
                          padding: 6,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <ChannelIcon size={16} color={isCurrent && isPlaying ? '#ffffff' : 'var(--color-primary)'} />
                      </span>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                          {channel.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                          {channel.location} • {channel.freq}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        background: isCurrent && isPlaying ? 'rgba(5, 150, 105, 0.15)' : 'transparent',
                        padding: '4px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {isCurrent && isPlaying ? 'Tạm dừng ⏸' : 'Nghe Trực Tiếp ▶'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Volume Control Bar */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 14,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', fontWeight: 600 }}>
              Âm Lượng Trạm
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--color-primary)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, minWidth: 32, textAlign: 'right' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* CARD 2: Realtime Safety Radar & SOS Incident Status */}
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: 24,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--color-error)',
                    padding: 8,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconRadar size={18} color="var(--color-error)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    Radar Cảnh Báo An Toàn
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-error)', fontWeight: 700 }}>
                    Trực ban cứu hộ 24/7
                  </span>
                </div>
              </div>

              <span
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--color-error)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 12,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                {incidents.length} Cảnh Báo
              </span>
            </div>

            {/* List of Recent Incidents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {incidents.map((inc) => (
                <div
                  key={inc._id}
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                      {inc.title}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: inc.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                        color: inc.severity === 'high' ? 'var(--color-error)' : 'var(--color-earth)',
                      }}
                    >
                      {inc.severity === 'high' ? 'Khẩn Cấp' : 'Chú Ý'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Khu vực: {inc.location}</span>
                    <span>{new Date(inc.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenIncidentModal}
            className="btn btn-danger sonar-sos interactive-click ripple-fx"
            style={{
              width: '100%',
              borderRadius: 14,
              padding: '12px',
              fontSize: '0.82rem',
              fontWeight: 800,
            }}
          >
            <IconAlertTriangle size={15} color="#ffffff" />
            Báo Cáo Sự Cố Hoặc Yêu Cầu Cứu Hộ
          </button>
        </div>

        {/* CARD 3: Certified Mountain Porters & Local Guides */}
        <div
          className="card-hover-lift"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: 24,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    background: 'rgba(2, 132, 199, 0.12)',
                    color: 'var(--color-sky)',
                    padding: 8,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconBackpack size={18} color="var(--color-sky)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    Porter & Hướng Dẫn Bản Địa
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-sky)', fontWeight: 700 }}>
                    Xác minh danh tính 100%
                  </span>
                </div>
              </div>

              <IconHeartHandshake size={18} color="var(--color-sky)" />
            </div>

            {/* List of Recommended Porters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {porters.map((porter) => (
                <div
                  key={porter._id}
                  className="interactive-click"
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                        {porter.name}
                      </span>
                      {porter.verified && (
                        <span style={{ fontSize: '0.65rem', background: 'rgba(5, 150, 105, 0.2)', color: 'var(--color-primary)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                          Đã Xác Minh
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                      {porter.region} • {porter.rating || 5.0}/5 ★
                    </div>
                  </div>

                  <a
                    href={`tel:${porter.phone?.replace(/\s+/g, '')}`}
                    className="btn btn-outline interactive-click"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.72rem',
                      borderRadius: 10,
                      textDecoration: 'none',
                    }}
                  >
                    Gọi Điện
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', textAlign: 'center', lineHeight: 1.4 }}>
            Tất cả porter đều là người dân tộc bản địa am hiểu địa hình rừng núi sâu.
          </div>
        </div>

        {/* CARD 4: Interactive Topo 3D GIS & Elevation Profiles */}
        <div
          className="card-hover-lift"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: 24,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    background: 'rgba(234, 88, 12, 0.12)',
                    color: 'var(--color-earth)',
                    padding: 8,
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconSatellite size={18} color="var(--color-earth)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                    Bản Đồ 3D GIS & Độ Dốc
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-earth)', fontWeight: 700 }}>
                    Hỗ trợ tải GPX Offline
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  color: 'var(--color-earth)',
                  background: 'var(--color-bg-main)',
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                }}
              >
                {trails.length} Tracks
              </span>
            </div>

            <div
              style={{
                background: 'var(--color-bg-main)',
                border: '1px solid var(--color-border)',
                borderRadius: 14,
                padding: '14px',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                Đồ thị trắc diện cao độ từng mét, cảnh báo vách đứng dốc &gt;45° và gợi ý bãi hạ trại nguồn nước.
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
                <span>🛰️ Vệ tinh ESRI</span>
                <span>🗺️ OpenTopo</span>
                <span>📶 Tracklog GPS</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onExploreMap) onExploreMap();
              else if (onNavigateToForum) onNavigateToForum();
            }}
            className="btn btn-primary interactive-click ripple-fx"
            style={{
              width: '100%',
              borderRadius: 14,
              padding: '12px',
              fontSize: '0.82rem',
              fontWeight: 800,
            }}
          >
            Mở Khám Phá Toàn Diện →
          </button>
        </div>
      </div>
    </section>
  );
};
