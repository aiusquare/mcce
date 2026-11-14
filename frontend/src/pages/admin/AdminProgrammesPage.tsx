import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Edit, Trash2, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface Department {
  id: string;
  name: string;
  code: string | null;
}

interface AcademicSession {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: number | string | boolean;
  archived_at?: string | null;
  archive_reason?: string | null;
}

interface Course {
  id: string;
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
}

interface Programme {
  id: string;
  department_id: string;
  department_name?: string | null;
  department_code?: string | null;
  name: string;
  code: string | null;
  duration_years: number;
  programme_structure?: "semester" | "contact" | null;
  is_active?: number;
}

type ApiListResponse<T> = { data?: T };

type ApiCourseLite = {
  id: string;
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
};

type CreateProgrammePayload = {
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  programme_name: string;
  programme_code: string;
  duration_years: number;
  programme_structure: "semester" | "contact";
};

function getApiErrorDetails(error: unknown, fallback: string) {
  const apiError =
    error && typeof error === "object"
      ? (error as {
          message?: string;
          body?: { message?: string; has_dependencies?: boolean };
        })
      : null;

  return {
    message: apiError?.body?.message || apiError?.message || fallback,
    hasDependencies: Boolean(apiError?.body?.has_dependencies),
  };
}

function extractData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiListResponse<T>).data as T;
  }
  return payload as T;
}

export default function AdminProgrammesPage() {
  const [loading, setLoading] = useState(true);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [activeSession, setActiveSession] = useState<AcademicSession | null>(
    null,
  );
  const [courses, setCourses] = useState<Course[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [isEditProgrammeOpen, setIsEditProgrammeOpen] = useState(false);
  const [isEditDepartmentOpen, setIsEditDepartmentOpen] = useState(false);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);
  const [sessionActionId, setSessionActionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteSessionDialogOpen, setDeleteSessionDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] =
    useState<AcademicSession | null>(null);
  const [deleteSessionError, setDeleteSessionError] = useState<string | null>(
    null,
  );
  const [archiveReason, setArchiveReason] = useState("");
  const [activationDialogOpen, setActivationDialogOpen] = useState(false);
  const [sessionToActivate, setSessionToActivate] =
    useState<AcademicSession | null>(null);
  const [activationReason, setActivationReason] = useState("");
  const [activationError, setActivationError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [programmeToDelete, setProgrammeToDelete] = useState<Programme | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteHasDependencies, setDeleteHasDependencies] = useState(false);
  const [deleteDeptDialogOpen, setDeleteDeptDialogOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] =
    useState<Department | null>(null);
  const [deleteDeptError, setDeleteDeptError] = useState<string | null>(null);
  const [deleteDeptHasDependencies, setDeleteDeptHasDependencies] =
    useState(false);
  const [form, setForm] = useState({
    department_id: "",
    department_name: "",
    department_code: "",
    programme_name: "",
    programme_code: "",
    duration_years: "",
    programme_structure: "semester" as "semester" | "contact",
  });
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    code: "",
  });
  const [editProgrammeForm, setEditProgrammeForm] = useState({
    id: "",
    department_id: "",
    programme_name: "",
    programme_code: "",
    duration_years: "",
    programme_structure: "semester" as "semester" | "contact",
  });
  const [editDepartmentForm, setEditDepartmentForm] = useState({
    id: "",
    name: "",
    code: "",
  });
  const [sessionForm, setSessionForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_active: true,
  });
  const [editSessionForm, setEditSessionForm] = useState({
    id: "",
    name: "",
    start_date: "",
    end_date: "",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [programmesRes, departmentsRes, coursesRes, sessionsRes] =
        await Promise.all([
        api.get("/api/admin/get-programmes"),
        api.get("/api/admin/get-departments"),
        api.get("/api/admin/get-courses"),
        api.get("/api/admin/get-sessions"),
      ]);
      setProgrammes(extractData<Programme[]>(programmesRes) || []);
      setDepartments(extractData<Department[]>(departmentsRes) || []);
      const sessionList = extractData<AcademicSession[]>(sessionsRes) || [];
      setSessions(sessionList);
      const sessionMeta =
        sessionsRes && typeof sessionsRes === "object" && "meta" in sessionsRes
          ? (sessionsRes as { meta?: { active_session?: AcademicSession } }).meta
              ?.active_session
          : null;
      setActiveSession(
        sessionMeta ||
          sessionList.find((session) => Number(session.is_active) === 1) ||
          null,
      );

      const apiCourses = extractData<ApiCourseLite[]>(coursesRes) || [];
      const mappedCourses: Course[] = apiCourses.map((course) => ({
        id: course.id,
        department_id: course.department_id || null,
        department_name: course.department_name || null,
        department_code: course.department_code || null,
      }));
      setCourses(mappedCourses);
    } catch (error) {
      toast.error("Failed to load programmes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateProgramme = async () => {
    if (!form.department_id && !form.department_name.trim()) {
      toast.error("Department is required");
      return;
    }

    if (!form.programme_name.trim() || !form.programme_code.trim()) {
      toast.error("Programme name and code are required");
      return;
    }

    if (!form.duration_years) {
      toast.error("Programme duration is required");
      return;
    }

    const payload: CreateProgrammePayload = {
      department_id: form.department_id || null,
      department_name: form.department_name.trim() || null,
      department_code: form.department_code.trim() || null,
      programme_name: form.programme_name.trim(),
      programme_code: form.programme_code.trim(),
      duration_years: Number(form.duration_years),
      programme_structure: form.programme_structure,
    };

    setIsSubmitting(true);
    try {
      await api.post("/api/admin/create-programme", payload);
      toast.success("Programme created successfully");
      setIsAddDialogOpen(false);
      setForm({
        department_id: "",
        department_name: "",
        department_code: "",
        programme_name: "",
        programme_code: "",
        duration_years: "",
        programme_structure: "semester",
      });
      await loadData();
    } catch (error) {
      toast.error("Failed to create programme");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateDepartment = async () => {
    if (!departmentForm.name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/api/admin/create-department", {
        name: departmentForm.name.trim(),
        code: departmentForm.code.trim() || null,
      });
      toast.success("Department saved");
      setIsAddDepartmentOpen(false);
      setDepartmentForm({ name: "", code: "" });
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorDetails(error, "Failed to save department").message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditProgramme = (programme: Programme) => {
    setEditProgrammeForm({
      id: programme.id,
      department_id: programme.department_id || "",
      programme_name: programme.name || "",
      programme_code: programme.code || "",
      duration_years: String(programme.duration_years || ""),
      programme_structure:
        programme.programme_structure === "contact" ? "contact" : "semester",
    });
    setIsEditProgrammeOpen(true);
  };

  const handleUpdateProgramme = async () => {
    if (!editProgrammeForm.id) {
      toast.error("Programme selection is invalid");
      return;
    }

    if (!editProgrammeForm.department_id) {
      toast.error("Department is required");
      return;
    }

    if (
      !editProgrammeForm.programme_name.trim() ||
      !editProgrammeForm.programme_code.trim()
    ) {
      toast.error("Programme name and code are required");
      return;
    }

    if (!editProgrammeForm.duration_years) {
      toast.error("Programme duration is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/api/admin/update-programme", {
        programme_id: editProgrammeForm.id,
        department_id: editProgrammeForm.department_id,
        programme_name: editProgrammeForm.programme_name.trim(),
        programme_code: editProgrammeForm.programme_code.trim(),
        duration_years: Number(editProgrammeForm.duration_years),
        programme_structure: editProgrammeForm.programme_structure,
      });
      toast.success("Programme updated");
      setIsEditProgrammeOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorDetails(error, "Failed to update programme").message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDepartment = (department: Department) => {
    setEditDepartmentForm({
      id: department.id,
      name: department.name || "",
      code: department.code || "",
    });
    setIsEditDepartmentOpen(true);
  };

  const handleUpdateDepartment = async () => {
    if (!editDepartmentForm.id) {
      toast.error("Department selection is invalid");
      return;
    }

    if (!editDepartmentForm.name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/api/admin/update-department", {
        department_id: editDepartmentForm.id,
        name: editDepartmentForm.name.trim(),
        code: editDepartmentForm.code.trim() || null,
      });
      toast.success("Department updated");
      setIsEditDepartmentOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorDetails(error, "Failed to update department").message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSession = async () => {
    if (!sessionForm.name.trim()) {
      toast.error("Session name is required");
      return;
    }
    if (
      sessionForm.start_date &&
      sessionForm.end_date &&
      sessionForm.start_date > sessionForm.end_date
    ) {
      toast.error("End date must be on or after the start date");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/api/admin/create-session", {
        name: sessionForm.name.trim(),
        start_date: sessionForm.start_date || null,
        end_date: sessionForm.end_date || null,
        is_active: sessionForm.is_active ? 1 : 0,
      });
      toast.success("Session saved");
      setIsAddSessionOpen(false);
      setSessionForm({
        name: "",
        start_date: "",
        end_date: "",
        is_active: true,
      });
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorDetails(error, "Failed to save session").message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditSession = (session: AcademicSession) => {
    setEditSessionForm({
      id: session.id,
      name: session.name || "",
      start_date: session.start_date || "",
      end_date: session.end_date || "",
    });
    setIsEditSessionOpen(true);
  };

  const handleUpdateSession = async () => {
    if (!editSessionForm.id || !editSessionForm.name.trim()) {
      toast.error("Session name is required");
      return;
    }
    if (
      editSessionForm.start_date &&
      editSessionForm.end_date &&
      editSessionForm.start_date > editSessionForm.end_date
    ) {
      toast.error("End date must be on or after the start date");
      return;
    }

    try {
      setSessionActionId(editSessionForm.id);
      await api.post("/api/admin/update-session", {
        session_id: editSessionForm.id,
        name: editSessionForm.name.trim(),
        start_date: editSessionForm.start_date || null,
        end_date: editSessionForm.end_date || null,
      });
      toast.success("Session updated");
      setIsEditSessionOpen(false);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorDetails(error, "Failed to update session").message);
    } finally {
      setSessionActionId(null);
    }
  };

  const confirmSetActiveSession = (session: AcademicSession) => {
    setSessionToActivate(session);
    setActivationReason("");
    setActivationError(null);
    setActivationDialogOpen(true);
  };

  const handleSetActiveSession = async () => {
    if (!sessionToActivate) return;
    if (!activationReason.trim()) {
      setActivationError("An activation reason is required.");
      return;
    }

    try {
      setSessionActionId(sessionToActivate.id);
      await api.post("/api/admin/set-active-session", {
        session_id: sessionToActivate.id,
        reason: activationReason.trim(),
      });
      toast.success("Active session updated");
      setActivationDialogOpen(false);
      setSessionToActivate(null);
      setActivationReason("");
      await loadData();
    } catch (error: unknown) {
      const { message } = getApiErrorDetails(
        error,
        "Failed to update active session",
      );
      setActivationError(message);
      toast.error(message);
    } finally {
      setSessionActionId(null);
    }
  };

  const confirmDeleteSession = (session: AcademicSession) => {
    setSessionToDelete(session);
    setDeleteSessionError(null);
    setArchiveReason("");
    setDeleteSessionDialogOpen(true);
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    if (!archiveReason.trim()) {
      setDeleteSessionError("An archive reason is required.");
      return;
    }

    try {
      setSessionActionId(sessionToDelete.id);
      await api.post("/api/admin/archive-session", {
        session_id: sessionToDelete.id,
        reason: archiveReason.trim(),
      });
      toast.success("Session archived");
      setDeleteSessionDialogOpen(false);
      setSessionToDelete(null);
      setDeleteSessionError(null);
      await loadData();
    } catch (error: unknown) {
      const { message } = getApiErrorDetails(error, "Failed to archive session");
      setDeleteSessionError(message);
      toast.error(message);
    } finally {
      setSessionActionId(null);
    }
  };

  const isSessionActive = (session: AcademicSession) =>
    session.id === activeSession?.id || Number(session.is_active) === 1;

  const isSessionArchived = (session: AcademicSession) =>
    Boolean(session.archived_at);

  const handleToggleStatus = async (programme: Programme) => {
    const nextStatus = programme.is_active ? 0 : 1;
    try {
      await api.post("/api/admin/update-programme-status", {
        programme_id: programme.id,
        is_active: nextStatus,
      });
      toast.success("Programme status updated");
      await loadData();
    } catch (error: unknown) {
      const { message: errorMessage } = getApiErrorDetails(
        error,
        "Failed to update programme status",
      );
      toast.error(errorMessage);
    }
  };

  const confirmDeleteProgramme = (programme: Programme) => {
    setProgrammeToDelete(programme);
    setDeleteError(null);
    setDeleteHasDependencies(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProgramme = async () => {
    if (!programmeToDelete) return;

    try {
      await api.post("/api/admin/delete-programme", {
        programme_id: programmeToDelete.id,
      });
      toast.success("Programme deleted successfully");
      setDeleteDialogOpen(false);
      setProgrammeToDelete(null);
      setDeleteError(null);
      setDeleteHasDependencies(false);
      await loadData();
    } catch (error: unknown) {
      // Check if error has dependencies
      const { message: errorMessage, hasDependencies } = getApiErrorDetails(
        error,
        "Failed to delete programme",
      );

      setDeleteError(errorMessage);
      setDeleteHasDependencies(hasDependencies);

      toast.error(errorMessage, {
        duration: hasDependencies ? 6000 : 4000,
      });

      // If it has dependencies, keep dialog open so user can cancel and use status toggle instead
      if (!hasDependencies) {
        setDeleteDialogOpen(false);
        setProgrammeToDelete(null);
      }
    }
  };

  const handleSetUnavailable = async () => {
    if (!programmeToDelete) return;

    try {
      await api.post("/api/admin/update-programme-status", {
        programme_id: programmeToDelete.id,
        is_active: 0,
      });
      toast.success("Programme closed for applications");
      setDeleteDialogOpen(false);
      setProgrammeToDelete(null);
      setDeleteError(null);
      setDeleteHasDependencies(false);
      await loadData();
    } catch (error: unknown) {
      const { message: errorMessage } = getApiErrorDetails(
        error,
        "Failed to update status",
      );
      toast.error(errorMessage);
    }
  };

  const confirmDeleteDepartment = (department: Department) => {
    setDepartmentToDelete(department);
    setDeleteDeptError(null);
    setDeleteDeptHasDependencies(false);
    setDeleteDeptDialogOpen(true);
  };

  const handleDeleteDepartment = async () => {
    if (!departmentToDelete) {
      return;
    }

    try {
      await api.post("/api/admin/delete-department", {
        department_id: departmentToDelete.id,
      });
      toast.success("Department deleted");
      setDeleteDeptDialogOpen(false);
      setDepartmentToDelete(null);
      setDeleteDeptError(null);
      setDeleteDeptHasDependencies(false);
      await loadData();
    } catch (error: unknown) {
      const { message: errorMessage, hasDependencies } = getApiErrorDetails(
        error,
        "Failed to delete department",
      );

      setDeleteDeptError(errorMessage);
      setDeleteDeptHasDependencies(hasDependencies);

      toast.error(errorMessage, { duration: hasDependencies ? 6000 : 4000 });

      if (!hasDependencies) {
        setDeleteDeptDialogOpen(false);
        setDepartmentToDelete(null);
      }
    }
  };

  const getCourseCountForDepartment = (dept: Department) =>
    courses.filter(
      (course) =>
        course.department_id === dept.id ||
        course.department_name === dept.name ||
        (!!dept.code && course.department_code === dept.code),
    ).length;

  const statusLabel = useMemo(
    () => (form.duration_years ? "Available" : "Available"),
    [form.duration_years],
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">Loading programmes...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">
              Programme Management
            </h1>
            <p className="text-muted-foreground">
              Add, update, and manage academic programmes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog
              open={isAddSessionOpen}
              onOpenChange={setIsAddSessionOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline">Add Session</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Academic Session</DialogTitle>
                  <DialogDescription>
                    Create a session and optionally make it active for
                    applications.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sessionName">Session Name *</Label>
                    <Input
                      id="sessionName"
                      placeholder="e.g., 2026/2027"
                      value={sessionForm.name}
                      onChange={(e) =>
                        setSessionForm({
                          ...sessionForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="sessionStart">Start Date</Label>
                      <Input
                        id="sessionStart"
                        type="date"
                        value={sessionForm.start_date}
                        onChange={(e) =>
                          setSessionForm({
                            ...sessionForm,
                            start_date: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sessionEnd">End Date</Label>
                      <Input
                        id="sessionEnd"
                        type="date"
                        value={sessionForm.end_date}
                        onChange={(e) =>
                          setSessionForm({
                            ...sessionForm,
                            end_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sessionForm.is_active}
                      onChange={(e) =>
                        setSessionForm({
                          ...sessionForm,
                          is_active: e.target.checked,
                        })
                      }
                    />
                    Make active for applications
                  </label>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddSessionOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSession} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Session
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isAddDepartmentOpen}
              onOpenChange={setIsAddDepartmentOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline">Add Department</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Department</DialogTitle>
                  <DialogDescription>
                    Add a department that programmes can be attached to.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="newDepartmentName">Department Name *</Label>
                    <Input
                      id="newDepartmentName"
                      value={departmentForm.name}
                      placeholder="e.g., Science and Computing"
                      onChange={(e) =>
                        setDepartmentForm({
                          ...departmentForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="newDepartmentCode">Department Code</Label>
                    <Input
                      id="newDepartmentCode"
                      value={departmentForm.code}
                      placeholder="e.g., SCI"
                      onChange={(e) =>
                        setDepartmentForm({
                          ...departmentForm,
                          code: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDepartmentOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateDepartment} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Department
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>Add Programme</Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Programme</DialogTitle>
                <DialogDescription>
                  Define a programme with department, code, and duration
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Department</Label>
                    <Select
                      value={form.department_id}
                      onValueChange={(value) => {
                        const selected = departments.find(
                          (dept) => dept.id === value,
                        );
                        setForm({
                          ...form,
                          department_id: value,
                          department_name: selected?.name || "",
                          department_code: selected?.code || "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                            {dept.code ? ` (${dept.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="departmentName">Department Name</Label>
                    <Input
                      id="departmentName"
                      placeholder="e.g., Computer Science"
                      value={form.department_name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          department_id: "",
                          department_name: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="departmentCode">Department Code</Label>
                    <Input
                      id="departmentCode"
                      placeholder="e.g., CSC"
                      value={form.department_code}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          department_id: "",
                          department_code: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="programmeCode">Programme Code *</Label>
                    <Input
                      id="programmeCode"
                      placeholder="e.g., NDCS"
                      value={form.programme_code}
                      onChange={(e) =>
                        setForm({ ...form, programme_code: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="programmeName">Programme Name *</Label>
                    <Input
                      id="programmeName"
                      placeholder="e.g., Bsc. Computer Science"
                      value={form.programme_name}
                      onChange={(e) =>
                        setForm({ ...form, programme_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="duration">Duration (Years) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      placeholder="2"
                      value={form.duration_years}
                      onChange={(e) =>
                        setForm({ ...form, duration_years: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Programme Type *</Label>
                  <Select
                    value={form.programme_structure}
                    onValueChange={(value) =>
                      setForm({
                        ...form,
                        programme_structure: value as "semester" | "contact",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select programme type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semester">Semester Based</SelectItem>
                      <SelectItem value="contact">Contact Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Input value={statusLabel} disabled />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateProgramme} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Programme
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>

            <Dialog
              open={isEditDepartmentOpen}
              onOpenChange={setIsEditDepartmentOpen}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Department</DialogTitle>
                  <DialogDescription>
                    Update department name and code.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editDepartmentName">
                      Department Name *
                    </Label>
                    <Input
                      id="editDepartmentName"
                      value={editDepartmentForm.name}
                      onChange={(e) =>
                        setEditDepartmentForm({
                          ...editDepartmentForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editDepartmentCode">Department Code</Label>
                    <Input
                      id="editDepartmentCode"
                      value={editDepartmentForm.code}
                      onChange={(e) =>
                        setEditDepartmentForm({
                          ...editDepartmentForm,
                          code: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDepartmentOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateDepartment} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Department
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isEditProgrammeOpen}
              onOpenChange={setIsEditProgrammeOpen}
            >
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Programme</DialogTitle>
                  <DialogDescription>
                    Update programme department, code, duration, and type.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Department *</Label>
                    <Select
                      value={editProgrammeForm.department_id}
                      onValueChange={(value) =>
                        setEditProgrammeForm({
                          ...editProgrammeForm,
                          department_id: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                            {dept.code ? ` (${dept.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="editProgrammeCode">
                        Programme Code *
                      </Label>
                      <Input
                        id="editProgrammeCode"
                        value={editProgrammeForm.programme_code}
                        onChange={(e) =>
                          setEditProgrammeForm({
                            ...editProgrammeForm,
                            programme_code: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="editDuration">
                        Duration (Years) *
                      </Label>
                      <Input
                        id="editDuration"
                        type="number"
                        min={1}
                        value={editProgrammeForm.duration_years}
                        onChange={(e) =>
                          setEditProgrammeForm({
                            ...editProgrammeForm,
                            duration_years: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="editProgrammeName">Programme Name *</Label>
                    <Input
                      id="editProgrammeName"
                      value={editProgrammeForm.programme_name}
                      onChange={(e) =>
                        setEditProgrammeForm({
                          ...editProgrammeForm,
                          programme_name: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Programme Type *</Label>
                    <Select
                      value={editProgrammeForm.programme_structure}
                      onValueChange={(value) =>
                        setEditProgrammeForm({
                          ...editProgrammeForm,
                          programme_structure: value as
                            | "semester"
                            | "contact",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select programme type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semester">Semester Based</SelectItem>
                        <SelectItem value="contact">Contact Based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditProgrammeOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateProgramme} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Programme
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isEditSessionOpen}
              onOpenChange={setIsEditSessionOpen}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Academic Session</DialogTitle>
                  <DialogDescription>
                    Update the session name and application dates. Activation
                    is managed from the session table.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editSessionName">Session Name *</Label>
                    <Input
                      id="editSessionName"
                      value={editSessionForm.name}
                      onChange={(e) =>
                        setEditSessionForm({
                          ...editSessionForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="editSessionStart">Start Date</Label>
                      <Input
                        id="editSessionStart"
                        type="date"
                        value={editSessionForm.start_date}
                        onChange={(e) =>
                          setEditSessionForm({
                            ...editSessionForm,
                            start_date: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="editSessionEnd">End Date</Label>
                      <Input
                        id="editSessionEnd"
                        type="date"
                        value={editSessionForm.end_date}
                        onChange={(e) =>
                          setEditSessionForm({
                            ...editSessionForm,
                            end_date: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditSessionOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateSession}
                    disabled={sessionActionId === editSessionForm.id}
                  >
                    {sessionActionId === editSessionForm.id
                      ? "Saving..."
                      : "Save Session"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Application Session</CardTitle>
            <CardDescription>
              The active session appears automatically on the student
              application form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {session.name}
                      </TableCell>
                      <TableCell>
                        {session.start_date || "-"} to{" "}
                        {session.end_date || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            isSessionArchived(session)
                              ? "secondary"
                              : isSessionActive(session)
                                ? "emerald"
                                : "secondary"
                          }
                        >
                          {isSessionArchived(session)
                            ? "Archived"
                            : isSessionActive(session)
                              ? "Active"
                              : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            isSessionActive(session) ||
                            isSessionArchived(session) ||
                            sessionActionId === session.id
                          }
                          onClick={() => confirmSetActiveSession(session)}
                        >
                          {sessionActionId === session.id
                            ? "Updating..."
                            : "Set Active"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSessionArchived(session)}
                          onClick={() => openEditSession(session)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={
                            isSessionActive(session) ||
                            isSessionArchived(session) ||
                            sessionActionId === session.id
                          }
                          title={
                            isSessionActive(session)
                              ? "Activate another session before archiving this one"
                              : isSessionArchived(session)
                                ? "Session is already archived"
                                : "Archive session"
                          }
                          onClick={() => confirmDeleteSession(session)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sessions.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No academic sessions yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <AlertDialog
          open={deleteSessionDialogOpen}
          onOpenChange={(open) => {
            setDeleteSessionDialogOpen(open);
            if (!open) {
              setSessionToDelete(null);
              setDeleteSessionError(null);
              setArchiveReason("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive Academic Session</AlertDialogTitle>
              <AlertDialogDescription>
                Archive <strong>{sessionToDelete?.name}</strong> to preserve its
                history while preventing further operational use. This does not
                delete academic records.
                {deleteSessionError ? (
                  <span className="mt-3 block text-destructive">
                    {deleteSessionError}
                  </span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="archiveSessionReason">Archive reason *</Label>
              <Input
                id="archiveSessionReason"
                value={archiveReason}
                onChange={(event) => setArchiveReason(event.target.value)}
                placeholder="e.g. Replaced by corrected session configuration"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteSession}
                disabled={sessionActionId === sessionToDelete?.id}
              >
                {sessionActionId === sessionToDelete?.id
                  ? "Archiving..."
                  : "Archive Session"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={activationDialogOpen}
          onOpenChange={(open) => {
            setActivationDialogOpen(open);
            if (!open) {
              setSessionToActivate(null);
              setActivationReason("");
              setActivationError(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Activate Academic Session</AlertDialogTitle>
              <AlertDialogDescription>
                Activate <strong>{sessionToActivate?.name}</strong>? The
                currently active session will be deactivated.
                {activationError ? (
                  <span className="mt-3 block text-destructive">
                    {activationError}
                  </span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="activateSessionReason">Activation reason *</Label>
              <Input
                id="activateSessionReason"
                value={activationReason}
                onChange={(event) => setActivationReason(event.target.value)}
                placeholder="e.g. Approved academic-year rollover"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleSetActiveSession();
                }}
                disabled={sessionActionId === sessionToActivate?.id}
              >
                {sessionActionId === sessionToActivate?.id
                  ? "Activating..."
                  : "Activate Session"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card>
          <CardHeader>
            <CardTitle>Programmes</CardTitle>
            <CardDescription>
              Manage programme availability and codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programme</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programmes.map((programme) => (
                    <TableRow key={programme.id}>
                      <TableCell className="font-medium">
                        {programme.name}
                      </TableCell>
                      <TableCell>{programme.code || "-"}</TableCell>
                      <TableCell>
                        {programme.department_name ||
                          programme.department_code ||
                          "-"}
                      </TableCell>
                      <TableCell>{programme.duration_years} yrs</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {programme.programme_structure === "contact"
                            ? "Contact Based"
                            : "Semester Based"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            programme.is_active ? "emerald" : "secondary"
                          }
                        >
                          {programme.is_active
                            ? "Open for Application"
                            : "Closed for Application"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditProgramme(programme)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleStatus(programme)}
                        >
                          {programme.is_active
                            ? "Close Application"
                            : "Open Application"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => confirmDeleteProgramme(programme)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>
              Academic departments and their statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Department Name</TableHead>
                    <TableHead>Programmes</TableHead>
                    <TableHead>Courses</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-mono font-medium">
                        {dept.code || "-"}
                      </TableCell>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell>
                        {
                          programmes.filter(
                            (programme) => programme.department_id === dept.id,
                          ).length
                        }
                      </TableCell>
                      <TableCell>{getCourseCountForDepartment(dept)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDepartment(dept)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => confirmDeleteDepartment(dept)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setProgrammeToDelete(null);
              setDeleteError(null);
              setDeleteHasDependencies(false);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Programme</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                <strong>{programmeToDelete?.name}</strong>? This action cannot
                be undone and will fail if there are students, courses, or
                applications associated with this programme.
                {deleteError ? (
                  <p className="mt-3 text-destructive">{deleteError}</p>
                ) : null}
                <br />
                <br />
                <strong>Tip:</strong> If you want to prevent new enrollments,
                consider closing it for applications instead of deleting it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProgrammeToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              {deleteHasDependencies && (
                <Button variant="outline" onClick={handleSetUnavailable}>
                  Close Application
                </Button>
              )}
              <AlertDialogAction
                onClick={handleDeleteProgramme}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Programme
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={deleteDeptDialogOpen}
          onOpenChange={(open) => {
            setDeleteDeptDialogOpen(open);
            if (!open) {
              setDepartmentToDelete(null);
              setDeleteDeptError(null);
              setDeleteDeptHasDependencies(false);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Department</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{" "}
                {departmentToDelete?.name || "this department"}? This action
                cannot be undone and will fail if there are programmes,
                courses, students, or applications linked to it.
                {deleteDeptError ? (
                  <p className="mt-3 text-destructive">{deleteDeptError}</p>
                ) : null}
                {deleteDeptHasDependencies ? (
                  <p className="mt-2 text-muted-foreground">
                    Remove or reassign the linked records before deleting.
                  </p>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDepartmentToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteDepartment}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Department
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}







