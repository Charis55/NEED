import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, 
  ChevronLeft,
  TrendingUp,
  Award,
  Route,
  Timer,
  MapPin,
  CheckCircle,
  Circle,
  ChevronRight,
  X,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { WORKOUT_CATEGORIES } from '../../data/workouts';
import { JOGGING_ROUTES, OUTDOOR_CARDIO_SUB_IDS } from '../../data/jogRoutes';
import { getDailyLog, logUserWorkout, calculateUserBiometrics } from '../../utils/db';
import ShareModal from '../../components/ShareModal';
import LocationCheckModal from '../../components/LocationCheckModal';
import { verifyWorkoutLocation, getRuleKey } from '../../utils/locationVerify';

// ─────────────────────────────────────────────────────────────────────────────
// Route Picker Panel — shown when an outdoor cardio workout is selected
// ─────────────────────────────────────────────────────────────────────────────
function RoutePicker({ workout, onSelectRoute, selectedRoute, onClear, accentColor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ color: '#f1f5f9', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={16} style={{ color: accentColor }} /> Choose a Campus Route
          </h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Pick your jogging route — checkpoints will motivate you at 25%, 50%, 75% &amp; 100%
          </p>
        </div>
        {selectedRoute && (
          <button
            onClick={onClear}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {JOGGING_ROUTES.map(route => {
          const isActive = selectedRoute?.id === route.id;
          return (
            <motion.button
              key={route.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelectRoute(isActive ? null : route)}
              style={{
                background: isActive ? `${route.color}12` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? route.color : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '1rem',
                padding: '0',
                overflow: 'hidden',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isActive ? `0 0 20px ${route.color}30` : 'none',
                transition: 'all 0.25s ease',
              }}
            >
              {/* Colour stripe */}
              <div style={{ height: '3px', background: route.color, opacity: 0.8 }} />

              <div style={{ padding: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ color: '#f1f5f9', fontWeight: 800, fontSize: '0.9rem' }}>{route.name}</span>
                    <span style={{
                      marginLeft: '0.5rem',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '20px',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      background: route.difficulty === 'Easy' ? 'rgba(16,185,129,0.15)' : route.difficulty === 'Moderate' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                      color: route.difficulty === 'Easy' ? '#10b981' : route.difficulty === 'Moderate' ? '#60a5fa' : '#f87171',
                    }}>
                      {route.difficulty}
                    </span>
                  </div>
                  <ChevronRight size={16} style={{ color: route.color, opacity: isActive ? 1 : 0.3, transform: isActive ? 'rotate(90deg)' : 'none', transition: 'all 0.25s' }} />
                </div>

                {/* Stats strip */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: isActive ? '0.875rem' : '0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <Route size={12} style={{ color: route.color }} /> {route.distance}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <Timer size={12} style={{ color: route.color }} /> {route.time}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <Flame size={12} style={{ color: route.color }} /> {route.calories}
                  </span>
                </div>

                {/* Checkpoint breakdown (expanded when active) */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{
                        background: 'rgba(0,0,0,0.25)',
                        borderRadius: '0.75rem',
                        padding: '0.75rem',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                          Checkpoints
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {route.checkpoints.map((cp, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: `${route.color}20`,
                                border: `1.5px solid ${route.color}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.65rem', fontWeight: 900, color: route.color,
                                flexShrink: 0,
                              }}>
                                {cp.pct}%
                              </div>
                              <div>
                                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                                  {cp.emoji} {cp.label}
                                </p>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{cp.note}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main WorkoutTracker component
// ─────────────────────────────────────────────────────────────────────────────
const WorkoutTracker = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();

  const [activeCategory, setActiveCategory] = useState(WORKOUT_CATEGORIES[0]);
  const [activeSub, setActiveSub] = useState(WORKOUT_CATEGORIES[0].subcategories[0]);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  
  const [duration, setDuration] = useState(30);
  const [isLogging, setIsLogging] = useState(false);
  const [burnedToday, setBurnedToday] = useState(0);
  const [burnGoal, setBurnGoal] = useState(500);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Location verification state
  const [locCheck, setLocCheck] = useState(null);
  // locCheck shape: { status, distanceM, nearestVenue, hint } | null

  // True when the user is on an outdoor cardio subcategory
  const isOutdoorCardio = OUTDOOR_CARDIO_SUB_IDS.includes(activeSub.id);

  useEffect(() => {
    if (user?.profile) {
      const bio = calculateUserBiometrics(user.profile);
      setBurnGoal(Math.round(bio.daily * 0.25));
    }
  }, [user?.profile]);

  useEffect(() => {
    const fetchDaily = async () => {
      if (user?.uid) {
        const log = await getDailyLog(user.uid);
        setBurnedToday(log.caloriesBurned || 0);
      }
    };
    fetchDaily();

    if (state?.sharedWorkout) {
      setTimeout(() => {
        const shared = state.sharedWorkout;
        setSelectedWorkout(shared);
        if (shared.sharedDuration) setDuration(shared.sharedDuration);
        if (shared.sharedRoute) setSelectedRoute(shared.sharedRoute);
        
        // Synchronize UI category/sub to match the shared workout
        for (const cat of WORKOUT_CATEGORIES) {
          for (const sub of cat.subcategories) {
            if (sub.workouts.some(w => w.id === shared.id)) {
              setActiveCategory(cat);
              setActiveSub(sub);
              break;
            }
          }
        }
        navigate(window.location.pathname, { replace: true, state: {} });
      }, 300);
    }
  }, [user?.uid, state, navigate]);

  const handleCategorySelect = (cat) => {
    setActiveCategory(cat);
    setActiveSub(cat.subcategories[0]);
    setSelectedWorkout(null);
    setSelectedRoute(null);
  };

  // When a route is selected, sync duration to the route's estimated time
  const handleSelectRoute = (route) => {
    setSelectedRoute(route);
    if (route) setDuration(route.timeMin);
  };

  // Phase 1: Verify location, then phase 2: actually save
  const handleLog = async () => {
    if (!selectedWorkout || !user?.uid) return;

    // ── STRICT IDENTITY CHECK ──
    // We search the entire database to find the workout's TRUE home category.
    // This prevents geofence bypasses if the user switches UI tabs before logging.
    let trueCatId = 'unknown';
    let trueSubId = 'unknown';

    for (const cat of WORKOUT_CATEGORIES) {
      for (const sub of cat.subcategories) {
        if (sub.workouts.find(w => w.id === selectedWorkout.id)) {
          trueCatId = cat.id;
          trueSubId = sub.id;
          break;
        }
      }
    }

    const ruleKey = getRuleKey(trueCatId, trueSubId, selectedWorkout.id);

    // Yoga / no-check workouts skip verification entirely
    if (ruleKey === 'anywhere') {
      await commitLog();
      return;
    }

    // Show the checking spinner
    setLocCheck({ status: 'checking', distanceM: null, nearestVenue: null, hint: null });

    const result = await verifyWorkoutLocation(
      trueCatId,
      trueSubId,
      selectedWorkout.id,
      selectedRoute
    );

    if (result.status === 'verified') {
      setLocCheck(result);
      // Auto-dismiss and log after brief success display
      setTimeout(async () => {
        setLocCheck(null);
        await commitLog();
      }, 1500);
    } else if (result.status === 'no_check') {
      setLocCheck(null);
      await commitLog();
    } else {
      // out_of_range | permission_denied | unavailable — show modal for user decision
      setLocCheck(result);
    }
  };

  // The actual Firestore write — called directly or after user overrides location check
  const commitLog = async () => {
    if (!selectedWorkout || !user?.uid) return;
    setIsLogging(true);
    const calories = Math.round(
      selectedRoute
        ? selectedRoute.calPerMin * duration
        : selectedWorkout.calPerMin * duration
    );
    try {
      await logUserWorkout(user.uid, {
        name: selectedRoute
          ? `${selectedWorkout.name} — ${selectedRoute.name}`
          : selectedWorkout.name,
        duration,
        calories,
        type: selectedWorkout.id,
        locationVerified: locCheck?.status === 'verified',
        ...(selectedRoute && { routeId: selectedRoute.id, routeName: selectedRoute.name }),
      });
      setBurnedToday(prev => prev + calories);
      setSelectedWorkout(null);
      setSelectedRoute(null);
      setDuration(30);
    } catch (err) {
      console.error('Error logging workout:', err);
    } finally {
      setIsLogging(false);
    }
  };

  const estCalories = Math.round(
    selectedRoute
      ? selectedRoute.calPerMin * duration
      : (selectedWorkout?.calPerMin ?? 0) * duration
  );

  // Determine if the selected workout requires a location check by derivation
  const needsLocationCheck = (() => {
    if (!selectedWorkout) return false;
    for (const cat of WORKOUT_CATEGORIES) {
      for (const sub of cat.subcategories) {
        if (sub.workouts.find(w => w.id === selectedWorkout.id)) {
          return getRuleKey(cat.id, sub.id, selectedWorkout.id) !== 'anywhere';
        }
      }
    }
    return false;
  })();

  return (
    <div className="workout-container container animate-fade-in">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={20} /> Back</button>
        <h1 className="glow-emerald">Workout Tracker</h1>
        <div style={{ width: '40px' }} />
      </header>

      <div className="workout-grid">
        <section className="workout-selector">
          
            <div className="glass-card main-selector p-0">
              <h3>Choose Activity</h3>
              
              {/* Primary Category Selection */}
              <div className="category-scroll-container" style={{ marginBottom: '1.5rem' }}>
                {WORKOUT_CATEGORIES.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat)}
                    style={{
                      borderRadius: '50px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: activeCategory.id === cat.id ? `${cat.color}20` : 'rgba(255,255,255,0.03)',
                      color: activeCategory.id === cat.id ? cat.color : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      whiteSpace: 'nowrap',
                      fontWeight: 700,
                      transition: 'all 0.25s',
                      flexShrink: 0
                    }}
                  >
                    <span className="cat-icon" style={{ fontSize: '1.2rem' }}>{cat.icon}</span> {cat.name}
                  </button>
                ))}
              </div>

              {/* Sub-Category Selection */}
              {activeCategory.subcategories.length > 0 && (
                <div className="category-scroll-container" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem', paddingBottom: '0.25rem' }}>
                  {activeCategory.subcategories.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setActiveSub(sub);
                        setSelectedWorkout(null);
                        setSelectedRoute(null);
                      }}
                      style={{
                        paddingBottom: '0.75rem',
                        background: 'none',
                        border: 'none',
                        color: activeSub.id === sub.id ? activeCategory.color : 'var(--text-muted)',
                        borderBottom: activeSub.id === sub.id ? `2px solid ${activeCategory.color}` : '2px solid transparent',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                        cursor: 'pointer'
                      }}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Workouts Grid */}
              <AnimatePresence mode="wait">
                <motion.div 
                  key={activeSub.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="type-grid"
                >
                  {activeSub.workouts.map(workout => (
                    <button 
                      key={workout.id} 
                      className={`type-btn ${selectedWorkout?.id === workout.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedWorkout(workout);
                        setSelectedRoute(null); // reset route on new workout pick
                      }}
                      style={{
                        background: selectedWorkout?.id === workout.id ? `${activeCategory.color}15` : 'rgba(255,255,255,0.04)',
                        borderColor: selectedWorkout?.id === workout.id ? activeCategory.color : 'rgba(255,255,255,0.1)',
                        color: selectedWorkout?.id === workout.id ? '#fff' : '#cbd5e1',
                      }}
                    >
                      <div className="type-icon" style={{ fontSize: '24px', marginBottom: '0.4rem' }}>{workout.icon}</div>
                      <span style={{ fontSize: '0.8rem', lineHeight: '1.3', width: '100%', textAlign: 'center', wordBreak: 'break-word', whiteSpace: 'normal', fontWeight: 600 }}>{workout.name}</span>
                    </button>
                  ))}
                </motion.div>
              </AnimatePresence>

            {/* Logging Setup */}
            <AnimatePresence>
              {selectedWorkout && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="setup-details" 
                  style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed rgba(255,255,255,0.1)' }}
                >
                  <h4 style={{ color: '#f1f5f9', marginBottom: '1rem' }}>
                    Logging: {selectedWorkout.name}
                    {selectedRoute && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.5rem' }}>
                        · {selectedRoute.name}
                      </span>
                    )}
                  </h4>

                  {/* ── ROUTE PICKER (only for outdoor cardio) ── */}
                  {isOutdoorCardio && (
                    <RoutePicker
                      workout={selectedWorkout}
                      selectedRoute={selectedRoute}
                      onSelectRoute={handleSelectRoute}
                      onClear={() => { setSelectedRoute(null); setDuration(30); }}
                      accentColor={activeCategory.color}
                    />
                  )}

                  <div className="input-field" style={{ marginTop: '1.5rem' }}>
                    <label>Duration (minutes)</label>
                    <div className="range-container">
                      <input 
                        type="range" 
                        min="5" max="180" step="5" 
                        value={duration} 
                        onChange={(e) => setDuration(parseInt(e.target.value))} 
                        style={{ accentColor: activeCategory.color }}
                      />
                      <div className="range-val">{duration} <small>min</small></div>
                    </div>
                  </div>
                  
                  <div className="est-calories glass-card" style={{ background: 'rgba(0,0,0,0.3)', marginTop: '1rem' }}>
                    <Flame size={20} className="gold-text" />
                    <span>Estimated Burn: <strong>{estCalories} kcal</strong></span>
                  </div>

                  <div className="drawer-actions">
                    <button 
                      type="button"
                      onClick={() => setShareModalOpen(true)}
                      style={{ 
                        flex: 1, padding: '1rem', background: 'rgba(255,255,255,0.05)', color: activeCategory.color, 
                        border: `1px solid ${activeCategory.color}50`, borderRadius: '0.625rem', cursor: 'pointer', fontWeight: 600,
                        minHeight: '48px'
                      }}
                    >
                      Share Session
                    </button>
                    <button 
                      className="log-btn primary" 
                      disabled={isLogging} 
                      onClick={handleLog}
                      style={{ background: activeCategory.color, flex: 2, minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      {isLogging ? 'Saving…' : (
                        <>
                          {needsLocationCheck && <ShieldCheck size={16} />}
                          {needsLocationCheck ? 'Verify & Log Workout' : 'Finish & Log Workout'}
                        </>
                      )}
                    </button>
                  </div>
                  {needsLocationCheck && (
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.625rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                      <ShieldCheck size={11} /> GPS location will be checked before saving
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Share Modal */}
          {selectedWorkout && (
            <ShareModal
              isOpen={shareModalOpen}
              onClose={() => setShareModalOpen(false)}
              type="workout"
              payload={{ 
                ...selectedWorkout, 
                sharedDuration: duration, 
                sharedRoute: selectedRoute ? {
                  id: selectedRoute.id,
                  name: selectedRoute.name,
                  difficulty: selectedRoute.difficulty,
                  distance: selectedRoute.distance,
                  time: selectedRoute.time,
                  timeMin: selectedRoute.timeMin,
                  calories: selectedRoute.calories,
                  calPerMin: selectedRoute.calPerMin,
                  color: selectedRoute.color,
                  checkpoints: selectedRoute.checkpoints || []
                } : null
              }}
            />
          )}
        </section>

        <section className="workout-history">
          <div className="glass-card summary-display">
             <div className="summary-info">
               <h3 className="gold-text">Today's Burn</h3>
               <div className="burned-val">
                 {burnedToday}
                 <span style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.3)', marginLeft: '0.4rem', fontWeight: 500 }}>
                   / {burnGoal}
                 </span>
                 <small style={{ marginLeft: '0.4rem' }}>kcal</small>
               </div>
             </div>
             <Award size={40} className="gold-text" />
          </div>

          <div className="glass-card history-card" style={{ marginTop: '1.5rem' }}>
            <div className="header-flex">
              <h3>Stats & Impact</h3>
              <TrendingUp size={18} className="text-muted" />
            </div>
            <div className="text-secondary" style={{ fontSize: '0.9rem', fontStyle: 'italic', padding: '1rem' }}>
              Consistency is key. Push hard on your specific workouts—BU-Track ranks you among your campus mates based on total calories burned!
            </div>
          </div>
        </section>
      </div>

      {/* ── LOCATION VERIFICATION MODAL ── */}
      <LocationCheckModal
        status={locCheck?.status ?? null}
        distanceM={locCheck?.distanceM}
        nearestVenue={locCheck?.nearestVenue}
        hint={locCheck?.hint}
        onConfirm={async () => {
          setLocCheck(null);
          await commitLog();
        }}
        onCancel={() => setLocCheck(null)}
      />

      {/* Spin animation */}
      <style>{`
        @keyframes loc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .loc-spin { animation: loc-spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default WorkoutTracker;
