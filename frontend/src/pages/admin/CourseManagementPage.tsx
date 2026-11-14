import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { BulkCourseUploadDialog } from "@/components/admin/BulkCourseUploadDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Upload,
  Edit,
  Trash2,
  BookOpen,
  Users,
  GraduationCap,
  Clock,
  Filter,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";


interface Course {
  id: string;
  offering_id?: string | null;
  code: string;
  title: string;
  department_id?: string | null;
  department_code?: string | null;
  department_name?: string | null;
  programme_id?: string | null;
  programme_code?: string | null;
  programme_name?: string | null;
  session_id?: string | null;
  semester_id?: string | null;
  department: string;
  programme: string;
  credits: number;
  level: string;
  semester: string;
  session: string;
  type: "core" | "elective";
  instructor: string;
  schedule?: string;
  status: "active" | "inactive";
}

interface Department {
  id: string;
  name: string;
  code: string | null;
}

interface ApiCourse {
  id: string;
  offering_id?: string | null;
  code: string;
  title: string;
  credit_units: number;
  level: string | null;
  type: string;
  programme_id?: string | null;
  programme_name: string | null;
  programme_code: string | null;
  department_id?: string | null;
  department_name: string | null;
  department_code: string | null;
  session_id?: string | null;
  session_name: string | null;
  semester_id?: string | null;
  semester_name: string | null;
  lecturer_name?: string | null;
  schedule?: string | null;
}

type CourseForm = {
  id?: string;
  department_id: string;
  department_name: string;
  department_code: string;
  programme_id: string;
  programme_name: string;
  programme_code: string;
  course_code: string;
  course_title: string;
  unit: string;
  session_id: string;
  session_name: string;
  semester_name: string;
  level: string;
  type: "core" | "elective";
  lecturer_name: string;
  schedule: string;
};

interface Programme {
  id: string;
  department_id: string;
  name: string;
  code: string | null;
  duration_years?: number | null;
  programme_structure?: string | null;
  is_active?: number;
}

interface Session {
  id: string;
  name: string;
}

interface Semester {
  id: string;
  name: string;
}

const DEFAULT_SEMESTERS: Semester[] = [
  { id: "sem-1", name: "First Semester" },
  { id: "sem-2", name: "Second Semester" },
  { id: "sem-3", name: "Third Semester" },
  { id: "sem-4", name: "Fourth Semester" },
  { id: "sem-5", name: "Fifth Semester" },
  { id: "sem-6", name: "Sixth Semester" },
];

type ApiListResponse<T> = { data?: T };

const EMPTY_COURSE_FORM: CourseForm = {
  department_id: "",
  department_name: "",
  department_code: "",
  programme_id: "",
  programme_name: "",
  programme_code: "",
  course_code: "",
  course_title: "",
  unit: "",
  session_id: "",
  session_name: "",
  semester_name: "",
  level: "",
  type: "core",
  lecturer_name: "",
  schedule: "",
};

export default function CourseManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [filterProgramme, setFilterProgramme] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [newCourse, setNewCourse] = useState<CourseForm>(EMPTY_COURSE_FORM);
  const [editCourse, setEditCourse] = useState<CourseForm>(EMPTY_COURSE_FORM);

  useEffect(() => {
    void loadData();
  }, []);

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.programme.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesDept = filterDepartment === "all" || course.department_id === filterDepartment;
    const matchesProg = filterProgramme === "all" || course.programme_id === filterProgramme;
    const matchesType = filterType === "all" || course.type === filterType;
    const matchesLevel = filterLevel === "all" || course.level === filterLevel || course.semester === filterLevel;
    
    return matchesSearch && matchesDept && matchesProg && matchesType && matchesLevel;
  });

    const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredCourses.length / itemsPerPage);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderPaginationItems = () => {
    const items = [];
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key="1">
          <PaginationLink onClick={() => setCurrentPage(1)} className="cursor-pointer">1</PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(<PaginationItem key="ellipsis1"><PaginationEllipsis /></PaginationItem>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink isActive={currentPage === i} onClick={() => setCurrentPage(i)} className="cursor-pointer">
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<PaginationItem key="ellipsis2"><PaginationEllipsis /></PaginationItem>);
      }
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink onClick={() => setCurrentPage(totalPages)} className="cursor-pointer">{totalPages}</PaginationLink>
        </PaginationItem>
      );
    }
    return items;
  };

  const stats = useMemo(
    () => [
      { title: "Total Courses", value: String(courses.length), icon: BookOpen },
      {
        title: "Departments",
        value: String(departments.length),
        icon: GraduationCap,
      },
      { title: "Total Enrollment", value: "-", icon: Users },
      { title: "Avg. Class Size", value: "-", icon: Clock },
    ],
    [courses.length, departments.length],
  );

  const extractData = <T,>(payload: unknown): T => {
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as ApiListResponse<T>).data as T;
    }
    return payload as T;
  };

  const mapApiCourseToCourse = (course: ApiCourse): Course => ({
    id: course.id,
    offering_id: course.offering_id || null,
    code: course.code,
    title: course.title,
    department_id: course.department_id || null,
    department_name: course.department_name || null,
    department_code: course.department_code || null,
    programme_id: course.programme_id || null,
    programme_name: course.programme_name || null,
    programme_code: course.programme_code || null,
    session_id: course.session_id || null,
    semester_id: course.semester_id || null,
    department: course.department_name || course.department_code || "-",
    programme: course.programme_name || course.programme_code || "-",
    credits: Number(course.credit_units) || 0,
    level: course.level || "-",
    semester: course.semester_name || "-",
    session: course.session_name || "-",
    type: course.type === "elective" ? "elective" : "core",
    instructor: course.lecturer_name || "-",
    schedule: course.schedule || "",
    status: "active",
  });

  const mapCourseToForm = (course: Course): CourseForm => ({
    id: course.id,
    department_id: course.department_id || "",
    department_name: course.department_name || course.department,
    department_code: course.department_code || "",
    programme_id: course.programme_id || "",
    programme_name: course.programme_name || course.programme,
    programme_code: course.programme_code || "",
    course_code: course.code,
    course_title: course.title,
    unit: String(course.credits || ""),
    session_id: course.session_id || "",
    session_name: course.session,
    semester_name: course.semester,
    level: course.level === "-" ? "" : course.level,
    type: course.type,
    lecturer_name: course.instructor === "-" ? "" : course.instructor,
    schedule: course.schedule || "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [
        coursesRes,
        departmentsRes,
        programmesRes,
        sessionsRes,
        semestersRes,
      ] = await Promise.all([
        api.get("/api/admin/get-courses"),
        api.get("/api/admin/get-departments"),
        api.get("/api/admin/get-programmes"),
        api.get("/api/admin/get-sessions"),
        api.get("/api/admin/get-semesters"),
      ]);

      const apiCourses = extractData<ApiCourse[]>(coursesRes) || [];
      const mappedCourses: Course[] = apiCourses.map(mapApiCourseToCourse);

      setCourses(mappedCourses);
      setDepartments(extractData<Department[]>(departmentsRes) || []);
      setProgrammes(extractData<Programme[]>(programmesRes) || []);
      setSessions(extractData<Session[]>(sessionsRes) || []);
      setSemesters(extractData<Semester[]>(semestersRes) || []);
    } catch (error) {
      toast.error("Failed to load courses data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCourse = async () => {
    if (!newCourse.course_code || !newCourse.course_title || !newCourse.unit) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!newCourse.department_id && !newCourse.department_name) {
      toast.error("Department is required");
      return;
    }

    if (
      !newCourse.programme_id &&
      (!newCourse.programme_name || !newCourse.programme_code)
    ) {
      toast.error("Programme name and programme code are required");
      return;
    }

    if (!newCourse.session_id) {
      toast.error("Session is required");
      return;
    }

    try {
      await api.post("/api/admin/create-course", {
        department_id: newCourse.department_id,
        department: newCourse.department_name,
        department_code: newCourse.department_code || null,
        programme_id: newCourse.programme_id || null,
        programme: newCourse.programme_name,
        programme_code: newCourse.programme_code,
        course_code: newCourse.course_code,
        course_title: newCourse.course_title,
        unit: Number(newCourse.unit),
        session_id: newCourse.session_id,
        session: newCourse.session_name,
        semester: newCourse.semester_name || "First Semester",
        level: newCourse.level || null,
        type: newCourse.type,
        lecturer_name: newCourse.lecturer_name || null,
        schedule: newCourse.schedule || null,
      });

      toast.success("Course added successfully");
      setIsAddDialogOpen(false);
      setNewCourse(EMPTY_COURSE_FORM);
      await loadData();
    } catch (error) {
      toast.error("Failed to create course");
    }
  };

  const handleViewCourse = async (courseId: string) => {
    try {
      const response = await api.get(
        `/api/admin/get-course?course_id=${encodeURIComponent(courseId)}`,
      );
      const detailed = extractData<ApiCourse>(response);
      if (detailed) {
        setSelectedCourse(mapApiCourseToCourse(detailed));
      } else {
        setSelectedCourse(
          courses.find((course) => course.id === courseId) || null,
        );
      }
      setIsViewDialogOpen(true);
    } catch (error) {
      setSelectedCourse(
        courses.find((course) => course.id === courseId) || null,
      );
      setIsViewDialogOpen(true);
      toast.error("Unable to load full course details");
    }
  };

  const handleOpenEditCourse = (course: Course) => {
    setEditCourse(mapCourseToForm(course));
    setIsEditDialogOpen(true);
  };

  const handleUpdateCourse = async () => {
    if (!editCourse.id) {
      toast.error("Invalid course selection");
      return;
    }

    if (
      !editCourse.course_code ||
      !editCourse.course_title ||
      !editCourse.unit
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!editCourse.department_id && !editCourse.department_name) {
      toast.error("Department is required");
      return;
    }

    if (
      !editCourse.programme_id &&
      (!editCourse.programme_name || !editCourse.programme_code)
    ) {
      toast.error("Programme name and programme code are required");
      return;
    }

    if (!editCourse.session_id) {
      toast.error("Session is required");
      return;
    }

    try {
      await api.post("/api/admin/update-course", {
        course_id: editCourse.id,
        department_id: editCourse.department_id,
        department: editCourse.department_name,
        department_code: editCourse.department_code || null,
        programme_id: editCourse.programme_id || null,
        programme: editCourse.programme_name,
        programme_code: editCourse.programme_code,
        course_code: editCourse.course_code,
        course_title: editCourse.course_title,
        unit: Number(editCourse.unit),
        session_id: editCourse.session_id,
        session: editCourse.session_name,
        semester: editCourse.semester_name || "First Semester",
        level: editCourse.level || null,
        type: editCourse.type,
        lecturer_name: editCourse.lecturer_name || null,
        schedule: editCourse.schedule || null,
      });

      toast.success("Course updated successfully");
      setIsEditDialogOpen(false);
      setEditCourse(EMPTY_COURSE_FORM);
      await loadData();
    } catch (error: any) {
      const message =
        error?.body?.message || error?.message || "Failed to update course";
      toast.error(message);
    }
  };

  const handleOpenDeleteCourse = (course: Course) => {
    setCourseToDelete(course);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCourse = async () => {
    if (!courseToDelete) {
      return;
    }

    try {
      await api.post("/api/admin/delete-course", {
        course_id: courseToDelete.id,
      });
      toast.success("Course deleted successfully");
      setIsDeleteDialogOpen(false);
      setCourseToDelete(null);
      await loadData();
    } catch (error: any) {
      const message =
        error?.body?.message || error?.message || "Failed to delete course";
      toast.error(message);
    }
  };

  const filteredProgrammes = useMemo(() => {
    if (!newCourse.department_id) {
      return programmes;
    }
    return programmes.filter(
      (programme) => programme.department_id === newCourse.department_id,
    );
  }, [newCourse.department_id, programmes]);

  const filteredEditProgrammes = useMemo(() => {
    if (!editCourse.department_id) {
      return programmes;
    }
    return programmes.filter(
      (programme) => programme.department_id === editCourse.department_id,
    );
  }, [editCourse.department_id, programmes]);

  const buildSemesterOptions = (programmeId: string) => {
    const selectedProgramme = programmes.find(
      (programme) => programme.id === programmeId,
    );
    const durationYears = selectedProgramme?.duration_years
      ? Number(selectedProgramme.duration_years)
      : null;
    const requiredCount = durationYears ? durationYears * 2 : null;

    const baseSemesters = semesters.length > 0 ? semesters : DEFAULT_SEMESTERS;
    const withFallback = requiredCount
      ? [
          ...baseSemesters,
          ...DEFAULT_SEMESTERS.filter(
            (fallbackSemester) =>
              !baseSemesters.some(
                (semester) => semester.name === fallbackSemester.name,
              ),
          ),
        ]
      : baseSemesters;

    return requiredCount ? withFallback.slice(0, requiredCount) : withFallback;
  };

  const semesterOptions = useMemo(() => {
    return buildSemesterOptions(newCourse.programme_id);
  }, [newCourse.programme_id, programmes, semesters]);

  const editSemesterOptions = useMemo(() => {
    return buildSemesterOptions(editCourse.programme_id);
  }, [editCourse.programme_id, programmes, semesters]);

  useEffect(() => {
    if (
      newCourse.semester_name &&
      !semesterOptions.some(
        (semester) => semester.name === newCourse.semester_name,
      )
    ) {
      setNewCourse((prev) => ({ ...prev, semester_name: "" }));
    }
  }, [newCourse.semester_name, semesterOptions]);

  useEffect(() => {
    if (
      editCourse.semester_name &&
      !editSemesterOptions.some(
        (semester) => semester.name === editCourse.semester_name,
      )
    ) {
      setEditCourse((prev) => ({ ...prev, semester_name: "" }));
    }
  }, [editCourse.semester_name, editSemesterOptions]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6">Loading courses...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">
              Course Management
            </h1>
            <p className="text-muted-foreground">
              Manage courses, departments, and curriculum
            </p>
          </div>
          <div className="flex items-center gap-2"><Button variant="outline" onClick={() => setIsBulkUploadOpen(true)} className="mr-2"><Upload className="mr-2 h-4 w-4" /> Bulk Upload</Button><Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Course</DialogTitle>
                <DialogDescription>
                  Create a new course in the curriculum
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="courseCode">Course Code *</Label>
                    <Input
                      id="courseCode"
                      placeholder="e.g., CSC101"
                      value={newCourse.course_code}
                      onChange={(e) =>
                        setNewCourse({
                          ...newCourse,
                          course_code: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="credits">Credit Units</Label>
                    <Input
                      id="credits"
                      type="number"
                      placeholder="3"
                      value={newCourse.unit}
                      onChange={(e) =>
                        setNewCourse({ ...newCourse, unit: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="courseTitle">Course Title *</Label>
                  <Input
                    id="courseTitle"
                    placeholder="e.g., Introduction to Computer Science"
                    value={newCourse.course_title}
                    onChange={(e) =>
                      setNewCourse({
                        ...newCourse,
                        course_title: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Department *</Label>
                    <Select
                      value={newCourse.department_id}
                      onValueChange={(value) => {
                        const selected = departments.find(
                          (dept) => dept.id === value,
                        );
                        setNewCourse({
                          ...newCourse,
                          department_id: value,
                          department_name: selected?.name || "",
                          department_code: selected?.code || "",
                          programme_id: "",
                          programme_name: "",
                          programme_code: "",
                          semester_name: "",
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
                    <Label>Programme *</Label>
                    <Select
                      value={newCourse.programme_id}
                      onValueChange={(value) => {
                        const selected = programmes.find(
                          (programme) => programme.id === value,
                        );
                        setNewCourse({
                          ...newCourse,
                          programme_id: value,
                          programme_name: selected?.name || "",
                          programme_code: selected?.code || "",
                          semester_name: "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select programme" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProgrammes.map((programme) => (
                          <SelectItem key={programme.id} value={programme.id}>
                            {programme.name}
                            {programme.code ? ` (${programme.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="departmentName">Department Name *</Label>
                    <Input
                      id="departmentName"
                      placeholder="e.g., Computer Science"
                      value={newCourse.department_name}
                      disabled
                      onChange={(e) =>
                        setNewCourse({
                          ...newCourse,
                          department_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="departmentCode">Department Code</Label>
                    <Input
                      id="departmentCode"
                      placeholder="e.g., CSC"
                      value={newCourse.department_code}
                      disabled
                      onChange={(e) =>
                        setNewCourse({
                          ...newCourse,
                          department_code: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="programmeCode">Programme Code *</Label>
                    <Input
                      id="programmeCode"
                      placeholder="e.g., NDCS"
                      value={newCourse.programme_code}
                      disabled
                      onChange={(e) =>
                        setNewCourse({
                          ...newCourse,
                          programme_code: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="programmeName">Programme Name *</Label>
                    <Input
                      id="programmeName"
                      placeholder="e.g., ND Computer Science"
                      value={newCourse.programme_name}
                      disabled
                      onChange={(e) =>
                        setNewCourse({
                          ...newCourse,
                          programme_name: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Level</Label>
                    <Select
                      value={newCourse.level}
                      onValueChange={(value) =>
                        setNewCourse({ ...newCourse, level: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100 Level">100 Level</SelectItem>
                        <SelectItem value="200 Level">200 Level</SelectItem>
                        <SelectItem value="300 Level">300 Level</SelectItem>
                        <SelectItem value="400 Level">400 Level</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Course Type</Label>
                    <Select
                      value={newCourse.type}
                      onValueChange={(value) =>
                        setNewCourse({
                          ...newCourse,
                          type: value as "core" | "elective",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">Core</SelectItem>
                        <SelectItem value="elective">Elective</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Session *</Label>
                    <Select
                      value={newCourse.session_id}
                      onValueChange={(value) => {
                        const selected = sessions.find(
                          (session) => session.id === value,
                        );
                        setNewCourse({
                          ...newCourse,
                          session_id: value,
                          session_name: selected?.name || "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Semester</Label>
                    <Select
                      value={newCourse.semester_name}
                      onValueChange={(value) =>
                        setNewCourse({ ...newCourse, semester_name: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {semesterOptions.map((semester) => (
                          <SelectItem key={semester.id} value={semester.name}>
                            {semester.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="instructor">Instructor</Label>
                    <Input
                      id="instructor"
                      placeholder="Instructor name"
                      value={newCourse.lecturer_name}
                      onChange={(e) =>
                        setNewCourse({
                          ...newCourse,
                          lecturer_name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="schedule">Schedule</Label>
                    <Input
                      id="schedule"
                      placeholder="e.g., Mon 10-12"
                      value={newCourse.schedule}
                      onChange={(e) =>
                        setNewCourse({ ...newCourse, schedule: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddCourse}>Add Course</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

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

        {/* Tabs */}
        <Tabs defaultValue="courses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="courses">Courses</TabsTrigger>
          </TabsList>

          <TabsContent value="courses">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <CardTitle>All Courses</CardTitle>
                    <CardDescription>
                      Manage course listings and enrollment
                    </CardDescription>
                  </div>
                                      <div className="flex flex-wrap gap-2 items-center">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search courses..."
                          className="pl-9 w-[200px]"
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        />
                      </div>
                      
                      <Select value={filterDepartment} onValueChange={(v) => { setFilterDepartment(v); setFilterProgramme("all"); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Departments" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Departments</SelectItem>
                          {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Select value={filterProgramme} onValueChange={(v) => { setFilterProgramme(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="All Programmes" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Programmes</SelectItem>
                          {programmes.filter(p => filterDepartment === "all" || p.department_id === filterDepartment).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={"h-9 " + (filterType !== "all" || filterLevel !== "all" ? "bg-primary/10 text-primary border-primary/50" : "")}>
                            <Filter className="h-4 w-4 mr-2" />
                            More Filters
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                          <div className="grid gap-4">
                            <div className="space-y-2">
                              <h4 className="font-medium leading-none">Additional Filters</h4>
                              <p className="text-sm text-muted-foreground">Refine the courses list.</p>
                            </div>
                            <div className="grid gap-2">
                              <Label>Type</Label>
                              <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Types</SelectItem>
                                  <SelectItem value="core">Core</SelectItem>
                                  <SelectItem value="elective">Elective</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Level / Semester</Label>
                              <Select value={filterLevel} onValueChange={(v) => { setFilterLevel(v); setCurrentPage(1); }}>
                                <SelectTrigger><SelectValue placeholder="All Levels" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Levels</SelectItem>
                                  <SelectItem value="First Semester">First Semester</SelectItem>
                                  <SelectItem value="Second Semester">Second Semester</SelectItem>
                                  <SelectItem value="Contact 1">Contact 1</SelectItem>
                                  <SelectItem value="Contact 2">Contact 2</SelectItem>
                                  <SelectItem value="Contact 3">Contact 3</SelectItem>
                                  <SelectItem value="Contact 4">Contact 4</SelectItem>
                                  <SelectItem value="Contact 5">Contact 5</SelectItem>
                                  <SelectItem value="Contact 6">Contact 6</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {(filterDepartment !== "all" || filterProgramme !== "all" || filterType !== "all" || filterLevel !== "all") && (
                              <Button variant="outline" size="sm" onClick={() => { setFilterDepartment("all"); setFilterProgramme("all"); setFilterType("all"); setFilterLevel("all"); setCurrentPage(1); }} className="mt-2">
                                Clear All Filters
                              </Button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Programme</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Semester</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCourses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-mono font-medium">
                            {course.code}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{course.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {course.instructor}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{course.department}</TableCell>
                          <TableCell>{course.programme}</TableCell>
                          <TableCell>{course.level}</TableCell>
                          <TableCell>{course.credits}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                course.type === "core" ? "default" : "secondary"
                              }
                            >
                              {course.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{course.session}</TableCell>
                          <TableCell>{course.semester}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                course.status === "active"
                                  ? "emerald"
                                  : "secondary"
                              }
                            >
                              {course.status}
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
                                  onClick={() =>
                                    void handleViewCourse(course.id)
                                  }
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleOpenEditCourse(course)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Course
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleOpenDeleteCourse(course)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Course
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                                      </Table>
                  </div>
                  {totalPages > 1 && (
                    <div className="py-4">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {renderPaginationItems()}
                          <PaginationItem>
                            <PaginationNext 
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Course Details</DialogTitle>
              <DialogDescription>
                Full summary of the selected course
              </DialogDescription>
            </DialogHeader>
            {selectedCourse ? (
              <div className="grid gap-3 py-2 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Code</span>
                  <span className="col-span-2 font-medium">
                    {selectedCourse.code}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Title</span>
                  <span className="col-span-2 font-medium">
                    {selectedCourse.title}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Department</span>
                  <span className="col-span-2">
                    {selectedCourse.department}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Programme</span>
                  <span className="col-span-2">{selectedCourse.programme}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Level</span>
                  <span className="col-span-2">{selectedCourse.level}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Credit Units</span>
                  <span className="col-span-2">{selectedCourse.credits}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Type</span>
                  <span className="col-span-2 capitalize">
                    {selectedCourse.type}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Session</span>
                  <span className="col-span-2">{selectedCourse.session}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Semester</span>
                  <span className="col-span-2">{selectedCourse.semester}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Instructor</span>
                  <span className="col-span-2">
                    {selectedCourse.instructor}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <span className="text-muted-foreground">Schedule</span>
                  <span className="col-span-2">
                    {selectedCourse.schedule || "-"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No course selected.
              </p>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription>
                Update the selected course details
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Course Code *</Label>
                  <Input
                    value={editCourse.course_code}
                    onChange={(e) =>
                      setEditCourse({
                        ...editCourse,
                        course_code: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Credit Units</Label>
                  <Input
                    type="number"
                    value={editCourse.unit}
                    onChange={(e) =>
                      setEditCourse({ ...editCourse, unit: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Course Title *</Label>
                <Input
                  value={editCourse.course_title}
                  onChange={(e) =>
                    setEditCourse({
                      ...editCourse,
                      course_title: e.target.value,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Department *</Label>
                  <Select
                    value={editCourse.department_id}
                    onValueChange={(value) => {
                      const selected = departments.find(
                        (dept) => dept.id === value,
                      );
                      setEditCourse({
                        ...editCourse,
                        department_id: value,
                        department_name: selected?.name || "",
                        department_code: selected?.code || "",
                        programme_id: "",
                        programme_name: "",
                        programme_code: "",
                        semester_name: "",
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
                  <Label>Programme *</Label>
                  <Select
                    value={editCourse.programme_id}
                    onValueChange={(value) => {
                      const selected = programmes.find(
                        (programme) => programme.id === value,
                      );
                      setEditCourse({
                        ...editCourse,
                        programme_id: value,
                        programme_name: selected?.name || "",
                        programme_code: selected?.code || "",
                        semester_name: "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select programme" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEditProgrammes.map((programme) => (
                        <SelectItem key={programme.id} value={programme.id}>
                          {programme.name}
                          {programme.code ? ` (${programme.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Level</Label>
                  <Select
                    value={editCourse.level}
                    onValueChange={(value) =>
                      setEditCourse({ ...editCourse, level: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100 Level">100 Level</SelectItem>
                      <SelectItem value="200 Level">200 Level</SelectItem>
                      <SelectItem value="300 Level">300 Level</SelectItem>
                      <SelectItem value="400 Level">400 Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Course Type</Label>
                  <Select
                    value={editCourse.type}
                    onValueChange={(value) =>
                      setEditCourse({
                        ...editCourse,
                        type: value as "core" | "elective",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="core">Core</SelectItem>
                      <SelectItem value="elective">Elective</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Session *</Label>
                  <Select
                    value={editCourse.session_id}
                    onValueChange={(value) => {
                      const selected = sessions.find(
                        (session) => session.id === value,
                      );
                      setEditCourse({
                        ...editCourse,
                        session_id: value,
                        session_name: selected?.name || "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Semester</Label>
                  <Select
                    value={editCourse.semester_name}
                    onValueChange={(value) =>
                      setEditCourse({ ...editCourse, semester_name: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {editSemesterOptions.map((semester) => (
                        <SelectItem key={semester.id} value={semester.name}>
                          {semester.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Instructor</Label>
                  <Input
                    value={editCourse.lecturer_name}
                    onChange={(e) =>
                      setEditCourse({
                        ...editCourse,
                        lecturer_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Schedule</Label>
                  <Input
                    value={editCourse.schedule}
                    onChange={(e) =>
                      setEditCourse({ ...editCourse, schedule: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdateCourse}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Course</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {courseToDelete?.code} -{" "}
                {courseToDelete?.title}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setCourseToDelete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  void handleDeleteCourse();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    <BulkCourseUploadDialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen} onSuccess={loadData} programmes={programmes} departments={departments} />
    </AdminLayout>
  );
}







