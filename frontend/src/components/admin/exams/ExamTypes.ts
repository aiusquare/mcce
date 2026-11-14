export type ExamType = 'entrance' | 'post_utme' | 'semester';
export type ExamStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
export type ResultStatus = 'pending' | 'published' | 'withheld';

export interface Exam {
  id: string;
  title: string;
  type: ExamType;
  academicSession: string;
  semester?: string;
  courseCode?: string;
  courseName?: string;
  department?: string;
  faculty?: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  totalMarks: number;
  passMarks: number;
  status: ExamStatus;
  registeredStudents: number;
  createdAt: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  examType: ExamType;
  studentId: string;
  studentName: string;
  matricNumber: string;
  department: string;
  score: number;
  totalMarks: number;
  grade: string;
  gradePoint: number;
  remarks: string;
  status: ResultStatus;
  publishedAt?: string;
}

export interface StudentResult {
  id: string;
  examTitle: string;
  examType: ExamType;
  courseCode?: string;
  courseName?: string;
  academicSession: string;
  semester?: string;
  score: number;
  totalMarks: number;
  grade: string;
  gradePoint: number;
  remarks: string;
  publishedAt: string;
}

export interface SemesterGPA {
  semester: string;
  academicSession: string;
  totalCreditUnits: number;
  totalGradePoints: number;
  gpa: number;
  courses: StudentResult[];
}

export const gradeScale = [
  { min: 70, max: 100, grade: 'A', point: 5.0, remarks: 'Excellent' },
  { min: 60, max: 69, grade: 'B', point: 4.0, remarks: 'Very Good' },
  { min: 50, max: 59, grade: 'C', point: 3.0, remarks: 'Good' },
  { min: 45, max: 49, grade: 'D', point: 2.0, remarks: 'Pass' },
  { min: 40, max: 44, grade: 'E', point: 1.0, remarks: 'Poor Pass' },
  { min: 0, max: 39, grade: 'F', point: 0.0, remarks: 'Fail' },
];

export function calculateGrade(score: number, totalMarks: number): { grade: string; point: number; remarks: string } {
  const percentage = (score / totalMarks) * 100;
  const gradeInfo = gradeScale.find(g => percentage >= g.min && percentage <= g.max);
  return gradeInfo || { grade: 'F', point: 0.0, remarks: 'Fail' };
}
