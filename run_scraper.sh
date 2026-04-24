#!/bin/bash
# Scrape seminar sources and write public/seminars.json.
# Usage: ./run_scraper.sh [source-key]
# source-key is optional — omit to scrape all sources.
# Valid keys: huji-math, technion-cs, weizmann, huji-physics, bgu-pet, bgu-colloquium
set -e
cd "$(dirname "$0")"
npx deno run --allow-net --allow-read --allow-write --allow-env scraper.ts "$@"
