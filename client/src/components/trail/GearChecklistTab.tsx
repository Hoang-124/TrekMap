import React, { useState, useEffect } from 'react';
import type { Trail } from '../../types.js';

interface GearItem {
  id: string;
  name: string;
  category: 'Trang phục' | 'Đồ ngủ & Lán' | 'Ăn uống & Nước' | 'Y tế & An toàn' | 'Điện tử' | 'Khác';
  weightGrams: number;
  isEssential: boolean;
  checked: boolean;
  reason?: string;
}

interface GearChecklistTabProps {
  trail: Trail;
}

export const GearChecklistTab: React.FC<GearChecklistTabProps> = ({ trail }) => {
  const storageKey = `trekmap_checklist_${trail.id}`;

  const generateDefaultItems = (): GearItem[] => {
    const base: GearItem[] = [
      { id: '1', name: 'Giày leo núi cổ cao chống trượt', category: 'Trang phục', weightGrams: 850, isEssential: true, checked: true },
      { id: '2', name: 'Balo chuyên dụng trợ lực (35L-50L)', category: 'Trang phục', weightGrams: 1400, isEssential: true, checked: true },
      { id: '3', name: 'Áo mưa bộ 2 lớp chống gió mưa', category: 'Trang phục', weightGrams: 450, isEssential: true, checked: true },
      { id: '4', name: 'Đèn pin đội đầu + 2 viên pin dự phòng', category: 'Điện tử', weightGrams: 200, isEssential: true, checked: true },
      { id: '5', name: 'Túi sơ cứu y tế (Băng gạc, salonpas, thuốc đi ngoài)', category: 'Y tế & An toàn', weightGrams: 350, isEssential: true, checked: true },
      { id: '6', name: 'Bình chứa nước sinh tồn (2 Lit)', category: 'Ăn uống & Nước', weightGrams: 300, isEssential: true, checked: true },
      { id: '7', name: 'Lương khô / Thức ăn năng lượng hạt', category: 'Ăn uống & Nước', weightGrams: 500, isEssential: true, checked: true },
      { id: '8', name: 'Còi cứu hộ + Đao dã ngoại gấp gọn', category: 'Y tế & An toàn', weightGrams: 180, isEssential: true, checked: true },
      { id: '9', name: 'Sạc dự phòng 20.000mAh', category: 'Điện tử', weightGrams: 420, isEssential: true, checked: true },
    ];

    if (trail.durationDays >= 2) {
      base.push({ id: '10', name: 'Túi ngủ chịu nhiệt 5°C', category: 'Đồ ngủ & Lán', weightGrams: 1100, isEssential: true, checked: true, reason: 'Yêu cầu đi qua đêm' });
      base.push({ id: '11', name: 'Đệm cách nhiệt trải lán', category: 'Đồ ngủ & Lán', weightGrams: 350, isEssential: true, checked: true });
    }

    if (trail.difficultyLevel >= 4) {
      base.push({ id: '12', name: 'Gậy trekking hợp kim nhôm (1 cặp)', category: 'Trang phục', weightGrams: 500, isEssential: true, checked: true, reason: 'Đường dốc đứng cấp 4+' });
      base.push({ id: '13', name: 'Mũ bảo hiểm leo núi chuyên dụng', category: 'Y tế & An toàn', weightGrams: 320, isEssential: true, checked: false, reason: 'Nguy cơ đá lăn' });
    }

    if (trail.maxAltitudeM >= 2500) {
      base.push({ id: '14', name: 'Áo khoác lông vũ siêu nhẹ (ấm -5°C)', category: 'Trang phục', weightGrams: 400, isEssential: true, checked: true, reason: 'Rất lạnh đỉnh cao > 2500m' });
      base.push({ id: '15', name: 'Găng tay giữ nhiệt & Tất len dự phòng', category: 'Trang phục', weightGrams: 200, isEssential: true, checked: true });
    }

    if (!trail.hasWaterSource) {
      base.push({ id: '16', name: 'Túi nước rỗng 3 Lit phụ', category: 'Ăn uống & Nước', weightGrams: 150, isEssential: true, checked: true, reason: 'Tuyến đường không có nguồn nước' });
    } else {
      base.push({ id: '17', name: 'Bình lọc nước / Viên lọc nước suối', category: 'Ăn uống & Nước', weightGrams: 120, isEssential: true, checked: true });
    }

    base.push({ id: '18', name: 'Máy ảnh Mirrorless + Ống kính', category: 'Điện tử', weightGrams: 1200, isEssential: false, checked: false });
    base.push({ id: '19', name: 'Túi rác tự phân hủy (Zero-waste)', category: 'Khác', weightGrams: 50, isEssential: true, checked: true });

    return base;
  };

  const [items, setItems] = useState<GearItem[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return generateDefaultItems();
  });

  const [userBodyWeightKg, setUserBodyWeightKg] = useState<number>(65);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setItems(JSON.parse(saved));
        return;
      } catch (e) {}
    }
    setItems(generateDefaultItems());
  }, [trail.id]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  const toggleCheck = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const resetChecklist = () => {
    setItems(generateDefaultItems());
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const totalWeightGrams = items
    .filter((i) => i.checked)
    .reduce((sum, item) => sum + item.weightGrams, 0);

  const totalWeightKg = (totalWeightGrams / 1000).toFixed(1);
  const weightRatioPercent = Math.round((Number(totalWeightKg) / userBodyWeightKg) * 100);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
      {/* Left Column: Interactive Gear Checklist */}
      <div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 4 }}>
                Danh sách trang bị sinh tồn ({checkedCount}/{items.length} món)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)' }}>
                Tự động đề xuất vật dụng phù hợp cho độ khó cấp {trail.difficultyLevel} & thời gian {trail.durationDays} ngày.
              </p>
            </div>
            <button className="btn btn-outline" onClick={resetChecklist} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              Đặt lại ban đầu
            </button>
          </div>

          {/* Checklist Item List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item) => {
              return (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  style={{
                    background: item.checked ? 'rgba(14, 215, 181, 0.06)' : 'var(--color-bg-main)',
                    border: item.checked ? '1px solid rgba(14, 215, 181, 0.3)' : '1px solid var(--color-border)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => {}}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                    />

                    <div>
                      <div
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: item.checked ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                          textDecoration: item.checked ? 'none' : 'line-through',
                        }}
                      >
                        {item.name}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                          {item.category}
                        </span>
                        {item.isEssential && (
                          <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                            Bắt buộc
                          </span>
                        )}
                        {item.reason && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-sun)' }}>
                            * {item.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                    {item.weightGrams}g
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Backpack Weight Calculator & Overweight Warning */}
      <div>
        <div className="card" style={{ position: 'sticky', top: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)', marginBottom: 14 }}>
            Tính Trọng Lượng Balo & Thể Trọng
          </h3>

          {/* Total Weight Stat */}
          <div style={{ background: 'var(--color-bg-main)', padding: 16, borderRadius: 14, textAlign: 'center', marginBottom: 16, border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)' }}>TỔNG TRỌNG LƯỢNG BALO DỰ KIẾN</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--color-primary)', margin: '4px 0' }}>
              {totalWeightKg} <span style={{ fontSize: '1rem', color: 'var(--color-text-muted)' }}>kg</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>({totalWeightGrams.toLocaleString()} grams)</div>
          </div>

          {/* User Weight Input */}
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Cân nặng cơ thể của bạn (kg):</label>
            <input
              type="number"
              className="form-input"
              value={userBodyWeightKg}
              onChange={(e) => setUserBodyWeightKg(Math.max(30, Number(e.target.value)))}
              style={{ fontWeight: 700 }}
            />
          </div>

          {/* Weight Ratio Meter */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
              <span style={{ color: 'var(--color-text-dim)' }}>Tỷ lệ balo / cơ thể:</span>
              <strong style={{ color: weightRatioPercent > 25 ? 'var(--color-error)' : weightRatioPercent > 20 ? 'var(--color-sun)' : 'var(--color-primary)' }}>
                {weightRatioPercent}% cơ thể
              </strong>
            </div>

            <div style={{ width: '100%', height: 10, background: 'var(--color-bg-main)', borderRadius: 5, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, weightRatioPercent * 3)}%`,
                  height: '100%',
                  background: weightRatioPercent > 25 ? 'var(--color-error)' : weightRatioPercent > 20 ? 'var(--color-sun)' : 'var(--color-primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* P2-11: Overweight Warnings */}
          {weightRatioPercent > 25 ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid var(--color-error)', padding: 14, borderRadius: 12, color: '#fca5a5', fontSize: '0.84rem', lineHeight: 1.5 }}>
              <strong style={{ color: '#fff', display: 'block', marginBottom: 4 }}>
                NGUY HIỂM: BALO QUÁ NẶNG!
              </strong>
              Balo chiếm <strong>{weightRatioPercent}%</strong> cân nặng cơ thể (&gt; 25%). Khuyến nghị lược bỏ bớt các vật dụng không thiết yếu (máy ảnh, loa Bluetooth) để tránh chấn thương khớp gối & cột sống trên đường trekking dài.
            </div>
          ) : weightRatioPercent > 20 ? (
            <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid var(--color-sun)', padding: 14, borderRadius: 12, color: '#fef08a', fontSize: '0.84rem', lineHeight: 1.5 }}>
              <strong style={{ color: '#fff', display: 'block', marginBottom: 4 }}>
                CẢNH BÁO: Balo tương đối nặng
              </strong>
              Tỷ lệ <strong>{weightRatioPercent}%</strong> nằm ở ngưỡng giới hạn chịu đựng (20% - 25%). Hãy siết chặt đai trợ lực hông khi di chuyển.
            </div>
          ) : (
            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid var(--color-primary)', padding: 14, borderRadius: 12, color: '#6ee7b7', fontSize: '0.84rem', lineHeight: 1.5 }}>
              <strong style={{ color: '#fff', display: 'block', marginBottom: 4 }}>
                Tỷ lệ hoàn hảo!
              </strong>
              Trọng lượng balo lý tưởng (&lt; 20% thể trọng). Cơ thể bạn sẽ di chuyển linh hoạt và giữ sức bền tối đa!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
