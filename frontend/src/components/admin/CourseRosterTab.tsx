import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Loader2,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookOpen,
  Filter,
  CheckSquare,
  Square,
  UserCheck,
  UserMinus,
  RefreshCw,
  Printer,
  Download,
} from "lucide-react";

interface CourseRosterTabProps {
  session?: string;
  semester?: string;
}

interface CourseRosterItem {
  id: string;
  code: string;
  title: string;
  credit_unit: number;
  type: string;
  level: string;
  registered_count: number;
  unregistered_count: number;
  total_cohort: number;
}

interface StudentRosterItem {
  student_id: string;
  full_name: string;
  email: string;
  matric_number: string;
  admission_number: string;
  entry_mode: string;
  session_name: string;
  academic_session_id?: string | null;
  academic_session_name?: string | null;
  entry_session_id?: string | null;
  is_registered: boolean;
  registration_type: string | null;
  registration_id: string | null;
  registration_item_id: string | null;
  has_score: boolean;
  score: number | string | null;
  grade: string | null;
}

interface AffectedStudentScore {
  student_id: string;
  full_name: string;
  matric_number: string;
  score: number | string | null;
  grade: string | null;
}

export function CourseRosterTab({
  session: _sessionProp,
  semester: _semesterProp,
}: CourseRosterTabProps) {
  const queryClient = useQueryClient();

  // Targeting filters state (Academic Session is primary envelope; Entry Cohort is optional filter)
  const [academicSession, setAcademicSession] = useState("");
  const [entryCohort, setEntryCohort] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [programmeId, setProgrammeId] = useState("");
  const [level, setLevel] = useState("");
  const [entryMode, setEntryMode] = useState("all");
  const [manualLevelChoice, setManualLevelChoice] = useState(false);

  // Course & Table state
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseTypeFilter, setCourseTypeFilter] = useState<"core" | "elective" | "all">("core");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "registered" | "not_registered">("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Score safety warning modal state
  const [scoreWarningModal, setScoreWarningModal] = useState<{
    message: string;
    affectedStudents: AffectedStudentScore[];
    pendingStudentIds: string[];
  } | null>(null);

  // 1. Fetch Academic Sessions
  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-sessions");
      return (res as any).data || [];
    },
  });

  // 2. Fetch distinct student entry sessions
  const { data: studentEntrySessions } = useQuery({
    queryKey: ["student-entry-sessions-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/students?per_page=1");
      return ((res as any).data?.filter_options?.sessions || []) as string[];
    },
  });

  const academicSessionOptions = useMemo(() => {
    const list: { name: string; isActive: boolean }[] = [];
    const seen = new Set<string>();
    (sessions || []).forEach((s: any) => {
      const name = String(s?.name || "").trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        const isActive =
          Number(s?.is_current) === 1 ||
          Number(s?.is_active) === 1 ||
          s?.is_current === true ||
          s?.is_active === true;
        list.push({ name, isActive });
      }
    });
    return list.sort((a, b) => b.name.localeCompare(a.name));
  }, [sessions]);

  const entryCohortOptions = useMemo(() => {
    const names = new Set<string>();
    (studentEntrySessions || []).forEach((name: string) => {
      if (name) names.add(String(name).trim());
    });
    if (names.size === 0) {
      (sessions || []).forEach((s: any) => {
        if (s?.name) names.add(String(s.name).trim());
      });
    }
    return Array.from(names)
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
  }, [sessions, studentEntrySessions]);

  // Default to the Active Academic Session (e.g. 2025/2026)
  useEffect(() => {
    if (academicSessionOptions.length > 0 && !academicSession) {
      const active = academicSessionOptions.find((s) => s.isActive);
      setAcademicSession(active ? active.name : academicSessionOptions[0].name);
    }
  }, [academicSessionOptions, academicSession]);

  // 3. Fetch Departments
  const { data: departments } = useQuery({
    queryKey: ["admin-departments-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-departments");
      return (res as any).data || [];
    },
  });

  // 4. Fetch Programmes
  const { data: programmes } = useQuery({
    queryKey: ["admin-programmes-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-programmes");
      return (res as any).data || [];
    },
  });

  const filteredProgrammes = useMemo(() => {
    if (!programmes) return [];
    if (departmentId === "all") return programmes;
    return programmes.filter(
      (p: any) => String(p.department_id) === String(departmentId)
    );
  }, [programmes, departmentId]);

  // Set default programme when list loads
  useEffect(() => {
    if (filteredProgrammes.length > 0 && !programmeId) {
      setProgrammeId(filteredProgrammes[0].id);
    } else if (
      programmeId &&
      !filteredProgrammes.some((p: any) => p.id === programmeId)
    ) {
      if (filteredProgrammes.length > 0) {
        setProgrammeId(filteredProgrammes[0].id);
      }
    }
  }, [filteredProgrammes, programmeId]);

  // Calculate available Contacts / Semesters
  const selectedProgramme = programmes?.find((p: any) => p.id === programmeId);
  const progStructure = selectedProgramme?.programme_structure || "contact";
  const levelLabel = progStructure === "semester" ? "Semester" : "Contact";

  const availableLevels = useMemo(() => {
    if (!selectedProgramme) return [];
    if (selectedProgramme.programme_structure === "semester") {
      return ["First Semester", "Second Semester"];
    }
    const contacts = [
      "Contact 1",
      "Contact 2",
      "Contact 3",
      "Contact 4",
      "Contact 5",
      "Contact 6",
    ];
    if (entryMode === "direct_entry") {
      return contacts.filter((c) => c !== "Contact 1");
    }
    return contacts;
  }, [selectedProgramme, entryMode]);

  // Smart default Contact based on Academic Session, Entry Cohort, and Mode of Entry
  useEffect(() => {
    if (availableLevels.length === 0) return;
    if (!availableLevels.includes(level)) {
      setLevel(availableLevels[0]);
      return;
    }
    if (manualLevelChoice) return;

    const acadMatch = academicSession.match(/\b(19\d{2}|20\d{2})\b/);
    const refCohort =
      entryCohort !== "all"
        ? entryCohort
        : studentEntrySessions?.length === 1
          ? studentEntrySessions[0]
          : "";
    const cohortMatch = refCohort.match(/\b(19\d{2}|20\d{2})\b/);

    if (acadMatch && cohortMatch) {
      const acadYear = parseInt(acadMatch[1], 10);
      const cohortYear = parseInt(cohortMatch[1], 10);
      if (acadYear >= cohortYear) {
        const base = entryMode === "direct_entry" ? 2 : 1;
        const targetContact = `Contact ${base + (acadYear - cohortYear)}`;
        if (availableLevels.includes(targetContact) && level !== targetContact) {
          setLevel(targetContact);
        }
      }
    }
  }, [
    availableLevels,
    level,
    manualLevelChoice,
    academicSession,
    entryCohort,
    entryMode,
    studentEntrySessions,
  ]);

  const derivedSessionEnvelope = useMemo(() => {
    const yearMatch = academicSession.match(/\b(19\d{2}|20\d{2})\b/);
    const stepMatch = level.match(/contact\s*(\d+)/i);
    if (!yearMatch || !stepMatch) return null;
    const acadYear = parseInt(yearMatch[1], 10);
    const step = parseInt(stepMatch[1], 10);
    if (!acadYear || !step) return null;

    const freshEntryStart = acadYear - (step - 1);
    const freshEntryCohort = `${freshEntryStart}/${freshEntryStart + 1}`;
    const deEntryStart = step >= 2 ? acadYear - (step - 2) : null;
    const deEntryCohort = deEntryStart ? `${deEntryStart}/${deEntryStart + 1}` : null;

    if (entryMode === "fresh") {
      return {
        primary: academicSession,
        label: `Academic Session ${academicSession} • ${level} → Targets ${freshEntryCohort} Fresh Cohort`,
      };
    }
    if (entryMode === "direct_entry") {
      return {
        primary: academicSession,
        label: deEntryCohort
          ? `Academic Session ${academicSession} • ${level} → Targets ${deEntryCohort} Direct Entry Cohort`
          : "N/A (Direct Entry starts at Contact 2)",
      };
    }
    if (step === 1) {
      return {
        primary: academicSession,
        label: `Academic Session ${academicSession} • ${level} → Targets ${freshEntryCohort} Fresh Cohort (DE starts at Contact 2)`,
      };
    }
    return {
      primary: academicSession,
      label: `Academic Session ${academicSession} • ${level} → Targets ${freshEntryCohort} (Fresh) & ${deEntryCohort} (Direct Entry)`,
    };
  }, [academicSession, level, entryMode]);

  // 5. Query Course Roster Data
  const {
    data: rosterData,
    isLoading: loadingRoster,
    isFetching: fetchingRoster,
    refetch: refetchRoster,
  } = useQuery({
    queryKey: [
      "course-roster",
      academicSession,
      entryCohort,
      departmentId,
      programmeId,
      level,
      entryMode,
      selectedCourseId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        session_id: academicSession,
        cohort: entryCohort,
        semester_id: level,
        programme_id: programmeId,
        ...(departmentId !== "all" ? { department_id: departmentId } : {}),
        ...(selectedCourseId ? { course_id: selectedCourseId } : {}),
        ...(entryMode !== "all" ? { entry_mode: entryMode } : {}),
      });
      const res = await api.get(
        `/api/admin/course-registration/course-roster?${params.toString()}`
      );
      return res as {
        status: string;
        courses: CourseRosterItem[];
        selected_course: CourseRosterItem | null;
        students: StudentRosterItem[];
        summary: {
          total_cohort_students: number;
          registered_count: number;
          unregistered_count: number;
          with_scores_count: number;
          derived_academic_sessions?: string[];
          contacts_student_counts?: Record<string, number>;
        };
      };
    },
    enabled: !!(programmeId && academicSession && level),
  });

  // Auto-snap to first Contact that has students in this Academic Session if current Contact has 0 and user hasn't manually chosen
  useEffect(() => {
    if (manualLevelChoice) return;
    const counts = rosterData?.summary?.contacts_student_counts;
    if (!counts || !level) return;
    if ((counts[level] ?? 0) === 0) {
      const nonZero = availableLevels.find((lvl) => (counts[lvl] ?? 0) > 0);
      if (nonZero && nonZero !== level) {
        setLevel(nonZero);
      }
    }
  }, [rosterData?.summary?.contacts_student_counts, availableLevels, level, manualLevelChoice]);

  // Full curriculum courses list strictly for this programme and contact
  const allCoursesList = useMemo(() => rosterData?.courses || [], [rosterData?.courses]);

  const coreCourses = useMemo(() => {
    return allCoursesList.filter(
      (c) => String(c.type || "core").toLowerCase() === "core"
    );
  }, [allCoursesList]);

  const electiveCourses = useMemo(() => {
    return allCoursesList.filter(
      (c) => String(c.type || "").toLowerCase() === "elective"
    );
  }, [allCoursesList]);

  const coreCount = coreCourses.length;
  const electiveCount = electiveCourses.length;
  const totalCoursesCount = allCoursesList.length;

  // Fallback to "all" if "core" is active but there are 0 core courses
  const effectiveFilter =
    courseTypeFilter === "core" && coreCount === 0 && totalCoursesCount > 0
      ? "all"
      : courseTypeFilter;

  // Active courses based on the effective filter
  const activeCourses = useMemo(() => {
    if (effectiveFilter === "core") return coreCourses;
    if (effectiveFilter === "elective") return electiveCourses;
    return allCoursesList;
  }, [effectiveFilter, coreCourses, electiveCourses, allCoursesList]);

  // Apply quick search over active courses
  const filteredCoursesList = useMemo(() => {
    if (!courseSearch.trim()) return activeCourses;
    const q = courseSearch.toLowerCase().trim();
    return activeCourses.filter(
      (c) =>
        c.code?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q)
    );
  }, [activeCourses, courseSearch]);

  const currentCourse =
    allCoursesList.find((c) => c.id === selectedCourseId) ||
    rosterData?.selected_course ||
    null;

  // Sync selected course when active course list updates
  useEffect(() => {
    if (activeCourses.length > 0) {
      const isCurrentInActive = activeCourses.some(
        (c) => c.id === selectedCourseId
      );
      if (!selectedCourseId || !isCurrentInActive) {
        const preferred = activeCourses.find(
          (c) => c.id === rosterData?.selected_course?.id
        );
        setSelectedCourseId(preferred ? preferred.id : activeCourses[0].id);
      }
    }
  }, [activeCourses, rosterData?.selected_course, selectedCourseId]);

  // 6. Mutation for updating course roster
  const updateRosterMutation = useMutation({
    mutationFn: async ({
      action,
      studentIds,
      force = false,
    }: {
      action: "register" | "unregister" | "toggle";
      studentIds: string[];
      force?: boolean;
    }) => {
      try {
        const res = await api.post(
          "/api/admin/course-registration/course-roster/update",
          {
            session_id: academicSession,
            cohort: entryCohort,
            semester_id: level,
            programme_id: programmeId,
            course_id: selectedCourseId,
            action,
            student_ids: studentIds,
            force_remove_with_scores: force,
          }
        );
        return res;
      } catch (err: any) {
        if (err?.status === 409 && err?.body?.warning_type === "has_scores") {
          throw {
            isScoreWarning: true,
            message: err.body.message,
            affectedStudents: err.body.affected_students || [],
            studentIds,
          };
        }
        throw err;
      }
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || "Course registration updated successfully");
      queryClient.invalidateQueries({ queryKey: ["course-roster"] });
      queryClient.invalidateQueries({ queryKey: ["admin-registrations"] });
      setSelectedStudentIds([]);
      setScoreWarningModal(null);
    },
    onError: (err: any) => {
      if (err?.isScoreWarning) {
        setScoreWarningModal({
          message: err.message,
          affectedStudents: err.affectedStudents,
          pendingStudentIds: err.studentIds,
        });
      } else {
        toast.error(err?.message || "Failed to update course registration");
      }
    },
  });


  // Filter students based on search and status
  const filteredStudents = useMemo(() => {
    let list = rosterData?.students || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(q) ||
          s.matric_number?.toLowerCase().includes(q) ||
          s.admission_number?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
      );
    }

    if (statusFilter === "registered") {
      list = list.filter((s) => s.is_registered);
    } else if (statusFilter === "not_registered") {
      list = list.filter((s) => !s.is_registered);
    }

    return list;
  }, [rosterData?.students, searchQuery, statusFilter]);

  // Multi-selection helpers
  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.includes(s.student_id));

  const someFilteredSelected =
    filteredStudents.some((s) => selectedStudentIds.includes(s.student_id)) &&
    !allFilteredSelected;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Unselect all currently filtered students
      const filteredIds = new Set(filteredStudents.map((s) => s.student_id));
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      // Select all currently filtered students
      const newIds = new Set([
        ...selectedStudentIds,
        ...filteredStudents.map((s) => s.student_id),
      ]);
      setSelectedStudentIds(Array.from(newIds));
    }
  };

  const toggleSelectStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Actions
  const handleToggleStudent = (student: StudentRosterItem) => {
    if (updateRosterMutation.isPending) return;
    const action = student.is_registered ? "unregister" : "register";
    updateRosterMutation.mutate({
      action,
      studentIds: [student.student_id],
      force: false,
    });
  };

  const handleBatchRegister = () => {
    if (selectedStudentIds.length === 0 || updateRosterMutation.isPending) return;
    updateRosterMutation.mutate({
      action: "register",
      studentIds: selectedStudentIds,
      force: false,
    });
  };

  const handleBatchUnregister = () => {
    if (selectedStudentIds.length === 0 || updateRosterMutation.isPending) return;
    updateRosterMutation.mutate({
      action: "unregister",
      studentIds: selectedStudentIds,
      force: false,
    });
  };

  const handleConfirmDropWithScores = () => {
    if (!scoreWarningModal || updateRosterMutation.isPending) return;
    updateRosterMutation.mutate({
      action: "unregister",
      studentIds: scoreWarningModal.pendingStudentIds,
      force: true,
    });
  };

  const handleExportCsv = () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      toast.error("No student records to export.");
      return;
    }
    const headers = [
      "S/N",
      "Matric Number",
      "Admission Number",
      "Full Name",
      "Entry Session",
      "Academic Session",
      "Entry Mode",
      "Registration Status",
      "Registration Type",
      "Score",
      "Grade",
    ];

    const rows = filteredStudents.map((s, idx) => [
      String(idx + 1),
      `"${(s.matric_number || "").replace(/"/g, '""')}"`,
      `"${(s.admission_number || "").replace(/"/g, '""')}"`,
      `"${(s.full_name || "").replace(/"/g, '""')}"`,
      `"${(s.session_name || "").replace(/"/g, '""')}"`,
      `"${(s.academic_session_name || "").replace(/"/g, '""')}"`,
      `"${(s.entry_mode || "").replace(/"/g, '""')}"`,
      s.is_registered ? "Registered" : "Not Registered",
      `"${(s.registration_type || "N/A").replace(/"/g, '""')}"`,
      s.has_score ? String(s.score ?? "") : "",
      s.grade || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const courseCode = currentCourse ? currentCourse.code.replace(/\s+/g, "_") : "Course";
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Class_List_${courseCode}_${academicSession || "Roster"}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Class list exported as CSV");
  };

  return (
    <div className="space-y-6">
      {/* 1. TARGETING FILTERS CARD */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                Target Cohort & Curriculum
              </CardTitle>
              <CardDescription>
                Target students by Academic Session, Contact, and Programme (with optional Entry Cohort filter).
                Switch between courses to view who is registered and manage enrollments.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchRoster()}
              disabled={fetchingRoster}
              className="gap-2 self-start sm:self-auto"
            >
              <RefreshCw
                className={`w-4 h-4 ${fetchingRoster ? "animate-spin" : ""}`}
              />
              Refresh Roster
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Academic Session */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Academic Session *
              </Label>
              <Select
                value={academicSession}
                onValueChange={(val) => {
                  setAcademicSession(val);
                  setManualLevelChoice(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Academic Session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Academic Sessions</SelectItem>
                  {academicSessionOptions.map((s) => (
                    <SelectItem key={s.name} value={s.name}>
                      {s.name} {s.isActive ? "(Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entry Cohort (Optional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Entry Cohort
              </Label>
              <Select
                value={entryCohort}
                onValueChange={(val) => {
                  setEntryCohort(val);
                  setManualLevelChoice(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {entryCohortOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Department
              </Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments?.map((d: any) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Programme */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Programme *
              </Label>
              <Select value={programmeId} onValueChange={setProgrammeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Programme" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProgrammes.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact / Semester */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                {levelLabel} *
              </Label>
              <Select
                value={level}
                onValueChange={(val) => {
                  setLevel(val);
                  setManualLevelChoice(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${levelLabel}`} />
                </SelectTrigger>
                <SelectContent>
                  {availableLevels.map((lvl) => {
                    const cnt =
                      rosterData?.summary?.contacts_student_counts?.[lvl];
                    return (
                      <SelectItem key={lvl} value={lvl}>
                        {lvl}
                        {typeof cnt === "number" ? ` (${cnt})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Mode of Entry */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Mode of Entry
              </Label>
              <Select
                value={entryMode}
                onValueChange={(val) => {
                  setEntryMode(val);
                  setManualLevelChoice(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="fresh">Fresh (Contact 1 Base)</SelectItem>
                  <SelectItem value="direct_entry">Direct Entry (Contact 2 Base)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {derivedSessionEnvelope && (
            <div className="mt-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Target Academic Session Envelope:</strong>{" "}
                  {derivedSessionEnvelope.label}
                </span>
              </div>
              {Array.isArray(rosterData?.summary?.derived_academic_sessions) &&
                rosterData.summary.derived_academic_sessions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {rosterData.summary.derived_academic_sessions.map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="bg-background text-emerald-700 border-emerald-300 text-[11px]"
                      >
                        Academic Session: {s}
                      </Badge>
                    ))}
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. COURSE SWITCHER & COHORT STATS CARD */}
      <Card className="border-primary/20 bg-muted/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Course Selector Dropdown */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Select Course for {level || "this Contact"}:
                  </Label>
                  {/* Course Type Filter Pills */}
                  <div className="inline-flex items-center gap-1 bg-muted/80 p-0.5 rounded-md border text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setCourseTypeFilter("core");
                        if (coreCourses.length > 0 && !coreCourses.some((c) => c.id === selectedCourseId)) {
                          setSelectedCourseId(coreCourses[0].id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded transition-all font-medium ${
                        effectiveFilter === "core"
                          ? "bg-background text-primary shadow-xs font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Core Courses ({coreCount})
                    </button>
                    {electiveCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCourseTypeFilter("elective");
                          if (electiveCourses.length > 0 && !electiveCourses.some((c) => c.id === selectedCourseId)) {
                            setSelectedCourseId(electiveCourses[0].id);
                          }
                        }}
                        className={`px-2.5 py-1 rounded transition-all font-medium ${
                          effectiveFilter === "elective"
                            ? "bg-background text-primary shadow-xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Electives ({electiveCount})
                      </button>
                    )}
                    {electiveCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setCourseTypeFilter("all")}
                        className={`px-2.5 py-1 rounded transition-all font-medium ${
                          effectiveFilter === "all"
                            ? "bg-background text-primary shadow-xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All ({totalCoursesCount})
                      </button>
                    )}
                  </div>
                </div>

                {currentCourse && (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={String(currentCourse.type).toLowerCase() === "core" ? "default" : "secondary"}
                      className="uppercase font-mono text-xs"
                    >
                      {currentCourse.type || "core"}
                    </Badge>
                    <Badge variant="outline" className="font-medium text-xs">
                      {currentCourse.credit_unit} Units
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Select
                    value={selectedCourseId}
                    onValueChange={setSelectedCourseId}
                    disabled={filteredCoursesList.length === 0}
                  >
                    <SelectTrigger className="h-12 bg-background font-medium text-base shadow-sm">
                      <SelectValue
                        placeholder={
                          filteredCoursesList.length === 0
                            ? `No courses found`
                            : "Choose a course..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      {effectiveFilter === "all" ? (
                        <>
                          {coreCourses.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="font-bold text-primary">
                                Core Courses ({coreCourses.length})
                              </SelectLabel>
                              {filteredCoursesList
                                .filter((c) => String(c.type || "core").toLowerCase() === "core")
                                .map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    <div className="flex items-center justify-between gap-4 w-full">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-semibold text-foreground shrink-0">
                                          {c.code}
                                        </span>
                                        <span className="text-muted-foreground truncate max-w-xs sm:max-w-md">
                                          {c.title}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 ml-auto shrink-0">
                                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1 py-0">
                                          Core
                                        </Badge>
                                        <span
                                          className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${
                                            c.registered_count > 0
                                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                              : "bg-muted text-muted-foreground"
                                          }`}
                                        >
                                          {c.registered_count} / {c.total_cohort} Reg
                                        </span>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}
                          {electiveCourses.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="font-bold text-amber-600 dark:text-amber-400">
                                Elective Courses ({electiveCourses.length})
                              </SelectLabel>
                              {filteredCoursesList
                                .filter((c) => String(c.type || "").toLowerCase() === "elective")
                                .map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    <div className="flex items-center justify-between gap-4 w-full">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-semibold text-foreground shrink-0">
                                          {c.code}
                                        </span>
                                        <span className="text-muted-foreground truncate max-w-xs sm:max-w-md">
                                          {c.title}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 ml-auto shrink-0">
                                        <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1 py-0">
                                          Elective
                                        </Badge>
                                        <span
                                          className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${
                                            c.registered_count > 0
                                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                              : "bg-muted text-muted-foreground"
                                          }`}
                                        >
                                          {c.registered_count} / {c.total_cohort} Reg
                                        </span>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          )}
                        </>
                      ) : (
                        <SelectGroup>
                          <SelectLabel>
                            {level || "Contact"}{" "}
                            {effectiveFilter === "core" ? "Core" : "Elective"} Courses (
                            {filteredCoursesList.length})
                          </SelectLabel>
                          {filteredCoursesList.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex items-center justify-between gap-4 w-full">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-semibold text-foreground shrink-0">
                                    {c.code}
                                  </span>
                                  <span className="text-muted-foreground truncate max-w-xs sm:max-w-md">
                                    {c.title}
                                  </span>
                                </div>
                                <span
                                  className={`ml-auto shrink-0 text-xs font-mono font-medium px-2 py-0.5 rounded ${
                                    c.registered_count > 0
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {c.registered_count} / {c.total_cohort} Reg
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {activeCourses.length > 5 && (
                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 absolute left-3 top-4 text-muted-foreground" />
                    <Input
                      placeholder={`Filter ${effectiveFilter === "core" ? "core" : effectiveFilter === "elective" ? "elective" : ""} courses...`}
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                      className="pl-9 h-12 bg-background"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Quick Cohort Stat Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:w-auto w-full">
              <div className="bg-background rounded-lg p-3 border text-center shadow-xs">
                <div className="text-xs text-muted-foreground uppercase font-semibold">
                  Cohort
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {rosterData?.summary?.total_cohort_students ?? 0}
                </div>
              </div>

              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 rounded-lg p-3 border text-center shadow-xs">
                <div className="text-xs text-emerald-700 dark:text-emerald-400 uppercase font-semibold">
                  Registered
                </div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {rosterData?.summary?.registered_count ?? 0}
                </div>
              </div>

              <div className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 rounded-lg p-3 border text-center shadow-xs">
                <div className="text-xs text-amber-700 dark:text-amber-400 uppercase font-semibold">
                  Not Registered
                </div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {rosterData?.summary?.unregistered_count ?? 0}
                </div>
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 rounded-lg p-3 border text-center shadow-xs">
                <div className="text-xs text-blue-700 dark:text-blue-400 uppercase font-semibold">
                  With Scores
                </div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {rosterData?.summary?.with_scores_count ?? 0}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. ROSTER TABLE CONTROLS & BATCH ACTIONS */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Student Roster:{" "}
                <span className="font-semibold text-primary">
                  {currentCourse ? `${currentCourse.code} - ${currentCourse.title}` : "Course Roster"}
                </span>
              </CardTitle>
              <CardDescription>
                Showing {filteredStudents.length} student(s). Use individual switches or batch controls to manage course registrations.
              </CardDescription>
            </div>

            {/* Search and Status Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, matric..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(val: any) => setStatusFilter(val)}
              >
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All ({rosterData?.students?.length ?? 0})
                  </SelectItem>
                  <SelectItem value="registered">
                    Registered ({rosterData?.summary?.registered_count ?? 0})
                  </SelectItem>
                  <SelectItem value="not_registered">
                    Not Registered ({rosterData?.summary?.unregistered_count ?? 0})
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                disabled={filteredStudents.length === 0}
                className="h-9 gap-1.5"
                title="Print Class List"
              >
                <Printer className="w-4 h-4" />
                Print List
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={filteredStudents.length === 0}
                className="h-9 gap-1.5"
                title="Export Class List to CSV"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* BATCH ACTION BAR (Shown when students are selected) */}
          {selectedStudentIds.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                <CheckSquare className="w-4 h-4 text-primary" />
                <span>
                  <strong>{selectedStudentIds.length}</strong> student(s) selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStudentIds([])}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Selection
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleBatchRegister}
                  disabled={updateRosterMutation.isPending}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {updateRosterMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  Register Selected ({selectedStudentIds.length})
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBatchUnregister}
                  disabled={updateRosterMutation.isPending}
                  className="gap-1.5"
                >
                  {updateRosterMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserMinus className="w-4 h-4" />
                  )}
                  Drop Selected ({selectedStudentIds.length})
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loadingRoster ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Loading course roster &amp; registration data...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-25" />
              <h3 className="font-medium text-base text-foreground">No students found</h3>
              <p className="text-sm mt-1 max-w-sm mx-auto">
                No students match your selected filters or search query in this cohort.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <Checkbox
                        checked={
                          allFilteredSelected
                            ? true
                            : someFilteredSelected
                            ? "indeterminate"
                            : false
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-12 text-center">S/N</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Matric Number</TableHead>
                    <TableHead>Academic Session</TableHead>
                    <TableHead>Mode of Entry</TableHead>
                    <TableHead>Registration Status</TableHead>
                    <TableHead>Recorded Score</TableHead>
                    <TableHead className="text-center w-32">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((st, idx) => {
                    const isSelected = selectedStudentIds.includes(st.student_id);
                    return (
                      <TableRow
                        key={st.student_id}
                        className={
                          isSelected
                            ? "bg-primary/5 hover:bg-primary/10"
                            : undefined
                        }
                      >
                        {/* Checkbox */}
                        <TableCell className="text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectStudent(st.student_id)}
                            aria-label={`Select ${st.full_name}`}
                          />
                        </TableCell>

                        {/* S/N */}
                        <TableCell className="text-center text-muted-foreground text-xs font-mono">
                          {idx + 1}
                        </TableCell>

                        {/* Student Name */}
                        <TableCell>
                          <div className="font-semibold text-foreground">
                            {st.full_name}
                          </div>
                          {st.admission_number && st.admission_number !== st.matric_number && (
                            <div className="text-xs text-muted-foreground font-mono">
                              Adm: {st.admission_number}
                            </div>
                          )}
                        </TableCell>

                        {/* Matric Number */}
                        <TableCell>
                          {st.matric_number ? (
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border">
                              {st.matric_number}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Unassigned
                            </span>
                          )}
                        </TableCell>

                        {/* Academic Session & Entry Set */}
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {st.academic_session_name ? (
                              <Badge
                                variant="outline"
                                className="w-fit text-[11px] font-medium bg-emerald-50/70 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                              >
                                {st.academic_session_name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                            {st.session_name && (
                              <span className="text-[10px] text-muted-foreground">
                                Entry: {st.session_name}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Mode of Entry */}
                        <TableCell>
                          <Badge
                            variant={
                              st.entry_mode?.toLowerCase().includes("de") ||
                              st.entry_mode?.toLowerCase().includes("direct")
                                ? "secondary"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {st.entry_mode || "Fresh"}
                          </Badge>
                        </TableCell>

                        {/* Registration Status */}
                        <TableCell>
                          {st.is_registered ? (
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Registered
                              </Badge>
                              {st.registration_type && (
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                  {st.registration_type}
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground border-dashed gap-1 text-xs"
                            >
                              <XCircle className="w-3.5 h-3.5 text-muted-foreground/60" />
                              Not Registered
                            </Badge>
                          )}
                        </TableCell>

                        {/* Recorded Score */}
                        <TableCell>
                          {st.has_score ? (
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 text-xs gap-1 font-mono"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                Score: {st.score ?? "—"} ({st.grade ?? "—"})
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </TableCell>

                        {/* Action: Toggle Switch */}
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={st.is_registered}
                              onCheckedChange={() => handleToggleStudent(st)}
                              disabled={updateRosterMutation.isPending}
                            />
                            <span className="text-xs font-medium w-14 text-left">
                              {st.is_registered ? "Registered" : "Drop"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. SCORE SAFETY WARNING CONFIRMATION MODAL */}
      <Dialog
        open={!!scoreWarningModal}
        onOpenChange={(open) => !open && setScoreWarningModal(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Recorded Examination Scores Detected!
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              {scoreWarningModal?.message}
            </DialogDescription>
          </DialogHeader>

          {scoreWarningModal && scoreWarningModal.affectedStudents.length > 0 && (
            <div className="my-2 border rounded-md max-h-56 overflow-y-auto divide-y bg-muted/30">
              {scoreWarningModal.affectedStudents.map((st) => (
                <div
                  key={st.student_id}
                  className="p-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-foreground">
                      {st.full_name}
                    </div>
                    <div className="text-muted-foreground font-mono">
                      {st.matric_number || "No Matric"}
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-amber-700 dark:text-amber-300">
                    Score: {st.score ?? "—"} ({st.grade ?? "—"})
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Dropping their course registration will cause these students and their
            recorded examination scores to be omitted from the official broadsheet.
          </p>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setScoreWarningModal(null)}
              disabled={updateRosterMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDropWithScores}
              disabled={updateRosterMutation.isPending}
              className="gap-2"
            >
              {updateRosterMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Drop Registration Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default CourseRosterTab;

