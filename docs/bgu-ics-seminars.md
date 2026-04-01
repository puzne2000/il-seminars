# BGU Seminar ICS Feeds

Many BGU Mathematics seminars publish a live iCalendar (`.ics`) feed that can be
subscribed to by calendar apps. These feeds are ideal for scraping: they are
plain text, machine-readable, and always up to date (new talks appear immediately
when added by the organiser).

## How to find the feed URL

1. Go to the seminar's page on the BGU Math website, e.g.
   `https://www.math.bgu.ac.il/en/research/seminars/<seminar-slug>/meetings`
2. Look for a "Subscribe" or "Add to calendar" link — it will have the scheme
   `webcal://`. Replace `webcal://` with `https://` to get a fetchable URL, e.g.:
   `https://www.math.bgu.ac.il/en/research/seminars/<seminar-slug>/meetings.ics`
3. Confirm it works: `curl -s <url> | head -20` should return `BEGIN:VCALENDAR`.

## ICS feed structure

Each event is a `VEVENT` block. The relevant fields are:

| ICS field | Content | Maps to |
|-----------|---------|---------|
| `DTSTART;TZID=Asia/Jerusalem` | `YYYYMMDDTHHMMSS` | `date`, `time` |
| `SUMMARY` | `Speaker Name: Talk Title` | `speaker`, `title` |
| `DESCRIPTION` | Abstract text (backslash-escaped) | `abstract` |
| `LOCATION` | Room number (e.g. `-101`) **or** a Zoom meeting URL | `location` / `zoom_link` |
| `URL;VALUE=URI` | Link to the individual event page | `source_url` |
| `URL;VALUE=URI` (path) | URL path of the event page | `external_id` (with prefix) — see note below |
| `UID` | UUID per event — **not used** (BGU regenerates UIDs on every export) | — |

**Line folding:** ICS files fold long lines at 75 characters (CRLF + space). The
scraper unfolds these before parsing.

**Escaping:** Commas, semicolons, and newlines in text fields are backslash-escaped
(`\,`, `\;`, `\n`). The scraper unescapes them after extracting each field.

**Zoom links:** When a talk is online, `LOCATION` contains a `zoom.us/j/…` URL
instead of a room number. The scraper detects this and stores it as `zoom_link`
rather than `location`. Past events sometimes have `zoom.us/rec/play/…` recording
links, but these are filtered out along with all past events.

## Adding a new BGU ICS seminar

Add a single entry to `ALL_SOURCES` in `supabase/functions/scrape-seminars/index.ts`:

```typescript
"bgu-<short-key>": {
  url: "https://www.math.bgu.ac.il/en/research/seminars/<seminar-slug>/meetings.ics",
  scraper: (url) => scrapeIcsFeed(url, {
    university: "Ben-Gurion University",
    department: "Department of Mathematics",   // adjust if needed
    subject_area: "Mathematics",               // adjust if needed
    type: "Seminar",                           // or "Colloquium"
    id_prefix: "bgu-<short-key>",             // must be globally unique
    default_location: "Department of Mathematics, Ben-Gurion University",
    affiliation: "Ben-Gurion University",
  }),
},
```

The `id_prefix` is prepended to a slug derived from the event's `URL` path to form
the `external_id` used for upsert deduplication. Use a short, stable, unique string
(e.g. `bgu-pet`, `bgu-agt`, `bgu-prob`).

> **Note:** BGU's server regenerates a new `UID` for every event on each feed export,
> so UIDs cannot be used for deduplication. The scraper uses the URL path instead,
> which is stable across fetches.

## Known BGU ICS feeds

| Key | Seminar | URL |
|-----|---------|-----|
| `bgu-pet` | Probability and Ergodic Theory (PET) | `…/bgu-probability-and-ergodic-theory-pet-seminar/meetings.ics` |
| `bgu-colloquium` | Mathematics Colloquium | `…/colloquium/meetings.ics` |

## Known limitations

- Affiliation is not in the ICS data; all speakers default to "Ben-Gurion University".
- Room numbers (e.g. `-101`, `201`) are appended to the default location string
  but the building name is not included in the feed.
- Some future events have `SUMMARY: Speaker Name: TBA` — title is stored as `"TBA"`.
