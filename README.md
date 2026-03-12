# AniSchedule — macOS DMG Build

A native macOS desktop app for AniSchedule: your anime schedule tracker with AniList integration.

---

## Prerequisites

Install these once on your Mac (all free):

| Tool | Download |
|------|----------|
| Node.js 18+ | https://nodejs.org |
| Python 3.10+ | https://python.org or `brew install python` |
| Yarn | `npm install -g yarn` |

---

## Quick Build

```bash
cd AniSchedule-macOS
chmod +x build-dmg.sh
./build-dmg.sh
```

The script will:
1. Install frontend dependencies and build the React app
2. Set up a Python virtual environment with all backend packages
3. Create a `backend/.env` template (edit this with your keys!)
4. Package everything into a `.dmg` in the `dist/` folder

---

## Configuration (Required)

Before launching, edit `backend/.env` with your credentials:

```env
# MongoDB – free tier at https://mongodb.com/atlas
MONGO_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/
DB_NAME=anischedule

# AniList OAuth – register at https://anilist.co/settings/developer
# Set Redirect URI to: http://localhost:18472/api/auth/callback
ANILIST_CLIENT_ID=your_client_id
ANILIST_CLIENT_SECRET=your_client_secret
ANILIST_REDIRECT_URI=http://localhost:18472/api/auth/callback

# Security
JWT_SECRET=replace-with-a-long-random-string
```

---

## How It Works

```
AniSchedule.app
├── Electron shell          (macOS window, menus, file:// serving)
├── React frontend          (pre-built static files, served locally)
└── Python FastAPI backend  (starts automatically on port 18472)
```

When you launch AniSchedule:
1. Electron opens the window and loads the static React build
2. A Python subprocess starts the FastAPI backend on `localhost:18472`
3. The frontend talks to the backend via HTTP on loopback (no internet needed for the app itself)
4. When you quit, the backend is cleanly shut down

---

## Troubleshooting

**App opens but shows a blank screen / loading forever**
→ The backend may not have started. Check that Python 3.10+ is installed and `backend/.env` is configured.

**"Backend did not start in time" error**
→ Open Terminal and run:
```bash
cd AniSchedule-macOS/backend
python3 -m uvicorn server:app --port 18472
```
Look for errors in the output (usually missing env vars or wrong MongoDB URL).

**macOS says "app is from an unidentified developer"**
→ Right-click the app → Open → Open anyway. (The app isn't code-signed, which is normal for personal/dev builds.)

**OAuth redirect doesn't work**
→ Make sure `ANILIST_REDIRECT_URI` in `.env` matches exactly what you registered on the AniList developer portal.

---

## Building a Universal Binary (Intel + Apple Silicon)

```bash
cd desktop
npm run dist:all
```

This produces a universal DMG that runs natively on both Intel Macs and Apple Silicon.

---

## Project Structure

```
AniSchedule-macOS/
├── build-dmg.sh          ← Run this to build the DMG
├── README.md
├── frontend/             ← React source code
│   └── src/
├── backend/              ← FastAPI Python server
│   ├── server.py
│   ├── requirements.txt
│   └── .env              ← YOU MUST CONFIGURE THIS
└── desktop/              ← Electron wrapper
    ├── main.js           ← App entry point
    ├── preload.js
    ├── package.json      ← electron-builder config
    └── assets/
        ├── icon.png
        ├── icon.icns
        └── dmg-background.png
```
