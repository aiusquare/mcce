import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Filter,
  Eye,
  Edit,
  Users,
  GraduationCap,
  BookOpen,
  CreditCard,
  MoreHorizontal,
  Mail,
  Phone,
  MapPin,
  Calendar,
  UserPlus,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

interface Student {
  id: string;
  userId?: string | null;
  matricNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  program: string;
  programmeId: string;
  department: string;
  departmentId: string;
  level: string;
  sessionName: string;
  enrollmentDate: string;
  status: "active" | "inactive" | "suspended" | "graduated";
  gpa?: number | null;
  feesStatus?: "paid" | "partial" | "unpaid" | null;
  avatar?: string;
  onboardingSource?: string | null;
  profileCompletionStatus?: string | null;
  accountUpdateRequired?: boolean;
}
type StudentApi = {
  id?: string;
  user_id?: string | null;
  programme_id?: string | null;
  department_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  programme_name?: string | null;
  department_name?: string | null;
  current_level?: string | null;
  session_name?: string | null;
  status?: string | null;
  matric_number?: string | null;
  admission_number?: string | null;
  enrollment_date?: string | null;
  gpa?: number | null;
  fees_status?: string | null;
  onboarding_source?: string | null;
  profile_completion_status?: string | null;
  account_update_required?: boolean | number | string | null;
  gender?: string | null;
  dob?: string | null;
  nin?: string | null;
  address?: string | null;
  state?: string | null;
  lga?: string | null;
  entry_mode?: string | null;
};

type StudentFilterOption = {
  id: string;
  name: string;
  code?: string | null;
  department_id?: string | null;
};

type StudentPagination = {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  from: number;
  to: number;
};

type StudentListMeta = {
  summary?: {
    counts?: Record<string, number>;
    programme_count?: number;
    average_gpa?: number | null;
  };
  pagination?: Partial<StudentPagination>;
  filter_options?: {
    departments?: StudentFilterOption[];
    programmes?: StudentFilterOption[];
    levels?: string[];
    sessions?: string[];
  };
};

const EMPTY_STUDENT_META: StudentPagination = {
  page: 1,
  per_page: 25,
  total: 0,
  total_pages: 1,
  from: 0,
  to: 0,
};

type OLevelSubject = {
  subject?: string | null;
  grade?: string | null;
};

type StudentProfileApi = {
  id?: string | null;
  student_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  nin?: string | null;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  state?: string | null;
  lga?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
  guardian_address?: string | null;
  next_of_kin?: string | null;
  next_of_kin_phone?: string | null;
  session?: string | null;
  entry_mode?: string | null;
  current_level?: string | null;
  student_status?: string | null;
  programme_name?: string | null;
  department_name?: string | null;
  admission_number?: string | null;
  matric_number?: string | null;
  application_no?: string | null;
  onboarding_source?: string | null;
  profile_completion_status?: string | null;
  account_update_required?: boolean | number | string | null;
  education?: {
    primarySchool?: string | null;
    primaryYear?: string | null;
    secondarySchool?: string | null;
    secondaryYear?: string | null;
  } | null;
  academic?: {
    qualification?: string | null;
    graduationYear?: string | null;
    examNumber?: string | null;
    examCenter?: string | null;
    examYear?: string | null;
    qualification2?: string | null;
    examNumber2?: string | null;
    examCenter2?: string | null;
    examYear2?: string | null;
  } | null;
  oLevel?: {
    firstSitting?: OLevelSubject[] | null;
    secondSitting?: OLevelSubject[] | null;
  } | null;
};

type BulkStudentPreviewRow = {
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
};

type ProgrammeReference = {
  name?: string | null;
  code?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  programme_structure?: string | null;
  duration_years?: number | string | null;
  is_active?: boolean | number | string | null;
};

const BULK_STUDENT_TEMPLATE_COLUMNS = [
  "first_name",
  "last_name",
  "other_name",
  "email",
  "phone_number",
  "admission_number",
  "matric_number",
  "department",
  "programme",
  "level_of_admission",
  "current_level",
  "session_of_entry",
  "entry_mode",
  "status",
  "temporary_password",
  "gender",
  "dob",
  "nin",
  "address",
  "state",
  "lga",
  "programme_reference",
  "reference_department",
  "reference_code",
  "reference_structure",
  "reference_duration_years",
];

const REQUIRED_BULK_STUDENT_FIELDS = [
  {
    key: "first_name",
    label: "first name",
    aliases: ["first_name", "firstname", "full_name"],
  },
  {
    key: "last_name",
    label: "last name",
    aliases: ["last_name", "lastname", "surname", "full_name"],
  },
  { key: "email", label: "email", aliases: ["email"] },
  { key: "department", label: "department", aliases: ["department"] },
  { key: "programme", label: "programme", aliases: ["programme", "program"] },
  {
    key: "level_of_admission",
    label: "level of admission",
    aliases: ["level_of_admission", "current_level", "entry_level", "level"],
  },
  {
    key: "session_of_entry",
    label: "session of entry",
    aliases: [
      "session_of_entry",
      "session",
      "academic_session",
      "entry_session",
    ],
  },
];

const normalizeCsvHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const csvEscape = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const extractApiArray = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload.filter(Boolean) as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data.filter(Boolean) as T[];
  }
  return [];
};

const resolveBulkStudentName = (values: Record<string, string>) => {
  const directFullName =
    values.full_name || values.name || values.student_name || "";
  const first = values.first_name || values.firstname || "";
  const other =
    values.other_name ||
    values.other_names ||
    values.middle_name ||
    values.middlename ||
    "";
  const last = values.last_name || values.lastname || values.surname || "";
  const combined = [first, other, last].filter(Boolean).join(" ").trim();
  return combined || directFullName;
};

const applyBulkStudentNameAliases = (values: Record<string, string>) => {
  if ((!values.first_name || !values.last_name) && values.full_name) {
    const parts = values.full_name.trim().split(/\s+/).filter(Boolean);
    if (!values.first_name) {
      values.first_name = parts[0] || "";
    }
    if (!values.last_name) {
      values.last_name = parts.length > 1 ? parts[parts.length - 1] : "";
    }
    if (!values.other_name && parts.length > 2) {
      values.other_name = parts.slice(1, -1).join(" ");
    }
  }
  if (!values.full_name) {
    values.full_name = resolveBulkStudentName(values);
  }
};

const parseCsv = (csv: string) => {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }
    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  return rows;
};

const buildBulkStudentTemplateCsv = (programmes: ProgrammeReference[] = []) => {
  const activeProgrammes = programmes.filter((programme) => {
    const status = programme.is_active;
    if (status === undefined || status === null || status === "") return true;
    if (typeof status === "boolean") return status;
    return ["1", "true", "yes", "active"].includes(
      String(status).toLowerCase(),
    );
  });
  const references =
    activeProgrammes.length > 0 ? activeProgrammes : programmes;
  const exampleProgramme = references[0];
  const rows = [
    BULK_STUDENT_TEMPLATE_COLUMNS,
    [
      "Amina",
      "Sani",
      "",
      "amina.sani@example.com",
      '="08012345670"',
      "ADM-2026-001",
      "MCCAS/2026/001",
      exampleProgramme?.department_name || "Arts and Islamic Studies",
      exampleProgramme?.name || "B.A Hausa",
      "200",
      "200",
      "2026/2027",
      "Direct Entry",
      "active",
      "ChangeMe123!",
      "Female",
      "2002-05-14",
      "12345678901",
      "No 10 Main Street",
      "Kano",
      "Nassarawa",
      exampleProgramme?.name || "",
      exampleProgramme?.department_name || "",
      exampleProgramme?.code || "",
      exampleProgramme?.programme_structure || "",
      exampleProgramme?.duration_years
        ? String(exampleProgramme?.duration_years)
        : "",
    ],
    ...references
      .slice(1)
      .map((programme) => [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        programme.department_name || "",
        programme.name || "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        programme.name || "",
        programme.department_name || "",
        programme.code || "",
        programme.programme_structure || "",
        programme.duration_years ? String(programme.duration_years) : "",
      ]),
  ];

  return rows
    .map((row) => row.map((value) => csvEscape(String(value ?? ""))).join(","))
    .join("\n");
};

const FEMALE_NAMES = new Set([
  "aisha", "aishat", "aishatu", "amina", "aminat", "aminatu", "asiya", "asiyatu",
  "asma", "asmau", "asma'u", "balkisu", "bilkisu", "binta", "fadima", "fadimatu",
  "fati", "fatima", "fatimah", "fatimatu", "fauziya", "fauziyya", "habiba", "habibatu",
  "hadiza", "hadizatu", "hafsa", "hafsat", "halima", "halimatu", "hasana", "hassana",
  "hauwa", "hauwa'u", "hauwau", "husaina", "hussaina", "jamila", "jamilatu", "jummai",
  "khadija", "khadijah", "kubra", "kulu", "laraba", "laure", "lubabatu", "maimuna",
  "maimunatu", "mansura", "maryam", "maryama", "murja", "nafisa", "nafisatu",
  "naja'atu", "najaatu", "rabi", "rabia", "rabi'a", "rabi'atu", "rabiatu",
  "rahama", "rahamatu", "rukayya", "rukayyat", "ruqayya", "ruqayyat",
  "sadiya", "sadiyatu", "safiya", "safiyatu", "sakina", "sakinatu", "salma",
  "samira", "saratu", "saudat", "shafa", "shafa'atu", "shafaatu", "sumayya", "sumayyatu",
  "umma", "ummi", "zahra", "zahra'u", "zahrau", "zainab", "zainabu", "zulaiha", "zulaihat",
  "mary", "grace", "faith", "mercy", "blessing", "patience", "esther", "joy", "peace", "comfort", "sarah", "ruth"
]);

const inferStudentGender = (firstName: string, rawGender?: string | null): string => {
  if (rawGender) {
    const g = rawGender.trim().toLowerCase();
    if (g.startsWith("f")) return "Female";
    if (g.startsWith("m")) return "Male";
  }
  const cleanFirst = (firstName || "")
    .toLowerCase()
    .replace(/[^a-z']/g, "")
    .trim();
  if (FEMALE_NAMES.has(cleanFirst) || FEMALE_NAMES.has(cleanFirst.replace(/'/g, ""))) {
    return "Female";
  }
  return "Male";
};

const extractStartYear = (sessionOrMatric?: string | null): number | null => {
  const raw = String(sessionOrMatric || "").trim();
  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return Number(yearMatch[1]);
  }
  const matricMatch = raw.match(/\/(\d{2})\//);
  if (matricMatch) {
    const endYear = 2000 + Number(matricMatch[1]);
    return endYear - 1;
  }
  return null;
};

const resolveEntryBaseLevel = (
  entryMode?: string | null,
  rawLevel?: string | null,
  matricNumber?: string | null,
): 1 | 2 => {
  const modeLower = String(entryMode || "").trim().toLowerCase();
  if (["fresh", "utme", "regular", "100"].includes(modeLower)) {
    return 1;
  }

  const levelLower = String(rawLevel || "").trim().toLowerCase();
  if (
    [
      "contact 1",
      "contact1",
      "contact-one",
      "contact one",
      "100",
      "100 level",
      "year 1",
      "1",
    ].includes(levelLower)
  ) {
    return 1;
  }
  if (
    [
      "contact 2",
      "contact2",
      "contact-two",
      "contact two",
      "200",
      "200 level",
      "year 2",
      "2",
    ].includes(levelLower)
  ) {
    return 2;
  }

  const matric = String(matricNumber || "").trim();
  if (/\/\d{2}\/10\d{3}$/.test(matric)) {
    return 1;
  }
  if (/\/\d{2}\/20\d{3}$/.test(matric)) {
    return 2;
  }

  if (modeLower.includes("direct") || modeLower === "de") {
    return 2;
  }

  return 1;
};

const computeCanonicalStudentLevel = ({
  entrySession,
  activeSession,
  entryMode,
  rawLevel,
  matricNumber,
  programmeStructure,
  durationYears,
}: {
  entrySession?: string | null;
  activeSession?: string | null;
  entryMode?: string | null;
  rawLevel?: string | null;
  matricNumber?: string | null;
  programmeStructure?: string | null;
  durationYears?: number | string | null;
}): string => {
  const base = resolveEntryBaseLevel(entryMode, rawLevel, matricNumber);
  const entryYear =
    extractStartYear(entrySession) ?? extractStartYear(matricNumber);
  const activeYear = extractStartYear(activeSession);
  const offset =
    entryYear !== null && activeYear !== null
      ? Math.max(0, activeYear - entryYear)
      : 0;
  const step = base + offset;

  const rawLvl = String(rawLevel || "").trim().toLowerCase();
  const struct = String(programmeStructure || "").trim().toLowerCase();
  const isContact =
    struct === "contact" ||
    struct === "contact_based" ||
    rawLvl.includes("contact") ||
    (!struct && !/^\d{3}$/.test(rawLvl));

  if (isContact) {
    return `Contact ${Math.min(6, Math.max(1, step))}`;
  }

  const maxYears = Number(durationYears) > 0 ? Number(durationYears) : 4;
  return String(Math.min(maxYears, Math.max(1, step)) * 100);
};

const buildExportStudentsCsv = (
  students: StudentApi[],
  programmes: ProgrammeReference[] = [],
  activeSessionName = "2025/2026",
) => {
  const activeProgrammes = programmes.filter((programme) => {
    const status = programme.is_active;
    if (status === undefined || status === null || status === "") return true;
    if (typeof status === "boolean") return status;
    return ["1", "true", "yes", "active"].includes(
      String(status).toLowerCase(),
    );
  });
  const references =
    activeProgrammes.length > 0 ? activeProgrammes : programmes;
  const maxRows = Math.max(students.length, references.length);

  // Pre-index programmes for quick lookup by name
  const progMap = new Map<string, ProgrammeReference>();
  references.forEach((p) => {
    if (p.name) progMap.set(p.name.trim().toLowerCase(), p);
  });

  const rows: string[][] = [BULK_STUDENT_TEMPLATE_COLUMNS];

  for (let i = 0; i < maxRows; i++) {
    const student = students[i];

    // Reference programme: list distinct reference programmes first,
    // then match each student's programme or cycle so columns V-Z are never blank
    let prog = references[i];
    if (!prog && student) {
      if (student.programme_name && progMap.has(student.programme_name.trim().toLowerCase())) {
        prog = progMap.get(student.programme_name.trim().toLowerCase());
      } else if (references.length > 0) {
        prog = references[i % references.length];
      }
    }

    let studentCols: string[] = [];
    if (student) {
      const cleanName = (student.full_name || "")
        .replace(/[\uFFFD]/g, "'")
        .replace(/[’‘`]/g, "'")
        .trim();
      const parts = cleanName.split(/\s+/).filter(Boolean);
      const firstName = parts[0] || "";
      const lastName =
        parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
      const otherName =
        parts.length > 2 ? parts.slice(1, -1).join(" ") : "";

      const rawStatus = (student.status || "").toLowerCase();
      const status =
        rawStatus === "approved" || rawStatus === "admitted"
          ? "active"
          : rawStatus || "active";

      const gender = inferStudentGender(firstName, student.gender);
      const dob = student.dob || "2000-01-01";
      const nin =
        student.nin ||
        (student.phone && student.phone.replace(/\D/g, "").length === 11
          ? student.phone.replace(/\D/g, "")
          : String(20260000001 + i));
      const address = student.address || "Funtua, Katsina State";
      const state = student.state || "Katsina";
      const lga = student.lga || "Funtua";
      const sessionOfEntry =
        student.session_name || (student as any).session || "2021/2022";
      const matricNo = student.matric_number || student.admission_number || "";
      const matchedProg =
        student.programme_name &&
        progMap.has(student.programme_name.trim().toLowerCase())
          ? progMap.get(student.programme_name.trim().toLowerCase())
          : undefined;
      const entryBase = resolveEntryBaseLevel(
        student.entry_mode,
        student.current_level,
        matricNo,
      );
      const canonicalMode = entryBase === 2 ? "Direct Entry" : "Fresh";
      const isContactProg =
        !matchedProg ||
        matchedProg.programme_structure === "contact" ||
        matchedProg.programme_structure === "contact_based" ||
        String(student.current_level || "")
          .toLowerCase()
          .includes("contact");
      const levelOfAdmission = isContactProg
        ? `Contact ${entryBase}`
        : String(entryBase * 100);
      const currentLevel = computeCanonicalStudentLevel({
        entrySession: sessionOfEntry,
        activeSession: activeSessionName,
        entryMode: canonicalMode,
        rawLevel: student.current_level,
        matricNumber: matricNo,
        programmeStructure: matchedProg?.programme_structure,
        durationYears: matchedProg?.duration_years,
      });

      studentCols = [
        firstName,
        lastName,
        otherName,
        student.email || "",
        student.phone || "",
        student.admission_number || "",
        matricNo,
        student.department_name || "",
        student.programme_name || "",
        levelOfAdmission,
        currentLevel,
        sessionOfEntry,
        canonicalMode,
        status,
        "ChangeMe123!",
        gender,
        dob,
        nin,
        address,
        state,
        lga,
      ];
    } else {
      studentCols = Array(21).fill("");
    }

    const refCols = prog
      ? [
          prog.name || "",
          prog.department_name || "",
          prog.code || "",
          prog.programme_structure || "semester",
          prog.duration_years ? String(prog.duration_years) : "3",
        ]
      : ["", "", "", "", ""];

    rows.push([...studentCols, ...refCols]);
  }

  return rows
    .map((row) => row.map((value) => csvEscape(String(value ?? ""))).join(","))
    .join("\n");
};

const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return ["1", "true", "yes", "required", "pending"].includes(
      value.trim().toLowerCase(),
    );
  }
  return false;
};

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value).replace(/[\uFFFD]/g, "'");
};

const formatDateValue = (value?: string | null) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const profileInitials = (name?: string | null) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "ST";

const filledOLevelRows = (rows?: OLevelSubject[] | null) =>
  Array.isArray(rows)
    ? rows.filter((row) => row && (row.subject || row.grade))
    : [];

export default function StudentManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [pagination, setPagination] =
    useState<StudentPagination>(EMPTY_STUDENT_META);
  const [studentSummary, setStudentSummary] = useState({
    counts: {} as Record<string, number>,
    programme_count: 0,
    average_gpa: null as number | null,
  });
  const [filterOptions, setFilterOptions] = useState({
    departments: [] as StudentFilterOption[],
    programmes: [] as StudentFilterOption[],
    levels: [] as string[],
    sessions: [] as string[],
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedProfile, setSelectedProfile] =
    useState<StudentProfileApi | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditProfileLoading, setIsEditProfileLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    matric_number: "",
    programme_id: "",
    department_id: "",
    current_level: "",
    session_name: "",
    dob: "",
    gender: "",
    nin: "",
    address: "",
    state: "",
    lga: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_relationship: "",
    guardian_address: "",
    next_of_kin: "",
    next_of_kin_phone: "",
    status: "",
  });
  const editProfileRequest = useRef(0);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [bulkFileName, setBulkFileName] = useState("");
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<string | null>(null);
  const [programmeReferences, setProgrammeReferences] = useState<
    ProgrammeReference[]
  >([]);
  const [activeSessionName, setActiveSessionName] =
    useState<string>("2025/2026");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteRequest, setDeleteRequest] = useState<{
    mode: "all" | "selected" | "single";
    studentIds?: string[];
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<{
    students: number;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const allPageSelected =
    students?.length > 0 && students.every((s) => selectedIds.includes(s.id));
  const somePageSelected =
    students?.some((s) => selectedIds.includes(s.id)) && !allPageSelected;

  const togglePage = (select: boolean) => {
    const pageIds = students.map((s) => s.id);
    if (select) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    }
  };

  const toggleOne = (id: string, select: boolean) => {
    if (select) setSelectedIds((prev) => [...prev, id]);
    else setSelectedIds((prev) => prev.filter((i) => i !== id));
  };

  const closeDelete = () => {
    setDeleteRequest(null);
    setConfirmText("");
    setDeleteSummary(null);
  };

  const openDelete = async (
    mode: "all" | "selected" | "single",
    studentIds?: string[],
  ) => {
    setDeleteRequest({ mode, studentIds });
    setConfirmText("");

    setSummaryLoading(true);
    try {
      const res = await api.post("/api/admin/students/delete", {
        search: debouncedSearch,
        status: statusFilter,
        department_id: departmentFilter,
        programme_id: programmeFilter,
        level: levelFilter,
        session: sessionFilter,
        profile_status: profileFilter,
        student_ids: studentIds || (mode === "selected" ? selectedIds : []),
        delete_all: mode === "all",
        dry_run: true,
      });
      setDeleteSummary((res as any).data);
    } catch (e) {
      console.error(e);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteRequest) return;
    setDeleting(true);
    try {
      const res = await api.post("/api/admin/students/delete", {
        search: debouncedSearch,
        status: statusFilter,
        department_id: departmentFilter,
        programme_id: programmeFilter,
        level: levelFilter,
        session: sessionFilter,
        profile_status: profileFilter,
        student_ids:
          deleteRequest.studentIds ||
          (deleteRequest.mode === "selected" ? selectedIds : []),
        delete_all: deleteRequest.mode === "all",
      });
      toast.success((res as any)?.message || "Students deleted");
      closeDelete();
      if (deleteRequest.mode === "all") {
        setSelectedIds([]);
      } else {
        const deletedIds = deleteRequest.studentIds || selectedIds;
        setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
      }
      loadStudents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete students");
    } finally {
      setDeleting(false);
    }
  };

  const latestStudentRequest = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadStudents = useCallback(async () => {
    const requestId = ++latestStudentRequest.current;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (departmentFilter !== "all") {
        params.set("department_id", departmentFilter);
      }
      if (programmeFilter !== "all") {
        params.set("programme_id", programmeFilter);
      }
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (sessionFilter !== "all") params.set("session", sessionFilter);
      if (profileFilter !== "all") {
        params.set("profile_status", profileFilter);
      }

      const res = await api.get(`/api/admin/students?${params.toString()}`);
      if (requestId !== latestStudentRequest.current) return;
      const responseRecord =
        res && typeof res === "object"
          ? (res as { data?: StudentApi[]; meta?: StudentListMeta })
          : null;
      const payload = (
        res && typeof res === "object" && "data" in res
          ? (res as { data?: StudentApi[] }).data
          : res
      ) as StudentApi[] | undefined;

      if (Array.isArray(payload)) {
        const mapped = payload.map((s) => {
          const fullName = (s.full_name || "").replace(/[\uFFFD]/g, "'");
          const parts = fullName.trim().split(/\s+/);
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ") || "";
          const rawStatus = (s.status || "").toLowerCase();
          const status: Student["status"] =
            rawStatus === "approved" || rawStatus === "admitted"
              ? "active"
              : (rawStatus as Student["status"]) || "active";
          const matricNo =
            s.admission_number || s.matric_number || "Pending Admission";
          const entrySess = s.session_name || (s as any).session || "";
          const canonicalLevel = computeCanonicalStudentLevel({
            entrySession: entrySess,
            activeSession: activeSessionName,
            entryMode: s.entry_mode,
            rawLevel: s.current_level,
            matricNumber: matricNo,
          });
          return {
            id: s.id || "",
            userId: s.user_id || null,
            matricNumber: matricNo,
            firstName,
            lastName,
            email: s.email || "",
            phone: s.phone || "",
            program: s.programme_name || "Undeclared",
            programmeId: s.programme_id || "",
            department: s.department_name || "Unknown",
            departmentId: s.department_id || "",
            level: canonicalLevel || s.current_level || "N/A",
            sessionName: entrySess,
            enrollmentDate: s.enrollment_date || "",
            status,
            gpa: s.gpa ?? null,
            feesStatus:
              (s.fees_status as Student["feesStatus"]) || ("unpaid" as const),
            avatar: undefined,
            onboardingSource: s.onboarding_source || null,
            profileCompletionStatus: s.profile_completion_status || null,
            accountUpdateRequired: toBoolean(s.account_update_required),
          } satisfies Student;
        });
        setStudents(mapped);
      } else {
        setStudents([]);
      }

      const meta = responseRecord?.meta;
      if (meta?.pagination) {
        const nextPagination = {
          ...EMPTY_STUDENT_META,
          ...meta.pagination,
        };
        setPagination(nextPagination);
        if (nextPagination.page !== page) {
          setPage(nextPagination.page);
        }
      }
      if (meta?.summary) {
        setStudentSummary({
          counts: meta.summary.counts || {},
          programme_count: meta.summary.programme_count || 0,
          average_gpa: meta.summary.average_gpa ?? null,
        });
      }
      if (meta?.filter_options) {
        setFilterOptions({
          departments: meta.filter_options.departments || [],
          programmes: meta.filter_options.programmes || [],
          levels: meta.filter_options.levels || [],
          sessions: meta.filter_options.sessions || [],
        });
      }
    } catch (error) {
      if (requestId !== latestStudentRequest.current) return;
      setStudents([]);
      toast.error("Failed to load students");
    } finally {
      if (requestId === latestStudentRequest.current) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  }, [
    activeSessionName,
    debouncedSearch,
    departmentFilter,
    levelFilter,
    page,
    perPage,
    profileFilter,
    programmeFilter,
    sessionFilter,
    statusFilter,
  ]);

  const loadProgrammeReferences = useCallback(async () => {
    try {
      const [progRes, sessRes] = await Promise.all([
        api.get("/api/admin/get-programmes"),
        api.get("/api/admin/get-sessions").catch(() => null),
      ]);
      setProgrammeReferences(extractApiArray<ProgrammeReference>(progRes));
      const sessions = extractApiArray<{
        name?: string;
        is_active?: boolean | number | string;
      }>(sessRes);
      const active = sessions.find((s) =>
        ["1", "true", "yes"].includes(String(s.is_active).toLowerCase()),
      );
      if (active?.name) {
        setActiveSessionName(active.name);
      }
    } catch (error) {
      setProgrammeReferences([]);
    }
  }, []);

  useEffect(() => {
    void loadStudents();
    void loadProgrammeReferences();
  }, [loadStudents, loadProgrammeReferences]);

  const programmeReferenceLookup = useMemo(() => {
    const map = new Map<string, ProgrammeReference>();
    programmeReferences.forEach((programme) => {
      if (programme.name) {
        map.set(String(programme.name).trim().toLowerCase(), programme);
      }
    });
    return map;
  }, [programmeReferences]);

  const bulkPreview = useMemo(() => {
    if (!bulkCsvText.trim()) {
      return {
        rows: [] as BulkStudentPreviewRow[],
        validRows: [] as BulkStudentPreviewRow[],
        errorRows: [] as BulkStudentPreviewRow[],
        missingHeaders: [] as string[],
      };
    }

    const rows = parseCsv(bulkCsvText);
    const headers = (rows[0] || []).map(normalizeCsvHeader);
    const missingHeaders = REQUIRED_BULK_STUDENT_FIELDS.filter(
      (field) => !field.aliases.some((alias) => headers.includes(alias)),
    ).map((field) => field.label);
    const seenEmails = new Set<string>();

    const previewRows = rows.slice(1).flatMap((row, index) => {
      const values = headers.reduce<Record<string, string>>(
        (acc, header, i) => {
          if (header) {
            acc[header] = row[i]?.trim() || "";
          }
          return acc;
        },
        {},
      );
      REQUIRED_BULK_STUDENT_FIELDS.forEach((field) => {
        if (!values[field.key]) {
          const alias = field.aliases.find((candidate) => values[candidate]);
          if (alias) {
            values[field.key] = values[alias];
          }
        }
      });
      applyBulkStudentNameAliases(values);
      const hasStudentIdentityData = [
        "first_name",
        "last_name",
        "full_name",
        "email",
        "admission_number",
        "level_of_admission",
        "session_of_entry",
      ].some((field) => Boolean(values[field]));
      const hasReferenceData = [
        "programme_reference",
        "reference_department",
        "reference_code",
        "reference_structure",
      ].some((field) => Boolean(values[field]));
      if (!hasStudentIdentityData && hasReferenceData) {
        return [];
      }
      const errors: string[] = [];

      REQUIRED_BULK_STUDENT_FIELDS.forEach((field) => {
        if (!values[field.key]) {
          errors.push(`${field.label} is required`);
        }
      });

      const email = (values.email || "").toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("email is invalid");
      }
      if (email && seenEmails.has(email)) {
        errors.push("email is duplicated in this file");
      }
      if (email) {
        seenEmails.add(email);
      }

      if (programmeReferenceLookup.size > 0 && values.programme) {
        const programme = programmeReferenceLookup.get(
          values.programme.trim().toLowerCase(),
        );
        if (!programme) {
          errors.push("programme must match the reference list exactly");
        } else if (
          values.department &&
          programme.department_name &&
          values.department.trim().toLowerCase() !==
            String(programme.department_name).trim().toLowerCase()
        ) {
          errors.push("department does not match the selected programme");
        }
      }

      return [
        {
          rowNumber: index + 2,
          values,
          errors,
        },
      ];
    });

    return {
      rows: previewRows,
      validRows: previewRows.filter((row) => row.errors.length === 0),
      errorRows: previewRows.filter((row) => row.errors.length > 0),
      missingHeaders,
    };
  }, [bulkCsvText, programmeReferenceLookup]);

  const handleBulkFileChange = (file?: File | null) => {
    if (!file) return;
    setBulkFileName(file.name);
    setBulkImportResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      setBulkCsvText(String(reader.result || ""));
    };
    reader.onerror = () => {
      toast.error("Could not read the selected file");
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!bulkCsvText.trim()) {
      toast.error("Select a completed CSV template first");
      return;
    }
    if (
      bulkPreview.missingHeaders.length > 0 ||
      bulkPreview.errorRows.length > 0
    ) {
      toast.error("Resolve CSV validation errors before importing");
      return;
    }
    if (bulkPreview.validRows.length === 0) {
      toast.error("The CSV has no student rows to import");
      return;
    }

    setIsImporting(true);
    setBulkImportResult(null);
    try {
      const res = await api.bulkOnboardStudentsCsv({
        csv: bulkCsvText,
        default_status: "active",
        notify_students: notifyStudents,
      });
      const message =
        (res && typeof res === "object" && "message" in res
          ? String((res as { message?: string }).message || "")
          : "") ||
        `${bulkPreview.validRows.length} student records submitted for onboarding`;
      setBulkImportResult(message);
      toast.success(message);
      await loadStudents();
    } catch (error) {
      const err = error as { message?: string; body?: { message?: string } };
      toast.error(
        err?.body?.message || err?.message || "Bulk onboarding failed",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportStudents = async () => {
    try {
      setIsExporting(true);
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== "all") params.status = statusFilter;
      if (departmentFilter !== "all") params.department_id = departmentFilter;
      if (programmeFilter !== "all") params.programme_id = programmeFilter;
      if (levelFilter !== "all") params.level = levelFilter;
      if (sessionFilter !== "all") params.session = sessionFilter;
      if (profileFilter !== "all") params.profile_status = profileFilter;

      let csvContent = "";
      let count = 0;

      // 1. Try server-side export endpoint
      try {
        const res = await api.exportAdminStudentsCsv(params);
        const data =
          res && typeof res === "object" && "data" in res
            ? (res as { data?: { file_name?: string; csv?: string; count?: number } }).data
            : (res as { file_name?: string; csv?: string; count?: number } | undefined);
        if (data?.csv) {
          csvContent = data.csv;
          count = data.count ?? 0;
        }
      } catch (endpointErr: any) {
        // If 404 (remote server not yet updated), fall back to client-side multi-page fetch
        if (endpointErr?.status !== 404) {
          console.warn("Server export endpoint error, attempting client-side export fallback:", endpointErr);
        }
      }

      // 2. Fallback: fetch matching students across pages using existing /api/admin/students endpoint
      if (!csvContent) {
        const queryParams = new URLSearchParams({
          page: "1",
          per_page: "100",
        });
        if (debouncedSearch) queryParams.set("search", debouncedSearch);
        if (statusFilter !== "all") queryParams.set("status", statusFilter);
        if (departmentFilter !== "all") {
          queryParams.set("department_id", departmentFilter);
        }
        if (programmeFilter !== "all") {
          queryParams.set("programme_id", programmeFilter);
        }
        if (levelFilter !== "all") queryParams.set("level", levelFilter);
        if (sessionFilter !== "all") queryParams.set("session", sessionFilter);
        if (profileFilter !== "all") {
          queryParams.set("profile_status", profileFilter);
        }

        const firstRes = await api.get(`/api/admin/students?${queryParams.toString()}`);
        const firstRecord =
          firstRes && typeof firstRes === "object"
            ? (firstRes as { data?: StudentApi[]; meta?: StudentListMeta })
            : null;
        const allStudents: StudentApi[] = Array.isArray(firstRecord?.data)
          ? [...firstRecord.data]
          : [];

        const totalPages = firstRecord?.meta?.pagination?.total_pages || 1;
        if (totalPages > 1) {
          const promises: Promise<unknown>[] = [];
          for (let p = 2; p <= totalPages; p++) {
            const pageParams = new URLSearchParams(queryParams);
            pageParams.set("page", String(p));
            promises.push(api.get(`/api/admin/students?${pageParams.toString()}`));
          }
          const otherPageResponses = await Promise.all(promises);
          for (const pageRes of otherPageResponses) {
            const pageData =
              pageRes && typeof pageRes === "object" && "data" in pageRes
                ? (pageRes as { data?: StudentApi[] }).data
                : null;
            if (Array.isArray(pageData)) {
              allStudents.push(...pageData);
            }
          }
        }

        count = allStudents.length;
        csvContent = buildExportStudentsCsv(
          allStudents,
          programmeReferences,
          activeSessionName,
        );
      }

      if (csvContent) {
        const filename = `students_export_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadCsv(filename, csvContent);
        toast.success(
          `Exported ${count} student record${count === 1 ? "" : "s"} successfully`,
        );
      } else {
        toast.error("Failed to generate student export file");
      }
    } catch (error) {
      const err = error as { message?: string; body?: { message?: string } };
      toast.error(
        err?.body?.message || err?.message || "Failed to export students",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const buildEditFormFromProfile = (
    student: Student,
    profile?: StudentProfileApi | null,
  ) => ({
    full_name: (
      profile?.full_name || `${student.firstName} ${student.lastName}`.trim()
    ).replace(/[\uFFFD]/g, "'"),
    email: profile?.email || student.email || "",
    phone: profile?.phone || student.phone || "",
    matric_number:
      profile?.matric_number ||
      profile?.admission_number ||
      student.matricNumber ||
      "",
    programme_id: student.programmeId || "",
    department_id: student.departmentId || "",
    current_level: profile?.current_level || student.level || "",
    session_name: profile?.session || student.sessionName || "",
    dob: profile?.dob || "",
    gender: (profile?.gender || "").toLowerCase(),
    nin: profile?.nin || "",
    address: profile?.address || "",
    state: profile?.state || "",
    lga: profile?.lga || "",
    guardian_name: profile?.guardian_name || "",
    guardian_phone: profile?.guardian_phone || "",
    guardian_relationship: profile?.guardian_relationship || "",
    guardian_address: profile?.guardian_address || "",
    next_of_kin: profile?.next_of_kin || "",
    next_of_kin_phone: profile?.next_of_kin_phone || "",
    status: student.status || "active",
  });

  const handleEditStudent = async (student: Student) => {
    const requestId = ++editProfileRequest.current;
    setEditingStudent(student);
    setEditForm(buildEditFormFromProfile(student));
    setIsEditProfileLoading(true);
    setIsEditDialogOpen(true);
    try {
      const params = new URLSearchParams();
      if (student.id) params.set("student_id", student.id);
      if (student.userId) params.set("user_id", student.userId);
      const response = await api.get(
        `/api/admin/students/profile?${params.toString()}`,
      );
      const profile = (
        response && typeof response === "object" && "data" in response
          ? (response as { data?: StudentProfileApi }).data
          : response
      ) as StudentProfileApi | undefined;
      if (requestId !== editProfileRequest.current) return;
      setSelectedProfile(profile || null);
      setEditForm(buildEditFormFromProfile(student, profile || null));
    } catch (error) {
      if (requestId !== editProfileRequest.current) return;
      setSelectedProfile(null);
      setEditForm(buildEditFormFromProfile(student, null));
    } finally {
      if (requestId === editProfileRequest.current) {
        setIsEditProfileLoading(false);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    if (
      !editForm.department_id ||
      !editForm.programme_id ||
      !editForm.session_name
    ) {
      toast.error("Select a department, programme, and session before saving");
      return;
    }
    setIsEditing(true);
    try {
      await api.post("/api/admin/students/update", {
        id: editingStudent.id,
        ...editForm,
      });
      toast.success("Student updated successfully");
      setIsEditDialogOpen(false);
      await loadStudents();
    } catch (err: any) {
      toast.error(
        err?.body?.message || err.message || "Failed to update student",
      );
    } finally {
      setIsEditing(false);
    }
  };

  const handleViewStudent = async (student: Student) => {
    setSelectedStudent(student);
    setSelectedProfile(null);
    setIsViewDialogOpen(true);
    setProfileLoading(true);

    try {
      const params = new URLSearchParams();
      if (student.id) {
        params.set("student_id", student.id);
      }
      if (student.userId) {
        params.set("user_id", student.userId);
      }
      if (!student.id && !student.userId && student.email) {
        params.set("email", student.email);
      }

      const response = await api.get(
        `/api/admin/students/profile?${params.toString()}`,
      );
      const profile = (
        response && typeof response === "object" && "data" in response
          ? (response as { data?: StudentProfileApi }).data
          : response
      ) as StudentProfileApi | undefined;
      setSelectedProfile(profile || null);
    } catch (error) {
      toast.error("Unable to load full student profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "emerald" | "destructive" | "warning" | "secondary"
    > = {
      active: "emerald",
      inactive: "secondary",
      suspended: "destructive",
      graduated: "default",
    };
    return variants[status] || "default";
  };

  const getFeesBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "emerald" | "destructive" | "warning"
    > = {
      paid: "emerald",
      partial: "warning",
      unpaid: "destructive",
    };
    return variants[status] || "default";
  };

  const visibleProgrammeOptions = useMemo(
    () =>
      departmentFilter === "all"
        ? filterOptions.programmes
        : filterOptions.programmes.filter(
            (programme) => programme.department_id === departmentFilter,
          ),
    [departmentFilter, filterOptions.programmes],
  );

  const activeFilterCount = [
    statusFilter,
    departmentFilter,
    programmeFilter,
    levelFilter,
    sessionFilter,
    profileFilter,
  ].filter((value) => value !== "all").length;

  const visiblePages = useMemo(() => {
    const totalPages = Math.max(1, pagination.total_pages);
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, pagination.total_pages]);

  const clearStudentFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setDepartmentFilter("all");
    setProgrammeFilter("all");
    setLevelFilter("all");
    setSessionFilter("all");
    setProfileFilter("all");
    setPage(1);
  };

  const stats = useMemo(() => {
    const total = studentSummary.counts.total || 0;
    const active = studentSummary.counts.active || 0;
    const avgGpa =
      typeof studentSummary.average_gpa === "number"
        ? studentSummary.average_gpa.toFixed(2)
        : "-";
    return [
      { title: "Total Students", value: total.toString(), icon: Users },
      {
        title: "Admitted Students",
        value: active.toString(),
        icon: GraduationCap,
      },
      {
        title: "Programs",
        value: studentSummary.programme_count.toString(),
        icon: BookOpen,
      },
      { title: "Avg. GPA", value: avgGpa, icon: CreditCard },
    ];
  }, [studentSummary]);

  if (loading && !hasLoaded) {
    return (
      <AdminLayout>
        <div className="p-6">Loading students...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">
              Student Management
            </h1>
            <p className="text-muted-foreground">
              Manage enrolled students and their records
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExportStudents}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isExporting ? "Exporting..." : "Export"}
            </Button>
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Bulk Onboard
            </Button>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Student
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <stat.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>All Students</CardTitle>
                <CardDescription>
                  View and manage student records
                </CardDescription>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search students..."
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="graduated">Graduated</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={departmentFilter}
                  onValueChange={(value) => {
                    setDepartmentFilter(value);
                    setProgrammeFilter("all");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {filterOptions.departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={showMoreFilters ? "secondary" : "outline"}
                  onClick={() => setShowMoreFilters((current) => !current)}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  More Filters
                  {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </Button>
                {(activeFilterCount > 0 || searchQuery) && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearStudentFilters}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            {showMoreFilters && (
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="grid gap-1.5">
                  <Label>Programme</Label>
                  <Select
                    value={programmeFilter}
                    onValueChange={(value) => {
                      setProgrammeFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All programmes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programmes</SelectItem>
                      {visibleProgrammeOptions.map((programme) => (
                        <SelectItem key={programme.id} value={programme.id}>
                          {programme.name}
                          {programme.code ? ` (${programme.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Level</Label>
                  <Select
                    value={levelFilter}
                    onValueChange={(value) => {
                      setLevelFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      {filterOptions.levels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Entry Session</Label>
                  <Select
                    value={sessionFilter}
                    onValueChange={(value) => {
                      setSessionFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      {filterOptions.sessions.map((session) => (
                        <SelectItem key={session} value={session}>
                          {session}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Profile Status</Label>
                  <Select
                    value={profileFilter}
                    onValueChange={(value) => {
                      setProfileFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All profiles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Profiles</SelectItem>
                      <SelectItem value="update_required">
                        Update Required
                      </SelectItem>
                      <SelectItem value="complete">Complete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between border bg-muted/20 p-2 rounded-md">
              <div className="text-sm font-medium px-2">
                {selectedIds.length} selected
              </div>
              <div className="space-x-2">
                {selectedIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDelete("selected")}
                  >
                    Delete Selected
                  </Button>
                )}
                {(students?.length || 0) > 0 && selectedIds.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => openDelete("all")}
                  >
                    Delete All Matching Filter
                  </Button>
                )}
              </div>
            </div>
            <div
              className={`overflow-x-auto transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}
              aria-busy={loading}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={togglePage}
                        className={somePageSelected ? "opacity-50" : ""}
                      />
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Matric Number</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>GPA</TableHead>
                    <TableHead>Fees</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(student.id)}
                          onCheckedChange={(c) => toggleOne(student.id, !!c)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={student.avatar} />
                            <AvatarFallback>
                              {student.firstName[0]}
                              {student.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {student.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {student.matricNumber}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.program}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.department}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{student.level}</TableCell>
                      <TableCell>
                        {typeof student.gpa === "number" ? (
                          <span
                            className={
                              student.gpa >= 3.5
                                ? "text-emerald-600 font-medium"
                                : student.gpa >= 2.5
                                  ? "font-medium"
                                  : "text-destructive"
                            }
                          >
                            {student.gpa.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getFeesBadge(student.feesStatus || "unpaid")}
                        >
                          {student.feesStatus || "unpaid"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadge(student.status)}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            student.accountUpdateRequired
                              ? "warning"
                              : "emerald"
                          }
                        >
                          {student.accountUpdateRequired
                            ? "update required"
                            : student.profileCompletionStatus || "complete"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => void handleViewStudent(student)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEditStudent(student)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Student
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <BookOpen className="mr-2 h-4 w-4" />
                              View Courses
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CreditCard className="mr-2 h-4 w-4" />
                              View Payments
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => openDelete("single", [student.id])}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && students.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="h-28 text-center text-muted-foreground"
                      >
                        No students match the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {pagination.from.toLocaleString()}–
                {pagination.to.toLocaleString()} of{" "}
                {pagination.total.toLocaleString()} students
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={String(perPage)}
                  onValueChange={(value) => {
                    setPerPage(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="25">25 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                {visiblePages.map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === page ? "default" : "outline"}
                    size="sm"
                    className="min-w-9"
                    disabled={loading}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.total_pages || loading}
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.total_pages, current + 1),
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Onboarding Dialog */}
        <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bulk Onboard Existing Students</DialogTitle>
              <DialogDescription>
                Upload management-provided student data. Imported students will
                be required to complete their profile from the student portal.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-4">
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertTitle>Template fields</AlertTitle>
                <AlertDescription>
                  Required columns: first name, last name, email, department,
                  programme, level of admission, and session of entry. Other
                  name, phone number, admission number, entry mode, status, and
                  temporary password are optional. Use the programme reference
                  columns in the downloaded template for exact programme names.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium">CSV template</p>
                  <p className="text-sm text-muted-foreground">
                    Start from the template so the headers and programme names
                    match the backend exactly.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "student-bulk-onboarding-template.csv",
                      buildBulkStudentTemplateCsv(programmeReferences),
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bulkStudentCsv">Completed CSV file</Label>
                <Input
                  id="bulkStudentCsv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) =>
                    handleBulkFileChange(event.target.files?.[0])
                  }
                />
                {bulkFileName && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {bulkFileName}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="notifyStudents"
                  checked={notifyStudents}
                  onCheckedChange={(checked) =>
                    setNotifyStudents(Boolean(checked))
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="notifyStudents">
                    Notify students by email
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    The backend can send portal login instructions or temporary
                    passwords for rows that include them.
                  </p>
                </div>
              </div>

              {bulkCsvText.trim() && (
                <div className="rounded-lg border">
                  <div className="grid gap-3 border-b p-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Rows</p>
                      <p className="text-lg font-semibold">
                        {bulkPreview.rows.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valid</p>
                      <p className="text-lg font-semibold text-success">
                        {bulkPreview.validRows.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        With errors
                      </p>
                      <p className="text-lg font-semibold text-destructive">
                        {bulkPreview.errorRows.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Missing headers
                      </p>
                      <p className="text-lg font-semibold">
                        {bulkPreview.missingHeaders.length}
                      </p>
                    </div>
                  </div>

                  {bulkPreview.missingHeaders.length > 0 && (
                    <div className="border-b bg-destructive/5 p-4 text-sm text-destructive">
                      Missing columns: {bulkPreview.missingHeaders.join(", ")}
                    </div>
                  )}

                  <div className="max-h-64 overflow-auto p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Programme</TableHead>
                          <TableHead>Level of Admission</TableHead>
                          <TableHead>Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bulkPreview.rows.slice(0, 8).map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>
                              {resolveBulkStudentName(row.values) || "--"}
                            </TableCell>
                            <TableCell>{row.values.email || "--"}</TableCell>
                            <TableCell>
                              {row.values.programme || "--"}
                            </TableCell>
                            <TableCell>
                              {row.values.level_of_admission || "--"}
                            </TableCell>
                            <TableCell>
                              {row.errors.length ? (
                                <span className="flex items-center gap-2 text-sm text-destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  {row.errors.join("; ")}
                                </span>
                              ) : (
                                <span className="flex items-center gap-2 text-sm text-success">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Ready
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {bulkPreview.rows.length > 8 && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Showing first 8 rows only. All rows will be validated
                        before import.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {bulkImportResult && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Import submitted</AlertTitle>
                  <AlertDescription>{bulkImportResult}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-background px-6 py-4">
              <Button
                variant="outline"
                onClick={() => setIsBulkDialogOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={handleBulkImport}
                disabled={
                  isImporting ||
                  !bulkCsvText.trim() ||
                  bulkPreview.missingHeaders.length > 0 ||
                  bulkPreview.errorRows.length > 0
                }
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? "Importing..." : "Import Students"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Student Profile</DialogTitle>
              <DialogDescription>
                View detailed student information
              </DialogDescription>
            </DialogHeader>
            {selectedStudent && (
              <div className="grid gap-6 py-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={selectedStudent.avatar} />
                    <AvatarFallback className="text-2xl">
                      {profileInitials(
                        selectedProfile?.full_name ||
                          `${selectedStudent.firstName} ${selectedStudent.lastName}`,
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-semibold">
                      {displayValue(
                        selectedProfile?.full_name ||
                          `${selectedStudent.firstName} ${selectedStudent.lastName}`,
                      )}
                    </h3>
                    <p className="text-muted-foreground font-mono">
                      {displayValue(
                        selectedProfile?.admission_number ||
                          selectedProfile?.matric_number ||
                          selectedStudent.matricNumber,
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={getStatusBadge(selectedStudent.status)}>
                        {selectedProfile?.student_status ||
                          selectedStudent.status}
                      </Badge>
                      <Badge
                        variant={
                          toBoolean(
                            selectedProfile?.account_update_required ??
                              selectedStudent.accountUpdateRequired,
                          )
                            ? "warning"
                            : "emerald"
                        }
                      >
                        {toBoolean(
                          selectedProfile?.account_update_required ??
                            selectedStudent.accountUpdateRequired,
                        )
                          ? "update required"
                          : selectedProfile?.profile_completion_status ||
                            selectedStudent.profileCompletionStatus ||
                            "complete"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {profileLoading ? (
                  <div className="rounded-md border p-6 text-sm text-muted-foreground">
                    Loading profile...
                  </div>
                ) : (
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="guardian">Guardian</TabsTrigger>
                      <TabsTrigger value="education">Education</TabsTrigger>
                      <TabsTrigger value="olevel">O Level</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Contact</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {displayValue(
                                  selectedProfile?.email ||
                                    selectedStudent.email,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {displayValue(
                                  selectedProfile?.phone ||
                                    selectedStudent.phone,
                                )}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <span>
                                {displayValue(selectedProfile?.address)}
                                {selectedProfile?.state
                                  ? `, ${selectedProfile.state}`
                                  : ""}
                                {selectedProfile?.lga
                                  ? `, ${selectedProfile.lga}`
                                  : ""}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Academic
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Programme
                              </span>
                              <span className="text-right font-medium">
                                {displayValue(
                                  selectedProfile?.programme_name ||
                                    selectedStudent.program,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Department
                              </span>
                              <span className="text-right font-medium">
                                {displayValue(
                                  selectedProfile?.department_name ||
                                    selectedStudent.department,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Level
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.current_level ||
                                    selectedStudent.level,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Session
                              </span>
                              <span className="font-medium">
                                {displayValue(selectedProfile?.session)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Enrolled
                              </span>
                              <span className="font-medium">
                                {formatDateValue(
                                  selectedStudent.enrollmentDate,
                                )}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Personal
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Date of birth
                              </span>
                              <span className="font-medium">
                                {formatDateValue(selectedProfile?.dob)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Gender
                              </span>
                              <span className="font-medium">
                                {displayValue(selectedProfile?.gender)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">NIN</span>
                              <span className="font-medium">
                                {displayValue(selectedProfile?.nin)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Records</CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Application
                              </span>
                              <span className="font-medium">
                                {displayValue(selectedProfile?.application_no)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Admission No.
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.admission_number,
                                )}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Source
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.onboarding_source ||
                                    selectedStudent.onboardingSource,
                                )}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="guardian" className="mt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Guardian
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Name
                              </span>
                              <span className="text-right font-medium">
                                {displayValue(selectedProfile?.guardian_name)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Phone
                              </span>
                              <span className="font-medium">
                                {displayValue(selectedProfile?.guardian_phone)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Relationship
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.guardian_relationship,
                                )}
                              </span>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-muted-foreground">
                                Address
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.guardian_address,
                                )}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Next of Kin
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Name
                              </span>
                              <span className="text-right font-medium">
                                {displayValue(selectedProfile?.next_of_kin)}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Phone
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.next_of_kin_phone,
                                )}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="education" className="mt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Schools Attended
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm">
                            <div className="grid gap-1">
                              <span className="text-muted-foreground">
                                Primary school
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.education?.primarySchool,
                                )}
                              </span>
                              <span>
                                {displayValue(
                                  selectedProfile?.education?.primaryYear,
                                )}
                              </span>
                            </div>
                            <div className="grid gap-1">
                              <span className="text-muted-foreground">
                                Secondary school
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.education?.secondarySchool,
                                )}
                              </span>
                              <span>
                                {displayValue(
                                  selectedProfile?.education?.secondaryYear,
                                )}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Exam Details
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 text-sm">
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                First sitting
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.academic?.qualification,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Exam number
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.academic?.examNumber,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Exam center
                              </span>
                              <span className="text-right font-medium">
                                {displayValue(
                                  selectedProfile?.academic?.examCenter,
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">
                                Exam year
                              </span>
                              <span className="font-medium">
                                {displayValue(
                                  selectedProfile?.academic?.examYear,
                                )}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="olevel" className="mt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        {[
                          {
                            title: "First Sitting",
                            rows: filledOLevelRows(
                              selectedProfile?.oLevel?.firstSitting,
                            ),
                          },
                          {
                            title: "Second Sitting",
                            rows: filledOLevelRows(
                              selectedProfile?.oLevel?.secondSitting,
                            ),
                          },
                        ].map((sitting) => (
                          <Card key={sitting.title}>
                            <CardHeader>
                              <CardTitle className="text-base">
                                {sitting.title}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              {sitting.rows.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Grade</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sitting.rows.map((row, index) => (
                                        <TableRow
                                          key={`${sitting.title}-${index}`}
                                        >
                                          <TableCell>
                                            {displayValue(row.subject)}
                                          </TableCell>
                                          <TableCell>
                                            {displayValue(row.grade)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No records
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsViewDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              editProfileRequest.current += 1;
              setIsEditProfileLoading(false);
            }
            setIsEditDialogOpen(open);
          }}
        >
          <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[760px]">
            <DialogHeader className="shrink-0">
              <DialogTitle>Edit Student</DialogTitle>
              <DialogDescription>
                Update the academic and personal profile for this student.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 pr-2">
              <div className="grid gap-4 md:grid-cols-2">
                {isEditProfileLoading && (
                  <div className="text-sm text-muted-foreground md:col-span-2">
                    Loading student profile...
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-full-name">Full Name</Label>
                  <Input
                    id="edit-full-name"
                    value={editForm.full_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, full_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-matric">Matric / Admission Number</Label>
                  <Input
                    id="edit-matric"
                    value={editForm.matric_number}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        matric_number: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(val) =>
                      setEditForm({ ...editForm, status: val })
                    }
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="graduated">Graduated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Department</Label>
                  <Select
                    value={editForm.department_id || "none"}
                    onValueChange={(val) => {
                      const nextDepartment = val === "none" ? "" : val;
                      const selectedProgramme = filterOptions.programmes.find(
                        (programme) => programme.id === editForm.programme_id,
                      );
                      setEditForm({
                        ...editForm,
                        department_id: nextDepartment,
                        programme_id:
                          nextDepartment &&
                          selectedProgramme?.department_id === nextDepartment
                            ? editForm.programme_id
                            : "",
                      });
                    }}
                  >
                    <SelectTrigger id="edit-department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select department</SelectItem>
                      {filterOptions.departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-programme">Programme</Label>
                  <Select
                    value={editForm.programme_id || "none"}
                    onValueChange={(val) =>
                      setEditForm({
                        ...editForm,
                        programme_id: val === "none" ? "" : val,
                      })
                    }
                  >
                    <SelectTrigger id="edit-programme">
                      <SelectValue placeholder="Select programme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select programme</SelectItem>
                      {filterOptions.programmes
                        .filter(
                          (programme) =>
                            !editForm.department_id ||
                            !programme.department_id ||
                            programme.department_id === editForm.department_id,
                        )
                        .map((programme) => (
                          <SelectItem key={programme.id} value={programme.id}>
                            {programme.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-level">Current Level</Label>
                  <Input
                    id="edit-level"
                    value={editForm.current_level}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        current_level: e.target.value,
                      })
                    }
                    placeholder="e.g. 100 or Contact 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-session">Session</Label>
                  <Select
                    value={editForm.session_name || "none"}
                    onValueChange={(val) =>
                      setEditForm({
                        ...editForm,
                        session_name: val === "none" ? "" : val,
                      })
                    }
                  >
                    <SelectTrigger id="edit-session">
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select session</SelectItem>
                      {filterOptions.sessions.map((session) => (
                        <SelectItem key={session} value={session}>
                          {session}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-dob">Date of Birth</Label>
                  <Input
                    id="edit-dob"
                    type="date"
                    value={editForm.dob}
                    onChange={(e) =>
                      setEditForm({ ...editForm, dob: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-gender">Gender</Label>
                  <Select
                    value={editForm.gender || "none"}
                    onValueChange={(val) =>
                      setEditForm({
                        ...editForm,
                        gender: val === "none" ? "" : val,
                      })
                    }
                  >
                    <SelectTrigger id="edit-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select gender</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-nin">NIN</Label>
                  <Input
                    id="edit-nin"
                    value={editForm.nin}
                    onChange={(e) =>
                      setEditForm({ ...editForm, nin: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-state">State</Label>
                  <Input
                    id="edit-state"
                    value={editForm.state}
                    onChange={(e) =>
                      setEditForm({ ...editForm, state: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lga">LGA</Label>
                  <Input
                    id="edit-lga"
                    value={editForm.lga}
                    onChange={(e) =>
                      setEditForm({ ...editForm, lga: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    value={editForm.address}
                    onChange={(e) =>
                      setEditForm({ ...editForm, address: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-guardian-name">Guardian Name</Label>
                  <Input
                    id="edit-guardian-name"
                    value={editForm.guardian_name}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        guardian_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-guardian-phone">Guardian Phone</Label>
                  <Input
                    id="edit-guardian-phone"
                    value={editForm.guardian_phone}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        guardian_phone: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-guardian-relationship">
                    Guardian Relationship
                  </Label>
                  <Input
                    id="edit-guardian-relationship"
                    value={editForm.guardian_relationship}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        guardian_relationship: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-next-of-kin">Next of Kin</Label>
                  <Input
                    id="edit-next-of-kin"
                    value={editForm.next_of_kin}
                    onChange={(e) =>
                      setEditForm({ ...editForm, next_of_kin: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-guardian-address">
                    Guardian Address
                  </Label>
                  <Input
                    id="edit-guardian-address"
                    value={editForm.guardian_address}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        guardian_address: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-next-of-kin-phone">
                    Next of Kin Phone
                  </Label>
                  <Input
                    id="edit-next-of-kin-phone"
                    value={editForm.next_of_kin_phone}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        next_of_kin_phone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 border-t bg-background pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  editProfileRequest.current += 1;
                  setIsEditDialogOpen(false);
                }}
                disabled={isEditing || isEditProfileLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isEditing || isEditProfileLoading}
              >
                {isEditing
                  ? "Saving..."
                  : isEditProfileLoading
                    ? "Loading..."
                    : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Dialog
        open={!!deleteRequest}
        onOpenChange={(o) => (!o ? closeDelete() : null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="pt-4 space-y-4">
              <p>
                You are about to delete{" "}
                <span className="font-bold text-foreground">
                  {deleteRequest?.mode === "all"
                    ? "ALL students matching current filters"
                    : deleteRequest?.mode === "single"
                      ? "this student"
                      : `${deleteRequest?.studentIds?.length} selected student(s)`}
                </span>
                .
              </p>

              {summaryLoading ? (
                <div className="flex items-center justify-center p-4 bg-muted/50 rounded-md border">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                  <span className="text-sm">Calculating impact...</span>
                </div>
              ) : deleteSummary ? (
                <Alert
                  variant="destructive"
                  className="bg-destructive/10 border-destructive/20"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning: Cascading Delete</AlertTitle>
                  <AlertDescription className="mt-2 text-sm">
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        <strong>
                          {deleteSummary.students ||
                            deleteRequest?.studentIds?.length ||
                            0}
                        </strong>{" "}
                        Student record(s)
                      </li>
                      <li>
                        All associated course registrations and amendments
                      </li>
                      <li>All associated result attempts</li>
                      <li>All fee invoices and payments</li>
                      <li>The underlying user accounts and admissions</li>
                    </ul>
                    <p className="mt-4 font-semibold text-destructive">
                      This action CANNOT be undone.
                    </p>
                  </AlertDescription>
                </Alert>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Label className="text-sm text-foreground/80 font-normal">
              To confirm, type{" "}
              <span className="font-bold text-foreground select-all">
                DELETE
              </span>{" "}
              below:
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDelete} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting || confirmText !== "DELETE"}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Permanently Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
