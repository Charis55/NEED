import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, ArrowRight, Mail, Lock, User, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { loginWithEmail, signUpWithEmail, resetPassword, resendVerification, logout } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();


  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    
    // Strict Babcock Student Domain Validation
    if (!email.trim().toLowerCase().endsWith('@student.babcock.edu.ng')) {
      setError("Access Denied: Only @student.babcock.edu.ng emails are authorized.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isForgotPassword) {
        await resetPassword(email);
        setMessage("Security link sent! Check your inbox.");
        return;
      }

      let result;
      if (isSignUp) {
        result = await signUpWithEmail(email, password);
        setIsVerificationSent(true);
      } else {
        result = await loginWithEmail(email, password);
        if (!result.user.emailVerified) {
          setIsVerificationSent(true);
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError("Account not found. Maybe try signing up first?");
      } else if (err.code === 'auth/wrong-password') {
        setError("Incorrect password. Please try again.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Try logging in.");
      } else if (err.code === 'auth/weak-password') {
        setError("Password should be at least 6 characters.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else {
        setError("Authentication failed. Please check your connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await resendVerification();
      setMessage("Verification email resent!");
    } catch (err) {
      setError("Failed to resend. Try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerificationSent) {
    return (
      <div className="login-container">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card login-card text-center" style={{ padding: 'max(1.5rem, 3rem)' }}>
          <CheckCircle size={64} className="glow-emerald" style={{ margin: '0 auto 1.5rem' }} />
          <h1 className="glow-emerald" style={{ fontSize: 'clamp(1.5rem, 6vw, 2.5rem)' }}>Verify Email</h1>
          <p className="text-secondary" style={{ marginBottom: '2rem', fontSize: '0.95rem' }}>
            A security link was sent to <strong style={{ color: '#fff' }}>{email}</strong>. 
            Verification is required to access the Semester Cup.
          </p>
          <div className="login-actions" style={{ gap: '1rem' }}>
            <button onClick={handleResend} disabled={isLoading} className="login-btn primary-btn" style={{ width: '100%', minHeight: '52px' }}>
              {isLoading ? 'Sending...' : 'Resend Link'}
            </button>
            <button onClick={() => { setIsVerificationSent(false); logout(); }} className="toggle-btn" style={{ margin: '1rem auto' }}>
              Back to Login
            </button>
          </div>
          {message && <p className="success-text mt-4">{message}</p>}
          {error && <p className="error-text mt-4">{error}</p>}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="glass-card login-card"
      >
        <div className="login-header">
          <h1 className="glow-emerald" style={{ fontSize: 'clamp(2rem, 8vw, 3rem)', marginBottom: '0.25rem' }}>BU-Track</h1>
          <p className="text-secondary" style={{ fontSize: '0.9rem', opacity: 0.8 }}>
            {isForgotPassword ? 'Reset your security' : isSignUp ? 'Create your profile' : 'Elite Student Fitness'}
          </p>
        </div>

        <div className="login-actions">
          <form onSubmit={handleAuthSubmit} className="login-form">
            <div className="input-group">
              <Mail size={18} className="input-icon" />
              <input 
                type="email" 
                placeholder="Student Email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ fontSize: '16px' }}
              />
            </div>

            {!isForgotPassword && (
              <div className="input-group">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  style={{ fontSize: '16px' }}
                />
              </div>
            )}

            {error && <p className="error-text animate-fade-in">{error}</p>}
            {message && <p className="success-text animate-fade-in" style={{ color: 'var(--accent-emerald)', fontSize: '0.9rem', textAlign: 'center' }}>{message}</p>}

            <button type="submit" disabled={isLoading} className="login-btn primary-btn">
              {isLoading ? (
                <span className="loader">Please wait...</span>
              ) : (
                <>
                  {isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Start Your Journey' : 'Access Analytics'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {!isForgotPassword && !isSignUp && (
            <button className="toggle-btn" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }} onClick={() => setIsForgotPassword(true)}>
              Forgot Password?
            </button>
          )}
        </div>

        <div className="login-footer">
          <p>
            {isForgotPassword ? 'Wait, I remember!' : isSignUp ? 'Already a member?' : "Don't have an account yet?"} 
            <button className="toggle-btn" onClick={() => { 
                if (isForgotPassword) setIsForgotPassword(false);
                else setIsSignUp(!isSignUp); 
                setError(null); 
                setMessage(null);
              }}>
              {isForgotPassword ? 'Back to Login' : isSignUp ? 'Log In' : 'Sign Up Free'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
