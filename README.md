# IL Seminars

A website listing upcoming academic seminars and colloquia at Israeli universities, auto-populated by a scraper.

## Live sites

| Host | URL |
|------|-----|
| Lovable | auto-deploys from `main` (check Lovable dashboard for URL) |
| Cloudflare Pages | auto-deploys from `main` (check Cloudflare dashboard for URL) |

Both deploy automatically on every push to `main`.

## Tech stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Scraper**: Deno edge function (`supabase/functions/scrape-seminars/index.ts`)

## Supabase project

The production Supabase project is owned by the `puzne2000` account.

| Key | Where to find |
|-----|---------------|
| Project URL | `https://vkaphyqggmuyrzrszgzp.supabase.co` |
| Anon key | Supabase Dashboard → Settings → API → `anon public` |
| Service role key | Supabase Dashboard → Settings → API → `service_role` (keep secret) |
| Dashboard | https://supabase.com/dashboard/project/vkaphyqggmuyrzrszgzp |

Production credentials are committed in `.env` (anon key only — safe to commit).

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production — synced with Lovable, auto-deploys everywhere |
| `local-branch` | Local dev only — has the LAN hostname patch; do NOT push to Lovable |

## Scripts

| Script | What it does |
|--------|-------------|
| `./start.sh` | Starts Docker, local Supabase, edge functions server, and Vite dev server |
| `./stop.sh` | Stops all of the above |
| `./run_scraper.sh` | Triggers a scrape against the **local** Supabase and prints logs |
| `./scrape_and_sync.sh` | Scrapes locally (bypasses university firewalls) and syncs results to the **remote** Supabase |

`scrape_and_sync.sh` is the right tool when the remote edge function can't reach a university site (e.g. HUJI blocks cloud IPs). It starts Docker and Supabase automatically if they aren't running.

## Local development

Requirements: Node.js, Docker Desktop, Supabase CLI (`npm i -g supabase` or use `npx supabase`).

```bash
./start.sh          # start everything
# frontend at http://localhost:8080
# Supabase Studio at http://127.0.0.1:54323
./stop.sh           # stop everything
```

Frontend-only commands:
```bash
npm run dev         # Vite dev server
npm run build       # production build
npm run lint        # ESLint
npm run test        # Vitest (run once)
npm run test:watch  # Vitest (watch mode)
```

Logs: `/tmp/il-seminars-frontend.log`, `/tmp/il-seminars-functions.log`

Direct DB access:
```bash
docker exec supabase_db_wzbkmepgwihppoipfarb psql -U postgres
```

## Environment files

| File | Purpose |
|------|---------|
| `.env` | Production Supabase credentials — committed, used by hosted sites |
| `.env.local` | Local Supabase credentials — gitignored, overrides `.env` in dev |

**Never overwrite `.env` with local credentials** — it would break the production sites.

## Deploying the edge function

The scraper must be manually deployed after changes:

```bash
npx supabase login   # first time only
npx supabase functions deploy scrape-seminars --project-ref vkaphyqggmuyrzrszgzp
```

## Scheduling automatic scrapes

A daily scrape can be scheduled via Supabase's pg_cron. Run in the SQL editor at supabase.com:

```sql
select cron.schedule(
  'daily-scrape',
  '0 6 * * *',   -- 6am UTC daily
  $$
  select net.http_post(
    url     := 'https://vkaphyqggmuyrzrszgzp.supabase.co/functions/v1/scrape-seminars',
    headers := '{}'::jsonb
  );
  $$
);
```

Note: if university sites block the cloud IP, use `scrape_and_sync.sh` from a local machine instead.

To remove the job: `select cron.unschedule('daily-scrape');`

## Adding a new seminar source

See `scraping.md` for detailed per-source parsing notes and instructions.

## Architecture

Single-page React app. All filtering is done client-side after fetching upcoming seminars (date ≥ yesterday). Data is cached for 5 minutes via React Query.

Key files:
- `src/pages/Index.tsx` — main page, filter state
- `src/components/FilterBar.tsx` — search + dropdowns
- `src/components/SeminarCard.tsx` — individual seminar card
- `src/hooks/useSeminars.ts` — data fetching from Supabase
- `src/data/seminars.ts` — shared `Seminar` type and constants
- `supabase/functions/scrape-seminars/index.ts` — scraper edge function
