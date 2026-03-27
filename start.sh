#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.dev-pids"

if [ -f "$PID_FILE" ]; then
  echo "Already running? Found .dev-pids. Run ./stop.sh first."
  exit 1
fi

# 1. Start Docker Desktop if not running
if ! docker info &>/dev/null 2>&1; then
  echo "Starting Docker Desktop..."
  open -a Docker
  echo -n "Waiting for Docker"
  until docker info &>/dev/null 2>&1; do
    sleep 2
    echo -n "."
  done
  echo " ready."
fi

# 2. Start Supabase backend (PostgreSQL, Auth, Edge Functions runtime, etc.)
echo "Starting Supabase..."
cd "$SCRIPT_DIR"
npx supabase start

# 3. Start edge functions dev server in background (enables hot-reload of scraper)
echo "Starting Edge Functions server..."
npx supabase functions serve --env-file supabase/.env > /tmp/il-seminars-functions.log 2>&1 &
echo $! >> "$PID_FILE"

# 4. Start Vite frontend in background
echo "Starting frontend..."
npm run dev > /tmp/il-seminars-frontend.log 2>&1 &
echo $! >> "$PID_FILE"

# 5. Schedule daily scrape in background
echo "Scheduling daily scrape..."
(
  while true; do
    curl -s -X POST http://127.0.0.1:54321/functions/v1/scrape-seminars >> /tmp/il-seminars-functions.log 2>&1
    sleep 86400
  done
) &
echo $! >> "$PID_FILE"

echo ""
echo "All services started."
echo "  Frontend: http://localhost:8080"
echo "  Supabase: http://127.0.0.1:54321"
echo "  Studio:   http://127.0.0.1:54323"
echo ""
echo "Logs: /tmp/il-seminars-frontend.log  /tmp/il-seminars-functions.log"
echo "Run ./stop.sh to stop everything."
