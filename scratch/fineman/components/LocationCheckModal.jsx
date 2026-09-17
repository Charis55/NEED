import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, CheckCircle, XCircle, AlertTriangle, Loader, Navigation } from 'lucide-react';

/**
 * LocationCheckModal
 * Overlay that shows during and after geolocation verification.
 *
 * Props:
 *  status      — 'checking' | 'verified' | 'out_of_range' | 'permission_denied' | 'unavailable'
 *  distanceM   — metres from nearest venue (when out_of_range)
 *  nearestVenue — name of nearest valid venue
 *  hint        — rule hint string
 *  onConfirm   — called when user wants to override out-of-range and log anyway
 *  onCancel    — called when user cancels
 */
export default function LocationCheckModal({
  status,
  distanceM,
  nearestVenue,
  hint,
  onConfirm,
  onCancel,
}) {
  const isOpen = !!status;

  const configs = {
    checking: {
      icon: <Loader size={40} className="loc-spin" style={{ color: '#10b981' }} />,
      title: 'Verifying GPS…',
      body: 'Locking coordinates against campus venues. Please wait.',
      color: '#10b981',
      showActions: false,
    },
    verified: {
      icon: <CheckCircle size={40} style={{ color: '#10b981' }} />,
      title: 'Confirmed On-Campus ✓',
      body: `Verified! You're confirmed at ${nearestVenue}. Logging your workout…`,
      color: '#10b981',
      showActions: false,
    },
    out_of_range: {
      icon: <AlertTriangle size={40} style={{ color: '#f59e0b' }} />,
      title: 'Off-Campus Activity',
      body: `Workout Log Blocked: You must be at the designated campus venue to log this activity. ${hint ?? ''}`,
      color: '#f59e0b',
      showActions: true,
      cancelLabel: 'Close',
      confirmLabel: null,
    },
    permission_denied: {
      icon: <XCircle size={40} style={{ color: '#ef4444' }} />,
      title: 'Location Access Denied',
      body: 'BU-Track needs location access to verify your workout. Please enable it in your browser settings and try again.',
      color: '#ef4444',
      showActions: true,
      cancelLabel: 'Close',
      confirmLabel: null,
    },
    unavailable: {
      icon: <XCircle size={40} style={{ color: '#ef4444' }} />,
      title: 'Location Unavailable',
      body: 'Could not retrieve your GPS position. Please make sure GPS is enabled on your device.',
      color: '#ef4444',
      showActions: true,
      cancelLabel: 'Close',
      confirmLabel: null,
    },
  };

  const cfg = configs[status] ?? configs.checking;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="loc-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            padding: '1.5rem',
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{
              background: 'linear-gradient(145deg, rgba(15,23,42,0.98), rgba(8,12,24,0.99))',
              border: `1px solid ${cfg.color}50`,
              borderRadius: '1.5rem',
              padding: '2rem',
              maxWidth: '400px',
              width: '100%',
              boxShadow: `0 0 60px ${cfg.color}25, 0 30px 60px rgba(0,0,0,0.8)`,
            }}
          >
            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: `${cfg.color}15`,
                border: `1.5px solid ${cfg.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {cfg.icon}
              </div>
            </div>

            {/* Text */}
            <h3 style={{
              textAlign: 'center', fontWeight: 800, fontSize: '1.2rem',
              color: '#f1f5f9', marginBottom: '0.75rem',
            }}>
              {cfg.title}
            </h3>
            <p style={{
              textAlign: 'center', fontSize: '0.85rem',
              color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem',
            }}>
              {cfg.body}
            </p>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '1.25rem' }} />

            {/* Actions */}
            {cfg.showActions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  onClick={onCancel}
                  style={{
                    width: '100%', padding: '0.85rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0.875rem', color: 'var(--text-muted)',
                    fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                  }}
                >
                  {cfg.cancelLabel || 'Cancel'}
                </button>
                {cfg.confirmLabel && (
                  <button
                    onClick={onConfirm}
                    style={{
                      width: '100%', padding: '0.85rem',
                      borderRadius: '0.875rem',
                      fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
                      ...cfg.confirmStyle,
                    }}
                  >
                    {cfg.confirmLabel}
                  </button>
                )}
              </div>
            )}

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
