import React, { useState, useEffect, useRef } from 'react';
import type { Trail, Incident, LocalGuide } from '../../types.js';
import { mockTrails } from '../../data/seedData.js';
import { VERIFIED_GUIDES_EXTENDED, VIETNAM_RANGER_STATIONS } from '../../data/vietnamDirectory.js';
import {
  IconRadio,
  IconBird,
  IconWind,
  IconDroplet,
  IconFlame,
  IconRadar,
  IconAlertTriangle,
  IconBackpack,
  IconPhone,
  IconMapPin,
  IconClock,
  IconShieldAlert,
  IconShieldCheck,
  IconTrees,
  IconCompass,
} from '../common/SvgIcons.js';

interface BentoCommandHubProps {
  incidents?: Incident[];
  trails: Trail[];
  onOpenIncidentModal: () => void;
  onNavigateToForum?: () => void;
  onExploreMap?: () => void;
  onSelectTrail?: (trail: Trail) => void;
  onShowToast?: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

interface AudioTrack {
  id: string;
  name: string;
  location: string;
  freq: string;
  type: 'rain' | 'wind' | 'birds' | 'campfire' | 'pine_wind' | 'waterfall';
  isLiveStream: boolean;
  IconComponent: React.ComponentType<{ size?: number; color?: string; className?: string }>;
}

const FALLBACK_OFFICIAL_GUIDES: LocalGuide[] = VERIFIED_GUIDES_EXTENDED.map((g) => ({
  id: g.slug,
  slug: g.slug,
  name: g.name,
  phone: g.phone,
  avatarUrl: g.avatarUrl,
  region: g.region,
  roleType: g.roleType,
  provinces: g.provinces,
  trailSlugs: g.trailSlugs,
  priceNote: g.priceNote,
  basePricePerDayVnd: g.basePricePerDayVnd,
  maxGroupSize: g.maxGroupSize,
  specialties: g.specialties,
  languages: g.languages,
  certifications: g.certifications,
  experienceYears: g.experienceYears,
  bio: g.bio,
  isActive: g.isActive,
  rating: g.rating,
  reviewCount: g.reviewCount,
  verified: g.verified,
}));

const AMBIENT_CHANNELS: AudioTrack[] = [
  {
    id: '1',
    name: 'Trạm Quan Trắc Hoàng Liên',
    location: 'Trạm Tôn (2.200m)',
    freq: '144.100 MHz',
    type: 'rain',
    isLiveStream: true,
    IconComponent: IconDroplet,
  },
  {
    id: '2',
    name: 'Thung Lũng Sa Pa - Chim Rừng & Suối',
    location: 'Sa Pa Valley',
    freq: '144.350 MHz',
    type: 'birds',
    isLiveStream: true,
    IconComponent: IconBird,
  },
  {
    id: '3',
    name: 'Trạm Khí Tượng Đỉnh Núi',
    location: 'Đỉnh Tà Xùa (2.865m)',
    freq: '144.800 MHz',
    type: 'wind',
    isLiveStream: true,
    IconComponent: IconWind,
  },
  {
    id: '4',
    name: 'Lửa Trại Basecamp Lảo Thẩn',
    location: 'Điểm Hạ Trại (2.500m)',
    freq: '145.000 MHz',
    type: 'campfire',
    isLiveStream: false,
    IconComponent: IconFlame,
  },
  {
    id: '5',
    name: 'Rừng Thông & Đồi Cỏ Tà Năng',
    location: 'Đồi Cỏ Ma Bó (1.100m)',
    freq: '145.250 MHz',
    type: 'pine_wind',
    isLiveStream: true,
    IconComponent: IconTrees,
  },
  {
    id: '6',
    name: 'Thác Nước Đại Ngàn K50 Kon Chư Răng',
    location: 'Vùng Lõi KBT (950m)',
    freq: '145.600 MHz',
    type: 'waterfall',
    isLiveStream: true,
    IconComponent: IconCompass,
  },
];

interface SoundEngine {
  stop: () => void;
  setVolume: (vol: number) => void;
}

function createOrganicPinkNoiseBuffer(ctx: AudioContext, durationSeconds = 24): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * durationSeconds);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

function playRealisticNatureAmbient(
  type: 'rain' | 'wind' | 'birds' | 'campfire' | 'pine_wind' | 'waterfall',
  volume: number
): SoundEngine {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return { stop: () => {}, setVolume: () => {} };
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(Math.max(0.01, volume * 0.28), ctx.currentTime + 0.08);
    masterGain.connect(ctx.destination);

    const pinkNoiseBuffer = createOrganicPinkNoiseBuffer(ctx, 24);
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = pinkNoiseBuffer;
    noiseNode.loop = true;

    const activeTimeouts: Array<ReturnType<typeof setTimeout>> = [];
    let isStopped = false;

    const safeTimeout = (fn: () => void, delay: number) => {
      if (isStopped) return;
      const tid = setTimeout(() => {
        if (!isStopped) fn();
      }, delay);
      activeTimeouts.push(tid);
      return tid;
    };

    if (type === 'rain') {
      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.setValueAtTime(950, ctx.currentTime);

      const highFilter = ctx.createBiquadFilter();
      highFilter.type = 'highpass';
      highFilter.frequency.setValueAtTime(2400, ctx.currentTime);
      const highGain = ctx.createGain();
      highGain.gain.setValueAtTime(0.22, ctx.currentTime);

      noiseNode.connect(lowFilter);
      lowFilter.connect(masterGain);

      noiseNode.connect(highFilter);
      highFilter.connect(highGain);
      highGain.connect(masterGain);
      noiseNode.start(0);

      const scheduleRainDrop = () => {
        if (isStopped || ctx.state === 'closed') return;
        try {
          const dropOsc = ctx.createOscillator();
          const dropGain = ctx.createGain();
          const freq = 1200 + Math.random() * 1800;
          dropOsc.type = 'sine';
          dropOsc.frequency.setValueAtTime(freq, ctx.currentTime);
          dropOsc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + 0.04);

          dropGain.gain.setValueAtTime(0, ctx.currentTime);
          dropGain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.05, ctx.currentTime + 0.005);
          dropGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);

          dropOsc.connect(dropGain);
          dropGain.connect(masterGain);
          dropOsc.start(ctx.currentTime);
          dropOsc.stop(ctx.currentTime + 0.05);
        } catch {
          // ignore
        }
        safeTimeout(scheduleRainDrop, 90 + Math.random() * 320);
      };
      scheduleRainDrop();
    } else if (type === 'birds') {
      const streamFilter = ctx.createBiquadFilter();
      streamFilter.type = 'bandpass';
      streamFilter.frequency.setValueAtTime(1050, ctx.currentTime);
      streamFilter.Q.setValueAtTime(1.1, ctx.currentTime);

      const streamLfo = ctx.createOscillator();
      const streamLfoGain = ctx.createGain();
      streamLfo.frequency.setValueAtTime(0.19, ctx.currentTime);
      streamLfoGain.gain.setValueAtTime(180, ctx.currentTime);
      streamLfo.connect(streamLfoGain);
      streamLfoGain.connect(streamFilter.frequency);
      streamLfo.start(0);

      noiseNode.connect(streamFilter);
      streamFilter.connect(masterGain);
      noiseNode.start(0);

      const scheduleBirdSong = () => {
        if (isStopped || ctx.state === 'closed') return;
        try {
          const pattern = Math.floor(Math.random() * 3);
          const baseFreq = 2600 + Math.random() * 800;

          if (pattern === 0) {
            for (let c = 0; c < 2; c++) {
              const chirpTime = ctx.currentTime + c * 0.12;
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(baseFreq + c * 200, chirpTime);
              osc.frequency.exponentialRampToValueAtTime(baseFreq + 600, chirpTime + 0.06);
              osc.frequency.exponentialRampToValueAtTime(baseFreq - 150, chirpTime + 0.1);

              gain.gain.setValueAtTime(0, chirpTime);
              gain.gain.linearRampToValueAtTime(0.13, chirpTime + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.001, chirpTime + 0.1);

              osc.connect(gain);
              gain.connect(masterGain);
              osc.start(chirpTime);
              osc.stop(chirpTime + 0.11);
            }
          } else if (pattern === 1) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq + 950, ctx.currentTime + 0.14);
            osc.frequency.exponentialRampToValueAtTime(baseFreq + 300, ctx.currentTime + 0.22);

            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
          } else {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq - 400, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(baseFreq + 100, ctx.currentTime + 0.18);

            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.23);
          }
        } catch {
          // ignore
        }

        safeTimeout(scheduleBirdSong, 2200 + Math.random() * 3300);
      };
      safeTimeout(scheduleBirdSong, 600);
    } else if (type === 'wind') {
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(320, ctx.currentTime);
      windFilter.Q.setValueAtTime(3.6, ctx.currentTime);

      const lfo1 = ctx.createOscillator();
      const lfoGain1 = ctx.createGain();
      lfo1.frequency.setValueAtTime(0.11, ctx.currentTime);
      lfoGain1.gain.setValueAtTime(140, ctx.currentTime);
      lfo1.connect(lfoGain1);
      lfoGain1.connect(windFilter.frequency);
      lfo1.start(0);

      const lfo2 = ctx.createOscillator();
      const lfoGain2 = ctx.createGain();
      lfo2.frequency.setValueAtTime(0.19, ctx.currentTime);
      lfoGain2.gain.setValueAtTime(90, ctx.currentTime);
      lfo2.connect(lfoGain2);
      lfoGain2.connect(windFilter.frequency);
      lfo2.start(0);

      noiseNode.connect(windFilter);
      windFilter.connect(masterGain);
      noiseNode.start(0);
    } else if (type === 'campfire') {
      const fireFilter = ctx.createBiquadFilter();
      fireFilter.type = 'lowpass';
      fireFilter.frequency.setValueAtTime(620, ctx.currentTime);

      noiseNode.connect(fireFilter);
      fireFilter.connect(masterGain);
      noiseNode.start(0);

      const scheduleWoodPop = () => {
        if (isStopped || ctx.state === 'closed') return;
        try {
          const burstCount = Math.random() < 0.25 ? 2 + Math.floor(Math.random() * 2) : 1;

          for (let b = 0; b < burstCount; b++) {
            const popTime = ctx.currentTime + b * (0.03 + Math.random() * 0.04);
            const popOsc = ctx.createOscillator();
            const popGain = ctx.createGain();
            popOsc.type = 'triangle';
            popOsc.frequency.setValueAtTime(140 + Math.random() * 480, popTime);

            const popVol = 0.12 + Math.random() * 0.22;
            popGain.gain.setValueAtTime(popVol, popTime);
            popGain.gain.exponentialRampToValueAtTime(0.0001, popTime + 0.035);

            popOsc.connect(popGain);
            popGain.connect(masterGain);
            popOsc.start(popTime);
            popOsc.stop(popTime + 0.045);
          }
        } catch {
          // ignore
        }

        safeTimeout(scheduleWoodPop, 120 + Math.random() * 630);
      };
      scheduleWoodPop();
    } else if (type === 'pine_wind') {
      const pineFilter = ctx.createBiquadFilter();
      pineFilter.type = 'bandpass';
      pineFilter.frequency.setValueAtTime(460, ctx.currentTime);
      pineFilter.Q.setValueAtTime(2.0, ctx.currentTime);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
      lfoGain.gain.setValueAtTime(110, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(pineFilter.frequency);
      lfo.start(0);

      noiseNode.connect(pineFilter);
      pineFilter.connect(masterGain);
      noiseNode.start(0);

      const scheduleCricketTrain = () => {
        if (isStopped || ctx.state === 'closed') return;
        try {
          const pulses = 3 + Math.floor(Math.random() * 3);
          const baseFreq = 4400 + Math.random() * 400;

          for (let p = 0; p < pulses; p++) {
            const chirpTime = ctx.currentTime + p * 0.09;
            const osc = ctx.createOscillator();
            const cGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, chirpTime);

            cGain.gain.setValueAtTime(0, chirpTime);
            cGain.gain.linearRampToValueAtTime(0.07, chirpTime + 0.015);
            cGain.gain.exponentialRampToValueAtTime(0.001, chirpTime + 0.075);

            osc.connect(cGain);
            cGain.connect(masterGain);
            osc.start(chirpTime);
            osc.stop(chirpTime + 0.08);
          }
        } catch {
          // ignore
        }

        safeTimeout(scheduleCricketTrain, 1200 + Math.random() * 2400);
      };
      scheduleCricketTrain();
    } else {
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(450, ctx.currentTime);

      const sprayFilter = ctx.createBiquadFilter();
      sprayFilter.type = 'bandpass';
      sprayFilter.frequency.setValueAtTime(1600, ctx.currentTime);
      sprayFilter.Q.setValueAtTime(1.4, ctx.currentTime);
      const sprayGain = ctx.createGain();
      sprayGain.gain.setValueAtTime(0.24, ctx.currentTime);

      noiseNode.connect(rumbleFilter);
      rumbleFilter.connect(masterGain);

      noiseNode.connect(sprayFilter);
      sprayFilter.connect(sprayGain);
      sprayGain.connect(masterGain);
      noiseNode.start(0);
    }

    let closeTimeoutId: ReturnType<typeof setTimeout> | null = null;
    return {
      stop: () => {
        if (isStopped) return;
        isStopped = true;
        activeTimeouts.forEach((tid) => clearTimeout(tid));
        if (closeTimeoutId) {
          clearTimeout(closeTimeoutId);
          closeTimeoutId = null;
        }
        try {
          if (ctx.state !== 'closed') {
            masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
            closeTimeoutId = setTimeout(() => {
              closeTimeoutId = null;
              try {
                noiseNode.stop();
              } catch {
                // ignore already stopped
              }
              try {
                if (ctx.state !== 'closed') {
                  void ctx.close();
                }
              } catch {
                // ignore
              }
            }, 120);
          }
        } catch {
          // ignore
        }
      },
      setVolume: (vol: number) => {
        try {
          masterGain.gain.setTargetAtTime(Math.max(0.01, vol * 0.28), ctx.currentTime, 0.05);
        } catch {
          // ignore
        }
      },
    };
  } catch {
    return { stop: () => {}, setVolume: () => {} };
  }
}

function extractPrimaryDialNumber(phone?: string): string {
  if (!phone) return '112';
  const primary = String(phone).split('/')[0] || '';
  return primary.replace(/[^0-9+]/g, '') || '112';
}

export const BentoCommandHub: React.FC<BentoCommandHubProps> = ({
  incidents: propIncidents,
  trails,
  onOpenIncidentModal,
  onNavigateToForum,
  onShowToast,
}) => {
  // 1. Basecamp Radio State
  const [activeTrack, setActiveTrack] = useState<AudioTrack>(AMBIENT_CHANNELS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.6);
  const soundEngineRef = useRef<SoundEngine | null>(null);

  const startTrack = (track: AudioTrack) => {
    stopTrack();
    setIsPlaying(true);
    setActiveTrack(track);
    const engine = playRealisticNatureAmbient(track.type, volume);
    soundEngineRef.current = engine;
  };

  const stopTrack = () => {
    if (soundEngineRef.current) {
      soundEngineRef.current.stop();
      soundEngineRef.current = null;
    }
    setIsPlaying(false);
  };

  const togglePlay = (track: AudioTrack) => {
    if (isPlaying && activeTrack.id === track.id) {
      stopTrack();
    } else {
      startTrack(track);
    }
  };

  useEffect(() => {
    if (soundEngineRef.current) {
      soundEngineRef.current.setVolume(volume);
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      stopTrack();
    };
  }, []);

  // 2. Live Safety Radar Incidents Data (Avoids duplicate /api/incidents fetch when parent passes incidents prop)
  const [fetchedIncidents, setFetchedIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    if (propIncidents !== undefined) return;
    const controller = new AbortController();
    fetch('/api/incidents', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!controller.signal.aborted && data?.success && Array.isArray(data.data)) {
          setFetchedIncidents(data.data.slice(0, 4));
        }
      })
      .catch(() => {
        // Keep empty honestly when offline or aborted
      });
    return () => {
      controller.abort();
    };
  }, [propIncidents]);

  const incidents = (propIncidents !== undefined ? propIncidents : fetchedIncidents)
    .filter((i) => !i.resolved)
    .slice(0, 4);

  // 3. Certified Mountain Porters & Official VQG Guiding Centers
  const [porters, setPorters] = useState<LocalGuide[]>(() => FALLBACK_OFFICIAL_GUIDES.slice(0, 4));
  const [totalGuidesCount, setTotalGuidesCount] = useState<number>(VERIFIED_GUIDES_EXTENDED.length);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/guides', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!controller.signal.aborted && data?.success && Array.isArray(data.data) && data.data.length > 0) {
          setPorters(data.data.slice(0, 4));
          setTotalGuidesCount(Math.max(data.data.length, VERIFIED_GUIDES_EXTENDED.length));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setPorters(FALLBACK_OFFICIAL_GUIDES.slice(0, 4));
      });
    return () => {
      controller.abort();
    };
  }, []);

  const activeTrailCount = Array.isArray(trails) && trails.length > 0 ? trails.length : mockTrails.length;

  return (
    <section
      style={{
        padding: '36px 0 40px 0',
        maxWidth: 1320,
        margin: '0 auto',
      }}
    >
      {/* Editorial Left-Aligned Section Header */}
      <div style={{ marginBottom: 22 }}>
        <div className="section-eyebrow">03 / Hỗ trợ thực địa</div>

        <h2
          className="font-editorial"
          style={{
            fontSize: 'clamp(1.75rem, 3.2vw, 2.55rem)',
            fontWeight: 500,
            color: 'var(--color-text-main)',
            margin: '0 0 6px 0',
            letterSpacing: '-0.025em',
            lineHeight: 1.12,
          }}
        >
          Âm thanh thiên nhiên,{' '}
          <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
            cảnh báo &amp; Porter bản địa
          </span>
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', maxWidth: 680, margin: 0 }}>
          Góc thư giãn âm thanh rừng núi, cập nhật cảnh báo thực địa trên {activeTrailCount} cung đường cùng danh bạ {VIETNAM_RANGER_STATIONS.length} trạm VQG/Kiểm lâm và {totalGuidesCount} đơn vị dẫn đường đã xác minh.
        </p>
      </div>

      {/* Seamless 1px Hairline Architectural 3-Panel Grid */}
      <div className="architectural-hairline-grid">
        {/* CARD 1: Basecamp Ambient Radio */}
        <div className="bento-command-card" style={{ borderRadius: 0, border: 'none', boxShadow: 'none', padding: 22 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                    color: 'var(--color-primary)',
                    padding: 9,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-border-glow)',
                  }}
                >
                  <IconRadio size={20} color="var(--color-primary)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                    Basecamp Radio
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: '0.73rem',
                        color: isPlaying ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        fontWeight: 700,
                      }}
                    >
                      <span
                        className={isPlaying ? 'radar-pulse-dot' : ''}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isPlaying ? 'var(--color-primary)' : 'var(--color-text-dim)',
                        }}
                      />
                      {isPlaying ? 'Đang Phát Âm Thanh' : 'Chế Độ Chờ'}
                    </span>
                    {isPlaying && (
                      <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
                        <span className="audio-bar-1" style={{ width: 2.5, background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span className="audio-bar-2" style={{ width: 2.5, background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span className="audio-bar-3" style={{ width: 2.5, background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span className="audio-bar-4" style={{ width: 2.5, background: 'var(--color-primary)', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {isPlaying && (
                  <button
                    type="button"
                    onClick={stopTrack}
                    aria-label="Tắt âm thanh Basecamp Radio"
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: 'var(--color-error-text, var(--color-error))',
                      background: 'color-mix(in srgb, var(--color-error) 12%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                      borderRadius: 4,
                      padding: '3px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    Tắt tiếng
                  </button>
                )}
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-family)',
                    color: 'var(--color-primary)',
                    background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border-glow)',
                    fontWeight: 800,
                  }}
                >
                  VHF {activeTrack.freq}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
              {AMBIENT_CHANNELS.map((channel) => {
                const isCurrent = activeTrack.id === channel.id;
                const ChannelIcon = channel.IconComponent;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => togglePlay(channel)}
                    className="interactive-click"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: 4,
                      border: isCurrent && isPlaying ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: isCurrent && isPlaying ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'var(--color-bg-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span
                        style={{
                          background: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-bg-card)',
                          color: isCurrent && isPlaying ? 'var(--color-on-primary)' : 'var(--color-text-dim)',
                          padding: 6,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <ChannelIcon size={14} color={isCurrent && isPlaying ? 'var(--color-on-primary)' : 'var(--color-primary)'} />
                      </span>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                          {channel.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                          {channel.location} · {channel.freq}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        background: isCurrent && isPlaying ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'transparent',
                        padding: '3px 8px',
                        borderRadius: 4,
                        border: isCurrent && isPlaying ? '1px solid var(--color-primary)' : '1px solid transparent',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {isCurrent && isPlaying ? (
                        <>
                          <span>Tạm Dừng</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                        </>
                      ) : (
                        <>
                          <span>Nghe</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Volume Control */}
          <div
            style={{
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '9px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <span style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Âm Lượng:
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              aria-label="Âm lượng trạm vô tuyến"
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{
                flex: 1,
                accentColor: 'var(--color-primary)',
                cursor: 'pointer',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 800, minWidth: 32, textAlign: 'right' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* CARD 2: Realtime Safety Radar & SOS Incident Status */}
        <div className="bento-command-card" style={{ borderRadius: 0, border: 'none', boxShadow: 'none', padding: 22 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    background: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
                    color: 'var(--color-error-text, var(--color-error))',
                    padding: 9,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid color-mix(in srgb, var(--color-error) 32%, transparent)',
                  }}
                >
                  <IconRadar size={20} color="var(--color-error-text, var(--color-error))" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                    Radar Cảnh Báo An Toàn
                  </h3>
                  <span style={{ fontSize: '0.73rem', color: 'var(--color-error-text, var(--color-error))', fontWeight: 700 }}>
                    Trực ban cứu hộ &amp; SOS 24/7
                  </span>
                </div>
              </div>

              <span
                style={{
                  background: 'color-mix(in srgb, var(--color-error) 14%, transparent)',
                  color: 'var(--color-error-text, var(--color-error))',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 4,
                  border: '1px solid color-mix(in srgb, var(--color-error) 32%, transparent)',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {incidents.length} Cảnh Báo
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {incidents.length === 0 ? (
                <div
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px dashed var(--color-border-strong)',
                    borderRadius: 4,
                    padding: '28px 16px',
                    textAlign: 'center',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <div style={{ display: 'inline-flex', marginBottom: 8 }}>
                    <IconShieldCheck size={26} color="var(--color-primary)" />
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    Chưa ghi nhận sự cố khẩn cấp đang mở
                  </div>
                  <div style={{ fontSize: '0.74rem', marginTop: 4 }}>
                    Các tuyến đường hiện chưa có cảnh báo nguy hiểm mới từ cộng đồng.
                  </div>
                </div>
              ) : (
                incidents.map((inc) => {
                  const incExt = inc as Incident & { _id?: string; title?: string; location?: string; createdAt?: string };
                  const title = inc.trailName || incExt.title || 'Cảnh Báo Cung Đường';
                  const location = inc.locationNote || incExt.location || inc.trailName || 'Vùng rừng núi';
                  const rawDate = inc.reportedAt || incExt.createdAt;
                  const dateStr = rawDate ? new Date(rawDate).toLocaleDateString('vi-VN') : 'Gần đây';
                  const isHigh = inc.severity === 'high' || inc.severity === 'critical';

                  return (
                    <div
                      key={inc.id || incExt._id}
                      style={{
                        background: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border)',
                        borderLeft: `3px solid ${isHigh ? 'var(--color-error)' : 'var(--color-earth)'}`,
                        borderRadius: 4,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 6 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                          {title}
                        </span>
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 3,
                            background: isHigh
                              ? 'color-mix(in srgb, var(--color-error) 16%, transparent)'
                              : 'color-mix(in srgb, var(--color-earth) 16%, transparent)',
                            color: isHigh ? 'var(--color-error-text, var(--color-error))' : 'var(--color-earth)',
                            border: isHigh
                              ? '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)'
                              : '1px solid color-mix(in srgb, var(--color-earth) 35%, transparent)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isHigh ? 'Khẩn Cấp' : 'Chú Ý'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginBottom: 4, lineHeight: 1.4 }}>
                        {inc.description}
                      </div>

                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconMapPin size={11} color="var(--color-text-dim)" />
                          {location}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IconClock size={11} color="var(--color-text-dim)" />
                          {dateStr}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenIncidentModal}
            className="btn btn-danger"
            style={{
              width: '100%',
              borderRadius: 4,
              padding: '10px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <IconAlertTriangle size={15} color="var(--color-on-danger)" />
            Báo Cáo Sự Cố Hoặc Yêu Cầu Cứu Hộ
          </button>
        </div>

        {/* CARD 3: Certified Mountain Porters & Local Guides */}
        <div className="bento-command-card" style={{ borderRadius: 0, border: 'none', boxShadow: 'none', padding: 22 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                    color: 'var(--color-sky)',
                    padding: 9,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid color-mix(in srgb, var(--color-sky) 32%, transparent)',
                  }}
                >
                  <IconBackpack size={20} color="var(--color-sky)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                    Porter &amp; Hướng Dẫn Bản Địa
                  </h3>
                  <span style={{ fontSize: '0.73rem', color: 'var(--color-sky)', fontWeight: 700 }}>
                    Xác minh danh tính 100%
                  </span>
                </div>
              </div>

              <span
                style={{
                  background: 'color-mix(in srgb, var(--color-sky) 14%, transparent)',
                  color: 'var(--color-sky)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 4,
                  border: '1px solid color-mix(in srgb, var(--color-sky) 32%, transparent)',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {totalGuidesCount} Đơn Vị
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
              {porters.map((porter) => (
                <div
                  key={porter.id || (porter as LocalGuide & { _id?: string })._id}
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    padding: '11px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                        {porter.name}
                      </span>
                      {porter.verified && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            background: 'color-mix(in srgb, var(--color-primary) 14%, transparent)',
                            color: 'var(--color-primary)',
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontWeight: 700,
                            border: '1px solid var(--color-border-glow)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Đã Xác Minh
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {porter.priceNote || 'Thông thạo địa hình núi cao'}
                    </div>

                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>Khu vực: <strong>{porter.region}</strong></span>
                      <span>·</span>
                      {porter.rating > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--color-sun)', fontWeight: 700 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-sun)" stroke="var(--color-sun)" strokeWidth="1.5">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          {porter.rating.toFixed(1)}/5 ({porter.reviewCount} đánh giá)
                        </span>
                      ) : (
                        <span>Mới · Người bản địa</span>
                      )}
                    </div>
                  </div>

                  <a
                    href={`tel:${extractPrimaryDialNumber(porter.phone)}`}
                    onClick={() => onShowToast?.(`Đang liên hệ ${porter.name}: ${porter.phone}`, 'info')}
                    className="btn btn-outline"
                    style={{
                      padding: '6px 11px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      borderRadius: 4,
                      borderColor: 'var(--color-sky)',
                      color: 'var(--color-sky)',
                      background: 'color-mix(in srgb, var(--color-sky) 10%, transparent)',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      textDecoration: 'none',
                    }}
                  >
                    <IconPhone size={12} color="var(--color-sky)" />
                    Gọi Điện
                  </a>
                </div>
              ))}
            </div>
          </div>

          {onNavigateToForum && (
            <button
              type="button"
              onClick={onNavigateToForum}
              className="btn btn-outline interactive-click"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: '0.82rem',
                fontWeight: 700,
                marginTop: 8,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: 'var(--color-primary)',
                borderColor: 'var(--color-border-glow)',
              }}
            >
              <IconCompass size={14} color="var(--color-primary)" />
              Tham Gia Diễn Đàn &amp; Ghép Đoàn
            </button>
          )}

          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', textAlign: 'center', lineHeight: 1.4, padding: '6px 10px', background: 'var(--color-bg-main)', borderRadius: 4, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconShieldAlert size={13} color="var(--color-sky)" />
            Tất cả đơn vị dẫn đường đều được xác minh thực địa.
          </div>
        </div>
      </div>
    </section>
  );
};
