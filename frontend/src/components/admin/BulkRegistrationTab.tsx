import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Loader2,
  Users,
  Plus,
  Search,
  X,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

interface BulkRegistrationTabProps {
  session?: string;
  semester?: string;
}

type BulkMode = "ensure" | "replace";

export function BulkRegistrationTab({
  session: _sessionProp,
  semester: _semesterProp,
}: BulkRegistrationTabProps) {
  const queryClient = useQueryClient();
  const [academicSession, setAcademicSession] = useState("");
  const [entrySession, setEntrySession] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [programmeId, setProgrammeId] = useState("");
  const [level, setLevel] = useState("");
  const [entryMode, setEntryMode] = useState("all");
  const [manualLevelChoice, setManualLevelChoice] = useState(false);
  const [mode, setMode] = useState<BulkMode>("ensure");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [replaceConfirmText, setReplaceConfirmText] = useState("");

  const [selectedCoreIds, setSelectedCoreIds] = useState<string[]>([]);
  const [selectedElectives, setSelectedElectives] = useState<string[]>([]);
  const [extraCourses, setExtraCourses] = useState<any[]>([]);
  const [extraCourseSearch, setExtraCourseSearch] = useState("");

  // Fetch Departments
  const { data: departments } = useQuery({
    queryKey: ["admin-departments-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-departments");
      return (res as any).data || [];
    },
  });

  // Fetch Programmes
  const { data: programmes } = useQuery({
    queryKey: ["admin-programmes-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-programmes");
      return (res as any).data || [];
    },
  });

  // Fetch Sessions
  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-sessions");
      return (res as any).data || [];
    },
  });

  // Fetch all catalogue courses for extra course search
  const { data: allCatalogueCourses } = useQuery({
    queryKey: ["admin-all-courses-catalogue"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-courses");
      return (res as any).data || [];
    },
  });

  // Student entry sessions
  const { data: studentEntrySessions } = useQuery({
    queryKey: ["student-entry-sessions-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/students?per_page=1");
      return ((res as any).data?.filter_options?.sessions || []) as string[];
    },
  });

  const academicSessionOptions = React.useMemo(() => {
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

  const entrySessionOptions = React.useMemo(() => {
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

  const filteredProgrammes = React.useMemo(() => {
    if (!programmes) return [];
    if (departmentId === "all") return programmes;
    return programmes.filter(
      (p: any) => String(p.department_id) === String(departmentId),
    );
  }, [programmes, departmentId]);

  const selectedProgramme = programmes?.find((p: any) => p.id === programmeId);
  const progStructure = selectedProgramme?.programme_structure || "contact";
  const levelLabel = progStructure === "semester" ? "Semester *" : "Contact *";

  const availableLevels = React.useMemo(() => {
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
    if (entryMode === "Direct Entry") {
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
      entrySession !== "all"
        ? entrySession
        : studentEntrySessions?.length === 1
          ? studentEntrySessions[0]
          : "";
    const cohortMatch = refCohort.match(/\b(19\d{2}|20\d{2})\b/);

    if (acadMatch && cohortMatch) {
      const acadYear = parseInt(acadMatch[1], 10);
      const cohortYear = parseInt(cohortMatch[1], 10);
      if (acadYear >= cohortYear) {
        const base = entryMode === "Direct Entry" ? 2 : 1;
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
    entrySession,
    entryMode,
    studentEntrySessions,
  ]);

  const derivedSessionEnvelope = React.useMemo(() => {
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

    if (entryMode === "Fresh") {
      return {
        primary: academicSession,
        label: `Academic Session ${academicSession} • ${level} → Targets ${freshEntryCohort} Fresh Cohort`,
      };
    }
    if (entryMode === "Direct Entry") {
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

  const isOverwrite = mode === "replace";

  // Fetch Preview Data
  const { data: previewData, isFetching: loadingPreview } = useQuery({
    queryKey: [
      "bulk-registration-preview",
      academicSession,
      entrySession,
      entryMode,
      programmeId,
      level,
      mode,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        reg_session_id: academicSession,
        reg_semester_id: level,
        entry_session: entrySession,
        entry_mode: entryMode,
        programme_id: programmeId,
        level: level,
        mode: mode,
        overwrite: isOverwrite ? "1" : "0",
      });
      const res = await api.get(
        `/api/admin/course-registration/bulk/preview?${params.toString()}`,
      );
      return (res as any).data || res;
    },
    enabled: !!(programmeId && academicSession && level),
  });

  // Auto-snap to first Contact that has students in this Academic Session if current Contact has 0 and user hasn't manually chosen
  useEffect(() => {
    if (manualLevelChoice) return;
    const counts = previewData?.contacts_student_counts;
    if (!counts || !level) return;
    if ((counts[level] ?? 0) === 0) {
      const nonZero = availableLevels.find((lvl) => (counts[lvl] ?? 0) > 0);
      if (nonZero && nonZero !== level) {
        setLevel(nonZero);
      }
    }
  }, [previewData?.contacts_student_counts, availableLevels, level, manualLevelChoice]);

  useEffect(() => {
    if (previewData?.core_courses) {
      setSelectedCoreIds(previewData.core_courses.map((c: any) => c.id));
    } else {
      setSelectedCoreIds([]);
    }
    setSelectedElectives([]);
  }, [previewData?.core_courses]);

  const allPreviewCourseIds = React.useMemo(() => {
    const ids = new Set<string>();
    (previewData?.core_courses || []).forEach((c: any) => ids.add(c.id));
    (previewData?.elective_courses || []).forEach((c: any) => ids.add(c.id));
    extraCourses.forEach((c: any) => ids.add(c.id));
    return ids;
  }, [previewData, extraCourses]);

  const matchingExtraCourses = React.useMemo(() => {
    const q = extraCourseSearch.trim().toLowerCase();
    if (!q || !Array.isArray(allCatalogueCourses)) return [];
    return allCatalogueCourses
      .filter(
        (c: any) =>
          !allPreviewCourseIds.has(c.id) &&
          (String(c.code || "")
            .toLowerCase()
            .includes(q) ||
            String(c.title || "")
              .toLowerCase()
              .includes(q)),
      )
      .slice(0, 12);
  }, [extraCourseSearch, allCatalogueCourses, allPreviewCourseIds]);

  const totalSelectedCoursesCount =
    selectedCoreIds.length + selectedElectives.length + extraCourses.length;

  const totalSelectedCredits = React.useMemo(() => {
    let sum = 0;
    const coreSet = new Set(selectedCoreIds);
    const electiveSet = new Set(selectedElectives);
    (previewData?.core_courses || []).forEach((c: any) => {
      if (coreSet.has(c.id)) {
        sum += Number(c.credit_units ?? c.credit_unit ?? 0);
      }
    });
    (previewData?.elective_courses || []).forEach((c: any) => {
      if (electiveSet.has(c.id)) {
        sum += Number(c.credit_units ?? c.credit_unit ?? 0);
      }
    });
    extraCourses.forEach((c: any) => {
      sum += Number(c.credit_units ?? c.credit_unit ?? 0);
    });
    return sum;
  }, [previewData, selectedCoreIds, selectedElectives, extraCourses]);

  const programmeName = selectedProgramme?.name || "";
  const isReplaceConfirmed =
    mode !== "replace" ||
    replaceConfirmText.trim().toLowerCase() === programmeName.trim().toLowerCase();

  const processMutation = useMutation({
    mutationFn: async () => {
      if (!previewData) return;

      const selectedCourseIds = Array.from(
        new Set([
          ...selectedCoreIds,
          ...selectedElectives,
          ...extraCourses.map((c) => c.id),
        ]),
      );

      if (selectedCourseIds.length === 0) {
        throw new Error("Please select at least one course to register.");
      }

      if (mode === "replace" && !isReplaceConfirmed) {
        throw new Error(
          `Please type the exact programme name "${programmeName}" to confirm replacement.`,
        );
      }

      const payload = {
        reg_session_id: academicSession,
        reg_semester_id: level,
        entry_session: entrySession,
        entry_mode: entryMode,
        programme_id: programmeId,
        level: level,
        mode: mode,
        overwrite: isOverwrite,
        selected_course_ids: selectedCourseIds,
      };

      const res = await api.post(
        "/api/admin/course-registration/bulk/process",
        payload,
      );
      return (res as any).data || res;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Bulk registration executed successfully");
      setReplaceConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
      queryClient.invalidateQueries({
        queryKey: ["bulk-registration-preview"],
      });
    },
    onError: (err: any) =>
      toast.error(
        err.response?.data?.message ||
          err?.message ||
          "Failed to execute bulk registration",
      ),
  });

  return (
    <div className="space-y-6">
      {/* 1. Legacy Cohort Notice Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-4 rounded-lg flex items-start gap-3 text-sm">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Legacy Bulk Registration:</span> For legacy cohorts. Registration windows, credit limits and fees are skipped.
        </div>
      </div>

      {/* 2. Step 1: Cohort Targeting Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Step 1: Target Academic Session &amp; Cohort Filters</CardTitle>
          <CardDescription>
            Select the Academic Session, Programme, and Contact/Semester (with optional Entry Cohort filter).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-6 items-end">
            <div className="space-y-2">
              <Label>
                Academic Session <span className="text-red-500">*</span>
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
                    <SelectItem key={`acad-${s.name}`} value={s.name}>
                      {s.name} {s.isActive ? "(Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Entry Cohort</Label>
              <Select
                value={entrySession}
                onValueChange={(val) => {
                  setEntrySession(val);
                  setManualLevelChoice(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {entrySessionOptions.map((sessName) => (
                    <SelectItem key={`entry-${sessName}`} value={sessName}>
                      {sessName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={departmentId}
                onValueChange={(val) => {
                  setDepartmentId(val);
                  setProgrammeId("");
                  setLevel("");
                  setManualLevelChoice(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments?.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Programme <span className="text-red-500">*</span>
              </Label>
              <Select
                value={programmeId}
                onValueChange={(val) => {
                  setProgrammeId(val);
                  setLevel("");
                  setManualLevelChoice(false);
                  setReplaceConfirmText("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select programme" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProgrammes?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{levelLabel}</Label>
              <Select
                value={level}
                onValueChange={(val) => {
                  setLevel(val);
                  setManualLevelChoice(true);
                }}
                disabled={!programmeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${progStructure}`} />
                </SelectTrigger>
                <SelectContent>
                  {availableLevels.map((lvl) => {
                    const cnt = previewData?.contacts_student_counts?.[lvl];
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

            <div className="space-y-2">
              <Label>Mode of Entry</Label>
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
                  <SelectItem value="Fresh">Fresh (Contact 1 Base)</SelectItem>
                  <SelectItem value="Direct Entry">Direct Entry (Contact 2 Base)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {derivedSessionEnvelope && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Target Academic Session Envelope:</strong>{" "}
                  {derivedSessionEnvelope.label}
                </span>
              </div>
              {Array.isArray(previewData?.derived_academic_sessions) &&
                previewData.derived_academic_sessions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {previewData.derived_academic_sessions.map((s: string) => (
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

          {/* Operation Modes: Ensure (Default) vs Replace (Advanced) */}
          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Registration Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Choose how existing course registrations in this cohort should be handled.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" /> Hide Advanced Options
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3.5 h-3.5" /> Show Advanced Options
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                  mode === "ensure"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/40"
                }`}
              >
                <input
                  type="radio"
                  name="bulk-mode-choice"
                  className="mt-1"
                  checked={mode === "ensure"}
                  onChange={() => {
                    setMode("ensure");
                    setReplaceConfirmText("");
                  }}
                />
                <div className="space-y-1 text-sm">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    Ensure these courses (Default)
                    <Badge variant="secondary" className="text-xs font-normal">
                      Recommended
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Ensures every student in the cohort has the selected courses without removing any courses they already registered. If a student is unregistered, a registration is created. Existing courses and carryovers are preserved.
                  </div>
                </div>
              </label>

              {showAdvanced && (
                <div className="space-y-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5 animate-in fade-in duration-150">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="bulk-mode-choice"
                      className="mt-1"
                      checked={mode === "replace"}
                      onChange={() => setMode("replace")}
                    />
                    <div className="space-y-1 text-sm">
                      <div className="font-semibold text-destructive flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-destructive" />
                        Replace (Soft-drop normal courses and replace with selection)
                      </div>
                      <div className="text-xs text-muted-foreground leading-relaxed">
                        Soft-drops all existing non-carryover courses for this cohort and replaces them with the selection below. Carryovers are preserved. Scores are protected unless explicitly forced.
                      </div>
                    </div>
                  </label>

                  {mode === "replace" && (
                    <div className="pl-6 pt-2 space-y-2">
                      <Label className="text-xs font-semibold text-destructive">
                        Confirmation Required: Type the programme name to proceed
                      </Label>
                      <Input
                        placeholder={`Type "${programmeName}"`}
                        value={replaceConfirmText}
                        onChange={(e) => setReplaceConfirmText(e.target.value)}
                        className="max-w-md h-9 text-xs bg-background"
                      />
                      {programmeName && replaceConfirmText && !isReplaceConfirmed && (
                        <p className="text-xs text-destructive">
                          Text must match &ldquo;{programmeName}&rdquo; exactly.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {loadingPreview && !previewData && (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading cohort information...</p>
        </div>
      )}

      {/* 3. Step 2 & 3: Course Picker & Counts-Only Preview */}
      {previewData && (
        <Card className="border-primary/50 shadow-xs">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <CardTitle className="text-lg">Step 2: Course Picker &amp; Counts Preview</CardTitle>
                <CardDescription>
                  Select courses to assign to the cohort and review the summary counts below.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-3.5 py-1.5 rounded-lg font-medium text-sm">
                <Users className="h-4 w-4" />
                {previewData.eligible_students_count} Target Student(s)
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {/* Counts-Only Preview Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-4 bg-muted/40 rounded-lg border">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase font-semibold">
                  Target Cohort
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {previewData.eligible_students_count || 0}
                </div>
                <div className="text-xs text-muted-foreground">Students in cohort</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase font-semibold">
                  Already Registered
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  {previewData.already_registered_count || 0}
                </div>
                <div className="text-xs text-muted-foreground">Existing records</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase font-semibold">
                  Unregistered
                </div>
                <div className="text-2xl font-bold text-amber-600">
                  {previewData.unregistered_count || 0}
                </div>
                <div className="text-xs text-muted-foreground">Need new record</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase font-semibold">
                  Courses Selected
                </div>
                <div className="text-2xl font-bold text-primary">
                  {totalSelectedCoursesCount}
                </div>
                <div className="text-xs text-muted-foreground">Courses in batch</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase font-semibold">
                  Total Credits Selected
                </div>
                <div className="text-2xl font-bold text-primary">
                  {totalSelectedCredits}
                </div>
                <div className="text-xs text-muted-foreground">Credit units in batch</div>
              </div>
            </div>

            <div className="p-3.5 bg-primary/5 rounded-md border border-primary/20 text-sm text-foreground">
              {mode === "replace" ? (
                <span>
                  <strong>Replace Mode:</strong> {previewData.eligible_students_count} student(s) will have their existing non-carryover courses soft-dropped and replaced with the <strong>{totalSelectedCoursesCount}</strong> selected course(s) (<strong>{totalSelectedCredits} credit units</strong>).
                </span>
              ) : (
                <span>
                  <strong>Ensure Mode:</strong> {previewData.eligible_students_count} student(s) will be ensured to have the <strong>{totalSelectedCoursesCount}</strong> selected course(s) (<strong>{totalSelectedCredits} credit units</strong>). Existing courses will remain untouched.
                </span>
              )}
            </div>

            {/* Core Courses */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-foreground">
                  Core Courses ({selectedCoreIds.length}/
                  {previewData.core_courses?.length || 0} selected)
                </h3>
                {(previewData.core_courses?.length || 0) > 0 && (
                  <div className="space-x-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        setSelectedCoreIds(
                          previewData.core_courses.map((c: any) => c.id),
                        )
                      }
                    >
                      Select All Core
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setSelectedCoreIds([])}
                    >
                      Clear Core
                    </Button>
                  </div>
                )}
              </div>
              <Table className="border rounded-md">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.core_courses?.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCoreIds.includes(c.id)}
                          onCheckedChange={(checked) => {
                            if (checked)
                              setSelectedCoreIds((prev) => [...prev, c.id]);
                            else
                              setSelectedCoreIds((prev) =>
                                prev.filter((id) => id !== c.id),
                              );
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{c.code}</TableCell>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>{c.credit_units}</TableCell>
                    </TableRow>
                  ))}
                  {previewData.core_courses?.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-4"
                      >
                        No core courses found for this level/programme.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Elective Courses */}
            <div>
              <h3 className="font-semibold text-sm mb-1 text-foreground">
                Elective Courses ({selectedElectives.length}/
                {previewData.elective_courses?.length || 0} selected)
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Select any electives to include in this batch operation.
              </p>
              <Table className="border rounded-md">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.elective_courses?.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedElectives.includes(c.id)}
                          onCheckedChange={(checked) => {
                            if (checked)
                              setSelectedElectives((prev) => [...prev, c.id]);
                            else
                              setSelectedElectives((prev) =>
                                prev.filter((id) => id !== c.id),
                              );
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{c.code}</TableCell>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>{c.credit_units}</TableCell>
                    </TableRow>
                  ))}
                  {previewData.elective_courses?.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-4"
                      >
                        No elective courses found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Extra courses from catalogue */}
            <div className="border rounded-md p-4 space-y-3 bg-muted/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-sm">
                    Include Additional Course(s) from Catalogue
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Need to add a course from another Contact/Level or Department? Search and add it here.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search course code or title..."
                    className="pl-8 h-9 text-xs"
                    value={extraCourseSearch}
                    onChange={(e) => setExtraCourseSearch(e.target.value)}
                  />
                </div>
              </div>

              {matchingExtraCourses.length > 0 && (
                <div className="border rounded-md bg-background max-h-48 overflow-y-auto divide-y">
                  {matchingExtraCourses.map((c: any) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50"
                    >
                      <div>
                        <span className="font-semibold">{c.code}</span> &mdash;{" "}
                        {c.title}{" "}
                        <span className="text-muted-foreground">
                          ({c.credit_units}u &middot; {c.level || "N/A"} &middot;{" "}
                          {c.programme_name || "General"})
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setExtraCourses((prev) => [...prev, c]);
                          setExtraCourseSearch("");
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {extraCourses.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {extraCourses.map((c: any) => (
                    <Badge
                      key={c.id}
                      variant="secondary"
                      className="flex items-center gap-1.5 py-1 px-2.5 text-xs"
                    >
                      <span>
                        <strong>{c.code}</strong> ({c.credit_units}u)
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setExtraCourses((prev) =>
                            prev.filter((item) => item.id !== c.id),
                          )
                        }
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>

          {previewData.eligible_students_count > 0 && (
            <CardFooter className="justify-between border-t pt-4 bg-muted/20">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{totalSelectedCoursesCount}</span> course(s) &bull;{" "}
                <span className="font-semibold text-primary">{totalSelectedCredits} credit units</span> selected for{" "}
                <span className="font-semibold text-foreground">{previewData.eligible_students_count}</span> student(s)
              </div>
              <Button
                size="lg"
                onClick={() => processMutation.mutate()}
                disabled={
                  processMutation.isPending ||
                  totalSelectedCoursesCount === 0 ||
                  (mode === "replace" && !isReplaceConfirmed)
                }
              >
                {processMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {mode === "replace"
                  ? `Execute Replace (${totalSelectedCredits} Units • ${previewData.eligible_students_count} Students)`
                  : `Ensure ${totalSelectedCoursesCount} Course(s) (${totalSelectedCredits} Units) for ${previewData.eligible_students_count} Students`}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}

export default BulkRegistrationTab;
