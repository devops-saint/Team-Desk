#!/bin/bash
# Central Team Desk demo for accounts that already exist: gives one of the two demo teams
# to an existing line manager. People managers see it automatically. No accounts are created.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  for d in "$HOME/.nvm/versions/node"/*/bin /opt/homebrew/bin /usr/local/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
echo "Demo team 1: Asha, Rohan, Neha, Priya, Vikram, Arjun"
echo "Demo team 2: Divya, Karthik, Sneha, Ananya, Farhan, Nikhil"
read -r -p "Administrator email: " ADMIN
read -r -p "Which demo team, 1 or 2? " DS
read -r -p "Line manager email to give it to: " LM
node scripts/seed-central.js --admin-email "$ADMIN" --dataset "${DS:-1}" --email "$LM" "$@"
read -n 1 -s -r -p "Press any key to close."
