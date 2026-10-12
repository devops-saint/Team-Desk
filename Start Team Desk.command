#!/bin/bash
# Team Desk launcher for macOS (and Linux). Double-click to start.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.nvm/versions/node"/*/bin /opt/homebrew/bin /usr/local/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required. Install it from https://nodejs.org and try again."
  read -n 1 -s -r -p "Press any key to close."; exit 1
fi
node server/server.js "$@"
