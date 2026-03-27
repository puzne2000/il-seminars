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
- **Zoom link:** extracted from the HTML block surrounding each event using a `zoom.us/j/` URL regex

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
- **Zoom link:** extracted from the per-event HTML block using a `zoom.us/j/` URL regex

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
- **Zoom link:** extracted from the per-event HTML block using a `zoom.us/j/` URL regex

**Known limitations:**
- Affiliation defaults to "Weizmann Institute of Science"; `university` is stored as `"Weizmann Institute"` to match the frontend filter
- Subject area is hardcoded to "Natural Sciences" (no reliable per-event discipline field)
- When no subtitle is present, the series/event title is used as the seminar title, which is sometimes generic (e.g. "Special Guest Seminar")

---

## Hebrew University — Physics Seminars

**URL:** `https://phys.huji.ac.il/calendar/upcoming`

**Method:** Direct HTML fetch + individual event page fetch per event

The HUJI Physics site is a Drupal 7 (OpenScholar) site with server-rendered HTML. Events appear as `<article class="node node-event ...">` elements on the listing page.

**Parsing approach:**

The HTML is split into per-event blocks on `<article ... node-event`. Within each block:

- **Title:** `<h2><a href="...">Title</a></h2>`
- **Speaker:** extracted from the title using the same `Series: Name (Institution)` pattern as HUJI Math — but overridden by the `Lecturer:` line on the individual event page when present (handles cases where the title contains a talk subtitle rather than a speaker name)
- **Affiliation:** from the parenthesised part of the title, or extracted from `Lecturer: Name - Institution` on the event page
- **Date:** `date-display-single` span, parsed from `DD/MM/YYYY`
- **Time:** `time-display-single` span (separate from the date span)
- **Source URL:** the `href` from the title link

Each event's individual page is always fetched to retrieve:
- **Location:** `field-name-field-event-location` → `field-item even`
- **Abstract:** `field-type-text-with-summary` → `field-item even` → `<blockquote>` (present only for some talks)
- **Zoom link:** extracted from the full individual event page HTML using a `zoom.us/j/` URL regex

**Known limitations:**
- Affiliation often not available when the speaker is listed only by name in the title
- Abstract is absent for most talks (only present when the organiser filled in the event body)

---

## Adding a new source

1. Check whether the site is server-rendered (view source has content) or JavaScript-rendered (view source is mostly empty). All current sources are server-rendered and can be fetched directly.
2. Add a scraper function following the existing patterns — split HTML into per-event blocks, then extract fields with targeted regex
3. Add an entry to `ALL_SOURCES` in the scraper file
4. Test by triggering the function and checking the database
