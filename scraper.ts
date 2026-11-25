// Standalone scraper — replaces the Supabase edge function.
// Run: deno run --allow-net --allow-read --allow-write --allow-env scraper.ts [source-key]
// Optional source keys: huji-math, huji-physics, technion-cs, technion-math, weizmann, tau-math, bgu-pet, bgu-colloquium, bgu-agnt, bgu-operator-algebras, bgu-results-of-others
// FIRECRAWL_API_KEY env var is only needed if scrapeWithFirecrawl() is used (no current source calls it).

interface ScrapedSeminar {
  external_id: string;
  title: string;
  speaker: string;
  affiliation: string;
  university: string;
  department: string;
  subject_area: string;
  date: string;
  time: string;
  location: string;
  abstract: string;
  type: "Seminar" | "Colloquium";
  source_url?: string;
  zoom_link?: string;
}

interface Seminar {
  id: string;
  title: string;
  speaker: string;
  affiliation: string;
  university: string;
  department: string;
  subjectArea: string;
  date: string;
  time: string;
  location: string;
  abstract: string;
  type: string;
  sourceUrl?: string;
  zoomLink?: string;
  possiblyCancelled?: boolean;
}

function extractZoomLink(html: string): string | undefined {
  const match = html.match(/https?:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\/[^\s"'<>]*/i);
  return match ? match[0] : undefined;
}

async function scrapeWithFirecrawl(url: string): Promise<string> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Firecrawl error: ${JSON.stringify(data)}`);
  }

  return data.data?.markdown || data.markdown || "";
}


async function scrapeHujiColloquiumsPage(html: string): Promise<{ seminars: ScrapedSeminar[]; foundPast: boolean }> {
  const seminars: ScrapedSeminar[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let foundPast = false;

  // Each event is an <h2><a href="URL">Title</a></h2> followed by a date span
  const eventPattern = /<h2[^>]*>\s*<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>\s*<\/h2>[\s\S]*?date-display-single">(.*?)</g;
  let match;

  while ((match = eventPattern.exec(html)) !== null) {
    const [, href, rawTitle, rawDate] = match;
    const title = decodeHtml(rawTitle.replace(/<[^>]+>/g, ""));
    const dateRaw = rawDate.trim(); // e.g. "Thu, 26/03/2026"

    if (!title || !dateRaw) continue;

    // Parse date "Thu, 26/03/2026" or "Thu, 26/03/2026 - 14:30"
    const dateMatch = dateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dateMatch) continue;
    const [, day, month, year] = dateMatch;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    if (date < today) {
      foundPast = true;
      continue;
    }

    // Time may appear in the date string
    const timeMatch = dateRaw.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : "14:30";

    // Speaker and affiliation from title pattern "Series: Name (Institution)" or "Series - Name (Institution)"
    let speaker = "TBA";
    let affiliation = "TBA";
    const speakerMatch = title.match(/^.*?[:\-–]\s*(.+)/);
    if (speakerMatch) {
      // If the captured part still contains a colon (e.g. "Zhukovitsky Lecture: Elad Kosloff"), take after the last colon
      const raw = speakerMatch[1].trim();
      const speakerPart = raw.includes(":") ? raw.slice(raw.lastIndexOf(":") + 1).trim() : raw;
      const affMatch = speakerPart.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (affMatch) {
        speaker = affMatch[1].trim() || speakerPart;
        affiliation = affMatch[2].trim();
      } else {
        speaker = speakerPart;
      }
    }

    const sourceUrl = href.startsWith("http")
      ? href
      : `https://mathematics.huji.ac.il${href}`;

    const id = `huji-${date}-${title.substring(0, 30).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}`;

    // Grab the block of HTML between this event's h2 and the next h2 to search for zoom links
    const blockStart = match.index ?? 0;
    const nextH2 = html.indexOf("<h2", blockStart + 1);
    const eventBlock = nextH2 !== -1 ? html.slice(blockStart, nextH2) : html.slice(blockStart);

    seminars.push({
      external_id: id,
      title,
      speaker,
      affiliation,
      university: "Hebrew University",
      department: "Einstein Institute of Mathematics",
      subject_area: "Mathematics",
      date,
      time,
      location: "Manchester Building, Hall 2",
      abstract: "",
      type: "Colloquium",
      source_url: sourceUrl,
      zoom_link: extractZoomLink(eventBlock),
    });
  }

  return { seminars, foundPast };
}

async function scrapeHujiColloquiums(pageUrl: string): Promise<ScrapedSeminar[]> {
  const baseUrl = pageUrl.split("?")[0];
  const allSeminars: ScrapedSeminar[] = [];

  for (let page = 0; ; page++) {
    const url = page === 0 ? baseUrl : `${baseUrl}?page=${page}`;
    console.log(`Fetching HUJI Math page ${page}: ${url}`);
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)" },
    });
    const html = await response.text();

    const { seminars, foundPast } = await scrapeHujiColloquiumsPage(html);
    allSeminars.push(...seminars);

    if (seminars.length === 0) break;
  }

  return allSeminars;
}

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

async function scrapeHujiPhysics(pageUrl: string): Promise<ScrapedSeminar[]> {
  console.log(`Fetching HUJI Physics: ${pageUrl}`);
  const response = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)" },
  });
  const html = await response.text();
  const seminars: ScrapedSeminar[] = [];

  // Each event is an <article class="node-event"> block
  const blocks = html.split(/(?=<article[^>]+node-event)/);

  for (const block of blocks) {
    const hrefMatch = block.match(/<h2[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!hrefMatch) continue;
    const [, href, rawTitle] = hrefMatch;
    const title = decodeHtml(rawTitle.replace(/<[^>]+>/g, ""));
    if (!title) continue;

    const dateRawMatch = block.match(/date-display-single">(.*?)</);
    if (!dateRawMatch) continue;
    const dateParts = dateRawMatch[1].match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dateParts) continue;
    const [, day, month, year] = dateParts;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    const timeMatch = block.match(/time-display-single">([\d:]+)/);
    const time = timeMatch ? timeMatch[1] : "TBA";

    // Speaker and affiliation from title (same logic as math HUJI)
    let speaker = "TBA";
    let affiliation = "TBA";
    const speakerMatch = title.match(/^.*?[:\-–]\s*(.+)/);
    if (speakerMatch) {
      const raw = speakerMatch[1].trim();
      const speakerPart = raw.includes(":") ? raw.slice(raw.lastIndexOf(":") + 1).trim() : raw;
      const affMatch = speakerPart.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (affMatch) {
        speaker = affMatch[1].trim() || speakerPart;
        affiliation = affMatch[2].trim();
      } else {
        speaker = speakerPart;
      }
    }

    const sourceUrl = href.startsWith("http") ? href : `https://phys.huji.ac.il${href}`;

    // Fetch individual event page for location and abstract
    let abstract = "";
    let location = "Racah Institute of Physics";
    let zoomLink: string | undefined;
    try {
      console.log(`  Fetching HUJI Physics event: ${sourceUrl}`);
      const evtResp = await fetch(sourceUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)" },
      });
      const evtHtml = await evtResp.text();

      const locMatch = evtHtml.match(/field-name-field-event-location[\s\S]*?field-item even">\s*(.*?)\s*<\/div>/);
      if (locMatch) location = decodeHtml(locMatch[1].replace(/<[^>]+>/g, "").trim()) || location;

      const bodyMatch = evtHtml.match(/field-type-text-with-summary[\s\S]*?field-item even">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
      if (bodyMatch) {
        const bodyText = bodyMatch[1];

        // Extract speaker from "Lecturer: Name - Institution" if present
        const lecturerMatch = bodyText.match(/Lecturer:\s*([^<\n]+)/i);
        if (lecturerMatch) {
          const lecturerRaw = lecturerMatch[1].replace(/<[^>]+>/g, "").trim();
          const dashIdx = lecturerRaw.search(/\s[-–]\s/);
          if (dashIdx !== -1) {
            speaker = lecturerRaw.slice(0, dashIdx).trim();
            affiliation = lecturerRaw.slice(dashIdx).replace(/^[\s\-–]+/, "").trim();
          } else {
            speaker = lecturerRaw;
          }
        }

        const bqMatch = bodyText.match(/<blockquote>([\s\S]*?)<\/blockquote>/);
        if (bqMatch) {
          abstract = decodeHtml(bqMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        }
      }

      zoomLink = extractZoomLink(evtHtml);
    } catch (_) { /* ignore */ }

    const id = `huji-phys-${date}-${title.substring(0, 30).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}`;

    seminars.push({
      external_id: id,
      title,
      speaker,
      affiliation,
      university: "Hebrew University",
      department: "Racah Institute of Physics",
      subject_area: "Physics",
      date,
      time,
      location,
      abstract,
      type: "Seminar",
      source_url: sourceUrl,
      zoom_link: zoomLink,
    });
  }

  return seminars;
}

async function scrapeTechnionCS(pageUrl: string): Promise<ScrapedSeminar[]> {
  console.log(`Fetching Technion CS: ${pageUrl}`);
  const response = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)" },
  });
  const html = await response.text();
  const seminars: ScrapedSeminar[] = [];

  // Split into per-event blocks on events_header
  const blocks = html.split(/(?=<div class='events_header'>)/);

  for (const block of blocks) {
    const titleMatch = block.match(/class='events_header'>(.*?)<\/div>/);
    if (!titleMatch) continue;
    const title = decodeHtml(titleMatch[1].replace(/<[^>]+>/g, ""));
    if (!title) continue;

    // Extract all ev_r_col values within this block (speaker, date, location in order)
    const rawCols = [...block.matchAll(/class='ev_r_col'>([\s\S]*?)<\/div>/g)]
      .map(m => m[1]);
    const cols = rawCols.map(c => decodeHtml(c.replace(/<[^>]+>/g, "")));

    // Find the date column (contains day.month.year pattern)
    const dateColIdx = cols.findIndex(c => /\d{1,2}\.\d{1,2}\.\d{4}/.test(c));
    if (dateColIdx === -1) continue;

    const dateRaw = cols[dateColIdx];
    const speaker = cols[dateColIdx - 1] || "TBA";

    // Extract zoom link from the location column HTML before stripping tags,
    // then remove the zoom anchor and any trailing " & " to get a clean location string.
    const locationRaw = rawCols[dateColIdx + 1] || "";
    const zoomFromLocation = extractZoomLink(locationRaw);
    const locationClean = locationRaw
      .replace(/<a\b[^>]*zoom[^>]*>[\s\S]*?<\/a>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s*&amp;\s*$/, "")
      .replace(/\s*&\s*$/, "")
      .trim();
    const location = decodeHtml(locationClean) || "Taub Building";

    const dateMatch = dateRaw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s+(\d{1,2}:\d{2})/);
    if (!dateMatch) continue;
    const [, day, month, year, time] = dateMatch;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    const abstractMatch = block.match(/class='events_txt_part'>([\s\S]*?)<\/div>/);
    const abstract = abstractMatch ? decodeHtml(abstractMatch[1].replace(/<[^>]+>/g, "")) : "";

    const id = `technion-cs-${date}-${title.substring(0, 30).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase()}`;

    seminars.push({
      external_id: id,
      title,
      speaker,
      affiliation: "Technion",
      university: "Technion",
      department: "Taub Faculty of Computer Science",
      subject_area: "Computer Science",
      date,
      time,
      location,
      abstract: abstract,
      type: "Seminar",
      source_url: pageUrl,
      zoom_link: zoomFromLocation ?? extractZoomLink(block),
    });
  }

  return seminars;
}

// ── Weizmann ─────────────────────────────────────────────────────────────────
// The Weizmann events page (https://www.weizmann.ac.il/pages/news/events) loads its
// events from a JSON endpoint, one month per request:
//   https://www.weizmann.ac.il/pages/news/events/ajax/events?month=YYYY-MM

interface WeizmannEvent {
  id: string;
  title_en: string;
  subtitle_en: string;
  start: string; // "YYYY-MM-DD HH:MM:SS"
  all_day: boolean;
  type_name: string; // "Lectures" | "Colloquia" | "Academic" | "Conference" | "Cultural"
  cat_name: string; // faculty, e.g. "Faculty of Physics"
  sponsors: { name: string }[];
  lecturers: { name: string; affiliation: string }[];
  building: string;
  room: string;
  virtual_url: string;
  abstract_en: string;
}

const WEIZMANN_MONTHS_AHEAD = 4; // current month + next 3

// Only talks — skip conferences, cultural events, student days, retreats, etc.
const WEIZMANN_INCLUDED_TYPES = new Set(["Lectures", "Colloquia"]);

function weizmannSubject(e: WeizmannEvent): string {
  const cat = e.cat_name || "";
  if (cat.includes("Physics")) return "Physics";
  if (cat.includes("Chemistry")) return "Chemistry";
  if (cat.includes("Life Sciences")) return "Biology";
  if (cat.includes("Mathematics")) {
    return e.sponsors.some((s) => /computer science/i.test(s.name)) ? "Computer Science" : "Mathematics";
  }
  return "Natural Sciences";
}

function htmlToText(s: string): string {
  return decodeHtml(s.replace(/<br\s*\/?>|<\/p>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

function weizmannEventToSeminar(e: WeizmannEvent): ScrapedSeminar | null {
  if (!WEIZMANN_INCLUDED_TYPES.has(e.type_name)) return null;

  const mainTitle = htmlToText(e.title_en || "");
  const subtitle = htmlToText(e.subtitle_en || "");
  if (/\bno seminar\b|\bcancel+ed\b/i.test(`${mainTitle} ${subtitle}`)) return null;

  const lecturers = e.lecturers
    .map((l) => ({ name: htmlToText(l.name), affiliation: htmlToText(l.affiliation || "") }))
    .filter((l) => l.name && !/will be updated|^tb[ad]$/i.test(l.name));

  // Sometimes title_en is the series name ("Vision and AI") and subtitle_en the talk title;
  // other times title_en is the talk title and subtitle_en is a note ("Light refreshments 11:30")
  // or the speaker's name. Use the subtitle as the title only when it doesn't look like such a note.
  const isPlaceholder = (s: string) => /^(tb[ad]|will be updated)\b/i.test(s);
  const subtitleIsNote =
    !subtitle ||
    isPlaceholder(subtitle) ||
    /refreshment|zoom|^annual$|^department of|^(prof|dr)\.?\s/i.test(subtitle) ||
    lecturers.some((l) => l.name === subtitle);
  const series = subtitleIsNote || isPlaceholder(mainTitle) ? "" : mainTitle;
  const department = series || e.sponsors[0]?.name || e.cat_name || "Weizmann Institute of Science";
  let title = subtitleIsNote ? mainTitle : subtitle;
  // Some organisers put contact details in the title field.
  if (!title || /@/.test(title)) title = `${department} seminar`;

  const [date, clock] = e.start.split(" ");
  const time = e.all_day || !clock ? "TBA" : clock.slice(0, 5);

  // Affiliation is sometimes a bio paragraph ("Dr. X is a Senior Scientist..."); keep only short,
  // non-bio ones.
  const affiliation = lecturers.find((l) =>
    l.affiliation && l.affiliation.length <= 100 &&
    !l.affiliation.includes(l.name) && !/\bis an?\b/i.test(l.affiliation)
  )?.affiliation ?? "";

  const location = [e.room, e.building].map((s) => (s || "").trim()).filter(Boolean).join(", ") || "Weizmann Institute";
  const abstract = htmlToText(e.abstract_en || "");
  const zoom = e.virtual_url && /zoom\.us/i.test(e.virtual_url) ? e.virtual_url : extractZoomLink(e.abstract_en || "");

  return {
    external_id: `weizmann-${e.id}`,
    title,
    speaker: lecturers.map((l) => l.name).join(", ") || "TBA",
    affiliation,
    university: "Weizmann Institute",
    department,
    subject_area: weizmannSubject(e),
    date,
    time,
    location,
    abstract,
    type: e.type_name === "Colloquia" || /colloquium/i.test(mainTitle) ? "Colloquium" : "Seminar",
    source_url: `https://www.weizmann.ac.il/pages/news/events/event/${e.id}`,
    zoom_link: zoom,
  };
}

async function scrapeWeizmann(baseUrl: string): Promise<ScrapedSeminar[]> {
  const now = new Date();
  const months = Array.from({ length: WEIZMANN_MONTHS_AHEAD }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    return d.toISOString().slice(0, 7);
  });

  const seminars: ScrapedSeminar[] = [];
  for (const month of months) {
    const url = `${baseUrl}?month=${month}`;
    console.log(`Fetching Weizmann: ${url}`);
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)", Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Weizmann ${month}: HTTP ${response.status}`);
    const data = await response.json() as { events?: WeizmannEvent[] };
    if (!Array.isArray(data.events)) throw new Error(`Weizmann ${month}: unexpected response shape`);
    for (const e of data.events) {
      const s = weizmannEventToSeminar(e);
      if (s) seminars.push(s);
    }
  }
  return seminars;
}

// ── ICS feeds (shared) ──────────────────────────────────────────────────────

function unfoldIcs(raw: string): string {
  // RFC 5545: long lines are folded with CRLF + whitespace continuation
  return raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function unescapeIcs(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

const jerusalemParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

// DTSTART value → Israel-local date and time. Handles local times (TZID=Asia/Jerusalem),
// UTC times ("...Z", as Google Calendar exports) and all-day dates (time "TBA").
function parseIcsDatetime(value: string): { date: string; time: string } {
  const m = value.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return { date: "", time: "" };
  const [, year, month, day, hour, min, , utc] = m;
  if (!hour) return { date: `${year}-${month}-${day}`, time: "TBA" };
  if (!utc) return { date: `${year}-${month}-${day}`, time: `${hour}:${min}` };
  const parts = Object.fromEntries(
    jerusalemParts.formatToParts(new Date(Date.UTC(+year, +month - 1, +day, +hour, +min)))
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

interface IcsEvent {
  uid: string;
  recurrenceId: string;
  isRecurring: boolean; // has an RRULE — a repeating slot, not a specific talk
  cancelled: boolean;
  date: string;
  time: string;
  summary: string;
  description: string;
  location: string;
  url: string;
  categories: string[];
}

function parseIcsEvents(rawIcs: string): IcsEvent[] {
  const raw = unfoldIcs(rawIcs);
  const getField = (block: string, name: string): string => {
    const match = block.match(new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, "m"));
    return match ? match[1].trim() : "";
  };
  return raw.split("BEGIN:VEVENT").slice(1).map((chunk) => {
    const block = chunk.split("END:VEVENT")[0];
    const { date, time } = parseIcsDatetime(getField(block, "DTSTART"));
    return {
      uid: getField(block, "UID"),
      recurrenceId: getField(block, "RECURRENCE-ID"),
      isRecurring: /^RRULE[:;]/m.test(block),
      cancelled: /^STATUS:CANCELLED/m.test(block),
      date,
      time,
      summary: unescapeIcs(getField(block, "SUMMARY")),
      description: unescapeIcs(getField(block, "DESCRIPTION")),
      location: unescapeIcs(getField(block, "LOCATION")),
      url: unescapeIcs(getField(block, "URL")),
      categories: unescapeIcs(getField(block, "CATEGORIES")).split(",").map((c) => c.trim()).filter(Boolean),
    };
  });
}

async function fetchIcsEvents(icsUrl: string, client?: Deno.HttpClient): Promise<IcsEvent[]> {
  console.log(`Fetching ICS feed: ${icsUrl}`);
  const response = await fetch(icsUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)" },
    ...(client && { client }),
  });
  if (!response.ok) throw new Error(`${icsUrl}: HTTP ${response.status}`);
  const text = await response.text();
  if (!text.startsWith("BEGIN:VCALENDAR")) throw new Error(`${icsUrl}: not an iCalendar feed`);
  return parseIcsEvents(text);
}

function upcomingTalks(events: IcsEvent[]): IcsEvent[] {
  const today = new Date().toISOString().slice(0, 10);
  return events.filter((e) => e.date && e.date >= today && !e.isRecurring && !e.cancelled);
}

// "Name (Institution)" → { name, affiliation }; the institution may itself contain
// parentheses, e.g. "Massachusetts Institute of Technology (MIT)".
function splitNameAffiliation(s: string): { name: string; affiliation: string } {
  const m = s.trim().match(/^([^()]*?)\s*\((.*)\)\s*$/);
  return m ? { name: m[1].trim(), affiliation: m[2].trim() } : { name: s.trim(), affiliation: "" };
}

const isTbaTitle = (s: string) => !s || /^tb[ad]\.?$/i.test(s.trim());

// Rough check that a string is a person's name ("Jarek Kędra", "Nachi Avraham-Re'em"),
// not a title fragment ("O-minimality series 3").
const NAME_PARTICLES = new Set(["de", "van", "von", "der", "den", "da", "di", "du", "le", "la", "ben", "bar", "al", "el"]);
function isLikelyName(s: string): boolean {
  const words = s.trim().split(/\s+/);
  return words.length >= 1 && words.length <= 5 && !/\d/.test(s) &&
    words.every((w) => /^\p{Lu}/u.test(w) || NAME_PARTICLES.has(w.toLowerCase()));
}

// ── BGU Mathematics (ICS) ───────────────────────────────────────────────────

interface IcsFeedOptions {
  university: string;
  department: string;
  subject_area: string;
  type: "Seminar" | "Colloquium";
  id_prefix: string;
  default_location: string;
  affiliation: string;
}

async function scrapeIcsFeed(icsUrl: string, opts: IcsFeedOptions): Promise<ScrapedSeminar[]> {
  const seminars: ScrapedSeminar[] = [];

  for (const ev of upcomingTalks(await fetchIcsEvents(icsUrl))) {
    if (ev.time === "TBA") continue;
    const { date, time, summary, description, url: sourceUrl } = ev;
    if (/^no (talk|seminar|meeting)\b/i.test(summary)) continue;

    // SUMMARY format: "Speaker Name: Talk Title"
    let speaker = "TBA";
    let title = summary || "TBA";
    const colonIdx = summary.indexOf(":");
    if (colonIdx !== -1) {
      speaker = summary.slice(0, colonIdx).trim();
      title = summary.slice(colonIdx + 1).trim() || "TBA";
    }

    // LOCATION: Zoom meeting URL → zoom_link; physical room → append to default
    let location = opts.default_location;
    let zoom_link: string | undefined;
    if (/zoom\.us\/j\//i.test(ev.location)) {
      zoom_link = ev.location;
    } else if (ev.location && !/^https?:\/\//.test(ev.location)) {
      location = `${opts.default_location}, Room ${ev.location}`;
    }
    if (!zoom_link) {
      zoom_link = extractZoomLink(description);
    }

    // Build a stable external_id from the event's URL path — BGU regenerates UIDs on every feed export
    const urlSlug = sourceUrl
      ? new URL(sourceUrl).pathname.replace(/\//g, "-").replace(/^-/, "").replace(/[^a-zA-Z0-9-]/g, "")
      : `${date}-${time.replace(":", "")}`;

    seminars.push({
      external_id: `${opts.id_prefix}-${urlSlug}`,
      title,
      speaker,
      affiliation: opts.affiliation,
      university: opts.university,
      department: opts.department,
      subject_area: opts.subject_area,
      date,
      time,
      location,
      abstract: description,
      type: opts.type,
      source_url: sourceUrl || icsUrl,
      zoom_link,
    });
  }

  return seminars;
}

function bguMathSource(key: string, feedPath: string, type: "Seminar" | "Colloquium" = "Seminar") {
  return {
    url: `https://www.math.bgu.ac.il/en/${feedPath}/meetings.ics`,
    scraper: (url: string) => scrapeIcsFeed(url, {
      university: "Ben-Gurion University",
      department: "Department of Mathematics",
      subject_area: "Mathematics",
      type,
      id_prefix: key,
      default_location: "Department of Mathematics, Ben-Gurion University",
      affiliation: "Ben-Gurion University",
    }),
  };
}

// ── Technion Mathematics (ICS) ──────────────────────────────────────────────
// One WordPress Events Manager feed for the whole faculty. CATEGORIES holds the seminar
// name (plus a generic "Seminars"); DESCRIPTION starts with "Lecturer:", "Location:" and
// "Abstract:" lines.

// Non-research series: the Hebrew math club and M.Sc. thesis talks.
const TECHNION_MATH_SKIP = new Set(["Math Club", "Graduation Seminars"]);

// math.technion.ac.il does not send its intermediate certificate (GEANT TLS RSA 1, issued by
// HARICA TLS RSA Root CA 2021). Browsers fetch it themselves; Deno doesn't, so we ship it.
// Source: http://crt.harica.gr/HARICA-GEANT-TLS-R1.cer (valid until 2039).
const TECHNION_CA_CERT = new URL("./certs/geant-tls-rsa-1.pem", import.meta.url);

async function scrapeTechnionMath(icsUrl: string): Promise<ScrapedSeminar[]> {
  const seminars: ScrapedSeminar[] = [];
  const client = Deno.createHttpClient({ caCerts: [await Deno.readTextFile(TECHNION_CA_CERT)] });

  let events: IcsEvent[];
  try {
    events = await fetchIcsEvents(icsUrl, client);
  } finally {
    client.close();
  }

  for (const ev of upcomingTalks(events)) {
    const series = ev.categories.find((c) => c !== "Seminars") ?? "Seminar";
    if (TECHNION_MATH_SKIP.has(series)) continue;

    const desc = ev.description;
    const lecturerLine = desc.match(/^[ \t]*Lecturer:[ \t]*(.*)$/m)?.[1].trim() ?? "";
    let { name: speaker, affiliation } = splitNameAffiliation(lecturerLine);

    // Titles may carry a series label ("Cable Car Algebra Seminar: ...") or the speaker
    // ("Anton Khoroshkin (Haifa) -- Gröbner bases ..."); strip them.
    let title = ev.summary.replace(/^[^:]*\bseminar:\s*/i, "").trim();
    const dash = title.match(/^(.*?)\s+--\s+(.*)$/);
    if (dash) {
      const left = splitNameAffiliation(dash[1]);
      if (/seminar/i.test(dash[1]) || (speaker && left.name.includes(speaker)) || left.affiliation) {
        if (!speaker && !/seminar/i.test(dash[1])) ({ name: speaker, affiliation } = left);
        else if (!affiliation && speaker && left.name.includes(speaker)) affiliation = left.affiliation;
        title = dash[2].trim();
      }
    }
    if (!speaker && isTbaTitle(title)) continue; // empty placeholder slot

    const abstractMatch = desc.match(/Abstract:\s*([\s\S]*)$/);
    const abstract = (abstractMatch ? abstractMatch[1] : desc.replace(/^\s*(Lecturer|Location):.*$/gm, ""))
      .replace(/\s+/g, " ").trim();

    const room = ev.location || desc.match(/^[ \t]*Location:[ \t]*(.*)$/m)?.[1].trim() || "";
    const uidNum = ev.uid.split("@")[0];

    seminars.push({
      external_id: `technion-math-${uidNum || `${ev.date}-${ev.time.replace(":", "")}`}`,
      title: isTbaTitle(title) ? "TBA" : title,
      speaker: speaker || "TBA",
      affiliation,
      university: "Technion",
      department: series,
      subject_area: "Mathematics",
      date: ev.date,
      time: ev.time,
      location: !room ? "Faculty of Mathematics, Technion" : /technion/i.test(room) ? room : `${room}, Technion`,
      abstract,
      type: /colloquium/i.test(series) ? "Colloquium" : "Seminar",
      source_url: ev.url || "https://math.technion.ac.il/en/seminars-and-events/",
      zoom_link: extractZoomLink(`${ev.location} ${desc}`),
    });
  }

  return seminars;
}

// ── TAU Mathematics (Google Calendars) ──────────────────────────────────────
// The School of Mathematical Sciences keeps each seminar in its own public Google Calendar
// (embedded on https://sites.google.com/view/tau-math-seminars/). Each calendar is a public
// ICS feed. Organisers format SUMMARY differently, e.g.
//   "Math Colloquium: Benjamin Weiss (Hebrew University) - Dynamical aspects of ..."
//   "Groups & Dynamics | Omer Segev (Technion) | Conservativity and ..."
//   "Combinatorics seminar: Linear Hashing ... – Or Zamir (Tel Aviv University)"
//   "Applied Math Seminar - Boaz Nadler, Weizmann Institute of Science"
//   "Geometry & Dynamics seminar, Frol Zapolsky (University of Haifa), The Lagrangian ..."

interface GoogleCalendarSeminar {
  calendarId: string;
  series: string;
  type?: "Seminar" | "Colloquium";
}

const TAU_MATH_CALENDARS: GoogleCalendarSeminar[] = [
  { calendarId: "mathtau120@gmail.com", series: "Mathematics Colloquium", type: "Colloquium" },
  { calendarId: "pbn142281ikep0u7d52u2np9og@group.calendar.google.com", series: "Algebra Seminar" },
  { calendarId: "c07ibgli0k0s4cn1qhg1holigg@group.calendar.google.com", series: "Number Theory Seminar" },
  { calendarId: "h1473hj3gf5rs6bnpu0pvq0s1c@group.calendar.google.com", series: "Combinatorics Seminar" },
  { calendarId: "6dbc3bd81e44a449165b2eaed6a4a96a19e6b0dd51902c1aebebec2a60f95fb8@group.calendar.google.com", series: "GAFA Seminar" },
  { calendarId: "785lg6fjgu1iheq1b1vcqgu9bc@group.calendar.google.com", series: "Groups & Dynamics Seminar" },
  { calendarId: "3ccd1602a52399c573ee8e78781543d8a6be5d94d26b2ee0b342188e4759e669@group.calendar.google.com", series: "Representation Theory Seminar" },
  { calendarId: "i93ipfiak8fafjrd996p03rgig@group.calendar.google.com", series: "Applied Math Seminar" },
  { calendarId: "d0qum5kdjio03uos9bgtohj7ag@group.calendar.google.com", series: "Statistics Seminar" },
  { calendarId: "ihge34d366v2skemqgag5nies8@group.calendar.google.com", series: "Game Theory Seminar" },
  { calendarId: "tau.math.seminars@gmail.com", series: "Geometry & Dynamics Seminar" },
  { calendarId: "lcn2080c6557hce4a0cvj7qht8@group.calendar.google.com", series: "Horowitz Seminar on Probability, Ergodic Theory and Dynamical Systems" },
  { calendarId: "s16l44f9na42bu6c5b5g0d3qk0@group.calendar.google.com", series: "Seminar in Real & Complex Geometry" },
  { calendarId: "u247cm43jtb77pr4fuo4vk72i0@group.calendar.google.com", series: "Field Arithmetic Seminar" },
  { calendarId: "o9sgdbqi3ftt42aobpmphnjbic@group.calendar.google.com", series: "Joint Israeli Probability Seminar" },
];

const AFFILIATION_WORDS = /universit|institut|college|technion|school|lab\b|research|center|centre|\bU\b|\bTAU\b|\bHUJI\b|\bBGU\b|\bMIT\b/i;

function parseTauSummary(summary: string): { speaker: string; affiliation: string; title: string } {
  let s = summary.replace(/\s*\+\s*lunch\s*$/i, "").trim();
  // Drop the series label: everything up to the first ":" or "|" or "seminar,"/"seminar -"
  s = s.replace(/^[^:|]*?(?:seminar|colloquium)[^:|,]*?(?:\s*[:|,]\s*|\s+[-–]\s+)/i, "")
    .replace(/^[^:|]*\|\s*/, "")
    .trim();

  // Prefer a "Name (Institution)" chunk; whatever surrounds it is the title.
  const pieces = s.split(/\s+\|\s+|\s+[-–]\s+|,\s+/);
  const idx = pieces.findIndex((p) => /^[^()]{2,60}\(.+\)$/.test(p.trim()) && isLikelyName(splitNameAffiliation(p).name));
  if (idx !== -1) {
    const { name, affiliation } = splitNameAffiliation(pieces[idx]);
    const title = [...pieces.slice(0, idx), ...pieces.slice(idx + 1)].join(" - ").replace(/\.$/, "").trim();
    return { speaker: name, affiliation, title: isTbaTitle(title) ? "" : title };
  }
  // "Name, Institution" / "Name - Institution" / just "Name" — or no speaker at all
  // (e.g. a lecture series: "O-minimality series 3 - O-minimal structures (cont'd)")
  const [first, ...rest] = pieces;
  if (!isLikelyName(first)) return { speaker: "", affiliation: "", title: isTbaTitle(s) ? "" : s };
  const restText = rest.join(", ").trim();
  if (restText && AFFILIATION_WORDS.test(restText)) return { speaker: first.trim(), affiliation: restText, title: "" };
  if (!restText) return { speaker: first.trim(), affiliation: "", title: "" };
  return { speaker: first.trim(), affiliation: "", title: isTbaTitle(restText) ? "" : restText };
}

function cleanCalendarDescription(desc: string): string {
  // Some descriptions end with a pasted Zoom invitation; drop it.
  const invite = desc.search(/─{3,}|[^.<>\n]*is inviting you to a scheduled Zoom meeting/i);
  return htmlToText((invite === -1 ? desc : desc.slice(0, invite)).replace(/<\/div>|<div[^>]*>/gi, " "));
}

// Higher = more informative; used to pick between duplicate entries of one talk.
const seminarInfoScore = (s: ScrapedSeminar) =>
  (s.title !== "TBA" ? 2 : 0) + (s.affiliation ? 1 : 0) + (s.abstract ? 1 : 0);

async function scrapeGoogleCalendarSeminars(
  calendars: GoogleCalendarSeminar[],
  opts: { idPrefix: string; university: string; department: string; subject_area: string; campus: string },
): Promise<ScrapedSeminar[]> {
  // Keyed by date + speaker: some calendars hold the same talk twice (e.g. talk + lunch entry).
  const byTalk = new Map<string, ScrapedSeminar>();

  const results = await Promise.allSettled(calendars.map(async (cal) => {
    const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(cal.calendarId)}/public/basic.ics`;
    return { cal, url, events: upcomingTalks(await fetchIcsEvents(url)) };
  }));

  for (const r of results) {
    if (r.status === "rejected") { console.error(`  calendar failed: ${r.reason}`); continue; }
    const { cal, url, events } = r.value;
    for (const ev of events) {
      if (/\bno (seminar|colloquium|meeting)\b|\bcancel+ed\b/i.test(ev.summary)) continue;
      let { speaker, affiliation, title } = parseTauSummary(ev.summary);
      const descText = cleanCalendarDescription(ev.description);
      if (!title) title = descText.match(/Title:\s*(.*?)\s*(?=Speaker:|Abstract\b|$)/i)?.[1].trim() ?? "";
      if (!speaker && isTbaTitle(title)) continue;

      const abstract = descText.replace(/^.*?Abstract:?\s*/i, "").replace(/^TBA\.?$/i, "").trim();
      const zoom = extractZoomLink(`${ev.location} ${ev.description}`);
      const room = /^https?:\/\//.test(ev.location) ? "" : ev.location.trim();
      const location = room
        ? (room.includes(opts.campus) ? room : `${room}, ${opts.campus}`)
        : zoom ? "Zoom" : opts.campus;

      const seminar: ScrapedSeminar = {
        external_id: `${opts.idPrefix}-${(ev.uid.split("@")[0] + (ev.recurrenceId ? `-${ev.recurrenceId}` : "")).replace(/[^a-zA-Z0-9-]/g, "")}`,
        title: title || "TBA",
        speaker: speaker || "TBA",
        affiliation,
        university: opts.university,
        department: cal.series,
        subject_area: opts.subject_area,
        date: ev.date,
        time: ev.time,
        location,
        abstract,
        type: cal.type ?? "Seminar",
        source_url: ev.url || url.replace("/ical/", "/embed?src=").replace("/public/basic.ics", ""),
        zoom_link: zoom,
      };
      const key = speaker ? `${ev.date} ${speaker.toLowerCase()}` : `${ev.date} ${ev.time} ${title}`;
      const existing = byTalk.get(key);
      if (!existing || seminarInfoScore(seminar) > seminarInfoScore(existing)) byTalk.set(key, seminar);
    }
  }
  return [...byTalk.values()];
}

// ── Sources ──────────────────────────────────────────────────────────────────

const ALL_SOURCES: Record<string, { url: string; scraper: (url: string) => Promise<ScrapedSeminar[]> }> = {
  "huji-math": {
    url: "https://mathematics.huji.ac.il/eventss/events-seminars",
    scraper: scrapeHujiColloquiums,
  },
  "technion-cs": {
    url: "https://www.cs.technion.ac.il/events/",
    scraper: scrapeTechnionCS,
  },
  "weizmann": {
    url: "https://www.weizmann.ac.il/pages/news/events/ajax/events",
    scraper: scrapeWeizmann,
  },
  "huji-physics": {
    url: "https://phys.huji.ac.il/calendar/upcoming",
    scraper: scrapeHujiPhysics,
  },
  "bgu-pet": bguMathSource("bgu-pet", "research/seminars/bgu-probability-and-ergodic-theory-pet-seminar"),
  "bgu-colloquium": bguMathSource("bgu-colloquium", "research/seminars/colloquium", "Colloquium"),
  "bgu-agnt": bguMathSource("bgu-agnt", "seminars/agnt"),
  "bgu-operator-algebras": bguMathSource("bgu-operator-algebras", "seminars/219"),
  "bgu-results-of-others": bguMathSource("bgu-results-of-others", "seminars/218"),
  "technion-math": {
    url: "https://math.technion.ac.il/events.ics",
    scraper: scrapeTechnionMath,
  },
  "tau-math": {
    url: "https://sites.google.com/view/tau-math-seminars/",
    scraper: () => scrapeGoogleCalendarSeminars(TAU_MATH_CALENDARS, {
      idPrefix: "tau-math",
      university: "Tel Aviv University",
      department: "School of Mathematical Sciences",
      subject_area: "Mathematics",
      campus: "Tel Aviv University",
    }),
  },
};

// ── Output helpers ────────────────────────────────────────────────────────────

function toFrontendSeminar(s: ScrapedSeminar, possiblyCancelled?: true): Seminar {
  return {
    id: s.external_id,
    title: s.title,
    speaker: s.speaker,
    affiliation: s.affiliation,
    university: s.university,
    department: s.department,
    subjectArea: s.subject_area,
    date: s.date,
    time: s.time,
    location: s.location,
    abstract: s.abstract,
    type: s.type,
    ...(s.source_url && { sourceUrl: s.source_url }),
    ...(s.zoom_link && { zoomLink: s.zoom_link }),
    ...(possiblyCancelled && { possiblyCancelled: true }),
  };
}

const JSON_PATH = "./public/seminars.json";

async function loadExisting(): Promise<Seminar[]> {
  try {
    return JSON.parse(await Deno.readTextFile(JSON_PATH));
  } catch {
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const sourceArg = Deno.args[0]; // optional source key, e.g. "huji-math"

  const existing = await loadExisting();

  const sourcesToScrape = sourceArg
    ? { [sourceArg]: ALL_SOURCES[sourceArg] }
    : ALL_SOURCES;

  if (sourceArg && !ALL_SOURCES[sourceArg]) {
    console.error(`Unknown source: "${sourceArg}". Valid keys: ${Object.keys(ALL_SOURCES).join(", ")}`);
    Deno.exit(1);
  }

  console.log(`Scraping ${sourceArg ? `[${sourceArg}]` : "all sources"}...`);

  const freshRaw: ScrapedSeminar[] = [];
  const results = await Promise.allSettled(
    Object.entries(sourcesToScrape).map(async ([key, source]) => {
      const items = await source.scraper(source.url);
      console.log(`[${key}] found ${items.length}`);
      return items;
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") freshRaw.push(...r.value);
    else console.error("Source failed:", r.reason);
  }

  // A source may list the same talk twice (e.g. on two listing pages) — keep one per ID.
  const futureFresh = [...new Map(
    freshRaw.filter((s) => s.date >= today).map((s) => [s.external_id, s]),
  ).values()];
  const output: Seminar[] = [];

  if (sourceArg) {
    // Partial scrape: update entries found by this source, keep all other existing entries unchanged.
    // No possibly_cancelled logic — we only scraped one source.
    const freshById = new Map(futureFresh.map((s) => [s.external_id, s]));
    const existingFuture = existing.filter((s) => s.date >= today);
    const merged = new Map<string, Seminar>(existingFuture.map((s) => [s.id, s]));
    for (const s of futureFresh) merged.set(s.external_id, toFrontendSeminar(s));
    output.push(...merged.values());
  } else {
    // Full scrape: fresh results + carry over existing future entries not found (mark as possibly cancelled).
    // An entry whose ID changed (e.g. the site changed its URLs) is matched by university, date,
    // time and speaker so it isn't carried over as a duplicate.
    const newIds = new Set(futureFresh.map((s) => s.external_id));
    const talkKey = (s: { university: string; date: string; time: string; speaker: string }) =>
      `${s.university}|${s.date}|${s.time}|${s.speaker.toLowerCase()}`;
    const newTalks = new Set(futureFresh.map(talkKey));
    for (const s of futureFresh) output.push(toFrontendSeminar(s));
    for (const s of existing) {
      if (s.date >= today && !newIds.has(s.id) && !newTalks.has(talkKey(s))) {
        output.push({ ...s, possiblyCancelled: true });
      }
    }
  }

  output.sort((a, b) => a.date.localeCompare(b.date));

  await Deno.writeTextFile(JSON_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nWrote ${output.length} seminars to public/seminars.json`);
  if (!sourceArg) {
    const cancelled = output.filter((s) => s.possiblyCancelled).length;
    if (cancelled) console.log(`  (${cancelled} marked possibly cancelled — not seen in latest scrape)`);
  }
}

main().catch((e) => { console.error(e); Deno.exit(1); });
