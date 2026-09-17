import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Search, Users, Activity, ChevronLeft, Check, X, Clock, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { searchFriends, sendFriendRequest, respondToFriendRequest, getFriendRequestsAndFriends } from '../../utils/db';
import { useAuth } from '../../context/AuthContext';

const Friends = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('friends');
  
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [friendsData, setFriendsData] = useState({ friends: [], pending: [], sent: [] });
  const [loadingData, setLoadingData] = useState(true);

  const refreshFriendData = async () => {
    if (!user?.uid) return;
    setLoadingData(true);
    try {
      const data = await getFriendRequestsAndFriends(user.uid);
      setFriendsData(data);
    } catch (err) {
      console.error("Error fetching friends data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    refreshFriendData();
  }, [user]);

  useEffect(() => {
    const fetchSearch = async () => {
      if (!search.trim()) {
        setSearchResults([]);
        return;
      }
      setLoadingSearch(true);
      try {
        const results = await searchFriends(search);
        setSearchResults(results.filter(r => r.uid !== user?.uid));
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setLoadingSearch(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchSearch();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [search, user]);

  const handleAddFriend = async (targetUid) => {
    if (!user?.uid) return;
    await sendFriendRequest(user.uid, targetUid);
    await refreshFriendData();
  };

  const handleRespond = async (targetUid, action) => {
    if (!user?.uid) return;
    await respondToFriendRequest(user.uid, targetUid, action);
    await refreshFriendData();
  };

  const renderUserCard = (u, type) => {
    let searchStatus = null;
    if (type === 'search') {
      if (friendsData.friends.some(f => f.uid === u.uid)) searchStatus = 'friend';
      else if (friendsData.sent.some(s => s.uid === u.uid)) searchStatus = 'sent';
      else if (friendsData.pending.some(p => p.uid === u.uid)) searchStatus = 'pending';
      else searchStatus = 'none';
    }

    return (
      <div key={u.uid} className="glass-card friend-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={20} color="white"/>
          </div>
          <div style={{ minWidth: 0 }}>
            <h4 style={{ margin: 0, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.95rem' }}>@{u.username || 'unknown'}</h4>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={12}/> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.matricNumber || 'Student'}</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {type === 'friend' && (
            <div style={{ display: 'flex', gap: 'max(0.5rem, 1rem)', alignItems: 'center' }}>
              <button 
                onClick={() => navigate(`/chat/${u.uid}`)}
                className="action-btn-small"
                style={{ background: 'transparent', border: '1px solid #10b981', color: '#10b981', borderRadius: '20px', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                <MessageCircle size={14} /> <span className="responsive-text-hide">Message</span>
              </button>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-gold)', lineHeight: 1 }}>{u.points || 0}</div>
                <span style={{ fontSize: '0.65rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Pts</span>
              </div>
            </div>
          )}

          {type === 'pending' && (
            <>
              <button 
                onClick={() => handleRespond(u.uid, 'accept')}
                style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Check size={16} />
              </button>
              <button 
                onClick={() => handleRespond(u.uid, 'reject')}
                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </>
          )}

          {type === 'search' && (
            <>
              {searchStatus === 'friend' && <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}>Friends</span>}
              {searchStatus === 'sent' && <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14}/> Sent</span>}
              {searchStatus === 'pending' && <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>Check Requests</span>}
              {searchStatus === 'none' && (
                <button 
                  onClick={() => handleAddFriend(u.uid)}
                  style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '20px', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                  <UserPlus size={14} /> Add
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container animate-fade-in">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={20} /> Back</button>
        <h1 className="glow-emerald">Friends</h1>
        <div style={{ width: '40px' }} />
      </header>

      <div className="leaderboard-tabs glass-card" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
        <button 
          onClick={() => setActiveTab('friends')}
          className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
          style={{ flex: 1 }}>
          <Users size={18} /> <span className="responsive-text-sm">Friends</span>
        </button>
        <button 
          onClick={() => setActiveTab('requests')}
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          style={{ flex: 1 }}>
          <Clock size={18} /> <span className="responsive-text-sm">Requests</span> {friendsData.pending.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: 'bold' }}>{friendsData.pending.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('find')}
          className={`tab-btn ${activeTab === 'find' ? 'active' : ''}`}
          style={{ flex: 1 }}>
          <Search size={18} /> <span className="responsive-text-sm">Find</span>
        </button>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {loadingData && activeTab !== 'find' ? (
          <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading...</p>
        ) : (
          <>
            {activeTab === 'friends' && (
              <>
                {friendsData.friends.length > 0 ? (
                  friendsData.friends.map(u => renderUserCard(u, 'friend'))
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                    <p>You haven't added any friends yet.</p>
                    <button onClick={() => setActiveTab('find')} style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', padding: '0.5rem 1rem', borderRadius: '20px', marginTop: '0.5rem', cursor: 'pointer' }}>Find Friends</button>
                  </div>
                )}
              </>
            )}

            {activeTab === 'requests' && (
              <>
                <h4 style={{ color: '#f1f5f9', margin: '0 0 0.5rem 0' }}>Incoming Requests</h4>
                {friendsData.pending.length > 0 ? (
                  friendsData.pending.map(u => renderUserCard(u, 'pending'))
                ) : (
                  <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem' }}>No pending requests.</p>
                )}

                {friendsData.sent.length > 0 && (
                  <>
                    <h4 style={{ color: '#f1f5f9', margin: '1.5rem 0 0.5rem 0' }}>Sent Requests</h4>
                    {friendsData.sent.map(u => (
                      <div key={u.uid} className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={14} color="white"/>
                          </div>
                          <div>
                            <h5 style={{ margin: 0, color: '#f1f5f9' }}>@{u.username || 'unknown'}</h5>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pending...</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {activeTab === 'find' && (
              <>
                <div className="search-bar-wrapper" style={{ marginBottom: '1rem' }}>
                  <Search size={20} className="search-icon" color="#94a3b8" />
                  <input 
                    type="text" 
                    placeholder="Search friends by username or matric..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="directory-search-input"
                    style={{ width: '100%' }}
                  />
                </div>

                {loadingSearch ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center' }}>Searching...</p>
                ) : searchResults.length > 0 ? (
                  searchResults.map(u => renderUserCard(u, 'search'))
                ) : search.trim() ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center' }}>No users found.</p>
                ) : (
                  <p style={{ color: '#94a3b8', textAlign: 'center' }}>Type a username or matric number to search.</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Friends;
