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
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Firecrawl error: ${JSON.stringify(data)}`);
  }

  return data.data?.markdown || data.markdown || "";
}

function parseHujiColloquiums(markdown: string): ScrapedSeminar[] {
  const seminars: ScrapedSeminar[] = [];

  // Match patterns like date lines and event titles from the HUJI calendar
  // The HUJI calendar page lists events with dates, titles, and speaker info
  const lines = markdown.split("\n").filter((l) => l.trim());

  let currentDate = "";
  let currentTitle = "";
  let currentUrl = "";

  for (const line of lines) {
    // Match date patterns like "Thu, 19/03/2026" or "2026-03-19"
    const dateMatch = line.match(
      /(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/
    );
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      currentDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // Match ISO dates
    const isoMatch = line.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      currentDate = isoMatch[0];
    }

    // Match event titles (usually in links or headers)
    const titleMatch = line.match(
      /\[([^\]]+)\]\(([^)]+)\)/
    );
    if (titleMatch) {
      currentTitle = titleMatch[1].trim();
      currentUrl = titleMatch[2].trim();
      if (!currentUrl.startsWith("http")) {
        currentUrl = `https://mathematics.huji.ac.il${currentUrl}`;
      }
    }

    // Match colloquium/seminar keywords
    if (
      currentTitle &&
      currentDate &&
      (currentTitle.toLowerCase().includes("colloquium") ||
        currentTitle.toLowerCase().includes("seminar") ||
        currentTitle.toLowerCase().includes("lecture"))
    ) {
      // Extract speaker name if present in title
      let speaker = "TBA";
      let affiliation = "TBA";
      const speakerMatch = currentTitle.match(
        /(?:Colloquium|Seminar|Lecture)[:\s]+(.+)/i
      );
      if (speakerMatch) {
        speaker = speakerMatch[1].trim();
      }

      const id = `huji-scraped-${currentDate}-${currentTitle
        .substring(0, 20)
        .replace(/\s+/g, "-")
        .toLowerCase()}`;

      seminars.push({
        external_id: id,
        title: currentTitle,
        speaker,
        affiliation,
        university: "Hebrew University",
        department: "Einstein Institute of Mathematics",
        subject_area: "Mathematics",
        date: currentDate,
        time: "14:30",
        location: "Manchester Building, Hall 2",
        abstract: `${currentTitle} at the Einstein Institute of Mathematics, Hebrew University.`,
        type: "Colloquium",
        source_url: currentUrl || undefined,
      });

      // Reset for next event
      currentTitle = "";
      currentUrl = "";
    }
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

    console.log("Starting seminar scrape...");

    // Scrape HUJI Mathematics Colloquiums
    const sources = [
      {
        url: "https://mathematics.huji.ac.il/calendar/eventss/colloquium",
        parser: parseHujiColloquiums,
      },
    ];

    let totalUpserted = 0;

    for (const source of sources) {
      try {
        console.log(`Scraping: ${source.url}`);
        const markdown = await scrapeWithFirecrawl(source.url);
        console.log(`Got ${markdown.length} chars of markdown`);

        const seminars = source.parser(markdown);
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
