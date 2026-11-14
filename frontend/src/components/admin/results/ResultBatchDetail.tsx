import { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Save,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  RotateCcw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { api, cleanCorruptedChars } from "@/lib/api";
import {
  getResultAttemptIdentifier,
  mergeMissingCarryoverAttempts,
  selectAttemptsForSave,
} from "@/lib/resultBatchAttempts";
import { toast } from "sonner";
import { ImportResultsCsvDialog } from "./ImportResultsCsvDialog";

function normalizeEntryMode(raw: any): "Direct Entry" | "Fresh" {
  const s = String(raw || "").trim().toLowerCase();
  if (s.includes("direct") || s === "de") {
    return "Direct Entry";
  }
  return "Fresh";
}

export function ResultBatchDetail({
  batch,
  onBack,
}: {
  batch: any;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [classList, setClassList] = useState<any[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "regular" | "carryover">(
    "all",
  );
  const [modeFilter, setModeFilter] = useState<
    "all" | "fresh" | "direct_entry"
  >("all");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearCa, setClearCa] = useState(true);
  const [clearExam, setClearExam] = useState(true);
  const [clearAbsent, setClearAbsent] = useState(true);
  const [assessmentStructure, setAssessmentStructure] = useState<{
    max_ca: number;
    max_exam: number;
    max_total: number;
  }>({ max_ca: 30, max_exam: 70, max_total: 100 });

  useEffect(() => {
    if (batch?.id) {
      loadAttempts();
    }
  }, [batch?.id]);

  const loadAttempts = async () => {
    if (!batch?.id) return;
    setLoading(true);
    try {
      const [attemptsRes, classRes, structRes] = (await Promise.all([
        api.get("/api/admin/results/attempts?batch_id=" + encodeURIComponent(batch.id)),
        api.get(
          `/api/admin/course-registration/class-list?session_id=${encodeURIComponent(batch.session_id || "")}&semester_id=${encodeURIComponent(batch.semester_id || "")}&course_id=${encodeURIComponent(batch.course_id || "")}&level=${encodeURIComponent(batch.level || "")}${batch.programme_id ? `&programme_id=${encodeURIComponent(batch.programme_id)}` : ""}${batch.department_id ? `&department_id=${encodeURIComponent(batch.department_id)}` : ""}`,
        ),
        api.get("/api/admin/results/assessment-structure").catch(() => null),
      ])) as [any, any, any];
      if (structRes?.data) {
        setAssessmentStructure(structRes.data);
      }
      const savedAttempts = Array.isArray(attemptsRes?.data)
        ? attemptsRes.data
        : Array.isArray(attemptsRes)
          ? attemptsRes
          : [];
      const latestClassList = Array.isArray(classRes?.data)
        ? classRes.data
        : Array.isArray(classRes)
          ? classRes
          : [];
      // Strict Rule: No student shall be listed if he is not registered under the course
      const sanitizedAttempts = latestClassList.length > 0
        ? savedAttempts.filter((a: any) => {
            if (!a || typeof a !== "object") return false;
            return latestClassList.some((c: any) => c && c.student_id === a.student_id);
          })
        : savedAttempts;
      setAttempts(
        mergeMissingCarryoverAttempts(sanitizedAttempts, latestClassList),
      );
      setClassList(latestClassList);
    } catch (error) {
      toast.error("Failed to load result attempts");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvImport = (importedData: any[]) => {
    const newAttempts = [...attempts];
    let matched = 0;
    const norm = (v: any) => (v ?? "").toString().toLowerCase().trim();

    importedData.forEach((row) => {
      const matric = norm(row.matric_number);
      if (!matric) return;
      const idx = newAttempts.findIndex(
        (a) => norm(getResultAttemptIdentifier(a)) === matric,
      );

      const rawCa = row.ca_score !== undefined ? String(row.ca_score).trim() : "";
      const rawExam = row.exam_score !== undefined ? String(row.exam_score).trim() : "";
      const isRowAbsent =
        rawCa.toUpperCase() === "ABS" ||
        rawCa.toLowerCase() === "absent" ||
        rawExam.toUpperCase() === "ABS" ||
        rawExam.toLowerCase() === "absent";

      if (idx !== -1) {
        if (isRowAbsent) {
          newAttempts[idx].ca_score = "";
          newAttempts[idx].exam_score = "";
          newAttempts[idx].total_score = null;
          newAttempts[idx].grade = "ABS";
        } else {
          if (row.ca_score !== undefined)
            newAttempts[idx].ca_score = row.ca_score;
          if (row.exam_score !== undefined)
            newAttempts[idx].exam_score = row.exam_score;

          const caTrim = String(newAttempts[idx].ca_score ?? "").trim();
          const examTrim = String(newAttempts[idx].exam_score ?? "").trim();
          const hasCa = caTrim !== "" && !isNaN(Number(caTrim));
          const hasExam = examTrim !== "" && !isNaN(Number(examTrim));

          if (hasCa || hasExam) {
            const caNum = hasCa ? parseFloat(caTrim) : 0;
            const examNum = hasExam ? parseFloat(examTrim) : 0;
            newAttempts[idx].total_score = (caNum + examNum).toString();
            newAttempts[idx].grade = null;
          } else {
            newAttempts[idx].total_score = null;
            newAttempts[idx].grade = null;
          }
        }
        matched++;
      } else {
        const student = classList.find(
          (s) => norm(getResultAttemptIdentifier(s)) === matric,
        );
        if (student && student.student_id) {
          if (isRowAbsent) {
            newAttempts.push({
              id: "new_" + Math.random(),
              batch_id: batch.id,
              student_id: student.student_id,
              matric_number: getResultAttemptIdentifier(student),
              first_name: cleanCorruptedChars(student.full_name),
              last_name: "",
              ca_score: "",
              exam_score: "",
              total_score: null,
              grade: "ABS",
            });
          } else {
            const caTrim = rawCa;
            const examTrim = rawExam;
            const hasCa = caTrim !== "" && !isNaN(Number(caTrim));
            const hasExam = examTrim !== "" && !isNaN(Number(examTrim));
            const totalScore = (hasCa || hasExam)
              ? ((hasCa ? parseFloat(caTrim) : 0) + (hasExam ? parseFloat(examTrim) : 0)).toString()
              : null;

            newAttempts.push({
              id: "new_" + Math.random(),
              batch_id: batch.id,
              student_id: student.student_id,
              matric_number: getResultAttemptIdentifier(student),
              first_name: cleanCorruptedChars(student.full_name),
              last_name: "",
              ca_score: row.ca_score ?? "",
              exam_score: row.exam_score ?? "",
              total_score: totalScore,
              grade: null,
            });
          }
          matched++;
        }
      }
    });

    setAttempts(newAttempts);
    toast.success("Updated " + matched + " students from CSV");
  };

  const handleScoreChange = (
    indexInFiltered: number,
    field: "ca_score" | "exam_score",
    value: string,
  ) => {
    if (batch.status === "approved" || batch.status === "published") return;

    // Find the real index in `attempts`
    const filteredAttempt = filteredAttempts[indexInFiltered];
    const realIndex = attempts.findIndex(
      (a) => a.student_id === filteredAttempt.student_id,
    );
    if (realIndex === -1) return;

    const maxVal = field === "ca_score" ? assessmentStructure.max_ca : assessmentStructure.max_exam;
    let validatedValue = value;
    if (value !== "" && !isNaN(Number(value))) {
      const num = parseFloat(value);
      if (num < 0) {
        validatedValue = "0";
      } else if (num > maxVal) {
        toast.error(`Maximum ${field === "ca_score" ? "CA" : "Exam"} score allowed is ${maxVal}`);
        validatedValue = String(maxVal);
      }
    }

    const newAttempts = [...attempts];
    newAttempts[realIndex][field] = validatedValue;
    newAttempts[realIndex].grade = null;

    const ca = parseFloat(newAttempts[realIndex].ca_score) || 0;
    const exam = parseFloat(newAttempts[realIndex].exam_score) || 0;
    newAttempts[realIndex].total_score = (ca + exam).toString();

    setAttempts(newAttempts);
  };

  const handleAbsentChange = (indexInFiltered: number, absent: boolean) => {
    if (batch.status === "approved" || batch.status === "published") return;

    const filteredAttempt = filteredAttempts[indexInFiltered];
    const realIndex = attempts.findIndex(
      (a) => a.student_id === filteredAttempt.student_id,
    );
    if (realIndex === -1) return;

    const newAttempts = [...attempts];
    newAttempts[realIndex] = {
      ...newAttempts[realIndex],
      ca_score: absent ? "" : newAttempts[realIndex].ca_score,
      exam_score: absent ? "" : newAttempts[realIndex].exam_score,
      total_score: absent ? null : newAttempts[realIndex].total_score,
      grade: absent ? "ABS" : null,
    };
    setAttempts(newAttempts);
  };

  const saveResults = async () => {
    setSaving(true);
    try {
      const payload = {
        batch_id: batch.id,
        attempts: selectAttemptsForSave(attempts).map((a) => {
          const classEntry = classList.find(
            (entry) => entry && entry.student_id === a.student_id,
          );
          const rawRegType = (a as any).registration_type || (a as any).registration_type_snapshot || classEntry?.registration_type || "";
          const isCarryover = Boolean(
            (a as any).is_carryover ||
            classEntry?.is_carryover ||
            classEntry?.origin_result_attempt_id ||
            classEntry?.previous_attempt ||
            (a as any).previous_attempt ||
            (a as any).source_result_attempt_id ||
            ["CARRYOVER", "REPEAT"].includes(String(rawRegType).toUpperCase())
          );
          return {
            student_id: a.student_id,
            ca_score: a.ca_score,
            exam_score: a.exam_score,
            is_absent: a.grade === "ABS",
            is_carryover: isCarryover,
            source_result_attempt_id:
              (a as any).source_result_attempt_id ||
              classEntry?.origin_result_attempt_id ||
              (a as any).previous_attempt?.id ||
              classEntry?.previous_attempt?.id ||
              null,
          };
        }),
      };

      const res = (await api.post(
        "/api/admin/results/attempts/save",
        payload,
      )) as any;
      if (res.status === "success") {
        toast.success("Results saved successfully");
        loadAttempts();
      } else {
        toast.error(res.message || "Failed to save results");
      }
    } catch (error: any) {
      toast.error(error.body?.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const incompleteCount = useMemo(() => {
    return attempts.filter((a) => {
      if (a.grade === "ABS") return false;
      const hasCa = a.ca_score !== null && a.ca_score !== undefined && String(a.ca_score).trim() !== "";
      const hasExam = a.exam_score !== null && a.exam_score !== undefined && String(a.exam_score).trim() !== "";
      return hasCa !== hasExam;
    }).length;
  }, [attempts]);

  const updateStatus = async (newStatus: string) => {
    if (
      (newStatus === "submitted" || newStatus === "approved" || newStatus === "published") &&
      incompleteCount > 0
    ) {
      const proceed = window.confirm(
        `Warning: ${incompleteCount} student(s) have a partial score (CA entered without Exam, or Exam entered without CA). Treating blank Exam scores as 0 produces single-digit F grades.\n\nDo you still want to proceed with "${newStatus.toUpperCase()}"?`,
      );
      if (!proceed) return;
    }
    try {
      const res = (await api.post("/api/admin/results/batches/update-status", {
        batch_id: batch.id,
        status: newStatus,
      })) as any;
      if (res.status === "success") {
        toast.success("Batch status updated to " + newStatus);
        onBack();
      }
    } catch (error: any) {
      toast.error("Failed to update status");
    }
  };

  const isEditable = batch?.status === "draft" || batch?.status === "submitted";

  // Merge attempts with classList to get registration_type, previous_attempt, and entry_mode
  const mergedAttempts = useMemo(() => {
    if (!Array.isArray(attempts)) return [];
    const safeClassList = Array.isArray(classList) ? classList : [];
    return attempts
      .filter((a): a is any => Boolean(a && typeof a === "object"))
      .map((a) => {
        const c = safeClassList.find((entry) => entry && entry.student_id === a.student_id);
        const rawMode = a.entry_mode || c?.entry_mode || c?.mode_of_entry || "";
        const rawRegType = (a as any).registration_type || (a as any).registration_type_snapshot || c?.registration_type;
        const hasPrevAttempt = Boolean(
          (a as any).previous_attempt ||
          c?.previous_attempt ||
          (a as any).source_result_attempt_id ||
          c?.origin_result_attempt_id
        );
        const isCarryoverAttempt = Boolean(
          (a as any).is_carryover ||
          (a as any).is_pending_carryover ||
          c?.is_carryover ||
          hasPrevAttempt ||
          ["CARRYOVER", "REPEAT"].includes(String(rawRegType || "").toUpperCase())
        );
        const isExplicitUnregistered =
          (a as any).is_unregistered === true ||
          String(rawRegType || "").toUpperCase() === "UNREGISTERED";

        const derivedType = isCarryoverAttempt
          ? "CARRYOVER"
          : isExplicitUnregistered
            ? "UNREGISTERED"
            : (rawRegType ? String(rawRegType).toUpperCase() : "CORE");

        return {
          ...a,
          is_carryover: isCarryoverAttempt,
          registration_type: derivedType,
          previous_attempt: (a as any).previous_attempt || c?.previous_attempt || null,
          source_result_attempt_id:
            (a as any).source_result_attempt_id ||
            c?.origin_result_attempt_id ||
            (a as any).previous_attempt?.id ||
            c?.previous_attempt?.id ||
            null,
          current_level: c?.current_level || (a as any).current_level || "",
          entry_mode: rawMode,
          normalized_entry_mode: normalizeEntryMode(rawMode),
        };
      });
  }, [attempts, classList]);

  const filteredAttempts = useMemo(() => {
    if (!Array.isArray(mergedAttempts)) return [];
    return mergedAttempts.filter((a) => {
      if (!a) return false;
      // 1. Registration filter (all, regular, carryover)
      const isCarryover = ["CARRYOVER", "REPEAT"].includes(
        (a.registration_type || "").toUpperCase(),
      );
      const isUnregistered = (a.registration_type || "").toUpperCase() === "UNREGISTERED";
      if (activeTab === "regular" && (isCarryover || isUnregistered)) return false;
      if (activeTab === "carryover" && !isCarryover) return false;

      // 2. Mode of Entry filter (all, fresh, direct_entry)
      if (modeFilter === "fresh" && a.normalized_entry_mode !== "Fresh")
        return false;
      if (
        modeFilter === "direct_entry" &&
        a.normalized_entry_mode !== "Direct Entry"
      )
        return false;

      return true;
    });
  }, [mergedAttempts, activeTab, modeFilter]);

  const stats = useMemo(() => {
    if (!Array.isArray(mergedAttempts)) {
      return { all: 0, regular: 0, carryover: 0, fresh: 0, directEntry: 0 };
    }
    const regularCount = mergedAttempts.filter(
      (a) =>
        a &&
        !["CARRYOVER", "REPEAT", "UNREGISTERED"].includes(
          (a.registration_type || "").toUpperCase(),
        ),
    ).length;
    const carryoverCount = mergedAttempts.filter(
      (a) =>
        a &&
        ["CARRYOVER", "REPEAT"].includes(
          (a.registration_type || "").toUpperCase(),
        ),
    ).length;

    // Mode counts scoped to the currently active registration tab
    const tabStudents =
      activeTab === "regular"
        ? mergedAttempts.filter(
            (a) =>
              a &&
              !["CARRYOVER", "REPEAT", "UNREGISTERED"].includes(
                (a.registration_type || "").toUpperCase(),
              ),
          )
        : activeTab === "carryover"
          ? mergedAttempts.filter(
              (a) =>
                a &&
                ["CARRYOVER", "REPEAT"].includes(
                  (a.registration_type || "").toUpperCase(),
                ),
            )
          : mergedAttempts;

    const freshCount = tabStudents.filter(
      (a) => a && a.normalized_entry_mode === "Fresh",
    ).length;
    const directEntryCount = tabStudents.filter(
      (a) => a && a.normalized_entry_mode === "Direct Entry",
    ).length;

    return {
      all: mergedAttempts.length,
      regular: regularCount,
      carryover: carryoverCount,
      fresh: freshCount,
      directEntry: directEntryCount,
    };
  }, [mergedAttempts, activeTab]);

  const getFilterDescription = () => {
    const regLabel =
      activeTab === "regular"
        ? "Regular Students"
        : activeTab === "carryover"
          ? "Carryover Students"
          : "All Students";

    const modeLabel =
      modeFilter === "direct_entry"
        ? "Direct Entry"
        : modeFilter === "fresh"
          ? "Fresh"
          : "All Modes of Entry";

    if (activeTab === "all" && modeFilter === "all") {
      return "All Students (all registration types & modes of entry)";
    }
    return `${regLabel} • ${modeLabel}`;
  };

  const handleExportResults = () => {
    if (filteredAttempts.length === 0) {
      toast.info("No students found under the current filter to export.");
      return;
    }

    const csvCell = (value: unknown) => {
      const text = value === null || value === undefined ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    };

    // Keep this order and spelling synchronized with ImportResultsCsvDialog.
    const headers = [
      "Course Code",
      "Matric Number",
      "Student Name",
      "CA Score",
      "Exam Score",
    ];

    const rows = filteredAttempts.map((attempt) => {
      const isAbsent = String(attempt?.grade || "").toUpperCase() === "ABS";
      const studentName = cleanCorruptedChars(
        attempt?.full_name ||
          (attempt?.last_name || attempt?.first_name
            ? `${attempt.last_name || ""}, ${attempt.first_name || ""} ${attempt.middle_name || ""}`.trim()
            : "Unknown"),
      );

      return [
        batch?.course_code || "",
        getResultAttemptIdentifier(attempt),
        studentName,
        isAbsent ? "ABS" : (attempt?.ca_score ?? ""),
        isAbsent ? "" : (attempt?.exam_score ?? ""),
      ]
        .map(csvCell)
        .join(",");
    });

    const csv = `\ufeff${headers.join(",")}\r\n${rows.join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filenamePart = (value: unknown, fallback: string) =>
      String(value || fallback)
        .trim()
        .replace(/[^a-z0-9_-]+/gi, "_")
        .replace(/^_+|_+$/g, "") || fallback;

    link.href = url;
    link.download = [
      filenamePart(batch?.course_code, "course"),
      filenamePart(batch?.academic_session_name || batch?.session_name, "session"),
      filenamePart(batch?.semester_name || batch?.level, "period"),
      activeTab,
      modeFilter,
      "Result_Import_Ready.csv",
    ].join("_");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(
      `Exported ${filteredAttempts.length} result row(s) in the import-ready CSV format.`,
    );
  };

  const handleClearFilteredFields = () => {
    if (batch.status === "approved" || batch.status === "published") return;

    if (!clearCa && !clearExam && !clearAbsent) {
      toast.error("Please select at least one field to clear.");
      return;
    }

    const filteredStudentIds = new Set(
      filteredAttempts.map((a) => a.student_id),
    );

    if (filteredStudentIds.size === 0) {
      toast.info("No students found under the current filter to clear.");
      setClearDialogOpen(false);
      return;
    }

    const newAttempts = attempts.map((a) => {
      if (!filteredStudentIds.has(a.student_id)) {
        return a;
      }

      const updated = { ...a };
      if (clearCa) {
        updated.ca_score = "";
      }
      if (clearExam) {
        updated.exam_score = "";
      }
      if (clearAbsent && updated.grade === "ABS") {
        updated.grade = null;
      }

      const caVal = parseFloat(updated.ca_score);
      const examVal = parseFloat(updated.exam_score);
      const hasCa = !isNaN(caVal) && updated.ca_score !== "";
      const hasExam = !isNaN(examVal) && updated.exam_score !== "";

      if (!hasCa && !hasExam) {
        updated.total_score = null;
        if (updated.grade !== "ABS") {
          updated.grade = null;
        }
      } else {
        const total = (hasCa ? caVal : 0) + (hasExam ? examVal : 0);
        updated.total_score = total.toString();
        if (updated.grade !== "ABS") {
          updated.grade = null;
        }
      }

      return updated;
    });

    setAttempts(newAttempts);
    setClearDialogOpen(false);
    toast.success(
      `Cleared fields for ${filteredStudentIds.size} student(s) (${getFilterDescription()}). Click 'Save Changes' to persist.`,
      { duration: 5000 },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">
              {batch?.course_code || "Result Batch"}{batch?.course_title ? `: ${batch.course_title}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              Academic session: {batch?.academic_session_name || batch?.session_name || "N/A"} |{" "}
              {batch?.semester_name || "N/A"} | {batch?.programme_name || "All Programmes"}
              {batch?.cohort_session_name ? ` | Entry cohort: ${batch.cohort_session_name}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant={
              batch?.status === "published"
                ? "default"
                : batch?.status === "approved"
                  ? "secondary"
                  : "outline"
            }
            className="mr-4"
          >
            {String(batch?.status || "DRAFT").toUpperCase()}
          </Badge>

          {batch?.status === "draft" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateStatus("submitted")}
            >
              Submit for Approval
            </Button>
          )}
          {batch?.status === "submitted" && (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => updateStatus("draft")}
              >
                Reject to Draft
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => updateStatus("approved")}
              >
                Approve Results
              </Button>
            </>
          )}
          {batch?.status === "approved" && (
            <Button size="sm" onClick={() => updateStatus("published")}>
              Publish Results
            </Button>
          )}
        </div>
      </div>

      <ImportResultsCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleCsvImport}
        courseCode={batch?.course_code || ""}
        sessionName={batch?.academic_session_name || batch?.session_name || ""}
        templateData={[
          ...(Array.isArray(attempts) ? attempts : []),
          ...(Array.isArray(classList) ? classList : []).filter(
            (c) => c && !attempts.some((a) => a && a.student_id === c.student_id),
          ),
        ]
          .filter((s): s is any => Boolean(s && typeof s === "object"))
          .map((s) => ({
            matric_number: getResultAttemptIdentifier(s),
            full_name: cleanCorruptedChars(
              s.first_name
                ? `${s.first_name} ${s.last_name || ""}`.trim()
                : (s.full_name || "")
            ),
          }))}
      />

      {incompleteCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>{incompleteCount} student(s)</strong> have an incomplete
            score (CA entered without Exam, or Exam entered without CA). Enter{" "}
            <code className="font-mono font-bold">0</code> explicitly if the
            student scored zero, or mark them <strong>Absent</strong>.
          </span>
        </div>
      )}

      <Card>
        <div className="p-4 flex flex-col xl:flex-row justify-between items-start xl:items-center border-b gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Registration Type Filter */}
            <div className="flex gap-1 bg-muted p-1 rounded-md">
              <Button
                variant={activeTab === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("all")}
                className="text-xs sm:text-sm h-8"
              >
                All Students [{stats.all}]
              </Button>
              <Button
                variant={activeTab === "regular" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("regular")}
                className="text-xs sm:text-sm h-8"
              >
                Regular Students [{stats.regular}]
              </Button>
              <Button
                variant={activeTab === "carryover" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("carryover")}
                className="text-xs sm:text-sm h-8"
              >
                Carryover Students [{stats.carryover}]
              </Button>
            </div>

            {/* Mode of Entry Filter */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md border border-border/60">
              <span className="text-xs font-semibold px-2 text-muted-foreground">
                Mode:
              </span>
              <Button
                variant={modeFilter === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setModeFilter("all")}
                className="text-xs sm:text-sm h-7 px-2.5"
              >
                All Modes
              </Button>
              <Button
                variant={modeFilter === "fresh" ? "default" : "ghost"}
                size="sm"
                onClick={() => setModeFilter("fresh")}
                className="text-xs sm:text-sm h-7 px-2.5"
              >
                Fresh [{stats.fresh}]
              </Button>
              <Button
                variant={modeFilter === "direct_entry" ? "default" : "ghost"}
                size="sm"
                onClick={() => setModeFilter("direct_entry")}
                className="text-xs sm:text-sm h-7 px-2.5"
              >
                Direct Entry [{stats.directEntry}]
              </Button>
            </div>

            {/* Reset Filter Button */}
            {(activeTab !== "all" || modeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveTab("all");
                  setModeFilter("all");
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                title="Reset all filters"
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Reset Filter
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportResults}
              disabled={filteredAttempts.length === 0}
              title={`Export currently filtered results (${getFilterDescription()})`}
            >
              <Download className="mr-2 h-4 w-4" /> Export Results
            </Button>
            {isEditable && (
              <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClearDialogOpen(true)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                title={`Clear score fields for currently filtered students (${getFilterDescription()})`}
                disabled={filteredAttempts.length === 0}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Clear Fields
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </Button>
              <Button size="sm" onClick={saveResults} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
              </>
            )}
          </div>
        </div>

        {stats.regular === 0 && stats.carryover > 0 && (
          <div className="flex items-center gap-2.5 p-3 text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-lg">
            <Info className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Cohort Notice:</strong> All <strong>{stats.carryover}</strong> enrolled student(s) in this batch are retaking this course as a <strong>Carryover / Repeat</strong> enrollment. There are no regular first-attempt students registered for this course at this contact.
            </span>
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading students...
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground space-y-3">
            <p>
              No students found under the <strong>{activeTab === "regular" ? "Regular Students" : activeTab === "carryover" ? "Carryover Students" : "selected"}</strong> filter.
            </p>
            {activeTab === "regular" && stats.carryover > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("all")}
                className="text-xs"
              >
                Switch to All Students ({stats.all})
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Matric No.</TableHead>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="w-[90px] text-center">Absent</TableHead>
                  {activeTab === "carryover" && (
                    <>
                      <TableHead>Current Level</TableHead>
                      <TableHead>Previous Result</TableHead>
                    </>
                  )}
                  <TableHead className="w-[120px] text-center">
                    CA ({assessmentStructure?.max_ca ?? 30})
                  </TableHead>
                  <TableHead className="w-[120px] text-center">
                    Exam ({assessmentStructure?.max_exam ?? 70})
                  </TableHead>
                  <TableHead className="w-[100px] text-center">Total</TableHead>
                  <TableHead className="w-[100px] text-center">Grade</TableHead>
                  {activeTab === "carryover" && (
                    <TableHead className="w-[100px] text-center">
                      Status
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.map((attempt, index) => {
                  const isCarryover = ["CARRYOVER", "REPEAT"].includes(
                    (attempt?.registration_type || "").toUpperCase(),
                  ) || Boolean(attempt?.is_carryover);
                  return (
                    <TableRow key={attempt?.student_id || attempt?.id || index}>
                      <TableCell className="font-medium">
                        {getResultAttemptIdentifier(attempt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>
                            {cleanCorruptedChars(
                              attempt?.full_name ||
                                (attempt?.last_name || attempt?.first_name
                                  ? `${attempt.last_name || ""}, ${attempt.first_name || ""} ${attempt.middle_name || ""}`
                                  : "Unknown")
                            )}
                          </span>
                          {activeTab === "all" && isCarryover && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 h-5"
                            >
                              Carryover
                            </Badge>
                          )}
                          {activeTab === "all" && !isCarryover && attempt?.registration_type !== "UNREGISTERED" && (
                            <Badge
                              variant="secondary"
                              className="text-xs py-0 h-5 text-muted-foreground bg-muted"
                            >
                              Regular
                            </Badge>
                          )}
                          {activeTab === "all" && attempt?.registration_type === "UNREGISTERED" && (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 h-5 border-amber-300 text-amber-700 bg-amber-50"
                            >
                              Unregistered
                            </Badge>
                          )}
                          {attempt?.normalized_entry_mode === "Direct Entry" ? (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 h-5 border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-300 font-normal"
                            >
                              Direct Entry
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs py-0 h-5 border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-950 dark:text-sky-300 font-normal"
                            >
                              Fresh
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Checkbox
                          checked={attempt?.grade === "ABS"}
                          onCheckedChange={(checked) =>
                            handleAbsentChange(index, checked === true)
                          }
                          disabled={!isEditable || attempt?.is_locked == 1}
                          aria-label={`Mark ${attempt?.full_name || getResultAttemptIdentifier(attempt)} absent`}
                        />
                      </TableCell>

                      {activeTab === "carryover" && (
                        <>
                          <TableCell>{attempt?.current_level || ""}</TableCell>
                          <TableCell>
                            {attempt?.previous_attempt ? (
                              <span className="text-xs text-muted-foreground">
                                {attempt.previous_attempt.session_name || ""}{" "}
                                {attempt.previous_attempt.semester_name || ""} —{" "}
                                <span className="font-medium text-foreground">
                                  {attempt.previous_attempt.score ?? ""}
                                  {attempt.previous_attempt.grade ?? ""}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                N/A
                              </span>
                            )}
                          </TableCell>
                        </>
                      )}

                      {(() => {
                        const isAbs = attempt?.grade === "ABS";
                        const hasCa =
                          attempt?.ca_score !== null &&
                          attempt?.ca_score !== undefined &&
                          String(attempt?.ca_score).trim() !== "";
                        const hasExam =
                          attempt?.exam_score !== null &&
                          attempt?.exam_score !== undefined &&
                          String(attempt?.exam_score).trim() !== "";
                        const isPartial = !isAbs && ((hasCa && !hasExam) || (!hasCa && hasExam));

                        return (
                          <>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={assessmentStructure?.max_ca ?? 30}
                                title={
                                  isPartial && !hasCa
                                    ? "CA score is missing while Exam score is entered"
                                    : undefined
                                }
                                className={`text-center ${
                                  isPartial && !hasCa
                                    ? "border-amber-500 bg-amber-50/60 focus-visible:ring-amber-500"
                                    : ""
                                }`}
                                value={attempt?.ca_score ?? ""}
                                onChange={(e) =>
                                  handleScoreChange(
                                    index,
                                    "ca_score",
                                    e.target.value,
                                  )
                                }
                                disabled={!isEditable || attempt?.is_locked == 1}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={assessmentStructure?.max_exam ?? 70}
                                title={
                                  isPartial && !hasExam
                                    ? "Exam score is missing while CA score is entered"
                                    : undefined
                                }
                                className={`text-center ${
                                  isPartial && !hasExam
                                    ? "border-amber-500 bg-amber-50/60 focus-visible:ring-amber-500"
                                    : ""
                                }`}
                                value={attempt.exam_score ?? ""}
                                onChange={(e) =>
                                  handleScoreChange(
                                    index,
                                    "exam_score",
                                    e.target.value,
                                  )
                                }
                                disabled={!isEditable || attempt.is_locked == 1}
                              />
                            </TableCell>
                          </>
                        );
                      })()}
                      <TableCell className="text-center font-bold">
                        {attempt.total_score !== null &&
                        attempt.total_score !== ""
                          ? attempt.total_score
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {attempt.grade ? (
                          <Badge
                            variant={
                              attempt.grade === "F" || attempt.grade === "ABS"
                                ? "destructive"
                                : "default"
                            }
                          >
                            {attempt.grade}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      {activeTab === "carryover" && (
                        <TableCell className="text-center">
                          {attempt.grade ? (
                            <Badge variant="outline">
                              {attempt.grade === "ABS"
                                ? "Absent"
                                : attempt.grade === "F"
                                  ? "Failed Again"
                                  : "Passed"}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Confirmation Dialog for Clearing Fields by Filter */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Clear Fields by Filter
            </DialogTitle>
            <DialogDescription>
              You are about to clear entered scores for{" "}
              <strong className="text-foreground">
                {filteredAttempts.length} student(s)
              </strong>{" "}
              matching the active filter:
              <span className="block mt-2 font-semibold text-foreground bg-muted p-2 rounded text-xs">
                {getFilterDescription()}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 border-y">
            <p className="text-xs font-semibold text-muted-foreground">
              Select fields to clear:
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={clearCa}
                  onCheckedChange={(c) => setClearCa(c === true)}
                />
                <span>CA Scores</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={clearExam}
                  onCheckedChange={(c) => setClearExam(c === true)}
                />
                <span>Exam Scores</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={clearAbsent}
                  onCheckedChange={(c) => setClearAbsent(c === true)}
                />
                <span>Reset Absent (ABS) Status</span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground italic">
              Note: This action clears the fields in your browser. Click
              &quot;Save Changes&quot; afterwards to persist to the server.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearFilteredFields}
              disabled={filteredAttempts.length === 0}
            >
              Clear Fields ({filteredAttempts.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
