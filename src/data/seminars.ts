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

export const universityDotMap: Record<University, string> = {
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
  university: University;
  department: string;
  subjectArea: SubjectArea;
  date: string; // ISO
  time: string;
  location: string;
  abstract: string;
  type: "Seminar" | "Colloquium";
}

export const seminars: Seminar[] = [
  {
    id: "1",
    title: "On the Geometry of Moduli Spaces of Sheaves",
    speaker: "Prof. Amnon Yekutieli",
    affiliation: "Ben-Gurion University",
    university: "Ben-Gurion University",
    department: "Department of Mathematics",
    subjectArea: "Mathematics",
    date: "2026-03-12",
    time: "14:00",
    location: "Building 58, Room 101",
    abstract: "We study the derived category of coherent sheaves on smooth projective varieties and explore new geometric invariants arising from deformation quantization.",
    type: "Colloquium",
  },
  {
    id: "2",
    title: "Quantum Error Correction with Topological Codes",
    speaker: "Dr. Netanel Lindner",
    affiliation: "Technion",
    university: "Technion",
    department: "Department of Physics",
    subjectArea: "Physics",
    date: "2026-03-13",
    time: "11:00",
    location: "Lidow Complex, Room 620",
    abstract: "An overview of recent advances in topological quantum error-correcting codes and their potential for fault-tolerant quantum computation.",
    type: "Seminar",
  },
  {
    id: "3",
    title: "Large Language Models and Formal Verification",
    speaker: "Prof. Mooly Sagiv",
    affiliation: "Tel Aviv University",
    university: "Tel Aviv University",
    department: "Blavatnik School of Computer Science",
    subjectArea: "Computer Science",
    date: "2026-03-14",
    time: "12:15",
    location: "Schreiber Building, Room 007",
    abstract: "Can large language models assist in formal software verification? We present preliminary results on using LLMs to generate loop invariants and proof sketches.",
    type: "Seminar",
  },
  {
    id: "4",
    title: "Stochastic Thermodynamics of Biological Networks",
    speaker: "Dr. Neri Merhav",
    affiliation: "Technion",
    university: "Technion",
    department: "Department of Electrical Engineering",
    subjectArea: "Engineering",
    date: "2026-03-15",
    time: "15:30",
    location: "Meyer Building, Room 861",
    abstract: "We explore the thermodynamic costs of information processing in biological signaling networks using tools from stochastic thermodynamics.",
    type: "Colloquium",
  },
  {
    id: "5",
    title: "CRISPR-Based Gene Drives: Ethics and Ecology",
    speaker: "Prof. Adi Stern",
    affiliation: "Tel Aviv University",
    university: "Tel Aviv University",
    department: "School of Molecular Cell Biology",
    subjectArea: "Biology",
    date: "2026-03-16",
    time: "10:00",
    location: "George S. Wise Faculty of Life Sciences, Hall A",
    abstract: "Gene drives have the potential to control disease vectors, but raise profound ecological and ethical questions. We review the current state of the art.",
    type: "Seminar",
  },
  {
    id: "6",
    title: "Algebraic Topology and Data Analysis",
    speaker: "Prof. Tahl Nowik",
    affiliation: "Bar-Ilan University",
    university: "Bar-Ilan University",
    department: "Department of Mathematics",
    subjectArea: "Mathematics",
    date: "2026-03-17",
    time: "14:00",
    location: "Building 216, Room 201",
    abstract: "Persistent homology and topological data analysis provide robust tools for extracting shape information from data. We present new stability results.",
    type: "Colloquium",
  },
  {
    id: "7",
    title: "Behavioral Economics and Climate Policy",
    speaker: "Dr. Ro'i Zultan",
    affiliation: "Ben-Gurion University",
    university: "Ben-Gurion University",
    department: "Department of Economics",
    subjectArea: "Economics",
    date: "2026-03-18",
    time: "12:30",
    location: "Building 72, Room 460",
    abstract: "How do behavioral biases affect public support for climate policies? We present results from a series of large-scale experiments.",
    type: "Seminar",
  },
  {
    id: "8",
    title: "Ultrafast Spectroscopy of Perovskite Nanocrystals",
    speaker: "Prof. Dan Oron",
    affiliation: "Weizmann Institute",
    university: "Weizmann Institute",
    department: "Department of Physics of Complex Systems",
    subjectArea: "Chemistry",
    date: "2026-03-19",
    time: "11:00",
    location: "Perlman Building, Lecture Hall",
    abstract: "We use ultrafast optical spectroscopy to probe exciton dynamics in lead halide perovskite nanocrystals with implications for next-generation solar cells.",
    type: "Colloquium",
  },
  {
    id: "9",
    title: "Philosophy of Mind in the Age of AI",
    speaker: "Prof. Oron Shagrir",
    affiliation: "Hebrew University",
    university: "Hebrew University",
    department: "Department of Philosophy",
    subjectArea: "Philosophy",
    date: "2026-03-20",
    time: "16:00",
    location: "Mount Scopus, Humanities Building, Room 4609",
    abstract: "Does the success of modern AI systems shed new light on classical debates in philosophy of mind? We argue that functionalism requires revision.",
    type: "Seminar",
  },
  {
    id: "10",
    title: "Marine Ecology of the Eastern Mediterranean",
    speaker: "Dr. Gil Rilov",
    affiliation: "University of Haifa",
    university: "University of Haifa",
    department: "Leon H. Charney School of Marine Sciences",
    subjectArea: "Biology",
    date: "2026-03-21",
    time: "13:00",
    location: "Multi-Purpose Building, Room 130",
    abstract: "The Eastern Mediterranean is undergoing rapid tropicalization. We present long-term data on species shifts and ecosystem impacts.",
    type: "Seminar",
  },
  {
    id: "11",
    title: "Cryptographic Protocols for Secure Computation",
    speaker: "Prof. Yuval Ishai",
    affiliation: "Technion",
    university: "Technion",
    department: "Department of Computer Science",
    subjectArea: "Computer Science",
    date: "2026-03-22",
    time: "14:30",
    location: "Taub Building, Room 601",
    abstract: "We present new constructions of secure multi-party computation protocols with improved communication complexity.",
    type: "Colloquium",
  },
  {
    id: "12",
    title: "Number Theory and Random Matrices",
    speaker: "Prof. Zeev Rudnick",
    affiliation: "Tel Aviv University",
    university: "Tel Aviv University",
    department: "School of Mathematical Sciences",
    subjectArea: "Mathematics",
    date: "2026-03-23",
    time: "11:00",
    location: "Schreiber Building, Room 309",
    abstract: "Connections between the statistics of zeros of L-functions and eigenvalues of random matrices continue to yield surprising insights.",
    type: "Seminar",
  },
];

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
