import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../lib/apiUrl';
import { useAuth } from '../context/AuthContext';
import { getAuthToken } from '../context/AuthContext';
import { X, Send, Bot, User, Loader2, Sparkles, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';

const API = `${getBackendUrl()}/api`;

// Markdown-lite: bold **text**, newlines → <br>
function MarkdownText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part.split('\n').map((line, j, arr) => (
              <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
            ))
      )}
    </span>
  );
}

const QUICK_PROMPTS = [
  { label: '🎯 Recommend me something', msg: 'What anime should I watch next based on my taste?' },
  { label: '📅 What airs today?', msg: 'What anime episodes are airing today?' },
  { label: '💎 Hidden gems', msg: 'Show me some underrated hidden gem anime I might have missed.' },
  { label: '😌 Relaxing anime', msg: 'I want something relaxing to watch tonight, not too intense.' },
  { label: '🔥 Tonight\'s pick', msg: 'What should I watch tonight? Keep it short.' },
  { label: '📖 Watch order help', msg: 'Which series in my list has a complex watch order I should know about?' },
];

export function ChatPanel({ open, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hey ${user?.username || 'there'}! 👋 I'm Hikari, your personal anime guide.\n\nI can see your AniList — ask me for recommendations, what's airing today, hidden gems, or anything anime!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg = { role: 'user', content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);

    try {
      // Only send last 12 messages to keep context window small
      const recent = history.slice(-12);
      const token = getAuthToken();
      const res = await axios.post(
        `${API}/chat`,
        { messages: recent.map(m => ({ role: m.role, content: m.content })) },
        {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      let detail = err.response?.data?.detail || err.message || 'Something went wrong.';
      if (err.response?.status === 401) detail = 'Not authenticated — please log in again.';
      if (err.response?.status === 404) detail = 'Chat endpoint not found — restart the backend.';
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${detail}`, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] flex flex-col bg-background border-l border-border shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50">
          <div className="flex items-center gap-2.5">
            <img
                src={`./hikari/hikari_${(() => { try { return localStorage.getItem('hikari_avatar') || 'classic'; } catch { return 'classic'; } })()}.png`}
                alt="Hikari"
                className="w-8 h-8 rounded-full object-cover ring-1 ring-primary/30"
                onError={e => { e.currentTarget.style.display='none'; }}
              />
            <div>
              <p className="font-semibold text-sm">Hikari</p>
              <p className="text-[10px] text-muted-foreground">Powered by Llama 3 · Using your AniList data</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Clear chat"
              onClick={() => setMessages([{
                role: 'assistant',
                content: `Hey ${user?.username || 'there'}! Chat cleared. What would you like to know?`,
              }])}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {loading && (
            <div className="flex items-start gap-2.5">
              <img
                src={`./hikari/hikari_${(() => { try { return localStorage.getItem('hikari_avatar') || 'classic'; } catch { return 'classic'; } })()}.png`}
                alt="Hikari"
                className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full object-cover ring-1 ring-primary/30"
                onError={e => { e.currentTarget.style.display='none'; }}
              />
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Thinking…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts — only show if only the greeting is shown */}
        {messages.length === 1 && (
          <div className="px-4 pb-3">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Quick prompts</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => send(p.msg)}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-border/60 text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-border/50">
          <div className="flex items-end gap-2 bg-muted rounded-2xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about anime, recommendations, schedule…"
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/60 max-h-28 leading-relaxed"
              style={{ minHeight: '24px' }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px';
              }}
              disabled={loading}
            />
            <Button
              size="icon"
              className="h-8 w-8 rounded-full flex-shrink-0"
              onClick={() => send()}
              disabled={!input.trim() || loading}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">Enter to send · Shift+Enter for newline</p>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isUser ? 'bg-primary/20' : 'bg-primary/10'
      }`}>
        {isUser
          ? <User className="h-3.5 w-3.5 text-primary" />
          : <img src={`./hikari/hikari_${(() => { try { return localStorage.getItem('hikari_avatar') || 'classic'; } catch { return 'classic'; } })()}.png`} alt="Hikari" className="w-7 h-7 rounded-full object-cover" onError={e => { e.currentTarget.style.display='none'; }} />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        isUser
          ? 'bg-primary text-primary-foreground rounded-tr-sm'
          : msg.error
          ? 'bg-destructive/10 text-destructive rounded-tl-sm border border-destructive/20'
          : 'bg-muted rounded-tl-sm'
      }`}>
        <MarkdownText text={msg.content} />
      </div>
    </div>
  );
}
