import { Search, Video } from "lucide-react";
import { universities, subjectAreas, type University, type SubjectArea } from "@/data/seminars";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedUniversity: University | "All";
  onUniversityChange: (value: University | "All") => void;
  selectedSubject: SubjectArea | "All";
  onSubjectChange: (value: SubjectArea | "All") => void;
  selectedType: "All" | "Seminar" | "Colloquium";
  onTypeChange: (value: "All" | "Seminar" | "Colloquium") => void;
  zoomOnly: boolean;
  onZoomOnlyChange: (value: boolean) => void;
}

const FilterBar = ({
  search,
  onSearchChange,
  selectedUniversity,
  onUniversityChange,
  selectedSubject,
  onSubjectChange,
  selectedType,
  onTypeChange,
  zoomOnly,
  onZoomOnlyChange,
}: FilterBarProps) => {
  return (
    <div className="bg-card rounded-lg shadow-card p-4 sm:p-6 mb-8">
      <div className="flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, speaker, or topic..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-md bg-secondary text-secondary-foreground placeholder:text-muted-foreground text-sm border-0 outline-none focus:ring-2 focus:ring-ring transition-shadow"
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedUniversity}
            onChange={(e) => onUniversityChange(e.target.value as University | "All")}
            className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm border-0 outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <option value="All">All Universities</option>
            {universities.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          <select
            value={selectedSubject}
            onChange={(e) => onSubjectChange(e.target.value as SubjectArea | "All")}
            className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm border-0 outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <option value="All">All Subjects</option>
            {subjectAreas.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as "All" | "Seminar" | "Colloquium")}
            className="px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm border-0 outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <option value="All">All Types</option>
            <option value="Seminar">Seminars</option>
            <option value="Colloquium">Colloquiums</option>
          </select>

          <button
            onClick={() => onZoomOnlyChange(!zoomOnly)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-ring ${
              zoomOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-secondary-foreground border-transparent hover:border-primary/40"
            }`}
          >
            <Video className="w-4 h-4" />
            Has Zoom
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
