// Standalone scraper — replaces the Supabase edge function.
// Run: deno run --allow-net --allow-read --allow-write --allow-env scraper.ts [source-key]
// Optional source keys: huji-math, technion-cs, weizmann, huji-physics, bgu-pet, bgu-colloquium
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

// ── ICS feed scraper ────────────────────────────────────────────────────────

function unfoldIcs(raw: string): string {
  // RFC 5545: long lines are folded with CRLF + whitespace continuation
  return raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function unescapeIcs(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcsDatetime(dtstart: string): { date: string; time: string } {
  const match = dtstart.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
  if (!match) return { date: "", time: "" };
  const [, year, month, day, hour, min] = match;
  return { date: `${year}-${month}-${day}`, time: `${hour}:${min}` };
}

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
  console.log(`Fetching ICS feed: ${icsUrl}`);
  const response = await fetch(icsUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)" },
  });
  const raw = unfoldIcs(await response.text());
  const today = new Date().toISOString().slice(0, 10);
  const seminars: ScrapedSeminar[] = [];

  const getField = (block: string, name: string): string => {
    const match = block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "m"));
    return match ? match[1].trim() : "";
  };

  for (const block of raw.split("BEGIN:VEVENT").slice(1)) {
    const dtstart = getField(block, "DTSTART");
    const { date, time } = parseIcsDatetime(dtstart);
    if (!date || date < today) continue;

    const summary = unescapeIcs(getField(block, "SUMMARY"));
    const description = unescapeIcs(getField(block, "DESCRIPTION"));
    const locationRaw = unescapeIcs(getField(block, "LOCATION"));
    const uid = getField(block, "UID");
    const sourceUrl = unescapeIcs(getField(block, "URL"));

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
    if (/zoom\.us\/j\//i.test(locationRaw)) {
      zoom_link = locationRaw;
    } else if (locationRaw && !/^https?:\/\//.test(locationRaw)) {
      location = `${opts.default_location}, Room ${locationRaw}`;
    }
    if (!zoom_link) {
      zoom_link = extractZoomLink(description) || extractZoomLink(block);
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
  "bgu-pet": {
    url: "https://www.math.bgu.ac.il/en/research/seminars/bgu-probability-and-ergodic-theory-pet-seminar/meetings.ics",
    scraper: (url) => scrapeIcsFeed(url, {
      university: "Ben-Gurion University",
      department: "Department of Mathematics",
      subject_area: "Mathematics",
      type: "Seminar",
      id_prefix: "bgu-pet",
      default_location: "Department of Mathematics, Ben-Gurion University",
      affiliation: "Ben-Gurion University",
    }),
  },
  "bgu-colloquium": {
    url: "https://www.math.bgu.ac.il/en/research/seminars/colloquium/meetings.ics",
    scraper: (url) => scrapeIcsFeed(url, {
      university: "Ben-Gurion University",
      department: "Department of Mathematics",
      subject_area: "Mathematics",
      type: "Colloquium",
      id_prefix: "bgu-colloquium",
      default_location: "Department of Mathematics, Ben-Gurion University",
      affiliation: "Ben-Gurion University",
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

  const futureFresh = freshRaw.filter((s) => s.date >= today);
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
    // Full scrape: fresh results + carry over existing future entries not found (mark as possibly cancelled)
    const newIds = new Set(futureFresh.map((s) => s.external_id));
    for (const s of futureFresh) output.push(toFrontendSeminar(s));
    for (const s of existing) {
      if (s.date >= today && !newIds.has(s.id)) {
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
