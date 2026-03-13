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

function decodeHtml(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

async function scrapeTechnionCS(pageUrl: string): Promise<ScrapedSeminar[]> {
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
    const cols = [...block.matchAll(/class='ev_r_col'>([\s\S]*?)<\/div>/g)]
      .map(m => decodeHtml(m[1].replace(/<[^>]+>/g, "")));

    // Find the date column (contains day.month.year pattern)
    const dateColIdx = cols.findIndex(c => /\d{1,2}\.\d{1,2}\.\d{4}/.test(c));
    if (dateColIdx === -1) continue;

    const dateRaw = cols[dateColIdx];
    const speaker = cols[dateColIdx - 1] || "TBA";
    const location = cols[dateColIdx + 1] || "Taub Building";

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
      abstract: abstract || `${title} - Talk at the Taub Faculty of Computer Science, Technion.`,
      type: "Seminar",
      source_url: pageUrl,
    });
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

    const directSources = [
      {
        url: "https://mathematics.huji.ac.il/eventss/events-seminars",
        scraper: scrapeHujiColloquiums,
      },
      {
        url: "https://www.cs.technion.ac.il/events/",
        scraper: scrapeTechnionCS,
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
