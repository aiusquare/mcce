import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertTriangle, Clock, BookOpen } from "lucide-react";
import api from "@/lib/api";

interface StudentAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string | null;
  sessionId?: string;
  ineligibleStudent?: any;
}

export function StudentAuditModal({
  open,
  onOpenChange,
  studentId,
  sessionId,
  ineligibleStudent,
}: StudentAuditModalProps) {
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);

  useEffect(() => {
    if (open && studentId) {
      loadAudit();
    } else {
      setAuditData(null);
    }
  }, [open, studentId]);

  const loadAudit = async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      let res: any;
      try {
        res = await api.get(
          `/admin_graduation/student_audit?student_id=${studentId}${
            sessionId ? `&session_id=${sessionId}` : ""
          }`
        );
      } catch (firstErr: any) {
        if (firstErr?.status === 404 || firstErr?.message?.includes("404")) {
          res = await api.get(
            `/api/admin/graduation/student-audit?student_id=${studentId}${
              sessionId ? `&session_id=${sessionId}` : ""
            }`
          );
        } else {
          throw firstErr;
        }
      }
      setAuditData(res?.data || res || null);
    } catch (err) {
      // Fallback to ineligibleStudent details if backend endpoint fails
      setAuditData(null);
    } finally {
      setLoading(false);
    }
  };

  const student = auditData?.student || ineligibleStudent || {};
  const metrics = auditData?.metrics || {
    tcr: ineligibleStudent?.tcr,
    tce: ineligibleStudent?.tce,
    tqp: ineligibleStudent?.tqp,
    cgpa: ineligibleStudent?.cgpa,
  };
  const deficiencies = ineligibleStudent?.deficiencies || [];
  const outstanding = auditData?.courses_eval?.outstanding || ineligibleStudent?.outstanding_courses || [];
  const pending = auditData?.courses_eval?.pending || ineligibleStudent?.pending_courses || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Graduation Clearance Audit
              </DialogTitle>
              <DialogDescription>
                Detailed academic transcript clearance audit and deficiency breakdown.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            Loading student academic records...
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Candidate Demographic Card */}
            <Card className="bg-muted/40">
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Student Name</span>
                  <strong className="text-foreground">{student.names || student.full_name || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Matric Number</span>
                  <strong className="text-foreground">{student.matric_number || "N/A"}</strong>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Entry Mode & Level</span>
                  <span className="font-medium">
                    {student.entry_mode || "UTME"} ({student.entry_level ? `${student.entry_level}L` : "100L"})
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Admitted Year</span>
                  <span className="font-medium">{student.year_admitted || "N/A"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Academic Metrics Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-card text-center">
                <span className="text-xs text-muted-foreground block">TCR (Registered)</span>
                <span className="text-xl font-bold">{metrics.tcr ?? "—"}</span>
              </div>
              <div className="p-3 rounded-lg border bg-card text-center">
                <span className="text-xs text-muted-foreground block">TCE (Earned)</span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  {metrics.tce ?? "—"}
                </span>
              </div>
              <div className="p-3 rounded-lg border bg-card text-center">
                <span className="text-xs text-muted-foreground block">TQP (Points)</span>
                <span className="text-xl font-bold">{metrics.tqp ?? "—"}</span>
              </div>
              <div className="p-3 rounded-lg border bg-card text-center">
                <span className="text-xs text-muted-foreground block">Cumulative GPA</span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-400">
                  {metrics.cgpa ? Number(metrics.cgpa).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>

            {/* Clearance Checklist */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold tracking-tight">Graduation Clearance Checklist</h4>

              <div className="space-y-2">
                {/* 1. Zero Outstanding */}
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  {outstanding.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-sm">
                    <span className="font-medium block">
                      Zero Unresolved Carryover Courses
                    </span>
                    {outstanding.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        All attempted courses throughout the candidate's career have been successfully passed.
                      </span>
                    ) : (
                      <div className="mt-1">
                        <span className="text-xs text-destructive block mb-1">
                          The student has {outstanding.length} unresolved failed course(s):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {outstanding.map((c: string) => (
                            <Badge key={c} variant="destructive" className="font-mono text-xs">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Zero Pending / NR */}
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  {pending.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-sm">
                    <span className="font-medium block">
                      Zero Incomplete / Unrecorded Results
                    </span>
                    {pending.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        All registered courses have approved examination scores on record.
                      </span>
                    ) : (
                      <div className="mt-1">
                        <span className="text-xs text-amber-700 dark:text-amber-400 block mb-1">
                          {pending.length} registered course(s) lack approved/published results:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {pending.map((c: string) => (
                            <Badge key={c} variant="outline" className="border-amber-500 text-amber-700 font-mono text-xs">
                              {c} (NR)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. TCE Threshold */}
                {deficiencies.some((d: any) => d.category === "tce") && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/40 bg-destructive/5">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <span className="font-medium block text-destructive">
                        Total Credits Earned (TCE) Deficiency
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {deficiencies.find((d: any) => d.category === "tce")?.message}
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. CGPA Threshold */}
                {deficiencies.some((d: any) => d.category === "cgpa") && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/40 bg-destructive/5">
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <span className="font-medium block text-destructive">
                        Cumulative GPA Below Minimum Cutoff
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {deficiencies.find((d: any) => d.category === "cgpa")?.message}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

