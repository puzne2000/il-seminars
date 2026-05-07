import { useEffect } from "react";
import type { Seminar } from "@/data/seminars";

const universityUrls: Record<string, string> = {
  "Hebrew University": "https://www.huji.ac.il",
  "Technion": "https://www.technion.ac.il",
  "Tel Aviv University": "https://www.tau.ac.il",
  "Ben-Gurion University": "https://www.bgu.ac.il",
  "Weizmann Institute": "https://www.weizmann.ac.il",
  "Bar-Ilan University": "https://www.biu.ac.il",
  "University of Haifa": "https://www.haifa.ac.il",
};

function addOneHour(date: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const endH = (h + 1) % 24;
  return `${date}T${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function useJsonLd(seminars: Seminar[]) {
  useEffect(() => {
    const events = seminars
      .filter((s) => !s.possiblyCancelled)
      .map((s) => ({
        "@type": "Event",
        "name": s.title,
        "startDate": `${s.date}T${s.time}`,
        "endDate": addOneHour(s.date, s.time),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": s.zoomLink
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": s.location,
          "address": s.university,
        },
        "organizer": {
          "@type": "Organization",
          "name": s.department,
          ...(universityUrls[s.university] ? { "url": universityUrls[s.university] } : {}),
        },
        "performer": {
          "@type": "Person",
          "name": s.speaker,
        },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "ILS",
          "availability": "https://schema.org/InStock",
        },
        ...(s.abstract ? { "description": s.abstract } : {}),
        ...(s.sourceUrl ? { "url": s.sourceUrl } : {}),
      }));

    const schema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "Upcoming Israeli Academic Seminars",
      "itemListElement": events,
    };

    let script = document.getElementById("json-ld-seminars") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "json-ld-seminars";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);

    return () => {
      document.getElementById("json-ld-seminars")?.remove();
    };
  }, [seminars]);
}
