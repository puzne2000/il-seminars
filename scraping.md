# Scraping

Scraping is done by a Supabase Edge Function at `supabase/functions/scrape-seminars/index.ts`, triggered manually via HTTP POST. Each source uses a different fetch strategy depending on what the target site supports.

## How to trigger

```bash
curl -X POST http://127.0.0.1:54321/functions/v1/scrape-seminars
```

After scraping, any seminar not seen in over 7 days is automatically deleted from the database.

---

## Hebrew University — Mathematics Colloquiums

**URL:** `https://mathematics.huji.ac.il/eventss/events-seminars`

**Method:** Direct HTML fetch (no Firecrawl)

The HUJI site is a server-rendered Drupal site, so the full page content is available in the raw HTML without needing a JavaScript-capable browser. Firecrawl was tried but consistently timed out on this site.

**Parsing approach:**

The listing page is fetched directly with a plain HTTP GET. Each event appears in the HTML as:

```html
<h2><a href="/event/colloquium-speaker-name">Colloquium: Speaker Name (Institution)</a></h2>
...
<span class="date-display-single">Thu, 26/03/2026</span>
```

A single regex matches each `<h2><a>` block and the date span that follows it. From there:

- **Title:** the full link text, e.g. `Colloquium: Vitaly Bergelson (Ohio State)` or `NT&AG: Ofir Gorodetsky (Technion)`
- **Speaker:** extracted from the title by splitting on the first `:`, `-`, or `–`, then taking the part after the last `:` if one remains (handles nested labels like `Colloquium: Zhukovitsky Lecture: Name`)
- **Affiliation:** extracted from the parenthesised part at the end of the speaker segment — e.g. `Ohio State`
- **Date:** parsed from `DD/MM/YYYY` format
- **Time:** extracted from the date string if present; defaults to `14:30`
- **Location:** hardcoded to `Manchester Building, Hall 2` (standard venue for the colloquium)
- **Source URL:** the individual event page link from the `href`
- **Abstract:** not available on the HUJI events site; stored as empty string

**Known limitations:**
- Location is hardcoded and may be wrong for special events held elsewhere
- Abstract is always empty (HUJI event pages do not include abstract text)

---

## Technion — Computer Science Seminars

**URL:** `https://www.cs.technion.ac.il/events/`

**Method:** Direct HTML fetch

The Technion CS events page is server-rendered, so all content is available in the raw HTML without needing a JavaScript-capable browser.

**Parsing approach:**

The HTML is split into per-event blocks on the `events_header` class. Within each block, fields map directly to CSS classes:

- **Title:** `events_header` div
- **Speaker, Date, Location:** three consecutive `ev_r_col` divs; the date column is identified by its `DD.MM.YYYY` pattern, speaker is the column before it, location the column after
- **Date/Time:** parsed from `Wednesday, 18.03.2026, 14:00` format
- **Abstract:** `events_txt_part` div
- **Source URL:** falls back to the events listing page URL (individual event links not used)

HTML entities (`&amp;`, etc.) are decoded before storing.

**Known limitations:**
- Affiliation is not extracted and defaults to `Technion`
- Source URL links to the listing page, not individual event pages

---

## Weizmann Institute of Science — Integrated Calendar

**URL:** `https://www.weizmann.ac.il/pages/calendar`

**Method:** Direct HTML fetch (no Firecrawl)

The Weizmann calendar is a Drupal 7 site with server-rendered HTML. Events are listed as `<li class="views-row ...">` elements.

**Parsing approach:**

The HTML is split into per-event blocks on `views-row`. Within each block:

- **Event type:** from the `<span class="event-type"><span class="TYPE">` pattern — only `lecture`, `seminar`, and `colloquium` types are kept (conferences, workshops, etc. are skipped)
- **Event ID and URL:** extracted from the ICS calendar link (`/pages/event/NNNN/ics`) — the individual event page is `/pages/event/NNNN`
- **Date:** day from `start-date-day`, month+year from `start-date-month` (e.g. "March 2026"), parsed with a month-name lookup table
- **Time:** start time from `event-time-wrapper`
- **Title:** the talk subtitle (`views-label-field-subtitle-english` → `field-content`) when present; otherwise falls back to the H3 event/series title
- **Speaker:** from the `views-label-field-lecturer-english` table row; text before the first `<br>` is used (discards secondary info like "lunch at 12:45")
- **Location:** `event-location-wrapper`
- **Abstract:** `event-abstract-wrapper` (full text already present inline in the listing page HTML)

**Known limitations:**
- Affiliation is not extracted; defaults to "Weizmann Institute of Science"
- Subject area is hardcoded to "Natural Sciences" (no reliable per-event discipline field)
- When no subtitle is present, the series/event title is used as the seminar title, which is sometimes generic (e.g. "Special Guest Seminar")

---

## Adding a new source

1. Decide whether the site needs Firecrawl (JavaScript-rendered) or can be fetched directly (server-rendered HTML)
2. Add a scraper/parser function following the existing patterns
3. Add an entry to `directSources` or `firecrawlSources` in the `Deno.serve` handler
4. Test by triggering the function and checking the database
