#!/bin/bash
# Adds demo reportees to the running Team Desk (Mac / Linux). Double-click while Team Desk is running.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.nvm/versions/node"/*/bin /opt/homebrew/bin /usr/local/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
node scripts/seed-demo.js "$@"
read -n 1 -s -r -p "Press any key to close."
