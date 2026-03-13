import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  last_scraped_at: string;
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

async function scrapeHujiColloquiums(pageUrl: string): Promise<ScrapedSeminar[]> {
  const response = await fetch(pageUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; seminar-scraper/1.0)" },
  });
  const html = await response.text();
  const seminars: ScrapedSeminar[] = [];

  // Each event is an <h2><a href="URL">Title</a></h2> followed by a date span
  const eventPattern = /<h2[^>]*>\s*<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>\s*<\/h2>[\s\S]*?date-display-single">(.*?)</g;
  let match;

  while ((match = eventPattern.exec(html)) !== null) {
    const [, href, rawTitle, rawDate] = match;
    const title = rawTitle.replace(/<[^>]+>/g, "").trim();
    const dateRaw = rawDate.trim(); // e.g. "Thu, 26/03/2026"

    if (!title || !dateRaw) continue;

    // Parse date "Thu, 26/03/2026" or "Thu, 26/03/2026 - 14:30"
    const dateMatch = dateRaw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!dateMatch) continue;
    const [, day, month, year] = dateMatch;
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    // Time may appear in the date string
    const timeMatch = dateRaw.match(/(\d{1,2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : "14:30";

    // Speaker and affiliation from title pattern "Colloquium: Name (Institution)"
    let speaker = "TBA";
    let affiliation = "TBA";
    const speakerMatch = title.match(/(?:Colloquium|Seminar|Lecture)[:\s]+(.+)/i);
    if (speakerMatch) {
      const speakerPart = speakerMatch[1].trim();
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
      abstract: `${title} at the Einstein Institute of Mathematics, Hebrew University.`,
      type: "Colloquium",
      source_url: sourceUrl,
    });
  }

  return seminars;
}

function parseTechnionCS(markdown: string, pageUrl: string): ScrapedSeminar[] {
  const seminars: ScrapedSeminar[] = [];
  const lines = markdown.split("\n");

  // The page has a "Past Events" section we want to skip
  const pastIndex = lines.findIndex((l) => /^##\s*Past Events/i.test(l.trim()));
  const relevantLines = pastIndex > -1 ? lines.slice(0, pastIndex) : lines;

  let i = 0;
  while (i < relevantLines.length) {
    const line = relevantLines[i].trim();

    // Skip navigation, images, empty lines, year links, and known UI text
    const isNavText = /^(Events|Seminars|Home|Menu|Search|About|Contact|News|Calendar|Archive|Filter|Sort|Back|Next|Previous|Page)$/i.test(line);
    if (!line || isNavText || line.startsWith("![") || line.startsWith("[") || line.startsWith("#") || line.startsWith("-") || line.startsWith("\\[") || line.startsWith("[![")) {
      i++;
      continue;
    }

    // Potential title line - look ahead for speaker/date/location pattern
    const title = line;

    // Search ahead for date pattern within next 10 lines
    let speaker = "";
    let dateStr = "";
    let timeStr = "";
    let location = "";
    let abstract = "";
    let sourceUrl = "";
    let found = false;

    for (let j = i + 1; j < Math.min(i + 15, relevantLines.length); j++) {
      const ahead = relevantLines[j].trim();

      // Date line: "Wednesday, 18.03.2026, 14:00"
      const dateLineMatch = ahead.match(
        /(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),?\s+(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s+(\d{1,2}:\d{2})/i
      );
      if (dateLineMatch) {
        const [, day, month, year, time] = dateLineMatch;
        dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        timeStr = time;
        found = true;
        continue;
      }

      // Speaker line (non-empty, not an image, not a date, before location)
      if (!ahead.startsWith("![") && !ahead.startsWith("[") && !ahead.startsWith("\\[") && ahead.length > 2 && ahead.length < 100 && !speaker && !dateStr) {
        speaker = ahead;
        // Extract affiliation in parentheses
        const affMatch = speaker.match(/\(([^)]+)\)/);
        if (affMatch) {
          speaker = speaker.replace(/\s*\([^)]+\)/, "").trim();
        }
        continue;
      }

      // Location line (after date was found, non-empty text)
      if (found && !location && !ahead.startsWith("![") && ahead.length > 1 && ahead.length < 150) {
        // Could be location with Zoom link
        location = ahead.replace(/\[Zoom\]\([^)]+\)/g, "& Zoom").replace(/[[\]]/g, "").trim();
        continue;
      }

      // Abstract (longer text after location)
      if (found && location && !ahead.startsWith("![") && !ahead.startsWith("\\[") && ahead.length > 50) {
        abstract = ahead;
        continue;
      }

      // Source URL
      const urlMatch = ahead.match(/\[Full version\]\(([^)]+)\)/);
      if (urlMatch) {
        sourceUrl = urlMatch[1];
        break;
      }
    }

    if (found && dateStr && title.length > 5 && title.length < 200) {
      const id = `technion-cs-${dateStr}-${title
        .substring(0, 30)
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9-]/g, "")
        .toLowerCase()}`;

      seminars.push({
        external_id: id,
        title,
        speaker: speaker || "TBA",
        affiliation: "Technion",
        university: "Technion",
        department: "Taub Faculty of Computer Science",
        subject_area: "Computer Science",
        date: dateStr,
        time: timeStr || "12:00",
        location: location || "Taub Building",
        abstract: abstract || `${title} - Talk at the Taub Faculty of Computer Science, Technion.`,
        type: "Seminar",
        source_url: sourceUrl ? (sourceUrl.startsWith("http") ? sourceUrl : `https://www.cs.technion.ac.il${sourceUrl.startsWith("/") ? "" : "/"}${sourceUrl}`) : pageUrl,
      });
    }

    i++;
  }

  return seminars;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const scrapeTime = new Date().toISOString();

    console.log("Starting seminar scrape...");

    const firecrawlSources = [
      {
        url: "https://www.cs.technion.ac.il/events/",
        parser: parseTechnionCS,
      },
    ];

    const directSources = [
      {
        url: "https://mathematics.huji.ac.il/calendar/eventss/colloquium",
        scraper: scrapeHujiColloquiums,
      },
    ];

    let totalUpserted = 0;

    // Direct HTML sources
    for (const source of directSources) {
      try {
        console.log(`Scraping (direct): ${source.url}`);
        const seminars = (await source.scraper(source.url)).map((s) => ({ ...s, last_scraped_at: scrapeTime }));
        console.log(`Parsed ${seminars.length} seminars`);

        if (seminars.length > 0) {
          const { error } = await supabase
            .from("seminars")
            .upsert(seminars, { onConflict: "external_id" });

          if (error) {
            console.error(`Error upserting seminars:`, error);
          } else {
            totalUpserted += seminars.length;
          }
        }
      } catch (err) {
        console.error(`Error scraping ${source.url}:`, err);
      }
    }

    // Firecrawl sources
    for (const source of firecrawlSources) {
      try {
        console.log(`Scraping (firecrawl): ${source.url}`);
        const markdown = await scrapeWithFirecrawl(source.url);
        console.log(`Got ${markdown.length} chars of markdown`);

        const seminars = source.parser(markdown, source.url).map((s) => ({ ...s, last_scraped_at: scrapeTime }));
        console.log(`Parsed ${seminars.length} seminars`);

        if (seminars.length > 0) {
          const { error } = await supabase
            .from("seminars")
            .upsert(seminars, { onConflict: "external_id" });

          if (error) {
            console.error(`Error upserting seminars:`, error);
          } else {
            totalUpserted += seminars.length;
          }
        }
      } catch (err) {
        console.error(`Error scraping ${source.url}:`, err);
      }
    }

    // Delete seminars not seen by the scraper in over a week
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: deleteError, count: deleteCount } = await supabase
      .from("seminars")
      .delete({ count: "exact" })
      .lt("last_scraped_at", cutoff)
      .not("last_scraped_at", "is", null);

    if (deleteError) {
      console.error("Error deleting stale seminars:", deleteError);
    } else {
      console.log(`Deleted ${deleteCount ?? 0} stale seminars.`);
    }

    console.log(`Scrape complete. Upserted ${totalUpserted} seminars.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scraped and upserted ${totalUpserted} seminars`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
