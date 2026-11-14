import { useState, useRef } from "react";
import { Upload, X, FileCheck, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Props {
  templateData: { matric_number: string; full_name?: string }[];
  courseCode?: string;
  sessionName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (importedData: { matric_number: string; ca_score: string; exam_score: string }[]) => void;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function ImportResultsCsvDialog({
  open,
  onOpenChange,
  onImport,
  templateData,
  courseCode,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== "text/csv" && !selected.name.endsWith(".csv")) {
        toast.error("Please select a valid CSV file");
        return;
      }
      setFile(selected);
    }
  };

  const downloadTemplate = () => {
    const safeCourse = (courseCode || "").trim();
    const headers = "Course Code,Matric Number,Student Name,CA Score,Exam Score\n";
    let rows = "";
    if (templateData && templateData.length > 0) {
      rows = templateData
        .map((s) => {
          const safeName = String(s.full_name || "").replace(/"/g, '""');
          return `${safeCourse},${s.matric_number || ""},"${safeName}",,`;
        })
        .join("\n");
    } else {
      rows = `${safeCourse || "COURSE101"},MAC/2026/001,"Example Student",,`;
    }
    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filenamePrefix = safeCourse ? `${safeCourse}_` : "";
    link.setAttribute("download", `${filenamePrefix}Result_Import_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processCsv = () => {
    if (!file) return;
    
    setProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = (e.target?.result as string) || "";
        const lines = text.split(/\r?\n/);
        
        if (lines.length < 2) {
          throw new Error("CSV file is empty or missing headers");
        }

        const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
        const courseIdx = headers.findIndex(
          (h) => h === "course code" || h === "course_code" || h === "course",
        );
        const matricIdx = headers.findIndex(
          (h) => h.includes("matric") || h.includes("reg no") || h === "student id",
        );
        const caIdx = headers.findIndex(
          (h) => h === "ca" || h === "ca_score" || h === "ca score",
        );
        const examIdx = headers.findIndex(
          (h) => h === "exam" || h === "exam_score" || h === "exam score",
        );

        if (matricIdx === -1) throw new Error("Could not find Matriculation Number column");
        if (caIdx === -1 && examIdx === -1) throw new Error("Could not find CA or Exam score columns");

        const expectedCourse = (courseCode || "").trim().toUpperCase();
        const parsedData = [];

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = parseCsvLine(lines[i]);
          if (courseIdx !== -1 && expectedCourse) {
            const rowCourse = (values[courseIdx] || "").trim().toUpperCase();
            if (rowCourse && rowCourse !== expectedCourse) {
              throw new Error(
                `Course code mismatch on row ${i + 1}: CSV belongs to "${rowCourse}", but you are importing into "${expectedCourse}".`,
              );
            }
          }

          const matric_number = values[matricIdx];
          
          if (matric_number) {
            parsedData.push({
              matric_number,
              ca_score: caIdx !== -1 ? (values[caIdx] ?? "") : "",
              exam_score: examIdx !== -1 ? (values[examIdx] ?? "") : "",
            });
          }
        }

        onImport(parsedData);
        toast.success("Successfully parsed " + parsedData.length + " records");
        onOpenChange(false);
        setFile(null);
      } catch (error: any) {
        toast.error(error.message || "Failed to parse CSV file");
      } finally {
        setProcessing(false);
      }
    };
    
    reader.onerror = () => {
      toast.error("Failed to read file");
      setProcessing(false);
    };
    
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Import Results CSV {courseCode ? `— ${courseCode}` : ""}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file containing student scores for{" "}
            <strong>{courseCode || "this course"}</strong>. Required columns:
            Matric Number, CA Score, Exam Score.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {!file ? (
            <div 
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Click to browse or drag and drop a CSV file here
              </p>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <FileCheck className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className="mt-4 text-xs text-muted-foreground">
            <div className="flex items-center justify-between mb-2">
              <strong>Format Example:</strong>
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-7 text-xs">
                <Download className="mr-2 h-3 w-3" /> Download Template
              </Button>
            </div>
            <pre className="bg-muted p-2 rounded">
              Course Code, Matric Number, Student Name, CA Score, Exam Score<br/>
              {courseCode || "COURSE101"}, MAC/2026/001, &quot;Example Student&quot;, 25, 60<br/>
              {courseCode || "COURSE101"}, MAC/2026/002, &quot;Second Student&quot;, 18, 45
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={processCsv} disabled={!file || processing}>
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



