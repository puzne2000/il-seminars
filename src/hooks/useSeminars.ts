import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Seminar } from "@/data/seminars";

export function useSeminars() {
  return useQuery({
    queryKey: ["seminars"],
    queryFn: async (): Promise<Seminar[]> => {
      const { data, error } = await supabase
        .from("seminars")
        .select("*")
        .order("date", { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        speaker: row.speaker,
        affiliation: row.affiliation,
        university: row.university,
        department: row.department,
        subjectArea: row.subject_area,
        date: row.date,
        time: row.time,
        location: row.location,
        abstract: row.abstract || "",
        type: row.type,
        sourceUrl: row.source_url || undefined,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
