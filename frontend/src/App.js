import { HashRouter as BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';
import { LandingPage } from './pages/LandingPage';
import { Dashboard } from './pages/Dashboard';
import { CallbackPage } from './pages/CallbackPage';
import { MALCallbackPage } from './pages/MALCallbackPage';
import { BrowsePage } from './pages/BrowsePage';
import { AniSongsPage } from './pages/AniSongsPage';
import { SettingsPage } from './pages/SettingsPage';
import { Loader2, X, Download, Tag, Calendar, ArrowRight } from 'lucide-react';
import React, { useEffect, useState, useCallback } from 'react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function MenuNavListener() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!window.electronAPI?.onNav) return;
    window.electronAPI.onNav((page) => {
      if (page === 'dashboard') navigate('/dashboard');
      else if (page === 'browse') navigate('/browse');
      else if (page === 'settings') navigate('/settings');
    });
  }, [navigate]);
  return null;
}

// ── Shared modal styles ───────────────────────────────────────────────────────
const overlay = { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' };
const modal = { background:'#13131a', borderRadius:14, padding:28, border:'1px solid rgba(255,255,255,0.1)', boxShadow:'0 25px 60px rgba(0,0,0,0.5)' };

// ── Changelog Modal ───────────────────────────────────────────────────────────
function ChangelogModal({ open, onClose }) {
  const [releases, setReleases] = useState(null);
  useEffect(() => {
    if (!open) return;
    setReleases(null);
    window.electronAPI?.fetchChangelog().then(r => setReleases(r || [])).catch(() => setReleases([]));
  }, [open]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{...modal, width:480, maxHeight:'78vh', display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20}}>
          <h2 style={{color:'#a78bfa', fontSize:18, fontWeight:700, margin:0}}>Changelog</h2>
          <button onClick={onClose} style={{background:'none', border:'none', color:'#666', cursor:'pointer', padding:4, borderRadius:6, display:'flex'}}><X size={16}/></button>
        </div>
        <div style={{overflowY:'auto', flex:1, paddingRight:4}}>
          {releases === null && <p style={{color:'#666', fontSize:13}}>Loading…</p>}
          {releases?.length === 0 && <p style={{color:'#666', fontSize:13}}>No releases found.</p>}
          {releases?.map(r => (
            <div key={r.id} style={{marginBottom:20, paddingBottom:20, borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                <span style={{color:'#e5e5e5', fontWeight:700, fontSize:15}}>{r.tag_name}</span>
                {r.prerelease && <span style={{fontSize:10, padding:'2px 6px', background:'rgba(251,191,36,0.15)', color:'#fbbf24', borderRadius:4}}>pre-release</span>}
              </div>
              <div style={{color:'#555', fontSize:11, marginBottom:8}}>{new Date(r.published_at).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</div>
              <pre style={{color:'#aaa', fontSize:12, whiteSpace:'pre-wrap', fontFamily:'inherit', lineHeight:1.6, margin:0}}>{(r.body||'No release notes.').slice(0,800)}</pre>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{marginTop:16, padding:'7px 20px', background:'rgba(167,139,250,0.15)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:8, color:'#a78bfa', cursor:'pointer', fontSize:13, alignSelf:'flex-end'}}>Close</button>
      </div>
    </div>
  );
}

// ── Updates Modal ─────────────────────────────────────────────────────────────
function compareVersions(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i]||0) > (pb[i]||0)) return 1;
    if ((pa[i]||0) < (pb[i]||0)) return -1;
  }
  return 0;
}

function UpdatesModal({ open, onClose }) {
  const [status, setStatus] = useState('idle');
  const [currentVersion, setCurrentVersion] = useState('');
  const [latestRelease, setLatestRelease] = useState(null);
  const [autoUpdate, setAutoUpdate] = useState(() => localStorage.getItem('aniatlas_auto_update') === 'true');

  useEffect(() => {
    if (!open) return;
    setStatus('idle'); setLatestRelease(null);
    window.electronAPI?.getAppVersion?.().then(v => setCurrentVersion(v || '1.0.0'));
  }, [open]);

  const checkNow = useCallback(async () => {
    setStatus('checking');
    try {
      const releases = await window.electronAPI?.fetchChangelog();
      const stable = (releases || []).filter(r => !r.prerelease);
      if (!stable.length) { setStatus('uptodate'); return; }
      const latest = stable[0];
      const current = await window.electronAPI?.getAppVersion?.() || '1.0.0';
      if (compareVersions(latest.tag_name, current) > 0) {
        setLatestRelease(latest);
        setStatus('available');
      } else {
        setStatus('uptodate');
      }
    } catch { setStatus('error'); }
  }, []);

  const toggleAutoUpdate = (val) => {
    setAutoUpdate(val);
    localStorage.setItem('aniatlas_auto_update', val ? 'true' : 'false');
  };

  if (!open) return null;
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{...modal, width:420}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20}}>
          <h2 style={{color:'#a78bfa', fontSize:18, fontWeight:700, margin:0}}>Updates</h2>
          <button onClick={onClose} style={{background:'none', border:'none', color:'#666', cursor:'pointer', padding:4, borderRadius:6, display:'flex'}}><X size={16}/></button>
        </div>

        {/* Current version */}
        <div style={{display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'rgba(255,255,255,0.04)', borderRadius:8, marginBottom:16}}>
          <Tag size={14} style={{color:'#666'}}/>
          <span style={{color:'#888', fontSize:13}}>Current version:</span>
          <span style={{color:'#e5e5e5', fontSize:13, fontWeight:600}}>v{currentVersion}</span>
        </div>

        {/* Status messages */}
        {status === 'idle' && <p style={{color:'#888', fontSize:13, marginBottom:16}}>Click below to check for a newer version on GitHub.</p>}
        {status === 'checking' && <p style={{color:'#888', fontSize:13, marginBottom:16}}>Checking GitHub for updates…</p>}
        {status === 'uptodate' && <p style={{color:'#4ade80', fontSize:13, marginBottom:16}}>✓ You're on the latest version!</p>}
        {status === 'error' && <p style={{color:'#f87171', fontSize:13, marginBottom:16}}>Could not check for updates. Check your connection.</p>}

        {/* New version available */}
        {status === 'available' && latestRelease && (
          <div style={{marginBottom:16, padding:14, background:'rgba(167,139,250,0.08)', borderRadius:10, border:'1px solid rgba(167,139,250,0.2)'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
              <Download size={14} style={{color:'#a78bfa'}}/>
              <span style={{color:'#a78bfa', fontWeight:700, fontSize:14}}>v{currentVersion}</span>
              <ArrowRight size={12} style={{color:'#666'}}/>
              <span style={{color:'#4ade80', fontWeight:700, fontSize:14}}>{latestRelease.tag_name}</span>
            </div>
            <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:10}}>
              <Calendar size={11} style={{color:'#555'}}/>
              <span style={{color:'#555', fontSize:11}}>{new Date(latestRelease.published_at).toLocaleDateString()}</span>
            </div>
            {latestRelease.body && (
              <pre style={{color:'#aaa', fontSize:11, whiteSpace:'pre-wrap', fontFamily:'inherit', lineHeight:1.5, margin:'0 0 12px', maxHeight:120, overflowY:'auto'}}>{latestRelease.body.slice(0,400)}</pre>
            )}
            <a href={latestRelease.html_url} target="_blank" rel="noopener noreferrer"
              style={{display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', background:'rgba(167,139,250,0.2)', border:'1px solid rgba(167,139,250,0.35)', borderRadius:8, color:'#a78bfa', fontSize:12, textDecoration:'none', fontWeight:600}}>
              <Download size={12}/> Download on GitHub
            </a>
          </div>
        )}

        {/* Auto-update toggle */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, marginBottom:20, border:'1px solid rgba(255,255,255,0.06)'}}>
          <div>
            <div style={{color:'#e5e5e5', fontSize:13, fontWeight:500}}>Auto-check on launch</div>
            <div style={{color:'#555', fontSize:11, marginTop:2}}>Automatically check for updates when the app opens</div>
          </div>
          <div onClick={() => toggleAutoUpdate(!autoUpdate)} style={{width:36, height:20, borderRadius:10, background: autoUpdate ? '#a78bfa' : 'rgba(255,255,255,0.1)', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0}}>
            <div style={{position:'absolute', top:3, left: autoUpdate ? 18 : 3, width:14, height:14, borderRadius:'50%', background:'white', transition:'left .2s'}}/>
          </div>
        </div>

        <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'7px 16px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'#888', cursor:'pointer', fontSize:13}}>Close</button>
          <button onClick={checkNow} disabled={status==='checking'} style={{padding:'7px 16px', background:'rgba(167,139,250,0.2)', border:'1px solid rgba(167,139,250,0.3)', borderRadius:8, color:'#a78bfa', cursor:'pointer', fontSize:13, opacity:status==='checking'?0.6:1}}>
            {status === 'checking' ? 'Checking…' : 'Check Now'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/callback" element={<CallbackPage />} />
      <Route path="/callback/mal" element={<MALCallbackPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/browse" element={<ProtectedRoute><BrowsePage /></ProtectedRoute>} />
      <Route path="/anisongs" element={<ProtectedRoute><AniSongsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for menu bar events
    window.electronAPI.onOpenModal?.((modal) => {
      if (modal === 'changelog') setChangelogOpen(true);
      if (modal === 'updates') setUpdatesOpen(true);
    });

    // Auto-check for updates on launch if enabled
    const autoUpdate = localStorage.getItem('aniatlas_auto_update') === 'true';
    if (autoUpdate) {
      setTimeout(async () => {
        try {
          const releases = await window.electronAPI.fetchChangelog?.();
          const stable = (releases || []).filter(r => !r.prerelease);
          if (!stable.length) return;
          const current = await window.electronAPI.getAppVersion?.() || '1.0.0';
          const latest = stable[0];
          const pa = latest.tag_name.replace(/^v/,'').split('.').map(Number);
          const pb = current.replace(/^v/,'').split('.').map(Number);
          let newer = false;
          for (let i = 0; i < 3; i++) { if ((pa[i]||0) > (pb[i]||0)) { newer = true; break; } if ((pa[i]||0) < (pb[i]||0)) break; }
          if (newer) setUpdatesOpen(true);
        } catch {}
      }, 5000); // 5s delay so app loads first
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <MenuNavListener />
          <AppRoutes />
          <Toaster position="bottom-right" />
          <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
          <UpdatesModal open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
