#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting ConRumbo backend on http://127.0.0.1:8000 ..."
(cd "$ROOT_DIR/backend" && python app.py) &
BACK_PID=$!

echo "Starting ConRumbo frontend on http://127.0.0.1:3000 ..."
(cd "$ROOT_DIR/frontend" && python -m http.server 3000) &
FRONT_PID=$!

cleanup() {
  echo "\nStopping services..."
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo
echo "Backend:  http://127.0.0.1:8000"
echo "Frontend: http://127.0.0.1:3000"
echo "Use Ajustes -> Servidor to set backend URL (e.g., http://<IP-PC>:8000)"
echo

wait
