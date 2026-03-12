/**
 * Returns the base backend API URL.
 * Priority:
 *   1. Injected by Electron at runtime (window.__ANISCHEDULE__.backendUrl)
 *   2. Build-time env var  REACT_APP_BACKEND_URL
 *   3. Fallback to localhost:18472
 */
export function getBackendUrl() {
  if (typeof window !== 'undefined' && window.__ANISCHEDULE__?.backendUrl) {
    return window.__ANISCHEDULE__.backendUrl;
  }
  return process.env.REACT_APP_BACKEND_URL || 'http://localhost:18472';
}

export const API_BASE = getBackendUrl();
