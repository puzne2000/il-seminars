import { useEffect } from "react";
import type { Seminar } from "@/data/seminars";

export function useJsonLd(seminars: Seminar[]) {
  useEffect(() => {
    const events = seminars
      .filter((s) => !s.possiblyCancelled)
      .map((s) => ({
        "@type": "Event",
        "name": s.title,
        "startDate": `${s.date}T${s.time}`,
        "location": {
          "@type": "Place",
          "name": s.location,
          "address": s.university,
        },
        "organizer": {
          "@type": "Organization",
          "name": s.department,
        },
        "performer": {
          "@type": "Person",
          "name": s.speaker,
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
