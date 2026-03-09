import { useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";
import FilterBar from "@/components/FilterBar";
import SeminarCard from "@/components/SeminarCard";
import { seminars, type University, type SubjectArea } from "@/data/seminars";

const Index = () => {
  const [search, setSearch] = useState("");
  const [university, setUniversity] = useState<University | "All">("All");
  const [subject, setSubject] = useState<SubjectArea | "All">("All");
  const [type, setType] = useState<"All" | "Seminar" | "Colloquium">("All");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return seminars.filter((s) => {
      if (university !== "All" && s.university !== university) return false;
      if (subject !== "All" && s.subjectArea !== subject) return false;
      if (type !== "All" && s.type !== type) return false;
      if (q && !s.title.toLowerCase().includes(q) && !s.speaker.toLowerCase().includes(q) && !s.abstract.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, university, subject, type]);

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
        />

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-6">
          {filtered.length} {filtered.length === 1 ? "event" : "events"} found
        </p>

        {filtered.length === 0 ? (
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
