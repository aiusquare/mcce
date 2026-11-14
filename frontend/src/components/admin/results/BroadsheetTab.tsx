import { useState, useEffect } from "react";
import { Loader2, Download, Printer, FileText, FileSpreadsheet, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";

import { BroadsheetFilters } from "./BroadsheetFilters";
import { BroadsheetBanners } from "./BroadsheetBanners";
import { BroadsheetSummaryPanel } from "./BroadsheetSummaryPanel";
import { BroadsheetGrid } from "./BroadsheetGrid";
import { BroadsheetPrintDocument } from "./BroadsheetPrintDocument";
import { ReconciliationModal } from "./ReconciliationModal";
import { BroadsheetSnapshotsDrawer } from "./BroadsheetSnapshotsDrawer";

import { generateExcelBroadsheet } from "./excelExport";
import { generateWordBroadsheet } from "./wordExport";
import { generatePdfBroadsheet } from "./pdfExport";
import { resolveContactEntryEligibility } from "./contactEligibility";

export function BroadsheetTab() {
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    session_id: "",
    cohort: "all",
    department_id: "all",
    semester_id: "",
    programme_id: "",
    level: "all",
    entry_mode: "all",
    standing: "all",
    basis: "published", // 'published' (Official) or 'working' (Drafts)
    search: "",
  });

  const [broadsheet, setBroadsheet] = useState<any>(null);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);

  useEffect(() => {
    loadDependencies();
  }, []);

  const loadDependencies = async () => {
    try {
      const [sessRes, deptRes, progRes] = await Promise.all([
        api.get("/api/admin/get-sessions") as any,
        api.get("/api/admin/get-departments") as any,
        api.get("/api/admin/get-programmes") as any,
      ]);
      setSessions(sessRes.data || []);
      setDepartments(deptRes.data || []);
      setProgrammes(progRes.data || []);
    } catch (error) {
      toast.error("Failed to load sessions and programmes");
    }
  };

  const selectedProgramme = programmes.find((p) => p.id === formData.programme_id);
  const progStructure = selectedProgramme?.programme_structure || "semester";
  const contactEligibility = resolveContactEntryEligibility(
    sessions,
    formData.session_id,
    formData.semester_id,
  );

  useEffect(() => {
    const requiredEntryMode = contactEligibility?.entryMode;
    if (requiredEntryMode && formData.entry_mode !== requiredEntryMode) {
      setFormData((current) => ({ ...current, entry_mode: requiredEntryMode }));
    }
  }, [contactEligibility?.entryMode, formData.entry_mode]);

  const generateBroadsheet = async (forceRefresh = false) => {
    if (
      !formData.session_id ||
      !formData.semester_id ||
      !formData.programme_id ||
      formData.programme_id === "all"
    ) {
      toast.error(
        `Please select Session, Programme, and ${
          progStructure === "semester" ? "Semester" : "Contact"
        }`
      );
      return;
    }

    setLoading(true);
    try {
      let url = `/api/admin/results/broadsheet?session_id=${formData.session_id}&semester_id=${formData.semester_id}&programme_id=${formData.programme_id}&basis=${formData.basis}`;
      if (forceRefresh) {
        url += `&force_refresh=1`;
      }
      if (formData.cohort && formData.cohort !== "all") {
        url += `&cohort=${encodeURIComponent(formData.cohort)}`;
      }
      if (formData.level !== "all") {
        url += `&level=${encodeURIComponent(formData.level)}`;
      }
      if (formData.entry_mode !== "all") {
        url += `&entry_mode=${encodeURIComponent(formData.entry_mode)}`;
      }
      if (formData.standing !== "all") {
        url += `&standing=${encodeURIComponent(formData.standing)}`;
      }
      if (formData.search.trim()) {
        url += `&search=${encodeURIComponent(formData.search.trim())}`;
      }

      const res = (await api.get(url)) as any;
      setBroadsheet(res.data || null);
      if (forceRefresh) {
        toast.success("Broadsheet refreshed successfully!");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to generate broadsheet");
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering fallback for instant typing search
  const displayedStudents = broadsheet?.students
    ? broadsheet.students.filter((st: any) => {
        // Entry mode filter
        if (formData.entry_mode !== "all") {
          const em = (st.entry_mode || "").toLowerCase();
          const isDE =
            em.includes("direct") ||
            em === "de" ||
            (st.matric_number && /[A-Za-z]+2\/\d+\/\d+/.test(st.matric_number));
          if (formData.entry_mode === "direct_entry" && !isDE) return false;
          if (formData.entry_mode === "fresh" && isDE) return false;
        }

        // Search text
        if (formData.search.trim()) {
          const q = formData.search.toLowerCase();
          const name = (st.full_name || "").toLowerCase();
          const matric = (st.matric_number || st.admission_number || "").toLowerCase();
          if (!name.includes(q) && !matric.includes(q)) return false;
        }

        // Standing filter
        if (formData.standing !== "all") {
          const isComplete = st.is_complete !== false;
          const cumCcr = Number(st.cumulative?.registered_credits ?? 0);
          const cumCgpaNum = parseFloat(String(st.cumulative?.cgpa ?? "0"));
          const standing: string =
            st.academic_standing ||
            (!isComplete
              ? "INCOMPLETE"
              : cumCcr > 0
              ? cumCgpaNum < 1.0
                ? "WITHDRAWAL"
                : cumCgpaNum < 1.5
                ? "PROBATION"
                : "GOOD_STANDING"
              : "NONE");
          if (standing !== formData.standing) return false;
        }

        return true;
      })
    : [];

  // Strictly exclude any course with zero registration among displayed students everywhere in the broadsheet
  const activeCurrentCourses = (broadsheet?.current_courses || []).filter((c: any) =>
    displayedStudents.some((st: any) => {
      const res = st.current_results?.[c.course_id] ?? st.current_results?.[c.course_code];
      if (!res) return false;
      const status = typeof res === "object" ? res.status : undefined;
      const val = typeof res === "object" ? String(res.display_value ?? "-") : String(res);
      return status !== "unregistered" && val !== "-" && val !== "—";
    })
  );

  const activeCarryoverCourses = (broadsheet?.carryover_courses || []).filter((c: any) =>
    displayedStudents.some((st: any) => {
      const val = st.carryover_results?.[c.course_id] ?? st.carryover_results?.[c.course_code];
      return val !== undefined && val !== null && String(val) !== "-" && String(val) !== "—";
    })
  );

  const activeCourseIds = new Set([
    ...activeCurrentCourses.map((c: any) => c.course_id),
    ...activeCarryoverCourses.map((c: any) => c.course_id),
  ]);

  const filteredSummary = broadsheet?.context?.summary
    ? {
        ...broadsheet.context.summary,
        course_statistics: (broadsheet.context.summary.course_statistics || []).filter(
          (cs: any) => Number(cs.registered_count ?? 1) > 0 && activeCourseIds.has(cs.course_id)
        ),
      }
    : undefined;

  const filteredBroadsheet = broadsheet
    ? {
        ...broadsheet,
        students: displayedStudents,
        current_courses: activeCurrentCourses,
        carryover_courses: activeCarryoverCourses,
        context: {
          ...broadsheet.context,
          summary: filteredSummary,
        },
      }
    : null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = async () => {
    if (!filteredBroadsheet) return;
    setExportingPdf(true);
    try {
      await generatePdfBroadsheet(filteredBroadsheet);
      toast.success("A3 Landscape PDF generated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF document.");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportWord = async () => {
    if (!filteredBroadsheet) return;
    try {
      await generateWordBroadsheet(filteredBroadsheet);
      toast.success("Word document generated.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate Word document.");
    }
  };

  const handleExportExcel = async () => {
    if (!filteredBroadsheet) return;
    try {
      await generateExcelBroadsheet(filteredBroadsheet);
      toast.success("Excel spreadsheet generated.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate Excel document.");
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Filter Control Panel */}
      <BroadsheetFilters
        sessions={sessions}
        departments={departments}
        programmes={programmes}
        formData={formData}
        setFormData={setFormData}
        contactEligibility={contactEligibility}
        onGenerate={generateBroadsheet}
        loading={loading}
      />

      {broadsheet && (
        <div className="space-y-5">
          {/* 2. Status Banners & Warnings */}
          <BroadsheetBanners
            basis={formData.basis}
            summary={broadsheet.context?.summary}
            approvalStatus={broadsheet.context?.approval_status}
            snapshot={broadsheet.context?.snapshot}
            onOpenReconciliation={() => setReconciliationOpen(true)}
            onOpenSnapshots={() => setSnapshotsOpen(true)}
            onRefreshSnapshot={() => generateBroadsheet(true)}
          />

          {/* 3. Header Action Toolbar */}
          <Card className="print:hidden border-slate-200">
            <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-bold text-lg text-slate-800">
                    Master Result Broadsheet
                  </h3>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      broadsheet.context.approval_status === "Approved"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : broadsheet.context.approval_status === "Partially Approved"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {broadsheet.context.approval_status || "Draft"}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted font-medium text-slate-600">
                    Showing {displayedStudents.length} of {broadsheet.students?.length || 0} students
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {broadsheet.context.programme.name} ({broadsheet.context.programme.code}) &bull;{" "}
                  {broadsheet.context.session.name} &bull; {broadsheet.context.semester.name}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReconciliationOpen(true)}
                  className="h-8 text-xs text-slate-700"
                >
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                  Reconciliation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSnapshotsOpen(true)}
                  className="h-8 text-xs text-slate-700"
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Governance
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs">
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Print A3
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="h-8 text-xs"
                >
                  {exportingPdf ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="mr-1.5 h-3.5 w-3.5 text-red-600" />
                  )}
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportWord} className="h-8 text-xs">
                  <FileText className="mr-1.5 h-3.5 w-3.5 text-blue-600" /> Word
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8 text-xs">
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-green-600" /> Excel
                </Button>
              </div>
            </div>
          </Card>

          {/* 4. Rich Performance & Course Summary Section */}
          <BroadsheetSummaryPanel summary={filteredBroadsheet?.context?.summary} />

          {/* 5. Master Broadsheet Grid */}
          <BroadsheetGrid
            broadsheet={filteredBroadsheet}
            displayedStudents={displayedStudents}
          />
        </div>
      )}

      {/* 6. Standard A3 Landscape Print Document Component */}
      <BroadsheetPrintDocument
        broadsheet={filteredBroadsheet}
      />

      {/* 7. Reconciliation Dialog */}
      <ReconciliationModal
        open={reconciliationOpen}
        onOpenChange={setReconciliationOpen}
        sessionId={formData.session_id}
        semesterId={formData.semester_id}
        programmeId={formData.programme_id}
      />

      {/* 8. Snapshots & Governance Drawer */}
      <BroadsheetSnapshotsDrawer
        open={snapshotsOpen}
        onOpenChange={setSnapshotsOpen}
        sessionId={formData.session_id}
        semesterId={formData.semester_id}
        programmeId={formData.programme_id}
        level={formData.level}
        basis={formData.basis}
        cohort={formData.cohort}
        entryMode={formData.entry_mode}
        onSnapshotUpdated={() => generateBroadsheet(false)}
      />
    </div>
  );
}
