/**
 * main.js – Electron main process for AniSchedule
 */

const { app, BrowserWindow, ipcMain, shell, dialog, session, Menu, Tray, nativeImage, Notification: ElectronNotification } = require('electron');
const path   = require('path');
const fs     = require('fs');
const http   = require('http');
const https  = require('https');
const { spawn, execFileSync } = require('child_process');

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_PORT = 18472;
const isDev        = !app.isPackaged;

// ─── Paths ────────────────────────────────────────────────────────────────────

function getResourcePath(...segments) {
  if (isDev) return path.join(__dirname, '..', ...segments);
  return path.join(process.resourcesPath, ...segments);
}

const VENV_DIR           = path.join(app.getPath('userData'), 'backend-venv');
const TOKEN_FILE         = path.join(app.getPath('userData'), 'auth_token.json');
const NOTIF_SETTINGS_FILE = path.join(app.getPath('userData'), 'notif_settings.json');

// ─── Python discovery ─────────────────────────────────────────────────────────

function findPython() {
  const candidates = [
    '/Library/Frameworks/Python.framework/Versions/3.13/bin/python3.13',
    '/Library/Frameworks/Python.framework/Versions/3.12/bin/python3.12',
    '/Library/Frameworks/Python.framework/Versions/3.11/bin/python3.11',
    '/Library/Frameworks/Python.framework/Versions/3.10/bin/python3.10',
    '/opt/homebrew/bin/python3',
    '/usr/local/bin/python3',
    '/usr/bin/python3',
    'python3',
    'python',
  ];

  for (const candidate of candidates) {
    try {
      const result = execFileSync(candidate, ['-c', 'import sys; print(sys.version_info >= (3,10))'], {
        timeout: 3000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      if (result === 'True') {
        console.log('[main] Found Python:', candidate);
        return candidate;
      }
    } catch { /* try next */ }
  }
  return null;
}

// ─── Venv + deps setup ────────────────────────────────────────────────────────

async function ensureVenv(pythonBin) {
  const venvPython = path.join(VENV_DIR, 'bin', 'python3');
  const requirementsFile = getResourcePath('backend', 'requirements.txt');
  const stampFile = path.join(VENV_DIR, '.installed-stamp');

  let requirementsHash = '';
  try {
    const content = fs.readFileSync(requirementsFile, 'utf8');
    requirementsHash = content.trim();
  } catch { /* no requirements.txt */ }

  let stampContent = '';
  try { stampContent = fs.readFileSync(stampFile, 'utf8').trim(); } catch { /* first run */ }

  const needsInstall = !fs.existsSync(venvPython) || stampContent !== requirementsHash;

  if (needsInstall) {
    console.log('[main] Setting up backend venv at:', VENV_DIR);
    await runCommand(pythonBin, ['-m', 'venv', VENV_DIR]);
    await runCommand(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', '-q']);
    if (fs.existsSync(requirementsFile)) {
      await runCommand(venvPython, ['-m', 'pip', 'install', '-r', requirementsFile, '-q']);
    }
    fs.writeFileSync(stampFile, requirementsHash);
    console.log('[main] Backend deps installed ✓');
  } else {
    console.log('[main] Backend venv up-to-date ✓');
  }

  return venvPython;
}

function runCommand(bin, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: 'inherit' });
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`${bin} exited ${code}`)));
    proc.on('error', reject);
  });
}

// ─── Backend ──────────────────────────────────────────────────────────────────

let backendProcess = null;

function startBackend(venvPython) {
  const resourceBackend = getResourcePath('backend');
  const userBackendDir  = path.join(app.getPath('userData'), 'backend');

  if (app.isPackaged) {
    if (!fs.existsSync(path.join(userBackendDir, 'server.py'))) {
      try { fs.cpSync(resourceBackend, userBackendDir, { recursive: true }); } catch (e) { console.error('[main] copy error:', e.message); }
    }
    const envSrc = path.join(resourceBackend, '.env');
    const envDst = path.join(userBackendDir, '.env');
    if (fs.existsSync(envSrc) && !fs.existsSync(envDst)) {
      try { fs.copyFileSync(envSrc, envDst); } catch {}
    }
  }

  const backendDir = (app.isPackaged && fs.existsSync(path.join(userBackendDir, 'server.py')))
    ? userBackendDir : resourceBackend;

  console.log('[main] Starting backend in:', backendDir);

  backendProcess = spawn(
    venvPython,
    ['-m', 'uvicorn', 'server:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT), '--log-level', 'warning'],
    { cwd: backendDir, env: { ...process.env, PYTHONUNBUFFERED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  backendProcess.stdout.on('data', d => console.log('[backend]', d.toString().trim()));
  backendProcess.stderr.on('data', d => console.log('[backend]', d.toString().trim()));
  backendProcess.on('exit', code => { console.log('[main] Backend exited:', code); backendProcess = null; });
  backendProcess.on('error', e => { console.error('[main] Backend error:', e.message); backendProcess = null; });
}

function stopBackend() {
  if (backendProcess) {
    console.log('[main] Stopping backend…');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

function waitForBackend(maxRetries = 60, intervalMs = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, res => {
        if (res.statusCode === 200) { console.log('[main] Backend ready ✓'); resolve(); }
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(800, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (++attempts >= maxRetries) reject(new Error('Backend did not start in time'));
      else setTimeout(check, intervalMs);
    };
    check();
  });
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow = null;

function createWindow() {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640,
    titleBarStyle: 'hiddenInset',
    ...(isMac
      ? {
          backgroundColor: '#00000000',
          transparent: true,
          vibrancy: 'sidebar',
          visualEffectState: 'active',
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      `window.__ANISCHEDULE__ = { backendUrl: 'http://127.0.0.1:${BACKEND_PORT}' };`
    );
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
  buildAppMenu(mainWindow);
  setupTray(mainWindow);
  buildAppMenu(mainWindow);
  setupTray(mainWindow);
    mainWindow.loadFile(path.join(__dirname, 'frontend-build', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith('file://') ||
      (isDev && url.startsWith('http://localhost:3000')) ||
      url.startsWith(`http://127.0.0.1:${BACKEND_PORT}`);
    if (!isLocal) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('open-external', (_event, url) => {
  console.log('[main] Opening in browser:', url);
  return shell.openExternal(url);
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-backend-url', () => `http://127.0.0.1:${BACKEND_PORT}`);

ipcMain.removeHandler('focus-window'); ipcMain.handle('focus-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// Token storage
ipcMain.handle('save-token', async (_, token) => {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, savedAt: Date.now() }));
    return true;
  } catch (e) { return false; }
});

ipcMain.handle('load-token', async () => {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    if (Date.now() - data.savedAt > 30 * 24 * 60 * 60 * 1000) {
      fs.unlinkSync(TOKEN_FILE);
      return null;
    }
    return data.token;
  } catch (e) { return null; }
});

ipcMain.handle('clear-token', async () => {
  try { if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE); } catch (e) {}
  return true;
});

// Notifications
ipcMain.handle('show-notification', async (_, { title, body, icon }) => {
  if (!ElectronNotification.isSupported()) return false;
  try {
    const n = new ElectronNotification({
      title: title || 'AniAtlas',
      body: body || '',
      icon: icon || undefined,
      silent: false,
    });
    n.on('click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
    n.show();
    return true;
  } catch (e) { console.error('Notification error:', e); return false; }
});

ipcMain.handle('save-notif-settings', async (_, settings) => {
  try { fs.writeFileSync(NOTIF_SETTINGS_FILE, JSON.stringify(settings)); return true; }
  catch (e) { return false; }
});

ipcMain.handle('load-notif-settings', async () => {
  try {
    if (!fs.existsSync(NOTIF_SETTINGS_FILE)) return null;
    return JSON.parse(fs.readFileSync(NOTIF_SETTINGS_FILE, 'utf8'));
  } catch (e) { return null; }
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


// ── Calendar auto-sync ────────────────────────────────────────────────────────
const ICS_FILE      = path.join(app.getPath('userData'), 'anischedule.ics');
const CAL_SETTINGS  = path.join(app.getPath('userData'), 'cal_settings.json');
let   calSyncTimer  = null;

function loadCalSettings() {
  try {
    if (fs.existsSync(CAL_SETTINGS)) return JSON.parse(fs.readFileSync(CAL_SETTINGS, 'utf8'));
  } catch {}
  return { syncFrequency: 'launch' };
}

function saveCalSettings(settings) {
  try { fs.writeFileSync(CAL_SETTINGS, JSON.stringify(settings)); } catch {}
}

async function syncCalendar(token) {
  if (!token) return;
  try {
    const { net } = require('electron');
    await new Promise((resolve, reject) => {
      const req = net.request({
        method: 'GET',
        url: `http://127.0.0.1:${BACKEND_PORT}/api/calendar/export/ics`,
        headers: { Authorization: `Bearer ${token}` },
      });
      let data = '';
      req.on('response', (res) => {
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200 && data.includes('BEGIN:VCALENDAR')) {
            fs.writeFileSync(ICS_FILE, data);
            console.log('[calendar] ICS synced to', ICS_FILE);
            resolve();
          } else {
            reject(new Error(`ICS fetch failed: ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
    return ICS_FILE;
  } catch (e) {
    console.error('[calendar] sync error:', e.message);
    return null;
  }
}

function scheduleSyncTimer(token, frequencyHours) {
  if (calSyncTimer) { clearInterval(calSyncTimer); calSyncTimer = null; }
  if (!frequencyHours || frequencyHours <= 0) return;
  calSyncTimer = setInterval(() => syncCalendar(token), frequencyHours * 60 * 60 * 1000);
  console.log(`[calendar] Auto-sync every ${frequencyHours}h`);
}

ipcMain.handle('cal-sync', async (_, token) => {
  const file = await syncCalendar(token);
  return file;
});

ipcMain.handle('cal-open', async (_, token) => {
  const file = await syncCalendar(token);
  if (file) shell.openPath(file);
  return !!file;
});

ipcMain.handle('cal-get-settings', async () => loadCalSettings());

ipcMain.handle('cal-save-settings', async (_, settings) => {
  saveCalSettings(settings);
  return true;
});

ipcMain.handle('cal-schedule-sync', async (_, { token, frequencyHours }) => {
  scheduleSyncTimer(token, frequencyHours);
  return true;
});

ipcMain.handle('cal-get-ics-path', async () => ICS_FILE);

app.on('before-quit', () => { stopBackend(); if (calSyncTimer) clearInterval(calSyncTimer); });


// ── Auto-updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater(win) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for update…');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
    win.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] App is up to date');
  });

  autoUpdater.on('download-progress', (p) => {
    win.webContents.send('update-progress', Math.round(p.percent));
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Update downloaded:', info.version);
    win.webContents.send('update-downloaded', info.version);
  });

  autoUpdater.on('error', (e) => {
    console.error('[updater] Error:', e.message);
  });

  // Check for updates 10 seconds after launch, then every 4 hours
  setTimeout(() => autoUpdater.checkForUpdates(), 10_000);
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

app.whenReady().then(async () => {
  // Splash screen while backend starts
  const splash = new BrowserWindow({
    width: 340, height: 200, frame: false, resizable: false, alwaysOnTop: true,
    webPreferences: { nodeIntegration: false },
    backgroundColor: '#0f0f11',
  });
  splash.loadURL(`data:text/html,<html><body style="background:#0f0f11;color:#e5e5e5;font-family:-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0"><h2 style="margin-bottom:8px">AniAtlas</h2><p style="color:#666;font-size:13px">Starting backend…</p></body></html>`);

  try {
    const python = findPython();
    if (!python) {
      dialog.showErrorBox(
        'Python Not Found',
        'AniAtlas needs Python 3.10 or later.\n\nPlease install it from https://python.org and relaunch.'
      );
      app.quit();
      return;
    }

    const venvPython = await ensureVenv(python);
    startBackend(venvPython);
    await waitForBackend();
  } catch (err) {
    console.error('[main] Backend startup error:', err.message);
    // Continue anyway — UI will show API errors
  }

  splash.close();

  // CORS fix for Electron file:// origin
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [`http://127.0.0.1:${BACKEND_PORT}/*`] },
    (details, callback) => {
      details.requestHeaders['Origin'] = `http://127.0.0.1:${BACKEND_PORT}`;
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ─── App Menu ─────────────────────────────────────────────────────────────────
function buildAppMenu(win) {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' },
      { label: 'Preferences…', accelerator: 'Cmd+,', click: () => win.webContents.send('nav', 'settings') },
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' },
    ]}] : []),
    { label: 'File', submenu: [
      { label: 'Export Calendar (.ics)', accelerator: 'CmdOrCtrl+E', click: () => win.webContents.send('open-modal', 'export') },
      { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' },
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => win.webContents.send('nav', 'dashboard') },
      { label: 'Browse',    accelerator: 'CmdOrCtrl+2', click: () => win.webContents.send('nav', 'browse') },
      { type: 'separator' }, { role: 'reload' }, { role: 'forceReload' },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' }, { role: 'zoom' },
      ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
    ]},
    { label: 'Help', submenu: [
      { label: 'Check for Updates…', click: () => win.webContents.send('open-modal', 'updates') },
      { label: 'View Changelog', click: () => win.webContents.send('open-modal', 'changelog') },
      { type: 'separator' },
      { label: 'AniAtlas on GitHub', click: () => shell.openExternal('https://github.com/topluci/aniatlas-macOS') },
      { label: 'Report an Issue',   click: () => shell.openExternal('https://github.com/topluci/aniatlas-macOS/issues') },
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
let tray = null;
let trayWin = null;
let trayData = { schedule: [], watching: [], stats: {} };

function setupTray(mainWin) {
  const assetsDir = isDev
    ? path.join(__dirname, '..', 'assets')
    : path.join(process.resourcesPath, 'assets');
  let icon = nativeImage.createEmpty();
  const iconPath = path.join(assetsDir, 'icon.png');
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    icon.setTemplateImage(true);
  }
  tray = new Tray(icon);
  tray.setToolTip('AniAtlas');

  trayWin = new BrowserWindow({
    width: 340, height: 520,
    show: false, frame: false, resizable: false,
    transparent: true, alwaysOnTop: true, skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  const TRAY_HTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;background:rgba(18,18,24,0.96);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-radius:14px;border:1px solid rgba(255,255,255,0.1);color:#e5e5e5;height:100vh;display:flex;flex-direction:column;overflow:hidden}
.hdr{padding:12px 14px 10px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.logo{font-size:13px;font-weight:700;color:#a78bfa}
.openbtn{font-size:11px;color:#888;cursor:pointer;padding:3px 10px;border:1px solid rgba(255,255,255,0.12);border-radius:20px;background:none;transition:all .15s}
.openbtn:hover{color:#e5e5e5;border-color:rgba(255,255,255,0.25)}
.scroll{flex:1;overflow-y:auto;padding:6px 0}
.scroll::-webkit-scrollbar{width:3px}
.scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
.sec{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#555;padding:10px 14px 4px}
.row{padding:5px 14px;display:flex;align-items:center;justify-content:space-between}
.row:hover{background:rgba(255,255,255,0.03)}
.rtitle{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:185px}
.rsub{font-size:10px;color:#666;margin-top:1px}
.badge{font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;flex-shrink:0;margin-left:6px}
.soon{background:rgba(167,139,250,0.18);color:#a78bfa}
.today{background:rgba(52,211,153,0.15);color:#34d399}
.later{background:rgba(255,255,255,0.06);color:#666}
.wbtn{font-size:10px;color:#a78bfa;cursor:pointer;padding:2px 8px;border:1px solid rgba(167,139,250,0.25);border-radius:20px;background:none;flex-shrink:0;margin-left:6px;transition:all .15s}
.wbtn:hover{background:rgba(167,139,250,0.15)}
.wbtn:disabled{opacity:.4;cursor:default}
.div{height:1px;background:rgba(255,255,255,0.05);margin:4px 14px}
.sg{display:grid;grid-template-columns:1fr 1fr 1fr;padding:6px 14px 2px}
.st{text-align:center;padding:6px 4px}
.sn{font-size:17px;font-weight:700;color:#a78bfa}
.sl{font-size:9px;color:#555;margin-top:1px;text-transform:uppercase;letter-spacing:.05em}
.hrow{padding:6px 14px;display:flex;gap:6px}
.hi{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:20px;color:#e5e5e5;font-size:12px;padding:5px 12px;outline:none;font-family:inherit}
.hi::placeholder{color:#444}
.hi:focus{border-color:rgba(167,139,250,0.4);background:rgba(167,139,250,0.05)}
.hsend{background:rgba(167,139,250,0.2);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;border-radius:20px;padding:5px 12px;cursor:pointer;font-size:12px;flex-shrink:0}
.hsend:hover{background:rgba(167,139,250,0.35)}
.hresp{margin:2px 14px 8px;padding:8px 12px;background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.12);border-radius:10px;font-size:11px;color:#bbb;line-height:1.6;display:none;white-space:pre-wrap}
.empty{padding:12px 14px;font-size:11px;color:#444;text-align:center}
</style></head><body>
<div class="hdr"><span class="logo">⬡ AniAtlas</span><button class="openbtn" onclick="window.electronAPI.focusWindow()">Open App</button></div>
<div class="scroll" id="c"><div class="empty">Loading…</div></div>
<script>
const api=window.electronAPI;
function fmt(s){s=Math.max(0,s);if(s<60)return'Now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return m?h+'h '+m+'m':h+'h';}const d=Math.floor(s/86400);return d===1?'Tomorrow':d+'d';}
function bc(s){return s<3600?'soon':s<86400?'today':'later';}
async function mw(id,ep,btn){btn.textContent='✓';btn.disabled=true;try{await api.markWatched(id,ep);}catch(e){btn.textContent='+1';btn.disabled=false;}}
function render(data){
  const now=Math.floor(Date.now()/1000);let h='';
  const up=(data.schedule||[]).filter(e=>e.airingAt>now).sort((a,b)=>a.airingAt-b.airingAt).slice(0,5);
  if(up.length){h+='<div class="sec">Next Episodes</div>';up.forEach(ep=>{const d=ep.airingAt-now;h+=\`<div class="row"><div style="min-width:0"><div class="rtitle">\${ep.title}</div><div class="rsub">Ep \${ep.episode}</div></div><span class="badge \${bc(d)">\${fmt(d)}</span></div>\`;});h+='<div class="div"></div>';}
  const w=(data.watching||[]).slice(0,4);
  if(w.length){h+='<div class="sec">Continue Watching</div>';w.forEach(a=>{h+=\`<div class="row"><div style="min-width:0"><div class="rtitle">\${a.title}</div><div class="rsub">Ep \${a.progress||0}\${a.episodes?' / '+a.episodes:''}</div></div><button class="wbtn" onclick="mw(\${a.id},\${(a.progress||0)+1},this)">+1</button></div>\`;});h+='<div class="div"></div>';}
  const s=data.stats||{};
  if(s.watching!=null){h+=\`<div class="sec">Your Stats</div><div class="sg"><div class="st"><div class="sn">\${s.watching||0}</div><div class="sl">Watching</div></div><div class="st"><div class="sn">\${s.completed||0}</div><div class="sl">Done</div></div><div class="st"><div class="sn">\${s.episodesWatched||0}</div><div class="sl">Episodes</div></div></div><div class="div"></div>\`;}
  h+='<div class="sec">Ask Hikari</div><div class="hrow"><input class="hi" id="hq" placeholder="What should I watch tonight?" onkeydown="if(event.key===\'Enter\')ask()"><button class="hsend" onclick="ask()">&#x21B5;</button></div><div class="hresp" id="hr"></div>';
  if(!up.length&&!w.length){h='<div class="empty">Log in to see your schedule here.</div>'+h;}
  document.getElementById('c').innerHTML=h;
}
async function ask(){const i=document.getElementById('hq'),r=document.getElementById('hr'),q=i.value.trim();if(!q)return;r.style.display='block';r.textContent='Thinking…';i.value='';try{r.textContent=await api.askHikariQuick(q);}catch{r.textContent='Could not reach Hikari.';}}
api.getTrayData().then(d=>{if(d)render(d);});
setInterval(()=>api.getTrayData().then(d=>{if(d)render(d);}),60000);
</script></body></html>`;

  trayWin.loadURL('data:text/html;base64,' + Buffer.from(TRAY_HTML).toString('base64'));
  trayWin.on('blur', () => trayWin.hide());

  tray.on('click', () => {
    if (trayWin.isVisible()) { trayWin.hide(); return; }
    const { x, y, width } = tray.getBounds();
    const wx = Math.round(x + width / 2 - 170);
    const wy = process.platform === 'darwin' ? y - 526 : y + 28;
    trayWin.setPosition(Math.max(0, wx), Math.max(0, wy));
    trayWin.show();
    trayWin.focus();
  });

  function updateTitle() {
    const now = Math.floor(Date.now() / 1000);
    const next = (trayData.schedule || []).filter(e => e.airingAt > now).sort((a,b) => a.airingAt - b.airingAt)[0];
    if (next) {
      const d = next.airingAt - now;
      const t = d < 3600 ? Math.floor(d/60)+'m' : d < 86400 ? Math.floor(d/3600)+'h' : Math.floor(d/86400)+'d';
      const title = next.title.length > 13 ? next.title.slice(0,13)+'…' : next.title;
      tray.setTitle(' '+title+' '+t);
    } else {
      tray.setTitle('');
    }
  }
  setInterval(updateTitle, 60000);

  ipcMain.removeHandler('update-tray-data'); ipcMain.handle('update-tray-data', (_, data) => { trayData = data; updateTitle(); });
  ipcMain.removeHandler('get-tray-data'); ipcMain.handle('get-tray-data', () => trayData);
  ipcMain.removeHandler('focus-window'); ipcMain.handle('focus-window', () => { mainWin.show(); mainWin.focus(); });
  ipcMain.removeHandler('ask-hikari-quick'); ipcMain.handle('ask-hikari-quick', async (_, q) => {
    try {
      const tp = path.join(app.getPath('userData'), 'auth_token.json');
      if (!fs.existsSync(tp)) return 'Please log in to AniAtlas first.';
      const { token } = JSON.parse(fs.readFileSync(tp, 'utf8'));
      const body = JSON.stringify({ messages: [{ role: 'user', content: q }] });
      return new Promise((resolve) => {
        const req = http.request({ hostname: '127.0.0.1', port: BACKEND_PORT, path: '/api/ai/chat', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token, 'Content-Length': Buffer.byteLength(body) }
        }, res => { let d=''; res.on('data',c=>{d+=c;}); res.on('end',()=>{ try{resolve(JSON.parse(d).response||'No response');}catch{resolve(d.slice(0,300));} }); });
        req.on('error', () => resolve('Could not reach Hikari.'));
        req.setTimeout(15000, () => { req.destroy(); resolve('Hikari timed out.'); });
        req.write(body); req.end();
      });
    } catch(e) { return 'Error: '+e.message; }
  });
  ipcMain.removeHandler('mark-watched-tray'); ipcMain.handle('mark-watched-tray', async (_, id, ep) => {
    try {
      const tp = path.join(app.getPath('userData'), 'auth_token.json');
      if (!fs.existsSync(tp)) return false;
      const { token } = JSON.parse(fs.readFileSync(tp, 'utf8'));
      const body = JSON.stringify({ progress: ep });
      return new Promise((resolve) => {
        const req = http.request({ hostname: '127.0.0.1', port: BACKEND_PORT, path: '/api/anime/entry/'+id, method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+token, 'Content-Length': Buffer.byteLength(body) }
        }, res => { res.resume(); resolve(res.statusCode===200); });
        req.on('error', () => resolve(false));
        req.write(body); req.end();
      });
    } catch { return false; }
  });
  ipcMain.removeHandler('fetch-changelog'); ipcMain.handle('fetch-changelog', () => new Promise((resolve) => {
    const req = https.get({ hostname: 'api.github.com', path: '/repos/topluci/aniatlas-macOS/releases', headers: { 'User-Agent': 'AniAtlas' } },
      res => { let d=''; res.on('data',c=>{d+=c;}); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch{resolve([]);} }); });
    req.on('error', () => resolve([]));
    req.setTimeout(8000, () => { req.destroy(); resolve([]); });
  }));
  ipcMain.removeHandler('get-update-channel'); ipcMain.handle('get-update-channel', () => {
    try { const f=path.join(app.getPath('userData'),'update_channel.json'); if(fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf8')).channel||'stable'; } catch {}
    return 'stable';
  });
  ipcMain.removeHandler('set-update-channel'); ipcMain.handle('set-update-channel', (_, ch) => {
    try { fs.writeFileSync(path.join(app.getPath('userData'),'update_channel.json'), JSON.stringify({channel:ch})); } catch {}
    return true;
  });
}

// ─── App Menu ─────────────────────────────────────────────────────────────────
