import { useMemo, useState } from "react";
import { GraduationCap, RefreshCw, Github, PlusCircle } from "lucide-react";
import FilterBar from "@/components/FilterBar";
import SeminarCard from "@/components/SeminarCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeminars } from "@/hooks/useSeminars";
import type { University, SubjectArea } from "@/data/seminars";

const Index = () => {
  const [search, setSearch] = useState("");
  const [university, setUniversity] = useState<University | "All">("All");
  const [subject, setSubject] = useState<SubjectArea | "All">("All");
  const [type, setType] = useState<"All" | "Seminar" | "Colloquium">("All");
  const [zoomOnly, setZoomOnly] = useState(false);

  const { data: seminars = [], isLoading, error } = useSeminars();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return seminars.filter((s) => {
      if (university !== "All" && s.university !== university) return false;
      if (subject !== "All" && s.subjectArea !== subject) return false;
      if (type !== "All" && s.type !== type) return false;
      if (zoomOnly && !s.zoomLink) return false;
      if (q && !s.title.toLowerCase().includes(q) && !s.speaker.toLowerCase().includes(q) && !s.abstract.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, university, subject, type, zoomOnly, seminars]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="bg-primary text-primary-foreground">
        <div className="container max-w-5xl py-16 sm:py-20 text-center">
          <div className="flex justify-center mb-4">
            <GraduationCap className="w-10 h-10 text-accent" />
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Israeli Academic Seminars
          </h1>
          <p className="text-primary-foreground/70 max-w-xl mx-auto text-base sm:text-lg">
            Discover seminars and colloquiums across Israel's leading universities — all in one place.
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <a
              href="https://github.com/puzne2000/il-seminars/issues/new?title=Add+seminar+source%3A+&body=**University%2FInstitution:**%0A%0A**Department%2FSeries+name:**%0A%0A**URL:**%0A%0A**Notes:**"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary-foreground/10 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Suggest a seminar series
            </a>
            <a
              href="https://github.com/puzne2000/il-seminars"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary-foreground/10 text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-5xl py-8 sm:py-12">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          selectedUniversity={university}
          onUniversityChange={setUniversity}
          selectedSubject={subject}
          onSubjectChange={setSubject}
          selectedType={type}
          onTypeChange={setType}
          zoomOnly={zoomOnly}
          onZoomOnlyChange={setZoomOnly}
        />

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-6">
          {isLoading ? "Loading..." : `${filtered.length} ${filtered.length === 1 ? "event" : "events"} found`}
        </p>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Failed to load seminars. Please try again later.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No seminars match your filters.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {filtered.map((seminar, i) => (
              <SeminarCard key={seminar.id} seminar={seminar} index={i} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container max-w-5xl text-center text-sm text-muted-foreground">
          Israeli Academic Seminars — Aggregating knowledge across universities
        </div>
      </footer>
    </div>
  );
};

export default Index;
