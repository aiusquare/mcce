import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import {
  loadCohortRegisteredCourses,
  normalizeRegisteredCoursesResponse,
  type RegisteredCourse,
} from "@/lib/resultBatchCourses";
import { toast } from "sonner";
import { allowedContactChoices } from "./contactEligibility";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (batch: any) => void;
}

export function CreateResultBatchDialog({
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    session_id: "",
    department_id: "",
    semester_id: "all",
    programme_id: "",
    level: "",
    course_id: "",
  });

  useEffect(() => {
    if (open) {
      loadDependencies();
    }
  }, [open]);

  const [loadingCourses, setLoadingCourses] = useState(false);

  const loadDependencies = async () => {
    try {
      const [sessRes, deptRes, progRes, semRes] = (await Promise.all([
        api.get("/api/admin/get-sessions"),
        api.get("/api/admin/get-departments"),
        api.get("/api/admin/get-programmes"),
        api.get("/api/admin/get-semesters"),
      ])) as [any, any, any, any];
      setSessions(sessRes.data || []);
      if (sessRes.meta?.active_session) {
        setFormData((prev) => ({
          ...prev,
          session_id: sessRes.meta.active_session.id,
        }));
      }
      setDepartments(deptRes.data || []);
      setProgrammes(progRes.data || []);
      setSemesters(semRes.data || []);
    } catch (error) {
      toast.error("Failed to load form data");
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      if (
        !formData.session_id ||
        !formData.programme_id ||
        formData.programme_id === "all"
      ) {
        setCourses([]);
        return;
      }
      setLoadingCourses(true);
      try {
        // Query with semester_id = 'all' so we always load the full curriculum (both current contact and carryovers)
        const query = new URLSearchParams({
          session_id: formData.session_id,
          semester_id: "all",
        });
        if (formData.department_id && formData.department_id !== "all") {
          query.set("department_id", formData.department_id);
        }
        if (formData.programme_id && formData.programme_id !== "all") {
          query.set("programme_id", formData.programme_id);
        }
        const res = (await api.get(
          `/api/admin/course-registration/registered-courses?${query.toString()}`,
        )) as any;
        let primaryCourses = normalizeRegisteredCoursesResponse(
          res,
        ) as RegisteredCourse[];

        let validCourses = primaryCourses;

        // Fast Fallback: If registered-courses returns empty (e.g. before remote PHP file sync),
        // query all programme courses via /api/admin/get-courses
        if (validCourses.length === 0) {
          try {
            const allCoursesRes = (await api.get("/api/admin/get-courses")) as any;
            const rawList = Array.isArray(allCoursesRes)
              ? allCoursesRes
              : allCoursesRes?.data || [];
            if (Array.isArray(rawList) && rawList.length > 0) {
              const progCourses = rawList.filter(
                (c: any) =>
                  !c.programme_id ||
                  c.programme_id === formData.programme_id,
              );
              validCourses = progCourses.map((c: any) => ({
                id: c.id,
                code: c.code,
                title: c.title,
                level: c.level || (c.contact_number ? `Contact ${c.contact_number}` : "Contact 1"),
                type: c.type || "core",
                contact_number: c.contact_number ? Number(c.contact_number) : undefined,
                registered_count: Number(c.registered_count || 0),
                carryover_count: Number(c.carryover_count || 0),
              }));
            }
          } catch (fbErr) {
            // silent fallback catch
          }
        }

        setCourses(validCourses);
      } catch (e) {
        toast.error("Failed to load registered courses");
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchCourses();
  }, [
    formData.session_id,
    formData.department_id,
    formData.programme_id,
    programmes,
    semesters,
    sessions,
  ]);

  const filteredProgrammes =
    formData.department_id && formData.department_id !== "all"
      ? programmes.filter((p) => p.department_id === formData.department_id)
      : programmes;

  const selectedProgramme = programmes.find(
    (p) => p.id === formData.programme_id,
  );
  const progStructure = selectedProgramme?.programme_structure || "semester";

  const levelLabel = progStructure === "semester" ? "Semester *" : "Contact *";
  const contactChoices = allowedContactChoices(sessions, formData.session_id);

  const getCourseContactKey = (c: any) => {
    if (c.contact_number) return `Contact ${c.contact_number}`;
    if (c.level) {
      const m = String(c.level).match(/contact\s*(\d+)/i);
      if (m) return `Contact ${m[1]}`;
      return String(c.level);
    }
    return "Other";
  };

  const selectedContactKey =
    formData.semester_id && formData.semester_id !== "all"
      ? formData.semester_id.trim()
      : null;

  const groupedCourses = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const course of courses) {
      const key = getCourseContactKey(course);
      if (!groups[key]) groups[key] = [];
      groups[key].push(course);
    }

    const keys = Object.keys(groups);
    keys.sort((a, b) => {
      if (selectedContactKey) {
        const aMatches = a.toLowerCase().includes(selectedContactKey.toLowerCase());
        const bMatches = b.toLowerCase().includes(selectedContactKey.toLowerCase());
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
      }
      const numA = Number(a.match(/\d+/)?.[0] || 0);
      const numB = Number(b.match(/\d+/)?.[0] || 0);
      if (numA && numB) return numB - numA;
      return a.localeCompare(b);
    });

    const ordered: Record<string, { label: string; isCurrent: boolean; courses: any[] }> = {};
    for (const k of keys) {
      const isCurrent = Boolean(
        selectedContactKey && k.toLowerCase().includes(selectedContactKey.toLowerCase())
      );
      let groupLabel = k;
      if (selectedContactKey) {
        groupLabel = isCurrent
          ? `${k} — Current Contact Courses`
          : `${k} — Carryover / Retake Courses`;
      }
      ordered[k] = {
        label: groupLabel,
        isCurrent,
        courses: groups[k],
      };
    }
    return ordered;
  }, [courses, selectedContactKey]);

  const handleSubmit = async () => {
    if (
      !formData.session_id ||
      !formData.course_id ||
      formData.course_id === "all"
    ) {
      toast.error(
        "Please fill in all required fields (Session, Programme, Course)",
      );
      return;
    }

    const selectedCourse = courses.find((c: any) => c.id === formData.course_id);
    if (!selectedCourse) {
      toast.error(
        "Cannot create result batch: Please select a valid course.",
      );
      return;
    }

    setLoading(true);
    try {
      // Determine the canonical semester / contact for this batch:
      // If the selected course belongs to a specific contact (e.g. EAP312 belongs to Contact 5),
      // the batch is a Contact 5 batch being sat in this session.
      let courseContact = selectedCourse.contact_number
        ? `Contact ${selectedCourse.contact_number}`
        : selectedCourse.level;
      if (!courseContact && formData.semester_id && formData.semester_id !== "all") {
        courseContact = formData.semester_id;
      }
      const resolvedLevel = courseContact || "Contact 1";

      const submitPayload = {
        session_id: formData.session_id,
        semester_id: resolvedLevel,
        course_id: formData.course_id,
        department_id:
          formData.department_id && formData.department_id !== "all"
            ? formData.department_id
            : selectedProgramme?.department_id || null,
        programme_id:
          formData.programme_id && formData.programme_id !== "all"
            ? formData.programme_id
            : null,
        level: resolvedLevel,
      };

      const res = (await api.post(
        "/api/admin/results/batches/create",
        submitPayload,
      )) as any;
      if (res.status === "success") {
        toast.success("Result batch created successfully");
        onSuccess(res.data.data);
        onOpenChange(false);
      } else {
        toast.error(res.message || "Failed to create batch");
      }
    } catch (error: any) {
      toast.error(error.body?.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Result Batch</DialogTitle>
          <DialogDescription>
            Create a new batch to enter results for a specific course.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Academic Session <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.session_id}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    session_id: v,
                    semester_id: "all",
                    course_id: "all",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select session" />
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
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.department_id}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    department_id: v,
                    programme_id: "all",
                    semester_id: "all",
                    course_id: "all",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Programme <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.programme_id}
                onValueChange={(v) => {
                  const prog = programmes.find((p) => p.id === v);
                  setFormData((prev) => ({
                    ...prev,
                    programme_id: v,
                    department_id:
                      prev.department_id && prev.department_id !== "all"
                        ? prev.department_id
                        : prog?.department_id || "",
                    semester_id: "all",
                    course_id: "all",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select programme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select Programme</SelectItem>
                  {filteredProgrammes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{levelLabel}</Label>
              <Select
                value={formData.semester_id}
                onValueChange={(v) =>
                  setFormData({ ...formData, semester_id: v, course_id: "all" })
                }
                disabled={
                  !formData.programme_id || formData.programme_id === "all"
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={"Select " + progStructure} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All Contacts (All Courses & Carryovers)
                  </SelectItem>
                  {progStructure === "semester" ? (
                    <>
                      <SelectItem value="First Semester">
                        First Semester
                      </SelectItem>
                      <SelectItem value="Second Semester">
                        Second Semester
                      </SelectItem>
                    </>
                  ) : (
                    [1, 2, 3, 4, 5, 6].map((num) => {
                      const matchChoice = contactChoices?.find((c) => c.number === num);
                      const label = matchChoice?.label || `Contact ${num}`;
                      return (
                        <SelectItem key={num} value={`Contact ${num}`}>
                          {label}
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Course <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.course_id}
              onValueChange={(v) => setFormData({ ...formData, course_id: v })}
              disabled={
                !formData.session_id ||
                !formData.programme_id ||
                formData.programme_id === "all"
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Select Course</SelectItem>
                {courses.length === 0 ? (
                  <SelectItem value="none" disabled>
                    {loadingCourses
                      ? "Loading courses..."
                      : "No courses found for this programme"}
                  </SelectItem>
                ) : (
                  Object.entries(groupedCourses).map(
                    ([key, groupInfo]: [string, any]) => (
                      <SelectGroup key={key}>
                        <SelectLabel
                          className={`font-bold py-1 px-2 text-xs uppercase tracking-wider ${
                            groupInfo.isCurrent
                              ? "text-primary bg-primary/10"
                              : "text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
                          }`}
                        >
                          {groupInfo.label}
                        </SelectLabel>
                        {groupInfo.courses.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex flex-col">
                              <span>
                                {c.code} - {c.title}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {Number(c.registered_count || 0) > 0 ? (
                                  <>
                                    {c.type ? c.type.toUpperCase() : "CORE"} •{" "}
                                    {c.registered_count}{" "}
                                    {c.registered_count == 1
                                      ? "student"
                                      : "students"}
                                    {c.carryover_count > 0 &&
                                      ` • ${c.carryover_count} carryover${c.carryover_count === 1 ? "" : "s"}`}
                                  </>
                                ) : (
                                  <span className="text-amber-600 font-medium">
                                    CARRYOVER / RETAKE • {c.level || key || "Contact Course"}
                                  </span>
                                )}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ),
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
