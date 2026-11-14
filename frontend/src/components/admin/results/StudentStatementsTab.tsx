import { useState, useEffect } from "react";
import { Loader2, Printer, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ChevronsUpDown } from "lucide-react";
import { StatementPrintDocument } from "./StatementPrintDocument";
import { generateWordStatement } from "./statementWordExport";

export function StudentStatementsTab() {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  
  // Combobox state
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [student, setStudent] = useState<any>(null);
  const [statementData, setStatementData] = useState<any>(null);

  // Scope controls
  const [scope, setScope] = useState<"contact" | "session" | "full">("full");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/api/admin/students?search=" + encodeURIComponent(searchQuery));
        setSearchResults(Array.isArray(res.data) ? res.data : (res.data?.items || []));
      } catch (error) {
        console.error("Search error", error);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectStudent = (selectedStudent: any) => {
    setStudent(selectedStudent);
    setOpen(false);
    // Reset scope
    setScope("full");
    loadStatement(selectedStudent.id, "full");
  };

  const loadStatement = async (student_id: string, currentScope: string = scope, sessId: string = selectedSessionId, contId: string = selectedContactId) => {
    if (!student_id) return;
    setLoading(true);
    try {
      let url = "/api/admin/results/statement?student_id=" + student_id + "&scope=" + currentScope;
      if (currentScope === "session" && sessId) url += "&session_id=" + sessId;
      if (currentScope === "contact" && sessId && contId) url += "&session_id=" + sessId + "&semester_id=" + contId;
      
      const res = await api.get(url);
      setStatementData(res.data);
    } catch (error) {
      toast.error("Failed to load academic statement");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadStatement = () => {
    if (student) {
      loadStatement(student.id);
    }
  };

  // Derive available sessions and contacts from the FULL history if we have it
  // Actually, we can fetch all sessions or just use the periods returned from statementData
  // For simplicity, if we don't have global sessions loaded, we'll just extract from periods.
  const uniqueSessions = statementData?.academic_periods?.reduce((acc: any[], p: any) => {
    if (!acc.find(s => s.id === p.session_id)) acc.push({ id: p.session_id, name: p.session });
    return acc;
  }, []) || [];

  const uniqueContacts = statementData?.academic_periods
    ?.filter((p: any) => p.session_id === selectedSessionId)
    .reduce((acc: any[], p: any) => {
      if (!acc.find(c => c.id === p.contact_id)) acc.push({ id: p.contact_id, name: p.contact });
      return acc;
    }, []) || [];

  const handlePrint = () => {
    window.print();
  };

  const handleWordExport = async () => {
    if (!statementData) return;
    try {
      await generateWordStatement(statementData);
      toast.success("Word document generated successfully");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate Word document");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-2 max-w-lg">
            <label className="text-sm font-medium">Search Student</label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal text-left h-auto py-2">
                  {student ? (
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">{student.first_name} {student.last_name}</span>
                      <span className="text-xs text-muted-foreground">{student.matric_number || student.admission_number || '-'}</span>
                    </div>
                  ) : "Search by Matric Number, Admission Number or Name..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] sm:w-[500px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Type to search..." value={searchQuery} onValueChange={setSearchQuery} />
                  <CommandList>
                    <CommandEmpty>{searching ? "Searching..." : "No student found."}</CommandEmpty>
                    {searchResults.length > 0 && (
                      <CommandGroup heading="Results">
                        {searchResults.map((s) => (
                          <CommandItem key={s.id} value={s.id} onSelect={() => selectStudent(s)} className="flex flex-col items-start gap-1 py-2 cursor-pointer">
                            <div className="flex items-center w-full justify-between">
                              <span className="font-semibold">{s.first_name} {s.last_name}</span>
                              <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{s.matric_number || s.admission_number || '-'}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{s.programme_name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center p-12"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" /></div>}

      {student && statementData && !loading && (
        <>
          {/* Academic Profile Header */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="space-y-4 flex-1">
                  <div>
                    <h2 className="text-2xl font-bold uppercase">{statementData.student.student_name}</h2>
                    <div className="text-lg font-semibold text-primary/80 mt-1">
                      {statementData.student.matric_number || statementData.student.admission_number || 'N/A'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Programme:</span>
                      <span className="font-medium text-right">{statementData.student.programme}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Department:</span>
                      <span className="font-medium text-right">{statementData.student.department}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Current Level:</span>
                      <span className="font-medium">{statementData.student.current_level}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Academic Status:</span>
                      <span className="font-medium capitalize">{statementData.student.student_status}</span>
                    </div>
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-muted-foreground">Academic Standing:</span>
                      <span className="font-medium">{statementData.student.academic_standing}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-background rounded-xl p-6 shadow-sm border min-w-[200px] text-center">
                  <div className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-2">Current CGPA</div>
                  <div className="text-5xl font-black text-primary">
                    {statementData.academic_periods?.length > 0 ? statementData.current_cgpa?.toFixed(2) : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scope Controls */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col space-y-4">
                <div className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">Statement Scope</div>
                <RadioGroup 
                  value={scope} 
                  onValueChange={(val: any) => setScope(val)} 
                  className="flex flex-col sm:flex-row gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="contact" id="r1" />
                    <Label htmlFor="r1">Single Contact</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="session" id="r2" />
                    <Label htmlFor="r2">Session</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="r3" />
                    <Label htmlFor="r3">Full Academic History</Label>
                  </div>
                </RadioGroup>

                <div className="flex flex-wrap items-end gap-4 mt-4 pt-4 border-t">
                  {(scope === "session" || scope === "contact") && (
                    <div className="space-y-1">
                      <Label>Session</Label>
                      <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Session" /></SelectTrigger>
                        <SelectContent>
                          {uniqueSessions.map((s: any) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {scope === "contact" && (
                    <div className="space-y-1">
                      <Label>Contact</Label>
                      <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Contact" /></SelectTrigger>
                        <SelectContent>
                          {uniqueContacts.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {(scope !== "full") && (
                    <Button onClick={handleLoadStatement}>Load Statement</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statement Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
            <Button variant="outline" onClick={handlePrint}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
            <Button variant="outline" onClick={handleWordExport}><Download className="mr-2 h-4 w-4" /> Word</Button>
          </div>

          <StatementPrintDocument statementData={statementData} />

          {/* Statement Display */}
          <div className="space-y-8">
            {statementData.academic_periods?.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 border rounded-lg bg-muted/5">
                No approved or published academic results are available for the selected scope.
              </div>
            ) : (
              statementData.academic_periods.map((period: any, i: number) => (
                <Card key={i} className="overflow-hidden border-2">
                  <div className="bg-muted px-6 py-4 border-b flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">{period.session} — {period.contact}</h3>
                      <div className="text-sm text-muted-foreground">Level: {period.level}</div>
                    </div>
                    <div className="text-sm font-semibold uppercase px-3 py-1 bg-background rounded border">
                      {period.batch_status === 'published' ? 'Published' : 'Approved - Not Published'}
                    </div>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Course Code</TableHead>
                        <TableHead className="font-bold">Course Title</TableHead>
                        <TableHead className="text-center font-bold">CU</TableHead>
                        <TableHead className="text-center font-bold">Score</TableHead>
                        <TableHead className="text-center font-bold">Grade</TableHead>
                        <TableHead className="text-center font-bold">GP</TableHead>
                        <TableHead className="text-center font-bold">QP</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {period.courses.map((c: any) => (
                        <TableRow key={c.course_id}>
                          <TableCell className="font-semibold">{c.course_code}</TableCell>
                          <TableCell>{c.course_title}</TableCell>
                          <TableCell className="text-center">{c.credit_unit}</TableCell>
                          <TableCell className="text-center">{c.status === 'missing' ? 'NR' : c.score}</TableCell>
                          <TableCell className="text-center font-bold">{c.status === 'missing' ? '—' : c.grade}</TableCell>
                          <TableCell className="text-center">{c.status === 'missing' ? '—' : c.grade_point}</TableCell>
                          <TableCell className="text-center">{c.status === 'missing' ? '—' : c.quality_point}</TableCell>
                          <TableCell>
                            <span className={`capitalize px-2 py-0.5 rounded text-xs font-semibold ${c.status === 'missing' ? 'bg-orange-100 text-orange-800' : c.grade === 'F' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                              {c.status === 'missing' ? 'Missing' : c.grade === 'F' ? 'Carryover' : 'Passed'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="bg-muted/20 p-6 border-t grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Registered Credits</div>
                      <div className="text-xl font-bold">{period.registered_credits}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Earned Credits</div>
                      <div className="text-xl font-bold">{period.earned_credits}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Grade Points</div>
                      <div className="text-xl font-bold">{period.quality_points}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Contact GPA</div>
                      <div className="text-xl font-bold text-primary">{period.gpa?.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Previous CGPA</div>
                      <div className="text-xl font-bold">{period.previous_cgpa?.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Current CGPA</div>
                      <div className="text-xl font-bold text-primary">{period.current_cgpa?.toFixed(2)}</div>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Outstanding Courses</div>
                      <div className="text-sm font-medium mt-1 text-red-600">
                        {period.outstanding_courses.length > 0 ? period.outstanding_courses.join(", ") : "None"}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
