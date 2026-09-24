#!/bin/zsh
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "${0:A:h}"
if ! command -v npm >/dev/null 2>&1; then
  print 'Node.js fehlt. Bitte Node.js 22.12 oder neuer installieren.'
  read '?Enter zum Schließen: '
  exit 1
fi
if curl --silent --fail --max-time 2 http://127.0.0.1:5173/ | /usr/bin/grep -q 'moxd Lab'; then
  print 'Das Spiel läuft bereits: http://127.0.0.1:5173/'
  read '?Enter zum Schließen: '
  exit 0
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
print 'Im Browser öffnen: http://127.0.0.1:5173/'
print 'Dieses Terminal offen lassen. Mit Ctrl+C beenden.'
npm run dev
