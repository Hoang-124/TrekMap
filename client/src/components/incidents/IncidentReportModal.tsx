import React, { useState, useEffect, useRef } from 'react';
import type { Trail, Incident } from '../../types.js';
import { submitIncident, confirmIncidentApi } from '../../services/api.js';
import { searchMatchVietnamese } from '../../utils/textUtils.js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  trailName?: string;
  trailId?: string;
  trails?: Trail[];
  incidents?: Incident[];
  currentUser?: any;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  onSuccess?: () => void;
}

export const IncidentReportModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  trailName,
  trailId,
  trails = [],
  incidents = [],
  currentUser,
  onShowToast,
  onSuccess,
}) => {
  const [selectedTrailId, setSelectedTrailId] = useState<string>(trailId || '');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [type, setType] = useState<'landslide' | 'flood' | 'wildlife' | 'weather' | 'lost' | 'other'>('landslide');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [description, setDescription] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyAction, setVerifyAction] = useState<'confirm_true' | 'dispute_false'>('confirm_true');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize selected trail & search text when modal opens or trailId changes
  useEffect(() => {
    if (isOpen) {
      if (trailId) {
        setSelectedTrailId(trailId);
        const found = trails.find((t) => t.id === trailId || (t as any)._id === trailId);
        if (found) setSearchTerm(found.name);
      } else {
        setSelectedTrailId('');
        setSearchTerm('');
      }
      setDescription('');
      setLocationNote('');
      setVerifyAction('confirm_true');
    }
  }, [isOpen, trailId, trails]);

  // Click outside listener to close searchable dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const currentSelectedTrail = trails.find((t) => (t.id === selectedTrailId || (t as any)._id === selectedTrailId));
  const effectiveTrailName = trailName || currentSelectedTrail?.name || searchTerm.trim() || 'Khu vực thực địa';

  // Check if an active (unresolved) hazard alert already exists ONLY when a trail is genuinely selected or typed
  const activeIncident = (selectedTrailId || searchTerm.trim().length >= 3)
    ? incidents.find((i) => {
        if (i.resolved || (i as any).active === false) return false;
        if (selectedTrailId) {
          const matchId = i.trailId === selectedTrailId || (i as any)._id === selectedTrailId;
          const matchName = currentSelectedTrail && searchMatchVietnamese(i.trailName, currentSelectedTrail.name);
          return matchId || matchName;
        }
        if (searchTerm.trim().length >= 3) {
          return searchMatchVietnamese(i.trailName, searchTerm.trim());
        }
        return false;
      })
    : null;

  // Filter trails based on search keyword (Vietnamese Diacritics & Case Insensitive)
  const filteredTrails = trails.filter((t) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim();
    const nameMatch = searchMatchVietnamese(t.name, q);
    const provinceMatch = searchMatchVietnamese(t.province, q);
    const districtMatch = searchMatchVietnamese(t.district || '', q);
    const regionMatch = searchMatchVietnamese(t.region, q);
    const altMatch = t.altNames?.some((a) => searchMatchVietnamese(a, q));
    return nameMatch || provinceMatch || districtMatch || regionMatch || altMatch;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (activeIncident && verifyAction === 'dispute_false' && !description.trim()) {
      if (onShowToast) onShowToast('Vui lòng nêu rõ lý do bạn báo cáo thông tin này là sai sự thật.', 'error');
      return;
    }

    if (!activeIncident && !description.trim()) {
      if (onShowToast) onShowToast('Vui lòng nhập mô tả chi tiết tình hình thực tế.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (activeIncident) {
        const activeIncidentId = (activeIncident as any)._id || activeIncident.id;
        if (verifyAction === 'confirm_true') {
          // Confirm TRUE: Incident is real, add confirmation (+1) and optional note
          await confirmIncidentApi(activeIncidentId, {
            action: 'confirm_true',
            note: locationNote.trim() || `Vị trí: ${effectiveTrailName}`,
            additionalDescription: description.trim() || 'Xác nhận thông tin cảnh báo là chính xác.',
            severity,
            reporterName: currentUser?.fullName || currentUser?.username || 'Trekker Đồng Báo Cáo',
            reporterEmail: currentUser?.email || '',
            reporterAvatar: currentUser?.avatarUrl || '',
          });

          if (onShowToast) {
            onShowToast(`Đã xác nhận thông tin cảnh báo tại "${effectiveTrailName}" là ĐÚNG (+1 Xác thực)!`, 'success');
          }
        } else {
          // Dispute FALSE: False alarm / fake report
          await confirmIncidentApi(activeIncidentId, {
            action: 'dispute_false',
            reason: description.trim(),
            note: locationNote.trim(),
            reporterName: currentUser?.fullName || currentUser?.username || 'Trekker Phản Ánh',
            reporterEmail: currentUser?.email || '',
          });

          if (onShowToast) {
            onShowToast(`Đã gửi phản ánh "Cảnh báo sai sự thật" cho Ban Quản Trị rà soát & xử lý!`, 'info');
          }
        }
      } else {
        // Create a brand new incident report
        await submitIncident({
          trailId: selectedTrailId,
          trailName: effectiveTrailName,
          type,
          severity,
          description: description.trim(),
          locationNote: locationNote.trim() || `Khu vực: ${effectiveTrailName}`,
          coordinates: currentSelectedTrail ? { lat: currentSelectedTrail.startLat, lng: currentSelectedTrail.startLng } : undefined,
          reportedBy: currentUser?.id || (currentUser as any)?._id || (currentUser as any)?.userId,
          reporterName: currentUser?.fullName || currentUser?.username || 'Trekker Thực Địa',
          reporterEmail: currentUser?.email || '',
          reporterAvatar: currentUser?.avatarUrl || '',
          reporterRole: currentUser?.role || 'user',
        });

        if (onShowToast) {
          onShowToast(`Đã phát cảnh báo nguy hiểm tại "${effectiveTrailName}" thành công! Ghim bản đồ đã được gắn dấu chấm than (!) cảnh báo.`, 'success');
        }
      }

      setLoading(false);
      if (onSuccess) {
        onSuccess();
      }
      // Reset form
      setDescription('');
      setLocationNote('');
      onClose();
    } catch (err) {
      setLoading(false);
      if (onShowToast) {
        onShowToast('Không thể gửi báo cáo, vui lòng thử lại.', 'error');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99999, padding: 12 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 620,
          width: '100%',
          maxHeight: '94vh',
          overflowY: 'auto',
          background: 'var(--color-bg-card)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 16,
          padding: '16px 20px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-error)',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.02rem', color: 'var(--color-text-main)', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                {activeIncident ? 'Xác Thực Cảnh Báo Nguy Hiểm' : 'Gửi Báo Cáo Nguy Hiểm Thực Địa'}
              </h3>
              <div style={{ fontSize: '0.73rem', color: 'var(--color-text-dim)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--color-sky)', fontWeight: 700 }}>
                  • Người gửi: {currentUser?.fullName || currentUser?.username || 'Trekker'} ({currentUser?.email || 'Tài khoản'})
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--color-border)',
              border: 'none',
              color: 'var(--color-text-muted)',
              width: 26,
              height: 26,
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Warning Notice Box */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 8,
            padding: '6px 10px',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.73rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.35,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            Cảnh báo sẽ đồng bộ tức thì lên Bản đồ. <strong style={{ color: '#ef4444' }}>Báo động giả sẽ bị xử lý cảnh cáo và khóa vĩnh viễn tài khoản.</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 1. Địa điểm / Cung đường xảy ra sự cố */}
          <div className="form-group" style={{ position: 'relative', marginBottom: 10 }} ref={dropdownRef}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-main)', fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Địa điểm / Cung đường xảy ra sự cố *</span>
              </label>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-sky)', fontWeight: 600 }}>
                (Gõ để tìm kiếm nhanh)
              </span>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: 'var(--color-bg-main)',
                border: isDropdownOpen ? '1.5px solid var(--color-sky)' : '1px solid var(--color-border)',
                borderRadius: 8,
                padding: '0 10px',
                transition: 'all 0.2s ease',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-dim)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: 6 }}>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Gõ tên đỉnh núi, rừng quốc gia hoặc cung đường..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  padding: '7px 0',
                  color: 'var(--color-text-main)',
                  fontSize: '0.83rem',
                  fontWeight: 700,
                }}
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setIsDropdownOpen(true);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}

              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: 'var(--color-text-dim)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>

            {/* Searchable Dropdown Menu Results */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 1000,
                  marginTop: 4,
                  maxHeight: 180,
                  overflowY: 'auto',
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 10,
                  boxShadow: 'var(--shadow-card)',
                  padding: '4px',
                }}
              >
                {filteredTrails.length > 0 ? (
                  filteredTrails.map((t) => {
                    const tid = t.id || (t as any)._id;
                    const isSelected = tid === selectedTrailId;
                    return (
                      <div
                        key={tid}
                        onClick={() => {
                          setSelectedTrailId(tid);
                          setSearchTerm(t.name);
                          setIsDropdownOpen(false);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                          border: isSelected ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-main)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--color-sky)' : 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.name}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', flexShrink: 0 }}>
                            ({t.province})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          <span className="badge badge-success" style={{ fontSize: '0.64rem', padding: '1px 5px' }}>{t.region}</span>
                          <span style={{ fontSize: '0.66rem', color: 'var(--color-primary)', fontWeight: 700 }}>{t.maxAltitudeM}m</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                    <div>Không tìm thấy cung đường "{searchTerm}"</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Hazard Warning & True/False Verification Prompt */}
          {activeIncident ? (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1.5px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontWeight: 800, fontSize: '0.8rem' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>ĐÃ CÓ NGƯỜI PHÁT CẢNH BÁO TRƯỚC ĐÓ TẠI ĐỊA ĐIỂM NÀY</span>
                </div>
                <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '2px 8px', fontWeight: 800 }}>
                  {activeIncident.confirmations || 1} Trekker đã xác nhận
                </span>
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: 5, lineHeight: 1.4 }}>
                Người phát đầu tiên: <strong style={{ color: 'var(--color-text-main)' }}>{activeIncident.reporterName || 'Trekker'}</strong> ({activeIncident.reportedAt}) • Hiện trạng: <em>"{activeIncident.description}"</em>
              </div>

              {/* 2 Buttons: Xác nhận ĐÚNG vs Báo cáo SAI */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setVerifyAction('confirm_true')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    background: verifyAction === 'confirm_true' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    color: verifyAction === 'confirm_true' ? '#10b981' : 'var(--color-text-main)',
                    border: verifyAction === 'confirm_true' ? '1.5px solid #10b981' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Xác nhận thông tin ĐÚNG (+1)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVerifyAction('dispute_false')}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    background: verifyAction === 'dispute_false' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    color: verifyAction === 'dispute_false' ? '#ef4444' : 'var(--color-text-main)',
                    border: verifyAction === 'dispute_false' ? '1.5px solid #ef4444' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Báo cáo thông tin SAI (Tin giả)</span>
                </button>
              </div>
            </div>
          ) : (
            /* 2. Loại nguy hiểm & Mức độ (Only for brand new incident) */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-main)', fontSize: '0.8rem', marginBottom: 4 }}>
                  Loại nguy hiểm *
                </label>
                <select
                  className="form-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', fontSize: '0.82rem' }}
                >
                  <option value="landslide">Sạt lở đất đá / Đứt đường</option>
                  <option value="flood">Mưa to lũ ngập / Suối dâng xiết</option>
                  <option value="weather">Thời tiết xấu / Bão / Sương mù</option>
                  <option value="wildlife">Ong rừng / Động vật nguy hiểm</option>
                  <option value="lost">Mất dấu đường mòn / Đi lạc</option>
                  <option value="other">Nguy cơ an toàn khác</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-main)', fontSize: '0.8rem', marginBottom: 4 }}>
                  Mức độ nghiêm trọng *
                </label>
                <select
                  className="form-select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  <option value="critical">[Cấp 1 - Khẩn cấp] Nguy hiểm tính mạng</option>
                  <option value="high">[Cấp 2 - Mức cao] Nguy cơ lớn, cấm đi qua</option>
                  <option value="medium">[Cấp 3 - Trung bình] Cần chú ý đề phòng</option>
                  <option value="low">[Cấp 4 - Mức nhẹ] Lưu ý đường trơn trượt</option>
                </select>
              </div>
            </div>
          )}

          {/* 3. Vị trí cụ thể tại hiện trường */}
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-main)', fontSize: '0.8rem', marginBottom: 4 }}>
              Vị trí cụ thể / Mốc tọa độ tại cung đường
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Ví dụ: Đoạn qua suối số 2, cách lán 2.800m khoảng 800m..."
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', fontSize: '0.83rem' }}
            />
          </div>

          {/* 4. Mô tả chi tiết / Bổ sung thông tin */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label" style={{ fontWeight: 700, color: 'var(--color-text-main)', fontSize: '0.8rem', marginBottom: 4 }}>
              {activeIncident
                ? verifyAction === 'confirm_true'
                  ? 'Bổ sung thêm thông tin / diễn biến mới (Tùy chọn)'
                  : 'Lý do báo cáo thông tin sai sự thật / Báo động giả *'
                : 'Mô tả chi tiết tình hình thực tế *'}
            </label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder={
                activeIncident
                  ? verifyAction === 'confirm_true'
                    ? 'Bổ sung thêm thông tin (ví dụ: Nước suối vẫn sâu, đất đá chưa dọn sạch...)'
                    : 'Nêu rõ lý do (ví dụ: Tôi đang ở đúng vị trí này, đường hoàn toàn bình thường, không hề có sạt lở)...'
                  : 'Mô tả cụ thể hiện trạng (đất đá sạt chắn lối đi, mực nước suối sâu ngang ngực, gió lốc quật đổ cây...)'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required={!activeIncident || verifyAction === 'dispute_false'}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)', color: 'var(--color-text-main)', fontSize: '0.83rem', resize: 'vertical' }}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              style={{ flex: 1, borderRadius: 8, padding: '8px 12px', fontWeight: 600, fontSize: '0.84rem' }}
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              className={`btn ${activeIncident && verifyAction === 'confirm_true' ? 'btn-primary' : 'btn-danger'}`}
              disabled={loading}
              style={{
                flex: 2,
                borderRadius: 8,
                padding: '8px 12px',
                fontWeight: 800,
                fontSize: '0.86rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: activeIncident && verifyAction === 'confirm_true' ? '#10b981' : '#ef4444',
                borderColor: activeIncident && verifyAction === 'confirm_true' ? '#10b981' : '#ef4444',
                boxShadow: activeIncident && verifyAction === 'confirm_true' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : '0 4px 14px rgba(239, 68, 68, 0.35)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {activeIncident && verifyAction === 'confirm_true' ? (
                  <polyline points="20 6 9 17 4 12" />
                ) : (
                  <>
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </>
                )}
              </svg>
              <span>
                {loading
                  ? 'Đang xử lý...'
                  : activeIncident
                  ? verifyAction === 'confirm_true'
                    ? 'Xác Nhận Đúng & Bổ Sung Thông Tin'
                    : 'Gửi Phản Ánh Cảnh Báo Sai Sự Thật'
                  : 'Phát Cảnh Báo Nguy Hiểm Lên Bản Đồ'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
