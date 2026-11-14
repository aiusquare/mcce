import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import api from "@/lib/api";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

// =============================================================================
// TypeScript Interfaces for Registration Context & API Contract
// =============================================================================

export interface CourseItem {
  id: string;
  code: string;
  title: string;
  credit_units?: number | string;
  credit_unit?: number | string;
  type?: string;
  level?: string;
  programme_id?: string;
  contact_number?: number;
  origin_result_attempt_id?: string;
}

export interface RegistrationItem {
  id: string;
  registration_id: string;
  course_id: string;
  code?: string;
  title?: string;
  credit_units?: number | string;
  registration_type?: string;
  status?: string;
  origin_result_attempt_id?: string;
}

export interface RegistrationRecord {
  id: string;
  student_id: string;
  session_id: string;
  academic_session_id?: string;
  semester_id: string;
  level?: string;
  total_credits?: number | string;
  status: "draft" | "submitted" | "approved" | "locked" | "rejected" | string;
  return_reason?: string;
  submitted_at?: string;
}

export interface RegistrationSettings {
  id?: string;
  session_id?: string;
  semester_id?: string;
  status: "open" | "late" | "closed" | string;
  opens_at?: string;
  closes_at?: string;
  late_closes_at?: string;
}

export interface CreditRules {
  id?: string;
  min_credits?: number | string;
  max_credits?: number | string;
}

export interface StudentProfile {
  id: string;
  user_id?: string;
  full_name?: string;
  matric_number?: string;
  admission_number?: string;
  current_level?: string;
  programme_id?: string;
  department_id?: string;
  entry_mode?: string;
}

export interface RegistrationContextData {
  student: StudentProfile;
  session_id: string;
  session_name?: string | null;
  semester_id: string;
  settings?: RegistrationSettings | null;
  rules?: CreditRules | null;
  core_courses: CourseItem[];
  elective_courses: CourseItem[];
  carryovers: CourseItem[];
  registration?: RegistrationRecord | null;
  registration_items: RegistrationItem[];
}

export interface ApiResponse<T> {
  status: "success" | "error";
  data?: T;
  message?: string;
  is_late?: boolean;
}

// =============================================================================
// Component Implementation
// =============================================================================

export default function CourseRegistrationPage() {
  const queryClient = useQueryClient();
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  // 1. Context Query: generic API client returns the parsed response body directly
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<RegistrationContextData>({
    queryKey: ["student-course-registration-context"],
    queryFn: async () => {
      let url = "/api/student/course-registration/context";
      try {
        const stored = localStorage.getItem("mccas_profile") || localStorage.getItem("MCCAS_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.email) {
            const sep = url.includes("?") ? "&" : "?";
            url += `${sep}email=${encodeURIComponent(parsed.email)}`;
          }
        }
      } catch (e) {
        // ignore localStorage errors
      }

      const raw = (await api.get(url)) as ApiResponse<RegistrationContextData>;
      if (!raw || typeof raw !== "object") {
        throw new Error("Invalid response received from server.");
      }
      if (raw.status !== "success" || !raw.data) {
        throw new Error(raw.message || "Failed to load course registration context.");
      }
      return raw.data;
    },
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // 2. Selection Initialization: preselect active registered courses or core + carryovers once
  useEffect(() => {
    if (data && !hasInitialized) {
      if (data.registration_items && data.registration_items.length > 0) {
        const registered = data.registration_items
          .filter((i) => !i.status || i.status === "active")
          .map((i) => i.course_id);
        const carrys = (data.carryovers || []).map((c) => c.id);
        setSelectedCourses(Array.from(new Set([...registered, ...carrys])));
      } else {
        const cores = (data.core_courses || []).map((c) => c.id);
        const carrys = (data.carryovers || []).map((c) => c.id);
        setSelectedCourses(Array.from(new Set([...cores, ...carrys])));
      }
      setHasInitialized(true);
    }
  }, [data, hasInitialized]);

  // 3. Save Mutation: sends payload and extracts returned response message
  const saveMutation = useMutation({
    mutationFn: async (action: "draft" | "submit") => {
      if (!data?.student?.id) {
        throw new Error("Student profile is missing from registration context.");
      }

      let email: string | undefined;
      try {
        const stored = localStorage.getItem("mccas_profile") || localStorage.getItem("MCCAS_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.email) email = parsed.email;
        }
      } catch (e) {
        // ignore
      }

      const payload = {
        student_id: data.student.id,
        session_id: data.session_id,
        semester_id: data.semester_id,
        email: email || undefined,
        action,
        courses: selectedCourses.map((id) => ({ course_id: id })),
      };
      const res = (await api.post("/api/student/course-registration/save", payload)) as ApiResponse<null>;
      if (!res || res.status !== "success") {
        throw new Error(res?.message || "Failed to save course registration.");
      }
      return res;
    },
    onSuccess: (res) => {
      toast.success(res?.message || "Registration updated successfully.");
      setHasInitialized(false); // Allow re-syncing selections with updated server state
      queryClient.invalidateQueries({ queryKey: ["student-course-registration-context"] });
    },
    onError: (err: any) => {
      const msg = err?.body?.message || err?.message || "Failed to save registration.";
      toast.error(msg);
    },
  });

  // 4. Map of all available courses for fast lookup and deduplication
  const courseMap = useMemo(() => {
    const map = new Map<string, CourseItem>();
    if (data) {
      [...(data.core_courses || []), ...(data.elective_courses || []), ...(data.carryovers || [])].forEach((c) => {
        if (c && c.id) {
          map.set(c.id, c);
        }
      });
    }
    return map;
  }, [data]);

  // Handle course toggling, ensuring mandatory carryovers cannot be removed
  const handleToggleCourse = (courseId: string) => {
    const isCarryover = (data?.carryovers || []).some((c) => c.id === courseId);
    if (isCarryover) {
      toast.info("Carryover courses are compulsory under academic regulations and cannot be removed.");
      return;
    }
    setSelectedCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  // Loading State
  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StudentLayout>
    );
  }

  // Error State: show clear error message with retry option; do not destructure undefined data
  if (isError || !data) {
    const errorMsg =
      (error as any)?.body?.message ||
      (error as any)?.message ||
      "An unexpected error occurred while loading course registration context.";

    return (
      <StudentLayout>
        <div className="max-w-2xl mx-auto py-12">
          <Card className="border-destructive/30 shadow-sm">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl text-destructive font-serif">
                Course Registration Unavailable
              </CardTitle>
              <CardDescription className="text-sm mt-2 text-slate-600">
                {errorMsg}
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="gap-2"
              >
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Try Again
              </Button>
            </CardFooter>
          </Card>
        </div>
      </StudentLayout>
    );
  }

  // Loaded State
  const { student, settings, rules, core_courses, elective_courses, carryovers, registration } = data;
  const isReadOnly = Boolean(registration && ["submitted", "approved", "locked"].includes(registration.status));

  const minCredits = rules?.min_credits ? parseInt(String(rules.min_credits), 10) : 15;
  const maxCredits = rules?.max_credits ? parseInt(String(rules.max_credits), 10) : 24;

  const sessionName = data.session_name || data.session_id || "Active Session";
  const semesterName = data.semester_id || student?.current_level || "Current Period";

  // Compute total credits across distinct selected courses
  const totalCredits = selectedCourses.reduce((sum, cid) => {
    const c = courseMap.get(cid);
    const units = c ? parseInt(String(c.credit_units || c.credit_unit || 0), 10) : 0;
    return sum + (isNaN(units) ? 0 : units);
  }, 0);

  const isOverMax = totalCredits > maxCredits;
  const isUnderMin = totalCredits < minCredits;
  const hasCarryovers = Boolean(carryovers && carryovers.length > 0);
  const canDeferCore = !isReadOnly && (hasCarryovers || isOverMax);
  const isRegistrationOpen = Boolean(settings && ["open", "late"].includes(settings.status));

  return (
    <StudentLayout>
      <div className="space-y-6 max-w-5xl mx-auto py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-serif text-slate-900">Course Registration</h1>
            <p className="text-muted-foreground mt-1">Select and register your courses for the current semester.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="text-base px-4 py-1">
              Session: {sessionName} | Period: {semesterName}
            </Badge>
            {registration && (
              <Badge variant={isReadOnly ? "default" : "secondary"} className="uppercase">
                Status: {registration.status}
              </Badge>
            )}
          </div>
        </div>

        {!isRegistrationOpen && !isReadOnly && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive font-medium text-center">Course Registration is currently closed.</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Compulsory / Core Courses</CardTitle>
                    <CardDescription>These courses are mandatory for your level and programme.</CardDescription>
                  </div>
                  {canDeferCore && (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                      Core Deferral Allowed
                    </Badge>
                  )}
                </div>
                {hasCarryovers && (
                  <div className="text-xs text-amber-800 bg-amber-50/80 border border-amber-200 p-2.5 rounded-md mt-2">
                    <strong>NUC BMAS Rule:</strong> Because you have mandatory carryover courses, you may uncheck/defer regular core courses if needed to stay within the maximum {maxCredits} credit units limit. Deferred courses must be registered in a subsequent contact.
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {core_courses?.map((course: CourseItem) => (
                      <TableRow key={course.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedCourses.includes(course.id)}
                              onCheckedChange={() => !isReadOnly && handleToggleCourse(course.id)}
                              disabled={isReadOnly || !canDeferCore}
                              aria-label={`Toggle course ${course.code}`}
                            />
                            {!selectedCourses.includes(course.id) && (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                                Deferred
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{course.code}</TableCell>
                        <TableCell>{course.title}</TableCell>
                        <TableCell className="text-right">{course.credit_units || course.credit_unit}</TableCell>
                      </TableRow>
                    ))}
                    {core_courses?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                          No core courses found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {carryovers && carryovers.length > 0 && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive">Carryover Courses</CardTitle>
                  <CardDescription>Under NUC BMAS regulations, carryover courses have priority and must be registered first.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carryovers.map((course: CourseItem) => (
                        <TableRow key={`carryover-${course.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedCourses.includes(course.id)}
                              disabled={true} // Carryovers are compulsory and cannot be deselected
                              aria-label={`Mandatory carryover course ${course.code}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-destructive">{course.code}</TableCell>
                          <TableCell>{course.title}</TableCell>
                          <TableCell className="text-right">{course.credit_units || course.credit_unit}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Elective Courses</CardTitle>
                <CardDescription>Select additional elective courses as required.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right">Units</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {elective_courses?.map((course: CourseItem) => (
                      <TableRow key={course.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCourses.includes(course.id)}
                            onCheckedChange={() => !isReadOnly && handleToggleCourse(course.id)}
                            disabled={isReadOnly}
                            aria-label={`Toggle elective course ${course.code}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{course.code}</TableCell>
                        <TableCell>{course.title}</TableCell>
                        <TableCell className="text-right">{course.credit_units || course.credit_unit}</TableCell>
                      </TableRow>
                    ))}
                    {elective_courses?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                          No elective courses available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Registration Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Level / Contact</span>
                  <span className="font-medium">{student?.current_level}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Units</span>
                  <span
                    className={`font-semibold ${
                      isOverMax
                        ? "text-destructive font-bold"
                        : isUnderMin
                        ? "text-amber-600 font-semibold"
                        : "text-emerald-700 font-semibold"
                    }`}
                  >
                    {totalCredits} / {maxCredits} units
                  </span>
                </div>

                {isUnderMin && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-md">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Minimum required load is {minCredits} units (currently {totalCredits}). You must add more units before submitting.
                    </span>
                  </div>
                )}

                {isOverMax && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Maximum credit limit of {maxCredits} units exceeded (currently {totalCredits}). Drop courses to proceed.
                    </span>
                  </div>
                )}

                {!isUnderMin && !isOverMax && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-md">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>Credit load is within NUC BMAS standard ({minCredits}–{maxCredits} units).</span>
                  </div>
                )}

                <div className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-md">
                  Standard BMAS range: {minCredits}–{maxCredits} units
                </div>
                <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 p-2.5 rounded-md">
                  Graduating students requiring credit overload dispensation (&gt; {maxCredits} units) should contact their Department / Academic Advisor for administrative approval.
                </div>

                {registration?.return_reason && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                    <strong>Returned for Correction:</strong><br />
                    {registration.return_reason}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                {!isReadOnly && isRegistrationOpen && (
                  <>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => saveMutation.mutate("draft")}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Draft
                    </Button>
                    <Button 
                      className="w-full" 
                      onClick={() => saveMutation.mutate("submit")}
                      disabled={saveMutation.isPending || isOverMax || isUnderMin}
                    >
                      {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Submit Registration
                    </Button>
                  </>
                )}
                {isReadOnly && (
                  <Button variant="outline" className="w-full" onClick={() => window.print()}>
                    Print Registration Slip
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
