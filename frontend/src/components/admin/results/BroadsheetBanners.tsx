import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  FileEdit,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

interface BroadsheetBannersProps {
  basis: string;
  summary: any;
  approvalStatus?: string;
  snapshot?: any;
  onOpenReconciliation: () => void;
  onOpenSnapshots: () => void;
  onRefreshSnapshot?: () => void;
}

export function BroadsheetBanners({
  basis,
  summary,
  approvalStatus,
  snapshot,
  onOpenReconciliation,
  onOpenSnapshots,
  onRefreshSnapshot,
}: BroadsheetBannersProps) {
  const isWorking = basis === "working";
  const completeness = summary?.completeness_percentage ?? 100;
  const isComplete = completeness >= 100;
  const reconciliation = summary?.reconciliation;
  const hasReconciliationIssues = reconciliation && reconciliation.total_issues > 0;
  const isStale = Boolean(snapshot?.is_stale || snapshot?.stale_at);

  return (
    <div className="space-y-3 print:hidden">
      {/* 0. Stale Snapshot Alert */}
      {isStale && (
        <Alert className="bg-amber-500/10 border-amber-500/50 text-amber-900 py-3">
          <RefreshCw className="h-4 w-4 text-amber-600" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
            <div>
              <AlertTitle className="text-xs font-bold uppercase tracking-wide text-amber-800 flex items-center gap-1.5">
                <span>Broadsheet Out of Sync</span>
                <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 font-mono text-[10px]">
                  STALE
                </Badge>
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-800">
                {snapshot?.stale_reason || "Source results or prior contact data have been modified since this snapshot was generated."}
              </AlertDescription>
            </div>
            {onRefreshSnapshot && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefreshSnapshot}
                className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 h-8 text-xs font-semibold shrink-0 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5 text-amber-700" />
                Refresh Broadsheet
              </Button>
            )}
          </div>
        </Alert>
      )}

      {/* 1. Working Copy Alert */}
      {isWorking && (
        <Alert className="bg-amber-50/70 border-amber-300 text-amber-900 py-3">
          <FileEdit className="h-4 w-4 text-amber-600" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
            <div>
              <AlertTitle className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Working Copy / Preview Mode
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-800">
                This broadsheet includes unapproved and draft result batches for internal review.
                Official academic decisions require the Official (Published) view.
              </AlertDescription>
            </div>
            <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 font-semibold self-start sm:self-center">
              DRAFT PREVIEW
            </Badge>
          </div>
        </Alert>
      )}

      {/* 2. Completeness Warning */}
      {!isComplete && (
        <Alert className="bg-purple-50/70 border-purple-300 text-purple-900 py-3">
          <HelpCircle className="h-4 w-4 text-purple-600" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
            <div>
              <AlertTitle className="text-xs font-bold uppercase tracking-wide text-purple-800">
                Provisional Standings (Incomplete Results: {completeness}%)
              </AlertTitle>
              <AlertDescription className="text-xs text-purple-800">
                {summary.total_scores_entered} of {summary.total_scores_expected} expected scores have been recorded.
                Students with missing scores (NR) receive provisional CGPAs marked with (*), and final standing is withheld.
              </AlertDescription>
            </div>
            <Badge variant="outline" className="bg-purple-100 text-purple-900 border-purple-300 font-bold self-start sm:self-center">
              {completeness}% COMPLETE
            </Badge>
          </div>
        </Alert>
      )}

      {/* 3. Reconciliation Alert */}
      {hasReconciliationIssues ? (
        <Alert className="bg-red-50/70 border-red-300 text-red-900 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
            <div>
              <AlertTitle className="text-xs font-bold uppercase tracking-wide text-red-800">
                Integrity Alert: {reconciliation.total_issues} Reconciliation Discrepancies
              </AlertTitle>
              <AlertDescription className="text-xs text-red-800">
                Found differences between registered courses and submitted result sheets (e.g. unscored registrations, orphan scores).
              </AlertDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenReconciliation}
              className="border-red-300 text-red-900 hover:bg-red-100 h-8 text-xs font-semibold shrink-0"
            >
              Inspect {reconciliation.total_issues} Issues
            </Button>
          </div>
        </Alert>
      ) : reconciliation ? (
        <div className="flex items-center justify-between p-2.5 px-3 bg-green-50/50 border border-green-200 rounded-lg text-xs text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>
              <strong>Reconciliation Verified:</strong> 0 registration/result discrepancies.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenReconciliation}
            className="h-7 text-xs text-green-800 hover:bg-green-100/50"
          >
            View Verification Details
          </Button>
        </div>
      ) : null}

      {/* 4. Snapshot & Governance Bar */}
      <div className="flex flex-wrap items-center justify-between p-2.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-semibold text-slate-700">Governance & Approval:</span>
          {snapshot ? (
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-mono bg-white font-bold">
                {snapshot.verification_code || `v${snapshot.version}`}
              </Badge>
              <Badge
                variant={snapshot.status === "approved" ? "default" : "secondary"}
                className="text-[10px] uppercase font-bold"
              >
                {snapshot.status}
              </Badge>
            </div>
          ) : (
            <Badge variant="secondary" className="text-[10px] uppercase">
              {approvalStatus || "Live Working"}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSnapshots}
          className="h-7 text-xs font-medium"
        >
          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
          Versions & Sign-Offs
        </Button>
      </div>
    </div>
  );
}
