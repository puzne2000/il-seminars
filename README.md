# IL Seminars

A website listing upcoming academic seminars and colloquia at Israeli universities, auto-populated by a scraper.

## Live site

`https://il-seminars.pages.dev` (Cloudflare Pages). Pushing to `main` does not update it on its own — `./update-seminars.sh` deploys with Wrangler. See `docs/deployment.md`.

## Tech stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui
- **Data**: `public/seminars.json` — committed to the repo, served as a static file
- **Scraper**: `scraper.ts` — standalone Deno script, run locally

No backend or database required.

## Updating seminar data

```bash
./update-seminars.sh
```

This scrapes all sources, commits `public/seminars.json` (amending the previous update commit if there is one, so they don't pile up), pushes, and deploys to Cloudflare Pages via Wrangler.

To scrape a single source:
```bash
./update-seminars.sh huji-math
```

Valid source keys: `huji-math`, `huji-physics`, `technion-cs`, `technion-math`, `weizmann`, `tau-math`, `bgu-pet`, `bgu-colloquium`, `bgu-agnt`, `bgu-operator-algebras`, `bgu-results-of-others`

## Local development

Requirements: Node.js, Deno (via `npx deno`).

```bash
./start.sh   # start Vite dev server (http://localhost:8080)
./stop.sh    # stop it
```

Frontend commands:
```bash
npm run dev         # Vite dev server
npm run build       # production build
npm run lint        # ESLint
npm run test        # Vitest (run once)
npm run test:watch  # Vitest (watch mode)
```

Logs: `/tmp/il-seminars-frontend.log`

## Scripts

| Script | What it does |
|--------|-------------|
| `./update-seminars.sh` | Scrape → commit (amending if last commit was also an update) → push → build and deploy to Cloudflare Pages |
| `./run_scraper.sh` | Scrape and write `public/seminars.json` only (no git) |
| `./scrape_and_sync.sh` | Alias for `update-seminars.sh` |
| `./start.sh` | Start Vite dev server |
| `./stop.sh` | Stop it |

## Architecture

Single-page React app. Seminar data is stored in `public/seminars.json` and fetched by the frontend at runtime. All filtering is done client-side after fetching upcoming seminars (date ≥ yesterday). Data is cached for 5 minutes via React Query.

Key files:
- `src/pages/Index.tsx` — main page, filter state
- `src/components/FilterBar.tsx` — search + dropdowns
- `src/components/SeminarCard.tsx` — individual seminar card
- `src/hooks/useSeminars.ts` — fetches `/seminars.json`
- `src/data/seminars.ts` — shared `Seminar` type and constants
- `scraper.ts` — Deno scraper; writes camelCase `Seminar` objects to `public/seminars.json`
- `public/seminars.json` — the seminar data

## Adding a new seminar source

See `docs/scraping.md` for per-source parsing notes and instructions.

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production — deployed to Cloudflare Pages with Wrangler (see `docs/deployment.md`) |
| `local-branch` | Local dev only — has LAN hostname patch; do NOT push to Lovable |
