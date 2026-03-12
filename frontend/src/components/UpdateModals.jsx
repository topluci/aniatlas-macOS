import { useState, useEffect } from 'react';
import { X, RefreshCw, Download, CheckCircle, Tag, GitBranch, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

export function ChangelogModal({ open, onClose }) {
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    window.electronAPI?.fetchChangelog().then(d => { setReleases(Array.isArray(d) ? d.filter(r => !r.draft) : []); setLoading(false); }).catch(() => setLoading(false));
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-[580px] max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2"><Tag className="w-4 h-4 text-primary" /><h2 className="font-semibold">Changelog</h2></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {loading && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          {!loading && releases.length === 0 && <p className="text-muted-foreground text-sm text-center py-12">No releases found.</p>}
          {releases.map(r => (
            <div key={r.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{r.tag_name}</span>
                {r.prerelease && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 border border-yellow-500/30">PRE-RELEASE</span>}
                <span className="text-xs text-muted-foreground ml-auto">{new Date(r.published_at).toLocaleDateString()}</span>
                <a href={r.html_url} onClick={e => { e.preventDefault(); window.electronAPI?.openExternal?.(r.html_url); }} className="text-muted-foreground hover:text-primary"><ExternalLink className="w-3.5 h-3.5" /></a>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/40 rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap border border-border/30">{r.body || 'No release notes.'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function UpdatesModal({ open, onClose }) {
  const [channel, setChannel] = useState('stable');
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState(null);
  const [ver, setVer] = useState('');
  const [progress, setProgress] = useState(0);
  useEffect(() => { if (open) window.electronAPI?.getUpdateChannel().then(ch => ch && setChannel(ch)); }, [open]);
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onUpdateAvailable?.(v => { setVer(v); setStatus('available'); setChecking(false); });
    window.electronAPI.onUpdateProgress?.(p => { setProgress(p); setStatus('downloading'); });
    window.electronAPI.onUpdateDownloaded?.(v => { setVer(v); setStatus('ready'); });
  }, []);
  const handleChannel = async (ch) => { setChannel(ch); await window.electronAPI?.setUpdateChannel(ch); };
  const handleCheck = () => { setChecking(true); setStatus(null); window.electronAPI?.checkForUpdates(); setTimeout(() => { setChecking(false); setStatus(s => s || 'up-to-date'); }, 6000); };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-[440px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2"><RefreshCw className="w-4 h-4 text-primary" /><h2 className="font-semibold">Updates</h2></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium"><GitBranch className="w-3.5 h-3.5 text-muted-foreground" />Update Channel</div>
            <div className="grid grid-cols-3 gap-2">
              {[{value:'stable',label:'Stable',desc:'Recommended'},{value:'beta',label:'Beta',desc:'Pre-release'},{value:'alpha',label:'Alpha',desc:'Experimental'}].map(({value,label,desc}) => (
                <button key={value} onClick={() => handleChannel(value)} className={`flex flex-col items-center py-2.5 px-2 rounded-xl border-2 transition-all ${channel===value?'border-primary bg-primary/10':'border-border/50 hover:border-primary/40'}`}>
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
            {channel !== 'stable' && <p className="text-xs text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">⚠️ Pre-release builds may be unstable.</p>}
          </div>
          <div className="border-t border-border/50" />
          {status === 'up-to-date' && <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 rounded-xl px-4 py-3 border border-green-500/20"><CheckCircle className="w-4 h-4" />You're on the latest version!</div>}
          {status === 'available' && <div className="flex items-center gap-2 text-sm bg-primary/10 rounded-xl px-4 py-3 border border-primary/20"><Download className="w-4 h-4 text-primary" />v{ver} available — downloading…</div>}
          {status === 'downloading' && <div className="space-y-2"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Downloading…</span><span>{progress}%</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all" style={{width:`${progress}%`}} /></div></div>}
          {status === 'ready' && <div className="space-y-3"><div className="flex items-center gap-2 text-sm bg-green-500/10 rounded-xl px-4 py-3 border border-green-500/20 text-green-500"><CheckCircle className="w-4 h-4" />v{ver} ready to install</div><Button className="w-full" onClick={() => window.electronAPI?.installUpdate()}>Restart & Install Update</Button></div>}
          {status !== 'ready' && status !== 'downloading' && <Button className="w-full" variant={status==='up-to-date'?'outline':'default'} onClick={handleCheck} disabled={checking}>{checking?<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking…</>:<><RefreshCw className="w-4 h-4 mr-2" />Check for Updates</>}</Button>}
        </div>
      </div>
    </div>
  );
}
