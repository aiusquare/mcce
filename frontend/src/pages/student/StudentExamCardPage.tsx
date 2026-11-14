import { useMemo } from "react";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Download, FileText, AlertCircle } from "lucide-react";
import { schoolConfig } from "@/config/schoolConfig";

const REGISTERED_COURSES_KEY = "mccas_registered_courses";
const LEGACY_REGISTERED_COURSES_KEY = "MCCAS_registered_courses";

type RegisteredCourse = {
  id: string;
  code: string;
  title: string;
  creditUnits: number;
  lecturer: string;
  schedule: string;
};

type RegistrationPayload = {
  student: {
    matricNumber: string;
    name: string;
    programme: string;
    level: string;
    session: string;
    semester: string;
  };
  courses: RegisteredCourse[];
  totalCredits: number;
  submittedAt: string;
};

const loadRegistration = (): RegistrationPayload | null => {
  const stored =
    localStorage.getItem(REGISTERED_COURSES_KEY) ||
    localStorage.getItem(LEGACY_REGISTERED_COURSES_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as RegistrationPayload;
  } catch {
    return null;
  }
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-NG", { dateStyle: "long" });

export default function StudentExamCardPage() {
  const registration = useMemo(() => loadRegistration(), []);
  const hasCourses = Boolean(registration?.courses?.length);

  const handleDownloadExamCard = () => {
    if (!registration) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups to print the exam card.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Exam Card - ${registration.student.matricNumber}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; color: #0f172a; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #006837; padding-bottom: 20px; }
            .header h1 { color: #006837; font-size: 24px; margin: 0 0 10px 0; text-transform: uppercase; }
            .header p { margin: 0; font-size: 14px; font-weight: bold; color: #64748b; }
            .title { text-align: center; font-size: 20px; font-weight: bold; margin: 30px 0; text-decoration: underline; text-transform: uppercase; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 40px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .details div { font-size: 15px; }
            .details strong { color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
            .instructions { margin-bottom: 50px; font-size: 14px; border-left: 3px solid #006837; padding-left: 15px; }
            .instructions h3 { margin-top: 0; font-size: 15px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .sign-box { text-align: center; width: 250px; }
            .sign-line { border-top: 1px solid #000; margin-bottom: 8px; }
            .meta { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 40px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${schoolConfig.name.full}</h1>
            <p>${schoolConfig.documents.examCardHeader}</p>
          </div>
          
          <div class="title">OFFICIAL EXAMINATION CARD</div>
          
          <div class="details">
            <div><strong>Student Name:</strong> ${registration.student.name}</div>
            <div><strong>Matriculation No:</strong> ${registration.student.matricNumber}</div>
            <div><strong>Programme:</strong> ${registration.student.programme}</div>
            <div><strong>Level:</strong> ${registration.student.level}</div>
            <div><strong>Session:</strong> ${registration.student.session}</div>
            <div><strong>Semester:</strong> ${registration.student.semester}</div>
            <div><strong>Registration Date:</strong> ${formatDate(registration.submittedAt)}</div>
            <div><strong>Total Credits:</strong> ${registration.totalCredits}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">S/N</th>
                <th style="width: 120px;">Course Code</th>
                <th>Course Title</th>
                <th style="width: 80px;">Units</th>
                <th style="width: 150px;">Invigilator Sign</th>
              </tr>
            </thead>
            <tbody>
              ${registration.courses
                .map(
                  (course, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${course.code}</strong></td>
                  <td>${course.title}</td>
                  <td>${course.creditUnits}</td>
                  <td></td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          <div class="instructions">
            <h3>Instructions to Candidates:</h3>
            <ol>
              <li>This exam card must be presented at the examination hall.</li>
              <li>No candidate will be admitted without a valid student ID card.</li>
              <li>Programmable calculators and cellular phones are strictly prohibited.</li>
              <li>Do not write anything on this card during the examination.</li>
            </ol>
          </div>

          <div class="signatures">
            <div class="sign-box">
              <div class="sign-line"></div>
              <strong>${schoolConfig.documents.examOfficerSignatureLabel || "Examination Officer"}</strong>
              <div>${schoolConfig.name.short}</div>
            </div>
            <div class="sign-box">
              <div class="sign-line"></div>
              <strong>Student Signature & Date</strong>
            </div>
          </div>

          <div class="meta">${schoolConfig.documents.verificationNotice}</div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exam Card</h1>
          <p className="text-muted-foreground">
            Download your examination admission card based on your approved
            registered courses.
          </p>
        </div>

        {!hasCourses && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-start gap-3 p-6">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">
                  No registered courses found
                </p>
                <p className="text-sm text-amber-700">
                  Submit your course registration to generate your examination
                  card.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {hasCourses && registration && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1 card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif">
                  <FileText className="h-5 w-5 text-secondary" />
                  Student Details
                </CardTitle>
                <CardDescription>Registration summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Student Name</p>
                  <p className="font-semibold">{registration.student.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Matric Number</p>
                  <p className="font-mono font-semibold">
                    {registration.student.matricNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Programme</p>
                  <p className="font-semibold">
                    {registration.student.programme}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Level</p>
                  <p className="font-semibold">{registration.student.level}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Session</p>
                  <p className="font-semibold">
                    {registration.student.session}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Semester</p>
                  <p className="font-semibold">
                    {registration.student.semester}
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Registered Credits
                  </span>
                  <Badge variant="emerald">
                    {registration.totalCredits} units
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Registered
                  </span>
                  <span className="text-sm font-medium">
                    {formatDate(registration.submittedAt)}
                  </span>
                </div>
                <Button
                  variant="portal"
                  className="w-full"
                  onClick={handleDownloadExamCard}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Exam Card
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-serif">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Registered Courses
                </CardTitle>
                <CardDescription>
                  Courses submitted during semester registration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Course Title</TableHead>
                        <TableHead className="text-center">Units</TableHead>
                        <TableHead className="hidden md:table-cell">
                          Lecturer
                        </TableHead>
                        <TableHead className="hidden lg:table-cell">
                          Schedule
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registration.courses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-mono font-medium">
                            {course.code}
                          </TableCell>
                          <TableCell>{course.title}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              {course.creditUnits}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
                            {course.lecturer}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                            {course.schedule}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
