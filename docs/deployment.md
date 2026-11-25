# Deployment

The site is a static React app. Seminar data lives in `public/seminars.json`, committed to the repo and
served as a static file — there is no backend or database. (An earlier version used Supabase; see
[Leftovers](#leftovers-from-the-supabase-setup).)

## Local development

Start with `./start.sh`, stop with `./stop.sh`. `start.sh` only launches the Vite dev server
(`npm run dev`).

- Frontend: `http://localhost:8080`
- Log: `/tmp/il-seminars-frontend.log`

To refresh the local data without committing or deploying: `./run_scraper.sh [source-key]`.

---

## Hosting: Cloudflare Pages

| | |
|---|---|
| Live URL | `https://il-seminars.pages.dev` |
| Project | `il-seminars` (Cloudflare dashboard → Workers & Pages → il-seminars) |
| Build | `npm run build` → `dist/` |
| Config | none in the repo; settings live in the Cloudflare dashboard |

### How the site actually gets deployed

**Pushing to `main` does not update the live site on its own.** The deploy that works is a direct upload
with Wrangler from this machine:

```bash
npm run build
npx wrangler pages deploy dist --project-name il-seminars --branch main
```

`update-seminars.sh` does this automatically after scraping (see below). If Wrangler reports an
authentication or OAuth error, run `npx wrangler login` and retry.

Each push to `main` also triggers a Cloudflare git-integration build, but those builds fail: in the
deployment list, every commit pushed between June and November 2026 has a deployment marked `Failure`.
The successful deployments in that list are separate uploads. The build logs are in the Cloudflare
dashboard (each deployment has a link). To see recent deployments and their status:

```bash
npx wrangler pages deployment list --project-name il-seminars
```

To check what is live, compare `https://il-seminars.pages.dev/seminars.json` with the local file.

### Lovable

The repo is also connected to a Lovable project (lovable.dev). According to `update-seminars.sh`,
Lovable does not auto-deploy on direct git pushes. Not verified; the Cloudflare site above is the one
known to be live.

---

## Updating the seminar data

```bash
./update-seminars.sh [source-key]     # scrape_and_sync.sh is an alias for this
```

1. Runs the scraper (`scraper.ts`, via `npx deno`) to refresh `public/seminars.json`
2. Exits if nothing changed
3. Commits as `chore: update seminars` — amending the previous commit if it was also a data update,
   so these commits don't pile up
4. Pushes (`--force-with-lease` when it amended)
5. Builds and deploys to Cloudflare Pages with Wrangler

If the force push is rejected (the remote moved on), run `git pull --rebase` and re-run.

### Why scraping runs locally

Some university sites (HUJI in particular) block cloud IP ranges, so the scraper runs on this machine
rather than as a hosted scheduled job. See `docs/scraping.md` for per-source details.

### Scheduled run (cron)

A local cron job runs `update-seminars.sh` every day at 06:30 local time:

```
30 6 * * * echo "--- $(date) ---" >> /tmp/il-seminars-sync.log 2>&1 && "/Users/guykindler/My Drive/python stuff/il-seminars/update-seminars.sh" >> /tmp/il-seminars-sync.log 2>&1
```

Log: `/tmp/il-seminars-sync.log`. Cron only runs while the machine is awake. See `docs/crontab.md`.

**Known issue (as of 2026-11-25):** every run since 2026-10-24 has failed with
`npx: command not found`. Cron starts with a minimal `PATH` that doesn't include `/opt/homebrew/bin`,
where `node`/`npx` are installed. Until that is fixed, data is only refreshed by running
`./update-seminars.sh` by hand.

---

## Changing things

| Area | How |
|---|---|
| Frontend behaviour | Edit `src/`, commit, push, then build and deploy with Wrangler (above) |
| Scraper sources / parsing | Edit `scraper.ts` (see `docs/scraping.md`), then `./update-seminars.sh` |
| Seminar data only | `./update-seminars.sh` |
| Cloudflare Pages settings | Cloudflare dashboard → Workers & Pages → il-seminars |
| Lovable settings | lovable.dev project dashboard |
| Scrape schedule | `crontab -e` on this machine (see `docs/crontab.md`) |

---

## Leftovers from the Supabase setup

The site used to read from a Supabase database filled by a Supabase Edge Function. That was replaced by
the static `public/seminars.json` (commit `067ca59`). What remains:

- `.env` (committed) still holds `VITE_SUPABASE_*` values; nothing in `src/` reads them.
- `supabase/` contains only empty, untracked folders.
- The remote Supabase project (`vkaphyqggmuyrzrszgzp`, owned by the `puzne2000` account) is no longer
  used by the site.
