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

- **Title:** the full link text, e.g. `Colloquium: Vitaly Bergelson (Ohio State)`
- **Speaker:** extracted from the title after the colon — `Vitaly Bergelson`
- **Affiliation:** extracted from the parenthesised part — `Ohio State`
- **Date:** parsed from `DD/MM/YYYY` format
- **Time:** extracted from the date string if present; defaults to `14:30`
- **Location:** hardcoded to `Manchester Building, Hall 2` (standard venue for the colloquium)
- **Source URL:** the individual event page link from the `href`

**Known limitations:**
- Abstract is not scraped (not available on the listing page); a generic placeholder is stored instead
- Location is hardcoded and may be wrong for special events held elsewhere

---

## Technion — Computer Science Seminars

**URL:** `https://www.cs.technion.ac.il/events/`

**Method:** Firecrawl (converts the page to markdown)

The Technion CS events page is passed through the Firecrawl API, which renders the page and returns it as clean markdown. This is needed because the page is JavaScript-rendered.

**Parsing approach:**

The markdown is split into lines and processed sequentially. The parser skips navigation elements, images, headings, and known UI strings (e.g. "Events", "Home"). For each remaining line it treats it as a potential talk title and looks ahead up to 15 lines for a date pattern to confirm it.

Fields are identified as follows:

- **Title:** the plain text line preceding the date
- **Speaker:** the line immediately before the date line (short, plain text); affiliation is stripped from parentheses if present
- **Date/Time:** matched by pattern `Wednesday, 18.03.2026, 14:00`
- **Location:** first non-empty line after the date
- **Abstract:** longer text block (>50 chars) appearing after the location
- **Source URL:** extracted from a `[Full version](...)` markdown link if present; otherwise falls back to the events listing page URL
- Everything after a `## Past Events` heading is ignored

**Known limitations:**
- The parser is heuristic — changes to the page layout may cause fields to be misidentified
- Affiliation is not reliably extracted and defaults to `Technion`
- Abstract is only captured when the page includes one inline; many entries fall back to a generic placeholder

---

## Adding a new source

1. Decide whether the site needs Firecrawl (JavaScript-rendered) or can be fetched directly (server-rendered HTML)
2. Add a scraper/parser function following the existing patterns
3. Add an entry to `directSources` or `firecrawlSources` in the `Deno.serve` handler
4. Test by triggering the function and checking the database
