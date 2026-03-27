import { Calendar, Clock, MapPin, User, Video } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import type { Seminar } from "@/data/seminars";
import { universityDotMap } from "@/data/seminars";
import { downloadICS } from "@/utils/ics";

interface SeminarCardProps {
  seminar: Seminar;
  index: number;
}

const SeminarCard = ({ seminar, index }: SeminarCardProps) => {
  const dateObj = parseISO(seminar.date);
  const dotClass = universityDotMap[seminar.university];
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className="group bg-card rounded-lg shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden opacity-0 animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <span className={`w-2.5 h-2.5 rounded-full ${dotClass} shrink-0`} />
            <span className="truncate">{seminar.university}</span>
          </div>
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
            {seminar.type}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display text-lg font-semibold leading-snug mb-2">
          {seminar.sourceUrl ? (
            <a
              href={seminar.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-card-foreground hover:text-accent transition-colors duration-200"
            >
              {seminar.title}
            </a>
          ) : (
            <span className="text-card-foreground group-hover:text-accent transition-colors duration-200">{seminar.title}</span>
          )}
        </h3>

        {/* Speaker */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <User className="w-4 h-4 shrink-0" />
          <span>{seminar.speaker}</span>
          <span className="text-border">·</span>
          <span className="truncate">{seminar.affiliation}</span>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-4">
          <button
            onClick={() => downloadICS(seminar)}
            title="Add to calendar"
            className="flex items-center gap-1.5 hover:text-accent transition-colors duration-200"
          >
            <Calendar className="w-3.5 h-3.5" />
            {format(dateObj, "EEE, MMM d")}
          </button>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {seminar.time}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {/* If location is a non-physical label (currently only "zoom"), make it a clickable link.
              Add other terms (e.g. "online") to the condition if needed. */}
          {seminar.zoomLink && seminar.location.toLowerCase() === "zoom" ? (
              <a
                href={seminar.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:text-accent transition-colors duration-200"
              >
                Zoom
              </a>
            ) : (
              <span className="truncate">{seminar.location}</span>
            )}
          </span>
          {seminar.zoomLink && seminar.location.toLowerCase() !== "zoom" && (
            <a
              href={seminar.zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-accent transition-colors duration-200"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Zoom</span>
            </a>
          )}
        </div>

        {/* Abstract */}
        {seminar.abstract && (
          <p
            className={`text-sm text-muted-foreground leading-relaxed cursor-pointer ${expanded ? "" : "line-clamp-2"}`}
            onClick={() => setExpanded(v => !v)}
          >
            {seminar.abstract}
          </p>
        )}

        {/* Subject badge */}
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-accent">{seminar.subjectArea}</span>
            <span className="text-xs text-border mx-2">·</span>
            <span className="text-xs text-muted-foreground">{seminar.department}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default SeminarCard;
