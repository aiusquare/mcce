import { useState, useEffect } from "react";
import { Loader2, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function GpaCgpaTab() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadCgpas();
  }, []);

  const loadCgpas = async () => {
    try {
      const res = await api.get("/api/admin/results/cgpa-list");
      setStudents(res.data || []);
    } catch (error) {
      toast.error("Failed to load CGPA list");
    } finally {
      setLoading(false);
    }
  };

  const getClassOfDegree = (cgpa: number) => {
    if (cgpa >= 4.5) return "First Class";
    if (cgpa >= 3.5) return "Second Class Upper";
    if (cgpa >= 2.4) return "Second Class Lower";
    if (cgpa >= 1.5) return "Third Class";
    return "Pass";
  };

  const filtered = students.filter(s => 
    s.matric_number?.toLowerCase().includes(search.toLowerCase()) || 
    s.admission_number?.toLowerCase().includes(search.toLowerCase()) || 
    s.last_name?.toLowerCase().includes(search.toLowerCase()) || 
    s.first_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search students..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            Calculating institution-wide CGPAs...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matric No.</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead className="text-center">CGPA</TableHead>
                <TableHead>Class</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(student => (
                <TableRow key={student.student_id}>
                  <TableCell className="font-medium">{student.matric_number}</TableCell>
                  <TableCell>{student.last_name}, {student.first_name} {student.middle_name}</TableCell>
                  <TableCell className="text-muted-foreground">{student.programme_name}</TableCell>
                  <TableCell className="text-center font-bold text-lg">{student.cgpa?.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={student.cgpa >= 3.5 ? 'default' : student.cgpa < 1.5 ? 'destructive' : 'secondary'}>
                      {getClassOfDegree(student.cgpa)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

