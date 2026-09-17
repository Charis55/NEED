import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getFriendRequestsAndFriends, sendMessage } from '../utils/db';

const ShareModal = ({ isOpen, onClose, type, payload }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && user?.uid) {
      const fetchFriends = async () => {
        const { friends } = await getFriendRequestsAndFriends(user.uid);
        setFriends(friends);
      };
      fetchFriends();
      setSentSuccess(false);
      setSelectedFriend(null);
    }
  }, [isOpen, user?.uid]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedFriend || !user?.uid) return;
    setIsSending(true);
    
    // Fallback text
    let textFallback = '';
    if (type === 'meal') textFallback = `I'm tracking ${payload.name} (${payload.calories} kcal)!`;
    else if (type === 'workout') {
      const routeText = payload.sharedRoute ? ` on ${payload.sharedRoute.name}` : '';
      textFallback = `I'm planning ${payload.name}${routeText} for ${payload.sharedDuration} mins!`;
    }
    else if (type === 'challenge') textFallback = `Check out this challenge: ${payload.title}!`;
    else textFallback = 'Shared an item with you.';

    try {
      await sendMessage(user.uid, selectedFriend.uid, textFallback, type, payload);
      setSentSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-card"
          style={{ width: '90%', maxWidth: '400px', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#10b981', margin: 0, textTransform: 'capitalize' }}>Share {type}</h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
          </div>

          {!sentSuccess ? (
            <>
              <div style={{ marginBottom: '1.5rem', maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {friends.length === 0 ? (
                   <p style={{ color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>You don't have any accepted friends yet.</p>
                ) : (
                   friends.map(friend => (
                     <button 
                       key={friend.uid}
                       onClick={() => setSelectedFriend(friend)}
                       style={{ 
                         textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
                         border: selectedFriend?.uid === friend.uid ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.05)',
                         background: selectedFriend?.uid === friend.uid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.2)',
                         color: '#fff', display: 'flex', flexDirection: 'column'
                       }}
                     >
                       <span style={{ fontWeight: 600 }}>{friend.displayName || friend.username}</span>
                       <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>@{friend.username}</span>
                     </button>
                   ))
                )}
              </div>
              <button 
                disabled={!selectedFriend || isSending}
                onClick={handleSend}
                style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '0.5rem', cursor: selectedFriend ? 'pointer' : 'not-allowed', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', opacity: selectedFriend ? 1 : 0.5 }}
              >
                {isSending ? 'Sending...' : <><Send size={16} /> Send to Friend</>}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
              </motion.div>
              <h3 style={{ color: '#fff' }}>Sent Successfully!</h3>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShareModal;
