/**
 * preload.js – Runs in the renderer context but has access to Node APIs.
 * Exposes a safe, narrow API to the renderer via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Environment
  isElectron:        true,
  platform:          process.platform,
  isMac:             process.platform === 'darwin',

  // Open a URL in the system default browser (OAuth flows)
  openExternal:      (url)      => ipcRenderer.invoke('open-external', url),
  getBackendUrl:     ()         => ipcRenderer.invoke('get-backend-url'),

  // Focus app window
  focusWindow:       ()         => ipcRenderer.invoke('focus-window'),

  // Persistent token storage
  saveToken:         (token)    => ipcRenderer.invoke('save-token', token),
  loadToken:         ()         => ipcRenderer.invoke('load-token'),
  clearToken:        ()         => ipcRenderer.invoke('clear-token'),

  // Native OS notifications
  showNotification:  (opts)     => ipcRenderer.invoke('show-notification', opts),
  saveNotifSettings: (settings) => ipcRenderer.invoke('save-notif-settings', settings),
  loadNotifSettings: ()         => ipcRenderer.invoke('load-notif-settings'),

  // Calendar sync
  calSync:          (token)     => ipcRenderer.invoke('cal-sync', token),
  calOpen:          (token)     => ipcRenderer.invoke('cal-open', token),
  calGetSettings:   ()          => ipcRenderer.invoke('cal-get-settings'),
  calSaveSettings:  (s)         => ipcRenderer.invoke('cal-save-settings', s),
  calScheduleSync:  (opts)      => ipcRenderer.invoke('cal-schedule-sync', opts),
  calGetIcsPath:    ()          => ipcRenderer.invoke('cal-get-ics-path'),

  // Auto-updater
  installUpdate:      ()        => ipcRenderer.invoke('install-update'),
  checkForUpdates:    ()        => ipcRenderer.invoke('check-for-updates'),
  onUpdateAvailable:  (cb)      => ipcRenderer.on('update-available',  (_, v) => cb(v)),
  onUpdateProgress:   (cb)      => ipcRenderer.on('update-progress',   (_, p) => cb(p)),
  onUpdateDownloaded: (cb)      => ipcRenderer.on('update-downloaded', (_, v) => cb(v)),

  // Menu bar navigation — use once() so it doesn't stack on re-renders
  onNav: (cb) => {
    ipcRenderer.removeAllListeners('nav');
    ipcRenderer.on('nav', (_, page) => cb(page));
  },

  // Menu bar modal triggers
  onOpenModal: (cb) => {
    ipcRenderer.removeAllListeners('open-modal');
    ipcRenderer.on('open-modal', (_, modal) => cb(modal));
  },

  // Changelog + update channel
  fetchChangelog:    ()         => ipcRenderer.invoke('fetch-changelog'),
  getUpdateChannel:  ()         => ipcRenderer.invoke('get-update-channel'),
  setUpdateChannel:  (ch)       => ipcRenderer.invoke('set-update-channel', ch),

  // App version
  getAppVersion:     ()         => ipcRenderer.invoke('get-app-version'),

  // Tray
  getTrayData:       ()         => ipcRenderer.invoke('get-tray-data'),
  updateTrayData:    (d)        => ipcRenderer.invoke('update-tray-data', d),
  askHikariQuick:    (q)        => ipcRenderer.invoke('ask-hikari-quick', q),
  markWatched:       (id, ep)   => ipcRenderer.invoke('mark-watched-tray', id, ep),
});
