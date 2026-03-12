import { getBackendUrl } from '../lib/apiUrl';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API = `${getBackendUrl()}/api`;

/**
 * Poll /api/auth/poll every 1.5 s until the backend confirms the JWT is ready
 * (after the user completes OAuth in the system browser), then call onComplete(token).
 * Returns a cleanup function that stops polling.
 */
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
      if (res.data.status === 'expired') {
        stopped = true;
        console.warn('Auth session expired before completion.');
        return;
      }
    } catch (err) {
      // network hiccup — keep polling
    }

    if (!stopped) setTimeout(poll, 1500);
  };

  setTimeout(poll, 1000);

  const timeout = setTimeout(() => { stopped = true; }, 10 * 60 * 1000);
  return () => { stopped = true; clearTimeout(timeout); };
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const stopPollerRef         = useRef(null);

  useEffect(() => {
    checkAuth();
    return () => { if (stopPollerRef.current) stopPollerRef.current(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initiate AniList OAuth.
   *
   * Electron: opens the auth URL in the system browser via shell.openExternal
   *           (so the app window never navigates away), then polls the backend
   *           until the JWT is returned. The token is set on axios defaults so
   *           all subsequent requests include it as Authorization: Bearer.
   * Browser:  falls back to window.location.href redirect.
   */
  const login = async () => {
    try {
      const response = await axios.get(`${API}/auth/anilist/login`);
      const { auth_url, session_id } = response.data;

      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(auth_url);
        if (stopPollerRef.current) stopPollerRef.current();
        stopPollerRef.current = startAuthPoller(session_id, async (token) => {
          stopPollerRef.current = null;
          if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          await checkAuth();
        });
      } else {
        window.location.href = auth_url;
      }
    } catch (error) {
      console.error('Failed to initiate AniList login:', error);
    }
  };

  /**
   * Initiate MyAnimeList OAuth.
   *
   * The PKCE code_verifier is stored server-side (tied to session_id),
   * fixing the Electron bug where sessionStorage was wiped on page navigation.
   */
  const loginWithMAL = async () => {
    try {
      const response = await axios.get(`${API}/auth/mal/login`);
      const { auth_url, session_id } = response.data;

      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(auth_url);
        if (stopPollerRef.current) stopPollerRef.current();
        stopPollerRef.current = startAuthPoller(session_id, async (token) => {
          stopPollerRef.current = null;
          if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          await checkAuth();
        });
      } else {
        if (response.data.code_verifier) {
          sessionStorage.setItem('mal_code_verifier', response.data.code_verifier);
        }
        window.location.href = auth_url;
      }
    } catch (error) {
      console.error('Failed to initiate MAL login:', error);
    }
  };

  const handleCallback = async (code) => {
    try {
      const response = await axios.post(
        `${API}/auth/anilist/callback?code=${code}`,
        {},
        { withCredentials: true }
      );
      setUser(response.data.user);
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  };

  const handleMALCallback = async (code) => {
    try {
      const codeVerifier = sessionStorage.getItem('mal_code_verifier');
      if (!codeVerifier) throw new Error('No code verifier found');
      const response = await axios.post(
        `${API}/auth/mal/callback?code=${code}&code_verifier=${codeVerifier}`,
        {},
        { withCredentials: true }
      );
      sessionStorage.removeItem('mal_code_verifier');
      setUser(response.data.user);
      return true;
    } catch (error) {
      console.error('MAL Authentication failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, loginWithMAL,
      logout, handleCallback, handleMALCallback, checkAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
