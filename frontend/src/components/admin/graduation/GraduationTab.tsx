import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Printer,
  Download,
  Settings2,
  Search,
  Eye,
  RefreshCw,
  Award,
  Filter,
  FileSpreadsheet,
} from "lucide-react";
import {
  GraduatingStudent,
  IneligibleStudent,
  GraduationConfig,
  GraduationAuditResponse,
} from "./types";
import { GraduationConfigModal } from "./GraduationConfigModal";
import { StudentAuditModal } from "./StudentAuditModal";
import { GraduationPrintDocument } from "./GraduationPrintDocument";
import { toast } from "sonner";
import api from "@/lib/api";

export function GraduationTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  const [formData, setFormData] = useState({
    session_id: "",
    programme_id: "",
    cohort: "all",
    entry_mode: "all",
    framework: "CCMAS" as "CCMAS" | "BMAS",
    search: "",
  });

  const [auditData, setAuditData] = useState<GraduationAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals & Print View States
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [auditModalStudentId, setAuditModalStudentId] = useState<string | null>(null);
  const [auditModalStudent, setAuditModalStudent] = useState<any | null>(null);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    loadDropdowns();
  }, []);

  const loadDropdowns = async () => {
    setLoadingDropdowns(true);
    try {
      const [sessRes, progRes] = await Promise.all([
        api.get("/api/admin/get-sessions") as any,
        api.get("/api/admin/get-programmes") as any,
      ]);
      const loadedSessions = sessRes?.data || [];
      const loadedProgrammes = progRes?.data || [];
      setSessions(loadedSessions);
      setProgrammes(loadedProgrammes);

      // Default to active session if available
      const activeSess = loadedSessions.find((s: any) => s.is_active || s.status === "active") || loadedSessions[0];
      if (activeSess) {
        setFormData((prev) => ({
          ...prev,
          session_id: activeSess.id,
        }));
      }
      if (loadedProgrammes.length > 0) {
        setFormData((prev) => ({
          ...prev,
          programme_id: loadedProgrammes[0].id,
        }));
      }
    } catch (err) {
      toast.error("Failed to load sessions and programmes");
    } finally {
      setLoadingDropdowns(false);
    }
  };

  const runGraduationAudit = async (customParams?: Partial<typeof formData>) => {
    const currentForm = { ...formData, ...(customParams || {}) };
    if (!currentForm.programme_id) {
      toast.error("Please select a Degree Programme to audit");
      return;
    }

    setLoading(true);
    try {
      const queryParams = `session_id=${encodeURIComponent(currentForm.session_id)}&programme_id=${encodeURIComponent(currentForm.programme_id)}&framework=${encodeURIComponent(currentForm.framework)}${
        currentForm.entry_mode && currentForm.entry_mode !== "all"
          ? `&entry_mode=${encodeURIComponent(currentForm.entry_mode)}`
          : ""
      }${
        currentForm.cohort && currentForm.cohort !== "all"
          ? `&cohort=${encodeURIComponent(currentForm.cohort)}`
          : ""
      }${
        currentForm.search.trim()
          ? `&search=${encodeURIComponent(currentForm.search.trim())}`
          : ""
      }`;

      let res: any;
      try {
        // Direct controller route first (avoids 404 when routes.php is pending upload)
        res = await api.get(`/admin_graduation/get_list?${queryParams}`);
      } catch (firstErr: any) {
        if (firstErr?.status === 404 || firstErr?.message?.includes("404")) {
          res = await api.get(`/api/admin/graduation/list?${queryParams}`);
        } else {
          throw firstErr;
        }
      }

      // Handle both { data: { graduating_students } } and raw payload
      const auditPayload =
        res?.data?.graduating_students ? res.data :
        res?.graduating_students ? res :
        res?.data;

      if (auditPayload && Array.isArray(auditPayload.graduating_students)) {
        setAuditData(auditPayload);
        const cleared = auditPayload.graduating_students.length;
        const total = auditPayload.summary_stats?.total_audited ?? (cleared + (auditPayload.ineligible_students?.length || 0));
        toast.success(`Audit completed: ${cleared} of ${total} students cleared for graduation`);
      } else {
        toast.error("No student graduation records returned for this selection");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to perform graduation clearance audit");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (type: "cleared" | "ineligible") => {
    if (!formData.programme_id) {
      toast.error("Please select a Degree Programme first");
      return;
    }
    const url = `/admin_graduation/export_csv?session_id=${encodeURIComponent(formData.session_id)}&programme_id=${encodeURIComponent(formData.programme_id)}&framework=${encodeURIComponent(formData.framework)}&type=${type}`;
    window.open(url, "_blank");
  };

  const handleFrameworkToggle = (fw: "CCMAS" | "BMAS") => {
    setFormData((prev) => ({ ...prev, framework: fw }));
    runGraduationAudit({ framework: fw });
  };

  const selectedProgramme = programmes.find((p) => p.id === formData.programme_id);
  const selectedSession = sessions.find((s) => s.id === formData.session_id);

  if (printMode && auditData) {
    return (
      <GraduationPrintDocument
        students={auditData.graduating_students}
        config={auditData.config}
        sessionName={selectedSession?.name || auditData.metadata?.session_name || "2024/2025"}
        programmeName={selectedProgramme?.name || auditData.metadata?.programme_name || "Degree Programme"}
        onBack={() => setPrintMode(false)}
      />
    );
  }

  const graduatingStudents = auditData?.graduating_students || [];
  const ineligibleStudents = auditData?.ineligible_students || [];
  const summary = auditData?.summary_stats;

  return (
    <div className="space-y-6">
      {/* Console Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-serif font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
            Graduation & Senate Clearance Console
          </h2>
          <p className="text-sm text-muted-foreground">
            Strict academic history clearance, NUC CCMAS/BMAS degree classification, and official graduating list.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Framework Quick Switcher */}
          <div className="flex items-center rounded-lg border bg-card p-1 text-xs">
            <button
              type="button"
              onClick={() => handleFrameworkToggle("CCMAS")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                formData.framework === "CCMAS"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              CCMAS (1.50)
            </button>
            <button
              type="button"
              onClick={() => handleFrameworkToggle("BMAS")}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                formData.framework === "BMAS"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              BMAS (1.00)
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigModalOpen(true)}
            className="gap-1.5"
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <span>Configure Policy</span>
          </Button>

          {auditData && graduatingStudents.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintMode(true)}
                className="gap-1.5 border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              >
                <Printer className="h-4 w-4" />
                <span>Print Official List</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCSV("cleared")}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                <span>Export Excel</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter Envelope */}
      <Card>
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Academic Session */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Academic Session *</Label>
              <Select
                value={formData.session_id}
                onValueChange={(val) => setFormData((p) => ({ ...p, session_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Programme */}
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">Degree Programme *</Label>
              <Select
                value={formData.programme_id}
                onValueChange={(val) => setFormData((p) => ({ ...p, programme_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Programme" />
                </SelectTrigger>
                <SelectContent>
                  {programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.code ? `(${p.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entry Mode */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Entry Mode</Label>
              <Select
                value={formData.entry_mode}
                onValueChange={(val) => setFormData((p) => ({ ...p, entry_mode: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Entry Modes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes (UTME & DE)</SelectItem>
                  <SelectItem value="UTME">UTME (4-Year / 100L)</SelectItem>
                  <SelectItem value="DE">Direct Entry (DE / 200L)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2 border-t">
            <div className="relative w-full md:w-80">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search by student name or matric..."
                value={formData.search}
                onChange={(e) => setFormData((p) => ({ ...p, search: e.target.value }))}
                className="pl-9 text-sm"
              />
            </div>

            <Button
              onClick={() => runGraduationAudit()}
              disabled={loading || !formData.programme_id}
              className="w-full md:w-auto bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-medium"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{loading ? "Auditing History..." : "Audit Graduation Clearance"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card">
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground font-medium block">
                Total Evaluated
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold">{summary.total_audited}</span>
                <Badge variant="outline" className="text-xs">
                  {formData.framework} Standard
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium block flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Cleared for Graduation
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                  {summary.cleared_count}
                </span>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {summary.cleared_percent}% of cohort
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-4">
              <span className="text-xs text-destructive font-medium block flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5" />
                Ineligible / Deficient
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-destructive">
                  {summary.ineligible_count}
                </span>
                <span className="text-xs font-semibold text-destructive/80">
                  {summary.ineligible_percent}% blocked
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="p-4">
              <span className="text-xs text-muted-foreground font-medium block flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-blue-600" />
                Degree Honors Overview
              </span>
              <div className="flex flex-wrap gap-1 mt-2 text-[11px]">
                <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                  1st: {summary.class_breakdown["First Class Honours"] || 0}
                </span>
                <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-medium">
                  2:1: {summary.class_breakdown["Second Class Honours (Upper Division)"] || 0}
                </span>
                <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                  2:2: {summary.class_breakdown["Second Class Honours (Lower Division)"] || 0}
                </span>
                <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-medium">
                  3rd: {summary.class_breakdown["Third Class Honours"] || 0}
                </span>
                {formData.framework === "BMAS" && (
                  <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-medium">
                    Pass: {summary.class_breakdown["Pass Degree"] || 0}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs: Cleared List vs Deficiency Audit */}
      <Tabs defaultValue="cleared" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2">
          <TabsList>
            <TabsTrigger value="cleared" className="gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Graduating Students ({graduatingStudents.length})</span>
            </TabsTrigger>
            <TabsTrigger value="ineligible" className="gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Deficiency Audit ({ineligibleStudents.length})</span>
            </TabsTrigger>
          </TabsList>

          <span className="text-xs text-muted-foreground">
            {graduatingStudents.length > 0 &&
              `Showing strictly cleared candidates matching Federal University Dutsin-Ma PDF standards`}
          </span>
        </div>

        {/* TAB 1: Cleared Graduating Students List */}
        <TabsContent value="cleared" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-serif">
                    Official Graduating Students List
                  </CardTitle>
                  <CardDescription className="text-xs">
                    All listed candidates meet 100% of the graduation requirements (Zero outstanding carryovers, zero pending scores, minimum TCE & CGPA).
                  </CardDescription>
                </div>
                {graduatingStudents.length > 0 && (
                  <Badge variant="outline" className="border-emerald-600 text-emerald-700 bg-emerald-50">
                    Senate Approved Format
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              {graduatingStudents.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-3">
                  <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground/40" />
                  <div className="max-w-md mx-auto">
                    <p className="font-semibold text-foreground text-sm">
                      {auditData
                        ? "No students have cleared all graduation requirements in this selection"
                        : "No graduation list generated yet"}
                    </p>
                    <p className="text-xs mt-1">
                      {auditData
                        ? "Check the 'Deficiency Audit' tab to see candidates who missed criteria and why."
                        : "Select a Degree Programme and Academic Session above and click 'Audit Graduation Clearance'."}
                    </p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground border-b uppercase text-[11px] font-semibold text-center">
                      <th className="py-2.5 px-2 w-10">S/N</th>
                      <th className="py-2.5 px-3 text-left">MATRIC NO.</th>
                      <th className="py-2.5 px-3 text-left min-w-[160px]">NAMES</th>
                      <th className="py-2.5 px-2">GENDER</th>
                      <th className="py-2.5 px-2">JAMB REG. NO</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">DATE OF BIRTH</th>
                      <th className="py-2.5 px-2">ORIGIN</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">CURRENT LEVEL</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">ENTERY LEVEL</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">ENTERY MODE</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">YEAR ADMITTED</th>
                      <th className="py-2.5 px-2 font-bold">TCE</th>
                      <th className="py-2.5 px-2 font-bold">CGPA</th>
                      <th className="py-2.5 px-3 text-left min-w-[150px]">CLASS</th>
                      <th className="py-2.5 px-2">REMARK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {graduatingStudents.map((st, idx) => (
                      <tr key={st.student_id || idx} className="hover:bg-muted/40 transition-colors text-center">
                        <td className="py-2 px-2 font-mono text-muted-foreground">
                          {st.sn || idx + 1}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-medium whitespace-nowrap">
                          {st.matric_number}
                        </td>
                        <td className="py-2 px-3 text-left uppercase font-medium">
                          {st.names}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              st.gender === "Female"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                            }`}
                          >
                            {st.gender}
                          </span>
                        </td>
                        <td className="py-2 px-2 font-mono whitespace-nowrap text-muted-foreground">
                          {st.jamb_reg_no || "—"}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">
                          {st.dob || "—"}
                        </td>
                        <td className="py-2 px-2">{st.origin || "—"}</td>
                        <td className="py-2 px-2 font-mono">{st.current_level}</td>
                        <td className="py-2 px-2 font-mono">{st.entry_level}</td>
                        <td className="py-2 px-2">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {st.entry_mode}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 font-mono">{st.year_admitted}</td>
                        <td className="py-2 px-2 font-bold font-mono text-emerald-700 dark:text-emerald-400">
                          {st.tce}
                        </td>
                        <td className="py-2 px-2 font-bold font-mono text-blue-700 dark:text-blue-400">
                          {st.cgpa}
                        </td>
                        <td className="py-2 px-3 text-left font-medium whitespace-nowrap">
                          {st.class}
                        </td>
                        <td className="py-2 px-2">
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                            {st.remark || "Pass"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Deficiency Audit (Ineligible Candidates) */}
        <TabsContent value="ineligible" className="space-y-4">
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-destructive font-serif flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Ineligible Candidates & Academic Deficiency Audit
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Candidates who missed one or more graduation requirements. They are excluded from the official Senate list until each deficiency is rectified.
                  </CardDescription>
                </div>
                {ineligibleStudents.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCSV("ineligible")}
                    className="gap-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Deficiencies</span>
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              {ineligibleStudents.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground space-y-2">
                  <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600/60" />
                  <p className="font-semibold text-foreground text-sm">
                    No ineligible candidates in this selection
                  </p>
                  <p className="text-xs">
                    All audited students have met graduation requirements or no candidates were found.
                  </p>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground border-b uppercase text-[11px] font-semibold text-center">
                      <th className="py-2.5 px-2 w-10">S/N</th>
                      <th className="py-2.5 px-3 text-left">MATRIC NO.</th>
                      <th className="py-2.5 px-3 text-left">STUDENT NAME</th>
                      <th className="py-2.5 px-2">MODE</th>
                      <th className="py-2.5 px-2">TCE</th>
                      <th className="py-2.5 px-2">CGPA</th>
                      <th className="py-2.5 px-3 text-left min-w-[280px]">DEFICIENCY REASON(S)</th>
                      <th className="py-2.5 px-2 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ineligibleStudents.map((st, idx) => (
                      <tr key={st.student_id || idx} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                          {st.sn || idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium whitespace-nowrap">
                          {st.matric_number}
                        </td>
                        <td className="py-2 px-3 uppercase font-medium">
                          {st.names}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant="outline" className="text-[10px]">
                            {st.entry_mode}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-medium">
                          {st.tce}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-medium">
                          {st.cgpa}
                        </td>
                        <td className="py-2 px-3">
                          <div className="space-y-1">
                            {st.deficiencies?.map((def, dIdx) => (
                              <div
                                key={dIdx}
                                className={`text-[11px] p-1.5 rounded border flex items-center gap-1.5 ${
                                  def.category === "outstanding"
                                    ? "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-300"
                                    : def.category === "pending"
                                    ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300"
                                    : "bg-muted border-muted-foreground/20 text-foreground"
                                }`}
                              >
                                {def.category === "outstanding" ? (
                                  <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                )}
                                <span>{def.message}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAuditModalStudentId(st.student_id);
                              setAuditModalStudent(st);
                            }}
                            className="h-7 text-xs gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Audit</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Configuration Modal */}
      <GraduationConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        config={auditData?.config || null}
        sessionId={formData.session_id}
        programmeId={formData.programme_id}
        onSaved={(newConfig) => {
          setFormData((p) => ({ ...p, framework: newConfig.framework }));
          runGraduationAudit({ framework: newConfig.framework });
        }}
      />

      {/* Student Audit Modal */}
      <StudentAuditModal
        open={!!auditModalStudentId}
        onOpenChange={(open) => {
          if (!open) {
            setAuditModalStudentId(null);
            setAuditModalStudent(null);
          }
        }}
        studentId={auditModalStudentId}
        sessionId={formData.session_id}
        ineligibleStudent={auditModalStudent}
      />
    </div>
  );
}

