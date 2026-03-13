# Architecture Overview

## Purpose

A web app that aggregates and displays academic seminars held at Israeli universities, with automated scraping of seminar websites.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, shadcn-ui, TanStack React Query
- **Backend**: Supabase (PostgreSQL database + Edge Functions)
- **Scraping**: Firecrawl API (converts web pages to markdown for parsing)

## Frontend

Single-page app with one main route (`/`) that shows a searchable, filterable grid of seminar cards.

**Key files:**
- `src/pages/Index.tsx` — main page with filter state and seminar grid
- `src/components/FilterBar.tsx` — search box + dropdowns (university, subject, type)
- `src/components/SeminarCard.tsx` — individual seminar display
- `src/hooks/useSeminars.ts` — React Query hook that fetches from Supabase
- `src/data/seminars.ts` — shared type definitions and constants

Filtering is done client-side via `useMemo` after fetching all seminars. Data is cached for 5 minutes.

## Database

A single `seminars` table in Supabase (PostgreSQL) with Row Level Security enabled — publicly readable, not writable from the frontend.

Key columns: `title`, `speaker`, `affiliation`, `university`, `department`, `subject_area`, `date`, `time`, `location`, `abstract`, `type` (Seminar/Colloquium), `source_url`, and `external_id` (unique, used for deduplication).

The `external_id` field is critical: it's a slug derived from the source, date, and title, allowing repeated scrape runs to upsert without creating duplicates.

## Scraping

**Location:** `supabase/functions/scrape-seminars/index.ts`

A Supabase Edge Function (Deno runtime) that:
1. Calls the Firecrawl API to fetch and convert each seminar page to markdown
2. Passes the markdown to a source-specific parser
3. Upserts the extracted records into the `seminars` table via the Supabase service role key

**Currently scraped sources:**

| Source | URL | Parser |
|--------|-----|--------|
| Hebrew University – Mathematics Colloquiums | `mathematics.huji.ac.il/calendar/eventss/colloquium` | `parseHujiColloquiums()` |
| Technion – Computer Science Seminars | `cs.technion.ac.il/events/` | `parseTechnionCS()` |

Each parser extracts title, speaker, date, time, location, abstract, and other metadata from the markdown. The function is idempotent — re-running it updates existing records rather than duplicating them.

**Required environment variables:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIRECRAWL_API_KEY`

The function can be triggered manually via HTTP POST, or scheduled using the `pg_cron` extension (infrastructure is set up in the DB migrations).

## Data Flow

```
Scrape trigger (manual or scheduled)
  → Edge Function fetches pages via Firecrawl
  → Parser extracts seminar data
  → Upsert into Supabase (dedup via external_id)

User opens app
  → React Query fetches all seminars from Supabase
  → Client-side filtering by search, university, subject, type
  → Rendered as animated seminar cards
```
