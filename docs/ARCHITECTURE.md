# Architecture

> How the site is hosted, deployed and refreshed on a schedule: `docs/deployment.md`.
> Per-source parsing details and how to add a source: `docs/scraping.md`.

## Purpose

A website listing upcoming academic seminars and colloquia at Israeli universities. A scraper collects
talks from university websites and calendar feeds; the site shows them as a searchable, filterable list.

## Overview

There is no backend or database. The whole system is three parts:

```
scraper.ts (Deno, run on this machine)
  → fetches each source (HTML pages, JSON, iCalendar feeds)
  → writes public/seminars.json            ← committed to the repo
       ↓
npm run build → dist/ → Cloudflare Pages   (see docs/deployment.md)
       ↓
Browser loads the React app, which fetches /seminars.json and filters it client-side
```

The scraper runs locally rather than in the cloud because some university sites (HUJI in particular)
block cloud IP ranges.

## Tech stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack React Query
- **Data:** `public/seminars.json`, a static file served with the site
- **Scraper:** `scraper.ts`, a standalone Deno script (run with `npx deno`, so Deno needn't be installed)
- **Hosting:** Cloudflare Pages

## Data

`public/seminars.json` is an array of `Seminar` objects. The type is defined in `src/data/seminars.ts`
(and mirrored in `scraper.ts`):

| Field | Notes |
|---|---|
| `id` | Stable ID built from the source and the event's identity, e.g. `weizmann-<uuid>`, `tau-math-<calendar UID>`, `bgu-pet-<event URL path>`. Used to match talks between scrapes. |
| `title`, `speaker`, `affiliation` | `"TBA"` when the source hasn't announced a title/speaker yet |
| `university` | One of the names in `universities` in `src/data/seminars.ts` (the university filter) |
| `department` | The institute, department or seminar series (shown on the card) |
| `subjectArea` | Normally one of `subjectAreas` (the subject filter); `"Natural Sciences"` for Weizmann talks with no faculty, which then only show under "All" |
| `date`, `time` | `YYYY-MM-DD` and `HH:MM`, Israel local time; `time` may be `"TBA"` |
| `location`, `abstract` | `location` is `"Zoom"` for online-only talks |
| `type` | `"Seminar"` or `"Colloquium"` |
| `sourceUrl`, `zoomLink` | Optional |
| `possiblyCancelled` | Optional; set when a future talk disappeared from its source (see below) |

## Scraper (`scraper.ts`)

Run with `./run_scraper.sh [source-key]` (scrape only) or `./update-seminars.sh [source-key]` (scrape,
commit, push and deploy).

Each source in `ALL_SOURCES` has a URL and a scraper function returning a list of talks. Scrapers fall
into three kinds:

| Kind | Sources | Function(s) |
|---|---|---|
| HTML pages parsed with regular expressions | HUJI Mathematics, HUJI Physics (plus one page per event for abstracts), Technion CS | `scrapeHujiColloquiums()`, `scrapeHujiPhysics()`, `scrapeTechnionCS()` |
| JSON | Weizmann (`/pages/news/events/ajax/events?month=…`, current month and the next three) | `scrapeWeizmann()` |
| iCalendar feeds | BGU Mathematics (5 seminars), Technion Mathematics, TAU Mathematics (15 Google Calendars) | `scrapeIcsFeed()`, `scrapeTechnionMath()`, `scrapeGoogleCalendarSeminars()` |

The iCalendar scrapers share `parseIcsEvents()`, which converts UTC times to Israel time and lets the
scrapers skip recurring placeholder slots and cancelled events. The full source list, with URLs and
per-source quirks, is in `docs/scraping.md`.

### Merging with the existing data

The scraper reads the current `public/seminars.json`, keeps only future talks, and merges:

- **Full scrape** (no source key): writes every talk found. A future talk that is in the old file but no
  longer found is kept with `possiblyCancelled: true` — unless a fresh talk has the same university,
  date, time and speaker (the source just changed its IDs). Past talks are dropped.
- **Single-source scrape**: updates that source's talks and leaves all other entries unchanged; nothing is
  marked possibly cancelled.

Within one scrape, repeated IDs are collapsed to one entry. If a source fails, the error is logged and the
other sources still run — on a full scrape, that source's existing future talks are then marked possibly
cancelled.

## Frontend

Single-page app with one route (`/`) plus a not-found page.

- `src/hooks/useSeminars.ts` — fetches `/seminars.json` with React Query (cached for 5 minutes), keeps
  talks dated **yesterday or later** (not today, so same-day talks stay visible after they start), sorted
  by date.
- `src/pages/Index.tsx` — the page: header (with links to suggest a new source as a GitHub issue and to
  the repo), filters, result count and the grid of cards. Filtering is client-side in a `useMemo`: search
  (title, speaker, abstract), university, subject, type, "Zoom only" and "today only".
- `src/components/FilterBar.tsx` — the search box, dropdowns and toggles.
- `src/components/SeminarCard.tsx` — one talk: the title links to the source, the abstract expands on
  click, a Zoom link is shown when available, the calendar icon downloads an `.ics` file, and an italic
  note marks possibly-cancelled talks.
- `src/utils/ics.ts` — builds the downloadable `.ics` file for one talk.
- `src/hooks/useJsonLd.ts` — adds schema.org `Event` structured data to the page for search engines.
- `src/data/seminars.ts` — the `Seminar` type, the university and subject lists used by the filters,
  and university colours.

Adding a university or subject to the filters means adding it to the lists in `src/data/seminars.ts`
(and, for a university, a colour: a `--university-<key>` variable in `src/index.css`, mapped in
`tailwind.config.ts`).
