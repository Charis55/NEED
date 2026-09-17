import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', danger = false }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-card"
          style={{ width: '90%', maxWidth: '400px', padding: '1.5rem', borderRadius: '1rem', border: danger ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255,255,255,0.1)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: danger ? '#ef4444' : '#f8fafc', margin: 0 }}>
              {danger && <AlertTriangle size={20} />} {title}
            </h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            {message}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button 
              onClick={onClose} 
              style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', padding: '0.6rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button 
              onClick={() => { onConfirm(); onClose(); }} 
              style={{ background: danger ? '#ef4444' : '#10b981', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmModal;
