/**
 * Notification service — uses Electron native notifications.
 * Falls back to browser Notification API in web mode.
 */

let _settings = null;

export async function loadSettings() {
  if (window.electronAPI?.loadNotifSettings) {
    _settings = await window.electronAPI.loadNotifSettings();
  }
  return _settings || { enabled: true, minutesBefore: 60 };
}

export async function saveSettings(settings) {
  _settings = settings;
  if (window.electronAPI?.saveNotifSettings) {
    await window.electronAPI.saveNotifSettings(settings);
  }
}

export async function requestPermission() {
  // In Electron, native notifications don't need permission
  if (window.electronAPI?.showNotification) return 'granted';
  // Browser fallback
  if ('Notification' in window) {
    return await Notification.requestPermission();
  }
  return 'denied';
}

export async function showNotification({ title, body, icon }) {
  if (window.electronAPI?.showNotification) {
    return window.electronAPI.showNotification({ title, body, icon });
  }
  // Browser fallback
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon });
    return true;
  }
  return false;
}

// Schedule upcoming episode notifications
let _scheduledTimers = new Map();

export function scheduleEpisodeNotifications(schedules, settings = null) {
  const s = settings || _settings || { enabled: true, minutesBefore: 60 };
  if (!s.enabled) return;

  // Clear existing timers
  _scheduledTimers.forEach(t => clearTimeout(t));
  _scheduledTimers.clear();

  const now = Math.floor(Date.now() / 1000);
  const notifySecondsAhead = (s.minutesBefore || 60) * 60;

  schedules.forEach(episode => {
    const notifyAt = episode.airingAt - notifySecondsAhead;
    const msUntil = (notifyAt - now) * 1000;

    // Only schedule future notifications within next 7 days
    if (msUntil > 0 && msUntil < 7 * 24 * 60 * 60 * 1000) {
      const title = episode.title_english || episode.title_romaji || 'New Episode';
      const timer = setTimeout(() => {
        showNotification({
          title: `${title}`,
          body: `Episode ${episode.episode} airs in ${s.minutesBefore} minutes`,
          icon: episode.coverImage,
        });
      }, msUntil);
      _scheduledTimers.set(`${episode.mediaId}-${episode.episode}`, timer);
    }
  });

  console.log(`[notifications] Scheduled ${_scheduledTimers.size} episode reminders`);
}
