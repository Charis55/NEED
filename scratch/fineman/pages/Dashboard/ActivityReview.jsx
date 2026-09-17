import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, Flame, Droplet, Zap, 
  Calendar, CheckCircle2, XCircle, Activity,
  Trophy, TrendingUp, Sparkles, Flag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getWeeklyLogs, calculateUserBiometrics } from '../../utils/db';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

const RadialRing = ({ value, max, color, size = 50 }) => {
  const pct = Math.max(0.01, Math.min(value / max, 1));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <motion.circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
    </svg>
  );
};

const ActivityReview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    avgCalories: 0,
    totalWater: 0,
    consistencyScore: 0,
    activeDays: 0
  });
  const [biometrics, setBiometrics] = useState({ daily: 2000 });

  useEffect(() => {
    const fetchData = async () => {
      if (user?.uid) {
        setLoading(true);
        try {
          const weeklyLogs = await getWeeklyLogs(user.uid);
          setLogs(weeklyLogs);

          // Calculate summary
          const totals = weeklyLogs.reduce((acc, log) => {
            acc.calories += log.caloriesConsumed || 0;
            acc.water += log.water || 0;
            const isActive = (log.caloriesConsumed > 0 || log.caloriesBurned > 0 || (log.challengesDone || 0) > 0);
            if (isActive) {
              acc.activeDays += 1;
            }
            return acc;
          }, { calories: 0, water: 0, activeDays: 0 });

          setSummary({
            avgCalories: Math.round(totals.calories / 7),
            totalWater: totals.water.toFixed(1),
            activeDays: totals.activeDays,
            consistencyScore: Math.round((totals.activeDays / 7) * 100)
          });

          if (user.profile) {
            setBiometrics(calculateUserBiometrics(user.profile));
          }
        } catch (err) {
          console.error("Error fetching weekly activity:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="container flex-center" style={{ minHeight: '80vh' }}>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="glow-emerald"
          style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '0.2em' }}
        >
          ANALYZING WEEKLY TRENDS...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container activity-review-container">
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-header" 
        style={{ marginBottom: '2rem' }}
      >
        <button onClick={() => navigate(-1)} className="back-btn">
          <ChevronLeft size={20} /> Back
        </button>
        <h1 className="glow-emerald">Weekly Review</h1>
        <div style={{ width: 80 }} /> {/* Spacer */}
      </motion.header>

      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="summary-section"
        style={{ marginBottom: '2.5rem' }}
      >
        <div className="responsive-grid-2">
          <motion.div variants={itemVariants} className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="icon-circle" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--accent-emerald)', border: '1px solid var(--border-emerald)' }}>
              <Trophy size={20} />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Consistency Score</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary.consistencyScore}%</h2>
              <p className="text-secondary" style={{ fontSize: '0.8rem' }}>{summary.activeDays} of 7 days active</p>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="icon-circle" style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent-gold)', border: '1px solid var(--border-gold)' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Avg. Daily Intake</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary.avgCalories} <small style={{ fontSize: '0.9rem', opacity: 0.6 }}>kcal</small></h2>
              <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Target: {biometrics.daily} kcal</p>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="history-list"
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Calendar size={18} color="var(--accent-emerald)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Past 7 Days Breakdown</h3>
        </div>

        {logs.map((log, index) => {
          const date = new Date(log.date);
          const isActive = (log.caloriesConsumed > 0 || log.caloriesBurned > 0 || (log.challengesDone || 0) > 0);
          
          return (
            <motion.div 
              key={log.date} 
              variants={itemVariants} 
              className="glass-card history-item" 
              whileHover={{ x: 5, borderColor: isActive ? 'var(--border-emerald)' : 'rgba(255,255,255,0.1)' }}
              style={{ padding: '1.25rem', cursor: 'default', border: isActive ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-subtle)' }}
            >
              <div className="history-row-top">
                {/* Date & Indicator */}
                <div style={{ minWidth: 80 }}>
                  <span className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span style={{ fontSize: '1rem', fontWeight: 800 }}>
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {isActive ? <CheckCircle2 size={18} color="var(--accent-emerald)" /> : <XCircle size={18} color="var(--text-muted)" />}
                  <span style={{ fontSize: '0.65rem', color: isActive ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: 800 }}>{isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="history-metrics-grid" style={{ display: 'flex', gap: '2rem', flex: 1, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <RadialRing value={log.caloriesConsumed || 0} max={biometrics.daily} color="var(--accent-emerald)" size={44} />
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.65rem', display: 'block', fontWeight: 600 }}>INTAKE</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{log.caloriesConsumed || 0} <small style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>kcal</small></span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(245,158,11,0.1)', padding: '0.5rem', borderRadius: '50%', color: 'var(--accent-gold)' }}>
                    <Zap size={16} />
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.65rem', display: 'block', fontWeight: 600 }}>BURNED</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{log.caloriesBurned || 0} <small style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>kcal</small></span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.5rem', borderRadius: '50%', color: '#a855f7' }}>
                    <Flag size={16} />
                  </div>
                  <div>
                    <span className="text-muted" style={{ fontSize: '0.65rem', display: 'block', fontWeight: 600 }}>CHALLENGES</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{log.challengesDone || 0}</span>
                  </div>
                </div>
              </div>

              {/* Status Indicator Badge */}
              <div className="history-status-badge">
                <div style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.4rem', 
                  background: isActive ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', 
                  padding: '0.4rem 0.75rem', borderRadius: '2rem', 
                  border: isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.05)' 
                }}>
                  {isActive ? <Sparkles size={14} color="var(--accent-gold)" /> : <Activity size={14} color="var(--text-muted)" />}
                  <span style={{ color: isActive ? 'var(--accent-gold)' : 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem' }}>
                    {isActive ? 'Consistent' : 'Inactive'}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.section>

      <motion.footer 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        style={{ marginTop: '3rem', textAlign: 'center', paddingBottom: '2rem' }}
      >
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>
          Consistency is key to climbing the <span className="emerald-text" style={{ fontWeight: 700 }}>Semester Cup</span> leaderboard.
        </p>
      </motion.footer>
    </div>
  );
};

export default ActivityReview;
