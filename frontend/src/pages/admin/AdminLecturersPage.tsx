import { BookOpen, CheckCircle2, FileText, GraduationCap } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
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

const lecturerAccessAreas = [
  {
    area: "Assigned Courses",
    access: "View course lists and assigned course offerings",
    status: "Ready",
    icon: BookOpen,
  },
  {
    area: "Exam Scores",
    access: "Submit and review scores for assigned courses",
    status: "Controlled",
    icon: FileText,
  },
  {
    area: "Student Lists",
    access: "View registered students per assigned course",
    status: "Ready",
    icon: GraduationCap,
  },
];

export default function AdminLecturersPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold md:text-3xl">
            Lecturer Access
          </h1>
          <p className="text-muted-foreground">
            Manage the pages and academic tools available to lecturer accounts.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {lecturerAccessAreas.map((item) => (
            <Card key={item.area} className="card-elevated">
              <CardContent className="p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="font-semibold">{item.area}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.access}
                </p>
                <Badge variant="outline" className="mt-4">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {item.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lecturer Page Access</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Permission Scope</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lecturerAccessAreas.map((item) => (
                  <TableRow key={item.area}>
                    <TableCell className="font-medium">{item.area}</TableCell>
                    <TableCell>{item.access}</TableCell>
                    <TableCell>
                      <Badge variant="success">{item.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
