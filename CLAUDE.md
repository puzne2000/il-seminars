# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Local Development

```bash
./start.sh   # starts Docker, Supabase backend, edge functions server, and Vite frontend
./stop.sh    # stops all of the above
./run_scraper.sh  # triggers a scrape and prints new log lines from /tmp/il-seminars-functions.log
```

Frontend: `http://localhost:8080` | Supabase Studio: `http://127.0.0.1:54323`

Logs: `/tmp/il-seminars-frontend.log`, `/tmp/il-seminars-functions.log`

Direct DB access:
```bash
docker exec supabase_db_wzbkmepgwihppoipfarb psql -U postgres
```

## Frontend Commands

```bash
npm run dev        # Vite dev server (also started by start.sh)
npm run build      # production build
npm run lint       # ESLint
npm run test       # Vitest (run once)
npm run test:watch # Vitest (watch mode)
```

## Environment

- `.env` — production Supabase credentials (committed; used by Lovable-hosted site)
- `.env.local` — local Supabase credentials (gitignored; takes precedence over `.env` in dev)

**Never overwrite `.env` with local credentials** — it would break the production site.

## Architecture

Single-page React app backed by a Supabase PostgreSQL database. Seminar data is populated by a Supabase Edge Function (Deno) that scrapes university websites.

**Key files:**
- `src/pages/Index.tsx` — main page; holds filter state, renders seminar grid
- `src/components/FilterBar.tsx` — search + dropdowns (university, subject, type)
- `src/components/SeminarCard.tsx` — individual seminar card; abstract expands on click, zoom link shown when available, calendar icon downloads an `.ics` file
- `src/utils/ics.ts` — ICS file generation for "add to calendar" feature
- `src/hooks/useSeminars.ts` — React Query fetch from Supabase; filters to `date >= yesterday` (yesterday, not today, so same-day events stay visible)
- `src/data/seminars.ts` — shared `Seminar` type and constants
- `src/integrations/supabase/client.ts` — Supabase client; replaces `127.0.0.1` with `window.location.hostname` at runtime so the site works when accessed from other devices on the LAN
- `supabase/functions/scrape-seminars/index.ts` — the scraper edge function

Filtering is done client-side via `useMemo` after fetching all upcoming seminars. Data is cached for 5 minutes.

## Database

Single `seminars` table. Key columns: `title`, `speaker`, `affiliation`, `university`, `department`, `subject_area`, `date`, `time`, `location`, `abstract`, `type` (Seminar/Colloquium), `source_url`, `zoom_link`, `external_id` (unique slug for upsert deduplication), `last_scraped_at`.

RLS is enabled — publicly readable, not writable from the frontend.

## Scraper

`supabase/functions/scrape-seminars/index.ts` — Deno edge function triggered by HTTP POST. Fetches each source directly (plain HTML GET + regex parsing), upserts into `seminars` via service role key, then deletes records with `last_scraped_at` older than 7 days.

Each scraper logs every URL it fetches to stdout (visible in `/tmp/il-seminars-functions.log`).

**HUJI Mathematics** paginates through `?page=0`, `?page=1`, etc., stopping when a page yields no upcoming events (the site does not sort reliably by date).

See `docs/scraping.md` for detailed per-source parsing notes and instructions for adding a new source.

## Branches

- `main` — synced with Lovable; auto-deploys to the production site on every push
- `local-branch` — local-only changes that should not be pushed to Lovable (e.g. LAN hostname fix in the Supabase client)
