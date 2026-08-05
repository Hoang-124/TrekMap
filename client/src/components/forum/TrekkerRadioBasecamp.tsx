import React, { useState } from 'react';
import { Radio, RadioTower, ShieldAlert, Volume2, Mic } from 'lucide-react';

interface RadioMessage {
  id: string;
  callsign: string;
  avatar: string;
  channel: string;
  altitudeM: number;
  location: string;
  signalQuality: string;
  message: string;
  timestamp: string;
  isUrgent?: boolean;
}

const initialRadioMessages: RadioMessage[] = [
  {
    id: 'rad-1',
    callsign: 'MinhTrekker (Đội Tiền Nhị)',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    channel: 'Channel 1 • Tà Xùa',
    altitudeM: 2650,
    location: 'Trạm Đỉnh Háng Đồng',
    signalQuality: 'Strong 4G',
    message: 'Gió trên đỉnh Háng Đồng vừa giảm, mây phủ kín thung lũng 360 độ cực đẹp! Đội 2 đang dừng ăn trưa.',
    timestamp: '18:25',
  },
  {
    id: 'rad-2',
    callsign: 'A Páo (Porter Trưởng Y Tý)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
    channel: 'Channel 2 • Lảo Thẩn',
    altitudeM: 2200,
    location: 'Lán Phìn Hồ',
    signalQuality: 'Stable',
    message: 'Lán nghỉ Phìn Hồ đã đun sẵn nước nóng cho anh em. Đoàn nào lên nhớ ghé lấy củi khô nhé.',
    timestamp: '18:47',
  },
  {
    id: 'rad-3',
    callsign: 'Cứu Hộ Sapa 24/7',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
    channel: 'Channel SOS • Khẩn Cấp',
    altitudeM: 2800,
    location: 'Trạm 2800m Fansipan',
    signalQuality: 'Satellite',
    message: 'Nhiệt độ đêm nay trạm 2800m dự báo giảm xuống 5°C. Yêu cầu các đoàn kiểm tra kĩ túi ngủ chống nước.',
    timestamp: '19:10',
    isUrgent: true,
  },
];

export const TrekkerRadioBasecamp: React.FC = () => {
  const [messages, setMessages] = useState<RadioMessage[]>(initialRadioMessages);
  const [activeChannel, setActiveChannel] = useState('All');
  const [inputText, setInputText] = useState('');
  const [myAltitude, setMyAltitude] = useState(2400);

  const handleTransmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newRadio: RadioMessage = {
      id: `rad-${Date.now()}`,
      callsign: 'Bạn (Basecamp Operator)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      channel: activeChannel === 'All' ? 'Channel 1 • Tần Số Chung' : activeChannel,
      altitudeM: myAltitude,
      location: 'Trạm Xuất Phát',
      signalQuality: 'Strong',
      message: inputText,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([newRadio, ...messages]);
    setInputText('');
  };

  const filtered = activeChannel === 'All'
    ? messages
    : messages.filter((m) => m.channel.includes(activeChannel));

  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
      marginBottom: 44,
    }}>
      {/* Radio Console Header */}
      <div style={{
        background: 'var(--color-bg-main)',
        borderBottom: '1px solid var(--color-border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: 'rgba(74, 222, 128, 0.15)',
            border: '1px solid var(--color-primary)',
            padding: 10,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(74, 222, 128, 0.2)',
          }}>
            <RadioTower size={24} color="var(--color-primary)" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-extrabold)', color: 'var(--color-text-main)', margin: 0, letterSpacing: '-0.3px' }}>
                Trạm Vô Tuyến Sóng Ngắn Trekker (Basecamp Radio)
              </h3>
              <span className="badge badge-success" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary)' }} />
                Tần số 144.500 MHz
              </span>
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
              Kênh liên lạc đàm đài giữa các đoàn leo núi, porter địa phương & trạm cứu hộ rừng
            </p>
          </div>
        </div>

        {/* Live Audio Visualizer Pulse */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          padding: '8px 16px',
          borderRadius: 24,
        }}>
          <Volume2 size={16} color="var(--color-stream)" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 16 }}>
            {[12, 20, 8, 16, 22, 14, 18, 10].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  background: 'var(--color-stream)',
                  borderRadius: 2,
                  animation: `pulse 1.2s infinite ease-in-out ${i * 0.15}s`,
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-stream)', fontWeight: 'var(--font-weight-bold)' }}>GPS 4G LINK</span>
        </div>
      </div>

      {/* Channels Bar */}
      <div style={{
        background: 'var(--color-bg-main)',
        padding: '10px 24px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
      }}>
        {['All', 'Channel 1 • Tà Xùa', 'Channel 2 • Lảo Thẩn', 'Channel SOS • Khẩn Cấp'].map((ch) => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            className={`btn ${activeChannel === ch ? 'btn-primary' : 'btn-outline'}`}
            style={{
              padding: '6px 16px',
              fontSize: 'var(--font-size-xs)',
              borderRadius: 20,
              background: ch.includes('SOS') ? (activeChannel === ch ? 'var(--color-error)' : 'rgba(239, 68, 68, 0.15)') : undefined,
              borderColor: ch.includes('SOS') ? 'var(--color-error)' : undefined,
              color: ch.includes('SOS') ? (activeChannel === ch ? '#ffffff' : 'var(--color-error)') : undefined,
            }}
          >
            {ch === 'All' ? 'Tất cả tần số' : ch}
          </button>
        ))}
      </div>

      {/* Main Radio Transmission Stream */}
      <div style={{
        padding: 24,
        minHeight: 300,
        maxHeight: 420,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        background: 'var(--color-bg-card)',
      }}>
        {filtered.map((msg) => (
          <div
            key={msg.id}
            style={{
              background: msg.isUrgent ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), var(--color-bg-main))' : 'var(--color-bg-main)',
              border: msg.isUrgent ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
              borderRadius: 14,
              padding: '16px 20px',
              boxShadow: msg.isUrgent ? '0 0 20px rgba(239, 68, 68, 0.15)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={msg.avatar}
                  alt={msg.callsign}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--color-primary)' }}
                />
                <div>
                  <strong style={{ color: 'var(--color-text-main)', fontSize: 'var(--font-size-sm)' }}>{msg.callsign}</strong>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-stream)' }}>
                    📍 {msg.location} • Độ cao: <strong style={{ color: 'var(--color-sky)' }}>{msg.altitudeM}m</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-info" style={{ fontSize: 'var(--font-size-xs)' }}>
                  {msg.channel}
                </span>
                {msg.isUrgent && (
                  <span className="badge badge-error" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldAlert size={12} /> CẢNH BÁO
                  </span>
                )}
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-dim)' }}>{msg.timestamp}</span>
              </div>
            </div>

            <p style={{ color: msg.isUrgent ? 'var(--color-error)' : 'var(--color-text-main)', fontSize: 'var(--font-size-sm)', lineHeight: 'var(--line-height-normal)', margin: 0 }}>
              {msg.message}
            </p>
          </div>
        ))}
      </div>

      {/* Transmit Controls Input Bar */}
      <form onSubmit={handleTransmit} style={{
        background: 'var(--color-bg-main)',
        borderTop: '1px solid var(--color-border)',
        padding: '16px 24px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: '8px 12px', borderRadius: 8 }}>
          <Radio size={15} color="var(--color-stream)" />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Độ cao:</span>
          <input
            type="number"
            value={myAltitude}
            onChange={(e) => setMyAltitude(Number(e.target.value))}
            style={{ width: 55, background: 'transparent', border: 'none', color: 'var(--color-primary)', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-xs)', outline: 'none' }}
          />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>m</span>
        </div>

        <input
          type="text"
          placeholder="Phát tín hiệu vô tuyến hoặc cập nhật tình trạng đường trekking..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '10px 16px',
            color: 'var(--color-text-main)',
            fontSize: 'var(--font-size-sm)',
            outline: 'none',
          }}
        />

        <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mic size={16} /> Phát sóng Radio
        </button>
      </form>
    </div>
  );
};
