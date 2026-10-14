#!/bin/bash
# Central Team Desk demo, case 2: administrator + one user who is only a line manager.
# Run while the central server is running. If you already registered your own administrator account, it asks for it.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.nvm/versions/node"/*/bin /opt/homebrew/bin /usr/local/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
read -r -p "Your administrator email (press Enter if you have not registered one yet): " ADMIN
if [ -n "$ADMIN" ]; then node scripts/seed-central.js --scenario lm --admin-email "$ADMIN" "$@"; else node scripts/seed-central.js --scenario lm "$@"; fi
read -n 1 -s -r -p "Press any key to close."
