import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import api from "@/lib/api";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export default function CourseRegistrationPage() {
  const queryClient = useQueryClient();
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["student-course-registration-context"],
    queryFn: async () => {
      const res = await api.get("/api/student/course-registration/context");
      const payload = res.data.data;

      // Auto-select based on existing registration or core courses
      if (payload.registration_items && payload.registration_items.length > 0) {
        setSelectedCourses(payload.registration_items.map((i: any) => i.course_id));
      } else if (payload.core_courses) {
        const cores = payload.core_courses.map((c: any) => c.id);
        const carrys = payload.carryovers ? payload.carryovers.map((c: any) => c.id) : [];
        setSelectedCourses([...cores, ...carrys]);
      }
      return payload;
    },
    refetchOnWindowFocus: false,
  });

  const student = data?.student;
  const sessionName = data?.session_name || data?.session_id || "Active Session";
  const semesterName = data?.semester_id || student?.current_level || "Current Period";

  const saveMutation = useMutation({
    mutationFn: async (action: "draft" | "submit") => {
      const payload = {
        student_id: student?.id,
        session_id: data?.session_id,
        semester_id: data?.semester_id,
        action,
        courses: selectedCourses.map((id) => ({ course_id: id })),
      };
      const res = await api.post("/api/student/course-registration/save", payload);
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["student-course-registration-context"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to save registration");
    },
  });

  const handleToggleCourse = (courseId: string) => {
    setSelectedCourses((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StudentLayout>
    );
  }

  const { settings, rules, core_courses, elective_courses, registration } = data;
  const isReadOnly = registration && ["submitted", "approved", "locked"].includes(registration.status);

  const minCredits = rules?.min_credits ? parseInt(rules.min_credits, 10) : 15;
  const maxCredits = rules?.max_credits ? parseInt(rules.max_credits, 10) : 24;

  const totalCredits = [...core_courses, ...elective_courses, ...(data.carryovers || [])]
    .filter((c) => selectedCourses.includes(c.id))
    .reduce((sum, c) => sum + parseInt(c.credit_units || c.credit_unit || 0, 10), 0);

  const isOverMax = totalCredits > maxCredits;
  const isUnderMin = totalCredits < minCredits;
  const hasCarryovers = Boolean(data?.carryovers && data.carryovers.length > 0);
  // Under NUC BMAS: If a student has mandatory carryovers or the total load exceeds the max limit,
  // regular core courses can be unchecked/deferred to stay within the 24-credit ceiling.
  const canDeferCore = !isReadOnly && (hasCarryovers || isOverMax);

  const isRegistrationOpen = settings && ["open", "late"].includes(settings.status);

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
                    {core_courses?.map((course: any) => (
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

            {data?.carryovers && data.carryovers.length > 0 && (
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
                      {data.carryovers.map((course: any) => (
                        <TableRow key={`carryover-${course.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedCourses.includes(course.id)}
                              onCheckedChange={() => !isReadOnly && handleToggleCourse(course.id)}
                              disabled={isReadOnly || true} // Carryovers are compulsory
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
                    {elective_courses?.map((course: any) => (
                      <TableRow key={course.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCourses.includes(course.id)}
                            onCheckedChange={() => !isReadOnly && handleToggleCourse(course.id)}
                            disabled={isReadOnly}
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
                      Save Draft
                    </Button>
                    <Button 
                      className="w-full" 
                      onClick={() => saveMutation.mutate("submit")}
                      disabled={saveMutation.isPending || isOverMax || isUnderMin}
                    >
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
