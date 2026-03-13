#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.dev-pids"

# Kill background processes tracked by start.sh
if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping process $pid..."
      kill "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  rm "$PID_FILE"
fi

# Also kill by name in case PIDs drifted
pkill -f "supabase functions serve" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Stop Supabase (stops all Docker containers for this project)
echo "Stopping Supabase..."
cd "$SCRIPT_DIR"
npx supabase stop

echo "All services stopped."
