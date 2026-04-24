# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Local Development

```bash
./start.sh        # starts Vite dev server
./stop.sh         # stops it
./run_scraper.sh  # scrapes all sources and writes public/seminars.json
```

Frontend: `http://localhost:8080`

Logs: `/tmp/il-seminars-frontend.log`

## Frontend Commands

```bash
npm run dev        # Vite dev server (also started by start.sh)
npm run build      # production build
npm run lint       # ESLint
npm run test       # Vitest (run once)
npm run test:watch # Vitest (watch mode)
```

## Architecture

Single-page React app. Seminar data is stored in `public/seminars.json` (committed to the repo) and served as a static file. The scraper is a standalone Deno script (`scraper.ts`) that scrapes university websites and writes the JSON file directly.

**Deploy workflow:** run `./scrape_and_sync.sh` (or `./run_scraper.sh`) → commit `public/seminars.json` → push → Lovable auto-deploys.

**Key files:**
- `src/pages/Index.tsx` — main page; holds filter state, renders seminar grid
- `src/components/FilterBar.tsx` — search + dropdowns (university, subject, type)
- `src/components/SeminarCard.tsx` — individual seminar card; abstract expands on click, zoom link shown when available, calendar icon downloads an `.ics` file
- `src/utils/ics.ts` — ICS file generation for "add to calendar" feature
- `src/hooks/useSeminars.ts` — React Query fetch from `/seminars.json`; filters to `date >= yesterday` (yesterday, not today, so same-day events stay visible)
- `src/data/seminars.ts` — shared `Seminar` type and constants
- `scraper.ts` — standalone Deno script; scrapes all sources and writes `public/seminars.json`
- `public/seminars.json` — the seminar data served to the frontend

Filtering is done client-side via `useMemo` after fetching all upcoming seminars. Data is cached for 5 minutes.

## Scraper

`scraper.ts` — Deno script. Run locally (university websites may block cloud IPs).

```bash
deno run --allow-net --allow-read --allow-write --allow-env scraper.ts            # all sources
deno run --allow-net --allow-read --allow-write --allow-env scraper.ts huji-math  # one source
```

Valid source keys: `huji-math`, `technion-cs`, `weizmann`, `huji-physics`, `bgu-pet`, `bgu-colloquium`

The scraper writes camelCase `Seminar` objects (matching `src/data/seminars.ts`) directly to `public/seminars.json`. On a full scrape, future seminars not found in the latest scrape are carried over with `possiblyCancelled: true`. On a partial (single-source) scrape, only entries from that source are updated; other entries are preserved unchanged.

**HUJI Mathematics** paginates through `?page=0`, `?page=1`, etc., stopping when a page yields no upcoming events (the site does not sort reliably by date).

See `docs/scraping.md` for detailed per-source parsing notes and instructions for adding a new source.

## Branches

- `main` — synced with Lovable; auto-deploys to the production site on every push
- `local-branch` — local-only changes that should not be pushed to Lovable
