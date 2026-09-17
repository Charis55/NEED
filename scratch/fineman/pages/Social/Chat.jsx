import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Send, CheckCircle2, Flame, Activity, Flag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToChat, sendMessage, markMessagesAsRead } from '../../utils/db';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const Chat = () => {
  const { friendId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [friendData, setFriendData] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const fetchFriend = async () => {
      if (!friendId) return;
      const snap = await getDoc(doc(db, 'users', friendId));
      if (snap.exists()) setFriendData(snap.data());
    };
    fetchFriend();
  }, [friendId]);

  useEffect(() => {
    if (!user?.uid || !friendId) return;
    
    // Subscribe to chat
    const unsubscribe = subscribeToChat(user.uid, friendId, (newMessages) => {
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [user?.uid, friendId]);

  useEffect(() => {
    if (!user?.uid || !friendId) return;
    // Mark as read whenever messages update and bottom is reached/component is mounted
    markMessagesAsRead(user.uid, friendId);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, user?.uid, friendId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user?.uid) return;
    
    const sentText = text;
    setText('');
    await sendMessage(user.uid, friendId, sentText, 'text', null);
  };

  return (
    <div className="container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', padding: '1rem', paddingBottom: '9rem', maxWidth: '800px', margin: '0 auto' }}>
      <header className="page-header" style={{ marginBottom: '1rem', flexShrink: 0 }}>
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={20} /> Back</button>
        <h1 className="glow-emerald" style={{ fontSize: '1.2rem', margin: 0 }}>
          {friendData?.displayName || `@${friendData?.username}` || 'Loading...'}
        </h1>
        <div style={{ width: '40px' }} />
      </header>

      <div className="glass-card" style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: 'auto', marginBottom: 'auto' }}>Say hi! Start a conversation.</p>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id || idx} 
                style={{ 
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  background: isMe ? '#10b981' : 'rgba(255,255,255,0.05)',
                  color: 'white',
                  padding: '0.75rem 1rem',
                  borderRadius: isMe ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  position: 'relative'
                }}
              >
                <div style={{ wordBreak: 'break-word', fontSize: '0.9rem' }}>{msg.text}</div>
                {msg.type === 'meal' && msg.payload && (
                  <div 
                    onClick={() => navigate('/meals', { state: { sharedMeal: msg.payload } })}
                    style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid transparent' }}
                  >
                    <Flame size={18} color="#fcd34d" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{msg.payload.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>{msg.payload.calories} kcal target</div>
                    </div>
                  </div>
                )}
                {msg.type === 'workout' && msg.payload && (
                  <div 
                    onClick={() => navigate('/workouts', { state: { sharedWorkout: msg.payload } })}
                    style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid transparent' }}
                  >
                    <Activity size={18} color="#3b82f6" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {msg.payload.name}
                        {msg.payload.sharedRoute && (
                          <span style={{ color: 'var(--accent-emerald)', fontSize: '0.7rem', marginLeft: '0.4rem', fontWeight: 700 }}>
                            • {msg.payload.sharedRoute.name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>
                        {msg.payload.sharedDuration || msg.payload.duration} mins • {msg.payload.calories} kcal
                      </div>
                    </div>
                  </div>
                )}
                {msg.type === 'challenge' && msg.payload && (
                  <div 
                    onClick={() => navigate('/challenges', { state: { sharedChallenge: msg.payload } })}
                    style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid transparent' }}
                  >
                    <Flag size={18} color="#fcd34d" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{msg.payload.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>Campus Challenge</div>
                    </div>
                  </div>
                )}
                {isMe && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                    {msg.read ? (
                      <CheckCircle2 size={12} color="#fcd34d" title="Read" />
                    ) : (
                      <CheckCircle2 size={12} color="#94a3b8" title="Delivered" />
                    )}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.5rem', flexShrink: 0 }}>
        <input 
          type="text" 
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message..."
          style={{ flex: 1, padding: '0.875rem 1rem', borderRadius: '2rem', border: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.05)', color: 'white', outline: 'none', fontSize: '16px' }}
        />
        <button 
          type="submit" 
          disabled={!text.trim()}
          style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() ? 1 : 0.5, transition: 'all 0.2s' }}>
          <Send size={18} style={{ marginLeft: '4px' }} />
        </button>
      </form>
    </div>
  );
};

export default Chat;
