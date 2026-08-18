import React, { useState, useEffect, useRef } from 'react';
import type { Trail, Incident, LocalGuide } from '../../types.js';
import { mockGuides } from '../../data/seedData.js';
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
    location: 'Đỉnh Tà Xùa (2.875m)',
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

// Helper: High-Fidelity Non-Repeating Organic Web Audio Nature Sound Engine
interface SoundEngine {
  stop: () => void;
  setVolume: (vol: number) => void;
}

// Generate organic 1/f Pink Noise (Voss-McCartney algorithm) - warm, natural, non-repeating
function createOrganicPinkNoiseBuffer(ctx: AudioContext, durationSeconds: number = 24): AudioBuffer {
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
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return { stop: () => {}, setVolume: () => {} };
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(Math.max(0.01, volume * 0.28), ctx.currentTime + 0.08);
    masterGain.connect(ctx.destination);

    // 24-second deep organic non-repeating pink noise buffer
    const pinkNoiseBuffer = createOrganicPinkNoiseBuffer(ctx, 24);
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = pinkNoiseBuffer;
    noiseNode.loop = true;

    // Track all active timeouts to clear cleanly on stop
    const activeTimeouts: any[] = [];
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
      // 1. Trạm Hoàng Liên - Mưa rừng Hoàng Liên & Giọt mưa rải rác trên lá
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

      // Stochastic organic leaf raindrop pings
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
        } catch (e) {}
        safeTimeout(scheduleRainDrop, 90 + Math.random() * 320);
      };
      scheduleRainDrop();

    } else if (type === 'birds') {
      // 2. Sa Pa Valley - Róc rách suối ngàn & Chim rừng hót tự nhiên
      const streamFilter = ctx.createBiquadFilter();
      streamFilter.type = 'bandpass';
      streamFilter.frequency.setValueAtTime(1050, ctx.currentTime);
      streamFilter.Q.setValueAtTime(1.1, ctx.currentTime);

      // Gentle stream water turbulence drift
      const streamLfo = ctx.createOscillator();
      const streamLfoGain = ctx.createGain();
      streamLfo.frequency.setValueAtTime(0.19, ctx.currentTime);
      streamLfoGain.gain.setValueAtTime(180, ctx.currentTime);
      streamLfo.connect(streamFilter.frequency);
      streamLfo.start(0);

      noiseNode.connect(streamFilter);
      streamFilter.connect(masterGain);
      noiseNode.start(0);

      // Dynamic Non-Repeating Melodic Birdsong Engine
      const scheduleBirdSong = () => {
        if (isStopped || ctx.state === 'closed') return;
        try {
          const pattern = Math.floor(Math.random() * 3);
          const baseFreq = 2600 + Math.random() * 800;

          if (pattern === 0) {
            // Pattern A: Double Chirp (Chirp-Chirp)
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
            // Pattern B: Ascending Forest Trill
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
            // Pattern C: Soft Distant Whistle
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
        } catch (e) {}

        // Non-repeating random pause (between 2.2s and 5.5s)
        safeTimeout(scheduleBirdSong, 2200 + Math.random() * 3300);
      };
      safeTimeout(scheduleBirdSong, 600);

    } else if (type === 'wind') {
      // 3. Đỉnh Tà Xùa - Gió rít đại ngàn (Dual compound out-of-phase LFOs)
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.setValueAtTime(320, ctx.currentTime);
      windFilter.Q.setValueAtTime(3.6, ctx.currentTime);

      const lfo1 = ctx.createOscillator();
      const lfoGain1 = ctx.createGain();
      lfo1.frequency.setValueAtTime(0.11, ctx.currentTime); // 9.1s cycle
      lfoGain1.gain.setValueAtTime(140, ctx.currentTime);
      lfo1.connect(windFilter.frequency);
      lfo1.start(0);

      const lfo2 = ctx.createOscillator();
      const lfoGain2 = ctx.createGain();
      lfo2.frequency.setValueAtTime(0.19, ctx.currentTime); // 5.2s cycle
      lfoGain2.gain.setValueAtTime(90, ctx.currentTime);
      lfo2.connect(windFilter.frequency);
      lfo2.start(0);

      noiseNode.connect(windFilter);
      windFilter.connect(masterGain);
      noiseNode.start(0);

    } else if (type === 'campfire') {
      // 4. Basecamp Lảo Thẩn - Lửa bập bùng & Gỗ nổ tí tách (Poisson Process)
      const fireFilter = ctx.createBiquadFilter();
      fireFilter.type = 'lowpass';
      fireFilter.frequency.setValueAtTime(620, ctx.currentTime);

      noiseNode.connect(fireFilter);
      fireFilter.connect(masterGain);
      noiseNode.start(0);

      // Stochastic Wood Crackles & Pop Bursts
      const scheduleWoodPop = () => {
        if (isStopped || ctx.state === 'closed') return;
        try {
          // 25% chance of a micro-cluster (2-3 rapid pops in succession)
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
        } catch (e) {}

        // Non-repeating random pause (between 120ms and 750ms)
        safeTimeout(scheduleWoodPop, 120 + Math.random() * 630);
      };
      scheduleWoodPop();

    } else if (type === 'pine_wind') {
      // 5. Rừng thông Tà Năng - Gió thông reo & Dế rừng đêm (Organic Pulse Trains)
      const pineFilter = ctx.createBiquadFilter();
      pineFilter.type = 'bandpass';
      pineFilter.frequency.setValueAtTime(460, ctx.currentTime);
      pineFilter.Q.setValueAtTime(2.0, ctx.currentTime);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime);
      lfoGain.gain.setValueAtTime(110, ctx.currentTime);
      lfo.connect(pineFilter.frequency);
      lfo.start(0);

      noiseNode.connect(pineFilter);
      pineFilter.connect(masterGain);
      noiseNode.start(0);

      // Natural Cricket Stridulation Trains
      const scheduleCricketTrain = () => {
        if (isStopped || ctx.state === 'closed') return;
        try {
          const pulses = 3 + Math.floor(Math.random() * 3); // 3 to 5 chirps in a train
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
        } catch (e) {}

        // Irregular natural pause between cricket calls
        safeTimeout(scheduleCricketTrain, 1200 + Math.random() * 2400);
      };
      scheduleCricketTrain();

    } else {
      // 6. Thác K50 Kon Chư Răng - Thác nước hùng vĩ 54m cuồn cuộn
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

    return {
      stop: () => {
        isStopped = true;
        activeTimeouts.forEach((tid) => clearTimeout(tid));
        try {
          masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
          setTimeout(() => {
            try {
              noiseNode.stop();
              ctx.close();
            } catch (e) {}
          }, 120);
        } catch (e) {}
      },
      setVolume: (vol: number) => {
        try {
          masterGain.gain.setTargetAtTime(Math.max(0.01, vol * 0.28), ctx.currentTime, 0.05);
        } catch (e) {}
      },
    };
  } catch (e) {
    return { stop: () => {}, setVolume: () => {} };
  }
}

export const BentoCommandHub: React.FC<BentoCommandHubProps> = ({
  incidents: propIncidents,
  onOpenIncidentModal,
  onShowToast,
}) => {
  // --- 1. Basecamp Radio State & Instant Zero-Latency Synthesizer Player ---
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

  // --- 2. Live Safety Radar Incidents Data ---
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    if (propIncidents && propIncidents.length > 0) {
      setIncidents(propIncidents.slice(0, 4));
      return;
    }
    const fetchIncidents = async () => {
      try {
        const res = await fetch('/api/incidents');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setIncidents(data.data.slice(0, 4));
        }
      } catch (err) {
        setIncidents([
          {
            id: 'inc-1',
            trailId: 'trail-taxua',
            trailName: 'Tà Xùa (Sống Lưng Khủng Long)',
            userId: 'user-1',
            userName: 'Cứu Hộ Háng Đồng',
            type: 'bad_weather',
            description: 'Sương mù dày đặc và gió giật mạnh cấp 6 trên sống núi.',
            severity: 'high',
            reportedAt: '2026-08-16T10:30:00Z',
            resolved: false,
            locationNote: 'Sống Lưng Khủng Long',
          },
          {
            id: 'inc-2',
            trailId: 'trail-tanangphandung',
            trailName: 'Tà Năng - Phan Dũng',
            userId: 'user-2',
            userName: 'Kiểm Lâm Phan Dũng',
            type: 'flash_flood',
            description: 'Mưa lớn đầu nguồn làm nước suối dâng cao. Cẩn trọng vượt suối.',
            severity: 'high',
            reportedAt: '2026-08-16T08:15:00Z',
            resolved: false,
            locationNote: 'Trạm Suối Phan Dũng',
          },
          {
            id: 'inc-3',
            trailId: 'trail-fansipan',
            trailName: 'Fansipan (Trạm Tôn)',
            userId: 'user-1',
            userName: 'Kiểm Lâm Hoàng Liên',
            type: 'bad_weather',
            description: 'Nhiệt độ ban đêm giảm sâu xuống 6°C tại lán 2.800m.',
            severity: 'medium',
            reportedAt: '2026-07-28T14:00:00Z',
            resolved: false,
            locationNote: 'Lán Đêm 2.800m',
          },
        ]);
      }
    };
    fetchIncidents();
  }, [propIncidents]);

  // --- 3. Certified Mountain Porters Data ---
  const [porters, setPorters] = useState<LocalGuide[]>(mockGuides);

  useEffect(() => {
    const fetchPorters = async () => {
      try {
        const res = await fetch('/api/guides');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setPorters(data.data.slice(0, 4));
        }
      } catch (err) {
        setPorters(mockGuides.slice(0, 4));
      }
    };
    fetchPorters();
  }, []);

  const handleCallPorter = (phone: string, name: string) => {
    if (onShowToast) {
      onShowToast(`Đang liên hệ Porter ${name}: ${phone}`, 'info');
    }
    window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
  };

  return (
    <section
      style={{
        padding: '24px 0 32px 0',
        maxWidth: 1320,
        margin: '0 auto',
      }}
    >
      {/* Section Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 16px',
            borderRadius: 20,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            fontSize: '0.78rem',
            fontWeight: 800,
            color: 'var(--color-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 10,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <IconRadio size={16} color="var(--color-primary)" />
          HỆ SINH THÁI CHỈ HUY THỰC ĐỊA
        </div>

        <h2
          style={{
            fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
            fontWeight: 900,
            color: 'var(--color-text-main)',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Trạm Chỉ Huy & Vô Tuyến Basecamp
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', maxWidth: 640, margin: '0 auto' }}>
          Tần số âm thanh thiên nhiên thư giãn, mạng lưới radar cảnh báo an toàn thời gian thực và danh bạ porter bản địa.
        </p>
      </div>

      {/* Balanced 3-Card Tactical Command Dashboard Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 24,
          alignItems: 'stretch',
        }}
      >
        {/* CARD 1: Basecamp Ambient Radio */}
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: 22,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    background: 'rgba(5, 150, 105, 0.15)',
                    color: 'var(--color-primary)',
                    padding: 9,
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(5, 150, 105, 0.3)',
                  }}
                >
                  <IconRadio size={20} color="var(--color-primary)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                    Basecamp Radio
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: '0.73rem', color: isPlaying ? 'var(--color-primary)' : 'var(--color-text-dim)', fontWeight: 700 }}>
                      {isPlaying ? '● Đang Phát Âm Thanh' : '○ Chế Độ Chờ'}
                    </span>
                    {isPlaying && (
                      <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 11 }}>
                        <span style={{ width: 2.5, height: '60%', background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span style={{ width: 2.5, height: '100%', background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span style={{ width: 2.5, height: '75%', background: 'var(--color-primary)', borderRadius: 2 }} />
                        <span style={{ width: 2.5, height: '90%', background: 'var(--color-primary)', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
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
              </div>
            </div>

            {/* Channels List - 6 Full Channels Filling Vertical Space */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
              {AMBIENT_CHANNELS.map((channel) => {
                const isCurrent = activeTrack.id === channel.id;
                const ChannelIcon = channel.IconComponent;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => togglePlay(channel)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      borderRadius: 12,
                      border: isCurrent && isPlaying ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: isCurrent && isPlaying ? 'rgba(5, 150, 105, 0.12)' : 'var(--color-bg-main)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span
                        style={{
                          background: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-bg-card)',
                          color: isCurrent && isPlaying ? '#041108' : 'var(--color-text-dim)',
                          padding: 6,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <ChannelIcon size={14} color={isCurrent && isPlaying ? '#041108' : 'var(--color-primary)'} />
                      </span>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-text-main)' }}>
                          {channel.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)' }}>
                          {channel.location} • {channel.freq}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: isCurrent && isPlaying ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        background: isCurrent && isPlaying ? 'rgba(5, 150, 105, 0.2)' : 'transparent',
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: isCurrent && isPlaying ? '1px solid var(--color-primary)' : '1px solid transparent',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isCurrent && isPlaying ? 'Tạm Dừng ⏸' : 'Nghe ▶'}
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
              borderRadius: 14,
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
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: 22,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--color-error)',
                    padding: 9,
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <IconRadar size={20} color="var(--color-error)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                    Radar Cảnh Báo An Toàn
                  </h3>
                  <span style={{ fontSize: '0.73rem', color: 'var(--color-error)', fontWeight: 700 }}>
                    Trực ban cứu hộ & SOS 24/7
                  </span>
                </div>
              </div>

              <span
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--color-error)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 12,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                {incidents.length} Cảnh Báo
              </span>
            </div>

            {/* List of Recent Incidents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {incidents.map((inc) => {
                const title = inc.trailName || (inc as any).title || 'Cảnh Báo Cung Đường';
                const location = inc.locationNote || (inc as any).location || inc.trailName || 'Vùng rừng núi';
                const dateStr = new Date(inc.reportedAt || (inc as any).createdAt || Date.now()).toLocaleDateString('vi-VN');
                const isHigh = inc.severity === 'high' || inc.severity === 'critical';

                return (
                  <div
                    key={inc.id || (inc as any)._id}
                    style={{
                      background: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
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
                          borderRadius: 6,
                          background: isHigh ? 'rgba(239, 68, 68, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                          color: isHigh ? 'var(--color-error)' : 'var(--color-earth)',
                          border: isHigh ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(249, 115, 22, 0.3)',
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
              })}
            </div>
          </div>

          {/* SOS Incident Button */}
          <button
            type="button"
            onClick={onOpenIncidentModal}
            className="btn btn-danger"
            style={{
              width: '100%',
              borderRadius: 14,
              padding: '11px 14px',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)',
            }}
          >
            <IconAlertTriangle size={15} color="#ffffff" />
            Báo Cáo Sự Cố Hoặc Yêu Cầu Cứu Hộ
          </button>
        </div>

        {/* CARD 3: Certified Mountain Porters & Local Guides */}
        <div
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 24,
            padding: 22,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    background: 'rgba(2, 132, 199, 0.15)',
                    color: 'var(--color-sky)',
                    padding: 9,
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(2, 132, 199, 0.3)',
                  }}
                >
                  <IconBackpack size={20} color="var(--color-sky)" />
                </span>
                <div>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
                    Porter & Hướng Dẫn Bản Địa
                  </h3>
                  <span style={{ fontSize: '0.73rem', color: 'var(--color-sky)', fontWeight: 700 }}>
                    Xác minh danh tính 100%
                  </span>
                </div>
              </div>

              <span
                style={{
                  background: 'rgba(2, 132, 199, 0.12)',
                  color: 'var(--color-sky)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '3px 9px',
                  borderRadius: 12,
                  border: '1px solid rgba(2, 132, 199, 0.3)',
                }}
              >
                {porters.length} Người Dẫn
              </span>
            </div>

            {/* List of Verified Porters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
              {porters.map((porter) => (
                <div
                  key={porter.id || (porter as any)._id}
                  style={{
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
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
                        <span style={{ fontSize: '0.65rem', background: 'rgba(5, 150, 105, 0.15)', color: 'var(--color-primary)', padding: '1px 5px', borderRadius: 5, fontWeight: 700, border: '1px solid rgba(5, 150, 105, 0.3)' }}>
                          ✓ Đã Xác Minh
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {porter.priceNote || 'Thông thạo địa hình núi cao'}
                    </div>

                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 2, display: 'flex', gap: 6 }}>
                      <span>Khu vực: <strong>{porter.region}</strong></span>
                      <span>•</span>
                      <span>{porter.rating > 0 ? `${porter.rating.toFixed(1)}/5 ★ (${porter.reviewCount} đánh giá)` : 'Mới • Người bản địa'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCallPorter(porter.phone, porter.name)}
                    className="btn btn-outline"
                    style={{
                      padding: '6px 11px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      borderRadius: 9,
                      borderColor: 'var(--color-sky)',
                      color: 'var(--color-sky)',
                      background: 'rgba(2, 132, 199, 0.08)',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <IconPhone size={12} color="var(--color-sky)" />
                    Gọi Điện
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', textAlign: 'center', lineHeight: 1.4, padding: '6px 10px', background: 'var(--color-bg-main)', borderRadius: 10, border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <IconShieldAlert size={13} color="var(--color-sky)" />
            Tất cả porter đều là người bản địa am hiểu địa hình rừng núi sâu.
          </div>
        </div>
      </div>
    </section>
  );
};
