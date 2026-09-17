import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  ChevronLeft,
  Mail,
  GraduationCap,
  Scale,
  Ruler,
  Hash,
  BookOpen,
  Trophy,
  ShieldAlert,
  Key,
  Activity,
  LogOut,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { COURSES } from '../../utils/courses';
import ConfirmModal from '../../components/ConfirmModal';

const Profile = () => {
  const { user, resetPassword, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    username: '',
    matric: '',
    courseOfStudy: '',
    level: '',
    age: '',
    gender: '',
    weight: '',
    height: '',
    activityLevel: 'Sedentary',
    goal: ''
  });

  useEffect(() => {
    if (user?.profile) {
      setFormData({
        displayName: user.profile.displayName || user.displayName || '',
        username: user.profile.username || user.email.split('@')[0] || '',
        matric: user.profile.matric || '',
        courseOfStudy: user.profile.courseOfStudy || '',
        level: user.profile.level || '',
        age: user.profile.age || '',
        gender: user.profile.gender || '',
        weight: user.profile.weight || '',
        height: user.profile.height || '',
        activityLevel: user.profile.activityLevel || 'Sedentary',
        goal: user.profile.goal || ''
      });
    }
  }, [user]);

  const handleUpdate = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        ...formData,
        lastModified: new Date().toISOString()
      });
      setMessage("Profile updated successfully!");
    } catch (err) {
      console.error("Profile update error:", err);
      setError("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      await resetPassword(user.email);
      setMessage("Password reset link sent to your Babcock email.");
    } catch (err) {
      setError("Failed to send reset link.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError("Failed to logout");
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    try {
      await deleteAccount();
      navigate('/login');
    } catch (err) {
      if (err.code === 'auth/requires-recent-login') {
        setError("For security, please log out and log back in before deleting your account.");
      } else {
        setError("Failed to delete account. You may need to sign in again first.");
      }
    }
  };

  const retriggerTutorial = async () => {
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { tutorialCompleted: false });
      navigate('/');
    } catch (err) {
      setError("Failed to reset tutorial.");
    }
  };

  return (
    <div className="profile-container container animate-fade-in">
      <ConfirmModal 
         isOpen={showDeleteConfirm} 
         onClose={() => setShowDeleteConfirm(false)} 
         onConfirm={executeDelete} 
         title="Delete Built Profile?" 
         message="Are you sure you want to completely erase your campus ecosystem account? This action is strictly permanent and cannot be undone." 
         confirmText="Erase"
         danger={true} 
      />

      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={20} /> Back</button>
        <h1 className="glow-emerald">Profile Settings</h1>
        <div style={{ width: '40px' }} />
      </header>

      <form onSubmit={handleUpdate} className="profile-grid" style={{ alignItems: 'start' }}>
        
        {/* Left Column: Identity & Security */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card text-center" style={{ padding: '2rem' }}>
            <div className="avatar-circle" style={{ width: 100, height: 100, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2.5rem', color: '#fff', fontWeight: 'bold' }}>{formData.displayName?.charAt(0).toUpperCase() || 'U'}</span>
            </div>
            <h2 style={{ margin: 0, color: '#f8fafc' }}>{formData.displayName}</h2>
            <p className="text-secondary" style={{ marginBottom: '1.5rem' }}>@{formData.username}</p>
            
            <div className="input-group" style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={14}/> Babcock Email</label>
              <input type="text" value={user?.email} readOnly style={{ cursor: 'not-allowed', color: 'var(--text-muted)', opacity: 0.8, fontSize: '16px' }} />
              <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>Verified Student Status</p>
            </div>
          </motion.div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}><ShieldAlert size={18} /> Support & Learning</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <button type="button" onClick={retriggerTutorial} className="toggle-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <Trophy size={16} /> Open BU-Track Guide
              </button>
              <button type="button" onClick={handlePasswordReset} className="toggle-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', padding: '0.75rem' }}>
                <Key size={16} /> Request Password Reset
              </button>
            </div>
          </motion.div>

          {message && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.3)' }}>{message}</motion.div>}
          {error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>{error}</motion.div>}

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }} className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', color: '#ef4444' }}><ShieldAlert size={18} /> Danger Zone</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <button type="button" onClick={handleLogout} className="toggle-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}>
                <LogOut size={16} /> Secure Logout
              </button>
              <button type="button" onClick={handleDeleteAccount} className="toggle-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <Trash2 size={16} /> Delete Account Permanently
              </button>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Editable Details */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card" style={{ padding: '2rem' }}>
          
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#10b981', marginBottom: '2rem' }}>
            <BookOpen size={20} />
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Academic Information</span>
          </div>

          <div className="responsive-grid-2" style={{ gap: '1.25rem' }}>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label>Full Name</label>
              <input type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} style={{ fontSize: '16px' }} />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label><Hash size={16}/> Matric Number</label>
              <input type="text" value={formData.matric} onChange={e => setFormData({...formData, matric: e.target.value})} style={{ fontSize: '16px' }} />
            </div>
            <div className="input-group">
              <label>User Handle</label>
              <input type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} style={{ fontSize: '16px' }} />
            </div>
            <div className="input-group">
              <label>Course of Study</label>
              <select 
                className="custom-select"
                value={formData.courseOfStudy} 
                onChange={e => setFormData({...formData, courseOfStudy: e.target.value})}
                style={{ width: '100%', padding: '0.875rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', borderRadius: '12px', color: '#fff', fontSize: '16px' }}
              >
                {COURSES.map(school => (
                  <optgroup key={school.school} label={school.school}>
                    {school.courses.map(course => (
                      <option key={course} value={course}>{course}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}><GraduationCap size={14}/> Academic Level</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem' }}>
              {['100L', '200L', '300L', '400L', '500L', '600L', 'PG'].map(l => (
                <button 
                  key={l} 
                  type="button"
                  onClick={() => setFormData({...formData, level: l})}
                  className={`option-btn ${formData.level === l ? 'selected' : ''}`}
                  style={{ padding: '0.5rem', fontSize: '0.8rem' }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#3b82f6', margin: '3rem 0 2rem 0' }}>
            <Activity size={20} />
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Physical Metrics</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="input-group" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem', gridColumn: 'span 2' }}>
              <div>
                <label>Age</label>
                <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} style={{ fontSize: '16px' }} />
              </div>
              <div>
                <label>Gender</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['Male', 'Female'].map(g => (
                    <button key={g} type="button" onClick={() => setFormData({...formData, gender: g})} className={`option-btn ${formData.gender === g ? 'selected' : ''}`} style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}>{g}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.25rem' }}>
              <div>
                <label><Scale size={16}/> Weight (kg)</label>
                <input type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} style={{ fontSize: '16px' }} />
              </div>
              <div>
                <label><Ruler size={16}/> Height (cm)</label>
                <input type="number" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} style={{ fontSize: '16px' }} />
              </div>
            </div>
            
            <div className="input-field" style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Activity Level</label>
              <div className="responsive-grid-2" style={{ gap: '0.75rem' }}>
                {['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'].map(a => (
                  <button key={a} type="button" onClick={() => setFormData({...formData, activityLevel: a})} className={`option-btn ${formData.activityLevel === a ? 'selected' : ''}`} style={{ padding: '0.875rem 0.5rem', fontSize: '0.75rem' }}>{a}</button>
                ))}
              </div>
            </div>

            <div className="input-field" style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}><Trophy size={14}/> Active Goal</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
                {[
                  { id: 'Lose Weight', icon: <Scale size={16} /> },
                  { id: 'Maintain', icon: <Activity size={16} /> },
                  { id: 'Build Muscle', icon: <Trophy size={16} /> }
                ].map(g => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setFormData({...formData, goal: g.id})}
                    className={`option-btn ${formData.goal === g.id ? 'selected' : ''}`}
                    style={{ padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    {g.icon} {g.id.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button type="submit" disabled={isSaving} className="log-btn primary" style={{ width: '100%', marginTop: '3rem' }}>
            {isSaving ? 'Synchronizing Firestore...' : 'Save Profile Changes'}
          </button>
        </motion.div>

      </form>
    </div>
  );
};

export default Profile;
