#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.dev-pids"

if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping process $pid..."
      kill "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  rm "$PID_FILE"
fi

pkill -f "vite" 2>/dev/null || true

echo "Stopped."
