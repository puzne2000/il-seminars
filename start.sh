#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.dev-pids"

if [ -f "$PID_FILE" ]; then
  echo "Already running? Found .dev-pids. Run ./stop.sh first."
  exit 1
fi

echo "Starting frontend..."
cd "$SCRIPT_DIR"
npm run dev > /tmp/il-seminars-frontend.log 2>&1 &
echo $! > "$PID_FILE"

echo ""
echo "Frontend: http://localhost:8080"
echo "Logs:     /tmp/il-seminars-frontend.log"
echo "Run ./stop.sh to stop."
echo ""
echo "Tip: run ./run_scraper.sh to refresh public/seminars.json"
