import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Users,
  ShieldAlert,
  ArrowRight,
  BookOpen,
  Calendar,
  GraduationCap,
  Layers,
  Building2,
  History,
  Trash2,
  Info,
} from "lucide-react";

interface BulkCarryoverDropTabProps {
  session: string;
  semester: string;
}

export function BulkCarryoverDropTab({ session, semester }: BulkCarryoverDropTabProps) {
  const [activeMode, setActiveMode] = useState<"carryover_sync" | "bulk_drop">("carryover_sync");

  // Primary Scoping State
  const [academicSession, setAcademicSession] = useState(session || "2025/2026");
  const [entrySession, setEntrySession] = useState("all");
  const [departmentId, setDepartmentId] = useState("all");
  const [programmeId, setProgrammeId] = useState("");
  const [level, setLevel] = useState("all");

  // Keep in sync with parent props if they change
  useEffect(() => {
    if (session) setAcademicSession(session);
  }, [session]);

  // Carryover Sync State
  const [previewData, setPreviewData] = useState<any>(null);
  const [carryoverFilter, setCarryoverFilter] = useState<"all" | "to_add" | "to_keep" | "conflicts" | "to_remove">("all");

  // Bulk Drop State
  const [selectedDropCourseIds, setSelectedDropCourseIds] = useState<string[]>([]);
  const [dropReasonPreset, setDropReasonPreset] = useState("Curriculum change / course code superseded");
  const [customDropReason, setCustomDropReason] = useState("");
  const [forceRemoveScores, setForceRemoveScores] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");

  const queryClient = useQueryClient();

  // Load Sessions
  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-sessions");
      return res.data || [];
    },
  });

  // Load Semesters
  const { data: semesters } = useQuery({
    queryKey: ["admin-semesters-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-semesters");
      return res.data || [];
    },
  });

  // Load Departments
  const { data: departments } = useQuery({
    queryKey: ["admin-departments-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-departments");
      return res.data || [];
    },
  });

  // Fetch Programmes
  const { data: programmes } = useQuery({
    queryKey: ["admin-programmes-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-programmes");
      return res.data || [];
    },
  });

  // Filter programmes by selected department
  const filteredProgrammes = useMemo(() => {
    if (!programmes) return [];
    if (!departmentId || departmentId === "all") return programmes;
    return programmes.filter((p: any) => String(p.department_id) === String(departmentId));
  }, [programmes, departmentId]);

  // Calculate available levels based on selected programme
  const selectedProgramme = useMemo(() => {
    return programmes?.find((p: any) => p.id === programmeId);
  }, [programmes, programmeId]);

  const progStructure = selectedProgramme?.programme_structure || "contact";
  const levelLabel = progStructure === "contact" ? "Contact" : "Level";

  const availableLevels = useMemo(() => {
    if (!selectedProgramme) return [];
    const isContact = progStructure === "contact";
    const maxYears = isContact ? 6 : (selectedProgramme.duration_years || 4);

    return Array.from({ length: maxYears }).map((_, i) => {
      if (isContact) {
        return `Contact ${i + 1}`;
      }
      return `${(i + 1) * 100}`;
    });
  }, [selectedProgramme, progStructure]);

  // Resolve the underlying semester / contact ID from the chosen level
  const resolvedSemesterId = useMemo(() => {
    if (!level || level === "all") {
      return semester || "first";
    }
    const match = semesters?.find(
      (s: any) =>
        s.name?.toLowerCase() === level.toLowerCase() ||
        s.id?.toLowerCase() === level.toLowerCase()
    );
    return match ? match.id : level;
  }, [level, semesters, semester]);

  // Load all courses for the selected programme to allow drop selection
  const { data: programmeCourses } = useQuery({
    queryKey: ["programme-courses", programmeId],
    queryFn: async () => {
      if (!programmeId) return [];
      const res = await api.get("/api/admin/get-courses");
      const list = (res as any)?.data?.data || (res as any)?.data || [];
      return Array.isArray(list) ? list.filter((c: any) => String(c.programme_id) === String(programmeId)) : [];
    },
    enabled: !!programmeId,
  });

  // ---------------------------------------------------------------------------
  // 1. CARRYOVER SYNC MUTATIONS
  // ---------------------------------------------------------------------------
  const bulkPreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/admin_carryover_sync/bulk_preview", {
        programme_id: programmeId,
        entry_session: entrySession,
        level: level,
        session_id: academicSession,
        semester_id: resolvedSemesterId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      toast.success("Carryover sync preview generated successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to generate bulk preview");
    },
  });

  const bulkCommitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/admin_carryover_sync/bulk_commit", {
        programme_id: programmeId,
        entry_session: entrySession,
        level: level,
        session_id: academicSession,
        semester_id: resolvedSemesterId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || `Bulk carryover sync committed successfully!`);
      setPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to execute bulk sync");
    },
  });

  // ---------------------------------------------------------------------------
  // 2. BULK DROP INSPECT & EXECUTE MUTATIONS
  // ---------------------------------------------------------------------------
  const inspectDropQuery = useQuery({
    queryKey: [
      "bulk-drop-inspect",
      academicSession,
      resolvedSemesterId,
      programmeId,
      entrySession,
      level,
      selectedDropCourseIds,
      forceRemoveScores,
    ],
    queryFn: async () => {
      if (!programmeId || selectedDropCourseIds.length === 0) return null;
      const res = await api.post("/api/admin/course-registration/registrations/amend-courses", {
        operation: "remove",
        session_id: academicSession,
        cohort: entrySession !== "all" ? entrySession : null,
        semester_id: resolvedSemesterId,
        programme_id: programmeId,
        level: level !== "all" ? level : null,
        course_ids: selectedDropCourseIds,
        force_remove_with_scores: forceRemoveScores,
        dry_run: true,
        amend_all: true,
      });
      return res.data?.data || null;
    },
    enabled: activeMode === "bulk_drop" && !!programmeId && selectedDropCourseIds.length > 0,
  });

  const executeDropMutation = useMutation({
    mutationFn: async () => {
      const reason = dropReasonPreset === "Other (custom specification)"
        ? customDropReason.trim()
        : `${dropReasonPreset}${customDropReason ? ` - ${customDropReason.trim()}` : ""}`;

      if (!reason) {
        throw new Error("A justification reason is required to perform a bulk course drop.");
      }

      const res = await api.post("/api/admin/course-registration/registrations/amend-courses", {
        operation: "remove",
        session_id: academicSession,
        cohort: entrySession !== "all" ? entrySession : null,
        semester_id: resolvedSemesterId,
        programme_id: programmeId,
        level: level !== "all" ? level : null,
        course_ids: selectedDropCourseIds,
        force_remove_with_scores: forceRemoveScores,
        reason: reason,
        dry_run: false,
        amend_all: true,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data?.message || "Selected course(s) successfully dropped for targeted cohort.");
      setSelectedDropCourseIds([]);
      setCustomDropReason("");
      setForceRemoveScores(false);
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["bulk-drop-inspect"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || error.message || "Failed to drop courses.");
    },
  });

  // Filtered carryover preview items
  const filteredCarryoverItems = useMemo(() => {
    if (!previewData) return [];
    const items: Array<any> = [];

    if (carryoverFilter === "all" || carryoverFilter === "to_add") {
      previewData.to_add?.forEach((item: any) => items.push({ ...item, actionType: "to_add" }));
    }
    if (carryoverFilter === "all" || carryoverFilter === "to_keep") {
      previewData.to_keep?.forEach((item: any) => items.push({ ...item, actionType: "to_keep" }));
    }
    if (carryoverFilter === "all" || carryoverFilter === "conflicts") {
      previewData.conflicts?.forEach((item: any) => items.push({ ...item, actionType: "conflict" }));
    }
    if (carryoverFilter === "all" || carryoverFilter === "to_remove") {
      previewData.to_remove?.forEach((item: any) => items.push({ ...item, actionType: "to_remove" }));
    }

    return items;
  }, [previewData, carryoverFilter]);

  // Filtered programme courses for drop selector
  const filteredCoursesForDrop = useMemo(() => {
    if (!programmeCourses) return [];
    if (!courseSearch.trim()) return programmeCourses;
    const q = courseSearch.toLowerCase();
    return programmeCourses.filter(
      (c: any) => c.code?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q)
    );
  }, [programmeCourses, courseSearch]);

  const toggleCourseSelect = (id: string) => {
    setSelectedDropCourseIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Scope Header Card */}
      <Card className="border-emerald-100 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-700" />
                Bulk Carryover & Course Drop Management Console
              </CardTitle>
              <CardDescription>
                Reconcile carryovers and manage course adjustments for legacy cohorts under the active Academic Session envelope.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                Target Session: {academicSession}
              </Badge>
              {level && level !== "all" && (
                <Badge variant="outline" className="bg-slate-50 text-slate-700">
                  {level}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* 1. Academic Session (Teaching Envelope) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Academic Session *
              </Label>
              <Select value={academicSession} onValueChange={(val) => {
                setAcademicSession(val);
                setPreviewData(null);
              }}>
                <SelectTrigger className="border-emerald-200 bg-emerald-50/40 font-medium">
                  <SelectValue placeholder="Select Academic Session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions?.map((s: any) => (
                    <SelectItem key={`acad-${s.id}`} value={s.name}>
                      {s.name} {s.is_current ? "(Active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Student Admission Cohort (Entry Session) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                Entry Cohort
              </Label>
              <Select value={entrySession} onValueChange={(val) => {
                setEntrySession(val);
                setPreviewData(null);
              }}>
                <SelectTrigger className="border-blue-200 bg-blue-50/20">
                  <SelectValue placeholder="All Cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cohorts</SelectItem>
                  {sessions?.map((s: any) => (
                    <SelectItem key={`entry-${s.id}`} value={s.name}>
                      {s.name} Set
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Department (Optional scoping filter) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Department
              </Label>
              <Select value={departmentId} onValueChange={(val) => {
                setDepartmentId(val);
                setProgrammeId("");
                setLevel("all");
                setPreviewData(null);
              }}>
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

            {/* 4. Programme */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                Programme *
              </Label>
              <Select value={programmeId} onValueChange={(val) => {
                setProgrammeId(val);
                setLevel("all");
                setPreviewData(null);
                setSelectedDropCourseIds([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Programme" />
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

            {/* 5. Contact / Level (Single, unambiguous dropdown!) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                {levelLabel} *
              </Label>
              <Select value={level} onValueChange={(val) => {
                setLevel(val);
                setPreviewData(null);
              }} disabled={!programmeId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${levelLabel}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {levelLabel}s</SelectItem>
                  {availableLevels.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Mode Tabs */}
      <Tabs value={activeMode} onValueChange={(v: any) => setActiveMode(v)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="carryover_sync" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            1. Bulk Carryover Synchronization
          </TabsTrigger>
          <TabsTrigger value="bulk_drop" className="flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            2. Bulk Course Drops & Waivers
          </TabsTrigger>
        </TabsList>

        {/* =================================================================== */}
        {/* TAB 1: BULK CARRYOVER SYNCHRONIZATION */}
        {/* =================================================================== */}
        <TabsContent value="carryover_sync" className="space-y-6 pt-2">
          <Alert className="bg-blue-50/70 border-blue-200">
            <Info className="h-4 w-4 text-blue-700" />
            <AlertTitle className="text-blue-900 font-medium">Session-by-Session Carryover Rule</AlertTitle>
            <AlertDescription className="text-blue-800 text-xs">
              This engine scans historical examination attempts prior to <strong>{academicSession}</strong>.
              Any failed course (Grade F or Absent) is registered into the active <strong>{academicSession}</strong> envelope with full provenance
              links (<code>origin_session_id</code> and <code>origin_grade</code>). Direct Entry Contact 1 exemptions are preserved.
            </AlertDescription>
          </Alert>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => bulkPreviewMutation.mutate()}
                disabled={!programmeId || bulkPreviewMutation.isPending}
                className="bg-emerald-700 hover:bg-emerald-800"
              >
                {bulkPreviewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Generate Carryover Preview
              </Button>
              {previewData && (
                <Button variant="outline" size="sm" onClick={() => setPreviewData(null)}>
                  Clear Preview
                </Button>
              )}
            </div>

            {previewData && (
              <Button
                onClick={() => bulkCommitMutation.mutate()}
                disabled={bulkCommitMutation.isPending || previewData.to_add?.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {bulkCommitMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Commit Carryover Sync ({previewData.to_add?.length || 0} to Add)
              </Button>
            )}
          </div>

          {/* Metrics Preview */}
          {previewData && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="bg-slate-50">
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Students Scanned</div>
                  <div className="text-2xl font-bold mt-1 text-slate-800">{previewData.students_affected || 0}</div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${
                  carryoverFilter === "to_add" ? "ring-2 ring-emerald-500 bg-emerald-50/50" : "hover:bg-emerald-50/30"
                }`}
                onClick={() => setCarryoverFilter("to_add")}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-emerald-700 uppercase font-semibold">Carryovers to Add</div>
                  <div className="text-2xl font-bold mt-1 text-emerald-800">{previewData.to_add?.length || 0}</div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${
                  carryoverFilter === "to_keep" ? "ring-2 ring-blue-500 bg-blue-50/50" : "hover:bg-blue-50/30"
                }`}
                onClick={() => setCarryoverFilter("to_keep")}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-blue-700 uppercase font-semibold">Already Active</div>
                  <div className="text-2xl font-bold mt-1 text-blue-800">{previewData.to_keep?.length || 0}</div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${
                  carryoverFilter === "to_remove" ? "ring-2 ring-purple-500 bg-purple-50/50" : "hover:bg-purple-50/30"
                }`}
                onClick={() => setCarryoverFilter("to_remove")}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-purple-700 uppercase font-semibold">Obsolete / Cleared</div>
                  <div className="text-2xl font-bold mt-1 text-purple-800">{previewData.to_remove?.length || 0}</div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-colors ${
                  carryoverFilter === "conflicts" ? "ring-2 ring-amber-500 bg-amber-50/50" : "hover:bg-amber-50/30"
                }`}
                onClick={() => setCarryoverFilter("conflicts")}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-xs text-amber-700 uppercase font-semibold">Conflicts</div>
                  <div className="text-2xl font-bold mt-1 text-amber-800">{previewData.conflicts?.length || 0}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Carryover Table */}
          {previewData && (
            <Card>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
                <CardTitle className="text-sm font-medium">
                  Reconciliation Plan ({filteredCarryoverItems.length} records)
                </CardTitle>
                <div className="flex items-center gap-1.5 text-xs">
                  <Button
                    variant={carryoverFilter === "all" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCarryoverFilter("all")}
                  >
                    All ({((previewData.to_add?.length || 0) + (previewData.to_keep?.length || 0) + (previewData.conflicts?.length || 0) + (previewData.to_remove?.length || 0))})
                  </Button>
                  <Button
                    variant={carryoverFilter === "to_add" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCarryoverFilter("to_add")}
                  >
                    To Add ({previewData.to_add?.length || 0})
                  </Button>
                  <Button
                    variant={carryoverFilter === "conflicts" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setCarryoverFilter("conflicts")}
                  >
                    Conflicts ({previewData.conflicts?.length || 0})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[460px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="w-[200px]">Student / Matric</TableHead>
                      <TableHead>Course Code & Title</TableHead>
                      <TableHead>Prior Attempt Details</TableHead>
                      <TableHead className="text-right">Action in {academicSession}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCarryoverItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No items match the selected filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCarryoverItems.map((item, idx) => (
                        <TableRow key={`co-item-${idx}`}>
                          <TableCell>
                            <div className="font-medium text-xs text-slate-900">{item.student_name}</div>
                            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              {item.matric_number || item.student_id}
                              {item.entry_mode && String(item.entry_mode).toLowerCase().includes("de") && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-blue-50 text-blue-700 border-blue-200">
                                  DE
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-xs text-slate-800">{item.course_code}</div>
                            <div className="text-[11px] text-muted-foreground line-clamp-1">{item.course_title}</div>
                          </TableCell>
                          <TableCell>
                            {item.origin_grade ? (
                              <div className="text-xs">
                                <span className="font-semibold text-red-600 mr-1.5">{item.origin_score}{item.origin_grade}</span>
                                <span className="text-muted-foreground text-[11px]">in previous session</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{item.reason || "Historical failure"}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.actionType === "to_add" && (
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]">
                                Register Carryover
                              </Badge>
                            )}
                            {item.actionType === "to_keep" && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-[11px]">
                                Already Active
                              </Badge>
                            )}
                            {item.actionType === "conflict" && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[11px]">
                                Conflict: Registered as Normal
                              </Badge>
                            )}
                            {item.actionType === "to_remove" && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-[11px]">
                                Mark Obsolete
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* =================================================================== */}
        {/* TAB 2: BULK COURSE DROPS & WAIVERS */}
        {/* =================================================================== */}
        <TabsContent value="bulk_drop" className="space-y-6 pt-2">
          <Alert className="bg-amber-50/70 border-amber-200">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <AlertTitle className="text-amber-900 font-medium">Safe Soft-Drop & Score Guard</AlertTitle>
            <AlertDescription className="text-amber-800 text-xs">
              Dropping a course marks it <code>status = &apos;dropped&apos;</code> in the active <strong>{academicSession}</strong> registration envelope without deleting historical results.
              If continuous assessment or exam marks already exist, the action is blocked unless explicitly authorized below.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Course Selection */}
            <Card>
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>1. Select Course(s) to Drop</span>
                  <Badge variant="secondary" className="text-xs">
                    {selectedDropCourseIds.length} Selected
                  </Badge>
                </CardTitle>
                <div className="mt-2">
                  <Input
                    placeholder="Search course code or title..."
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[350px] overflow-auto divide-y">
                {filteredCoursesForDrop.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    {!programmeId ? "Select a programme above to view courses." : "No courses match search."}
                  </div>
                ) : (
                  filteredCoursesForDrop.map((course: any) => {
                    const isSelected = selectedDropCourseIds.includes(course.id);
                    return (
                      <div
                        key={course.id}
                        onClick={() => toggleCourseSelect(course.id)}
                        className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected ? "bg-amber-50/60" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleCourseSelect(course.id)} />
                          <div>
                            <div className="font-semibold text-slate-900">{course.code}</div>
                            <div className="text-muted-foreground line-clamp-1">{course.title}</div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">
                            {course.credit_units || course.credit_unit || 2} units
                          </Badge>
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {course.level}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Right: Inspection, Reason, and Score Guard */}
            <Card className="flex flex-col justify-between">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-sm font-semibold">2. Pre-Drop Inspection & Governance</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Inspection Summary */}
                {selectedDropCourseIds.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    Select one or more courses on the left to inspect affected students.
                  </div>
                ) : inspectDropQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    Inspecting cohort registrations for {academicSession}...
                  </div>
                ) : inspectDropQuery.data ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded border">
                        <div className="text-muted-foreground font-medium">Students with Course</div>
                        <div className="text-lg font-bold text-slate-800 mt-0.5">
                          {inspectDropQuery.data.registrations_with_target_courses || 0}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded border">
                        <div className="text-muted-foreground font-medium">Items to Drop</div>
                        <div className="text-lg font-bold text-amber-700 mt-0.5">
                          {inspectDropQuery.data.total_items_to_remove || 0}
                        </div>
                      </div>
                    </div>

                    {/* Score Guard Warning */}
                    {inspectDropQuery.data.students_with_results > 0 && (
                      <Alert variant="destructive" className="py-2.5">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-xs font-semibold">Recorded Scores Detected!</AlertTitle>
                        <AlertDescription className="text-[11px] mt-0.5">
                          {inspectDropQuery.data.students_with_results} student(s) already have {inspectDropQuery.data.attempts_with_scores} recorded continuous assessment or exam mark(s).
                        </AlertDescription>
                      </Alert>
                    )}

                    {inspectDropQuery.data.students_with_results > 0 && (
                      <div className="flex items-start gap-2 pt-1">
                        <Checkbox
                          id="forceScores"
                          checked={forceRemoveScores}
                          onCheckedChange={(c) => setForceRemoveScores(!!c)}
                          className="mt-0.5"
                        />
                        <Label htmlFor="forceScores" className="text-xs font-medium text-red-700 leading-snug cursor-pointer">
                          Force drop courses even if CA or Exam scores are recorded
                        </Label>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Justification Reason */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Administrative Reason / Senate Ref *
                  </Label>
                  <Select value={dropReasonPreset} onValueChange={setDropReasonPreset}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Curriculum change / course code superseded">
                        Curriculum change / course code superseded
                      </SelectItem>
                      <SelectItem value="Direct Entry 100L course mistakenly assigned">
                        Direct Entry 100L course mistakenly assigned
                      </SelectItem>
                      <SelectItem value="Senate academic waiver granted">
                        Senate academic waiver granted
                      </SelectItem>
                      <SelectItem value="Student load adjustment / course deferral">
                        Student load adjustment / course deferral
                      </SelectItem>
                      <SelectItem value="Mistakenly registered during legacy migration">
                        Mistakenly registered during legacy migration
                      </SelectItem>
                      <SelectItem value="Other (custom specification)">
                        Other (custom specification)
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Enter Senate reference number or additional notes..."
                    value={customDropReason}
                    onChange={(e) => setCustomDropReason(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </CardContent>

              <CardFooter className="py-3 px-4 border-t bg-slate-50 flex justify-end">
                <Button
                  variant="destructive"
                  onClick={() => executeDropMutation.mutate()}
                  disabled={
                    selectedDropCourseIds.length === 0 ||
                    executeDropMutation.isPending ||
                    (inspectDropQuery.data?.students_with_results > 0 && !forceRemoveScores) ||
                    (inspectDropQuery.data && inspectDropQuery.data.total_items_to_remove === 0)
                  }
                  className="text-xs"
                >
                  {executeDropMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                  Execute Soft-Drop for Cohort ({selectedDropCourseIds.length} Courses)
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
