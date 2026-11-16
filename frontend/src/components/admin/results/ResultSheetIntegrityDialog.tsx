import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Loader2,
  Download,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  History,
  Check,
  Search,
  Filter,
  ShieldCheck,
  Info,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cleanCorruptedChars } from "@/lib/api";

export interface IntegrityIssue {
  issue_id: string;
  attempt_id: string;
  student_id: string;
  student_name: string;
  matric_number: string;
  type: string;
  severity: "danger" | "warning" | "info";
  stored_classification: string;
  verified_classification: string;
  source_attempt_id: string | null;
  evidence: {
    is_first_attempt?: boolean;
    prior_attempt_count?: number;
    teaching_session?: string;
    contact?: string;
    entry_mode?: string;
    has_prior_failure?: boolean;
    prior_failure_attempt_id?: string | null;
    registration_item_type?: string | null;
    registration_id?: string | null;
    curriculum_course_type?: string;
    is_locked?: boolean;
    batch_status?: string;
    source_attempt_id?: string | null;
    clearing_attempt_id?: string;
    clearing_session?: string;
    clearing_grade?: string;
    source_student_id?: string;
    current_student_id?: string;
    source_course_id?: string;
    current_course_id?: string;
    source_session?: string;
    source_semester?: string;
    source_grade?: string;
    source_score?: number | null;
    registration_session_id?: string;
    batch_teaching_session_ids?: string[];
  };
  recommended_action: string;
  can_auto_correct: boolean;
  reason: string;
  is_protected?: boolean;
}

export interface IntegrityAuditData {
  batch_id: string;
  batch?: {
    id: string;
    course_id: string;
    course_code: string;
    course_title: string;
    session_name: string;
    semester_name: string;
    programme_name: string;
    level: string;
    status: string;
  };
  summary: {
    total_attempts: number;
    total_issues: number;
    auto_correctable: number;
    manual_review: number;
    protected: number;
    by_type: Record<string, number>;
    by_severity: {
      danger: number;
      warning: number;
      info: number;
    };
  };
  issues: IntegrityIssue[];
}

interface ResultSheetIntegrityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  onReconciliationComplete?: () => void;
}

export function ResultSheetIntegrityDialog({
  open,
  onOpenChange,
  batchId,
  onReconciliationComplete,
}: ResultSheetIntegrityDialogProps) {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<IntegrityAuditData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [eligibilityFilter, setEligibilityFilter] = useState<string>("all");

  // Selection & Details
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  // Academic History Sub-modal
  const [historyStudent, setHistoryStudent] = useState<{
    id: string;
    name: string;
    matric: string;
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[] | null>(null);

  useEffect(() => {
    if (open && batchId) {
      loadAudit();
      setSelectedIssueIds(new Set());
      setExpandedIssueId(null);
    }
  }, [open, batchId]);

  const loadAudit = async () => {
    if (!batchId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = (await api.get(
        `/api/admin/results/attempts/integrity?batch_id=${encodeURIComponent(batchId)}`
      )) as any;
      if (res?.data) {
        setData(res.data);
      } else {
        throw new Error(res?.message || "Invalid audit response");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to load result sheet integrity audit";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (!data?.issues || data.issues.length === 0) return;
    const headers = [
      "Matric Number",
      "Student Name",
      "Issue Type",
      "Severity",
      "Stored Classification",
      "Verified Classification",
      "Auto Correctable",
      "Recommended Action",
      "Reason",
      "Source Attempt ID",
      "Teaching Session",
      "Contact",
      "Prior Failures",
    ];
    const rows = data.issues.map((i) => [
      `"${i.matric_number || ""}"`,
      `"${cleanCorruptedChars(i.student_name || "").replace(/"/g, '""')}"`,
      `"${i.type || ""}"`,
      `"${i.severity || ""}"`,
      `"${i.stored_classification || ""}"`,
      `"${i.verified_classification || ""}"`,
      i.can_auto_correct ? "Yes" : "No",
      `"${(i.recommended_action || "").replace(/"/g, '""')}"`,
      `"${(i.reason || "").replace(/"/g, '""')}"`,
      `"${i.source_attempt_id || ""}"`,
      `"${i.evidence?.teaching_session || ""}"`,
      `"${i.evidence?.contact || ""}"`,
      i.evidence?.has_prior_failure ? "Yes" : "No",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `result_integrity_audit_${data.batch?.course_code || "batch"}_${Date.now()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadStudentHistory = async (student: { id: string; name: string; matric: string }) => {
    setHistoryStudent(student);
    setHistoryLoading(true);
    setHistoryRecords(null);
    try {
      const res = (await api.get(
        `/api/admin/results/student-history?student_id=${encodeURIComponent(student.id)}`
      )) as any;
      const records = Array.isArray(res?.data?.results)
        ? res.data.results
        : Array.isArray(res?.data?.history)
        ? res.data.history
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setHistoryRecords(records);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load student academic history");
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleReconcileSingle = async (issue: IntegrityIssue) => {
    if (!issue.can_auto_correct) {
      toast.error("This issue requires manual academic review and cannot be automatically reconciled.");
      return;
    }
    setActionLoading(true);
    try {
      const res = (await api.post("/api/admin/results/attempts/integrity/reconcile", {
        batch_id: batchId,
        attempt_id: issue.attempt_id,
        expected_stored_classification: issue.stored_classification,
        requested_correction: issue.verified_classification,
        reason: issue.reason,
      })) as any;

      toast.success(res?.message || `Successfully reconciled ${issue.matric_number}`);
      setSelectedIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(issue.issue_id);
        return next;
      });
      await loadAudit();
      if (onReconciliationComplete) {
        onReconciliationComplete();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Reconciliation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeverAndReconcile = async (issue: IntegrityIssue) => {
    setActionLoading(true);
    try {
      const res = (await api.post("/api/admin/results/attempts/integrity/reconcile", {
        batch_id: batchId,
        attempt_id: issue.attempt_id,
        expected_stored_classification: issue.stored_classification,
        requested_correction: issue.verified_classification,
        sever_invalid_source: true,
        reason: "Severed invalid future source link and reconciled classification to " + issue.verified_classification,
      })) as any;

      toast.success(res?.message || `Successfully severed invalid link and reconciled ${issue.matric_number}`);
      setSelectedIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(issue.issue_id);
        return next;
      });
      await loadAudit();
      if (onReconciliationComplete) {
        onReconciliationComplete();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Sever and reconcile failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveGhost = async (issue: IntegrityIssue) => {
    if (!issue.can_auto_correct) {
      toast.error("This issue requires manual review and cannot be automatically removed.");
      return;
    }
    setActionLoading(true);
    try {
      const res = (await api.post("/api/admin/results/attempts/integrity/reconcile", {
        batch_id: batchId,
        attempt_id: issue.attempt_id,
        expected_stored_classification: issue.stored_classification,
        requested_correction: "remove",
        reason: issue.reason || "Removed unverified ghost carryover attempt without source failure",
      })) as any;

      toast.success(res?.message || `Successfully removed ghost carryover for ${issue.matric_number}`);
      setSelectedIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(issue.issue_id);
        return next;
      });
      await loadAudit();
      if (onReconciliationComplete) {
        onReconciliationComplete();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove ghost record");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconcileSelected = async () => {
    const correctableSelected = filteredIssues.filter(
      (i) => selectedIssueIds.has(i.issue_id) && i.can_auto_correct
    );
    if (correctableSelected.length === 0) {
      toast.error("No safe auto-correctable issues selected.");
      return;
    }

    setActionLoading(true);
    let successCount = 0;
    let failCount = 0;

    for (const issue of correctableSelected) {
      try {
        await api.post("/api/admin/results/attempts/integrity/reconcile", {
          batch_id: batchId,
          attempt_id: issue.attempt_id,
          expected_stored_classification: issue.stored_classification,
          requested_correction: issue.verified_classification,
          reason: issue.reason,
        });
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    if (failCount === 0) {
      toast.success(`Successfully reconciled ${successCount} selected issue(s).`);
    } else {
      toast.warning(`Reconciled ${successCount} issue(s); ${failCount} failed.`);
    }

    setSelectedIssueIds(new Set());
    await loadAudit();
    if (onReconciliationComplete) {
      onReconciliationComplete();
    }
    setActionLoading(false);
  };

  // Filter issues
  const filteredIssues = useMemo(() => {
    if (!data?.issues) return [];
    return data.issues.filter((issue) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const m = (issue.matric_number || "").toLowerCase();
        const n = (issue.student_name || "").toLowerCase();
        if (!m.includes(q) && !n.includes(q)) return false;
      }
      // Type
      if (typeFilter !== "all" && issue.type !== typeFilter) return false;
      // Severity
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      // Eligibility
      if (eligibilityFilter === "auto_correctable" && !issue.can_auto_correct) return false;
      if (eligibilityFilter === "manual_review" && issue.can_auto_correct) return false;

      return true;
    });
  }, [data, searchQuery, typeFilter, severityFilter, eligibilityFilter]);

  const selectAllEligible = () => {
    const eligible = filteredIssues.filter((i) => i.can_auto_correct).map((i) => i.issue_id);
    if (eligible.every((id) => selectedIssueIds.has(id))) {
      // Deselect all
      setSelectedIssueIds(new Set());
    } else {
      setSelectedIssueIds(new Set(eligible));
    }
  };

  const toggleSelectIssue = (id: string) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "danger":
        return <Badge variant="destructive" className="text-[10px] uppercase font-mono">Blocking</Badge>;
      case "warning":
        return <Badge variant="outline" className="text-[10px] uppercase font-mono border-amber-400 text-amber-800 bg-amber-50">Warning</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] uppercase font-mono">Info</Badge>;
    }
  };

  const getIssueLabel = (type: string) => {
    switch (type) {
      case "de_first_contact_misclassified_carryover":
        return "DE Contact 2 Stamped Carryover";
      case "incorrect_first_attempt_classification":
        return "First Attempt Stamped Carryover";
      case "unverified_carryover_missing_source":
        return "Ghost Carryover (No Source Failure)";
      case "genuine_carryover_missing_correction_link":
        return "Missing Correction Entry";
      case "source_student_mismatch":
        return "Source Student ID Mismatch";
      case "source_course_mismatch":
        return "Source Course ID Mismatch";
      case "source_period_invalid":
        return "Source In Same/Future Period";
      case "source_attempt_passed":
        return "Source Was Passing Result";
      case "conflicting_source_provenance":
        return "Conflicting Source References";
      case "registration_session_mismatch":
        return "Registration Session Mismatch";
      case "registration_item_classification_conflict":
        return "Reg Item Type Conflict";
      case "snapshot_classification_mismatch":
        return "Snapshot Classification Drift";
      case "duplicate_batch_attempt":
        return "Duplicate Attempt in Batch";
      case "unregistered_scored_attempt":
        return "Scored Attempt Without Registration";
      case "previously_cleared_carryover":
        return "Previously Cleared Carryover";
      case "unidentified_genuine_carryover":
        return "Genuine Carryover (Stamped Regular)";
      default:
        return type.replace(/_/g, " ");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Result Sheet Integrity Audit & Reconciliation
              </DialogTitle>
              <DialogDescription>
                15-point academic classification & provenance verification for{" "}
                <span className="font-semibold text-slate-800">
                  {data?.batch?.course_code} - {data?.batch?.course_title}
                </span>{" "}
                ({data?.batch?.session_name} {data?.batch?.semester_name})
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadAudit}
                disabled={loading || actionLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading || actionLoading ? "animate-spin" : ""}`} />
                Refresh Audit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={loading || actionLoading || !data?.issues?.length}
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="p-16 text-center space-y-3">
            <Loader2 className="h-9 w-9 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground font-medium">
              Executing 15-point read-only integrity audit across academic history...
            </p>
          </div>
        ) : loadError ? (
          <div className="p-8 text-center space-y-3 bg-red-50 border border-red-200 rounded-lg">
            <ShieldAlert className="h-8 w-8 text-red-600 mx-auto" />
            <h4 className="font-bold text-red-800">Integrity Verification Unavailable</h4>
            <p className="text-xs text-red-700 max-w-md mx-auto">{loadError}</p>
            <Button variant="outline" size="sm" onClick={loadAudit}>
              Retry Verification
            </Button>
          </div>
        ) : !data ? (
          <div className="p-8 text-center text-muted-foreground">No audit data available.</div>
        ) : (
          <div className="space-y-5">
            {/* Summary Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Audit Status</span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold">
                  {data.summary.total_issues === 0 ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">100% Clean</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700">{data.summary.total_issues} Discrepancies</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Total Attempts</span>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{data.summary.total_attempts}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Auto-Correctable</span>
                <p className="text-lg font-bold text-green-600 mt-0.5">{data.summary.auto_correctable}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Manual Review</span>
                <p className="text-lg font-bold text-amber-600 mt-0.5">{data.summary.manual_review}</p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Protected / Locked</span>
                <p className="text-lg font-bold text-slate-500 mt-0.5">{data.summary.protected}</p>
              </div>
            </div>

            {/* Classification Discrepancy Alert Banner */}
            {data.summary.total_issues > 0 && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-amber-900 block text-sm">
                    {data.summary.total_issues} Academic Classification Discrepancies Detected
                  </span>
                  <span className="text-amber-800 block">
                    Some examination classifications in this batch do not agree with the students' verified academic history.
                    {data.summary.auto_correctable > 0 && (
                      <span className="ml-1 font-semibold">
                        {data.summary.auto_correctable} discrepancies have verified academic proof and can be safely corrected without modifying scores.
                      </span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="p-3 rounded-lg border bg-muted/30 flex flex-wrap items-center gap-3 justify-between text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by matric number or student name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-8 text-xs px-2 rounded border bg-white text-slate-700"
                >
                  <option value="all">All Issue Types ({data.issues.length})</option>
                  {Object.entries(data.summary.by_type || {}).map(([type, count]) => (
                    <option key={type} value={type}>
                      {getIssueLabel(type)} ({count})
                    </option>
                  ))}
                </select>

                <select
                  value={eligibilityFilter}
                  onChange={(e) => setEligibilityFilter(e.target.value)}
                  className="h-8 text-xs px-2 rounded border bg-white text-slate-700"
                >
                  <option value="all">All Eligibility</option>
                  <option value="auto_correctable">Auto-Correctable ({data.summary.auto_correctable})</option>
                  <option value="manual_review">Manual Review ({data.summary.manual_review})</option>
                </select>

                {data.summary.auto_correctable > 0 && (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                    disabled={actionLoading || selectedIssueIds.size === 0}
                    onClick={handleReconcileSelected}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    Correct Selected ({selectedIssueIds.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Issues Table */}
            {filteredIssues.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground border rounded-lg bg-card space-y-2">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                <p className="font-semibold text-slate-700">No matching issues found</p>
                <p className="text-xs">All records under the active filter criteria comply with academic integrity standards.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 text-xs">
                      <TableHead className="w-[40px] text-center">
                        <Checkbox
                          checked={
                            filteredIssues.filter((i) => i.can_auto_correct).length > 0 &&
                            filteredIssues
                              .filter((i) => i.can_auto_correct)
                              .every((i) => selectedIssueIds.has(i.issue_id))
                          }
                          onCheckedChange={selectAllEligible}
                          title="Select all safe auto-correctable issues"
                        />
                      </TableHead>
                      <TableHead className="w-[120px]">Matric No.</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="w-[160px]">Issue Type</TableHead>
                      <TableHead className="w-[100px] text-center">Stored</TableHead>
                      <TableHead className="w-[100px] text-center">Verified</TableHead>
                      <TableHead className="w-[110px] text-center">Eligibility</TableHead>
                      <TableHead className="w-[140px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIssues.map((issue) => {
                      const isExpanded = expandedIssueId === issue.issue_id;
                      const isSelected = selectedIssueIds.has(issue.issue_id);

                      return (
                        <>
                          <TableRow
                            key={issue.issue_id}
                            className={`cursor-pointer hover:bg-muted/30 text-xs ${
                              isExpanded ? "bg-muted/20" : ""
                            }`}
                            onClick={() => setExpandedIssueId(isExpanded ? null : issue.issue_id)}
                          >
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                disabled={!issue.can_auto_correct || issue.is_protected}
                                onCheckedChange={() => toggleSelectIssue(issue.issue_id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono font-medium">
                              {issue.matric_number || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-800">
                                {cleanCorruptedChars(issue.student_name)}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                <span>{issue.evidence?.entry_mode || "Fresh"}</span>
                                <span>•</span>
                                <span>{issue.evidence?.contact || "Current Contact"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <span className="font-semibold text-slate-700 block">
                                  {getIssueLabel(issue.type)}
                                </span>
                                {getSeverityBadge(issue.severity)}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[10px] uppercase font-mono border-amber-300 text-amber-700">
                                {issue.stored_classification || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {issue.verified_classification === "remove" ? (
                                <Badge variant="outline" className="text-[10px] uppercase font-mono font-bold text-rose-800 bg-rose-50 border border-rose-300">
                                  REMOVE
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] uppercase font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                                  {issue.verified_classification}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {issue.can_auto_correct ? (
                                <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50">
                                  Auto-Correctable
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800 bg-amber-50">
                                  Manual Review
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900"
                                  title="Inspect Evidence"
                                  onClick={() => setExpandedIssueId(isExpanded ? null : issue.issue_id)}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 text-slate-700"
                                  title="Review Complete Academic History"
                                  onClick={() =>
                                    loadStudentHistory({
                                      id: issue.student_id,
                                      name: issue.student_name,
                                      matric: issue.matric_number,
                                    })
                                  }
                                >
                                  <History className="h-3 w-3 mr-1" />
                                  History
                                </Button>
                                {issue.can_auto_correct && !issue.is_protected && (
                                  issue.verified_classification === "remove" ? (
                                    <Button
                                      size="sm"
                                      className="h-7 text-[11px] px-2.5 bg-rose-700 hover:bg-rose-800 text-white font-medium shadow-sm"
                                      disabled={actionLoading}
                                      onClick={() => handleRemoveGhost(issue)}
                                      title="Remove unverified ghost carryover attempt and de-register item"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      Remove Ghost
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-7 text-[11px] px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                                      disabled={actionLoading}
                                      onClick={() => handleReconcileSingle(issue)}
                                      title="Apply safe audited classification correction"
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Correct
                                    </Button>
                                  )
                                )}
                                {!issue.can_auto_correct && !issue.is_protected && (issue.type === "source_period_invalid" || issue.type === "conflicting_source_provenance" || Boolean(issue.source_attempt_id)) && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px] px-2 bg-rose-700 hover:bg-rose-800 text-white font-medium shadow-sm"
                                    disabled={actionLoading}
                                    onClick={() => handleSeverAndReconcile(issue)}
                                    title="Sever invalid forward link and reconcile to CORE"
                                  >
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                    Sever Link
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Expandable Evidence & Provenance Detail Row */}
                          {isExpanded && (
                            <TableRow className="bg-slate-50/80 border-b">
                              <TableCell colSpan={8} className="p-4">
                                <div className="space-y-3 text-xs bg-white p-3.5 rounded border">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                      <Info className="h-4 w-4 text-blue-600" />
                                      Academic Provenance & Evidence Verification
                                    </div>
                                    <span className="font-mono text-[11px] text-muted-foreground">
                                      Attempt ID: {issue.attempt_id}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-[11px]">
                                    <div>
                                      <span className="text-muted-foreground block">Academic Reason:</span>
                                      <span className="font-medium text-slate-800">{issue.reason}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Recommended Action:</span>
                                      <span className="font-semibold text-emerald-700">{issue.recommended_action}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">First Attempt in Programme:</span>
                                      <span className="font-medium text-slate-800">
                                        {issue.evidence?.is_first_attempt ? "Yes (Zero prior examinations)" : "No"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground block">Prior Failure Recorded:</span>
                                      <span className="font-medium text-slate-800">
                                        {issue.evidence?.has_prior_failure ? "Yes" : "None on record"}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                      <span>
                                        <strong>Curriculum Type:</strong> {issue.evidence?.curriculum_course_type || "core"}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        <strong>Registration Item:</strong> {issue.evidence?.registration_item_type || "unlinked"}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        <strong>Source Reference:</strong> {issue.source_attempt_id || "None"}
                                      </span>
                                    </div>

                                    {issue.can_auto_correct && !issue.is_protected && (
                                      issue.verified_classification === "remove" ? (
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs bg-rose-700 hover:bg-rose-800 text-white font-medium shadow-sm"
                                          disabled={actionLoading}
                                          onClick={() => handleRemoveGhost(issue)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                                          Remove Ghost Carryover Attempt & De-register
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                                          disabled={actionLoading}
                                          onClick={() => handleReconcileSingle(issue)}
                                        >
                                          <Check className="h-3.5 w-3.5 mr-1" />
                                          Reconcile Classification to {issue.verified_classification.toUpperCase()}
                                        </Button>
                                      )
                                    )}

                                    {!issue.can_auto_correct && !issue.is_protected && (issue.type === "source_period_invalid" || issue.type === "conflicting_source_provenance" || Boolean(issue.source_attempt_id)) && (
                                      <Button
                                        size="sm"
                                        className="h-7 text-xs bg-rose-700 hover:bg-rose-800 text-white font-medium shadow-sm"
                                        disabled={actionLoading}
                                        onClick={() => handleSeverAndReconcile(issue)}
                                        title="Sever inverted future pointer and reconcile attempt to verified classification"
                                      >
                                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                                        Sever Invalid Link & Reconcile to {issue.verified_classification.toUpperCase()}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Academic History Sub-Dialog */}
        {historyStudent && (
          <Dialog open={Boolean(historyStudent)} onOpenChange={() => setHistoryStudent(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <History className="h-4 w-4 text-blue-600" />
                  Academic History: {cleanCorruptedChars(historyStudent.name)} ({historyStudent.matric})
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Full transcript of all past examinations, session enrollments, and carryover progression.
                </DialogDescription>
              </DialogHeader>

              {historyLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  <p className="mt-2 text-xs text-muted-foreground">Loading academic record...</p>
                </div>
              ) : !historyRecords || !Array.isArray(historyRecords) || historyRecords.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border rounded">
                  No prior academic records found outside this cohort placement.
                </div>
              ) : (
                <div className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Session</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(historyRecords) && historyRecords.map((hr, idx) => (
                        <TableRow key={hr.id || idx} className="text-xs">
                          <TableCell>{hr.session_name || "—"}</TableCell>
                          <TableCell>{hr.semester_name || hr.level || "—"}</TableCell>
                          <TableCell className="font-medium">{hr.course_code || hr.code || "—"}</TableCell>
                          <TableCell className="text-center">{hr.total_score ?? "—"}</TableCell>
                          <TableCell className="text-center font-bold">{hr.grade ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {hr.registration_type_snapshot || hr.registration_type || "core"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
