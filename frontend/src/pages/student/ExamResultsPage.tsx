import { useState } from 'react';
import { StudentLayout } from '@/components/layouts/StudentLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, FileText, Trophy, TrendingUp, BookOpen, Calendar } from 'lucide-react';
import { mockStudentResults, mockSemesterGPA } from '@/components/admin/exams/mockExamData';
import { StudentResult } from '@/components/admin/exams/ExamTypes';

export default function ExamResultsPage() {
  const [selectedSession, setSelectedSession] = useState('2024/2025');
  const [selectedSemester, setSelectedSemester] = useState('all');

  const entranceResults = mockStudentResults.filter(r => 
    r.examType === 'entrance' || r.examType === 'post_utme'
  );

  const semesterResults = mockStudentResults.filter(r => {
    const matchesSemester = selectedSemester === 'all' || r.semester === selectedSemester;
    const matchesSession = r.academicSession === selectedSession;
    return r.examType === 'semester' && matchesSemester && matchesSession;
  });

  const currentGPA = mockSemesterGPA[0];

  const getGradeBadge = (grade: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-green-500 text-white',
      'B': 'bg-blue-500 text-white',
      'C': 'bg-yellow-500 text-white',
      'D': 'bg-orange-500 text-white',
      'E': 'bg-red-400 text-white',
      'F': 'bg-red-600 text-white',
    };
    return <Badge className={colors[grade] || ''}>{grade}</Badge>;
  };

  const calculateCGPA = () => {
    if (mockSemesterGPA.length === 0) return 0;
    const totalPoints = mockSemesterGPA.reduce((acc, sem) => acc + sem.totalGradePoints, 0);
    const totalUnits = mockSemesterGPA.reduce((acc, sem) => acc + sem.totalCreditUnits, 0);
    return totalUnits > 0 ? (totalPoints / totalUnits).toFixed(2) : '0.00';
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">My Results</h1>
            <p className="text-muted-foreground">
              View your exam results and academic performance
            </p>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Transcript
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current GPA</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentGPA?.gpa.toFixed(2) || '0.00'}</div>
              <p className="text-xs text-muted-foreground">
                {currentGPA?.semester} Semester {currentGPA?.academicSession}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CGPA</CardTitle>
              <Trophy className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateCGPA()}</div>
              <p className="text-xs text-muted-foreground">Cumulative GPA</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credit Units</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentGPA?.totalCreditUnits || 0}</div>
              <p className="text-xs text-muted-foreground">This semester</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Courses</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{semesterResults.length}</div>
              <p className="text-xs text-muted-foreground">Results published</p>
            </CardContent>
          </Card>
        </div>

        {/* Results Tabs */}
        <Tabs defaultValue="semester" className="space-y-6">
          <TabsList>
            <TabsTrigger value="semester" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Semester Results
            </TabsTrigger>
            <TabsTrigger value="entrance" className="gap-2">
              <FileText className="h-4 w-4" />
              Entrance/Post-UTME
            </TabsTrigger>
          </TabsList>

          {/* Semester Results Tab */}
          <TabsContent value="semester" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024/2025">2024/2025</SelectItem>
                  <SelectItem value="2023/2024">2023/2024</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  <SelectItem value="First">First Semester</SelectItem>
                  <SelectItem value="Second">Second Semester</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* GPA Summary Card */}
            {currentGPA && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {currentGPA.semester} Semester {currentGPA.academicSession}
                  </CardTitle>
                  <CardDescription>Semester Performance Summary</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Credit Units</p>
                      <p className="text-xl font-bold">{currentGPA.totalCreditUnits}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Grade Points</p>
                      <p className="text-xl font-bold">{currentGPA.totalGradePoints}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">GPA</p>
                      <p className="text-xl font-bold text-primary">{currentGPA.gpa.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Classification</p>
                      <p className="text-xl font-bold">
                        {currentGPA.gpa >= 4.5 ? 'First Class' :
                         currentGPA.gpa >= 3.5 ? 'Second Class Upper' :
                         currentGPA.gpa >= 2.5 ? 'Second Class Lower' :
                         currentGPA.gpa >= 1.5 ? 'Third Class' : 'Pass'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results Table */}
            <Card>
              <CardHeader>
                <CardTitle>Course Results</CardTitle>
                <CardDescription>Your semester examination results</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course Code</TableHead>
                      <TableHead>Course Title</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Grade Point</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {semesterResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.courseCode}</TableCell>
                        <TableCell>{result.courseName}</TableCell>
                        <TableCell>{result.score}/{result.totalMarks}</TableCell>
                        <TableCell>{getGradeBadge(result.grade)}</TableCell>
                        <TableCell>{result.gradePoint.toFixed(1)}</TableCell>
                        <TableCell>
                          <span className={result.remarks === 'Fail' ? 'text-destructive' : 'text-green-600'}>
                            {result.remarks}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {semesterResults.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No semester results available yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Entrance/Post-UTME Results Tab */}
          <TabsContent value="entrance" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {entranceResults.map((result) => (
                <Card key={result.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{result.examTitle}</CardTitle>
                        <CardDescription>
                          Published: {result.publishedAt}
                        </CardDescription>
                      </div>
                      {getGradeBadge(result.grade)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Score</p>
                        <p className="text-2xl font-bold">{result.score}/{result.totalMarks}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Percentage</p>
                        <p className="text-2xl font-bold">
                          {((result.score / result.totalMarks) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-sm font-medium">Remarks: {result.remarks}</p>
                    </div>
                    <Button variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download Result Slip
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {entranceResults.length === 0 && (
                <Card className="col-span-2">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No entrance/Post-UTME results available yet
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </StudentLayout>
  );
}
