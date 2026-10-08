const getSessionId = () => {
  if (typeof window === 'undefined') return Math.random().toString(36).substring(2, 15);
  let id = sessionStorage.getItem('need_session_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('need_session_id', id);
  }
  return id;
};

export const sessionId = getSessionId();
