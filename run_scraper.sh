#!/bin/bash
# Scrape seminar sources and write public/seminars.json.
# Usage: ./run_scraper.sh [source-key]
# source-key is optional — omit to scrape all sources.
# Valid keys: huji-math, huji-physics, technion-cs, technion-math, technion-physics, weizmann, tau-math, biu-math, bgu-pet, bgu-colloquium, bgu-agnt, bgu-operator-algebras, bgu-results-of-others
set -e
cd "$(dirname "$0")"
npx deno run --allow-net --allow-read --allow-write --allow-env scraper.ts "$@"
