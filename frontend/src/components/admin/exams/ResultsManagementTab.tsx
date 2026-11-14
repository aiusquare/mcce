import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Search,
  Upload,
  Download,
  Send,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ExamResult, calculateGrade } from "./ExamTypes";
import { mockExamResults, mockExams, departments } from "./mockExamData";

export function ResultsManagementTab() {
  const [results, setResults] = useState<ExamResult[]>(mockExamResults);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterExam, setFilterExam] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<ExamResult | null>(null);
  const [formData, setFormData] = useState({
    examId: "",
    studentId: "",
    studentName: "",
    matricNumber: "",
    department: "",
    score: 0,
    totalMarks: 100,
  });

  const filteredResults = results.filter((result) => {
    const matchesSearch =
      result.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.matricNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesExam = filterExam === "all" || result.examId === filterExam;
    const matchesStatus =
      filterStatus === "all" || result.status === filterStatus;
    return matchesSearch && matchesExam && matchesStatus;
  });

  const handleOpenDialog = (result?: ExamResult) => {
    if (result) {
      setEditingResult(result);
      setFormData({
        examId: result.examId,
        studentId: result.studentId,
        studentName: result.studentName,
        matricNumber: result.matricNumber,
        department: result.department,
        score: result.score,
        totalMarks: result.totalMarks,
      });
    } else {
      setEditingResult(null);
      setFormData({
        examId: "",
        studentId: "",
        studentName: "",
        matricNumber: "",
        department: "",
        score: 0,
        totalMarks: 100,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.studentName || !formData.matricNumber || !formData.examId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const exam = mockExams.find((e) => e.id === formData.examId);
    const gradeInfo = calculateGrade(formData.score, formData.totalMarks);

    if (editingResult) {
      setResults(
        results.map((r) =>
          r.id === editingResult.id
            ? {
                ...r,
                ...formData,
                examTitle: exam?.title || r.examTitle,
                examType: exam?.type || r.examType,
                grade: gradeInfo.grade,
                gradePoint: gradeInfo.point,
                remarks: gradeInfo.remarks,
              }
            : r,
        ),
      );
      toast.success("Result updated successfully");
    } else {
      const newResult: ExamResult = {
        id: Date.now().toString(),
        ...formData,
        examTitle: exam?.title || "",
        examType: exam?.type || "semester",
        grade: gradeInfo.grade,
        gradePoint: gradeInfo.point,
        remarks: gradeInfo.remarks,
        status: "pending",
      };
      setResults([...results, newResult]);
      toast.success("Result added successfully");
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setResults(results.filter((r) => r.id !== id));
    toast.success("Result deleted successfully");
  };

  const handlePublish = (id: string) => {
    setResults(
      results.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "published" as const,
              publishedAt: new Date().toISOString().split("T")[0],
            }
          : r,
      ),
    );
    toast.success("Result published successfully");
  };

  const handleBulkPublish = () => {
    const pendingResults = results.filter((r) => r.status === "pending");
    if (pendingResults.length === 0) {
      toast.info("No pending results to publish");
      return;
    }

    setResults(
      results.map((r) =>
        r.status === "pending"
          ? {
              ...r,
              status: "published" as const,
              publishedAt: new Date().toISOString().split("T")[0],
            }
          : r,
      ),
    );
    toast.success(`${pendingResults.length} results published successfully`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      pending: "outline",
      published: "default",
      withheld: "destructive",
    };
    const colors: Record<string, string> = {
      pending: "",
      published: "bg-green-500",
      withheld: "",
    };
    return (
      <Badge variant={variants[status] || "default"} className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const getGradeBadge = (grade: string) => {
    const colors: Record<string, string> = {
      A: "bg-green-500 text-white",
      B: "bg-blue-500 text-white",
      C: "bg-yellow-500 text-white",
      D: "bg-orange-500 text-white",
      E: "bg-red-400 text-white",
      F: "bg-red-600 text-white",
    };
    return <Badge className={colors[grade] || ""}>{grade}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {results.filter((r) => r.status === "published").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <XCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {results.filter((r) => r.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Withheld</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {results.filter((r) => r.status === "withheld").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search, Filters and Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or matric..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Select value={filterExam} onValueChange={setFilterExam}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by exam" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exams</SelectItem>
              {mockExams.map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="withheld">Withheld</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="secondary" onClick={handleBulkPublish}>
            <Send className="mr-2 h-4 w-4" />
            Publish All Pending
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Result
          </Button>
        </div>
      </div>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Exam</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResults.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{result.studentName}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.matricNumber}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate">
                      {result.examTitle}
                    </div>
                  </TableCell>
                  <TableCell>{result.department}</TableCell>
                  <TableCell>
                    {result.score}/{result.totalMarks}
                  </TableCell>
                  <TableCell>{getGradeBadge(result.grade)}</TableCell>
                  <TableCell>{result.remarks}</TableCell>
                  <TableCell>{getStatusBadge(result.status)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {result.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handlePublish(result.id)}
                          title="Publish"
                        >
                          <Send className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenDialog(result)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(result.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredResults.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No results found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Result Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingResult ? "Edit Result" : "Add New Result"}
            </DialogTitle>
            <DialogDescription>
              {editingResult
                ? "Update the student result details."
                : "Enter the student result details below."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Exam *</Label>
              <Select
                value={formData.examId}
                onValueChange={(value) => {
                  const exam = mockExams.find((e) => e.id === value);
                  setFormData({
                    ...formData,
                    examId: value,
                    totalMarks: exam?.totalMarks || 100,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exam" />
                </SelectTrigger>
                <SelectContent>
                  {mockExams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="studentId">Student ID *</Label>
                <Input
                  id="studentId"
                  value={formData.studentId}
                  onChange={(e) =>
                    setFormData({ ...formData, studentId: e.target.value })
                  }
                  placeholder="e.g., STD001"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="matricNumber">Matric Number *</Label>
                <Input
                  id="matricNumber"
                  value={formData.matricNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, matricNumber: e.target.value })
                  }
                  placeholder="e.g., MCCE/2024/001234"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="studentName">Student Name *</Label>
              <Input
                id="studentName"
                value={formData.studentName}
                onChange={(e) =>
                  setFormData({ ...formData, studentName: e.target.value })
                }
                placeholder="Full name"
              />
            </div>
            <div className="grid gap-2">
              <Label>Department</Label>
              <Select
                value={formData.department}
                onValueChange={(value) =>
                  setFormData({ ...formData, department: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="score">Score *</Label>
                <Input
                  id="score"
                  type="number"
                  value={formData.score}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      score: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  max={formData.totalMarks}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="totalMarks">Total Marks</Label>
                <Input
                  id="totalMarks"
                  type="number"
                  value={formData.totalMarks}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      totalMarks: parseInt(e.target.value) || 100,
                    })
                  }
                  disabled
                />
              </div>
            </div>
            {formData.score > 0 && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  Calculated Grade:{" "}
                  <strong>
                    {calculateGrade(formData.score, formData.totalMarks).grade}
                  </strong>
                  {" - "}
                  {calculateGrade(formData.score, formData.totalMarks).remarks}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingResult ? "Update Result" : "Add Result"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
