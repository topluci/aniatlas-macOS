import { getBackendUrl } from '../lib/apiUrl';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const API = `${getBackendUrl()}/api`;

let _authToken = null;

export function getAuthToken() { return _authToken; }

export function setAuthToken(t) {
  _authToken = t;
  if (t) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    if (window.electronAPI?.saveToken) window.electronAPI.saveToken(t);
  } else {
    delete axios.defaults.headers.common['Authorization'];
    if (window.electronAPI?.clearToken) window.electronAPI.clearToken();
  }
}

function startAuthPoller(sessionId, onComplete) {
  let stopped = false;
  const poll = async () => {
    if (stopped) return;
    try {
      const res = await axios.get(`${API}/auth/poll`, {
        params: { session_id: sessionId },
        withCredentials: true,
      });
      if (res.data.status === 'complete') {
        stopped = true;
        onComplete(res.data.token);
        return;
      }
      if (res.data.status === 'expired') { stopped = true; return; }
    } catch (err) { console.error('[poll] error:', err); }
    if (!stopped) setTimeout(poll, 1500);
  };
  setTimeout(poll, 1000);
  const timeout = setTimeout(() => { stopped = true; }, 10 * 60 * 1000);
  return () => { stopped = true; clearTimeout(timeout); };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const stopPollerRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      // Restore saved token from disk on every launch
      if (window.electronAPI?.loadToken) {
        const saved = await window.electronAPI.loadToken();
        if (saved) {
          _authToken = saved;
          axios.defaults.headers.common['Authorization'] = `Bearer ${saved}`;
        }
      }
      await checkAuth();
    };
    init();
    return () => { if (stopPollerRef.current) stopPollerRef.current(); };
  }, []);

  const checkAuth = async () => {
    try {
      const headers = _authToken ? { Authorization: `Bearer ${_authToken}` } : {};
      const res = await axios.get(`${API}/auth/me`, { withCredentials: true, headers });
      setUser(res.data);
      // Trigger calendar sync based on saved frequency
      if (window.electronAPI?.calGetSettings && window.electronAPI?.calScheduleSync) {
        window.electronAPI.calGetSettings().then(async (settings) => {
          const freq = settings?.syncFrequency || 'launch';
          const token = _authToken;
          if (freq === 'launch' && token) {
            window.electronAPI.calSync(token);
          }
          const hours = { '6h': 6, '12h': 12, 'daily': 24, 'weekly': 168 }[freq] || 0;
          if (hours > 0 && token) {
            window.electronAPI.calScheduleSync({ token, frequencyHours: hours });
          }
        });
      }
    } catch (e) {
      setUser(null);
      if (e.response?.status === 401) {
        _authToken = null;
        delete axios.defaults.headers.common['Authorization'];
        if (window.electronAPI?.clearToken) window.electronAPI.clearToken();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      const res = await axios.get(`${API}/auth/anilist/login`);
      const { auth_url, session_id } = res.data;
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(auth_url);
        if (stopPollerRef.current) stopPollerRef.current();
        stopPollerRef.current = startAuthPoller(session_id, async (token) => {
          stopPollerRef.current = null;
          if (token) setAuthToken(token);
          await checkAuth();
          // Bring app back to front after browser OAuth
          if (window.electronAPI?.focusWindow) window.electronAPI.focusWindow();
        });
      } else {
        window.location.href = auth_url;
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const loginWithMAL = async () => {
    try {
      const res = await axios.get(`${API}/auth/mal/login`);
      const { auth_url, session_id } = res.data;
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(auth_url);
        if (stopPollerRef.current) stopPollerRef.current();
        stopPollerRef.current = startAuthPoller(session_id, async (token) => {
          stopPollerRef.current = null;
          if (token) setAuthToken(token);
          await checkAuth();
          if (window.electronAPI?.focusWindow) window.electronAPI.focusWindow();
        });
      } else {
        if (res.data.code_verifier) sessionStorage.setItem('mal_code_verifier', res.data.code_verifier);
        window.location.href = auth_url;
      }
    } catch (error) {
      console.error('MAL login failed:', error);
    }
  };

  const handleCallback = async (code) => {
    try {
      const res = await axios.post(`${API}/auth/anilist/callback?code=${code}`, {}, { withCredentials: true });
      setUser(res.data.user);
      return true;
    } catch { return false; }
  };

  const handleMALCallback = async (code) => {
    try {
      const codeVerifier = sessionStorage.getItem('mal_code_verifier');
      if (!codeVerifier) throw new Error('No code verifier');
      const res = await axios.post(`${API}/auth/mal/callback?code=${code}&code_verifier=${codeVerifier}`, {}, { withCredentials: true });
      sessionStorage.removeItem('mal_code_verifier');
      setUser(res.data.user);
      return true;
    } catch { return false; }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (e) { console.error('Logout failed:', e); }
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithMAL, logout, handleCallback, handleMALCallback, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
