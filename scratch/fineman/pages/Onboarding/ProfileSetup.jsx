import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Target, Activity, Ruler, Weight, User, Scale, Trophy } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { COURSES, FLAT_COURSES } from '../../utils/courses';

const steps = [
  { id: 'basics', title: 'The Basics', icon: <User size={24} /> },
  { id: 'metrics', title: 'Your Stats', icon: <Activity size={24} /> },
  { id: 'goals', title: 'The Goal', icon: <Target size={24} /> }
];

const ProfileSetup = ({ onComplete }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
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

  const nextStep = () => setStep(s => Math.min(s + 1, steps.length - 1));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const handleComplete = async () => {
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        ...formData,
        completedOnboarding: true,
        displayName: user.displayName || 'Student',
        username: user.email.split('@')[0],
        email: user.email,
        points: 0,
        tutorialCompleted: false,
        lastCheckedIn: new Date().toISOString().split('T')[0]
      });
      if (onComplete) onComplete(formData);
      navigate('/');
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-stepper glass-card">
        <div className="stepper-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          {steps.map((s, i) => (
            <div key={s.id} className={`step-item ${i === step ? 'active' : i < step ? 'completed' : ''}`} style={{ flex: 1, minWidth: 0 }}>
              <div className="step-icon" style={{ margin: '0 auto' }}>{s.icon}</div>
              <span className="responsive-text-hide" style={{ textAlign: 'center', marginTop: '0.5rem', fontWeight: 600 }}>{s.title}</span>
            </div>
          ))}
        </div>

        <div className="stepper-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="step-form"
            >
              {step === 0 && (
                <div className="form-group" style={{ display: 'grid', gap: '1rem' }}>
                  <h2 className="glow-emerald" style={{ margin: 0 }}>Academic Profile</h2>
                  <p className="text-secondary" style={{ margin: 0 }}>Tell us about your student status.</p>
                  
                  <div className="input-field" style={{ marginTop: '0.5rem' }}>
                    <label>Matriculation Number</label>
                    <input type="text" placeholder="e.g. 21/1234" value={formData.matric} onChange={e => setFormData({...formData, matric: e.target.value})} />
                  </div>
                  
                  <div className="input-field">
                    <label>Course of Study</label>
                    <select 
                      className="custom-select"
                      value={formData.courseOfStudy} 
                      onChange={e => setFormData({...formData, courseOfStudy: e.target.value})}
                      style={{ width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="">Select your course...</option>
                      {COURSES.map(school => (
                        <optgroup key={school.school} label={school.school}>
                          {school.courses.map(course => (
                            <option key={course} value={course}>{course}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  
                  <div className="input-field" style={{ margin: 0 }}>
                    <label>Academic Level</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
                      {['100L', '200L', '300L', '400L', '500L', '600L', 'PG'].map(l => (
                        <motion.button
                          key={l}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setFormData({...formData, level: l})}
                          className={`option-btn ${formData.level === l ? 'selected' : ''}`}
                          style={{ padding: '0.6rem', fontSize: '0.85rem' }}
                        >
                          {l}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="responsive-grid-2" style={{ marginTop: '0.5rem' }}>
                    <div className="input-field" style={{ margin: 0 }}>
                      <label>Age</label>
                      <input type="number" placeholder="Age" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} style={{ padding: '0.875rem' }} />
                    </div>
                    <div className="input-field" style={{ margin: 0 }}>
                      <label>Gender</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {['Male', 'Female'].map(g => (
                          <motion.button
                            key={g}
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setFormData({...formData, gender: g})}
                            className={`option-btn ${formData.gender === g ? 'selected' : ''}`}
                            style={{ flex: 1, padding: '0.875rem', fontSize: '0.9rem' }}
                          >
                            {g}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <h2 className="glow-emerald">Scientific Metrics</h2>
                    <p className="text-secondary">Crucial for calculating your BMR and point targets.</p>
                  </div>
                  <div className="responsive-grid-2" style={{ gap: '1.25rem' }}>
                    <div className="input-field">
                      <label><Weight size={18} /> Weight (kg)</label>
                      <input type="number" placeholder="70" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} style={{ padding: '0.875rem' }} />
                    </div>
                    <div className="input-field">
                      <label><Ruler size={18} /> Height (cm)</label>
                      <input type="number" placeholder="175" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} style={{ padding: '0.875rem' }} />
                    </div>
                  </div>

                  <div className="input-field">
                    <label>Activity Level</label>
                    <div className="responsive-grid-2" style={{ gap: '0.75rem' }}>
                      {[
                        { id: 'Sedentary', desc: 'Study life' },
                        { id: 'Lightly Active', desc: 'Walking to classes' },
                        { id: 'Moderately Active', desc: 'Gym & Sports' },
                        { id: 'Very Active', desc: 'True Athlete' }
                      ].map(a => (
                        <motion.button
                          key={a.id}
                          type="button"
                          className={`option-btn ${formData.activityLevel === a.id ? 'selected' : ''}`}
                          style={{ padding: '1.25rem 1rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
                          onClick={() => setFormData({...formData, activityLevel: a.id})}
                        >
                          <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{a.id.split(' ')[0]}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{a.desc}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="form-group">
                  <h2 className="glow-gold">BU-Track Focus</h2>
                  <p className="text-secondary">What's your biological goal for this semester?</p>
                  <div className="option-stack" style={{ gap: '1rem' }}>
                    {[
                      { id: 'Lose Weight', label: 'Lose Weight', icon: <Scale size={20} /> },
                      { id: 'Maintain', label: 'Maintain Health', icon: <Activity size={20} /> },
                      { id: 'Build Muscle', label: 'Build Muscle', icon: <Trophy size={20} /> }
                    ].map(g => (
                      <motion.button
                        key={g.id}
                        whileHover={{ x: 5 }}
                        whileTap={{ scale: 0.98 }}
                        className={`option-btn large ${formData.goal === g.id ? 'selected' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left', padding: '1.5rem' }}
                        onClick={() => setFormData({...formData, goal: g.id})}
                      >
                        <div style={{ 
                          padding: '0.75rem', 
                          background: formData.goal === g.id ? 'rgba(255,255,255,0.1)' : 'rgba(16,185,129,0.1)', 
                          borderRadius: '12px',
                          color: formData.goal === g.id ? '#fff' : 'var(--accent-emerald)'
                        }}>
                          {g.icon}
                        </div>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{g.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="stepper-footer">
          {step > 0 && (
            <button className="nav-btn secondary" onClick={prevStep}>
              <ChevronLeft size={20} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < steps.length - 1 ? (
            <button className="nav-btn primary" onClick={nextStep}>
              Next <ChevronRight size={20} />
            </button>
          ) : (
            <button className="nav-btn primary finish" onClick={handleComplete} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Finish Setup'} <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProfileSetup;
