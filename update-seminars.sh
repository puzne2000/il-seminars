#!/bin/bash
#
# update-seminars.sh — Scrape, commit, and push seminar data.
#
# USAGE
#   ./update-seminars.sh [source-key]
#
#   source-key (optional): scrape only one source instead of all.
#   Valid keys: huji-math, technion-cs, weizmann, huji-physics, bgu-pet, bgu-colloquium
#
# WHAT IT DOES
#   1. Runs the scraper (scraper.ts) to refresh public/seminars.json.
#   2. If nothing changed, exits early with a message.
#   3. If the most recent git commit is also a seminar update, amends it
#      instead of creating a new commit — so update commits don't pile up.
#      Otherwise creates a fresh "chore: update seminars" commit.
#   4. Pushes to origin. When amending a pushed commit, uses --force-with-lease
#      (safer than --force: refuses if the remote has moved on since your last
#      fetch, protecting against accidentally overwriting others' work).
#
# TYPICAL WORKFLOW
#   Run this whenever you want to refresh the site data:
#     ./update-seminars.sh
#   Lovable auto-deploys on every push to main, so the site updates within
#   a minute or two after the push completes.
#
# NOTE ON FORCE PUSH
#   Amending a commit that was already pushed rewrites history and requires a
#   force push. This is intentional and safe here because:
#     - The "update seminars" commit is purely data (no logic changes).
#     - --force-with-lease ensures we don't overwrite unrelated commits that
#       may have landed on the remote (e.g. edits made in Lovable's UI).
#   If the force push is rejected, run `git pull --rebase` first to incorporate
#   remote changes, then re-run this script.

set -e
cd "$(dirname "$0")"

# ── 1. Scrape ─────────────────────────────────────────────────────────────────
echo "Scraping${1:+ [$1]}..."
npx deno run --allow-net --allow-read --allow-write --allow-env scraper.ts "$@"

# ── 2. Stage the data file ────────────────────────────────────────────────────
git add public/seminars.json

# ── 3. Exit early if nothing changed ─────────────────────────────────────────
if git diff --cached --quiet; then
  echo ""
  echo "No changes to seminars data — nothing to commit."
  exit 0
fi

# ── 4. Commit: amend if last commit was a seminar update, else new commit ─────
LAST_MSG=$(git log -1 --format="%s")
COMMIT_MSG="chore: update seminars"

if [ "$LAST_MSG" = "$COMMIT_MSG" ]; then
  echo ""
  echo "Amending previous update commit..."
  git commit --amend --no-edit
  PUSH_FLAGS="--force-with-lease"
else
  git commit -m "$COMMIT_MSG"
  PUSH_FLAGS=""
fi

# ── 5. Push ───────────────────────────────────────────────────────────────────
echo "Pushing..."
git push $PUSH_FLAGS

echo ""
echo "Done. Site will deploy in ~1 minute."
