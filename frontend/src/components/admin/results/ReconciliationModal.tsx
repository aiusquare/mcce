import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Trash2,
  UserX,
  UserMinus,
  ShieldAlert,
  Layers,
} from "lucide-react";
import { api, API_BASE } from "@/lib/api";
import { toast } from "sonner";

interface ReconciliationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  semesterId: string;
  programmeId: string;
}

export function ReconciliationModal({
  open,
  onOpenChange,
  sessionId,
  semesterId,
  programmeId,
}: ReconciliationModalProps) {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (open && sessionId && semesterId && programmeId) {
      loadReport();
    }
  }, [open, sessionId, semesterId, programmeId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = (await api.get(
        `/api/admin/results/reconciliation?session_id=${sessionId}&semester_id=${semesterId}&programme_id=${programmeId}`
      )) as any;
      setData(res.data || null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load reconciliation report");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, params: any) => {
    setActionLoading(true);
    try {
      const res = (await api.post("/api/admin/results/reconciliation/action", {
        action,
        session_id: sessionId,
        semester_id: semesterId,
        programme_id: programmeId,
        ...params,
      })) as any;
      toast.success(res.data?.message || res.message || "Action executed successfully");
      await loadReport();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to execute reconciliation action");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = () => {
    const url = `${API_BASE}/admin/results/reconciliation/export?session_id=${sessionId}&semester_id=${semesterId}&programme_id=${programmeId}`;
    window.open(url, "_blank");
  };

  const unscoredCourses: string[] = data?.issues
    ? Array.from(
        new Set(
          data.issues
            .filter((i: any) => i.type === "unscored_registration" && i.course_code)
            .map((i: any) => i.course_code as string)
        )
      )
    : [];

  const hasUnregistered = (data?.summary?.by_type?.unregistered_score || 0) > 0;
  const hasCollisions = (data?.summary?.by_type?.multiple_attempt_collision || 0) > 0;
  const hasOrphans = (data?.summary?.by_type?.orphan_attempt || 0) > 0;

  const metricDiscrepancyTypes = [
    "current_tcr_discrepancy",
    "current_tce_discrepancy",
    "current_tqp_discrepancy",
    "previous_ccr_discrepancy",
    "previous_cce_discrepancy",
    "previous_cgp_discrepancy",
    "previous_cgpa_discrepancy",
  ];
  const metricDiscrepancyCount = data?.issues
    ? data.issues.filter((i: any) => metricDiscrepancyTypes.includes(i.type)).length
    : 0;
  const hasMetricDiscrepancies = metricDiscrepancyCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Academic Data Reconciliation Report
              </DialogTitle>
              <DialogDescription>
                8-point integrity verification between Course Registration and Result Sheets.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadReport}
                disabled={loading || actionLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading || actionLoading ? "animate-spin" : ""}`} />
                Refresh
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
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Running reconciliation checks...</p>
          </div>
        ) : !data ? (
          <div className="p-8 text-center text-muted-foreground">
            No data available.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Overall Status</span>
                <div className="flex items-center gap-1.5 mt-1 font-semibold">
                  {data.summary?.total_issues === 0 ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">100% Clean</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700">{data.summary?.total_issues} Issues</span>
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Blocking Errors</span>
                <p className="text-lg font-bold text-red-600 mt-0.5">
                  {data.summary?.by_severity?.danger || data.summary?.by_severity?.error || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Warnings</span>
                <p className="text-lg font-bold text-amber-600 mt-0.5">
                  {data.summary?.by_severity?.warning || 0}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <span className="text-xs text-muted-foreground">Total Cohort Students</span>
                <p className="text-lg font-bold text-slate-800 mt-0.5">
                  {data.summary?.cohort_students_count || data.cohort_students_count || 0}
                </p>
              </div>
            </div>

            {/* Checks breakdown chips */}
            {data.summary?.by_type && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-2">
                <span className="font-semibold text-slate-700">Checks Breakdown:</span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.summary.by_type).map(([key, count]: any) => (
                    <Badge
                      key={key}
                      variant={count > 0 ? "destructive" : "secondary"}
                      className="font-mono text-[11px]"
                    >
                      {key.replace(/_/g, " ")}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Bulk Actions Toolbars */}
            {unscoredCourses.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    {data.summary?.by_type?.unscored_registration || 0} students have no recorded scores for:{" "}
                    <span className="font-bold">{unscoredCourses.join(", ")}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {unscoredCourses.map((code) => (
                    <div key={code} className="flex items-center gap-1.5 p-1 bg-white/80 rounded border">
                      <span className="font-mono font-bold px-1 text-slate-700">{code}:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[11px] px-2 bg-white"
                        disabled={actionLoading}
                        onClick={() => handleAction("bulk_mark_abs", { course_code: code })}
                      >
                        <UserX className="h-3 w-3 mr-1" />
                        Mark All as ABS
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-[11px] px-2"
                        disabled={actionLoading}
                        onClick={() => handleAction("bulk_deregister", { course_code: code })}
                      >
                        <UserMinus className="h-3 w-3 mr-1" />
                        Drop for Cohort
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasUnregistered && (
              <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-red-800 font-medium">
                  <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                  <span>
                    {data.summary?.by_type?.unregistered_score || 0} students have scores for courses they never registered for.
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs font-semibold"
                  disabled={actionLoading}
                  onClick={() => handleAction("bulk_purge_unregistered", {})}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Purge All Unregistered Scores
                </Button>
              </div>
            )}

            {hasCollisions && (
              <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-red-800 font-medium">
                  <Layers className="h-4 w-4 text-red-600 shrink-0" />
                  <span>
                    {data.summary?.by_type?.multiple_attempt_collision || 0} student(s) have duplicate active attempt records in the same batch.
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs font-semibold"
                  disabled={actionLoading}
                  onClick={() => handleAction("bulk_deduplicate_attempts", {})}
                >
                  <Layers className="h-3 w-3 mr-1" />
                  Deduplicate All Collisions
                </Button>
              </div>
            )}

            {hasOrphans && (
              <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-amber-800 font-medium">
                  <Trash2 className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    {data.summary?.by_type?.orphan_attempt || 0} orphan attempt record(s) reference non-existent students or batches.
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                  disabled={actionLoading}
                  onClick={() => handleAction("bulk_prune_orphan_attempts", {})}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Prune All Orphan Records
                </Button>
              </div>
            )}

            {hasMetricDiscrepancies && (
              <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs">
                <div className="flex items-center gap-2 text-amber-800 font-medium">
                  <RefreshCw className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    {metricDiscrepancyCount} metric discrepancy warning(s) detected between eligible registrations/results and displayed broadsheet figures.
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-semibold text-amber-800 border-amber-400 bg-white hover:bg-amber-50"
                  disabled={actionLoading}
                  onClick={() => handleAction("bulk_recalculate_broadsheet_metrics", {})}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Recalculate & Sync All Metrics
                </Button>
              </div>
            )}

            {/* Issues List Table */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Detected Discrepancies</h4>
              {data.issues?.length === 0 ? (
                <div className="p-8 text-center border rounded-lg bg-green-50/40 text-green-800">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="font-semibold">No discrepancies found!</p>
                  <p className="text-xs text-green-700">
                    Course registration and result sheets are perfectly synchronized.
                  </p>
                </div>
              ) : (
                <div className="border rounded-md overflow-x-auto max-h-[350px]">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-16">Severity</TableHead>
                        <TableHead className="w-28">Check Type</TableHead>
                        <TableHead className="w-44">Student</TableHead>
                        <TableHead className="w-20">Course</TableHead>
                        <TableHead>Discrepancy Details</TableHead>
                        <TableHead className="w-44 text-right">Action / Fix</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.issues.map((issue: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge
                              variant={issue.severity === "error" || issue.severity === "danger" ? "destructive" : "secondary"}
                              className="text-[10px] uppercase font-bold"
                            >
                              {issue.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-[10px]">
                            {issue.type}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{issue.student_name || "—"}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {issue.matric_number || issue.student_id || "—"}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono font-semibold">
                            {issue.course_code || "—"}
                          </TableCell>
                          <TableCell className="leading-tight">
                            {issue.message}
                          </TableCell>
                          <TableCell className="text-right">
                            {issue.type === "unregistered_score" && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    handleAction("purge_score", {
                                      attempt_id: issue.details?.attempt_id,
                                      student_id: issue.student_id,
                                      course_id: issue.course_id,
                                      course_code: issue.course_code,
                                    })
                                  }
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Purge
                                </Button>
                              </div>
                            )}

                            {issue.type === "unscored_registration" && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 border-slate-300"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    handleAction("mark_abs", {
                                      student_id: issue.student_id,
                                      course_id: issue.course_id,
                                      course_code: issue.course_code,
                                    })
                                  }
                                >
                                  <UserX className="h-3 w-3 mr-1" />
                                  ABS
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    handleAction("deregister", {
                                      student_id: issue.student_id,
                                      course_id: issue.course_id,
                                      course_code: issue.course_code,
                                    })
                                  }
                                >
                                  <UserMinus className="h-3 w-3 mr-1" />
                                  Drop
                                </Button>
                              </div>
                            )}

                            {issue.type === "multiple_attempt_collision" && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 font-medium"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    handleAction("deduplicate_attempts", {
                                      student_id: issue.student_id,
                                      batch_id: issue.details?.batch_id,
                                      course_code: issue.course_code,
                                    })
                                  }
                                >
                                  <Layers className="h-3 w-3 mr-1" />
                                  Deduplicate
                                </Button>
                              </div>
                            )}

                            {issue.type === "orphan_attempt" && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    handleAction("prune_orphan_attempt", {
                                      attempt_id: issue.details?.id || issue.details?.attempt_id,
                                    })
                                  }
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Prune
                                </Button>
                              </div>
                            )}

                            {issue.type === "ghost_carryover" && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-6 text-[10px] px-2"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    handleAction("drop_ghost_carryover", {
                                      student_id: issue.student_id,
                                      course_id: issue.course_id,
                                      course_code: issue.course_code,
                                    })
                                  }
                                >
                                  <UserMinus className="h-3 w-3 mr-1" />
                                  Drop
                                </Button>
                              </div>
                            )}

                            {metricDiscrepancyTypes.includes(issue.type) && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] px-2 font-medium text-amber-800 border-amber-300 hover:bg-amber-50"
                                  disabled={actionLoading}
                                  onClick={() =>
                                    handleAction("recalculate_broadsheet_metrics", {
                                      student_id: issue.student_id,
                                    })
                                  }
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Recalculate
                                </Button>
                              </div>
                            )}

                            {issue.type !== "unregistered_score" &&
                              issue.type !== "unscored_registration" &&
                              issue.type !== "multiple_attempt_collision" &&
                              issue.type !== "orphan_attempt" &&
                              issue.type !== "ghost_carryover" &&
                              !metricDiscrepancyTypes.includes(issue.type) && (
                              <span className="text-muted-foreground text-[11px]">
                                {issue.suggested_action || issue.fix_hint || "—"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
