#!/bin/bash
LOG=/tmp/il-seminars-functions.log
START_LINE=$(wc -l < "$LOG" 2>/dev/null || echo 0)

curl -X POST http://127.0.0.1:54321/functions/v1/scrape-seminars

echo ""
echo "--- Function logs ---"
tail -n +$((START_LINE + 1)) "$LOG"
