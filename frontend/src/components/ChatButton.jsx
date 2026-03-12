import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { useAuth } from '../context/AuthContext';

export function ChatButton() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const { user } = useAuth();

  // Pulse for 4 seconds after launch then stop
  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!user) return null;

  return (
    <>
      <ChatPanel open={open} onClose={() => setOpen(false)} />
      {!open && (
        <button
          onClick={() => { setOpen(true); setPulse(false); }}
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transition-all duration-200"
          style={{ width: 52, height: 52 }}
          title="Chat with Hikari"
          aria-label="Open AI chat"
        >
          <HikariAvatar size={52} />
          {pulse && (
            <span className="absolute inset-0 rounded-full ring-2 ring-primary/40 animate-ping pointer-events-none" />
          )}
        </button>
      )}
    </>
  );
}

function HikariAvatar({ size = 52 }) {
  const key = (() => { try { return localStorage.getItem('hikari_avatar') || 'classic'; } catch { return 'classic'; } })();
  return (
    <img
      src={`./hikari/hikari_${key}.png`}
      alt="Hikari"
      style={{ width: size, height: size }}
      className="rounded-full object-cover"
      onError={e => { e.currentTarget.style.display = 'none'; }}
    />
  );
}
