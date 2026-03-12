import { getBackendUrl } from '../lib/apiUrl';
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Download, Calendar, Apple, Chrome, Check, Loader2, Copy, Link, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken } from '../context/AuthContext';

const API = `${getBackendUrl()}/api`;

export function ExportModal() {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [subscribeUrls, setSubscribeUrls] = useState(null);
  const [loadingSubscribe, setLoadingSubscribe] = useState(false);
  const [calSettings, setCalSettings] = useState({ syncFrequency: 'launch' });
  const [syncing, setSyncing] = useState(false);

  const fetchSubscribeUrls = async () => {
    setLoadingSubscribe(true);
    try {
      const response = await axios.get(`${API}/calendar/subscribe/token`, {
        withCredentials: true,
      });
      setSubscribeUrls(response.data);
    } catch (error) {
      console.error('Failed to get subscribe URLs:', error);
    } finally {
      setLoadingSubscribe(false);
    }
  };

  useEffect(() => {
    if (open && !subscribeUrls) {
      fetchSubscribeUrls();
    }
    if (open && window.electronAPI?.calGetSettings) {
      window.electronAPI.calGetSettings().then(s => { if (s) setCalSettings(s); });
    }
  }, [open]);

  const handleOpenInAppleCalendar = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API}/calendar/export/ics`, {
        credentials: 'include',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!response.ok) throw new Error('Failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'anischedule.ics';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      // On macOS, opening the downloaded ICS will launch Calendar.app automatically
      toast.success('Opening in Calendar…', {
        description: 'Double-click the downloaded file to import into Apple Calendar.',
      });
    } catch (e) {
      toast.error('Failed to open in Calendar');
    }
  };

const handleDownloadICS = async () => {
    setDownloading(true);
    try {
      // Get auth token for header-based auth (needed in Electron)
      let headers = {};
      try {
        const { getAuthToken } = await import('../context/AuthContext');
        const token = getAuthToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      } catch (e) {}
      const response = await fetch(`${API}/calendar/export/ics`, {
        credentials: 'include',
        headers,
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate calendar file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'anischedule.ics';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Calendar file downloaded!', {
        description: 'Import the .ics file into your calendar app.',
      });
      setOpen(false);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed', {
        description: 'Please try again later.',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const token = getAuthToken();
      if (window.electronAPI?.calOpen) {
        const ok = await window.electronAPI.calOpen(token);
        if (ok) toast.success('Calendar synced!', { description: 'Opening in Calendar app…' });
        else toast.error('Sync failed', { description: 'Make sure the backend is running.' });
      } else {
        // Web fallback — just download
        await handleDownloadICS();
      }
    } finally { setSyncing(false); }
  };

  const handleFrequencyChange = async (freq) => {
    const newSettings = { ...calSettings, syncFrequency: freq };
    setCalSettings(newSettings);
    if (window.electronAPI?.calSaveSettings) {
      await window.electronAPI.calSaveSettings(newSettings);
      const token = getAuthToken();
      const hours = { 'launch': 0, '6h': 6, '12h': 12, 'daily': 24, 'weekly': 168 }[freq] || 0;
      if (window.electronAPI?.calScheduleSync) {
        await window.electronAPI.calScheduleSync({ token, frequencyHours: hours });
      }
    }
    toast.success('Sync frequency saved!');
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`, {
      description: 'Paste into your calendar app.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full shadow-lg hover:shadow-primary/25 transition-shadow"
          data-testid="export-btn"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Calendar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Export to Calendar
          </DialogTitle>
          <DialogDescription>
            Download or subscribe to your anime schedule
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="subscribe" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="subscribe" data-testid="tab-subscribe">
              <RefreshCw className="w-4 h-4 mr-2" />
              Auto-Sync
            </TabsTrigger>
            <TabsTrigger value="download" data-testid="tab-download">
              <Download className="w-4 h-4 mr-2" />
              Download
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscribe" className="space-y-4 pt-4">
            {/* Sync frequency selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Auto-sync frequency</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'launch', label: 'On Launch' },
                  { value: '6h',     label: 'Every 6h' },
                  { value: '12h',    label: 'Every 12h' },
                  { value: 'daily',  label: 'Daily' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'manual', label: 'Manual only' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handleFrequencyChange(value)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      calSettings.syncFrequency === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground hover:border-primary/40'
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSyncNow} disabled={syncing}>
                {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync Now & Open in Calendar
              </Button>
            </div>

            <div className="border-t border-border/50" />

            {loadingSubscribe ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : subscribeUrls ? (
              <>
                <div className="space-y-3">
                  {/* Google Calendar */}
                  <Card className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Chrome className="h-5 w-5 text-blue-500" />
                        <span className="font-medium text-sm">Google Calendar</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(subscribeUrls.google_url, '_blank')}
                        data-testid="subscribe-google"
                      >
                        <Link className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </Card>

                  {/* Apple Calendar */}
                  <Card className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Apple className="h-5 w-5" />
                        <div><span className="font-medium text-sm">Apple Calendar</span><p className="text-xs text-muted-foreground">Import ICS file</p></div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenInAppleCalendar}
                        data-testid="subscribe-apple"
                      >
                        <Link className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </Card>

                  {/* Outlook */}
                  <Card className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <span className="font-medium text-sm">Outlook</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(subscribeUrls.outlook_url, '_blank')}
                        data-testid="subscribe-outlook"
                      >
                        <Link className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  </Card>

                  {/* Manual URL */}
                  <div className="space-y-2 pt-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Or copy subscription URL:
                    </label>
                    <div className="flex gap-2">
                      <Input 
                        value={subscribeUrls.subscribe_url} 
                        readOnly 
                        className="text-xs"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(subscribeUrls.subscribe_url, 'URL')}
                        data-testid="copy-subscribe-url"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 mt-4">
                  <p className="text-xs text-muted-foreground">
                    <RefreshCw className="w-3 h-3 inline mr-1" />
                    Your calendar will automatically sync when new episodes are scheduled. No need to re-download!
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">Failed to load URLs</div>
            )}
          </TabsContent>

          <TabsContent value="download" className="space-y-4 pt-4">
            {/* ICS Download Option */}
            <Card
              className="p-4 cursor-pointer hover:bg-accent/50 transition-colors border-border/50"
              onClick={handleDownloadICS}
              data-testid="export-ics"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold mb-1">Download .ics File</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    One-time download (will not auto-update)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <CalendarBadge icon={<Apple className="h-3 w-3" />} name="Apple" />
                    <CalendarBadge icon={<Chrome className="h-3 w-3" />} name="Google" />
                    <CalendarBadge icon={<Calendar className="h-3 w-3" />} name="Outlook" />
                  </div>
                </div>
                {downloading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <Check className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </Card>

            {/* Instructions */}
            <div className="rounded-lg bg-muted/50 p-4">
              <h5 className="font-medium text-sm mb-2">How to import:</h5>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">1.</span>
                  Download the .ics file
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">2.</span>
                  Open your calendar app
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">3.</span>
                  Import or open the file
                </li>
              </ol>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function CalendarBadge({ icon, name }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-background text-xs text-muted-foreground">
      {icon}
      <span>{name}</span>
    </div>
  );
}
