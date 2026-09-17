import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  MapPin, 
  School, 
  Search, 
  TrendingUp, 
  Award,
  Users,
  ChevronLeft,
  Flame
} from 'lucide-react';
import { getLeaderboardData, getCourseLeaderboardData } from '../../utils/db';
import { useNavigate, Link } from 'react-router-dom';

const Leaderboard = () => {
  const [tab, setTab] = useState('students');
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeaders = async () => {
      setLoading(true);
      try {
        const data = tab === 'students' ? await getLeaderboardData() : await getCourseLeaderboardData();
        setLeaders(data);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaders();
  }, [tab]);

  return (
    <div className="leaderboard-container container animate-fade-in">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={20} /> Back</button>
        <h1 className="glow-emerald">The Semester Cup</h1>
        <div style={{ width: '40px' }} />
      </header>

      {/* Prize Banner */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card" 
        style={{ padding: 'max(1rem, 1.25rem)', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(16,185,129,0.1))', border: '1px solid rgba(245,158,11,0.2)', position: 'relative', overflow: 'hidden' }}
      >
        <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '200px' }}>
            <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.15)', borderRadius: '12px', color: 'var(--accent-gold)', flexShrink: 0 }}>
              <Award size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>Semester Prizes Unlocked</h4>
              <p className="text-secondary" style={{ fontSize: '0.75rem', margin: '0.2rem 0 0' }}>#1 Student & Course win Free Gym & Meal Discounts</p>
            </div>
          </div>
        </div>
      </motion.div>
      
      <div className="responsive-grid-2" style={{ marginBottom: '1.5rem' }}>
        <Link to="/friends" className="glass-card" style={{ padding: '1rem', textAlign: 'center', textDecoration: 'none' }}>
          <h4 style={{ margin: 0, color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Users size={16}/> Friends</h4>
        </Link>
        <Link to="/challenges" className="glass-card" style={{ padding: '1rem', textAlign: 'center', textDecoration: 'none' }}>
          <h4 style={{ margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Trophy size={16}/> Challenges</h4>
        </Link>
      </div>

      <section className="leaderboard-tabs glass-card">
        <button 
          className={`tab-btn ${tab === 'students' ? 'active' : ''}`}
          onClick={() => setTab('students')}
        >
          <Users size={18} /> Top Students
        </button>
        <button 
          className={`tab-btn ${tab === 'departments' ? 'active' : ''}`}
          onClick={() => setTab('departments')}
        >
          <School size={18} /> Courses
        </button>
      </section>

      <div className="leaderboard-main animate-fade-in">
        {loading ? (
          <div className="glass-card loading-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="loader emerald-text" style={{ fontWeight: 600, letterSpacing: '0.1em' }}>Calculating Rankings...</div>
          </div>
        ) : leaders.length === 0 ? (
          <div className="glass-card empty-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <p className="text-secondary">The Semester Cup has just begun! Log your metrics to appear on the leaderboard.</p>
          </div>
        ) : (
          <div className="rankings-list glass-card">
            {leaders.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="rank-item"
                style={{
                  background: idx < 3 ? 'rgba(255,255,255,0.03)' : 'transparent',
                  borderLeft: idx === 0 ? '4px solid var(--accent-gold)' : idx === 1 ? '4px solid #94a3b8' : idx === 2 ? '4px solid #b45309' : 'none'
                }}
              >
                <span className={`rank-num ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : ''}`} style={{ flexShrink: 0 }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </span>
                <div className="rank-info" style={{ flex: 1, marginLeft: 'max(0.5rem, 1rem)', minWidth: 0 }}>
                  <h4 style={{ color: idx < 3 ? '#fff' : 'inherit', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tab === 'students' ? `@${item.username || "anonymous"}` : item.name}
                  </h4>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                    {tab === 'students' ? (item.courseOfStudy || "Babcock Student") : `${item.studentCount} active students`}
                  </span>
                </div>
                <div className="rank-points emerald-text" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                  {item.points || item.totalPoints || 0} <small style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', display: 'block', textAlign: 'right' }}>PTS</small>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Leaderboard;
