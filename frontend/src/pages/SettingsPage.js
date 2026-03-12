import { getBackendUrl } from '../lib/apiUrl';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Bell, BellRing, Clock, Settings as SettingsIcon, Check, X, AlertCircle, Shield, ShieldOff, Loader2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const API = `${getBackendUrl()}/api`;

// Storage key for notification settings (local backup)
const NOTIFICATION_SETTINGS_KEY = 'anischedule_notification_settings';

const DEFAULT_SETTINGS = {
  desktopNotifications: false,
  notificationPermission: 'default',
  reminderTimes: ['30'],
  releaseTypes: ['sub'],
  adultContent: false,
};

const REMINDER_OPTIONS = [
  { value: '5', label: '5 minutes before' },
  { value: '10', label: '10 minutes before' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '360', label: '6 hours before' },
  { value: '1440', label: '1 day before' },
];

const RELEASE_TYPES = [
  { value: 'raw', label: 'Raw (Japanese)', description: 'Original broadcast time' },
  { value: 'sub', label: 'Subtitled', description: 'Fan/official subs release' },
  { value: 'dub', label: 'Dubbed', description: 'English dub release' },
];

// Convert URL-safe base64 to Uint8Array for push subscription
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function SettingsPage() {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  // Load settings from backend on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await axios.get(`${API}/push/settings`, { withCredentials: true });
        setSettings(prev => ({
          ...prev,
          reminderTimes: response.data.reminderTimes || ['30'],
          releaseTypes: response.data.releaseTypes || ['sub'],
          adultContent: response.data.adultContent || false,
        }));
      } catch (error) {
        console.log('Using local settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Check notification permission and service worker on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
    
    // Check if service worker is registered and has push subscription
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        setPushSubscribed(!!subscription);
        if (subscription) {
          setSettings(prev => ({ ...prev, desktopNotifications: true }));
        }
      });
    }
  }, []);

  // Save settings to localStorage as backup
  useEffect(() => {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Register service worker
  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }
    
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  };

  // Subscribe to push notifications
  const subscribeToPush = async () => {
    try {
      // Get VAPID public key from backend
      const keyResponse = await axios.get(`${API}/push/vapid-public-key`);
      const publicKey = keyResponse.data.publicKey;
      
      const registration = await registerServiceWorker();
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      
      // Send subscription to backend
      const subscriptionJson = subscription.toJSON();
      await axios.post(`${API}/push/subscribe`, {
        endpoint: subscriptionJson.endpoint,
        keys: subscriptionJson.keys
      }, { withCredentials: true });
      
      setPushSubscribed(true);
      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      throw error;
    }
  };

  // Unsubscribe from push
  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }
      
      await axios.delete(`${API}/push/unsubscribe`, { withCredentials: true });
      setPushSubscribed(false);
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Desktop notifications not supported', {
        description: 'Your browser does not support desktop notifications.',
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        // Subscribe to push notifications
        await subscribeToPush();
        setSettings(prev => ({ ...prev, desktopNotifications: true }));
        toast.success('Notifications enabled!', {
          description: 'You will receive desktop notifications for upcoming episodes.',
        });
        
        // Show a test notification
        new Notification('AniSchedule', {
          body: 'Desktop notifications are now enabled!',
          icon: '/favicon.svg',
        });
      } else if (permission === 'denied') {
        toast.error('Notifications blocked', {
          description: 'Please enable notifications in your browser settings.',
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to enable notifications');
    }
  };

  const toggleDesktopNotifications = async () => {
    if (!settings.desktopNotifications) {
      // Enabling
      if (permissionStatus === 'granted') {
        try {
          await subscribeToPush();
          setSettings(prev => ({ ...prev, desktopNotifications: true }));
          toast.success('Notifications enabled!');
        } catch (error) {
          toast.error('Failed to enable push notifications');
        }
      } else if (permissionStatus === 'denied') {
        toast.error('Notifications blocked', {
          description: 'Please enable notifications in your browser settings.',
        });
      } else {
        await requestNotificationPermission();
      }
    } else {
      // Disabling
      await unsubscribeFromPush();
      setSettings(prev => ({ ...prev, desktopNotifications: false }));
      toast.success('Notifications disabled');
    }
  };

  const toggleReminderTime = (value) => {
    setSettings(prev => {
      const current = prev.reminderTimes || [];
      if (current.includes(value)) {
        return { ...prev, reminderTimes: current.filter(t => t !== value) };
      } else {
        return { ...prev, reminderTimes: [...current, value] };
      }
    });
  };

  const toggleReleaseType = (value) => {
    setSettings(prev => {
      const current = prev.releaseTypes || [];
      if (current.includes(value)) {
        if (current.length === 1) {
          toast.error('At least one release type must be selected');
          return prev;
        }
        return { ...prev, releaseTypes: current.filter(t => t !== value) };
      } else {
        return { ...prev, releaseTypes: [...current, value] };
      }
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/push/settings`, {
        reminderTimes: settings.reminderTimes,
        releaseTypes: settings.releaseTypes,
        adultContent: settings.adultContent
      }, { withCredentials: true });
      
      toast.success('Settings saved!');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save settings', {
        description: 'Settings saved locally only.'
      });
    } finally {
      setSaving(false);
    }
  };

  const testNotification = async () => {
    if (!pushSubscribed) {
      // Fallback to local notification
      if (permissionStatus === 'granted') {
        new Notification('Episode Reminder', {
          body: 'Your Name - Episode 1 airs in 30 minutes!',
          icon: '/favicon.svg',
          tag: 'test-notification',
        });
        toast.success('Test notification sent!');
      } else {
        toast.error('Please enable notifications first');
      }
      return;
    }

    try {
      await axios.post(`${API}/push/test`, {}, { withCredentials: true });
      toast.success('Test notification sent via push!');
    } catch (error) {
      // Fallback to local notification
      if (permissionStatus === 'granted') {
        new Notification('Episode Reminder', {
          body: 'Your Name - Episode 1 airs in 30 minutes!',
          icon: '/favicon.svg',
          tag: 'test-notification',
        });
        toast.success('Test notification sent (local)');
      } else {
        toast.error('Failed to send test notification');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="settings-page">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <SettingsIcon className="h-8 w-8 text-primary" />
                Settings
              </h1>
              <p className="text-muted-foreground">
                Customize your notification preferences
              </p>
            </div>
            <Button onClick={saveSettings} disabled={saving} data-testid="save-settings">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>

          {/* Desktop Notifications Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Desktop Notifications
              </CardTitle>
              <CardDescription>
                Receive browser notifications when episodes are about to air
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="desktop-notifications" className="text-base">
                    Enable Desktop Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified before episodes air
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {permissionStatus === 'denied' && (
                    <Badge variant="destructive" className="text-xs">
                      <X className="w-3 h-3 mr-1" />
                      Blocked
                    </Badge>
                  )}
                  {permissionStatus === 'granted' && settings.desktopNotifications && (
                    <Badge variant="default" className="text-xs bg-green-600">
                      <Check className="w-3 h-3 mr-1" />
                      {pushSubscribed ? 'Push Active' : 'Active'}
                    </Badge>
                  )}
                  <Switch
                    id="desktop-notifications"
                    checked={settings.desktopNotifications}
                    onCheckedChange={toggleDesktopNotifications}
                    disabled={permissionStatus === 'denied'}
                    data-testid="toggle-notifications"
                  />
                </div>
              </div>

              {/* Permission Warning */}
              {permissionStatus === 'denied' && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Notifications are blocked</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      To enable notifications, click the lock icon in your browser's address bar and allow notifications for this site.
                    </p>
                  </div>
                </div>
              )}

              {/* Test Button */}
              {settings.desktopNotifications && permissionStatus === 'granted' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testNotification}
                  data-testid="test-notification"
                >
                  <BellRing className="w-4 h-4 mr-2" />
                  Send Test Notification
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Reminder Times Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Reminder Times
              </CardTitle>
              <CardDescription>
                Choose when to receive notifications before an episode airs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {REMINDER_OPTIONS.map((option) => {
                  const isSelected = settings.reminderTimes?.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => toggleReminderTime(option.value)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                      data-testid={`reminder-${option.value}`}
                    >
                      {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Select multiple times to receive multiple reminders
              </p>
            </CardContent>
          </Card>

          {/* Release Types Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Release Types
              </CardTitle>
              <CardDescription>
                Choose which release types to get notified about (powered by AnimeSchedule.net)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {RELEASE_TYPES.map((type) => {
                  const isSelected = settings.releaseTypes?.includes(type.value);
                  return (
                    <button
                      key={type.value}
                      onClick={() => toggleReleaseType(type.value)}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                      data-testid={`release-${type.value}`}
                    >
                      <div>
                        <p className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                          {type.label}
                        </p>
                        <p className="text-sm text-muted-foreground">{type.description}</p>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Sub and dub release times are sourced from AnimeSchedule.net when available
              </p>
            </CardContent>
          </Card>

          {/* Content Filtering Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Content Filtering
              </CardTitle>
              <CardDescription>
                Control what type of content is shown
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="adult-content" className="text-base">
                    Show 18+ Adult Content
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Include mature anime and songs in search results
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {settings.adultContent ? (
                    <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                      <ShieldOff className="w-3 h-3 mr-1" />
                      NSFW On
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-green-500 text-green-500">
                      <Shield className="w-3 h-3 mr-1" />
                      Safe Mode
                    </Badge>
                  )}
                  <Switch
                    id="adult-content"
                    checked={settings.adultContent || false}
                    onCheckedChange={(checked) => {
                      setSettings(prev => ({ ...prev, adultContent: checked }));
                      toast.success(checked ? '18+ content enabled' : 'Safe mode enabled');
                    }}
                    data-testid="toggle-adult-content"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                When disabled, adult-only anime and explicit content will be filtered from browse and search results.
              </p>
            </CardContent>
          </Card>

          {/* Current Settings Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Current Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desktop Notifications:</span>
                  <span className={settings.desktopNotifications ? 'text-green-500' : 'text-muted-foreground'}>
                    {settings.desktopNotifications ? (pushSubscribed ? 'Push Enabled' : 'Enabled') : 'Disabled'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reminder Times:</span>
                  <span>
                    {settings.reminderTimes?.length > 0
                      ? settings.reminderTimes.map(t => {
                          const opt = REMINDER_OPTIONS.find(o => o.value === t);
                          return opt?.label.replace(' before', '');
                        }).join(', ')
                      : 'None selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Release Types:</span>
                  <span>
                    {settings.releaseTypes?.map(t => {
                      const opt = RELEASE_TYPES.find(o => o.value === t);
                      return opt?.label;
                    }).join(', ') || 'None selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adult Content:</span>
                  <span className={settings.adultContent ? 'text-orange-500' : 'text-green-500'}>
                    {settings.adultContent ? 'Enabled' : 'Disabled (Safe Mode)'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}
