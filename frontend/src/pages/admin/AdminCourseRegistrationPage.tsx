import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BulkCarryoverDropTab } from "@/components/admin/BulkCarryoverDropTab";
import { CourseRosterTab } from "@/components/admin/CourseRosterTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";

import { AdminLayout } from "@/components/layouts/AdminLayout";
import { format } from "date-fns";
import {
  Loader2,
  Printer,
  Trash2,
  AlertTriangle,
  Search,
  RotateCcw,
  Plus,
  BookOpen,
  Settings,
  RefreshCw,
  Calendar,
  GraduationCap,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkRegistrationTab } from "@/components/admin/BulkRegistrationTab";
import {
  buildRegistrationDetailsPath,
  buildRegistrationProcessPayload,
  collectStudentRegistrationIds,
  mergeStudentRegistrationDetails,
  registrationDetailsQueryKey,
  type RegistrationDetails,
  type RegistrationIndexRow,
  type RegistrationProcessInput,
} from "@/lib/courseRegistrationReview";

export default function AdminCourseRegistrationPage() {
  const [session, setSession] = useState("2025/2026");
  const [semester, setSemester] = useState("first");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [entryModeFilter, setEntryModeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalContactFilter, setModalContactFilter] = useState("all");
  const [selectedRegistration, setSelectedRegistration] = useState<{
    registrationId: string;
    studentId: string;
  } | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [courseId, setCourseId] = useState("");

  // Single-student Add/Remove course state inside Review Dialog
  const [singleAddCourseId, setSingleAddCourseId] = useState("");
  const [singleAddRegType, setSingleAddRegType] = useState<string>("auto");
  const [singleAddSearch, setSingleAddSearch] = useState("");
  const [singleAddAllProgrammes, setSingleAddAllProgrammes] = useState(false);

  // Bulk Add/Remove courses modal state
  const [amendRequest, setAmendRequest] = useState<{
    mode: "selected" | "all";
    registrationIds?: string[];
  } | null>(null);
  const [amendOperation, setAmendOperation] = useState<"add" | "remove">("add");
  const [amendSelectedCourseIds, setAmendSelectedCourseIds] = useState<
    string[]
  >([]);
  const [amendRegType, setAmendRegType] = useState<string>("auto");
  const [amendCourseSearch, setAmendCourseSearch] = useState("");
  const [amendProgFilter, setAmendProgFilter] = useState<string>("all");
  const [amendLevelFilter, setAmendLevelFilter] = useState<string>("all");
  const [amendForceRemoveScores, setAmendForceRemoveScores] = useState(false);

  // Settings Dialog state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Credit load rules state
  const [newRuleProgId, setNewRuleProgId] = useState("");
  const [newRuleLevel, setNewRuleLevel] = useState("Contact 1");
  const [newRuleMin, setNewRuleMin] = useState("15");
  const [newRuleMax, setNewRuleMax] = useState("24");
  const [globalDefaultMin, setGlobalDefaultMin] = useState("15");
  const [globalDefaultMax, setGlobalDefaultMax] = useState("24");

  const syncCarryoversMutation = useMutation({
    mutationFn: async (payload: {
      student_id: string;
      session_id: string;
      semester_id: string;
    }) => {
      const res = await api.post("/admin_carryover_sync/commit", payload);
      return (res as any).data || res;
    },
    onSuccess: (data: any) => {
      toast.success(data?.message || "Carryovers synced for student");
      if (selectedRegistration) {
        queryClient.invalidateQueries({
          queryKey: registrationDetailsQueryKey(
            selectedRegistration.registrationId,
          ),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to sync carryovers",
      );
    },
  });

  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ["admin-departments-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-departments");
      return (res as any).data || [];
    },
  });

  const { data: programmes } = useQuery({
    queryKey: ["admin-programmes-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-programmes");
      return (res as any).data || [];
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-sessions");
      return (res as any).data || [];
    },
  });

  const { data: studentEntrySessions } = useQuery({
    queryKey: ["admin-student-entry-sessions"],
    queryFn: async () => {
      const res = await api.get("/api/admin/students?per_page=1");
      return (res as any)?.data?.filter_options?.sessions || [];
    },
  });

  const { data: semesters } = useQuery({
    queryKey: ["admin-semesters-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-semesters");
      return (res as any).data || [];
    },
  });

  const { data: allCourses } = useQuery({
    queryKey: ["admin-all-courses-catalogue"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-courses");
      return (res as any).data || [];
    },
  });

  const { data: creditRulesData, refetch: refetchCreditRules } = useQuery({
    queryKey: ["credit-load-rules"],
    queryFn: async () => {
      const res = await api.get("/api/admin/course-registration/credit-rules");
      if (Array.isArray((res as any)?.data)) return (res as any).data;
      if (Array.isArray((res as any)?.data?.data)) return (res as any).data.data;
      if (Array.isArray(res)) return res;
      return [];
    },
  });

  const globalDefaultRule = React.useMemo(() => {
    if (!Array.isArray(creditRulesData)) return null;
    return (
      creditRulesData.find(
        (r: any) =>
          String(r.programme_id || "").toUpperCase() === "GLOBAL" &&
          String(r.level || "").toUpperCase() === "ALL",
      ) || null
    );
  }, [creditRulesData]);

  useEffect(() => {
    if (globalDefaultRule) {
      setGlobalDefaultMin(String(globalDefaultRule.min_credits ?? 15));
      setGlobalDefaultMax(String(globalDefaultRule.max_credits ?? 24));
    }
  }, [globalDefaultRule]);

  const saveCreditRuleMutation = useMutation({
    mutationFn: async (
      rule:
        | {
            programme_id: string;
            level: string;
            min_credits: number;
            max_credits: number;
          }
        | {
            action: "delete";
            id: string;
          },
    ) => {
      const res = await api.post(
        "/api/admin/course-registration/credit-rules",
        rule,
      );
      return res;
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || "Credit rule updated successfully");
      queryClient.invalidateQueries({ queryKey: ["credit-load-rules"] });
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
      if (selectedRegistration) {
        queryClient.invalidateQueries({
          queryKey: registrationDetailsQueryKey(
            selectedRegistration.registrationId,
          ),
        });
      }
      refetchCreditRules();
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          err?.message ||
          "Failed to update credit rule",
      );
    },
  });

  const availableRuleLevels = React.useMemo(() => {
    const prog = programmes?.find(
      (p: any) => String(p.id) === String(newRuleProgId),
    );
    let levels: string[];
    if (prog?.programme_structure === "semester") {
      levels = [
        "ALL",
        "100 Level",
        "200 Level",
        "300 Level",
        "400 Level",
        "500 Level",
        "First Semester",
        "Second Semester",
      ];
    } else {
      const maxYears = prog?.duration_years ? prog.duration_years + 2 : 6;
      levels = [
        "ALL",
        ...Array.from({ length: maxYears }).map((_, i) => `Contact ${i + 1}`),
      ];
    }
    const set = new Set(levels);
    if (newRuleLevel && !set.has(newRuleLevel)) {
      set.add(newRuleLevel);
    }
    return Array.from(set);
  }, [programmes, newRuleProgId, newRuleLevel]);

  const academicSessionOptions = React.useMemo(() => {
    const names = new Set<string>();
    (sessions || []).forEach((s: any) => {
      const name = typeof s === "string" ? s : s?.name;
      if (name && String(name).trim()) names.add(String(name).trim());
    });
    return Array.from(names).sort().reverse();
  }, [sessions]);

  const entryCohortOptions = React.useMemo(() => {
    const names = new Set<string>();
    (studentEntrySessions || []).forEach((s: any) => {
      const name = typeof s === "string" ? s : s?.name;
      if (name && String(name).trim()) names.add(String(name).trim());
    });
    if (names.size === 0) {
      (sessions || []).forEach((s: any) => {
        const name = typeof s === "string" ? s : s?.name;
        if (name && String(name).trim()) names.add(String(name).trim());
      });
    }
    return Array.from(names).sort().reverse();
  }, [studentEntrySessions, sessions]);

  const availableSessions = React.useMemo(() => {
    const names = new Set<string>();
    academicSessionOptions.forEach((n) => names.add(n));
    entryCohortOptions.forEach((n) => names.add(n));
    return Array.from(names).sort().reverse();
  }, [academicSessionOptions, entryCohortOptions]);

  const filteredProgrammes = React.useMemo(() => {
    if (!programmes) return [];
    if (departmentFilter === "all") return programmes;
    return programmes.filter(
      (p: any) => String(p.department_id) === String(departmentFilter),
    );
  }, [programmes, departmentFilter]);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["course-registration-settings", session, semester],
    queryFn: async () => {
      const res = await api.get(
        `/api/admin/course-registration/settings?session_id=${session}&semester_id=${semester}`,
      );
      return (res as any).data;
    },
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: registrations, isLoading: registrationsLoading } = useQuery({
    queryKey: [
      "course-registrations",
      sessionFilter,
      cohortFilter,
      departmentFilter,
      semesterFilter,
      statusFilter,
      programmeFilter,
      levelFilter,
      entryModeFilter,
      searchQuery,
    ],
    queryFn: async () => {
      let url = `/api/admin/course-registration/registrations?session_id=${encodeURIComponent(sessionFilter)}&semester_id=${encodeURIComponent(semesterFilter)}`;
      if (cohortFilter !== "all") url += `&cohort=${encodeURIComponent(cohortFilter)}`;
      if (departmentFilter !== "all") url += `&department_id=${encodeURIComponent(departmentFilter)}`;
      if (statusFilter !== "all") url += `&status=${encodeURIComponent(statusFilter)}`;
      if (programmeFilter !== "all") url += `&programme_id=${encodeURIComponent(programmeFilter)}`;
      if (levelFilter !== "all") url += `&level=${encodeURIComponent(levelFilter)}`;
      if (entryModeFilter !== "all") url += `&entry_mode=${encodeURIComponent(entryModeFilter)}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      const res = await api.get(url);
      return (res as any).data;
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [
    registrations,
    sessionFilter,
    departmentFilter,
    semesterFilter,
    statusFilter,
    programmeFilter,
    levelFilter,
    entryModeFilter,
    searchQuery,
  ]);

  const paginatedRegistrations = React.useMemo(() => {
    if (!registrations) return [];
    const start = (currentPage - 1) * itemsPerPage;
    return registrations.slice(start, start + itemsPerPage);
  }, [registrations, currentPage]);

  const totalPages = registrations
    ? Math.ceil(registrations.length / itemsPerPage)
    : 0;

  const selectedProgramme = programmes?.find(
    (p: any) => p.id === programmeFilter,
  );
  const progStructure = selectedProgramme?.programme_structure || "contact";

  const availableLevels = React.useMemo(() => {
    if (!selectedProgramme || selectedProgramme.id === "all") {
      return [
        "100",
        "200",
        "300",
        "400",
        "Contact 1",
        "Contact 2",
        "Contact 3",
        "Contact 4",
        "Contact 5",
        "Contact 6",
      ];
    }
    const isContact = selectedProgramme.programme_structure === "contact";
    const maxYears = isContact ? 6 : selectedProgramme.duration_years || 4;
    return Array.from({ length: maxYears }).map((_, i) =>
      isContact ? `Contact ${i + 1}` : `${(i + 1) * 100}`,
    );
  }, [selectedProgramme]);

  const hasActiveFilters =
    sessionFilter !== "all" ||
    cohortFilter !== "all" ||
    departmentFilter !== "all" ||
    semesterFilter !== "all" ||
    programmeFilter !== "all" ||
    levelFilter !== "all" ||
    statusFilter !== "all" ||
    entryModeFilter !== "all" ||
    searchQuery.trim() !== "";

  const resetFilters = () => {
    setSessionFilter("all");
    setCohortFilter("all");
    setDepartmentFilter("all");
    setSemesterFilter("all");
    setProgrammeFilter("all");
    setLevelFilter("all");
    setStatusFilter("all");
    setEntryModeFilter("all");
    setSearchQuery("");
  };

  const sessionNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    (sessions || []).forEach((s: any) => {
      if (s?.id && s?.name) {
        map[String(s.id)] = String(s.name);
      }
    });
    return map;
  }, [sessions]);

  const semesterNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    (semesters || []).forEach((sem: any) => {
      if (sem?.id && sem?.name) {
        map[String(sem.id)] = String(sem.name);
      }
    });
    return map;
  }, [semesters]);

  const resolveSessionLabel = React.useCallback(
    (sessionName?: string, sessionId?: string) => {
      if (sessionName && !sessionNameById[sessionName]) return sessionName;
      if (sessionId && sessionNameById[sessionId]) return sessionNameById[sessionId];
      if (sessionName && sessionNameById[sessionName]) return sessionNameById[sessionName];
      return sessionName || sessionId || "N/A";
    },
    [sessionNameById],
  );

  const resolveSemesterLabel = React.useCallback(
    (level?: string, semesterName?: string, semesterId?: string) => {
      if (level) return level;
      if (semesterName && !semesterNameById[semesterName]) return semesterName;
      if (semesterId && semesterNameById[semesterId]) return semesterNameById[semesterId];
      if (semesterName && semesterNameById[semesterName]) return semesterNameById[semesterName];
      return semesterName || semesterId || "N/A";
    },
    [semesterNameById],
  );

  const { data: regDetails, isLoading: detailsLoading, isError: detailsError, error: detailsErrorObj, refetch: refetchDetails } = useQuery({
    queryKey: registrationDetailsQueryKey(
      selectedRegistration?.registrationId || "none",
    ),
    queryFn: async () => {
      if (!selectedRegistration) return null;

      // Only fetch the selected registration (and any same-student + same-contact sibling envelope already in memory)
      const targetRow = Array.isArray(registrations)
        ? registrations.find((r: any) => r.id === selectedRegistration.registrationId)
        : null;

      const siblingIds = new Set<string>([selectedRegistration.registrationId]);
      if (targetRow && Array.isArray(registrations)) {
        registrations.forEach((r: any) => {
          if (
            r?.id &&
            r.student_id === selectedRegistration.studentId &&
            r.session_id === targetRow.session_id &&
            (r.level || r.semester_id) === (targetRow.level || targetRow.semester_id)
          ) {
            siblingIds.add(String(r.id));
          }
        });
      }

      const details: RegistrationDetails[] = [];
      for (const registrationId of Array.from(siblingIds)) {
        const response = await api.get(
          buildRegistrationDetailsPath(registrationId),
        );
        details.push((response as { data?: RegistrationDetails }).data || {});
      }

      return mergeStudentRegistrationDetails(
        selectedRegistration.registrationId,
        details,
      );
    },
    enabled: !!selectedRegistration,
    retry: 1,
  });

  // Courses available to add to the single student in the Review Dialog
  const singleStudentAvailableCourses = React.useMemo(() => {
    if (!Array.isArray(allCourses) || !regDetails?.registration) return [];
    const existingCourseIds = new Set(
      (regDetails.items || []).map((it: any) => String(it.course_id)),
    );
    const studentProgName = String(
      regDetails.registration.programme_name || "",
    ).toLowerCase();
    const studentProgId = String(regDetails.registration.programme_id || "");
    const q = singleAddSearch.trim().toLowerCase();

    return allCourses.filter((c: any) => {
      if (existingCourseIds.has(String(c.id))) return false;
      if (!singleAddAllProgrammes) {
        const matchProgId =
          studentProgId && String(c.programme_id || "") === studentProgId;
        const matchProgName =
          studentProgName &&
          String(c.programme_name || "").toLowerCase() === studentProgName;
        if (studentProgId || studentProgName) {
          if (!matchProgId && !matchProgName) return false;
        }
      }
      if (q) {
        const codeMatch = String(c.code || "")
          .toLowerCase()
          .includes(q);
        const titleMatch = String(c.title || "")
          .toLowerCase()
          .includes(q);
        const levelMatch = String(c.level || "")
          .toLowerCase()
          .includes(q);
        if (!codeMatch && !titleMatch && !levelMatch) return false;
      }
      return true;
    });
  }, [allCourses, regDetails, singleAddAllProgrammes, singleAddSearch]);

  const singleAmendMutation = useMutation({
    mutationFn: async (input: {
      operation: "add" | "remove";
      registrationId: string;
      courseId: string;
      registrationType?: string;
      forceRemoveWithScores?: boolean;
    }) => {
      const res = await api.post(
        "/api/admin/course-registration/registrations/amend-courses",
        {
          operation: input.operation,
          dry_run: false,
          registration_ids: [input.registrationId],
          course_ids: [input.courseId],
          registration_type: input.registrationType || "auto",
          force_remove_with_scores: !!input.forceRemoveWithScores,
        },
      );
      return (res as any).data || res;
    },
    onSuccess: (res: any, variables) => {
      toast.success(
        res?.message ||
          (variables.operation === "add"
            ? "Course added to registration"
            : "Course removed from registration"),
      );
      if (variables.operation === "add") {
        setSingleAddCourseId("");
      }
      if (selectedRegistration) {
        queryClient.invalidateQueries({
          queryKey: registrationDetailsQueryKey(
            selectedRegistration.registrationId,
          ),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
    },
    onError: (err: any, variables) => {
      const data = err.response?.data;
      if (variables.operation === "remove" && data?.requires_force_scores) {
        const confirmed = window.confirm(
          `${data.message}\n\nDo you want to force-remove this course from the student's registration anyway?`,
        );
        if (confirmed) {
          singleAmendMutation.mutate({
            ...variables,
            forceRemoveWithScores: true,
          });
        }
        return;
      }
      toast.error(
        data?.message || err?.message || "Failed to update student courses",
      );
    },
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteRequest, setDeleteRequest] = useState<{
    mode: "all" | "selected" | "single";
    registrationIds?: string[];
    registrationId?: string;
    studentName?: string;
    session?: string;
    contact?: string;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const allPageSelected =
    paginatedRegistrations?.length > 0 &&
    paginatedRegistrations.every((r: any) =>
      selectedIds.includes(r.id),
    );
  const somePageSelected =
    paginatedRegistrations?.some((r: any) =>
      selectedIds.includes(r.id),
    ) && !allPageSelected;

  const togglePage = (select: boolean) => {
    const pageIds = paginatedRegistrations.map((r: any) => r.id);
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

  const openAmendModal = (mode: "selected" | "all") => {
    setAmendRequest({
      mode,
      registrationIds: mode === "selected" ? selectedIds : undefined,
    });
    setAmendOperation("add");
    setAmendSelectedCourseIds([]);
    setAmendRegType("auto");
    setAmendCourseSearch("");
    setAmendProgFilter(programmeFilter !== "all" ? programmeFilter : "all");
    setAmendLevelFilter(
      levelFilter !== "all"
        ? levelFilter
        : semesterFilter.startsWith("Contact")
          ? semesterFilter
          : "all",
    );
    setAmendForceRemoveScores(false);
  };

  const closeAmendModal = () => {
    setAmendRequest(null);
    setAmendSelectedCourseIds([]);
    setAmendForceRemoveScores(false);
  };

  const buildAmendScopePayload = React.useCallback(() => {
    if (!amendRequest) return {};
    if (amendRequest.mode === "selected") {
      return {
        registration_ids: amendRequest.registrationIds || selectedIds,
      };
    }
    const payload: Record<string, any> = {
      amend_all: true,
    };
    if (sessionFilter !== "all") payload.session_id = sessionFilter;
    if (cohortFilter !== "all") payload.cohort = cohortFilter;
    if (departmentFilter !== "all") payload.department_id = departmentFilter;
    if (semesterFilter !== "all") payload.semester_id = semesterFilter;
    if (programmeFilter !== "all") payload.programme_id = programmeFilter;
    if (levelFilter !== "all") payload.level = levelFilter;
    if (statusFilter !== "all") payload.status = statusFilter;
    if (entryModeFilter !== "all") payload.entry_mode = entryModeFilter;
    if (searchQuery.trim()) payload.search = searchQuery.trim();
    return payload;
  }, [
    amendRequest,
    selectedIds,
    sessionFilter,
    cohortFilter,
    departmentFilter,
    semesterFilter,
    programmeFilter,
    levelFilter,
    statusFilter,
    entryModeFilter,
    searchQuery,
  ]);

  const {
    data: amendInspectData,
    isLoading: amendInspectLoading,
    refetch: refetchAmendInspect,
  } = useQuery({
    queryKey: [
      "amend-inspect",
      amendRequest,
      sessionFilter,
      cohortFilter,
      departmentFilter,
      semesterFilter,
      programmeFilter,
      levelFilter,
      statusFilter,
      entryModeFilter,
      searchQuery,
    ],
    queryFn: async () => {
      if (!amendRequest) return null;
      const res = await api.post(
        "/api/admin/course-registration/registrations/amend-courses",
        {
          operation: "inspect",
          ...buildAmendScopePayload(),
        },
      );
      return (res as any).data;
    },
    enabled: !!amendRequest,
  });

  // Auto-default programme filter in Add Courses tab if the cohort belongs to a single programme
  useEffect(() => {
    if (
      amendInspectData?.programme_ids?.length === 1 &&
      amendProgFilter === "all"
    ) {
      setAmendProgFilter(String(amendInspectData.programme_ids[0]));
    }
    if (
      amendInspectData?.levels?.length === 1 &&
      amendLevelFilter === "all"
    ) {
      setAmendLevelFilter(String(amendInspectData.levels[0]));
    }
  }, [amendInspectData]);

  const { data: amendDryRun, isFetching: amendDryRunLoading } = useQuery({
    queryKey: [
      "amend-dry-run",
      amendRequest,
      amendOperation,
      amendSelectedCourseIds,
      amendForceRemoveScores,
      sessionFilter,
      cohortFilter,
      departmentFilter,
      semesterFilter,
      programmeFilter,
      levelFilter,
      statusFilter,
      entryModeFilter,
      searchQuery,
    ],
    queryFn: async () => {
      if (!amendRequest || amendSelectedCourseIds.length === 0) return null;
      const res = await api.post(
        "/api/admin/course-registration/registrations/amend-courses",
        {
          operation: amendOperation,
          dry_run: true,
          course_ids: amendSelectedCourseIds,
          registration_type: amendRegType,
          force_remove_with_scores: amendForceRemoveScores,
          ...buildAmendScopePayload(),
        },
      );
      return (res as any).data;
    },
    enabled: !!amendRequest && amendSelectedCourseIds.length > 0,
  });

  const amendBulkMutation = useMutation({
    mutationFn: async () => {
      if (!amendRequest || amendSelectedCourseIds.length === 0) return;
      const res = await api.post(
        "/api/admin/course-registration/registrations/amend-courses",
        {
          operation: amendOperation,
          dry_run: false,
          course_ids: amendSelectedCourseIds,
          registration_type: amendRegType,
          force_remove_with_scores: amendForceRemoveScores,
          ...buildAmendScopePayload(),
        },
      );
      return (res as any).data || res;
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || "Courses updated across registrations");
      closeAmendModal();
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
      if (selectedRegistration) {
        queryClient.invalidateQueries({
          queryKey: registrationDetailsQueryKey(
            selectedRegistration.registrationId,
          ),
        });
      }
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          err?.message ||
          "Failed to amend courses across registrations",
      );
    },
  });

  const bulkAddCatalogueCourses = React.useMemo(() => {
    if (!Array.isArray(allCourses)) return [];
    const q = amendCourseSearch.trim().toLowerCase();
    return allCourses.filter((c: any) => {
      if (
        amendProgFilter !== "all" &&
        String(c.programme_id || "") !== amendProgFilter
      ) {
        return false;
      }
      if (amendLevelFilter !== "all") {
        const cLvl = String(c.level || "").toLowerCase();
        const targetLvl = amendLevelFilter.toLowerCase();
        const contactMatch = targetLvl.match(/contact\s*(\d+)/i);
        const contactNum = contactMatch ? Number(contactMatch[1]) : null;
        const matchesLvl =
          cLvl === targetLvl ||
          (contactNum !== null &&
            (Number(c.contact_number) === contactNum ||
              cLvl === String(contactNum) ||
              cLvl === `contact ${contactNum}`));
        if (!matchesLvl) return false;
      }
      if (q) {
        const matchCode = String(c.code || "")
          .toLowerCase()
          .includes(q);
        const matchTitle = String(c.title || "")
          .toLowerCase()
          .includes(q);
        if (!matchCode && !matchTitle) return false;
      }
      return true;
    });
  }, [allCourses, amendProgFilter, amendLevelFilter, amendCourseSearch]);

  const registeredCountByCourseId = React.useMemo(() => {
    const map: Record<string, number> = {};
    (amendInspectData?.registered_courses || []).forEach((rc: any) => {
      if (rc?.id) {
        map[String(rc.id)] = Number(rc.registrations_count || 0);
      }
    });
    return map;
  }, [amendInspectData]);

  const openDelete = (
    mode: "all" | "selected" | "single",
    options?: {
      registrationIds?: string[];
      registrationId?: string;
      studentName?: string;
      session?: string;
      contact?: string;
    },
  ) => {
    setDeleteRequest({
      mode,
      registrationIds:
        options?.registrationIds ||
        (mode === "selected" ? selectedIds : undefined),
      registrationId: options?.registrationId,
      studentName: options?.studentName,
      session: options?.session,
      contact: options?.contact,
    });
    setConfirmText("");
  };
  const closeDelete = () => {
    setDeleteRequest(null);
    setConfirmText("");
  };

  const {
    data: deleteSummary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErrorObj,
  } = useQuery({
    queryKey: [
      "delete-summary",
      deleteRequest,
      sessionFilter,
      cohortFilter,
      departmentFilter,
      semesterFilter,
      programmeFilter,
      levelFilter,
      statusFilter,
      entryModeFilter,
      searchQuery,
    ],
    queryFn: async () => {
      if (!deleteRequest) return null;
      const payload: any = {
        dry_run: true,
      };

      if (deleteRequest.mode === "single") {
        if (!deleteRequest.registrationId) return null;
        payload.registration_ids = [deleteRequest.registrationId];
      } else if (deleteRequest.mode === "selected") {
        const ids = deleteRequest.registrationIds || selectedIds;
        if (!ids || ids.length === 0) return null;
        payload.registration_ids = ids;
      } else if (deleteRequest.mode === "all") {
        payload.delete_all = true;
        if (sessionFilter !== "all") payload.session_id = sessionFilter;
        if (cohortFilter !== "all") payload.cohort = cohortFilter;
        if (departmentFilter !== "all") payload.department_id = departmentFilter;
        if (semesterFilter !== "all") payload.semester_id = semesterFilter;
        if (programmeFilter !== "all") payload.programme_id = programmeFilter;
        if (levelFilter !== "all") payload.level = levelFilter;
        if (statusFilter !== "all") payload.status = statusFilter;
        if (entryModeFilter !== "all") payload.entry_mode = entryModeFilter;
        if (searchQuery.trim()) payload.search = searchQuery.trim();
      }

      const res = await api.post(
        "/api/admin/course-registration/registrations/delete",
        payload,
      );
      return (res as any).data;
    },
    enabled: !!deleteRequest,
  });

  const requiresTypedConfirm =
    deleteRequest?.mode === "all" ||
    deleteRequest?.mode === "selected" ||
    (deleteSummary?.approved_registrations || 0) > 0;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteRequest) return;
      const payload: any = {
        confirm_approved: true,
      };

      if (deleteRequest.mode === "single") {
        if (!deleteRequest.registrationId) return;
        payload.registration_ids = [deleteRequest.registrationId];
      } else if (deleteRequest.mode === "selected") {
        const ids = deleteRequest.registrationIds || selectedIds;
        if (!ids || ids.length === 0) return;
        payload.registration_ids = ids;
      } else if (deleteRequest.mode === "all") {
        payload.delete_all = true;
        if (sessionFilter !== "all") payload.session_id = sessionFilter;
        if (cohortFilter !== "all") payload.cohort = cohortFilter;
        if (departmentFilter !== "all") payload.department_id = departmentFilter;
        if (semesterFilter !== "all") payload.semester_id = semesterFilter;
        if (programmeFilter !== "all") payload.programme_id = programmeFilter;
        if (levelFilter !== "all") payload.level = levelFilter;
        if (statusFilter !== "all") payload.status = statusFilter;
        if (entryModeFilter !== "all") payload.entry_mode = entryModeFilter;
        if (searchQuery.trim()) payload.search = searchQuery.trim();
      }

      const res = await api.post(
        "/api/admin/course-registration/registrations/delete",
        payload,
      );
      return res;
    },
    onSuccess: (res: any) => {
      toast.success(res?.message || "Registrations deleted");
      closeDelete();
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          err?.message ||
          "Failed to delete registrations",
      );
    },
  });

  const deleting = deleteMutation.isPending;

  const handleConfirmDelete = () => {
    deleteMutation.mutate();
  };


  const { data: classList, isLoading: classListLoading } = useQuery({
    queryKey: ["class-list", session, semester, courseId],
    queryFn: async () => {
      if (!courseId || courseId.length < 5) return null; // basic validation
      const res = await api.get(
        `/api/admin/course-registration/class-list?session_id=${session}&semester_id=${semester}&course_id=${courseId}`,
      );
      return (res as any).data;
    },
    enabled: !!courseId && courseId.length >= 5,
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(
        "/api/admin/course-registration/settings/save",
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Settings saved successfully");
      queryClient.invalidateQueries({
        queryKey: ["course-registration-settings"],
      });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to save settings"),
  });

  const processMutation = useMutation({
    mutationFn: async (payload: RegistrationProcessInput) => {
      if (!selectedRegistration) {
        throw new Error("No registration selected");
      }
      const res = await api.post(
        "/api/admin/course-registration/registrations/process",
        buildRegistrationProcessPayload(
          selectedRegistration.registrationId,
          payload,
        ),
      );
      return res.data || res;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Registration updated successfully");
      if (selectedRegistration) {
        queryClient.invalidateQueries({
          queryKey: registrationDetailsQueryKey(
            selectedRegistration.registrationId,
          ),
        });
      }
      setSelectedRegistration(null);
      setReturnReason("");
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Action failed"),
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    saveSettingsMutation.mutate({
      session_id: session,
      semester_id: semester,
      opens_at: formData.get("opens_at"),
      closes_at: formData.get("closes_at"),
      late_closes_at: formData.get("late_closes_at"),
      status: formData.get("status"),
      require_approval: formData.get("require_approval") === "on" ? 1 : 0,
      require_financial_clearance:
        formData.get("require_financial_clearance") === "on" ? 1 : 0,
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">
              Course Registration
            </h1>
            <p className="text-muted-foreground">
              Manage semester registrations, approvals, and course rosters under BMAS curriculum.
            </p>
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2 self-start sm:self-auto"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="w-4 h-4" />
            Registration Settings
          </Button>
        </div>

        <Tabs defaultValue="registrations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="course_roster">Course Roster</TabsTrigger>
            <TabsTrigger value="carryover_and_drop">Carryover & Drop Manager</TabsTrigger>
            <TabsTrigger value="legacy_bulk">Legacy Bulk</TabsTrigger>
          </TabsList>

          <TabsContent value="course_roster">
            <CourseRosterTab session={session} semester={semester} />
          </TabsContent>

          <TabsContent value="carryover_and_drop">
            <BulkCarryoverDropTab session={session} semester={semester} />
          </TabsContent>

          <TabsContent value="legacy_bulk">
            <BulkRegistrationTab session={session} semester={semester} />
          </TabsContent>

          <TabsContent value="registrations">
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle>Registered Students</CardTitle>
                    <CardDescription>
                      Filter by Academic Session, Student Cohort, Department, Programme, and Contact/Semester.
                    </CardDescription>
                  </div>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Reset Filters
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search name, matric..."
                      className="pl-8 h-9 text-xs"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Filter 1: Academic Session Envelope */}
                  <Select value={sessionFilter} onValueChange={setSessionFilter}>
                    <SelectTrigger className="w-[180px] h-9 text-xs font-medium border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 shadow-sm">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
                      <SelectValue placeholder="Academic Session" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Academic Sessions</SelectItem>
                      {academicSessionOptions.map((sessName) => (
                        <SelectItem key={sessName} value={sessName}>
                          Session: {sessName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Filter 2: Student Admission Cohort */}
                  <Select value={cohortFilter} onValueChange={setCohortFilter}>
                    <SelectTrigger className="w-[170px] h-9 text-xs font-medium border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100 shadow-sm">
                      <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-blue-600 shrink-0" />
                      <SelectValue placeholder="Entry Cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cohorts</SelectItem>
                      {entryCohortOptions.map((cohortName) => (
                        <SelectItem key={cohortName} value={cohortName}>
                          {cohortName} Cohort
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={departmentFilter}
                    onValueChange={(val) => {
                      setDepartmentFilter(val);
                      setProgrammeFilter("all");
                      setSemesterFilter("all");
                      setLevelFilter("all");
                    }}
                  >
                    <SelectTrigger className="w-[170px] h-9 text-xs">
                      <SelectValue placeholder="All Departments" />
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

                  <Select
                    value={programmeFilter}
                    onValueChange={(val) => {
                      setProgrammeFilter(val);
                      setSemesterFilter("all");
                      setLevelFilter("all");
                    }}
                  >
                    <SelectTrigger className="w-[190px] h-9 text-xs">
                      <SelectValue placeholder="All Programmes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programmes</SelectItem>
                      {filteredProgrammes?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={semesterFilter}
                    onValueChange={(val) => {
                      setSemesterFilter(val);
                      setLevelFilter("all");
                    }}
                  >
                    <SelectTrigger className="w-[165px] h-9 text-xs">
                      <SelectValue
                        placeholder={
                          programmeFilter !== "all"
                            ? progStructure === "semester"
                              ? "All Semesters"
                              : "All Contacts"
                            : "All Contacts / Semesters"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {programmeFilter !== "all"
                          ? progStructure === "semester"
                            ? "All Semesters"
                            : "All Contacts"
                          : "All Contacts / Semesters"}
                      </SelectItem>
                      {programmeFilter !== "all" && progStructure === "semester" ? (
                        <>
                          <SelectItem value="First Semester">First Semester</SelectItem>
                          <SelectItem value="Second Semester">Second Semester</SelectItem>
                        </>
                      ) : programmeFilter !== "all" ? (
                        <>
                          <SelectItem value="Contact 1">Contact 1</SelectItem>
                          <SelectItem value="Contact 2">Contact 2</SelectItem>
                          <SelectItem value="Contact 3">Contact 3</SelectItem>
                          <SelectItem value="Contact 4">Contact 4</SelectItem>
                          <SelectItem value="Contact 5">Contact 5</SelectItem>
                          <SelectItem value="Contact 6">Contact 6</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectGroup>
                            <SelectLabel>Contacts</SelectLabel>
                            <SelectItem value="Contact 1">Contact 1</SelectItem>
                            <SelectItem value="Contact 2">Contact 2</SelectItem>
                            <SelectItem value="Contact 3">Contact 3</SelectItem>
                            <SelectItem value="Contact 4">Contact 4</SelectItem>
                            <SelectItem value="Contact 5">Contact 5</SelectItem>
                            <SelectItem value="Contact 6">Contact 6</SelectItem>
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Semesters</SelectLabel>
                            <SelectItem value="First Semester">First Semester</SelectItem>
                            <SelectItem value="Second Semester">Second Semester</SelectItem>
                          </SelectGroup>
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={entryModeFilter} onValueChange={setEntryModeFilter}>
                    <SelectTrigger className="w-[140px] h-9 text-xs">
                      <SelectValue placeholder="All Modes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modes</SelectItem>
                      <SelectItem value="Fresh">Fresh (Contact 1)</SelectItem>
                      <SelectItem value="Direct Entry">Direct Entry (DE)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[135px] h-9 text-xs">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="submitted">
                        Pending Approval
                      </SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border bg-muted/20 p-2 rounded-md">
                  <div className="text-sm font-medium px-2">
                    {selectedIds.length > 0
                      ? `${selectedIds.length} selected`
                      : `${registrations?.length || 0} matching filter`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedIds.length > 0 && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openAmendModal("selected")}
                        >
                          <BookOpen className="w-4 h-4 mr-1.5" />
                          Add / Remove Courses ({selectedIds.length} Selected)
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDelete("selected")}
                        >
                          Delete Selected ({selectedIds.length})
                        </Button>
                      </>
                    )}
                    {(registrations?.length || 0) > 0 &&
                      selectedIds.length === 0 && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              if (!hasActiveFilters) {
                                toast.error(
                                  "Please select at least one filter (e.g. Programme, Contact/Semester, or Session) before running a bulk course amendment.",
                                );
                                return;
                              }
                              openAmendModal("all");
                            }}
                          >
                            <BookOpen className="w-4 h-4 mr-1.5" />
                            Add / Remove Courses (All Matching Filter &mdash;{" "}
                            {registrations?.length})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/40 hover:bg-destructive/10"
                            onClick={() => openDelete("all")}
                          >
                            Delete All Matching Filter ({registrations?.length})
                          </Button>
                        </>
                      )}
                  </div>
                </div>


                {registrationsLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="animate-spin h-6 w-6" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              aria-label="Select all on this page"
                              checked={
                                allPageSelected
                                  ? true
                                  : somePageSelected
                                    ? "indeterminate"
                                    : false
                              }
                              onCheckedChange={(v) => togglePage(v === true)}
                              disabled={paginatedRegistrations.length === 0}
                            />
                          </TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Programme</TableHead>
                          <TableHead>Contact / Semester</TableHead>
                          <TableHead>Academic Session</TableHead>
                          <TableHead>Session of Entry</TableHead>
                          <TableHead>Credit Units</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRegistrations?.map((reg: any) => (
                          <TableRow
                            key={reg.id}
                            data-state={
                              selectedIds.includes(reg.id)
                                ? "selected"
                                : undefined
                            }
                          >
                            <TableCell>
                              <Checkbox
                                aria-label={`Select ${reg.full_name}`}
                                checked={selectedIds.includes(reg.id)}
                                onCheckedChange={(v) =>
                                  toggleOne(reg.id, v === true)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{reg.full_name?.replace(/[\uFFFD]/g, "'")}</div>
                              <div className="text-xs text-muted-foreground">
                                {reg.matric_number ||
                                  reg.admission_number ||
                                  reg.email}
                              </div>
                              {reg.entry_mode && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 mt-0.5">
                                  {reg.entry_mode}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{reg.programme_name || "N/A"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-medium">
                                {resolveSemesterLabel(reg.level, reg.semester_name, reg.semester_id)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs font-mono font-medium text-emerald-800 bg-emerald-50/80 border-emerald-200">
                                <Calendar className="w-3 h-3 mr-1 inline text-emerald-600" />
                                {reg.academic_session_name || resolveSessionLabel(reg.session_name, reg.session_id)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs font-mono font-medium text-blue-800 bg-blue-50/80 border-blue-200">
                                <GraduationCap className="w-3 h-3 mr-1 inline text-blue-600" />
                                {reg.student_entry_session || reg.session_of_entry || resolveSessionLabel(reg.session_name, reg.session_id)} Set
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const total = Number(reg.total_credits ?? 0);
                                const minC = Number(reg.min_credits ?? globalDefaultRule?.min_credits ?? 15);
                                const maxC = Number(reg.max_credits ?? globalDefaultRule?.max_credits ?? 24);
                                const isUnder = total < minC;
                                const isOver = total > maxC;
                                return (
                                  <div className="space-y-1">
                                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                      <span>{total} units</span>
                                      <span className="text-[11px] font-normal text-muted-foreground">
                                        ({minC}&ndash;{maxC})
                                      </span>
                                    </div>
                                    {isUnder && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 text-amber-800 border-amber-200"
                                      >
                                        Under Min ({minC})
                                      </Badge>
                                    )}
                                    {isOver && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-4 bg-red-50 text-red-700 border-red-200"
                                      >
                                        Over Max ({maxC})
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  reg.status === "approved"
                                    ? "default"
                                    : reg.status === "returned"
                                      ? "destructive"
                                      : "secondary"
                                }
                                className="uppercase"
                              >
                                {reg.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setSelectedRegistration({
                                    registrationId: reg.id,
                                    studentId: reg.student_id,
                                  })
                                }
                              >
                                Review
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                aria-label={`Delete registration for ${reg.full_name}`}
                                onClick={() =>
                                  openDelete("single", {
                                    registrationId: reg.id,
                                    studentId: reg.student_id,
                                    studentName: reg.full_name,
                                    session: resolveSessionLabel(reg.session_name, reg.session_id),
                                    contact: resolveSemesterLabel(reg.level, reg.semester_name, reg.semester_id),
                                  })
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {paginatedRegistrations?.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="text-center py-8 text-muted-foreground"
                            >
                              No course registrations found matching the selected filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                          {Math.min(
                            currentPage * itemsPerPage,
                            registrations?.length || 0,
                          )}{" "}
                          of {registrations?.length} entries
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Registration Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Course Registration Settings</DialogTitle>
              <DialogDescription>
                Configure registration windows, approval policies, clearance requirements, and BMAS credit load rules.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Registration Configuration</CardTitle>
                  <CardDescription>
                    Configure session, semester, registration window dates, approval policies, and clearance requirements.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {settingsLoading ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="animate-spin h-6 w-6" />
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSaveSettings}
                      className="space-y-6 max-w-xl"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Academic Session</Label>
                          <Select value={session} onValueChange={setSession}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Academic Session" />
                            </SelectTrigger>
                            <SelectContent>
                              {academicSessionOptions.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                              {session && !academicSessionOptions.includes(session) && (
                                <SelectItem value={session}>{session}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Contact / Semester</Label>
                          <Select value={semester} onValueChange={setSemester}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Contact / Semester" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="first">First Semester</SelectItem>
                              <SelectItem value="second">Second Semester</SelectItem>
                              <SelectItem value="Contact 1">Contact 1</SelectItem>
                              <SelectItem value="Contact 2">Contact 2</SelectItem>
                              <SelectItem value="Contact 3">Contact 3</SelectItem>
                              <SelectItem value="Contact 4">Contact 4</SelectItem>
                              <SelectItem value="Contact 5">Contact 5</SelectItem>
                              <SelectItem value="Contact 6">Contact 6</SelectItem>
                              {semester &&
                                ![
                                  "first",
                                  "second",
                                  "Contact 1",
                                  "Contact 2",
                                  "Contact 3",
                                  "Contact 4",
                                  "Contact 5",
                                  "Contact 6",
                                ].includes(semester) && (
                                  <SelectItem value={semester}>{semester}</SelectItem>
                                )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Registration Status</Label>
                        <Select
                          name="status"
                          defaultValue={settings?.status || "closed"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="late">
                              Late Registration
                            </SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="opens_at">Opens At</Label>
                          <Input
                            type="datetime-local"
                            id="opens_at"
                            name="opens_at"
                            defaultValue={
                              settings?.opens_at
                                ? settings.opens_at.slice(0, 16)
                                : ""
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="closes_at">Closes At</Label>
                          <Input
                            type="datetime-local"
                            id="closes_at"
                            name="closes_at"
                            defaultValue={
                              settings?.closes_at
                                ? settings.closes_at.slice(0, 16)
                                : ""
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="late_closes_at">Late Closes At</Label>
                          <Input
                            type="datetime-local"
                            id="late_closes_at"
                            name="late_closes_at"
                            defaultValue={
                              settings?.late_closes_at
                                ? settings.late_closes_at.slice(0, 16)
                                : ""
                            }
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border rounded-md p-4">
                        <div className="space-y-0.5">
                          <Label>Require Approval</Label>
                          <div className="text-sm text-muted-foreground">
                            Submitted registrations require admin approval.
                          </div>
                        </div>
                        <Switch
                          name="require_approval"
                          defaultChecked={
                            settings?.require_approval === 1 ||
                            settings?.require_approval === true
                          }
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={saveSettingsMutation.isPending}
                      >
                        {saveSettingsMutation.isPending
                          ? "Saving..."
                          : "Save Configuration"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              {/* Credit Load Rules Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Credit Load Rules (BMAS Curriculum)</CardTitle>
                  <CardDescription>
                    Configure the global default fallback and programme/contact-specific minimum and maximum credit limits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Configurable Global Default Fallback */}
                  <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/80 dark:border-emerald-900 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                          Global Default Fallback Limits (All Programmes &amp; All Contacts)
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Applied automatically whenever a programme or contact does not have a specific rule below.
                        </p>
                      </div>
                      <Badge variant="outline" className="self-start sm:self-auto bg-white dark:bg-background text-emerald-800 border-emerald-300 font-mono text-xs">
                        Active Fallback: {globalDefaultRule?.min_credits ?? 15}&ndash;{globalDefaultRule?.max_credits ?? 24} units
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Default Min Units</Label>
                        <Input
                          className="h-9 bg-white dark:bg-background"
                          type="number"
                          min="0"
                          max="40"
                          value={globalDefaultMin}
                          onChange={(e) => setGlobalDefaultMin(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Default Max Units</Label>
                        <Input
                          className="h-9 bg-white dark:bg-background"
                          type="number"
                          min="0"
                          max="60"
                          value={globalDefaultMax}
                          onChange={(e) => setGlobalDefaultMax(e.target.value)}
                        />
                      </div>
                      <div>
                        <Button
                          size="sm"
                          className="w-full h-9"
                          onClick={() => {
                            const minVal = parseInt(globalDefaultMin, 10);
                            const maxVal = parseInt(globalDefaultMax, 10);
                            if (isNaN(minVal) || isNaN(maxVal) || minVal < 0 || maxVal < minVal) {
                              toast.error("Please enter valid Default Min and Max units (Max >= Min).");
                              return;
                            }
                            saveCreditRuleMutation.mutate({
                              programme_id: "GLOBAL",
                              level: "ALL",
                              min_credits: minVal,
                              max_credits: maxVal,
                            });
                          }}
                          disabled={saveCreditRuleMutation.isPending}
                        >
                          {saveCreditRuleMutation.isPending ? "Saving..." : "Save Default Fallback"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Specific Rule Editor */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end p-4 bg-muted/40 rounded-lg border">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Programme</Label>
                      <Select
                        value={newRuleProgId}
                        onValueChange={(val) => {
                          setNewRuleProgId(val);
                          if (val === "GLOBAL") {
                            setNewRuleLevel("ALL");
                            return;
                          }
                          const prog = programmes?.find(
                            (p: any) => String(p.id) === String(val),
                          );
                          if (prog?.programme_structure === "semester") {
                            setNewRuleLevel("100 Level");
                          } else {
                            setNewRuleLevel("Contact 1");
                          }
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select Programme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GLOBAL">
                            All Programmes (Global Rule)
                          </SelectItem>
                          {programmes?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Level / Contact</Label>
                      <Select value={newRuleLevel} onValueChange={setNewRuleLevel}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select Level / Contact" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRuleLevels.map((lvl) => (
                            <SelectItem key={lvl} value={lvl}>
                              {lvl === "ALL" ? "All Contacts / Levels (Default)" : lvl}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Min Units</Label>
                      <Input
                        className="h-9"
                        type="number"
                        min="0"
                        max="40"
                        value={newRuleMin}
                        onChange={(e) => setNewRuleMin(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Max Units</Label>
                      <Input
                        className="h-9"
                        type="number"
                        min="0"
                        max="60"
                        value={newRuleMax}
                        onChange={(e) => setNewRuleMax(e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-5 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!newRuleProgId || !newRuleLevel) {
                            toast.error("Please select a programme and enter a level.");
                            return;
                          }
                          saveCreditRuleMutation.mutate({
                            programme_id: newRuleProgId,
                            level: newRuleLevel,
                            min_credits: parseInt(newRuleMin, 10) || 15,
                            max_credits: parseInt(newRuleMax, 10) || 24,
                          });
                        }}
                        disabled={saveCreditRuleMutation.isPending}
                      >
                        {saveCreditRuleMutation.isPending ? "Saving..." : "Save Credit Rule"}
                      </Button>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Programme</TableHead>
                        <TableHead>Level / Contact</TableHead>
                        <TableHead className="text-center">Min Credits</TableHead>
                        <TableHead className="text-center">Max Credits</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditRulesData && creditRulesData.length > 0 ? (
                        creditRulesData.map((rule: any) => {
                          const isGlobal = String(rule.programme_id || "").toUpperCase() === "GLOBAL";
                          const isAllLvl = String(rule.level || "").toUpperCase() === "ALL";
                          return (
                            <TableRow key={rule.id}>
                              <TableCell className="font-medium">
                                {isGlobal
                                  ? "All Programmes (Global Default)"
                                  : rule.programme_name || rule.programme_id}
                              </TableCell>
                              <TableCell>
                                {isAllLvl ? (
                                  <Badge variant="secondary" className="text-xs">
                                    All Contacts / Levels
                                  </Badge>
                                ) : (
                                  rule.level
                                )}
                              </TableCell>
                              <TableCell className="text-center">{rule.min_credits}</TableCell>
                              <TableCell className="text-center">{rule.max_credits}</TableCell>
                              <TableCell className="text-right space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setNewRuleProgId(rule.programme_id);
                                    setNewRuleLevel(rule.level);
                                    setNewRuleMin(String(rule.min_credits));
                                    setNewRuleMax(String(rule.max_credits));
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    saveCreditRuleMutation.mutate({
                                      action: "delete",
                                      id: String(rule.id),
                                    });
                                  }}
                                >
                                  Delete
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            No custom rules defined yet. Built-in fallback limits (15&ndash;24 units) apply automatically.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog
          open={!!selectedRegistration}
          onOpenChange={(o) => {
            if (!o) {
              setSelectedRegistration(null);
              setModalContactFilter("all");
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Registration</DialogTitle>
              <DialogDescription>
                Review student course selections and approve or return for
                correction.
              </DialogDescription>
            </DialogHeader>

            {detailsLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="animate-spin h-8 w-8" />
              </div>
            ) : detailsError ? (
              <div className="py-8 text-center space-y-3">
                <div className="text-sm text-destructive">
                  Failed to load registration details:{" "}
                  {(detailsErrorObj as any)?.message || "Connection error"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDetails()}
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Retry
                </Button>
              </div>
            ) : (
              regDetails && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-md text-sm">
                    <div>
                      <strong>Student:</strong>{" "}
                      {(regDetails.registration.full_name as string)?.replace(/[\uFFFD]/g, "'")}
                    </div>
                    <div>
                      <strong>Programme:</strong>{" "}
                      {regDetails.registration.programme_name as string} (
                      {resolveSemesterLabel(
                        regDetails.registration.level as string,
                        regDetails.registration.semester_name as string,
                        regDetails.registration.semester_id as string,
                      )}
                      )
                    </div>
                    <div>
                      <strong>Status:</strong>{" "}
                      <Badge
                        className="uppercase ml-2"
                        variant={
                          regDetails.registration.status === "approved"
                            ? "default"
                            : regDetails.registration.status === "returned"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {regDetails.registration.status as string}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>Total Units:</strong>{" "}
                      {(() => {
                        const total = Number(regDetails.registration.total_credits ?? 0);
                        const minC = Number(
                          regDetails.registration.min_credits ??
                            globalDefaultRule?.min_credits ??
                            15,
                        );
                        const maxC = Number(
                          regDetails.registration.max_credits ??
                            globalDefaultRule?.max_credits ??
                            24,
                        );
                        const isUnder = total < minC;
                        const isOver = total > maxC;
                        return (
                          <>
                            <span className="font-semibold">
                              {total} / {minC}&ndash;{maxC} units
                            </span>
                            {isUnder ? (
                              <Badge
                                variant="outline"
                                className="text-xs bg-amber-50 text-amber-800 border-amber-200"
                              >
                                Under Min ({minC})
                              </Badge>
                            ) : isOver ? (
                              <Badge
                                variant="outline"
                                className="text-xs bg-red-50 text-red-700 border-red-200"
                              >
                                Over Max ({maxC})
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200"
                              >
                                Within Limit
                              </Badge>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Student Carryover Sync Action */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border rounded-md">
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-y-1">
                      <span>
                        <strong>Academic Session:</strong>{" "}
                        {(regDetails.registration.academic_session_name as string) ||
                          (regDetails.registration.reg_session_name as string) ||
                          resolveSessionLabel(
                            regDetails.registration.session_name as string,
                            regDetails.registration.session_id as string,
                          ) ||
                          session}
                      </span>
                      {(regDetails.registration.student_entry_session ||
                        regDetails.registration.session_of_entry) && (
                        <>
                          <span className="mx-2">&bull;</span>
                          <span>
                            <strong>Session of Entry:</strong>{" "}
                            {(regDetails.registration.student_entry_session as string) ||
                              (regDetails.registration.session_of_entry as string)}
                          </span>
                        </>
                      )}
                      <span className="mx-2">&bull;</span>
                      <span>
                        <strong>Period:</strong>{" "}
                        {regDetails.registration.level ||
                          regDetails.registration.semester_id ||
                          semester}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      disabled={syncCarryoversMutation.isPending}
                      onClick={() => {
                        syncCarryoversMutation.mutate({
                          student_id: regDetails.registration.student_id,
                          session_id: regDetails.registration.session_id || session,
                          semester_id: regDetails.registration.level || regDetails.registration.semester_id || semester,
                        });
                      }}
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          syncCarryoversMutation.isPending ? "animate-spin" : ""
                        }`}
                      />
                      {syncCarryoversMutation.isPending ? "Syncing Carryovers..." : "Sync Carryovers"}
                    </Button>
                  </div>

                  {/* Add Course to This Student */}
                  <div className="rounded-md border p-3.5 bg-muted/20 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-sm font-semibold">
                        Add Course to This Registration
                      </Label>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={singleAddAllProgrammes}
                          onChange={(e) => {
                            setSingleAddAllProgrammes(e.target.checked);
                            setSingleAddCourseId("");
                          }}
                          className="rounded border-gray-300"
                        />
                        Show courses from all programmes
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-3">
                        <Input
                          placeholder="Filter code/title..."
                          className="h-9 text-xs"
                          value={singleAddSearch}
                          onChange={(e) => setSingleAddSearch(e.target.value)}
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <Select
                          value={singleAddCourseId}
                          onValueChange={setSingleAddCourseId}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select course to add..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-64">
                            {singleStudentAvailableCourses
                              .slice(0, 80)
                              .map((c: any) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.code} &mdash; {c.title} ({c.credit_units}u
                                  &middot; {c.level || "N/A"})
                                </SelectItem>
                              ))}
                            {singleStudentAvailableCourses.length === 0 && (
                              <div className="p-2 text-xs text-muted-foreground text-center">
                                No matching unregistered courses found.
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Select
                          value={singleAddRegType}
                          onValueChange={setSingleAddRegType}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto Type</SelectItem>
                            <SelectItem value="core">Core</SelectItem>
                            <SelectItem value="elective">Elective</SelectItem>
                            <SelectItem value="CARRYOVER">Carryover</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Button
                          size="sm"
                          className="w-full h-9 text-xs"
                          disabled={
                            !singleAddCourseId || singleAmendMutation.isPending
                          }
                          onClick={() => {
                            if (!selectedRegistration || !singleAddCourseId)
                              return;
                            singleAmendMutation.mutate({
                              operation: "add",
                              registrationId:
                                selectedRegistration.registrationId,
                              courseId: singleAddCourseId,
                              registrationType: singleAddRegType,
                            });
                          }}
                        >
                          {singleAmendMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 mr-1" /> Add
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      Registered Courses ({regDetails.items?.length || 0})
                    </h3>
                    <Select
                      value={modalContactFilter}
                      onValueChange={setModalContactFilter}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by Contact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Contacts</SelectItem>
                        {Array.from(
                          new Set(
                            regDetails.items
                              ?.map((item: any) => item.course_level)
                              .filter(Boolean),
                          ),
                        )
                          .sort()
                          .map((lvl: any) => (
                            <SelectItem key={lvl} value={lvl}>
                              {lvl}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="text-right w-20">
                          Remove
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regDetails.items
                        ?.filter(
                          (item: any) =>
                            modalContactFilter === "all" ||
                            item.course_level === modalContactFilter,
                        )
                        .map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.code}
                            </TableCell>
                            <TableCell>{item.title}</TableCell>
                            <TableCell className="capitalize">
                              {item.registration_type &&
                              ["CARRYOVER", "REPEAT"].includes(
                                String(item.registration_type).toUpperCase(),
                              )
                                ? String(item.registration_type).toLowerCase()
                                : item.course_type}
                            </TableCell>
                            <TableCell>{item.course_level}</TableCell>
                            <TableCell className="text-right">
                              {item.credit_units}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive hover:bg-destructive/10"
                                title={`Remove ${item.code} from registration`}
                                disabled={singleAmendMutation.isPending}
                                onClick={() => {
                                  if (!selectedRegistration) return;
                                  singleAmendMutation.mutate({
                                    operation: "remove",
                                    registrationId:
                                      (item.registration_id as string) ||
                                      selectedRegistration.registrationId,
                                    courseId: String(item.course_id),
                                  });
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      {regDetails.items?.filter(
                        (item: any) =>
                          modalContactFilter === "all" ||
                          item.course_level === modalContactFilter,
                      ).length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-6 text-muted-foreground"
                          >
                            No courses found for this contact.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {regDetails.registration.status === "submitted" && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="space-y-2">
                        <Label>
                          Return Reason (Only required if returning)
                        </Label>
                        <Textarea
                          placeholder="Explain what the student needs to correct..."
                          value={returnReason}
                          onChange={(e) => setReturnReason(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button
                          variant="destructive"
                          onClick={() =>
                            processMutation.mutate({
                              action: "return",
                              reason: returnReason,
                            })
                          }
                          disabled={
                            processMutation.isPending || !returnReason.trim()
                          }
                        >
                          Return for Correction
                        </Button>
                        <Button
                          onClick={() =>
                            processMutation.mutate({ action: "approve" })
                          }
                          disabled={processMutation.isPending}
                        >
                          Approve Registration
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center border-t pt-4">
                    <span className="text-xs text-muted-foreground">
                      Permanently removes this student's registration for the
                      selected session and contact.
                    </span>
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => {
                        if (!selectedRegistration) return;
                        const studentId = selectedRegistration.studentId;
                        const regId = selectedRegistration.registrationId;
                        setSelectedRegistration(null);
                        openDelete("single", {
                          registrationId: regId,
                          studentName: (regDetails?.registration?.full_name as string) || "this student",
                          session:
                            (regDetails?.registration?.academic_session_name as string) ||
                            (regDetails?.registration?.reg_session_name as string) ||
                            resolveSessionLabel(
                              regDetails?.registration?.session_name as string,
                              (regDetails?.registration?.session_id as string) || sessionFilter,
                            ),
                          contact: resolveSemesterLabel(
                            regDetails?.registration?.level as string,
                            regDetails?.registration?.semester_name as string,
                            (regDetails?.registration?.semester_id as string) || semesterFilter,
                          ),
                        });
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Registration
                    </Button>
                  </div>
                </div>
              )
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Amend Courses Dialog (Add / Remove Courses for Selected or Filtered Cohort) */}
        <Dialog
          open={!!amendRequest}
          onOpenChange={(o) => {
            if (!o && !amendBulkMutation.isPending) {
              closeAmendModal();
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Add / Remove Courses (Bulk Amendment)
              </DialogTitle>
              <DialogDescription>
                {amendRequest?.mode === "selected"
                  ? `Add or remove specific courses across ${amendRequest?.registrationIds?.length || selectedIds.length} selected registration(s) without affecting their other courses.`
                  : `Add or remove specific courses across all ${amendInspectData?.total_registrations ?? registrations?.length ?? 0} registration(s) matching the active filters.`}
              </DialogDescription>
            </DialogHeader>

            {amendInspectLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Target Scope Banner */}
                <div className="rounded-md border p-3 bg-muted/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    Target Cohort:{" "}
                    <strong>
                      {amendInspectData?.total_registrations ?? 0}{" "}
                      registration(s)
                    </strong>{" "}
                    ({amendInspectData?.students_count ?? 0} distinct
                    student(s))
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sessionFilter !== "all" && (
                      <Badge variant="outline" className="text-[11px]">
                        Academic Session: {sessionFilter}
                      </Badge>
                    )}
                    {cohortFilter !== "all" && (
                      <Badge variant="outline" className="text-[11px]">
                        Entry Cohort: {cohortFilter}
                      </Badge>
                    )}
                    {semesterFilter !== "all" && (
                      <Badge variant="outline" className="text-[11px]">
                        Contact/Sem: {semesterFilter}
                      </Badge>
                    )}
                    {programmeFilter !== "all" && (
                      <Badge variant="outline" className="text-[11px]">
                        {selectedProgramme?.name || "Programme Filtered"}
                      </Badge>
                    )}
                    {entryModeFilter !== "all" && (
                      <Badge variant="outline" className="text-[11px]">
                        Entry: {entryModeFilter}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Operation Toggle: Add Courses vs Remove Courses */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      amendOperation === "add"
                        ? "bg-background shadow-sm text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      setAmendOperation("add");
                      setAmendSelectedCourseIds([]);
                    }}
                  >
                    + Add Courses to Registrations
                  </button>
                  <button
                    type="button"
                    className={`py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      amendOperation === "remove"
                        ? "bg-background shadow-sm text-destructive"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => {
                      setAmendOperation("remove");
                      setAmendSelectedCourseIds([]);
                    }}
                  >
                    &minus; Remove Courses from Registrations
                  </button>
                </div>

                {amendOperation === "add" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-4">
                        <Label className="text-xs">Filter by Programme</Label>
                        <Select
                          value={amendProgFilter}
                          onValueChange={setAmendProgFilter}
                        >
                          <SelectTrigger className="h-9 text-xs mt-1">
                            <SelectValue placeholder="All Programmes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Programmes</SelectItem>
                            {programmes?.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-3">
                        <Label className="text-xs">
                          Filter by Level / Contact
                        </Label>
                        <Select
                          value={amendLevelFilter}
                          onValueChange={setAmendLevelFilter}
                        >
                          <SelectTrigger className="h-9 text-xs mt-1">
                            <SelectValue placeholder="All Levels" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              All Levels / Contacts
                            </SelectItem>
                            <SelectItem value="Contact 1">Contact 1</SelectItem>
                            <SelectItem value="Contact 2">Contact 2</SelectItem>
                            <SelectItem value="Contact 3">Contact 3</SelectItem>
                            <SelectItem value="Contact 4">Contact 4</SelectItem>
                            <SelectItem value="Contact 5">Contact 5</SelectItem>
                            <SelectItem value="Contact 6">Contact 6</SelectItem>
                            <SelectItem value="100">100 Level</SelectItem>
                            <SelectItem value="200">200 Level</SelectItem>
                            <SelectItem value="300">300 Level</SelectItem>
                            <SelectItem value="400">400 Level</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="sm:col-span-3">
                        <Label className="text-xs">Search Code / Title</Label>
                        <Input
                          placeholder="e.g. EDU301..."
                          className="h-9 text-xs mt-1"
                          value={amendCourseSearch}
                          onChange={(e) => setAmendCourseSearch(e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label className="text-xs">Register As</Label>
                        <Select
                          value={amendRegType}
                          onValueChange={setAmendRegType}
                        >
                          <SelectTrigger className="h-9 text-xs mt-1">
                            <SelectValue placeholder="Auto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="core">Core</SelectItem>
                            <SelectItem value="elective">Elective</SelectItem>
                            <SelectItem value="CARRYOVER">Carryover</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Units</TableHead>
                            <TableHead className="text-right">
                              Already in Cohort
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkAddCatalogueCourses.slice(0, 100).map((c: any) => {
                            const checked = amendSelectedCourseIds.includes(
                              c.id,
                            );
                            const existingCnt =
                              registeredCountByCourseId[String(c.id)] || 0;
                            const totalRegs =
                              amendInspectData?.total_registrations || 0;
                            return (
                              <TableRow
                                key={c.id}
                                className="cursor-pointer"
                                onClick={() => {
                                  if (checked) {
                                    setAmendSelectedCourseIds((prev) =>
                                      prev.filter((id) => id !== c.id),
                                    );
                                  } else {
                                    setAmendSelectedCourseIds((prev) => [
                                      ...prev,
                                      c.id,
                                    ]);
                                  }
                                }}
                              >
                                <TableCell
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(v) => {
                                      if (v) {
                                        setAmendSelectedCourseIds((prev) =>
                                          Array.from(new Set([...prev, c.id])),
                                        );
                                      } else {
                                        setAmendSelectedCourseIds((prev) =>
                                          prev.filter((id) => id !== c.id),
                                        );
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-xs">
                                  {c.code}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {c.title}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {c.level || "N/A"}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {c.credit_units}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {existingCnt > 0 ? (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px]"
                                    >
                                      {existingCnt} / {totalRegs}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      0 / {totalRegs}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {bulkAddCatalogueCourses.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-center py-6 text-xs text-muted-foreground"
                              >
                                No courses match the current filter. Try
                                switching Level or Programme filter to "All".
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Select the course(s) currently registered in this cohort
                        that you want to remove:
                      </p>
                      <Input
                        placeholder="Filter registered courses..."
                        className="h-8 w-56 text-xs"
                        value={amendCourseSearch}
                        onChange={(e) => setAmendCourseSearch(e.target.value)}
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Units</TableHead>
                            <TableHead className="text-right">
                              Registered Students
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(amendInspectData?.registered_courses || [])
                            .filter((rc: any) => {
                              const q = amendCourseSearch.trim().toLowerCase();
                              if (!q) return true;
                              return (
                                String(rc.code || "")
                                  .toLowerCase()
                                  .includes(q) ||
                                String(rc.title || "")
                                  .toLowerCase()
                                  .includes(q)
                              );
                            })
                            .map((rc: any) => {
                              const checked = amendSelectedCourseIds.includes(
                                rc.id,
                              );
                              return (
                                <TableRow
                                  key={rc.id}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    if (checked) {
                                      setAmendSelectedCourseIds((prev) =>
                                        prev.filter((id) => id !== rc.id),
                                      );
                                    } else {
                                      setAmendSelectedCourseIds((prev) => [
                                        ...prev,
                                        rc.id,
                                      ]);
                                    }
                                  }}
                                >
                                  <TableCell
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) => {
                                        if (v) {
                                          setAmendSelectedCourseIds((prev) =>
                                            Array.from(
                                              new Set([...prev, rc.id]),
                                            ),
                                          );
                                        } else {
                                          setAmendSelectedCourseIds((prev) =>
                                            prev.filter((id) => id !== rc.id),
                                          );
                                        }
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium text-xs">
                                    {rc.code}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {rc.title}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {rc.level || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {rc.credit_units}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    <Badge variant="secondary">
                                      {rc.registrations_count} /{" "}
                                      {amendInspectData?.total_registrations ||
                                        0}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          {(amendInspectData?.registered_courses || [])
                            .length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-center py-6 text-xs text-muted-foreground"
                              >
                                No courses are currently registered across the
                                targeted registrations.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Dry-Run Preview Banner */}
                {amendSelectedCourseIds.length > 0 && (
                  <div className="rounded-md border p-3 bg-muted/20 space-y-2 text-xs">
                    {amendDryRunLoading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Calculating
                        impact across{" "}
                        {amendInspectData?.total_registrations ?? 0}{" "}
                        registration(s)...
                      </div>
                    ) : amendDryRun ? (
                      amendOperation === "add" ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-sm text-foreground">
                            Ready to add{" "}
                            <span className="text-primary">
                              {amendDryRun.total_items_to_add}
                            </span>{" "}
                            course entry/entries across{" "}
                            <span className="text-primary">
                              {amendDryRun.affected_registrations_count}
                            </span>{" "}
                            registration(s).
                          </div>
                          {amendDryRun.already_registered_total > 0 && (
                            <div className="text-muted-foreground">
                              {amendDryRun.already_registered_total} existing
                              course entry/entries already present in this
                              cohort will be safely skipped without duplication.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="font-semibold text-sm text-foreground">
                            Ready to remove{" "}
                            <span className="text-destructive">
                              {amendDryRun.total_items_to_remove}
                            </span>{" "}
                            course entry/entries across{" "}
                            <span className="text-destructive">
                              {amendDryRun.registrations_with_target_courses}
                            </span>{" "}
                            registration(s).
                          </div>
                          {amendDryRun.students_with_results > 0 && (
                            <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-2.5 space-y-2">
                              <div>
                                <strong>
                                  {amendDryRun.students_with_results} student(s)
                                </strong>{" "}
                                ({amendDryRun.attempts_with_scores} score
                                record(s)) already have CA/Exam scores recorded
                                for the selected course(s). By default, their
                                course registration for those scored courses is
                                preserved.
                              </div>
                              <label className="flex items-center gap-2 font-medium cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={amendForceRemoveScores}
                                  onChange={(e) =>
                                    setAmendForceRemoveScores(e.target.checked)
                                  }
                                  className="rounded border-amber-400"
                                />
                                Force remove course from registration even for
                                students who have recorded scores
                              </label>
                            </div>
                          )}
                        </div>
                      )
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeAmendModal}
                disabled={amendBulkMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant={amendOperation === "remove" ? "destructive" : "default"}
                disabled={
                  amendBulkMutation.isPending ||
                  amendSelectedCourseIds.length === 0 ||
                  amendDryRunLoading ||
                  (amendOperation === "add" &&
                    amendDryRun &&
                    amendDryRun.total_items_to_add === 0) ||
                  (amendOperation === "remove" &&
                    amendDryRun &&
                    amendDryRun.total_items_to_remove === 0)
                }
                onClick={() => amendBulkMutation.mutate()}
              >
                {amendBulkMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {amendOperation === "add"
                  ? `Add ${amendSelectedCourseIds.length} Course(s) to Cohort`
                  : `Remove ${amendSelectedCourseIds.length} Course(s) from Cohort`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deleteRequest}
          onOpenChange={(o) => {
            if (!o && !deleting) closeDelete();
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" /> Delete Course Registration
              </DialogTitle>
              <DialogDescription>
                {deleteRequest?.mode === "all"
                  ? "This will delete ALL registrations matching the current filters."
                  : deleteRequest?.mode === "selected"
                    ? `This will delete course registrations for ${deleteRequest?.registrationIds?.length || selectedIds.length} selected record(s).`
                    : `This will delete the course registration for ${deleteRequest?.studentName || "this student"} at this contact.`}
              </DialogDescription>
            </DialogHeader>

            {summaryLoading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="animate-spin h-6 w-6" />
              </div>
            ) : summaryError ? (
              <div className="py-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                Failed to load deletion summary:{" "}
                {(summaryErrorObj as any)?.message || "Server error"}
              </div>
            ) : deleteSummary &&
              (deleteSummary.total_registrations ??
                deleteSummary.registrations ??
                0) > 0 ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-md border p-3 space-y-1.5 bg-muted/30">
                  <div className="font-semibold text-foreground">
                    {deleteSummary.total_registrations ??
                      deleteSummary.registrations ??
                      0}{" "}
                    registration(s) (
                    {deleteSummary.students_count ??
                      deleteSummary.students ??
                      0}{" "}
                    student(s)) will be deleted
                  </div>

                  {deleteRequest?.mode === "single" ? (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        Student: <strong>{deleteRequest.studentName}</strong>{" "}
                        &middot; Contact / Level:{" "}
                        <strong>{deleteRequest.contact}</strong> &middot;
                        Session: <strong>{deleteRequest.session}</strong>
                      </div>
                      <div className="text-emerald-700 font-medium">
                        Only courses registered under this specific contact will
                        be deleted. Registrations for other contacts remain
                        unaffected.
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Academic Session:{" "}
                      <strong>
                        {sessionFilter === "all"
                          ? "All Sessions"
                          : sessionFilter}
                      </strong>{" "}
                      &middot; Entry Cohort:{" "}
                      <strong>
                        {cohortFilter === "all"
                          ? "All Cohorts"
                          : cohortFilter}
                      </strong>{" "}
                      &middot; Contact / Semester:{" "}
                      <strong>
                        {semesterFilter === "all"
                          ? "All Contacts / Semesters"
                          : semesterFilter}
                      </strong>
                      {deleteRequest?.mode === "all" && (
                        <>
                          {" "}
                          &middot; Programme:{" "}
                          <strong>
                            {programmeFilter === "all"
                              ? "All"
                              : selectedProgramme?.name || programmeFilter}
                          </strong>{" "}
                          &middot; Level:{" "}
                          <strong>
                            {levelFilter === "all" ? "All" : levelFilter}
                          </strong>{" "}
                          &middot; Status:{" "}
                          <strong>
                            {statusFilter === "all" ? "All" : statusFilter}
                          </strong>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(deleteSummary.by_status || {}).map(
                      ([st, n]: [string, any]) => (
                        <Badge
                          key={st}
                          variant="secondary"
                          className="uppercase text-[10px]"
                        >
                          {st}: {n}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>

                {deleteSummary.approved_registrations > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">
                    <strong>{deleteSummary.approved_registrations}</strong>{" "}
                    <em>approved</em> registration(s) are included. These
                    students will drop out of class lists and can no longer be
                    added to new result batches.
                  </div>
                )}

                {deleteSummary.students_with_results > 0 && (
                  <div className="rounded-md border border-red-300 bg-red-50 text-red-900 p-3">
                    <strong>{deleteSummary.students_with_results}</strong>{" "}
                    student(s) already have scores entered (
                    {deleteSummary.attempts_with_scores} result record(s)) for
                    these courses. Their existing scores are{" "}
                    <strong>not</strong> deleted, but they will no longer be
                    registered for those courses.
                  </div>
                )}

                {requiresTypedConfirm && (
                  <div className="space-y-2">
                    <Label>
                      Type <strong>DELETE</strong> to confirm
                    </Label>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-sm text-muted-foreground">
                No matching registrations found to delete.
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeDelete}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={
                  deleting ||
                  summaryLoading ||
                  !deleteSummary ||
                  (deleteSummary.total_registrations ??
                    deleteSummary.registrations ??
                    0) === 0 ||
                  (requiresTypedConfirm && confirmText.trim() !== "DELETE")
                }
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}


