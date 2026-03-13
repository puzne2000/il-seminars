export type University =
  | "Hebrew University"
  | "Technion"
  | "Tel Aviv University"
  | "Ben-Gurion University"
  | "Weizmann Institute"
  | "Bar-Ilan University"
  | "University of Haifa";

export type SubjectArea =
  | "Mathematics"
  | "Computer Science"
  | "Physics"
  | "Chemistry"
  | "Biology"
  | "Engineering"
  | "Philosophy"
  | "Economics";

export const universityColorMap: Record<University, string> = {
  "Hebrew University": "bg-university-huji",
  "Technion": "bg-university-technion",
  "Tel Aviv University": "bg-university-tau",
  "Ben-Gurion University": "bg-university-bgu",
  "Weizmann Institute": "bg-university-weizmann",
  "Bar-Ilan University": "bg-university-biu",
  "University of Haifa": "bg-university-haifa",
};

export const universityDotMap: Record<string, string> = {
  "Hebrew University": "bg-university-huji",
  "Technion": "bg-university-technion",
  "Tel Aviv University": "bg-university-tau",
  "Ben-Gurion University": "bg-university-bgu",
  "Weizmann Institute": "bg-university-weizmann",
  "Bar-Ilan University": "bg-university-biu",
  "University of Haifa": "bg-university-haifa",
};

export interface Seminar {
  id: string;
  title: string;
  speaker: string;
  affiliation: string;
  university: string;
  department: string;
  subjectArea: string;
  date: string;
  time: string;
  location: string;
  abstract: string;
  type: string;
  sourceUrl?: string;
}

export const universities: University[] = [
  "Hebrew University",
  "Technion",
  "Tel Aviv University",
  "Ben-Gurion University",
  "Weizmann Institute",
  "Bar-Ilan University",
  "University of Haifa",
];

export const subjectAreas: SubjectArea[] = [
  "Mathematics",
  "Computer Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Engineering",
  "Philosophy",
  "Economics",
];
