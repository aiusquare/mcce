import { useState, useEffect, useMemo } from "react";
import { BookOpen, Plus, Download, Upload, Search, CheckCircle2, Clock, AlertCircle, FileEdit, Eye, Trash2, CheckSquare, ShieldCheck, ChevronLeft, ChevronRight, Calendar, GraduationCap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateResultBatchDialog } from "./CreateResultBatchDialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ResultBatchDetail } from "./ResultBatchDetail";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function ResultsTab() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  
  const [filterSession, setFilterSession] = useState("all");
  const [filterCohort, setFilterCohort] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterProgramme, setFilterProgramme] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/admin/results/batches");
      setBatches(res.data || []);
    } catch (error) {
      toast.error("Failed to load result batches");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredBatches.map(b => b.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectOne = (batchId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, batchId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== batchId));
    }
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    const confirmMsg = `Are you sure you want to change the status of ${selectedIds.length} batch(es) to "${status.toUpperCase()}"?`;
    if (!window.confirm(confirmMsg)) return;

    setBulkUpdating(true);
    try {
      const res = await api.post("/api/admin/results/batches/update-status", {
        batch_ids: selectedIds,
        status: status,
      }) as any;
      if (res?.status === "success" || res?.data?.status === "success") {
        toast.success(res.message || `Successfully updated ${selectedIds.length} batch(es) to ${status}`);
        setSelectedIds([]);
        loadBatches();
      } else {
        toast.error(res?.message || "Failed to update batch statuses");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Error performing bulk status update");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm("Are you sure you want to delete this batch? All scores entered for this batch will be permanently removed.")) {
      return;
    }
    try {
      await api.delete(`/api/admin/results/batch?batch_id=${batchId}`);
      toast.success("Batch deleted successfully");
      loadBatches();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete batch");
    }
  };

  const filteredBatches = batches.filter(b => {
    const matchesSearch = b.course_code?.toLowerCase().includes(search.toLowerCase()) || 
                          b.course_title?.toLowerCase().includes(search.toLowerCase());
    const academicSessionName = b.academic_session_name || b.session_name;
    const matchesSession = filterSession === "all" || academicSessionName === filterSession;
    const cohortSessionName = b.cohort_session_name || "2021/2022";
    const matchesCohort = filterCohort === "all" || cohortSessionName === filterCohort;
    const matchesSemester = filterSemester === "all" || b.semester_name === filterSemester;
    const matchesStatus = filterStatus === "all" || b.status === filterStatus;
    const matchesDept = filterDepartment === "all" || b.department_name === filterDepartment;
    const matchesProg = filterProgramme === "all" || b.programme_name === filterProgramme;
    
    return matchesSearch && matchesSession && matchesCohort && matchesSemester && matchesStatus && matchesDept && matchesProg;
  });

  const uniqueSessions = Array.from(
    new Set(batches.map(b => b.academic_session_name || b.session_name)),
  ).filter(Boolean).sort();
  const uniqueCohorts = Array.from(
    new Set(batches.map(b => b.cohort_session_name || "2021/2022")),
  ).filter(Boolean).sort();
  const uniqueSemesters = Array.from(new Set(batches.map(b => b.semester_name))).filter(Boolean).sort();
  const uniqueStatuses = Array.from(new Set(batches.map(b => b.status))).filter(Boolean).sort();
  const uniqueDepartments = Array.from(new Set(batches.map(b => b.department_name))).filter(Boolean).sort();
  const uniqueProgrammes = Array.from(new Set(batches.map(b => b.programme_name))).filter(Boolean).sort();

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterSession, filterCohort, filterSemester, filterStatus, filterDepartment, filterProgramme]);

  const totalPages = Math.ceil(filteredBatches.length / pageSize) || 1;
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBatches.slice(start, start + pageSize);
  }, [filteredBatches, currentPage, pageSize]);

  if (selectedBatch) {
    return (
      <ErrorBoundary
        fallbackTitle="Unable to Load Result Batch Details"
        onBack={() => {
          setSelectedBatch(null);
          loadBatches();
        }}
        onReset={() => {
          setSelectedBatch({ ...selectedBatch });
        }}
      >
        <ResultBatchDetail 
          batch={selectedBatch} 
          onBack={() => {
            setSelectedBatch(null);
            loadBatches();
          }} 
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batches.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batches.filter(b => b.status === 'approved' || b.status === 'published').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batches.filter(b => b.status === 'draft' || b.status === 'submitted').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Withheld</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batches.filter(b => b.status === 'withheld').length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by course..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          {/* Filter 1: Academic Session Envelope */}
          <Select value={filterSession} onValueChange={setFilterSession}>
            <SelectTrigger className="w-[170px] h-9 text-xs font-medium border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 shadow-sm">
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
              <SelectValue placeholder="Academic Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Academic Sessions</SelectItem>
              {uniqueSessions.map((s) => (
                <SelectItem key={s as string} value={s as string}>Session: {s as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter 2: Entry Cohort */}
          <Select value={filterCohort} onValueChange={setFilterCohort}>
            <SelectTrigger className="w-[160px] h-9 text-xs font-medium border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100 shadow-sm">
              <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-blue-600 shrink-0" />
              <SelectValue placeholder="Entry Cohort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cohorts</SelectItem>
              {uniqueCohorts.map((s) => (
                <SelectItem key={s as string} value={s as string}>{s as string} Set</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSemester} onValueChange={setFilterSemester}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {uniqueSemesters.map((s) => (
                <SelectItem key={s as string} value={s as string}>{s as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {uniqueStatuses.map((s) => (
                <SelectItem key={s as string} value={s as string}>{s as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {uniqueDepartments.map((s) => (
                <SelectItem key={s as string} value={s as string}>{s as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterProgramme} onValueChange={setFilterProgramme}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Programme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programmes</SelectItem>
              {uniqueProgrammes.map((s) => (
                <SelectItem key={s as string} value={s as string}>{s as string}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Results
          </Button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/80 border rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              <strong className="text-primary">{selectedIds.length}</strong> of {filteredBatches.length} batch(es) selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus("submitted")}
            >
              Submit Selected
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus("approved")}
            >
              <ShieldCheck className="mr-1.5 h-4 w-4 text-emerald-600" />
              Approve Selected
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={bulkUpdating}
              onClick={() => handleBulkStatus("published")}
            >
              Publish Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No result batches found. Click "Add Results" to create one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={
                      filteredBatches.length > 0 &&
                      selectedIds.length === filteredBatches.length
                    }
                    onCheckedChange={(checked) => handleToggleSelectAll(checked === true)}
                    aria-label="Select all batches"
                  />
                </TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Academic Session</TableHead>
                <TableHead>Entry Cohort</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBatches.map(batch => (
                <TableRow key={batch.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(batch.id)}
                      onCheckedChange={(checked) => handleToggleSelectOne(batch.id, checked === true)}
                      aria-label={`Select batch ${batch.course_code}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {batch.course_code}
                    <div className="text-xs text-muted-foreground">{batch.course_title}</div>
                  </TableCell>
                  <TableCell>
                    {batch.academic_session_name ? (
                      <Badge variant="outline" className="text-xs font-mono font-medium text-emerald-800 bg-emerald-50/80 border-emerald-200">
                        <Calendar className="w-3 h-3 mr-1 inline text-emerald-600" />
                        {batch.academic_session_name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Unmapped</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-mono font-medium text-blue-800 bg-blue-50/80 border-blue-200">
                      <GraduationCap className="w-3 h-3 mr-1 inline text-blue-600" />
                      {batch.cohort_session_name || "2021/2022"} Set
                    </Badge>
                  </TableCell>
                  <TableCell>{batch.semester_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{batch.department_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{batch.programme_name}</TableCell>
                  <TableCell>
                    <Badge variant={batch.status === 'published' ? 'default' : batch.status === 'approved' ? 'secondary' : 'outline'}>
                      {batch.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 items-center">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedBatch(batch)}>
                        {batch.status === 'draft' || batch.status === 'submitted' ? (
                          <><FileEdit className="mr-2 h-4 w-4" /> Enter Scores</>
                        ) : (
                          <><Eye className="mr-2 h-4 w-4" /> View</>
                        )}
                      </Button>
                      {(batch.status === 'draft' || batch.status === 'returned') && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteBatch(batch.id)} title="Delete Batch">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!loading && filteredBatches.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Showing <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredBatches.length)}</strong> to <strong>{Math.min(currentPage * pageSize, filteredBatches.length)}</strong> of <strong>{filteredBatches.length}</strong> batches
              </span>
              <span className="text-muted-foreground/60">•</span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-8 rounded border border-input bg-background px-2 text-xs"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CreateResultBatchDialog 
        open={createOpen} 
        onOpenChange={setCreateOpen}
        onSuccess={(b) => {
          loadBatches();
          setSelectedBatch(b); // Auto-open the new batch
        }}
      />
    </div>
  );
}
