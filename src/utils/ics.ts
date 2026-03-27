import type { Seminar } from "@/data/seminars";

function escapeICS(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export function downloadICS(seminar: Seminar): void {
  const [year, month, day] = seminar.date.split("-");
  const timeMatch = seminar.time.match(/(\d{1,2}):(\d{2})/);

  let dtStart: string;
  let dtEnd: string;

  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, "0");
    const mm = timeMatch[2];
    const endH = String(parseInt(timeMatch[1]) + 1).padStart(2, "0");
    dtStart = `DTSTART;TZID=Asia/Jerusalem:${year}${month}${day}T${hh}${mm}00`;
    dtEnd = `DTEND;TZID=Asia/Jerusalem:${year}${month}${day}T${endH}${mm}00`;
  } else {
    dtStart = `DTSTART;VALUE=DATE:${year}${month}${day}`;
    dtEnd = `DTEND;VALUE=DATE:${year}${month}${day}`;
  }

  const descParts: string[] = [
    `Speaker: ${seminar.speaker}`,
    seminar.affiliation ? `Affiliation: ${seminar.affiliation}` : "",
    seminar.location ? `Location: ${seminar.location}` : "",
    seminar.zoomLink ? `Zoom: ${seminar.zoomLink}` : "",
    seminar.abstract ? `\nAbstract: ${seminar.abstract}` : "",
    seminar.sourceUrl ? `\nMore info: ${seminar.sourceUrl}` : "",
  ].filter(Boolean);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//il-seminars//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${seminar.id}@il-seminars`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeICS(seminar.title)}`,
    `DESCRIPTION:${escapeICS(descParts.join("\n"))}`,
    `LOCATION:${escapeICS(seminar.location)}`,
    seminar.sourceUrl ? `URL:${seminar.sourceUrl}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((l) => l !== "")
    .join("\r\n");

  const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${seminar.date}-${seminar.title.slice(0, 40).replace(/[^a-zA-Z0-9]+/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
