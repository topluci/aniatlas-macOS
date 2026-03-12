#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AniAtlas macOS DMG Builder
# Run this script on your Mac to produce the distributable DMG.
#
# Prerequisites (all free):
#   • macOS 12+
#   • Node.js 18+  →  https://nodejs.org
#   • Python 3.10+ →  https://python.org  (or `brew install python`)
#   • Yarn         →  npm install -g yarn
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Sanity: refuse to build from the Trash ────────────────────────────────────
if [[ "$SCRIPT_DIR" == *".Trash"* ]]; then
  echo "❌  You are running this script from the Trash!"
  echo "    Move the AniAtlas-macOS folder out of the Trash first, then re-run."
  exit 1
fi
FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_DIR="$SCRIPT_DIR/backend"
DESKTOP_DIR="$SCRIPT_DIR/desktop"
DIST_DIR="$SCRIPT_DIR/dist"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║    AniAtlas macOS DMG Builder  v1.2   ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Check tools ───────────────────────────────────────────────────────────
check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌  '$1' not found. Please install it and re-run."
    exit 1
  fi
}
check_cmd node
check_cmd npm
check_cmd python3
if ! command -v yarn &>/dev/null; then
  echo "   → yarn not found, installing…"
  npm install -g yarn
fi

echo "✅  Node $(node -v)  |  Python $(python3 --version 2>&1)"
echo ""

# ── 2. Build the React frontend ───────────────────────────────────────────────
echo "📦  Building React frontend…"
cd "$FRONTEND_DIR"
yarn install --frozen-lockfile 2>&1 | tail -5

# Point the built app at the local backend (Electron injects this at runtime too)
REACT_APP_BACKEND_URL=http://127.0.0.1:18472 \
  PUBLIC_URL=. \
  yarn build 2>&1 | tail -10

FRONTEND_BUILD="$FRONTEND_DIR/build"
DESKTOP_FRONTEND="$DESKTOP_DIR/frontend-build"

echo "🔗  Copying build to desktop/frontend-build…"
rm -rf "$DESKTOP_FRONTEND"
cp -r "$FRONTEND_BUILD" "$DESKTOP_FRONTEND"

# ── 3. Set up Python venv ────────────────────────────────────────────────────
echo ""
echo "🐍  Setting up Python virtual environment…"
cd "$BACKEND_DIR"

# ── Find a working Python 3.10+ interpreter ───────────────────────────────────
PYTHON=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3 python; do
  if command -v "$candidate" &>/dev/null; then
    ver=$("$candidate" -c "import sys; print(sys.version_info >= (3,10))" 2>/dev/null)
    if [ "$ver" = "True" ]; then
      PYTHON="$candidate"
      echo "   → Using Python: $(command -v $PYTHON)  ($($PYTHON --version))"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  echo "❌  Python 3.10+ not found. Install it from https://python.org and re-run."
  exit 1
fi

# Remove any broken venv so we always start clean
rm -rf venv

# Create venv with the resolved interpreter
"$PYTHON" -m venv venv
VENV_PYTHON="$(pwd)/venv/bin/python3"
if [ ! -f "$VENV_PYTHON" ]; then
  # Some installs symlink without the '3' suffix
  VENV_PYTHON="$(pwd)/venv/bin/python"
fi

if [ ! -f "$VENV_PYTHON" ]; then
  echo "❌  venv Python binary not found – venv creation failed."
  exit 1
fi

# Ensure pip is available inside the venv
if ! "$VENV_PYTHON" -m pip --version &>/dev/null; then
  echo "   → pip not bundled – bootstrapping via ensurepip / get-pip…"
  if ! "$VENV_PYTHON" -m ensurepip --upgrade 2>/dev/null; then
    echo "   → ensurepip failed, trying get-pip.py…"
    curl -sSL https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
    "$VENV_PYTHON" /tmp/get-pip.py -q
  fi
fi

if ! "$VENV_PYTHON" -m pip --version &>/dev/null; then
  echo "❌  pip still unavailable after bootstrap – aborting."
  exit 1
fi

"$VENV_PYTHON" -m pip install --upgrade pip -q
"$VENV_PYTHON" -m pip install -r requirements.txt -q

# Create stable venv/bin/pip and venv/bin/python3 wrappers if missing
VENV_BIN="$(pwd)/venv/bin"
[ ! -f "$VENV_BIN/pip" ]     && ln -sf "$VENV_PYTHON" "$VENV_BIN/pip"     2>/dev/null || true
[ ! -f "$VENV_BIN/python3" ] && ln -sf "$VENV_PYTHON" "$VENV_BIN/python3" 2>/dev/null || true

echo "✅  Python deps installed."

# ── 4. Create .env template if missing ───────────────────────────────────────
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo ""
  echo "⚠️   No backend/.env found – creating a template."
  cat > "$ENV_FILE" << 'ENVEOF'
# ── AniAtlas Environment Configuration ────────────────────────────────────
# Fill in ALL values before running the app.

# MongoDB – get a free cluster at https://mongodb.com/atlas
MONGO_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/?retryWrites=true
DB_NAME=AniAtlas

# AniList OAuth – register at https://anilist.co/settings/developer
ANILIST_CLIENT_ID=
ANILIST_CLIENT_SECRET=
ANILIST_REDIRECT_URI=http://localhost:18472/api/auth/anilist/redirect

# MyAnimeList OAuth (optional)
MAL_CLIENT_ID=
MAL_CLIENT_SECRET=
MAL_REDIRECT_URI=http://localhost:18472/api/auth/mal/redirect

# Security – replace with a long random string
JWT_SECRET=change-me-to-something-random-and-secret

# VAPID keys for push notifications (optional)
# VAPID_PRIVATE_KEY=
# VAPID_PUBLIC_KEY=
ENVEOF
  echo "   → Edit backend/.env before first launch."
fi

# ── 5. Install Electron dependencies & build DMG ─────────────────────────────
echo ""
echo "⚡  Installing Electron & building DMG…"
cd "$DESKTOP_DIR"

# Remove stale node_modules so version upgrades take effect cleanly
rm -rf node_modules package-lock.json
npm install

echo ""
echo "📀  Packaging DMG (this may take a minute)…"

# electron-builder builds the .app bundle only (dir target, no Python needed).
# We then wrap it in a DMG ourselves using macOS built-in hdiutil — no
# third-party Python dependency at all.

npm run dist-arm64

APP_PATH="$DIST_DIR/mac-arm64/AniAtlas.app"
DMG_PATH="$DIST_DIR/AniAtlas-1.0.0-arm64.dmg"
TMP_DMG_DIR="$(mktemp -d)/AniAtlas"

if [ ! -d "$APP_PATH" ]; then
  echo "❌  .app bundle not found at $APP_PATH"
  exit 1
fi

echo ""
echo "💿  Creating DMG with hdiutil…"
mkdir -p "$TMP_DMG_DIR"
cp -r "$APP_PATH" "$TMP_DMG_DIR/"

# Create a symlink so users can drag to Applications
ln -sf /Applications "$TMP_DMG_DIR/Applications"

hdiutil create \
  -volname "AniAtlas" \
  -srcfolder "$TMP_DMG_DIR" \
  -ov -format UDZO \
  "$DMG_PATH"

rm -rf "$(dirname $TMP_DMG_DIR)"
echo "✅  DMG created: $DMG_PATH"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅  Done!  Your DMG is in:  dist/       ║"
echo "╚══════════════════════════════════════════╝"
echo ""
ls -lh "$DIST_DIR"/*.dmg 2>/dev/null || echo "(DMG files listed above)"
echo ""
echo "Next steps:"
echo "  1. Make sure Python 3.10+ is installed on your Mac (python.org)"
echo "  2. Edit backend/.env with your API keys (if not already done)"
echo "  3. Open the DMG and drag AniAtlas to Applications"
echo "  4. On first launch, the app installs Python deps automatically (~30s)"
echo ""
