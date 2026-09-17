import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplet, Quote, X } from 'lucide-react';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  // Auto trigger hydrate and motivation every few minutes for testing (usually hours)
  useEffect(() => {
    const hydrateTimer = setInterval(() => {
      triggerNotification('Hydration Alert', 'Time to drink a glass of water!', 'hydrate');
    }, 7200000); // 2 hours

    const motivationTimer = setInterval(() => {
      triggerNotification('Daily Nudge', 'Consistency builds champions. Log a workout!', 'motivate');
    }, 14400000); // 4 hours

    return () => {
      clearInterval(hydrateTimer);
      clearInterval(motivationTimer);
    };
  }, []);

  const triggerNotification = (title, message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setNotifications(prev => [...prev, { id, title, message, type }]);
    
    // Auto clear after 6 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ triggerNotification }}>
      {children}
      <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <AnimatePresence>
          {notifications.map(note => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }}
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                border: `1px solid ${note.type === 'hydrate' ? '#3b82f6' : '#10b981'}`,
                padding: '1rem',
                borderRadius: '8px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                width: '300px'
              }}
            >
              <div style={{ color: note.type === 'hydrate' ? '#3b82f6' : '#10b981' }}>
                {note.type === 'hydrate' ? <Droplet size={24}/> : <Quote size={24}/>}
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 4px 0', color: '#f1f5f9' }}>{note.title}</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>{note.message}</p>
              </div>
              <button 
                onClick={() => removeNotification(note.id)} 
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};
