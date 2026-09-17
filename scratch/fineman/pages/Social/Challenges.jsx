import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ChevronLeft, Flag, Users, Clock, Zap, Calendar, Heart, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ShareModal from '../../components/ShareModal';
import { 
  getDailyChallenges, 
  enrollInChallenge, 
  getChallengeParticipants,
  getEnrollmentCount 
} from '../../utils/db';

const ChallengeCard = ({ challenge, user }) => {
  const [participants, setParticipants] = useState([]);
  const [count, setCount] = useState(0);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const p = await getChallengeParticipants(challenge.id);
      const c = await getEnrollmentCount(challenge.id);
      setParticipants(p);
      setCount(c);
      setEnrolled(p.includes(user?.profile?.username));
      setLoading(false);
    };
    fetchData();
  }, [challenge.id, user?.profile?.username]);

  const handleEnroll = async () => {
    if (enrolled) return;
    setEnrolled(true);
    setCount(prev => prev + 1);
    setParticipants(prev => [...prev, user?.profile?.username]);
    await enrollInChallenge(challenge.id, user.uid);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card" 
      style={{ padding: 'max(1rem, 1.5rem)', border: enrolled ? '1px solid var(--border-emerald)' : '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}
    >
      <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h3 style={{ margin: 0, color: enrolled ? 'var(--accent-emerald)' : '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: 'clamp(1rem, 4vw, 1.15rem)', fontWeight: 800 }}>
            <Flag size={20} /> {challenge.title}
          </h3>
          <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.875rem', lineHeight: '1.5', opacity: 0.9 }}>{challenge.desc}</p>
        </div>
        {enrolled && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.05em', border: '1px solid var(--border-emerald)' }}>
            ENROLLED
          </motion.div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '16px' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              <Users size={14} /> <span>{count} Students Enrolled</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
              {participants.length > 0 ? (
                <>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 700 }}>
                    {participants.slice(0, 2).map(p => `@${p}`).join(', ')} {participants.length > 2 ? `+${participants.length - 2}` : ''}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>are active!</span>
                </>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Be the first to join!</span>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', flex: '1 1 100%' }}>
            <button 
              onClick={() => setShareModalOpen(true)}
              style={{ 
                background: 'rgba(255,255,255,0.05)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '12px', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 
              }}
            >
              <Share2 size={18} />
            </button>
            <button 
              onClick={handleEnroll} 
              disabled={enrolled}
              className={`log-btn ${enrolled ? 'secondary' : 'primary'}`}
              style={{ flex: 1, padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 800, borderRadius: '12px' }}
            >
              {enrolled ? 'See You There' : 'Join Session'}
            </button>
          </div>
        </div>
      </div>
      <ShareModal 
        isOpen={shareModalOpen} 
        onClose={() => setShareModalOpen(false)} 
        type="challenge" 
        payload={challenge} 
      />
    </motion.div>
  );
};

const Challenges = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dailyData, setDailyData] = useState(null);

  useEffect(() => {
    setDailyData(getDailyChallenges());
  }, []);

  if (!dailyData) return null;

  return (
    <div className="container animate-fade-in" style={{ paddingBottom: '9rem' }}>
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={20} /> Back</button>
        <h1 className="glow-emerald">Campus Challenges</h1>
        <div style={{ width: '40px' }} />
      </header>

      <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
        {/* State Banners */}
        {dailyData.type === 'REST_DAY' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center', border: '1.5px dashed var(--border-gold)' }}>
            <Calendar size={48} color="var(--accent-gold)" style={{ margin: '0 auto 1.5rem' }} />
            <h2 className="glow-gold">Sabbath Rest Day</h2>
            <p className="text-secondary" style={{ maxWidth: '400px', margin: '0.5rem auto' }}>Take today to recharge both physically and spiritually. No active challenges on Saturdays.</p>
          </motion.div>
        )}

        {dailyData.type === 'FRIDAY_CLOSED' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: '3rem 2rem', textAlign: 'center', border: '1.5px dashed var(--accent-emerald)' }}>
            <Clock size={48} color="var(--accent-emerald)" style={{ margin: '0 auto 1.5rem' }} />
            <h2 className="glow-emerald">Preparation Day</h2>
            <p className="text-secondary" style={{ maxWidth: '400px', margin: '0.5rem auto' }}>Friday challenges are morning-only. Check back early next week to smash your goals!</p>
          </motion.div>
        )}

        {dailyData.type === 'ACTIVE' && (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: 'max(1.5rem, 2rem)', textAlign: 'center', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)', borderRadius: '24px' }}>
              <Zap size={40} color="var(--accent-emerald)" style={{ margin: '0 auto 1.25rem' }} />
              <h3 style={{ fontSize: 'clamp(1.1rem, 5vw, 1.5rem)', fontWeight: 800 }}>Daily Double Duo</h3>
              <p className="text-secondary" style={{ fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '500px', margin: '0.5rem auto' }}>Two new challenges have dropped. Enroll and log your progress to climb the student leaderboards.</p>
            </motion.div>

            <h3 style={{ marginTop: '1.5rem', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem', fontWeight: 700 }}>
              <Trophy size={18} color="var(--accent-gold)"/> Active Today
            </h3>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {dailyData.challenges.map(challenge => (
                <ChallengeCard key={challenge.id} challenge={challenge} user={user} />
              ))}
            </div>
          </>
        )}

        {/* Global Schedule Card */}
        <div className="glass-card" style={{ padding: '1.5rem', marginTop: '1rem', border: '1px solid rgba(255,255,255,0.03)' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={16}/> Campus Schedule</h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            • Sunday - Thursday: 2 Daily Challenges<br />
            • Friday: Morning Sprint (Closes at 12 PM)<br />
            • Saturday: Collective Rest & Worship
          </p>
        </div>
      </div>
    </div>
  );
};

export default Challenges;
