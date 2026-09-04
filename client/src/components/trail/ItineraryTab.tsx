import React, { useState, useEffect } from 'react';
import type { Trail, ItineraryStep } from '../../types.js';
import { createExpeditionItinerary } from '../../services/api.js';

interface ItineraryTabProps {
  trail: Trail;
}

export const ItineraryTab: React.FC<ItineraryTabProps> = ({ trail }) => {
  const storageKey = `trekmap_itinerary_${trail.id}`;

  const [title, setTitle] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved).title || `Hành trình thám hiểm ${trail.name}`; } catch (e) {}
    }
    return `Hành trình thám hiểm ${trail.name}`;
  });

  const [startDate, setStartDate] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved).startDate || new Date().toISOString().split('T')[0]; } catch (e) {}
    }
    return new Date().toISOString().split('T')[0];
  });

  const [memberCount, setMemberCount] = useState<number>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try { return JSON.parse(saved).memberCount || 4; } catch (e) {}
    }
    return 4;
  });

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const defaultSteps = (): ItineraryStep[] => {
    const steps: ItineraryStep[] = [
      { day: 1, time: '05:00', title: 'Tập trung & Di chuyển', description: 'Tập trung tại điểm hẹn, kiểm tra balo, di chuyển bằng xe đến chân núi.', locationNote: 'Chân núi / Cửa rừng' },
      { day: 1, time: '08:30', title: 'Bắt đầu trekking', description: 'Gặp Hướng dẫn viên/Porter, làm thủ tục với Kiểm lâm (nếu có) và bắt đầu hành trình.', locationNote: trail.province },
      { day: 1, time: '12:00', title: 'Nghỉ trưa & Ăn nhẹ', description: 'Dừng chân tại suối/trạm nghỉ, bổ sung năng lượng và nước ngọt.', locationNote: 'Trạm nghỉ giữa đường' },
      { day: 1, time: '17:00', title: 'Hạ trại & Dựng lều', description: 'Đến điểm cắm trại, nhóm lửa nấu ăn, thưởng thức bữa tối giữa không gian rừng đêm.', locationNote: trail.hasCampsite ? 'Bãi cắm trại qua đêm' : 'Lán nghỉ' },
    ];

    if (trail.durationDays >= 2) {
      steps.push(
        { day: 2, time: '04:30', title: 'Thức dậy & Săn mây', description: 'Đón bình minh, thưởng thức cà phê/trà nóng và đón biển mây cuồn cuộn.', locationNote: 'Điểm săn mây' },
        { day: 2, time: '06:30', title: 'Chinh phục cột mốc / Đỉnh núi', description: `Chạm tay vào đỉnh ${trail.name} (${trail.maxAltitudeM}m), chụp ảnh lưu niệm cùng nhóm.`, locationNote: `Đỉnh ${trail.name}` },
        { day: 2, time: '09:00', title: 'Thu dọn lều & Hạ sơn', description: 'Dọn sạch rác (LNT policy), kiểm tra đủ quân số và bắt đầu đường về.', locationNote: 'Đường xuống núi' },
        { day: 2, time: '14:30', title: 'Về điểm xuất phát & Kết thúc', description: 'Về đến chân núi, tắm rửa, thưởng thức lẩu thắng cố/đặc sản địa phương và chia tay.', locationNote: 'Chân núi' }
      );
    }

    return steps;
  };

  const [steps, setSteps] = useState<ItineraryStep[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          return parsed.steps;
        }
      } catch (e) {}
    }
    return defaultSteps();
  });

  // Auto-save itinerary to localStorage on changes
  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        title,
        startDate,
        memberCount,
        steps,
      })
    );
  }, [storageKey, title, startDate, memberCount, steps]);

  const handleAddStep = () => {
    const lastStep = steps[steps.length - 1];
    setSteps([
      ...steps,
      {
        day: lastStep ? lastStep.day : 1,
        time: '18:00',
        title: 'Hoạt động bổ sung',
        description: 'Mô tả chi tiết hoạt động...',
        locationNote: 'Trạm dừng',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleUpdateStep = (index: number, field: keyof ItineraryStep, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleSaveItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];
    const payload = {
      trailId: trail.id,
      trailName: trail.name,
      title: title || `Kế Hoạch Khám Phá ${trail.name}`,
      startDate: effectiveStartDate,
      memberCount: memberCount || 4,
      steps,
      timelineSteps: steps.map((s) => ({
        day: s.day,
        time: s.time,
        activity: s.title,
        location: s.locationNote,
        notes: s.description,
      })),
    };

    const res = await createExpeditionItinerary(payload);
    setSubmitting(false);

    if (res && res.shareUrl) {
      setShareUrl(res.shareUrl);
    } else {
      const mockToken = `itinerary-${Date.now()}`;
      try {
        const cached = JSON.parse(localStorage.getItem('trekmap_local_itineraries') || '{}');
        cached[mockToken] = { ...payload, shareToken: mockToken };
        localStorage.setItem('trekmap_local_itineraries', JSON.stringify(cached));
      } catch (err) {}
      setShareUrl(`${window.location.origin}/#itinerary/${mockToken}`);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // P2-13: HTML5 Canvas Card Export
  const handleExportCanvasImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 900);
    grad.addColorStop(0, '#0b1726');
    grad.addColorStop(1, '#050c14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 900);

    // Header Title
    ctx.fillStyle = '#0ed7b5';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('TREKMAP - LỊCH TRÌNH LEO NÚI', 50, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(title, 50, 105);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Cung đường: ${trail.name} (${trail.maxAltitudeM}m) • Khởi hành: ${startDate} • Thành viên: ${memberCount} người`, 50, 140);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 160);
    ctx.lineTo(750, 160);
    ctx.stroke();

    // Timeline Steps
    let yPos = 200;
    steps.forEach((s) => {
      if (yPos > 800) return;

      // Circle node
      ctx.fillStyle = '#0ed7b5';
      ctx.beginPath();
      ctx.arc(60, yPos - 6, 8, 0, Math.PI * 2);
      ctx.fill();

      // Time & Day Badge
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`[Ngày ${s.day} - ${s.time}]`, 85, yPos);

      // Step Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(s.title, 240, yPos);

      // Description
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px sans-serif';
      const desc = s.description.length > 65 ? s.description.substring(0, 65) + '...' : s.description;
      ctx.fillText(desc, 85, yPos + 26);

      yPos += 70;
    });

    // Footer
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('TrekMap Vietnam - Trợ Lý Thám Hiểm Bản Đồ Số 1', 50, 860);

    // Download Image
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Lich_Trinh_${trail.id}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
      {/* Left Column: Interactive Timeline Stepper (P2-12) */}
      <div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                Lịch trình thời gian chi tiết (Timeline Stepper)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)' }}>
                Tự do chỉnh sửa mốc thời gian, thêm hoặc xóa hoạt động của đoàn thám hiểm.
              </p>
            </div>
          </div>

          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 8, top: 10, bottom: 10, width: 2, background: 'var(--color-border)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {steps.map((step, idx) => (
                <div key={idx} style={{ position: 'relative', background: 'var(--color-bg-main)', padding: 14, borderRadius: 12, border: '1px solid var(--color-border)' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: -24,
                      top: 18,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      border: '3px solid #071319',
                    }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 60px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <select
                      className="form-select"
                      value={step.day}
                      onChange={(e) => handleUpdateStep(idx, 'day', Number(e.target.value))}
                      style={{ fontSize: '0.8rem', padding: '4px 6px' }}
                    >
                      <option value={1}>Ngày 1</option>
                      <option value={2}>Ngày 2</option>
                      <option value={3}>Ngày 3</option>
                    </select>

                    <input
                      type="text"
                      className="form-input"
                      value={step.time}
                      onChange={(e) => handleUpdateStep(idx, 'time', e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '4px 6px', textAlign: 'center' }}
                    />

                    <input
                      type="text"
                      className="form-input"
                      value={step.title}
                      onChange={(e) => handleUpdateStep(idx, 'title', e.target.value)}
                      style={{ fontSize: '0.85rem', fontWeight: 700, padding: '4px 8px' }}
                    />

                    <button
                      onClick={() => handleRemoveStep(idx)}
                      style={{ background: 'transparent', border: '1px solid var(--color-error)', borderRadius: 6, color: 'var(--color-error)', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}
                    >
                      Xóa
                    </button>
                  </div>

                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={step.description}
                    onChange={(e) => handleUpdateStep(idx, 'description', e.target.value)}
                    style={{ fontSize: '0.82rem', padding: '6px 8px' }}
                  />
                </div>
              ))}
            </div>

            <button
              className="btn btn-outline"
              onClick={handleAddStep}
              style={{ marginTop: 16, width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}
            >
              + Thêm mốc thời gian mới
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Form Settings & Zalo Share Export */}
      <div>
        <div className="card" style={{ position: 'sticky', top: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 16 }}>
            Thông Tin Lịch Trình Đoàn
          </h3>

          <form onSubmit={handleSaveItinerary}>
            <div className="form-group">
              <label className="form-label">Tên chuyến đi:</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ngày bắt đầu khởi hành:</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Số lượng thành viên (người):</label>
              <input
                type="number"
                className="form-input"
                value={memberCount}
                onChange={(e) => setMemberCount(Math.max(1, Number(e.target.value)))}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
            >
              {submitting ? 'Đang lưu...' : 'Lưu Lịch Trình & Tạo Link Chia Sẻ'}
            </button>
          </form>

          {/* P2-13: Share Link & Zalo Export Card */}
          {shareUrl && (
            <div style={{ background: 'var(--color-bg-main)', padding: 14, borderRadius: 12, border: '1px solid var(--color-primary)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 6 }}>LINK CHIA SẺ TRỰC TIẾP:</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    color: 'var(--color-primary)',
                    fontSize: '0.78rem',
                    padding: '4px 8px',
                  }}
                />
                <button className="btn btn-outline" onClick={handleCopyLink} style={{ padding: '4px 10px' }}>
                  {copied ? 'Đã copy' : 'Copy Link'}
                </button>
              </div>

              <button
                className="btn btn-sun"
                onClick={handleExportCanvasImage}
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
              >
                Xuất Card Ảnh Gửi Nhóm Zalo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
