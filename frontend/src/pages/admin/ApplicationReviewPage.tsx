import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Upload,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  MoreHorizontal,
  Mail,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  api,
  bulkAdmitApplicationsCsv,
  exportAdminApplicationsCsv,
  getAdminApplications,
  updateApplicationStatus,
} from "@/lib/api";

interface OLevelGradeRow {
  subject: string;
  grade: string;
  sitting?: string | null;
}

interface DocumentFile {
  type?: string | null;
  fileName?: string | null;
  file_name?: string | null;
  storagePath?: string | null;
  storage_path?: string | null;
}

interface Application {
  id: string;
  applicationNo?: string | null;
  applicantName: string;
  email: string;
  phone: string;
  program: string;
  entryMode: string;
  jambScore: number;
  oLevelGrades: string;
  oLevelGradeRows: OLevelGradeRow[];
  dateApplied: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "waitlisted";
  documents: string[];
  documentFiles: DocumentFile[];
  notes: string;
  rawStatus?: string | null;
}

type Department = { id: string; name: string; code?: string | null };
type Programme = {
  id: string;
  name?: string | null;
  code?: string | null;
  department_id?: string | null;
  programme_structure?: string | null;
  is_active?: number | boolean | null;
};

type SelectOption = { value: string; label: string };
type ProgrammeOption = SelectOption & {
  departmentId?: string | null;
  programmeStructure?: "semester" | "contact";
};

const findOptionLabel = (
  list: { value: string; label: string }[],
  value: string,
) => list.find((item) => item.value === value)?.label ?? value;

const emptyCounts: Record<Application["status"], number> = {
  pending: 0,
  under_review: 0,
  approved: 0,
  rejected: 0,
  waitlisted: 0,
};

export default function ApplicationReviewPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<
    DocumentFile | string | null
  >(null);
  const [isAdmitDialogOpen, setIsAdmitDialogOpen] = useState(false);
  const [isCsvUploadDialogOpen, setIsCsvUploadDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [counts, setCounts] = useState({ ...emptyCounts });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [admissionTargets, setAdmissionTargets] = useState<string[]>([]);
  const [admissionSubmitting, setAdmissionSubmitting] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [admissionForm, setAdmissionForm] = useState({
    department: "",
    programme: "",
    session: "",
    programType: "",
    admissionCondition: "",
    entryLevel: "",
    modeOfEntry: "",
  });
  const [activeSession, setActiveSession] = useState<string>("");

  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>(
    [],
  );
  const [programmeOptions, setProgrammeOptions] = useState<ProgrammeOption[]>(
    [],
  );

  const semesterLevelOptions = [
    { value: "100", label: "100 Level" },
    { value: "200", label: "200 Level" },
  ];

  const contactLevelOptions = [
    { value: "contact-one", label: "Contact One" },
    { value: "contact-two", label: "Contact Two" },
  ];

  const programTypeOptions = [
    { value: "semester", label: "Semester Based" },
    { value: "contact", label: "Contact Based" },
  ];

  const normalizeProgrammeStructure = (
    value?: string | null,
  ): "semester" | "contact" =>
    value === "contact" || value === "contact_based" ? "contact" : "semester";

  const admissionConditionOptions = [
    { value: "direct", label: "Direct Admission" },
    { value: "undertaking", label: "Admission with Undertaking" },
  ];

  const modeOptions = [
    { value: "fresh", label: "Fresh" },
    { value: "direct-entry", label: "Direct Entry" },
  ];

  const deriveLevelOptions = () => {
    if (admissionForm.programType === "contact") {
      return contactLevelOptions;
    }
    if (admissionForm.programType === "semester") {
      return semesterLevelOptions;
    }
    return [];
  };

  const normalizeStatus = (value: unknown): Application["status"] => {
    const normalized = typeof value === "string" ? value.toLowerCase() : "";
    switch (normalized) {
      case "approved":
      case "admitted":
        return "approved";
      case "rejected":
        return "rejected";
      case "under_review":
      case "processing":
      case "review":
        return "under_review";
      case "waitlisted":
      case "waitlist":
        return "waitlisted";
      case "submitted":
      case "pending":
      default:
        return "pending";
    }
  };

  const mapApiApplication = (app: any): Application => {
    const status = normalizeStatus(app?.status);
    const idValue =
      app?.id ??
      app?.application_no ??
      app?.applicationNo ??
      `APP-${Date.now()}`;

    const parseScore = (value: unknown) => {
      if (typeof value === "number") return value;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return {
      id: String(idValue),
      applicationNo: app?.application_no ?? app?.applicationNo ?? null,
      applicantName:
        app?.applicant_name ?? app?.applicantName ?? "Unknown Applicant",
      email: app?.email ?? app?.applicant_email ?? "",
      phone: app?.phone ?? app?.applicant_phone ?? "",
      program: app?.program ?? app?.programme ?? app?.programme_name ?? "N/A",
      entryMode: app?.entry_mode ?? app?.application_mode_of_entry ?? "N/A",
      jambScore: parseScore(app?.jamb_score),
      oLevelGrades: app?.o_level_grades ?? app?.oLevelGrades ?? "N/A",
      oLevelGradeRows: Array.isArray(app?.o_level_grade_rows)
        ? app.o_level_grade_rows
        : Array.isArray(app?.oLevelGradeRows)
          ? app.oLevelGradeRows
          : [],
      dateApplied:
        app?.date_applied ?? app?.applied_at ?? new Date().toISOString(),
      status,
      documents: Array.isArray(app?.documents) ? app.documents : [],
      documentFiles: Array.isArray(app?.document_files)
        ? app.document_files
        : Array.isArray(app?.documentFiles)
          ? app.documentFiles
          : [],
      notes: app?.notes ?? app?.review_notes ?? "",
      rawStatus: app?.raw_status ?? null,
    };
  };

  const fetchApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = (await getAdminApplications()) as {
        data?: unknown;
        meta?: { counts?: Partial<typeof counts> };
      };

      const rawList = Array.isArray(response?.data)
        ? response.data
        : Array.isArray((response as any)?.applications)
          ? (response as any).applications
          : Array.isArray((response as any)?.data?.applications)
            ? (response as any).data.applications
            : [];

      const mapped: Application[] = rawList.map((item: any) =>
        mapApiApplication(item),
      );
      setApplications(mapped);

      const apiCounts = response?.meta?.counts;
      if (apiCounts) {
        setCounts((prev) => ({ ...prev, ...apiCounts }));
      } else {
        const computed = mapped.reduce<Record<Application["status"], number>>(
          (acc, app) => {
            acc[app.status] += 1;
            return acc;
          },
          { ...emptyCounts },
        );
        setCounts(computed);
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to load applications";
      setError(message);
      toast.error("Failed to load applications", { description: message });
    } finally {
      setLoading(false);
    }
  };

  const extractData = <T,>(payload: unknown): T => {
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data?: T }).data as T;
    }
    return payload as T;
  };

  const fetchAdmissionOptions = async () => {
    try {
      setOptionsLoading(true);
      const [departmentsRes, programmesRes, sessionsRes] = await Promise.all([
        api.get("/api/admin/get-departments"),
        api.get("/api/admin/get-programmes"),
        api.get("/api/admin/get-sessions"),
      ]);

      const departments = extractData<Department[]>(departmentsRes) || [];
      const programmes = extractData<Programme[]>(programmesRes) || [];
      const sessions =
        extractData<{ id?: string; name?: string; is_active?: boolean }[]>(
          sessionsRes,
        ) || [];

      const sessionMeta =
        sessionsRes && typeof sessionsRes === "object" && "meta" in sessionsRes
          ? (sessionsRes as { meta?: { active_session?: { name?: string } } })
              .meta?.active_session
          : null;
      const active =
        (sessionMeta && sessionMeta.name) ||
        sessions.find((session) => session.is_active)?.name ||
        "";
      if (active) {
        setActiveSession(active);
        setAdmissionForm((prev) => ({ ...prev, session: active }));
      }

      const activeProgrammes = programmes.filter((prog) => {
        if (prog.is_active === undefined || prog.is_active === null)
          return true;
        if (typeof prog.is_active === "boolean") return prog.is_active;
        return Number(prog.is_active) !== 0;
      });

      setDepartmentOptions(
        departments.map((dept) => ({
          value: String(dept.id),
          label: dept.name || dept.code || "Unnamed Department",
        })),
      );

      setProgrammeOptions(
        activeProgrammes.map((prog) => ({
          value: String(prog.id),
          label: prog.name || prog.code || "Unnamed Programme",
          departmentId: prog.department_id ?? null,
          programmeStructure: normalizeProgrammeStructure(
            prog.programme_structure,
          ),
        })),
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to load admission options";
      toast.error("Failed to load admission options", { description: message });
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    fetchAdmissionOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetCsvUploadState = () => {
    setCsvFileName("");
    setCsvContent("");
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = "";
    }
  };

  const handleExportApplicationsCsv = async () => {
    try {
      const response = (await exportAdminApplicationsCsv()) as {
        data?: { csv?: string; file_name?: string };
      };

      const csv = response?.data?.csv;
      if (!csv) {
        toast.error("CSV export failed", {
          description: "No CSV data returned from server.",
        });
        return;
      }

      const fileName =
        response?.data?.file_name ||
        `applications-review-${new Date().toISOString().slice(0, 10)}.csv`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Applications CSV exported");
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to export CSV";
      toast.error("CSV export failed", { description: message });
    }
  };

  const handleCsvFileSelected = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please choose a CSV file");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      setCsvFileName(file.name);
      setCsvContent(text);
      toast.success("CSV file loaded", {
        description: `${file.name} is ready for upload.`,
      });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to read CSV file";
      toast.error("CSV file read failed", { description: message });
    }

    event.target.value = "";
  };

  const handleUploadReviewedCsv = async () => {
    if (!csvContent.trim()) {
      toast.error("Please choose a CSV file first");
      return;
    }

    if (
      !admissionForm.programme ||
      !admissionForm.session ||
      !admissionForm.programType ||
      !admissionForm.admissionCondition ||
      !admissionForm.entryLevel ||
      !admissionForm.modeOfEntry
    ) {
      toast.error("Please complete admission details");
      return;
    }

    try {
      setCsvUploading(true);

      const response = (await bulkAdmitApplicationsCsv({
        csv: csvContent,
        programme_id: admissionForm.programme,
        program_type: admissionForm.programType,
        admission_condition: admissionForm.admissionCondition,
        session: admissionForm.session,
        entry_level: admissionForm.entryLevel,
        mode_of_entry: admissionForm.modeOfEntry,
      })) as {
        data?: {
          admitted?: number;
          skipped?: number;
          failed?: number;
          errors?: Array<{ row?: number; message?: string }>;
        };
      };

      const admitted = Number(response?.data?.admitted || 0);
      const skipped = Number(response?.data?.skipped || 0);
      const failed = Number(response?.data?.failed || 0);

      toast.success("Bulk CSV processed", {
        description: `Admitted: ${admitted}, Skipped: ${skipped}, Failed: ${failed}`,
      });

      if (failed > 0 && Array.isArray(response?.data?.errors)) {
        const firstError = response.data.errors[0];
        if (firstError?.message) {
          toast.error("Some rows failed", {
            description: `Row ${firstError.row ?? "?"}: ${firstError.message}`,
          });
        }
      }

      setIsCsvUploadDialogOpen(false);
      resetCsvUploadState();
      resetAdmissionForm();
      setSelectedIds(new Set());
      await fetchApplications();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to process uploaded CSV";
      toast.error("Bulk CSV upload failed", { description: message });
    } finally {
      setCsvUploading(false);
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.program.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isAlreadyAdmitted = (app: Application) => app.status === "approved";
  const selectableApplications = filteredApplications.filter(
    (app) => !isAlreadyAdmitted(app),
  );

  const allVisibleSelected =
    selectableApplications.length > 0 &&
    selectableApplications.every((app) => selectedIds.has(app.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        selectableApplications.forEach((app) => next.delete(app.id));
      } else {
        selectableApplications.forEach((app) => next.add(app.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    const app = applications.find((item) => item.id === id);
    if (!app || isAlreadyAdmitted(app)) {
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedCount = selectedIds.size;
  const selectedEligibleCount = Array.from(selectedIds).filter((id) => {
    const app = applications.find((item) => item.id === id);
    return Boolean(app && !isAlreadyAdmitted(app));
  }).length;

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        const app = applications.find((item) => item.id === id);
        if (app && !isAlreadyAdmitted(app)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [applications]);

  const filteredProgrammeOptions = admissionForm.department
    ? programmeOptions.filter(
        (opt) =>
          !opt.departmentId || opt.departmentId === admissionForm.department,
      )
    : programmeOptions;

  const admissionProgramTypeLabel = admissionForm.programType
    ? findOptionLabel(programTypeOptions, admissionForm.programType)
    : "Select programme";

  const applyProgrammeToAdmissionForm = (
    value: string,
    prev: typeof admissionForm,
  ) => {
    const selectedProgramme = programmeOptions.find(
      (option) => option.value === value,
    );
    return {
      ...prev,
      programme: value,
      programType: selectedProgramme?.programmeStructure || "",
      entryLevel:
        prev.programType === selectedProgramme?.programmeStructure
          ? prev.entryLevel
          : "",
    };
  };

  const handleViewApplication = (app: Application) => {
    setSelectedApplication(app);
    setReviewNotes(app.notes);
    setIsViewDialogOpen(true);
  };

  const getDocumentUrl = (source?: string | null) => {
    if (!source) {
      return null;
    }

    if (/^https?:\/\//i.test(source)) {
      return source;
    }

    if (source.startsWith("/")) {
      return `${window.location.origin}${source}`;
    }

    const normalized = source.replace(/^\.\/?/, "");
    return `${window.location.origin}/${normalized}`;
  };

  const getDocumentLabel = (doc: DocumentFile | string) => {
    if (typeof doc === "string") {
      return doc;
    }
    return doc.fileName || doc.type || "Document";
  };

  const handleReviewDocument = (doc: DocumentFile | string) => {
    setSelectedDocument(doc);
    setIsDocumentDialogOpen(true);
  };

  const handleOpenDocumentInNewTab = (doc: DocumentFile | string) => {
    if (typeof doc === "string") {
      const url = getDocumentUrl(doc);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    const url = getDocumentUrl(doc.storagePath ?? doc.fileName ?? null);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: Application["status"],
  ) => {
    const target = applications.find((item) => item.id === id);

    if (!target) {
      toast.error("Application not found", {
        description: "Please refresh and try again.",
      });
      return;
    }

    try {
      setIsUpdatingStatus(true);

      await updateApplicationStatus({
        id: target.id,
        application_no: target.applicationNo ?? target.id,
        status: newStatus,
        notes: reviewNotes,
      });

      setApplications((prev) => {
        const next = prev.map((app) =>
          app.id === id
            ? { ...app, status: newStatus, notes: reviewNotes }
            : app,
        );

        const nextCounts = next.reduce<Record<Application["status"], number>>(
          (acc, app) => {
            acc[app.status] += 1;
            return acc;
          },
          { ...emptyCounts },
        );
        setCounts(nextCounts);

        return next;
      });

      setIsViewDialogOpen(false);
      toast.success(
        `Application ${
          newStatus === "approved"
            ? "approved"
            : newStatus === "rejected"
              ? "rejected"
              : "updated"
        } successfully`,
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to update status";
      toast.error("Status update failed", { description: message });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "emerald" | "destructive" | "warning" | "secondary"
    > = {
      pending: "warning",
      under_review: "default",
      approved: "emerald",
      rejected: "destructive",
      waitlisted: "secondary",
    };
    return variants[status] || "default";
  };

  const getStatusLabel = (status: string) => {
    return status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const pendingCount = applications.filter(
    (a) => a.status === "pending",
  ).length;
  const reviewCount = applications.filter(
    (a) => a.status === "under_review",
  ).length;
  const approvedCount = applications.filter(
    (a) => a.status === "approved",
  ).length;
  const rejectedCount = applications.filter(
    (a) => a.status === "rejected",
  ).length;

  const stats = [
    {
      title: "Total Applications",
      value: `${applications.length}`,
      change: "",
      icon: FileText,
    },
    {
      title: "Pending Review",
      value: `${pendingCount}`,
      change: "",
      icon: Clock,
    },
    {
      title: "Approved",
      value: `${approvedCount}`,
      change: "",
      icon: CheckCircle,
    },
    {
      title: "Rejected",
      value: `${rejectedCount}`,
      change: "",
      icon: AlertCircle,
    },
  ];

  const admitCount = admissionTargets.length || selectedEligibleCount;

  const resetAdmissionForm = () => {
    setAdmissionForm({
      department: "",
      programme: "",
      session: activeSession || "",
      programType: "",
      admissionCondition: "",
      entryLevel: "",
      modeOfEntry: "",
    });
  };

  const openAdmitDialog = (ids: string[]) => {
    const targets = ids.filter((id) => {
      if (!id) return false;
      const app = applications.find((item) => item.id === id);
      return Boolean(app && !isAlreadyAdmitted(app));
    });

    if (!targets.length) {
      toast.error("No eligible applications selected", {
        description: "Approved applicants cannot be admitted again.",
      });
      return;
    }

    if (targets.length !== ids.filter(Boolean).length) {
      toast.info("Approved applicants were skipped");
    }

    setAdmissionTargets(targets);
    setIsAdmitDialogOpen(true);
  };

  const handleAdmitSubmit = async () => {
    if (
      !admissionForm.department ||
      !admissionForm.programme ||
      !admissionForm.session ||
      !admissionForm.programType ||
      !admissionForm.admissionCondition ||
      !admissionForm.entryLevel ||
      !admissionForm.modeOfEntry
    ) {
      toast.error("Please complete all admission fields");
      return;
    }

    const targetIds = admissionTargets.length
      ? admissionTargets
      : Array.from(selectedIds);

    const eligibleTargetIds = targetIds.filter((id) => {
      const app = applications.find((item) => item.id === id);
      return Boolean(app && !isAlreadyAdmitted(app));
    });

    if (!eligibleTargetIds.length) {
      toast.error("No eligible applications selected", {
        description: "Approved applicants cannot be admitted again.",
      });
      return;
    }

    const detailNote = `Admitted to ${findOptionLabel(
      programmeOptions,
      admissionForm.programme,
    )} (${findOptionLabel(departmentOptions, admissionForm.department)}) | Program Type ${findOptionLabel(programTypeOptions, admissionForm.programType)} | Admission Condition ${findOptionLabel(admissionConditionOptions, admissionForm.admissionCondition)} | Session ${admissionForm.session} | Level ${admissionForm.entryLevel} | Mode ${findOptionLabel(modeOptions, admissionForm.modeOfEntry)}`;

    try {
      setAdmissionSubmitting(true);

      const payloads = eligibleTargetIds
        .map((id) => {
          const app = applications.find((item) => item.id === id);
          if (!app) return null;
          return {
            id: app.id,
            application_no: app.applicationNo ?? app.id,
            status: "approved",
            notes: detailNote,
            department_id: admissionForm.department || undefined,
            programme_id: admissionForm.programme || undefined,
            program_type: admissionForm.programType || undefined,
            admission_condition: admissionForm.admissionCondition || undefined,
            session: admissionForm.session || undefined,
            entry_level: admissionForm.entryLevel || undefined,
            mode_of_entry: admissionForm.modeOfEntry || undefined,
          };
        })
        .filter(Boolean) as {
        id: string;
        application_no: string;
        status: string;
        notes: string;
      }[];

      if (!payloads.length) {
        toast.error("Unable to find the selected applications");
        return;
      }

      await Promise.all(payloads.map((item) => updateApplicationStatus(item)));

      setApplications((prev) => {
        const next: Application[] = prev.map((app) =>
          eligibleTargetIds.includes(app.id)
            ? {
                ...app,
                status: "approved" as Application["status"],
                notes: detailNote,
              }
            : app,
        );

        const nextCounts = next.reduce<Record<Application["status"], number>>(
          (acc, app) => {
            acc[app.status] += 1;
            return acc;
          },
          { ...emptyCounts },
        );
        setCounts(nextCounts);

        return next;
      });

      setSelectedIds(new Set());
      setAdmissionTargets([]);
      setIsAdmitDialogOpen(false);
      resetAdmissionForm();
      toast.success(
        eligibleTargetIds.length > 1
          ? `${eligibleTargetIds.length} applicants admitted`
          : "Applicant admitted",
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to admit applications";
      toast.error("Admission failed", { description: message });
    } finally {
      setAdmissionSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">
              Application Review
            </h1>
            <p className="text-muted-foreground">
              Review and process student admission applications
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchApplications}
            disabled={loading}
          >
            <Download className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-sm text-emerald-600">{stat.change}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <stat.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Applications Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({applications.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
            <TabsTrigger value="review">
              Under Review ({reviewCount})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({approvedCount})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({rejectedCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle>All Applications</CardTitle>
                    <CardDescription>
                      Review and manage admission applications
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      onClick={() => openAdmitDialog(Array.from(selectedIds))}
                      disabled={!selectedEligibleCount || loading}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Admit Selected
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleExportApplicationsCsv()}
                      disabled={loading}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCsvUploadDialogOpen(true);
                        resetCsvUploadState();
                      }}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Reviewed CSV
                    </Button>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search applications..."
                        className="pl-9 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="under_review">
                          Under Review
                        </SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="waitlisted">Waitlisted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            aria-label="Select all applications"
                            checked={allVisibleSelected}
                            disabled={!selectableApplications.length}
                            onCheckedChange={() => toggleSelectAll()}
                          />
                        </TableHead>
                        <TableHead>Application ID</TableHead>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Program</TableHead>
                        <TableHead>Entry Mode</TableHead>
                        <TableHead>JAMB Score</TableHead>
                        <TableHead>Date Applied</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center text-muted-foreground"
                          >
                            Loading applications...
                          </TableCell>
                        </TableRow>
                      )}
                      {!loading && filteredApplications.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center text-muted-foreground"
                          >
                            No applications found.
                          </TableCell>
                        </TableRow>
                      )}
                      {!loading &&
                        filteredApplications.map((app) => (
                          <TableRow key={app.id}>
                            <TableCell>
                              <Checkbox
                                aria-label={`Select application ${app.id}`}
                                checked={selectedIds.has(app.id)}
                                disabled={isAlreadyAdmitted(app)}
                                onCheckedChange={() => toggleSelectOne(app.id)}
                              />
                            </TableCell>
                            <TableCell className="font-mono font-medium">
                              {app.applicationNo ?? app.id}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {app.applicantName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {app.email}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{app.program}</TableCell>
                            <TableCell>{app.entryMode}</TableCell>
                            <TableCell>
                              {app.jambScore > 0 ? (
                                <span
                                  className={
                                    app.jambScore >= 200
                                      ? "text-emerald-600 font-medium"
                                      : "text-destructive"
                                  }
                                >
                                  {app.jambScore}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  N/A
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(app.dateApplied).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadge(app.status)}>
                                {getStatusLabel(app.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon-sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleViewApplication(app)}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Send Email
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {app.status !== "approved" && (
                                    <DropdownMenuItem
                                      onClick={() => openAdmitDialog([app.id])}
                                      disabled={isUpdatingStatus}
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                                      Admit
                                    </DropdownMenuItem>
                                  )}
                                  {app.status !== "rejected" && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleUpdateStatus(app.id, "rejected")
                                      }
                                      className="text-destructive"
                                      disabled={isUpdatingStatus}
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Reject
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add similar TabsContent for other tabs as needed */}
          <TabsContent value="pending">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {pendingCount} applications pending review
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {reviewCount} applications under review
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {approvedCount} applications approved
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rejected">
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  {rejectedCount} applications rejected
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Admit Applications Dialog */}
        <Dialog
          open={isAdmitDialogOpen}
          onOpenChange={(open) => {
            setIsAdmitDialogOpen(open);
            if (!open) {
              setAdmissionTargets([]);
              resetAdmissionForm();
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Admit Applicants</DialogTitle>
              <DialogDescription>
                Assign department, programme, and entry details for admission.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={admissionForm.department}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) => {
                        const currentProgramme = programmeOptions.find(
                          (opt) => opt.value === prev.programme,
                        );
                        const programmeMatchesDept =
                          !currentProgramme?.departmentId ||
                          currentProgramme.departmentId === value;

                        return {
                          ...prev,
                          department: value,
                          programme: programmeMatchesDept ? prev.programme : "",
                          programType: programmeMatchesDept
                            ? prev.programType
                            : "",
                          entryLevel: programmeMatchesDept
                            ? prev.entryLevel
                            : "",
                        };
                      })
                    }
                    disabled={optionsLoading}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Programme</Label>
                  <Select
                    value={admissionForm.programme}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) =>
                        applyProgrammeToAdmissionForm(value, prev),
                      )
                    }
                    disabled={optionsLoading}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select programme" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProgrammeOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Session of Entry</Label>
                  <div className="mt-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                    {activeSession || "Loading active session..."}
                  </div>
                </div>

                <div>
                  <Label>Program Type</Label>
                  <div className="mt-2 rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground">
                    {admissionProgramTypeLabel}
                  </div>
                </div>

                <div>
                  <Label>Admission Condition</Label>
                  <Select
                    value={admissionForm.admissionCondition}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) => ({
                        ...prev,
                        admissionCondition: value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select admission condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {admissionConditionOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Level of Entry</Label>
                  <Select
                    value={admissionForm.entryLevel}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) => ({
                        ...prev,
                        entryLevel: value,
                      }))
                    }
                    disabled={!admissionForm.programType}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {deriveLevelOptions().map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mode of Entry</Label>
                  <Select
                    value={admissionForm.modeOfEntry}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) => ({
                        ...prev,
                        modeOfEntry: value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {modeOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {optionsLoading && (
                <p className="text-sm text-muted-foreground">
                  Loading departments and programmes...
                </p>
              )}

              <p className="text-sm text-muted-foreground">
                {admitCount || 0} applicant{admitCount === 1 ? "" : "s"} will be
                admitted with these details.
              </p>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdmitDialogOpen(false);
                  setAdmissionTargets([]);
                  resetAdmissionForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdmitSubmit}
                disabled={admissionSubmitting}
              >
                {admissionSubmitting ? "Admitting..." : "Confirm Admission"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            void handleCsvFileSelected(event);
          }}
        />

        <Dialog
          open={isCsvUploadDialogOpen}
          onOpenChange={(open) => {
            setIsCsvUploadDialogOpen(open);
            if (!open) {
              resetCsvUploadState();
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Upload Reviewed Admissions CSV</DialogTitle>
              <DialogDescription>
                Export applications CSV, update statuses to admitted/approved,
                then upload here to process admissions in bulk.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="rounded-md border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-medium">Reviewed CSV File</p>
                    <p className="text-xs text-muted-foreground">
                      Required columns: id or application_no, and status.
                    </p>
                    {csvFileName ? (
                      <p className="mt-2 text-sm text-emerald-700">
                        Loaded: {csvFileName}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No file selected.
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => csvFileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Choose CSV
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Department</Label>
                  <Select
                    value={admissionForm.department}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) => {
                        const currentProgramme = programmeOptions.find(
                          (opt) => opt.value === prev.programme,
                        );
                        const programmeMatchesDept =
                          !currentProgramme?.departmentId ||
                          currentProgramme.departmentId === value;

                        return {
                          ...prev,
                          department: value,
                          programme: programmeMatchesDept ? prev.programme : "",
                          programType: programmeMatchesDept
                            ? prev.programType
                            : "",
                          entryLevel: programmeMatchesDept
                            ? prev.entryLevel
                            : "",
                        };
                      })
                    }
                    disabled={optionsLoading}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Programme</Label>
                  <Select
                    value={admissionForm.programme}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) =>
                        applyProgrammeToAdmissionForm(value, prev),
                      )
                    }
                    disabled={optionsLoading}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select programme" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredProgrammeOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Session of Entry</Label>
                  <div className="mt-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                    {activeSession || "Loading active session..."}
                  </div>
                </div>

                <div>
                  <Label>Program Type</Label>
                  <div className="mt-2 rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground">
                    {admissionProgramTypeLabel}
                  </div>
                </div>

                <div>
                  <Label>Admission Condition</Label>
                  <Select
                    value={admissionForm.admissionCondition}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) => ({
                        ...prev,
                        admissionCondition: value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select admission condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {admissionConditionOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Level of Entry</Label>
                  <Select
                    value={admissionForm.entryLevel}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) => ({
                        ...prev,
                        entryLevel: value,
                      }))
                    }
                    disabled={!admissionForm.programType}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {deriveLevelOptions().map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Mode of Entry</Label>
                  <Select
                    value={admissionForm.modeOfEntry}
                    onValueChange={(value) =>
                      setAdmissionForm((prev) => ({
                        ...prev,
                        modeOfEntry: value,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {modeOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCsvUploadDialogOpen(false);
                  resetCsvUploadState();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleUploadReviewedCsv()}
                disabled={csvUploading}
              >
                {csvUploading ? "Processing..." : "Process Admissions"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isViewDialogOpen}
          onOpenChange={(open) => {
            setIsViewDialogOpen(open);
            if (!open) {
              setReviewNotes("");
            }
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Application Details</DialogTitle>
              <DialogDescription>
                Review applicant profile, submitted documents, and make an
                admission decision.
              </DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <div className="grid gap-6 py-2">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">
                      Applicant Name
                    </Label>
                    <p className="font-medium">
                      {selectedApplication.applicantName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium break-words">
                      {selectedApplication.email}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedApplication.phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Program</Label>
                    <p className="font-medium">{selectedApplication.program}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Entry Mode</Label>
                    <p className="font-medium">
                      {selectedApplication.entryMode}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">JAMB Score</Label>
                    <p className="font-medium">
                      {selectedApplication.jambScore > 0
                        ? selectedApplication.jambScore
                        : "N/A"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">
                      O'Level Grades
                    </Label>
                    {selectedApplication.oLevelGradeRows.length > 0 ? (
                      <div className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subject</TableHead>
                              <TableHead>Grade</TableHead>
                              <TableHead>Sitting</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedApplication.oLevelGradeRows.map(
                              (row, index) => (
                                <TableRow key={`${row.subject}-${index}`}>
                                  <TableCell>{row.subject}</TableCell>
                                  <TableCell>{row.grade}</TableCell>
                                  <TableCell>{row.sitting ?? "-"}</TableCell>
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="font-medium">
                        {selectedApplication.oLevelGrades || "N/A"}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Date Applied
                    </Label>
                    <p className="font-medium">
                      {new Date(
                        selectedApplication.dateApplied,
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">
                    Documents Submitted
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedApplication.documentFiles.length > 0
                      ? selectedApplication.documentFiles.map((doc, index) => {
                          const label =
                            doc.fileName ||
                            doc.file_name ||
                            doc.type ||
                            "Document";
                          return (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleReviewDocument(doc)}
                              className="inline-flex items-center rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"
                              title={
                                doc.storagePath ||
                                doc.fileName ||
                                doc.file_name ||
                                doc.type ||
                                "Document"
                              }
                            >
                              {label}
                            </button>
                          );
                        })
                      : selectedApplication.documents.map((doc, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleReviewDocument(doc)}
                            className="inline-flex items-center rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-600"
                          >
                            {doc}
                          </button>
                        ))}
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground">
                    Current Status
                  </Label>
                  <div className="mt-2">
                    <Badge variant={getStatusBadge(selectedApplication.status)}>
                      {getStatusLabel(selectedApplication.status)}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label htmlFor="reviewNotes">Review Notes</Label>
                  <Textarea
                    id="reviewNotes"
                    placeholder="Add notes about this application..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIsViewDialogOpen(false)}
              >
                Close
              </Button>
              {selectedApplication?.status !== "rejected" && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    selectedApplication &&
                    handleUpdateStatus(selectedApplication.id, "rejected")
                  }
                  disabled={isUpdatingStatus}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              )}
              {selectedApplication?.status !== "approved" && (
                <Button
                  onClick={() => {
                    if (!selectedApplication) return;
                    setIsViewDialogOpen(false);
                    openAdmitDialog([selectedApplication.id]);
                  }}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Admit
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isDocumentDialogOpen}
          onOpenChange={(open) => {
            setIsDocumentDialogOpen(open);
            if (!open) {
              setSelectedDocument(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Document Review</DialogTitle>
              <DialogDescription>
                Preview or open submitted application documents.
              </DialogDescription>
            </DialogHeader>
            {selectedDocument ? (
              <div className="grid gap-4 py-4">
                <div>
                  <Label className="text-muted-foreground">Document</Label>
                  <p className="font-medium">
                    {getDocumentLabel(selectedDocument)}
                  </p>
                </div>
                {typeof selectedDocument !== "string" && (
                  <>
                    {selectedDocument.type && (
                      <div>
                        <Label className="text-muted-foreground">Type</Label>
                        <p className="font-medium">{selectedDocument.type}</p>
                      </div>
                    )}
                    {selectedDocument.storagePath && (
                      <div>
                        <Label className="text-muted-foreground">Path</Label>
                        <p className="font-medium break-words">
                          {selectedDocument.storagePath}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <Label className="text-muted-foreground">Preview</Label>
                  <div className="mt-2 rounded-md border border-muted-foreground/10 bg-background p-4">
                    {((): JSX.Element => {
                      const source =
                        typeof selectedDocument === "string"
                          ? getDocumentUrl(selectedDocument)
                          : getDocumentUrl(
                              selectedDocument.storagePath ??
                                selectedDocument.fileName ??
                                selectedDocument.file_name ??
                                null,
                            );

                      if (!source) {
                        return (
                          <p className="text-sm text-muted-foreground">
                            No preview available for this document.
                          </p>
                        );
                      }

                      const lower = source.toLowerCase();
                      if (lower.endsWith(".pdf")) {
                        return (
                          <iframe
                            className="h-96 w-full rounded-md border"
                            src={source}
                            title="Document preview"
                          />
                        );
                      }

                      if (/\.(jpg|jpeg|png|gif|webp)$/i.test(source)) {
                        return (
                          <img
                            className="max-h-96 w-full rounded-md object-contain"
                            src={source}
                            alt={getDocumentLabel(selectedDocument)}
                          />
                        );
                      }

                      return (
                        <p className="text-sm text-muted-foreground">
                          Preview is not available for this file type. Open in a
                          new tab to review it.
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                No document selected.
              </p>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setIsDocumentDialogOpen(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  if (selectedDocument) {
                    handleOpenDocumentInNewTab(selectedDocument);
                  }
                }}
                disabled={!selectedDocument}
              >
                Open in new tab
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
