import { useQuery } from "@tanstack/react-query";
import type { Seminar } from "@/data/seminars";

export function useSeminars() {
  return useQuery({
    queryKey: ["seminars"],
    queryFn: async (): Promise<Seminar[]> => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const cutoff = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

      const res = await fetch("/seminars.json");
      if (!res.ok) throw new Error(`Failed to load seminars.json: ${res.status}`);
      const all: Seminar[] = await res.json();

      return all
        .filter((s) => s.date >= cutoff)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
