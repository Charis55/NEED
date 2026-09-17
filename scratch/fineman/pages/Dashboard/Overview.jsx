import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Flame, Droplet, TrendingUp, Plus, ChevronRight,
  Utensils, Dumbbell, Zap, Trophy, Activity, Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDailyLog, calculateUserBiometrics, recordDailyLogin, checkWeeklyBonus } from '../../utils/db';
import { Link } from 'react-router-dom';
import AcademyTutorial from '../../components/AcademyTutorial';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

const RadialRing = ({ value, max, color, size = 80 }) => {
  const pct = Math.min(value / max, 1);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <motion.circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
    </svg>
  );
};

const StatCard = ({ icon: Icon, label, value, unit, color, colorHex, max }) => (
  <motion.div variants={itemVariants} whileHover={{ y: -6, scale: 1.02 }} className="glass-card stat-card" style={{ padding: '1.25rem' }}>
    <div className="icon-circle" style={{ background: `${colorHex}15`, color: colorHex, border: `1px solid ${colorHex}40`, width: '44px', height: '44px' }}>
      <Icon size={18} />
    </div>
    <div className="stat-info" style={{ flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: '0.7rem', opacity: 0.7, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '2px' }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.2 }}>
          {value.toLocaleString()} <small style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{unit}</small>
        </h3>
        {max && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
            Goal: {max.toLocaleString()}
          </span>
        )}
      </div>
    </div>
    {max && (
      <div style={{ flexShrink: 0, marginLeft: '0.5rem' }}>
        <RadialRing value={value} max={max} color={colorHex} size={56} />
      </div>
    )}
  </motion.div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAcademy, setShowAcademy] = useState(false);
  const [biometrics, setBiometrics] = useState({ daily: 2000, weekly: 14000 });

  useEffect(() => {
    const initDashboard = async () => {
      if (user?.uid) {
        setLoading(true);
        try {
          await recordDailyLogin(user.uid);
          const bonusAwarded = await checkWeeklyBonus(user.uid);
          if (bonusAwarded) console.log("Weekly bonus awarded!");

          const log = await getDailyLog(user.uid);
          setStats(log);

          if (user.profile) {
            const bio = calculateUserBiometrics(user.profile);
            setBiometrics(bio);
            if (!user.profile.tutorialCompleted) setShowAcademy(true);
          }
        } catch (err) {
          console.error("Dashboard init error:", err);
        } finally {
          setLoading(false);
        }
      }
    };
    initDashboard();
  }, [user?.uid, user?.profile]);

  const calGoal = biometrics.daily;
  const burnGoal = Math.round(calGoal * 0.25);
  const caloriesIn = stats?.caloriesConsumed || 0;
  const caloriesOut = stats?.caloriesBurned || 0;
  const netCals = caloriesIn - caloriesOut;
  const water = stats?.water || 0;

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const getStreakDots = () => {
    return weekDays.map((_, i) => {
      const d = new Date();
      const diff = d.getDay() - i;
      const targetDate = new Date();
      targetDate.setDate(d.getDate() - diff);
      const dateStr = targetDate.toISOString().split('T')[0];
      const isLogged = user?.profile?.checkInHistory?.[dateStr];
      const isToday = i === d.getDay();

      return (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ 
            width: '12px', height: '12px', borderRadius: '50%',
            background: isLogged ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.1)',
            boxShadow: isLogged ? '0 0 8px var(--accent-emerald)' : 'none',
            border: isToday ? '1px solid var(--accent-emerald)' : 'none'
          }} />
          <span style={{ fontSize: '0.65rem', color: isToday ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: isToday ? 700 : 400 }}>{weekDays[i]}</span>
        </div>
      );
    });
  };

  if (loading) return (
    <div className="dashboard-container container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{ color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '1.1rem', letterSpacing: '0.1em' }}
      >
        SYNCING BU-TRACK DATA...
      </motion.div>
    </div>
  );

  return (
    <div className="dashboard-container container">
      {showAcademy && <AcademyTutorial user={user} onComplete={() => setShowAcademy(false)} />}
      
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="dashboard-header animate-fade-in"
      >
        <div className="user-greeting" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/profile" style={{ flexShrink: 0 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>
                <span style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 'bold' }}>{user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}</span>
              </div>
            </Link>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Trophy size={14} color="var(--accent-gold)" />
                <p className="text-secondary" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-gold)', margin: 0 }}>
                  {user?.profile?.points || 0} Semester Points
                </p>
              </div>
              <h1 style={{ margin: '0.2rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'clamp(1.2rem, 5vw, 1.75rem)' }}>{user?.displayName?.split(' ')[0] || 'Student'}</h1>
              <p className="text-secondary" style={{ fontSize: '0.8rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.profile?.courseOfStudy || 'General Student'}
              </p>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <Link to="/meals" className="action-btn primary" style={{ flex: 1, justifyContent: 'center' }}>
            <Utensils size={16} /> <span>Log Meal</span>
          </Link>
          <Link to="/workouts" className="action-btn primary" style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 20px rgba(245, 158, 11, 0.2)' }}>
            <Dumbbell size={16} /> <span>Workout</span>
          </Link>
        </div>
      </motion.header>

      <Link to="/activity-review" style={{ textDecoration: 'none', display: 'block' }}>
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2, scale: 1.005, borderColor: 'var(--accent-emerald)' }}
          transition={{ delay: 0.2 }}
          className="glass-card flex-between" 
          style={{ padding: 'max(0.75rem, 1rem)', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} color="var(--accent-emerald)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Consistency</span>
          </div>
          <div style={{ display: 'flex', gap: 'max(0.5rem, 0.875rem)', flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
            {getStreakDots()}
            <ChevronRight size={14} color="var(--text-muted)" style={{ marginLeft: '4px' }} />
          </div>
        </motion.div>
      </Link>

      <motion.section
        className="stats-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <StatCard
          icon={Flame} label="Daily Intake" value={caloriesIn} unit="kcal"
          colorHex="#10b981" max={calGoal}
        />
        <StatCard
          icon={Zap} label="Burn Target" value={caloriesOut} unit="kcal"
          colorHex="#f59e0b" max={burnGoal}
        />
        <StatCard
          icon={Droplet} label="Hydration" value={water} unit="L"
          colorHex="#3b82f6" max={3}
        />
        <StatCard
          icon={Activity} label="Net Status" value={Math.abs(netCals)} unit={netCals >= 0 ? 'surplus' : 'deficit'}
          colorHex="#8b5cf6" max={calGoal}
        />
      </motion.section>

      <div className="dashboard-main-grid">
        <div className="main-left">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="glass-card chart-container"
          >
            <div className="chart-header">
              <h3>Scientific Target Focus</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.profile?.activityLevel || 'Standard'} Multiplier</span>
            </div>

            <div className="chart-main-content" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1rem 0', flexWrap: 'wrap', justifyContent: 'center' }}>
              <RadialRing value={caloriesIn} max={calGoal} color="#10b981" size={100} />
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Intake Goal</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>{caloriesIn} / {calGoal} kcal</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(caloriesIn / calGoal * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: '100%', background: 'var(--accent-emerald)', borderRadius: '3px', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Workout Target</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{caloriesOut} / {burnGoal} kcal</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(caloriesOut / burnGoal * 100, 100)}%` }}
                      transition={{ duration: 1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      style={{ height: '100%', background: 'var(--accent-gold)', borderRadius: '3px', boxShadow: '0 0 10px rgba(245,158,11,0.5)' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="quick-actions-grid">
            <Link to="/meals" style={{ textDecoration: 'none' }}>
              <motion.div whileHover={{ y: -5 }} className="glass-card action-card">
                <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '0.875rem', border: '1px solid var(--border-emerald)' }}>
                  <Utensils size={22} color="var(--accent-emerald)" />
                </div>
                <div>
                  <h4>Log Meal</h4>
                  <p className="text-muted">+10 Points</p>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </motion.div>
            </Link>
            <Link to="/workouts" style={{ textDecoration: 'none' }}>
              <motion.div whileHover={{ y: -5 }} className="glass-card action-card">
                <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.1)', borderRadius: '0.875rem', border: '1px solid var(--border-gold)' }}>
                  <Dumbbell size={22} color="var(--accent-gold)" />
                </div>
                <div>
                  <h4>Workout</h4>
                  <p className="text-muted">+25 Points</p>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </motion.div>
            </Link>
          </div>
        </div>

        <div className="main-right">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="glass-card leaderboard-preview"
          >
            <div className="chart-header">
              <h3><Trophy size={16} style={{ display: 'inline', marginRight: '0.5rem', color: 'var(--accent-gold)' }} />Campus Rankings</h3>
              <Link to="/leaderboard" style={{ textDecoration: 'none' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>View Cup →</span>
              </Link>
            </div>
            <div className="leader-list">
              <div className="leader-item" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
                <span className="leader-rank gold">🥇</span>
                <span className="leader-name">Semester Cup</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Top Students & Courses</span>
              </div>
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6' }}>
                Build your <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>7-Day Streak</span> to climb the departmental race.
              </div>
              <Link to="/leaderboard" style={{ textDecoration: 'none' }}>
                <motion.div
                  whileHover={{ y: -2 }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.875rem', borderRadius: '0.875rem',
                    background: 'rgba(16,185,129,0.08)', border: '1px solid var(--border-emerald)',
                    color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.9rem'
                  }}
                >
                  <Trophy size={16} /> Course Leaderboard
                </motion.div>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
      
      <footer style={{ marginTop: '4rem', paddingBottom: '3rem', textAlign: 'center', opacity: 0.4 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--accent-emerald)' }}>
          CharisCorp
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
