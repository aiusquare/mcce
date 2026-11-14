import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface BulkProgramme {
  id: string;
  name: string;
  code: string | null;
  department_id: string;
  programme_structure?: string | null;
}

export interface BulkDepartment {
  id: string;
  name: string;
  code?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void | Promise<void>;
  programmes: BulkProgramme[];
  departments: BulkDepartment[];
}

const MAX_ROWS = 500;
const TEMPLATE_HEADERS = [
  "programme_code",
  "course_code",
  "course_title",
  "credit_units",
  "type",
  "contact_number",
  "year_number",
  "semester",
];

const normalizeStructure = (value?: string | null): "contact" | "semester" => {
  const v = String(value || "").toLowerCase();
  return v.startsWith("contact") ? "contact" : "semester";
};

const csvEscape = (value: string | number | null | undefined) => {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");

const downloadCsv = (filename: string, csv: string) => {
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

interface PreviewRow {
  rowNum: number;
  values: Record<string, string>;
  errors: string[];
}

interface ServerError {
  row: number;
  course_code?: string;
  message: string;
}

export function BulkCourseUploadDialog({
  open,
  onOpenChange,
  onSuccess,
  programmes,
  departments,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [serverErrors, setServerErrors] = useState<ServerError[]>([]);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const programmeByCode = useMemo(() => {
    const map = new Map<string, BulkProgramme>();
    programmes.forEach((p) => {
      if (p.code) map.set(p.code.trim().toLowerCase(), p);
    });
    return map;
  }, [programmes]);

  const departmentCodeById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((d) => map.set(d.id, (d.code || "").trim()));
    return map;
  }, [departments]);

  const reset = () => {
    setCsvText("");
    setFileName("");
    setServerErrors([]);
    setServerMessage(null);
    setSuccessMessage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (isUploading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const preview = useMemo(() => {
    if (!csvText.trim()) return null;

    const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^\ufeff/, ""), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"),
    });

    const headers = parsed.meta.fields || [];
    const required = ["programme_code", "course_code", "course_title", "credit_units"];
    const missingHeaders = required.filter((h) => !headers.includes(h));

    const seen = new Set<string>();
    const rows: PreviewRow[] = parsed.data.map((raw, index) => {
      const v: Record<string, string> = {};
      Object.keys(raw).forEach((k) => (v[k] = String(raw[k] ?? "").trim()));
      const errors: string[] = [];

      const programme = programmeByCode.get((v.programme_code || "").toLowerCase());
      if (!v.programme_code) errors.push("programme_code is required");
      else if (!programme) errors.push("programme_code not found");

      if (!v.course_code) errors.push("course_code is required");
      if (!v.course_title) errors.push("course_title is required");

      const units = Number(v.credit_units);
      if (!Number.isInteger(units) || units < 1 || units > 20) {
        errors.push("credit_units must be 1-20");
      }

      const type = (v.type || "core").toLowerCase();
      if (type !== "core" && type !== "elective") errors.push("type must be core or elective");

      if (programme) {
        const structure = normalizeStructure(programme.programme_structure);
        if (structure === "contact") {
          const c = Number(v.contact_number);
          if (!Number.isInteger(c) || c < 1 || c > 6) errors.push("contact_number must be 1-6");
        } else {
          const y = Number(v.year_number);
          if (!Number.isInteger(y) || y < 1 || y > 5) errors.push("year_number must be 1-5");
          const sem = (v.semester || "").toLowerCase();
          if (sem !== "first semester" && sem !== "second semester") {
            errors.push("semester must be First Semester or Second Semester");
          }
        }

        const key = `${programme.id}|${(v.course_code || "").toLowerCase()}`;
        if (v.course_code) {
          if (seen.has(key)) errors.push("duplicate course_code for this programme");
          seen.add(key);
        }
      }

      return { rowNum: index + 2, values: v, errors };
    });

    const errorRows = rows.filter((r) => r.errors.length > 0);
    return {
      rows,
      missingHeaders,
      errorRows,
      validCount: rows.length - errorRows.length,
      tooMany: rows.length > MAX_ROWS,
    };
  }, [csvText, programmeByCode]);

  const canUpload =
    !!preview &&
    preview.missingHeaders.length === 0 &&
    preview.errorRows.length === 0 &&
    preview.rows.length > 0 &&
    !preview.tooMany &&
    !isUploading;

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a .csv file");
      return;
    }
    setServerErrors([]);
    setServerMessage(null);
    setSuccessMessage(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(String(e.target?.result || ""));
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const active = programmes.filter((p) => p.code);
    const examples = (active.length ? active.slice(0, 4) : [null]).map((p, i) => {
      const structure = normalizeStructure(p?.programme_structure);
      const code = p?.code || "PROGRAMME_CODE";
      const type = i % 2 === 0 ? "core" : "elective";
      return structure === "contact"
        ? [code, `ABC${101 + i}`, "Example Course Title", 2, type, 1, "", ""]
        : [code, `ABC${101 + i}`, "Example Course Title", 2, type, "", 1, "First Semester"];
    });
    downloadCsv("bulk-courses-template.csv", toCsv([TEMPLATE_HEADERS, ...examples]));
  };

  const downloadProgrammeReference = () => {
    const rows = programmes
      .filter((p) => p.code)
      .map((p) => {
        const structure = normalizeStructure(p.programme_structure);
        return [
          p.code,
          p.name,
          departmentCodeById.get(p.department_id) || "",
          structure,
          structure === "contact" ? "contact_number: 1-6" : "year_number: 1-5 + semester",
        ];
      });
    downloadCsv(
      "programme-reference.csv",
      toCsv([["programme_code", "programme_name", "department_code", "structure", "placement_columns_to_fill"], ...rows]),
    );
  };

  const handleUpload = async () => {
    if (!canUpload) return;
    setIsUploading(true);
    setServerErrors([]);
    setServerMessage(null);
    try {
      const res: any = await api.post("/api/admin/bulk-upload-courses", { csv: csvText });
      const message = res?.message || "Courses uploaded";
      setSuccessMessage(message);
      toast.success(message);
      await onSuccess();
    } catch (err: any) {
      const body = err?.body || {};
      setServerMessage(body.message || err?.message || "Upload failed");
      setServerErrors(Array.isArray(body.errors) ? body.errors : []);
      toast.error(body.message || err?.message || "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Courses</DialogTitle>
          <DialogDescription>
            Add many courses at once from a CSV file. Nothing is saved unless every row is valid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription className="space-y-1 text-sm">
              <p>
                Required: <b>programme_code, course_code, course_title, credit_units</b>. Optional: type
                (core/elective, default core).
              </p>
              <p>
                Placement depends on the programme: <b>contact</b> programmes need{" "}
                <b>contact_number</b> (1-6); <b>semester</b> programmes need <b>year_number</b> (1-5) and{" "}
                <b>semester</b> (First Semester / Second Semester). Courses that already exist in a
                programme are skipped. Maximum {MAX_ROWS} rows.
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
            <Button variant="outline" onClick={downloadProgrammeReference}>
              <Download className="mr-2 h-4 w-4" /> Programme Codes Reference
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={isUploading}>
              <FileUp className="mr-2 h-4 w-4" /> Select File
            </Button>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <span className="text-sm text-muted-foreground">{fileName || "No file selected"}</span>
          </div>

          {successMessage && (
            <Alert className="border-primary/30 bg-primary/10">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle>Upload complete</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {serverMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{serverMessage}</AlertTitle>
              {serverErrors.length > 0 && (
                <AlertDescription>
                  <ul className="mt-2 max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
                    {serverErrors.map((e, i) => (
                      <li key={i}>
                        Row {e.row}
                        {e.course_code ? ` (${e.course_code})` : ""}: {e.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
          )}

          {preview && !successMessage && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap gap-4 text-sm font-medium">
                <span>Rows: {preview.rows.length}</span>
                <span className="text-green-600">Valid: {preview.validCount}</span>
                <span className="text-destructive">With errors: {preview.errorRows.length}</span>
              </div>

              {preview.missingHeaders.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Missing required columns</AlertTitle>
                  <AlertDescription>{preview.missingHeaders.join(", ")}</AlertDescription>
                </Alert>
              )}

              {preview.tooMany && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Too many rows</AlertTitle>
                  <AlertDescription>Split the file into batches of at most {MAX_ROWS} courses.</AlertDescription>
                </Alert>
              )}

              {preview.rows.length > 0 && (
                <div className="max-h-[320px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Programme</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Units</TableHead>
                        <TableHead>Placement</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...preview.errorRows, ...preview.rows.filter((r) => r.errors.length === 0)]
                        .slice(0, 100)
                        .map((r) => (
                          <TableRow key={r.rowNum} className={r.errors.length ? "bg-destructive/5" : ""}>
                            <TableCell>{r.rowNum}</TableCell>
                            <TableCell>{r.values.programme_code}</TableCell>
                            <TableCell className="font-mono">{r.values.course_code}</TableCell>
                            <TableCell className="max-w-[220px] truncate" title={r.values.course_title}>
                              {r.values.course_title}
                            </TableCell>
                            <TableCell>{r.values.credit_units}</TableCell>
                            <TableCell className="text-xs">
                              {r.values.contact_number
                                ? `Contact ${r.values.contact_number}`
                                : r.values.year_number
                                  ? `Year ${r.values.year_number}, ${r.values.semester}`
                                  : "-"}
                            </TableCell>
                            <TableCell>
                              {r.errors.length ? (
                                <span className="text-xs text-destructive">{r.errors.join("; ")}</span>
                              ) : (
                                <Badge variant="secondary">OK</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  {preview.rows.length > 100 && (
                    <p className="bg-muted/50 p-2 text-center text-xs text-muted-foreground">
                      Showing first 100 rows (errors listed first).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {successMessage ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isUploading}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!canUpload}>
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading ? "Uploading..." : `Upload ${preview?.validCount ?? 0} Courses`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
