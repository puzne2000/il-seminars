# Scraping

Scraping is done by `scraper.ts`, a standalone Deno script that writes `public/seminars.json`. Each source uses a different fetch strategy depending on what the target site supports.

## How to run

```bash
./run_scraper.sh              # all sources
./run_scraper.sh weizmann     # one source
```

A full scrape keeps future talks that are no longer listed, marked `possiblyCancelled`; past talks are dropped.
`./update-seminars.sh` scrapes and then commits and deploys (see `docs/deployment.md`).

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

## Weizmann Institute of Science — Events & Lectures

**URL:** `https://www.weizmann.ac.il/pages/news/events/ajax/events?month=YYYY-MM`

**Method:** JSON endpoint, one request per month (current month + next 3)

In November 2026 Weizmann replaced its Drupal 7 calendar (`/pages/calendar`, which now redirects to
`/pages/news/events`). The new events page is rendered in the browser from a JSON endpoint, which the
scraper calls directly. The response is `{ events: [...], eventTypes, faculties, organizers }`.

**Field mapping** (per event):

- **Filter:** only `type_name` `Lectures` and `Colloquia` are kept (skips `Conference`, `Cultural`,
  `Academic` — student days, retreats). Events whose title says "no seminar" or "cancelled" are skipped.
- **Title / department:** `title_en` is sometimes the series name ("Vision and AI") with the talk title in
  `subtitle_en`, and sometimes the talk title with a note in `subtitle_en` ("Light refreshments 11:30",
  the speaker's name, "Department of …"). The subtitle is used as the title unless it looks like such a
  note; when it is used, `title_en` becomes the department (series). Otherwise the department is the first
  sponsor, then the faculty. A title containing `@` (contact details) is replaced with "<department> seminar".
- **Speaker:** `lecturers[].name`, joined; placeholders like "Will be updated" become `TBA`
- **Affiliation:** first `lecturers[].affiliation` that is short (≤100 chars) and not a bio paragraph
- **Subject area:** from `cat_name` (faculty): Physics, Chemistry, Life Sciences → Biology; Mathematics and
  Computer Science → Computer Science if a sponsor is the CS department, else Mathematics; anything else
  (e.g. "General Event") → Natural Sciences
- **Date/time:** `start` (`YYYY-MM-DD HH:MM:SS`, Israel time); all-day events get `TBA`
- **Location:** `room`, `building`
- **Abstract:** `abstract_en` with HTML stripped
- **Zoom link:** `virtual_url` if it is a Zoom link, else a `zoom.us/j/` link found in the abstract
- **Source URL:** `https://www.weizmann.ac.il/pages/news/events/event/<id>`; ID is `weizmann-<id>` (UUID)

**Known limitations:**
- The central calendar carries only some Faculty of Mathematics and Computer Science seminars; the faculty's
  own page (`https://www.weizmann.ac.il/math/events`) lists more.
- A few non-talk "Lectures" entries slip through (e.g. hands-on demos, research days).

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

## Technion — Mathematics

**URL:** `https://math.technion.ac.il/events.ics`

**Method:** iCalendar feed (WordPress Events Manager), one feed for the whole faculty

- **TLS:** the server does not send its intermediate certificate (GEANT TLS RSA 1). Browsers and macOS curl
  fetch it themselves; Deno does not, so the scraper ships it in `certs/geant-tls-rsa-1.pem` and passes it to
  `Deno.createHttpClient({ caCerts })` for this source only. It chains to HARICA TLS RSA Root CA 2021 and is
  valid until 2039; source: `http://crt.harica.gr/HARICA-GEANT-TLS-R1.cer`.
- **Series / department:** `CATEGORIES` minus the generic `Seminars` (e.g. `Combinatorics Seminar`,
  `Colloquium`). `Math Club` (Hebrew student club) and `Graduation Seminars` (M.Sc. talks) are skipped.
- **Speaker / affiliation:** `Lecturer: Name (Institution)` line of `DESCRIPTION`; if the title starts with
  `Name (Institution) -- `, that prefix is removed (and supplies a missing affiliation).
- **Title:** `SUMMARY`, minus a leading `… Seminar: ` label. Slots with no lecturer and a TBA title are skipped.
- **Abstract:** text after `Abstract:` in `DESCRIPTION`
- **ID:** `technion-math-<n>` from `UID` (`<n>@math.technion.ac.il`)

The site blocks some generic User-Agents (e.g. plain `Mozilla/5.0`) but accepts the scraper's.

---

## Tel Aviv University — Mathematics (Google Calendars)

**URL:** `https://calendar.google.com/calendar/ical/<calendar-id>/public/basic.ics`, one per seminar

**Method:** iCalendar feeds; the list of calendars is `TAU_MATH_CALENDARS` in `scraper.ts`

The School of Mathematical Sciences embeds ~20 public Google Calendars on
`https://sites.google.com/view/tau-math-seminars/` (calendar IDs are the `src=` parameters of the embedded
calendar). Student seminars and an unnamed Hebrew calendar are left out. Each calendar has a fixed series
name, used as the department.

- **Times:** Google exports UTC (`…T101000Z`); `parseIcsDatetime()` converts them to Israel time.
- **Skipped:** recurring placeholders (events with `RRULE`), `STATUS:CANCELLED`, and summaries saying
  "no seminar" / "cancelled". Concrete dates of a recurring series appear as separate events and are kept.
- **Speaker / title:** organisers format `SUMMARY` differently; `parseTauSummary()` drops the series label,
  then looks for a `Name (Institution)` chunk (the rest is the title), else `Name, Institution` or just `Name`.
  A chunk that does not look like a name (e.g. "O-minimality series 3") is treated as the title with speaker
  TBA. A missing title is taken from `Title:` in `DESCRIPTION`.
- **Abstract:** `DESCRIPTION` with HTML stripped and any pasted Zoom invitation cut off
- **Location:** `LOCATION` + ", Tel Aviv University"; a Zoom URL there becomes the zoom link (location "Zoom")
- **Duplicates:** one talk may appear twice in a calendar (e.g. talk + lunch); entries with the same date and
  speaker are merged, keeping the more informative one.
- **ID:** `tau-math-<UID>` (Google UIDs are stable)

---

## BGU — other Mathematics seminars

`bgu-agnt` (Algebraic Geometry & Number Theory), `bgu-operator-algebras` (feed `seminars/219`) and
`bgu-results-of-others` (feed `seminars/218`) use the same ICS pattern as `bgu-pet` — see
`docs/bgu-ics-seminars.md`. The `eshnav` series (popular lectures in Hebrew) is not included.

---

## Adding a new source

**If the site publishes an iCalendar (`.ics`) feed** (e.g. BGU Mathematics seminars), use the shared `scrapeIcsFeed()` function — no new scraper function needed. See `docs/bgu-ics-seminars.md` for the full pattern.

**Otherwise:**
1. Check whether the site is server-rendered (view source has content) or JavaScript-rendered (view source is mostly empty). All current sources are server-rendered and can be fetched directly.
2. Add a scraper function following the existing patterns — split HTML into per-event blocks, then extract fields with targeted regex
3. Add an entry to `ALL_SOURCES` in the scraper file
4. Test by triggering the function and checking the database

---

## Candidate sources (not yet added)

Surveyed 2026-11-25. Agreed order: fix Weizmann (done), then TAU Math, Technion Math and the extra BGU
seminars (done), then the rest.

- **TAU Exact Sciences** (physics, chemistry, geophysics) — `https://en-exact-sciences.tau.ac.il/events?page=N`,
  server-rendered, 6 per page; many entries give only the series name.
- **Bar-Ilan Mathematics** — `https://math.biu.ac.il/en/calendar` (server-rendered month view). Its ICS feed
  `/ical/biu-math-seminars` returned a server error.
- **HUJI CS** — `https://www.cs.huji.ac.il/events`, rendered in the browser; few talks.
- **Weizmann Math & CS faculty** — `https://www.weizmann.ac.il/math/events`, server-rendered; adds seminars
  missing from the central Weizmann feed.
- **Haifa Faculty of Natural Sciences** — The Events Calendar REST API:
  `https://sciences.haifa.ac.il/wp-json/tribe/events/v1/events?start_date=YYYY-MM-DD`; very few talks.
