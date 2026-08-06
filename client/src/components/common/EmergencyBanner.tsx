import React, { useEffect, useState } from 'react';
import { getSocket } from '../../utils/socket.js';

export const EmergencyBanner: React.FC<{ onOpenContacts: () => void }> = ({ onOpenContacts }) => {
  const [criticalIncident, setCriticalIncident] = useState<any | null>(null);

  // Fetch active critical incident or listen to realtime socket emergencyAlert
  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await fetch('/api/incidents');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const critical = data.data.find((i: any) => i.severity === 'critical' || i.severity === 'high');
          if (critical && !critical.resolved) {
            setCriticalIncident(critical);
          }
        }
      } catch (err) {}
    };

    fetchIncidents();

    // Listen realtime via Socket.io
    const socket = getSocket();
    if (socket) {
      const handleEmergency = (eventData: any) => {
        if (eventData && eventData.incident) {
          setCriticalIncident(eventData.incident);
        }
      };
      socket.on('emergencyAlert', handleEmergency);
      return () => {
        socket.off('emergencyAlert', handleEmergency);
      };
    }
  }, []);

  if (!criticalIncident) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #dc2626 0%, #b91c1c 100%)',
        color: '#ffffff',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        boxShadow: '0 4px 16px rgba(220, 38, 38, 0.4)',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ background: '#ffffff', color: '#dc2626', padding: '3px 8px', borderRadius: 6, fontWeight: 900, fontSize: '0.78rem' }}>
          🚨 SOS CỨU HỘ KHẨN CẤP
        </span>
        <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
          {criticalIncident.trailName || 'Khu Vực Trekking'}: {criticalIncident.description}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onOpenContacts}
          style={{
            background: '#ffffff',
            color: '#dc2626',
            border: 'none',
            padding: '6px 14px',
            borderRadius: 20,
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          }}
        >
          📞 Gọi Đội Cứu Hộ Khẩn Cấp
        </button>
        <button
          onClick={() => setCriticalIncident(null)}
          style={{
            background: 'transparent',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.4)',
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Ẩn
        </button>
      </div>
    </div>
  );
};
