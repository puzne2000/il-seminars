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
echo ""
echo "Then run: ./update-seminars.sh   (commits, pushes, and deploys to Cloudflare Pages)"
echo ""
echo "NOTE: update-seminars.sh deploys via Wrangler. If it fails with an auth/OAuth error, run:"
echo "  npx wrangler login"
echo "and then re-run ./update-seminars.sh. You only need to do this once; the token is cached."
