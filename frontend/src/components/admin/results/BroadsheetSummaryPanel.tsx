import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  BookOpen,
  Users,
  AlertCircle,
  GraduationCap,
} from "lucide-react";

interface BroadsheetSummaryPanelProps {
  summary: any;
}

export function BroadsheetSummaryPanel({ summary }: BroadsheetSummaryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!summary) return null;

  const total = Number(summary.total_students || 0);
  const passed = Number(summary.total_passed || 0);
  const carryover = Number(summary.total_carryover || 0);
  const probation = Number(summary.total_probation || 0);
  const withdrawn = Number(summary.total_withdrawn || 0);
  const incomplete = Number(summary.total_incomplete || 0);

  const passPct = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";
  const coPct = total > 0 ? ((carryover / total) * 100).toFixed(1) : "0.0";

  return (
    <Card className="print:hidden border-slate-200">
      <CardHeader className="py-3 px-5 border-b bg-muted/20 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold">Academic Performance & Result Summary</CardTitle>
          <Badge variant="outline" className="text-[11px] font-mono">
            {total} Candidates
          </Badge>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs text-muted-foreground hover:text-slate-800 flex items-center gap-1 focus:outline-none"
        >
          {collapsed ? (
            <>
              Expand Summary <ChevronDown className="h-4 w-4" />
            </>
          ) : (
            <>
              Collapse Summary <ChevronUp className="h-4 w-4" />
            </>
          )}
        </button>
      </CardHeader>

      {!collapsed && (
        <CardContent className="p-5 space-y-5">
          {/* 6 Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Total Candidates */}
            <div className="p-3 rounded-lg border bg-slate-50/50">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Users className="h-3 w-3" /> Total Candidates
              </span>
              <p className="text-xl font-bold text-slate-800 mt-1">{total}</p>
              <span className="text-[10px] text-muted-foreground">100% of Cohort</span>
            </div>

            {/* 2. Clean Pass */}
            <div className="p-3 rounded-lg border border-green-200 bg-green-50/30">
              <span className="text-[11px] text-green-800 font-medium flex items-center gap-1">
                <GraduationCap className="h-3 w-3 text-green-600" /> Clean Pass
              </span>
              <p className="text-xl font-bold text-green-700 mt-1">{passed}</p>
              <span className="text-[10px] text-green-800">{passPct}% pass rate</span>
            </div>

            {/* 3. Carryover */}
            <div className="p-3 rounded-lg border border-orange-200 bg-orange-50/30">
              <span className="text-[11px] text-orange-800 font-medium flex items-center gap-1">
                <BookOpen className="h-3 w-3 text-orange-600" /> Carryover (CO)
              </span>
              <p className="text-xl font-bold text-orange-700 mt-1">{carryover}</p>
              <span className="text-[10px] text-orange-800">{coPct}% with CO</span>
            </div>

            {/* 4. Academic Probation */}
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/30">
              <span className="text-[11px] text-amber-800 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-amber-600" /> Probation
              </span>
              <p className="text-xl font-bold text-amber-700 mt-1">{probation}</p>
              <span className="text-[10px] text-amber-800">1.00 – 1.49 CGPA</span>
            </div>

            {/* 5. Withdrawal */}
            <div className="p-3 rounded-lg border border-red-200 bg-red-50/30">
              <span className="text-[11px] text-red-800 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-red-600" /> Withdrawal
              </span>
              <p className="text-xl font-bold text-red-700 mt-1">{withdrawn}</p>
              <span className="text-[10px] text-red-800">&lt; 1.00 CGPA</span>
            </div>

            {/* 6. Incomplete Results */}
            <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/30">
              <span className="text-[11px] text-purple-800 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3 text-purple-600" /> Incomplete
              </span>
              <p className="text-xl font-bold text-purple-700 mt-1">{incomplete}</p>
              <span className="text-[10px] text-purple-800">Pending scores (NR)</span>
            </div>
          </div>

          {/* Deep-Dive Tabs */}
          <Tabs defaultValue="courses" className="w-full">
            <TabsList className="h-8 bg-muted/60 p-0.5">
              <TabsTrigger value="courses" className="text-xs h-7">
                Course Performance ({summary.course_statistics?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="gpa" className="text-xs h-7">
                GPA / Class Distribution ({summary.gpa_distribution?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="lists" className="text-xs h-7">
                Candidate Action Lists
              </TabsTrigger>
            </TabsList>

            {/* 1. Course Performance Tab */}
            <TabsContent value="courses" className="pt-3">
              {summary.course_statistics?.length > 0 ? (
                <div className="border rounded-md overflow-x-auto max-h-[300px]">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50 sticky top-0">
                      <TableRow>
                        <TableHead className="w-24">Course Code</TableHead>
                        <TableHead>Course Title</TableHead>
                        <TableHead className="w-16 text-center">Units</TableHead>
                        <TableHead className="w-16 text-center">Sat</TableHead>
                        <TableHead className="w-16 text-center">Passed</TableHead>
                        <TableHead className="w-16 text-center">Failed</TableHead>
                        <TableHead className="w-20 text-center">Pass %</TableHead>
                        <TableHead className="w-20 text-center">Mean Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.course_statistics.map((c: any) => (
                        <TableRow key={c.course_id || c.course_code}>
                          <TableCell className="font-bold font-mono text-primary">
                            {c.course_code}
                          </TableCell>
                          <TableCell>{c.course_title}</TableCell>
                          <TableCell className="text-center font-semibold">{c.credit_units}</TableCell>
                          <TableCell className="text-center">{c.sat ?? c.sat_count ?? 0}</TableCell>
                          <TableCell className="text-center text-green-700 font-semibold">
                            {c.passed ?? c.pass_count ?? 0}
                          </TableCell>
                          <TableCell className="text-center text-red-600 font-semibold">
                            {c.failed ?? c.fail_count ?? 0}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            <span
                              className={
                                (c.pass_percentage ?? 0) >= 70
                                  ? "text-green-700"
                                  : (c.pass_percentage ?? 0) >= 50
                                  ? "text-amber-700"
                                  : "text-red-700"
                              }
                            >
                              {c.pass_percentage ?? 0}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            {c.mean_score ?? c.average_score ?? "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  No course performance data available.
                </p>
              )}
            </TabsContent>

            {/* 2. GPA Distribution Tab */}
            <TabsContent value="gpa" className="pt-3">
              {summary.gpa_distribution?.length > 0 ? (
                <div className="border rounded-md overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Classification / Band</TableHead>
                        <TableHead className="w-32">GPA Range</TableHead>
                        <TableHead className="w-24 text-center">Count</TableHead>
                        <TableHead className="w-24 text-center">Percentage</TableHead>
                        <TableHead>Visual Distribution</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.gpa_distribution.map((band: any, idx: number) => {
                        const minVal = Number(band?.min_gpa ?? band?.min ?? 0);
                        const maxVal = Number(band?.max_gpa ?? band?.max ?? 0);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-semibold">{band.label}</TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {minVal.toFixed(2)} – {maxVal.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center font-bold">{band.count}</TableCell>
                            <TableCell className="text-center font-mono font-semibold">
                              {band.percentage}%
                            </TableCell>
                            <TableCell>
                              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                <div
                                  className="bg-primary h-2.5 rounded-full"
                                  style={{ width: `${Math.min(100, band.percentage)}%` }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  No GPA distribution data available.
                </p>
              )}
            </TabsContent>

            {/* 3. Actionable Lists Tab */}
            <TabsContent value="lists" className="pt-3 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Carryover List */}
                <div className="border rounded-md p-3 bg-card space-y-2">
                  <h5 className="font-semibold text-xs text-orange-800 flex items-center justify-between">
                    <span>Carryover Students ({summary.lists?.carryover?.length || 0})</span>
                  </h5>
                  <div className="max-h-[160px] overflow-y-auto divide-y text-xs">
                    {summary.lists?.carryover?.length > 0 ? (
                      summary.lists.carryover.map((st: any) => (
                        <div key={st.student_id} className="py-1.5 flex justify-between items-start">
                          <div>
                            <span className="font-medium">{st.full_name}</span>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {st.matric_number}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                            {st.failed_courses}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground italic text-center py-2">No carryovers</p>
                    )}
                  </div>
                </div>

                {/* Probation List */}
                <div className="border rounded-md p-3 bg-card space-y-2">
                  <h5 className="font-semibold text-xs text-amber-800 flex items-center justify-between">
                    <span>Academic Probation Students ({summary.lists?.probation?.length || 0})</span>
                  </h5>
                  <div className="max-h-[160px] overflow-y-auto divide-y text-xs">
                    {summary.lists?.probation?.length > 0 ? (
                      summary.lists.probation.map((st: any) => (
                        <div key={st.student_id} className="py-1.5 flex justify-between items-center">
                          <div>
                            <span className="font-medium">{st.full_name}</span>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {st.matric_number}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 font-bold">
                            CGPA: {st.cgpa}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground italic text-center py-2">No students on probation</p>
                    )}
                  </div>
                </div>

                {/* Withdrawal List */}
                <div className="border rounded-md p-3 bg-card space-y-2">
                  <h5 className="font-semibold text-xs text-red-800 flex items-center justify-between">
                    <span>Withdrawal Candidates ({summary.lists?.withdrawal?.length || 0})</span>
                  </h5>
                  <div className="max-h-[160px] overflow-y-auto divide-y text-xs">
                    {summary.lists?.withdrawal?.length > 0 ? (
                      summary.lists.withdrawal.map((st: any) => (
                        <div key={st.student_id} className="py-1.5 flex justify-between items-center">
                          <div>
                            <span className="font-medium">{st.full_name}</span>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {st.matric_number}
                            </div>
                          </div>
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            CGPA: {st.cgpa}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground italic text-center py-2">No withdrawal candidates</p>
                    )}
                  </div>
                </div>

                {/* Incomplete List */}
                <div className="border rounded-md p-3 bg-card space-y-2">
                  <h5 className="font-semibold text-xs text-purple-800 flex items-center justify-between">
                    <span>Incomplete Result Students ({summary.lists?.incomplete?.length || 0})</span>
                  </h5>
                  <div className="max-h-[160px] overflow-y-auto divide-y text-xs">
                    {summary.lists?.incomplete?.length > 0 ? (
                      summary.lists.incomplete.map((st: any) => (
                        <div key={st.student_id} className="py-1.5 flex justify-between items-center">
                          <div>
                            <span className="font-medium">{st.full_name}</span>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {st.matric_number}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300 font-bold">
                            {st.missing_count} missing
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground italic text-center py-2">All student scores reported</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
