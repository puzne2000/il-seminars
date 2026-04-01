# Deployment

## Local Development Stack

Start everything with `./start.sh`, stop with `./stop.sh`.

`start.sh` launches:
- Docker Desktop (if not already running)
- Local Supabase (`npx supabase start`) — PostgreSQL, Auth, Edge Functions runtime
- Edge functions dev server (`npx supabase functions serve`)
- Vite frontend (`npm run dev`)
- A background loop that triggers a scrape every 24 hours

URLs:
- Frontend: `http://localhost:8080`
- Supabase API: `http://127.0.0.1:54321`
- Supabase Studio: `http://127.0.0.1:54323`

Direct DB access:
```bash
docker exec supabase_db_wzbkmepgwihppoipfarb psql -U postgres
```

Logs: `/tmp/il-seminars-frontend.log`, `/tmp/il-seminars-functions.log`

Credentials: `.env.local` (gitignored) holds local Supabase keys and takes precedence over `.env` in dev. **Never overwrite `.env` with local credentials** — it would break the production site.

---

## Remote Frontend

Two separate deployments, both auto-deploy on every push to `main` on `puzne2000/il-seminars`:

| Deployment | URL | Config location |
|---|---|---|
| Lovable | (lovable.dev hosted URL) | lovable.dev project dashboard |
| Cloudflare Pages | `https://il-seminars.pages.dev` | Cloudflare dashboard → Pages → il-seminars |

Cloudflare Pages build: `npm run build` → `dist/`. No config file in the repo — settings are managed entirely in the Cloudflare dashboard.

To update the frontend: push to `main`. Both deployments update automatically within a minute or two.

---

## Remote Backend (Supabase)

- Project ID: `vkaphyqggmuyrzrszgzp`
- URL: `https://vkaphyqggmuyrzrszgzp.supabase.co`
- Owned by the `puzne2000` account at supabase.com (not managed by Lovable)
- Production credentials in `.env` (anon key only — safe to commit)

### Edge Function

The scraper runs as a Supabase Edge Function (Deno runtime).

Deploy:
```bash
npx supabase functions deploy scrape-seminars --project-ref vkaphyqggmuyrzrszgzp
```

Trigger manually (production):
```bash
curl -X POST https://vkaphyqggmuyrzrszgzp.supabase.co/functions/v1/scrape-seminars
```

Required secrets (set in Supabase dashboard → Project Settings → Edge Functions):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Database Changes

Apply via the Supabase dashboard SQL editor, or push migrations:
```bash
npx supabase link --project-ref vkaphyqggmuyrzrszgzp  # first time only
npx supabase db push
```

---

## Scraping: Why It Runs Locally

HUJI's servers block cloud IP ranges, so the scraper cannot run as a remote scheduled job. Instead, scraping runs on a local machine and syncs results to the remote database.

`scrape_and_sync.sh`:
1. Starts local Supabase if not already running
2. Triggers the scraper against the local database
3. Marks all future remote seminars as `possibly_cancelled = true`
4. Upserts scraped records to the remote Supabase via REST API (dedup via `external_id`; sets `possibly_cancelled = false` for confirmed talks)
5. Deletes remote records where `date` or `last_scraped_at` is older than 30 days

Scheduled via local cron (Mondays and Thursdays at 8pm UTC):
```
0 20 * * 1,4 "/Users/guykindler/My Drive/python stuff/il-seminars/scrape_and_sync.sh" >> /tmp/il-seminars-sync.log 2>&1
```

See `docs/crontab.md` for the full cron setup.

Manual scrape (local dev only):
```bash
./run_scraper.sh
```
This triggers the local edge function and tails new log output from `/tmp/il-seminars-functions.log`.

---

## Changing Settings / Fixing Errors

| Area | How |
|---|---|
| Frontend behavior | Edit source code, push to `main` |
| Scraper logic / sources | Edit `supabase/functions/scrape-seminars/index.ts`, then deploy (see above); see `docs/scraping.md` for per-source parsing notes |
| Edge function secrets | Supabase dashboard → Project Settings → Edge Functions |
| Database schema | Supabase dashboard SQL editor or `supabase db push` |
| Cloudflare Pages settings | Cloudflare dashboard → Pages → il-seminars |
| Lovable settings | lovable.dev project dashboard |
| Scrape schedule | `crontab -e` on the local machine |
