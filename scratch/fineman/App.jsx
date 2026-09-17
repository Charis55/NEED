import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Navbar from './components/Navbar';
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Overview';
import Profile from './pages/Dashboard/Profile';
import MealLogger from './pages/Meals/MealLogger';
import WorkoutTracker from './pages/Workouts/WorkoutTracker';
import Leaderboard from './pages/Social/Leaderboard';
import Friends from './pages/Social/Friends';
import Challenges from './pages/Social/Challenges';
import Chat from './pages/Social/Chat';
import CampusMap from './pages/Campus/Map';
import ProfileSetup from './pages/Onboarding/ProfileSetup';
import VerifyEmail from './pages/Auth/VerifyEmail';
import ActivityReview from './pages/Dashboard/ActivityReview';
import LoginNotificationHandler from './components/LoginNotificationHandler';

const AppContent = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-deep)' }}>
      <div className="glow-emerald" style={{ fontSize: '1.5rem', fontWeight: '700' }}>BU-TRACK</div>
    </div>
  );

  // Email Verification Gate
  if (user && !user.emailVerified && location.pathname !== '/verify-email' && location.pathname !== '/login') {
    return <Navigate to="/verify-email" />;
  }

  // Prevent accessing verify page if already verified
  if (user && user.emailVerified && location.pathname === '/verify-email') {
    return <Navigate to="/" />;
  }

  const showNavbar = user && user.emailVerified && location.pathname !== '/login' && location.pathname !== '/onboarding' && location.pathname !== '/verify-email';

  // Redirect to onboarding if profile is not complete
  if (user && user.emailVerified && !user.profile?.completedOnboarding && location.pathname !== '/onboarding' && location.pathname !== '/verify-email') {
    return <Navigate to="/onboarding" />;
  }

  return (
    <NotificationProvider>
      <LoginNotificationHandler />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/verify-email" element={user ? <VerifyEmail /> : <Navigate to="/login" />} />
        <Route path="/onboarding" element={user && user.emailVerified ? <ProfileSetup /> : <Navigate to="/login" />} />
        
        <Route path="/" element={user && user.emailVerified ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user && user.emailVerified ? <Profile /> : <Navigate to="/login" />} />
        
        <Route path="/meals" element={user && user.emailVerified ? <MealLogger /> : <Navigate to="/login" />} />
        <Route path="/workouts" element={user && user.emailVerified ? <WorkoutTracker /> : <Navigate to="/login" />} />
        <Route path="/activity-review" element={user && user.emailVerified ? <ActivityReview /> : <Navigate to="/login" />} />
        
        <Route path="/leaderboard" element={user && user.emailVerified ? <Leaderboard /> : <Navigate to="/login" />} />
        <Route path="/friends" element={user && user.emailVerified ? <Friends /> : <Navigate to="/login" />} />
        <Route path="/chat/:friendId" element={user && user.emailVerified ? <Chat /> : <Navigate to="/login" />} />
        <Route path="/challenges" element={user && user.emailVerified ? <Challenges /> : <Navigate to="/login" />} />
        
        <Route path="/campus" element={user && user.emailVerified ? <CampusMap /> : <Navigate to="/login" />} />
      </Routes>
      
      {showNavbar && <Navbar />}
    </NotificationProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
