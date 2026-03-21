# Architecture Overview

> For deployment details (local stack, remote hosting, scraping schedule, how to change settings), see `deployment.md`.

## Purpose

A web app that aggregates and displays academic seminars held at Israeli universities, with automated scraping of seminar websites.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, shadcn-ui, TanStack React Query
- **Backend**: Supabase (PostgreSQL database + Edge Functions)
- **Scraping**: Direct HTML fetch + regex parsing (all sources are server-rendered)

## Frontend

Single-page app with one main route (`/`) that shows a searchable, filterable grid of seminar cards.

**Key files:**
- `src/pages/Index.tsx` — main page with filter state and seminar grid
- `src/components/FilterBar.tsx` — search box + dropdowns (university, subject, type)
- `src/components/SeminarCard.tsx` — individual seminar display; title links to source, abstract expands on click
- `src/hooks/useSeminars.ts` — React Query hook that fetches from Supabase (upcoming only, sorted by date)
- `src/data/seminars.ts` — shared type definitions and constants

Filtering is done client-side via `useMemo` after fetching all seminars. Data is cached for 5 minutes.

## Database

A single `seminars` table in Supabase (PostgreSQL) with Row Level Security enabled — publicly readable, not writable from the frontend.

Key columns: `title`, `speaker`, `affiliation`, `university`, `department`, `subject_area`, `date`, `time`, `location`, `abstract`, `type` (Seminar/Colloquium), `source_url`, and `external_id` (unique, used for deduplication).

The `external_id` field is critical: it's a slug derived from the source, date, and title, allowing repeated scrape runs to upsert without creating duplicates.

## Scraping

**Location:** `supabase/functions/scrape-seminars/index.ts`

A Supabase Edge Function (Deno runtime) that:
1. Fetches each seminar listing page directly with a plain HTTP GET
2. Parses the HTML with source-specific regex logic
3. Upserts the extracted records into the `seminars` table via the Supabase service role key
4. Deletes any record whose `last_scraped_at` is older than 7 days

**Currently scraped sources:**

| Source | URL | Scraper |
|--------|-----|---------|
| Hebrew University – Mathematics | `mathematics.huji.ac.il/eventss/events-seminars` | `scrapeHujiColloquiums()` |
| Hebrew University – Physics | `phys.huji.ac.il/calendar/upcoming` | `scrapeHujiPhysics()` |
| Technion – Computer Science | `cs.technion.ac.il/events/` | `scrapeTechnionCS()` |
| Weizmann Institute | `weizmann.ac.il/pages/calendar` | `scrapeWeizmann()` |

Each scraper extracts title, speaker, affiliation, date, time, location, abstract, and other metadata. For HUJI Physics, individual event pages are also fetched to retrieve abstracts and lecturer info. The function is idempotent — re-running it updates existing records rather than duplicating them.

**Required environment variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The function can be triggered manually via HTTP POST.

## Data Flow

```
Scrape trigger (manual HTTP POST)
  → Edge Function fetches listing pages directly
  → Source-specific parser extracts seminar data
  → Individual event pages fetched where needed (e.g. HUJI Physics abstracts)
  → Upsert into Supabase (dedup via external_id)
  → Stale records (last_scraped_at > 7 days ago) deleted

User opens app
  → React Query fetches upcoming seminars from Supabase (date >= yesterday, not today — so same-day events remain visible even after they've started)
  → Client-side filtering by search, university, subject, type
  → Rendered as seminar cards; title links to source, abstract expands on click
```
