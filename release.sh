#!/usr/bin/env bash
set -eo pipefail

VERSION="$1"
if [ -z "$VERSION" ]; then
  echo "Usage: ./release.sh 1.2.0"
  exit 1
fi

if [ -z "${GH_TOKEN}" ]; then
  echo "Error: GH_TOKEN not set. Run: export GH_TOKEN=ghp_yourtoken"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
DESKTOP_DIR="$SCRIPT_DIR/desktop"

echo "Releasing AniSchedule v$VERSION"

# Bump version
node -e "var fs=require('fs'),p=JSON.parse(fs.readFileSync('$DESKTOP_DIR/package.json','utf8'));p.version='$VERSION';fs.writeFileSync('$DESKTOP_DIR/package.json',JSON.stringify(p,null,2)+'\n');console.log('Version bumped to',p.version);"

# Build frontend
echo "Building frontend..."
cd "$FRONTEND_DIR"
yarn install --frozen-lockfile 2>&1 | tail -3
REACT_APP_BACKEND_URL=http://127.0.0.1:18472 PUBLIC_URL=. yarn build 2>&1 | tail -5
rm -rf "$DESKTOP_DIR/frontend-build"
cp -r build "$DESKTOP_DIR/frontend-build"

# Build and publish
echo "Publishing to GitHub..."
cd "$DESKTOP_DIR"
npm install
GH_TOKEN="$GH_TOKEN" npm run publish-arm64

echo "Done! Go to https://github.com/topluci/anischedule-macOS/releases and publish the draft."
