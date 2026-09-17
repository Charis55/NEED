import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  Activity, 
  Calendar, 
  Award, 
  X, 
  ChevronRight,
  ChevronLeft,
  Zap,
  Users,
  Utensils,
  Dumbbell,
  MessageCircle,
  Share2,
  ShieldCheck,
  Route
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const slides = [
  {
    title: "Welcome to BU-Track",
    desc: "You are now part of the most elite health ecosystem at Babcock University. Every action you take earns you personal points and brings your Course of Study closer to the Cup.",
    icon: <Zap size={48} className="glow-emerald" />,
    color: "var(--accent-emerald)"
  },
  {
    title: "Tracking Your Meals",
    desc: "Navigate to the Meals tab to log your nutrition. Search through our robust Nigerian database (e.g. Jollof Rice, Ofada) or log a custom entry. Hit your daily Caloric Goal to stay fueled.",
    icon: <Utensils size={48} color="#fcd34d" />,
    color: "#fcd34d"
  },
  {
    title: "Crush Your Workouts",
    desc: "Jump into the Workouts tab to log exercises. Select specific campus activities and strict calisthenics, set your duration, and the system automatically calculates your calorie burn.",
    icon: <Dumbbell size={48} color="#3b82f6" />,
    color: "#3b82f6"
  },
  {
    title: "GPS Anti-Cheat System",
    desc: "To ensure fair play on the leaderboards, BU-Track uses strict GPS verification. You must physically be within a 200m radius of the correct campus facility (like the Stadium or Guest House) to log your workout.",
    icon: <ShieldCheck size={48} color="#ef4444" />,
    color: "#ef4444"
  },
  {
    title: "Campus Jogging Routes",
    desc: "Hitting the road? Choose from 5 custom jogging routes around the Babcock campus. You must be at the exact starting point to begin a run. We automatically adjust your estimated burn based on the route's difficulty!",
    icon: <Route size={48} color="#10b981" />,
    color: "#10b981"
  },
  {
    title: "Build Your Circle",
    desc: "Use the Friends module to search for peers using '@username'. Accept requests, chat real-time securely, and climb the leaderboards together shoulder-to-shoulder.",
    icon: <MessageCircle size={48} color="#10b981" />,
    color: "#10b981"
  },
  {
    title: "Interactive Sharing",
    desc: "Did an amazing workout? Stumbled on a great challenge? Tap the Share icon inside your logs to broadcast exact payloads directly into your friend chats, so they can run the exact setup with one click!",
    icon: <Share2 size={48} color="#a855f7" />,
    color: "#a855f7"
  },
  {
    title: "The Strict Consistency Rule",
    desc: "Log a meal or workout EVERY SINGLE DAY (Sun-Sat) to earn a massive +100 Point Bonus. Miss one day, and you lose the streak. Discipline is the only way to the top.",
    icon: <Calendar size={48} className="glow-gold" />,
    color: "var(--accent-gold)"
  },
  {
    title: "Earning Your Points",
    points: [
      { label: "Log a Meal", value: "+10", icon: <Utensils size={20} /> },
      { label: "Log a Workout", value: "+25", icon: <Dumbbell size={20} /> },
      { label: "Weekly 7-Day Streak", value: "+100", icon: <Trophy size={20} /> }
    ],
    desc: "Consistency beats intensity. Small daily steps lead to campus-wide dominance.",
    icon: <Activity size={48} className="glow-blue" />,
    color: "#3b82f6"
  },
  {
    title: "Course of Study Cup",
    desc: "Your points are shared! Every point you earn is added to your Course's total. Compete with Software Eng, Nursing, and Law to see who rules the campus.",
    icon: <Users size={48} className="glow-purple" />,
    color: "#a855f7"
  },
  {
    title: "The Grand Prizes",
    desc: "At the end of the semester, only the #1 ranking student and the #1 leading Course of Study win the exclusive rewards, including Free Gym Memberships, Meal Discounts, and Tech Gadgets.",
    icon: <Award size={48} className="glow-emerald" />,
    color: "var(--accent-emerald)"
  }
];

const AcademyTutorial = ({ user, onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = async () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { tutorialCompleted: true });
      if (onComplete) onComplete();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) setCurrentSlide(s => s - 1);
  };

  const handleSkip = async () => {
    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { tutorialCompleted: true });
    if (onComplete) onComplete();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="tutorial-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,5,0.95)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div className="tutorial-card glass-card" style={{ width: '100%', maxWidth: '440px', padding: 'max(1.5rem, 2rem) max(1rem, 1.5rem)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 'min(500px, 80dvh)' }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '200px', height: '200px', background: slides[currentSlide].color, opacity: 0.1, borderRadius: '50%', filter: 'blur(60px)' }} />
        
        {/* Skip button securely mapped to the top right edge */}
        <button 
          onClick={handleSkip} 
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, transition: 'all 0.2s' }}
        >
          <X size={16} />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
              {slides[currentSlide].icon}
            </div>
            
            <h2 className="glow-emerald" style={{ fontSize: 'clamp(1.25rem, 6vw, 1.75rem)', marginBottom: '0.75rem', color: '#fff', fontWeight: 800 }}>{slides[currentSlide].title}</h2>
            <p className="text-secondary" style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1.5rem', opacity: 0.9 }}>{slides[currentSlide].desc}</p>
            
            {slides[currentSlide].points && (
              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '2rem' }}>
                {slides[currentSlide].points.map((p, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.04)', padding: '0.75rem 1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ color: 'var(--accent-emerald)', display: 'flex' }}>{p.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.label}</span>
                    </div>
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 900, fontSize: '0.95rem' }}>{p.value}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="tutorial-footer" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem' }}>
          {currentSlide > 0 ? (
            <button 
              onClick={handlePrev}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', padding: '0.6rem 0.8rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
            >
              <ChevronLeft size={16} /> <span style={{ display: 'none' }} className="responsive-text">Back</span>
            </button>
          ) : (
            <div style={{ width: '40px' }} />
          )}

          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', padding: '0.5rem', flex: 1, justifyContent: 'center' }}>
            {slides.map((_, i) => (
              <div key={i} style={{ width: i === currentSlide ? '14px' : '5px', height: '5px', borderRadius: '3px', background: i === currentSlide ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.2)', transition: '0.3s', flexShrink: 0 }} />
            ))}
          </div>
          
          <button 
            className="log-btn primary" 
            onClick={handleNext}
            style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap', width: 'auto', fontSize: '0.85rem' }}
          >
            {currentSlide === slides.length - 1 ? 'Start' : 'Next'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default AcademyTutorial;
