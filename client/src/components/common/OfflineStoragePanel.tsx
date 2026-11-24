import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Trail } from '../../types.js';
import {
  listOfflineTrailPacks,
  getOfflineStorageStats,
  downloadOfflineTrailPack,
  deleteOfflineTrailPack,
  clearDynamicTileCache,
  type OfflineTrailPackRecord,
  type OfflineStorageStats,
} from '../../utils/offlinePack.js';
import {
  IconDownload,
  IconTrash,
  IconCheckCircle,
  IconRotateCw,
  IconMapPin,
  IconShieldCheck,
  IconAlertTriangle,
} from './SvgIcons.js';

export interface OfflineStoragePanelProps {
  trails: Trail[];
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const OfflineStoragePanel: React.FC<OfflineStoragePanelProps> = ({ trails, onShowToast }) => {
  const [packs, setPacks] = useState<OfflineTrailPackRecord[]>([]);
  const [stats, setStats] = useState<OfflineStorageStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedTrailId, setSelectedTrailId] = useState<string>('');
  const [downloadingTrailId, setDownloadingTrailId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ pct: number; fetched: number; total: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearingDynamic, setIsClearingDynamic] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const downloadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      downloadAbortRef.current?.abort();
      downloadAbortRef.current = null;
    };
  }, []);

  const emitToast = useCallback(
    (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (onShowToast) onShowToast(msg, type);
      else window.dispatchEvent(new CustomEvent('lost:show-toast', { detail: { message: msg, type } }));
    },
    [onShowToast]
  );

  const refreshStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedPacks, loadedStats] = await Promise.all([
        listOfflineTrailPacks(),
        getOfflineStorageStats(),
      ]);
      if (!isMountedRef.current) return;
      loadedPacks.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      setPacks(loadedPacks);
      setStats(loadedStats);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOfflineTrailPacks(), getOfflineStorageStats()])
      .then(([loadedPacks, loadedStats]) => {
        if (cancelled) return;
        loadedPacks.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        setPacks(loadedPacks);
        setStats(loadedStats);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const savedIdSet = useMemo(() => new Set(packs.map((p) => p.trailId)), [packs]);

  const sortedCatalogTrails = useMemo(() => {
    return [...(Array.isArray(trails) ? trails : [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'vi')
    );
  }, [trails]);

  const activeSelectId = selectedTrailId || sortedCatalogTrails[0]?.id || '';

  const handleDownloadPack = async (trailToDownload: Trail, forceRefresh = false) => {
    if (downloadingTrailId || deletingId) return;
    setConfirmDeleteId(null);
    downloadAbortRef.current?.abort();
    const controller = new AbortController();
    downloadAbortRef.current = controller;
    setDownloadingTrailId(trailToDownload.id);
    setDownloadProgress({ pct: 0, fetched: 0, total: 0 });
    try {
      const record = await downloadOfflineTrailPack(
        trailToDownload,
        (pct, fetched, total) => {
          if (!isMountedRef.current) return;
          setDownloadProgress({ pct, fetched, total });
        },
        { forceRefresh, signal: controller.signal }
      );
      if (!isMountedRef.current) return;
      await refreshStorage();
      if (!isMountedRef.current) return;
      const partialNote =
        record.failedCount && record.failedCount > 0
          ? ` (${record.failedCount} ô không phản hồi)`
          : '';
      emitToast(
        `Đã lưu gói Offline ${trailToDownload.name}: ${record.tileCount}/${record.totalRequestedTiles || record.tileCount} ô bản đồ (~${record.estimatedSizeMb} MB)${partialNote}.`,
        'success'
      );
    } catch (err) {
      if (!isMountedRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      emitToast(
        err instanceof Error ? err.message : 'Không thể tải gói bản đồ ngoại tuyến lúc này.',
        'error'
      );
    } finally {
      if (downloadAbortRef.current === controller) {
        downloadAbortRef.current = null;
      }
      if (isMountedRef.current) {
        setDownloadingTrailId(null);
        setDownloadProgress(null);
      }
    }
  };

  const handleDeletePack = async (trailId: string, trailName: string) => {
    if (deletingId || downloadingTrailId) return;
    setDeletingId(trailId);
    try {
      await deleteOfflineTrailPack(trailId);
      if (!isMountedRef.current) return;
      setConfirmDeleteId(null);
      await refreshStorage();
      if (!isMountedRef.current) return;
      emitToast(`Đã xóa gói Offline "${trailName}" (giữ nguyên các ô bản đồ dùng chung với cung khác).`, 'info');
    } catch {
      if (isMountedRef.current) {
        emitToast('Không thể xóa gói Offline lúc này.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setDeletingId(null);
      }
    }
  };

  const handleClearDynamicCache = async () => {
    if (isClearingDynamic) return;
    setIsClearingDynamic(true);
    try {
      const removed = await clearDynamicTileCache();
      if (!isMountedRef.current) return;
      await refreshStorage();
      if (!isMountedRef.current) return;
      emitToast(
        removed > 0
          ? `Đã dọn ${removed.toLocaleString('vi-VN')} ô bản đồ cache tự động. Các gói Offline đã lưu vẫn an toàn.`
          : 'Bộ nhớ cache bản đồ tự động đang trống.',
        'success'
      );
    } catch {
      if (isMountedRef.current) {
        emitToast('Không thể dọn bộ nhớ cache bản đồ tự động lúc này.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsClearingDynamic(false);
      }
    }
  };

  const quotaPct = stats ? Math.max(0, Math.min(100, stats.usagePercent)) : 0;
  const quotaBarColor =
    quotaPct >= 85 ? 'var(--color-error)' : quotaPct >= 60 ? 'var(--color-sun)' : 'var(--color-primary)';
  const quotaTextColor =
    quotaPct >= 85
      ? 'var(--color-error-text, var(--color-error))'
      : quotaPct >= 60
      ? 'var(--color-sun)'
      : 'var(--color-primary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: 'var(--font-family)' }}>
      {/* Storage Quota Overview Card with Pure SVG Bar */}
      <div
        className="card"
        style={{
          padding: '18px 20px',
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-strong)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
              <IconShieldCheck size={16} color="var(--color-primary)" />
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--color-primary)',
                }}
              >
                Quản Lý Bộ Nhớ Ngoại Tuyến (IndexedDB + Service Worker)
              </span>
            </div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0 }}>
              Kho Bản Đồ Offline &amp; Dung Lượng Thiết Bị
            </h3>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void refreshStorage()}
            disabled={isLoading}
            style={{ padding: '6px 12px', fontSize: '0.76rem', borderRadius: 4 }}
          >
            <IconRotateCw size={13} />
            <span>Cập nhật dung lượng</span>
          </button>
        </div>

        {/* Pure Inline SVG Quota Progress Bar */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 4,
            background: 'var(--color-bg-main)',
            border: '1px solid var(--color-border)',
            marginBottom: 14,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              {stats?.quotaSupported ? 'Dung lượng trình duyệt đã cấp phát' : 'Ước tính bộ nhớ bản đồ ngoại tuyến'}
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: quotaTextColor }}>
              {stats ? `${stats.usageMb} MB / ${stats.quotaMb.toLocaleString('vi-VN')} MB (${quotaPct}%)` : 'Đang đo...'}
            </span>
          </div>

          <svg
            width="100%"
            height="10"
            viewBox="0 0 400 10"
            preserveAspectRatio="none"
            role="progressbar"
            aria-valuenow={Math.round(quotaPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Đã sử dụng ${quotaPct}% dung lượng bộ nhớ ngoại tuyến`}
            style={{ display: 'block', borderRadius: 3 }}
          >
            <rect x="0" y="0" width="400" height="10" rx="3" fill="var(--color-surface-elevated)" />
            <rect
              x="0"
              y="0"
              width={Math.max(quotaPct > 0 ? 6 : 0, Math.round((quotaPct / 100) * 400))}
              height="10"
              rx="3"
              fill={quotaBarColor}
            />
          </svg>
        </div>

        {/* 3 Storage Breakdown KPI Cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
            gap: 10,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div style={{ padding: '10px 12px', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Gói Cung Đường Đã Lưu
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: 3 }}>
              {stats?.savedPacksCount ?? 0} cung ({stats?.estimatedPacksMb ?? 0} MB)
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {stats?.offlinePackTileCount ?? 0} ô bản đồ OSM được bảo vệ
            </div>
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 4, background: 'var(--color-bg-main)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
              Cache Bản Đồ Tự Động
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-sky)', marginTop: 3 }}>
              {stats?.dynamicTileCount ?? 0} ô (~{stats?.estimatedDynamicMb ?? 0} MB)
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              Lưu tự động khi xem bản đồ (tối đa 450 ô)
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 4,
              background: 'var(--color-bg-main)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              Dọn cache tự động giúp giải phóng bộ nhớ mà không ảnh hưởng các gói cung đường đã tải chủ động.
            </div>
            <button
              type="button"
              onClick={() => void handleClearDynamicCache()}
              disabled={isClearingDynamic || (stats?.dynamicTileCount ?? 0) === 0}
              className="btn btn-outline"
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                borderRadius: 4,
                justifyContent: 'center',
                opacity: isClearingDynamic || (stats?.dynamicTileCount ?? 0) === 0 ? 0.55 : 1,
              }}
            >
              <IconTrash size={13} color="var(--color-earth)" />
              <span>{isClearingDynamic ? 'Đang dọn...' : 'Dọn Cache Tự Động'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Download Picker for All Real Catalog Trails (36 DEM Trails) */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: 10 }}>
          Tải Nhanh Gói Bản Đồ Offline ({sortedCatalogTrails.length} cung · Zoom 12–14 + GPX)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select
            aria-label="Chọn cung đường cần tải gói bản đồ Offline"
            value={activeSelectId}
            onChange={(e) => setSelectedTrailId(e.target.value)}
            className="form-select"
            style={{ flex: '1 1 240px', minWidth: 0, fontSize: '0.84rem' }}
          >
            {sortedCatalogTrails.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.province} · {t.maxAltitudeM.toLocaleString('vi-VN')}m)
                {savedIdSet.has(t.id) ? ' — Đã tải' : ''}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!activeSelectId || downloadingTrailId !== null || deletingId !== null}
            onClick={() => {
              const chosen = sortedCatalogTrails.find((t) => t.id === activeSelectId);
              if (chosen) void handleDownloadPack(chosen, savedIdSet.has(chosen.id));
            }}
            style={{
              padding: '9px 16px',
              borderRadius: 4,
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: downloadingTrailId !== null || deletingId !== null ? 0.65 : 1,
            }}
          >
            <IconDownload size={14} color="var(--color-on-primary)" />
            <span>
              {downloadingTrailId && downloadProgress
                ? downloadProgress.total > 0
                  ? `Đang tải ${downloadProgress.pct}% (${downloadProgress.fetched}/${downloadProgress.total} ô)...`
                  : 'Đang chuẩn bị ô bản đồ...'
                : savedIdSet.has(activeSelectId)
                ? 'Cập nhật lại gói Offline'
                : 'Tải Gói Offline'}
            </span>
          </button>
        </div>

        {downloadProgress && (
          <div style={{ marginTop: 10 }}>
            <svg
              width="100%"
              height="6"
              viewBox="0 0 400 6"
              preserveAspectRatio="none"
              role="progressbar"
              aria-valuenow={downloadProgress.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Tiến độ tải gói bản đồ ngoại tuyến ${downloadProgress.pct}%`}
            >
              <rect x="0" y="0" width="400" height="6" rx="2" fill="var(--color-surface-elevated)" />
              <rect
                x="0"
                y="0"
                width={Math.round((downloadProgress.pct / 100) * 400)}
                height="6"
                rx="2"
                fill="var(--color-primary)"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Saved Offline Trail Packs Ledger */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          borderRadius: 6,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
            Danh Sách Gói Cung Đường Đã Lưu Ngoại Tuyến ({packs.length})
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
            Hoạt động khi mất sóng 4G/5G (tự động dự phòng lớp OSM)
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.84rem' }}>
            Đang kiểm tra kho dữ liệu Offline...
          </div>
        ) : packs.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              background: 'var(--color-bg-main)',
              borderRadius: 4,
              border: '1px dashed var(--color-border-strong)',
              color: 'var(--color-text-muted)',
              fontSize: '0.84rem',
            }}
          >
            Bạn chưa tải gói bản đồ Offline nào. Hãy chọn một cung đường ở khung trên trước khi vào rừng mất sóng!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {packs.map((pack) => {
              const totalReq = pack.totalRequestedTiles || pack.tileCount;
              const isPartial = Boolean(pack.failedCount && pack.failedCount > 0);
              const isConfirming = confirmDeleteId === pack.trailId;
              const isDeleting = deletingId === pack.trailId;
              const isRedownloading = downloadingTrailId === pack.trailId;

              return (
                <div
                  key={pack.trailId}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 4,
                    background: 'var(--color-bg-main)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      {isPartial ? (
                        <IconAlertTriangle size={14} color="var(--color-sun)" />
                      ) : (
                        <IconCheckCircle size={14} color="var(--color-primary)" />
                      )}
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-text-main)' }}>
                        {pack.trailName}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                          color: 'var(--color-primary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pack.tileCount}/{totalReq} ô · ~{pack.estimatedSizeMb} MB
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.73rem',
                        color: 'var(--color-text-dim)',
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <IconMapPin size={11} /> {pack.province}
                      </span>
                      <span>·</span>
                      <span>
                        Lưu lúc:{' '}
                        {new Date(pack.savedAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={downloadingTrailId !== null || deletingId !== null}
                      onClick={() => void handleDownloadPack(pack.trailData, true)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        borderRadius: 4,
                        opacity: downloadingTrailId !== null || deletingId !== null ? 0.55 : 1,
                        cursor: downloadingTrailId !== null || deletingId !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <IconRotateCw size={12} />
                      <span>{isRedownloading ? 'Đang tải...' : 'Cập nhật'}</span>
                    </button>

                    {isConfirming ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 8px',
                          borderRadius: 4,
                          background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-bg-card))',
                          border: '1px solid color-mix(in srgb, var(--color-error) 35%, transparent)',
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-error-text, var(--color-error))' }}>
                          Xóa gói?
                        </span>
                        <button
                          type="button"
                          disabled={isDeleting || deletingId !== null || downloadingTrailId !== null}
                          onClick={() => void handleDeletePack(pack.trailId, pack.trailName)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: 'none',
                            background: 'var(--color-error)',
                            color: 'var(--color-on-danger)',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            opacity: deletingId !== null || downloadingTrailId !== null ? 0.65 : 1,
                            cursor: isDeleting
                              ? 'wait'
                              : deletingId !== null || downloadingTrailId !== null
                              ? 'not-allowed'
                              : 'pointer',
                          }}
                        >
                          {isDeleting ? 'Đang xóa...' : 'Xác nhận'}
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: '1px solid var(--color-border-strong)',
                            background: 'var(--color-bg-card)',
                            color: 'var(--color-text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: isDeleting ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={downloadingTrailId !== null || deletingId !== null}
                        onClick={() => setConfirmDeleteId(pack.trailId)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 10px',
                          borderRadius: 4,
                          border: '1px solid color-mix(in srgb, var(--color-error) 30%, transparent)',
                          background: 'color-mix(in srgb, var(--color-error) 8%, var(--color-bg-card))',
                          color: 'var(--color-error-text, var(--color-error))',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          opacity: downloadingTrailId !== null || deletingId !== null ? 0.55 : 1,
                          cursor: downloadingTrailId !== null || deletingId !== null ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <IconTrash size={12} color="var(--color-error-text, var(--color-error))" />
                        <span>Xóa</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
