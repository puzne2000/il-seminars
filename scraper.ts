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

const MONTH_NAMES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

async function scrapeWeizmann(pageUrl: string): Promise<ScrapedSeminar[]> {
  console.log(`Fetching Weizmann: ${pageUrl}`);
  const response = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)" },
  });
  const html = await response.text();
  const seminars: ScrapedSeminar[] = [];

  // Only include lecture/seminar/colloquium event types — skip conference, workshop, etc.
  const INCLUDED_TYPES = new Set(["lecture", "seminar", "colloquium"]);

  const blocks = html.split(/(?=<li class="views-row )/);

  for (const block of blocks) {
    // Event type (lecture / seminar / conference / etc.)
    const typeMatch = block.match(/<span class="event-type">\s*<span class="([^"]+)">/);
    if (!typeMatch) continue;
    const eventTypeClass = typeMatch[1].toLowerCase();
    if (!INCLUDED_TYPES.has(eventTypeClass)) continue;

    // Individual event ID and URL
    const idMatch = block.match(/\/pages\/event\/(\d+)\/ics/);
    if (!idMatch) continue;
    const eventId = idMatch[1];
    const sourceUrl = `https://www.weizmann.ac.il/pages/event/${eventId}`;

    // Date: day, month+year are in separate spans
    const dayMatch = block.match(/start-date-day[^>]*>[\s\S]*?date-display-single">([\d]+)</);
    const monthYearMatch = block.match(/start-date-month[^>]*>[\s\S]*?date-display-single">([^<]+)</);
    if (!dayMatch || !monthYearMatch) continue;

    const day = dayMatch[1].padStart(2, "0");
    const monthYearStr = monthYearMatch[1].trim(); // e.g. "March 2026"
    const [monthName, yearStr] = monthYearStr.split(" ");
    const month = MONTH_NAMES[monthName.toLowerCase()];
    if (!month || !yearStr) continue;
    const date = `${yearStr}-${month}-${day}`;

    // Time (take start time only)
    const timeMatch = block.match(/event-time-wrapper">\s*([\d]{1,2}:[\d]{2})/);
    const time = timeMatch ? timeMatch[1] : "TBA";

    // H3 event title (seminar series / department label)
    const h3Match = block.match(/event-title-wrapper">([\s\S]*?)<\/h3>/);
    const seriesTitle = h3Match ? h3Match[1].replace(/<[^>]+>/g, "").trim() : "";

    // Talk subtitle (actual talk title) — preferred as the seminar title
    const subtitleMatch = block.match(/views-label-field-subtitle-english[\s\S]*?<div class="field-content">([\s\S]*?)<\/div>/);
    const subtitle = subtitleMatch ? decodeHtml(subtitleMatch[1].replace(/<[^>]+>/g, "").trim()) : "";

    const title = subtitle || seriesTitle;
    if (!title) continue;

    // Location
    const locationMatch = block.match(/event-location-wrapper">([\s\S]*?)<\/div>/);
    const location = locationMatch ? locationMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "Weizmann Institute";

    // Lecturer / Speaker (take text before first <br> or the full td content)
    const lecturerMatch = block.match(/views-label-field-lecturer-english[\s\S]*?<\/th><td>([\s\S]*?)<\/td>/);
    let speaker = "TBA";
    if (lecturerMatch) {
      const raw = lecturerMatch[1].split(/<br\s*\/?>/i)[0];
      speaker = raw.replace(/<[^>]+>/g, "").trim() || "TBA";
    }

    // Abstract
    const abstractMatch = block.match(/event-abstract-wrapper">([\s\S]*?)<\/div>/);
    const abstract = abstractMatch
      ? decodeHtml(abstractMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      : "";

    const type: "Seminar" | "Colloquium" = eventTypeClass === "colloquium" ? "Colloquium" : "Seminar";

    seminars.push({
      external_id: `weizmann-${eventId}`,
      title,
      speaker,
      affiliation: "Weizmann Institute of Science",
      university: "Weizmann Institute",
      department: seriesTitle || "Weizmann Institute of Science",
      subject_area: "Natural Sciences",
      date,
      time,
      location,
      abstract,
      type,
      source_url: sourceUrl,
      zoom_link: extractZoomLink(block),
    });
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
    url: "https://www.weizmann.ac.il/pages/calendar",
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
