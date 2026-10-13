#!/bin/bash
# Starts the CENTRAL (multi-user) Team Desk on this machine — for a company server or to try it out.
# Others on your network open http://<this-computer>:8080 . Use HTTPS before real use (see README).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.nvm/versions/node"/*/bin /opt/homebrew/bin /usr/local/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required. Install it from https://nodejs.org and try again."
  read -n 1 -s -r -p "Press any key to close."; exit 1
fi
node server/central.js "$@"
