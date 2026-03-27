#!/bin/bash
# Runs the scraper locally (bypasses university firewalls) and syncs results to remote Supabase.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load secrets from gitignored supabase/.env (never commit keys directly in this file)
source "$SCRIPT_DIR/supabase/.env"

LOCAL_URL="http://127.0.0.1:54321"
REMOTE_URL="https://vkaphyqggmuyrzrszgzp.supabase.co"

FUNCTIONS_LOG=/tmp/il-seminars-functions.log
FUNCTIONS_PID_FILE="$SCRIPT_DIR/.functions-pid"

# ── 1. Docker ────────────────────────────────────────────────────────────────
if ! docker info &>/dev/null 2>&1; then
  echo "Starting Docker Desktop..."
  open -a Docker
  echo -n "Waiting for Docker"
  until docker info &>/dev/null 2>&1; do sleep 2; echo -n "."; done
  echo " ready."
fi

# ── 2. Local Supabase ────────────────────────────────────────────────────────
if ! curl -sf "$LOCAL_URL/rest/v1/" -H "apikey: $LOCAL_SERVICE_KEY" -o /dev/null; then
  echo "Starting local Supabase..."
  npx supabase start
fi

# ── 3. Edge functions server ─────────────────────────────────────────────────
if ! curl -sf -X POST "$LOCAL_URL/functions/v1/scrape-seminars" \
    -H "Content-Type: application/json" -o /dev/null 2>/dev/null; then
  echo "Starting edge functions server..."
  npx supabase functions serve --env-file supabase/.env >> "$FUNCTIONS_LOG" 2>&1 &
  echo $! > "$FUNCTIONS_PID_FILE"
  echo -n "Waiting for functions server"
  until curl -sf -X POST "$LOCAL_URL/functions/v1/scrape-seminars" \
      -H "Content-Type: application/json" -o /dev/null 2>/dev/null; do
    sleep 2; echo -n "."
  done
  echo " ready."
  STARTED_FUNCTIONS=1
fi

# ── 4. Scrape locally ────────────────────────────────────────────────────────
echo "Running scraper..."
RESULT=$(curl -s -X POST "$LOCAL_URL/functions/v1/scrape-seminars")
echo "Scrape result: $RESULT"

# ── 5. Fetch seminars from local DB ─────────────────────────────────────────
echo "Reading local seminars..."
SEMINARS=$(curl -s \
  "$LOCAL_URL/rest/v1/seminars?select=external_id,title,speaker,affiliation,university,department,subject_area,date,time,location,abstract,type,source_url,zoom_link,last_scraped_at" \
  -H "apikey: $LOCAL_SERVICE_KEY" \
  -H "Authorization: Bearer $LOCAL_SERVICE_KEY")

COUNT=$(echo "$SEMINARS" | python3 -c "import sys,json; data=json.load(sys.stdin); assert isinstance(data, list), f'Expected list, got: {data}'; print(len(data))")
echo "Found $COUNT seminars locally."

# ── 6. Upsert to remote ───────────────────────────────────────────────────────
echo "Syncing to remote Supabase..."
curl -s -X POST "$REMOTE_URL/rest/v1/seminars?on_conflict=external_id" \
  -H "apikey: $REMOTE_SERVICE_KEY" \
  -H "Authorization: Bearer $REMOTE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  -d "$SEMINARS"

echo ""
echo "Done! $COUNT seminars synced to remote."

# ── 7. Stop functions server if we started it ────────────────────────────────
if [ -n "$STARTED_FUNCTIONS" ] && [ -f "$FUNCTIONS_PID_FILE" ]; then
  kill "$(cat "$FUNCTIONS_PID_FILE")" 2>/dev/null || true
  rm -f "$FUNCTIONS_PID_FILE"
fi
