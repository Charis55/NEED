import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, RefreshCw, Send, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../firebase';

const VerifyEmail = () => {
  const { user, logout, resendVerification } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendVerification();
      setMessage("A fresh verification link has been sent to your student email.");
    } catch (err) {
      setMessage("Failed to resend. Please try again in 1 minute.");
    } finally {
      setIsResending(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await auth.currentUser.reload();
      // OnAuthStateChanged in AuthContext will catch this and update the 'user' object
      window.location.reload(); 
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="login-container">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        class="glass-card login-card"
        style={{ padding: 'max(1.5rem, 3rem) max(1rem, 2.5rem)', textAlign: 'center' }}
      >
        <div className="login-logo-ring">
          <Mail size={32} />
        </div>
        
        <div className="login-header">
          <h1 className="glow-emerald" style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)' }}>Identify Yourself</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem' }}>We've sent a verification link to:</p>
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '16px', border: '1px solid var(--border-emerald)', margin: '1rem 0', wordBreak: 'break-all' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{user?.email}</span>
          </div>
          <p style={{ fontSize: '0.85rem', opacity: 0.8, lineHeight: '1.5' }}>Check your student inbox (including spam) and click the activation link to gain Semester Cup access.</p>
        </div>

        <div className="login-actions" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="login-btn primary-btn"
            style={{ width: '100%', minHeight: '52px' }}
          >
            {isRefreshing ? <RefreshCw size={18} className="spin" /> : <RefreshCw size={18} />}
            I've Verified My Email
          </button>

          <button 
            onClick={handleResend} 
            disabled={isResending}
            className="login-btn secondary-btn"
            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-subtle)', width: '100%', minHeight: '52px' }}
          >
            {isResending ? <RefreshCw size={18} className="spin" /> : <Send size={18} />}
            Resend Verification Link
          </button>

          <button 
            onClick={logout} 
            className="toggle-btn"
            style={{ marginTop: '0.75rem', color: '#ef4444', opacity: 0.8, fontSize: '0.85rem' }}
          >
            <LogOut size={16} /> Sign Out & Use Different Email
          </button>
        </div>

        {message && (
          <motion.div 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="error-text" 
            style={{ marginTop: '1.5rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
          >
            {message}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
