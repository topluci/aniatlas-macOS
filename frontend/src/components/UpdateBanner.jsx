import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

export function UpdateBanner() {
  const [state, setState] = useState(null); // null | 'available' | 'downloading' | 'ready'
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable?.((v) => {
      setVersion(v);
      setState('available');
    });
    window.electronAPI.onUpdateProgress?.((p) => {
      setProgress(p);
      setState('downloading');
    });
    window.electronAPI.onUpdateDownloaded?.((v) => {
      setVersion(v);
      setState('ready');
    });
  }, []);

  if (!state || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[340px] bg-card border border-border rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        {state === 'ready'
          ? <RefreshCw className="w-4 h-4 text-primary" />
          : <Download className="w-4 h-4 text-primary" />
        }
      </div>

      <div className="flex-1 min-w-0">
        {state === 'available' && (
          <>
            <p className="text-sm font-semibold">Update available — v{version}</p>
            <p className="text-xs text-muted-foreground">Downloading in the background…</p>
          </>
        )}
        {state === 'downloading' && (
          <>
            <p className="text-sm font-semibold">Downloading update… {progress}%</p>
            <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </>
        )}
        {state === 'ready' && (
          <>
            <p className="text-sm font-semibold">v{version} ready to install</p>
            <p className="text-xs text-muted-foreground">Restart to apply the update</p>
          </>
        )}
      </div>

      {state === 'ready' && (
        <button
          onClick={() => window.electronAPI.installUpdate?.()}
          className="flex-shrink-0 text-xs font-semibold bg-primary text-primary-foreground rounded-lg px-3 py-1.5 hover:bg-primary/90 transition-colors"
        >
          Restart
        </button>
      )}

      {state !== 'downloading' && (
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
