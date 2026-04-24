#!/bin/bash
# Full scrape-and-deploy cycle.
# Scrapes all sources, writes public/seminars.json, then reminds you to commit and push.
set -e
cd "$(dirname "$0")"

echo "Scraping all sources..."
npx deno run --allow-net --allow-read --allow-write --allow-env scraper.ts

echo ""
echo "public/seminars.json updated."
echo "Review: git diff public/seminars.json"
echo "Deploy: git add public/seminars.json && git commit -m 'chore: update seminars' && git push"
