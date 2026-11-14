import { useState, useEffect } from "react";
import { Loader2, Settings2, Plus, Edit, Trash2, Sliders } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function ResultConfigurationTab() {
  const [loading, setLoading] = useState(true);
  const [scheme, setScheme] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("Standard NCE/Degree Grading");
  const [editRanges, setEditRanges] = useState<any[]>([]);

  // Assessment Structure configuration state
  const [assessmentStructure, setAssessmentStructure] = useState<{
    max_ca: number;
    max_exam: number;
    max_total: number;
  }>({ max_ca: 30, max_exam: 70, max_total: 100 });
  const [isEditingStructure, setIsEditingStructure] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [editMaxCa, setEditMaxCa] = useState<number | string>(30);
  const [editMaxExam, setEditMaxExam] = useState<number | string>(70);
  const [editMaxTotal, setEditMaxTotal] = useState<number | string>(100);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const [schemeRes, structRes]: any[] = await Promise.all([
        api.get("/api/admin/results/configuration/grading-scheme").catch(() => null),
        api.get("/api/admin/results/configuration/assessment-structure").catch(() => null),
      ]);
      if (schemeRes?.data) {
        setScheme(schemeRes.data);
      } else if (schemeRes?.ranges) {
        setScheme(schemeRes);
      }

      if (structRes?.data) {
        setAssessmentStructure(structRes.data);
      } else if (structRes?.max_ca !== undefined) {
        setAssessmentStructure(structRes);
      }
    } catch (error) {
      toast.error("Failed to load result configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleEditStructure = () => {
    setEditMaxCa(assessmentStructure.max_ca);
    setEditMaxExam(assessmentStructure.max_exam);
    setEditMaxTotal(assessmentStructure.max_total);
    setIsEditingStructure(true);
  };

  const handleSaveStructure = async () => {
    const ca = parseFloat(String(editMaxCa));
    const exam = parseFloat(String(editMaxExam));
    const total = parseFloat(String(editMaxTotal));

    if (isNaN(ca) || isNaN(exam) || isNaN(total)) {
      toast.error("Please enter valid numeric score limits");
      return;
    }

    if (ca < 0 || exam < 0 || total <= 0) {
      toast.error("Scores must be positive numbers");
      return;
    }

    if (Math.round((ca + exam) * 100) / 100 !== Math.round(total * 100) / 100) {
      toast.error(`Max CA (${ca}) + Max Exam (${exam}) must equal Total Limit (${total})`);
      return;
    }

    setSavingStructure(true);
    try {
      const res: any = await api.post("/api/admin/results/configuration/assessment-structure/save", {
        max_ca: ca,
        max_exam: exam,
        max_total: total,
      });
      toast.success(res?.message || "Assessment structure saved successfully");
      setAssessmentStructure({ max_ca: ca, max_exam: exam, max_total: total });
      setIsEditingStructure(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save assessment structure");
    } finally {
      setSavingStructure(false);
    }
  };

  const handleEdit = () => {
    if (scheme) {
      setEditName(scheme.name);
      setEditRanges(scheme.ranges.map((r: any) => ({ ...r })));
    } else {
      setEditName("Standard Grading Scheme");
      setEditRanges([
        { id: '1', min_score: 70, max_score: 100, letter_grade: 'A', grade_point: 5, remark: 'Excellent' },
        { id: '2', min_score: 60, max_score: 69, letter_grade: 'B', grade_point: 4, remark: 'Very Good' },
        { id: '3', min_score: 50, max_score: 59, letter_grade: 'C', grade_point: 3, remark: 'Good' },
        { id: '4', min_score: 45, max_score: 49, letter_grade: 'D', grade_point: 2, remark: 'Pass' },
        { id: '5', min_score: 40, max_score: 44, letter_grade: 'E', grade_point: 1, remark: 'Poor' },
        { id: '6', min_score: 0, max_score: 39, letter_grade: 'F', grade_point: 0, remark: 'Fail' },
      ]);
    }
    setIsEditing(true);
  };

  const updateRange = (index: number, field: string, value: any) => {
    const newRanges = [...editRanges];
    newRanges[index][field] = value;
    setEditRanges(newRanges);
  };

  const addRange = () => {
    setEditRanges([...editRanges, { id: Date.now().toString(), min_score: 0, max_score: 0, letter_grade: '', grade_point: 0, remark: '' }]);
  };

  const removeRange = (index: number) => {
    setEditRanges(editRanges.filter((_, i) => i !== index));
  };

  const saveScheme = async () => {
    setSaving(true);
    try {
      await api.post("/api/admin/results/configuration/grading-scheme/save", {
        name: editName,
        ranges: editRanges
      });
      toast.success("Grading scheme updated successfully");
      setIsEditing(false);
      loadConfig();
    } catch (error) {
      toast.error("Failed to save grading scheme");
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setSaving(true);
      await api.post("/api/admin/results/configuration/grading-scheme/recalculate", {});
      toast.success("All institutional grades recalculated successfully!");
    } catch (error) {
      toast.error("Failed to recalculate grades");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> Active Grading Scheme
            </CardTitle>
            <CardDescription>
              This scale is currently used across the institution for grading and GPA calculations.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {scheme && (
              <Button onClick={handleRecalculate} variant="secondary" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Recalculate Past Grades
              </Button>
            )}
            <Button onClick={handleEdit} variant={scheme ? "outline" : "default"}>
              {scheme ? <><Edit className="w-4 h-4 mr-2" /> Edit Scheme</> : <><Plus className="w-4 h-4 mr-2" /> Create Scheme</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : scheme ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-semibold text-lg">{scheme.name}</span>
                <Badge>Active</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score Range</TableHead>
                    <TableHead className="text-center">Letter Grade</TableHead>
                    <TableHead className="text-center">Grade Point</TableHead>
                    <TableHead>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheme.ranges?.map((range: any) => (
                    <TableRow key={range.id}>
                      <TableCell className="font-medium">{range.min_score} - {range.max_score}</TableCell>
                      <TableCell className="text-center font-bold text-lg">{range.letter_grade}</TableCell>
                      <TableCell className="text-center">{range.grade_point}</TableCell>
                      <TableCell className="text-muted-foreground">{range.remark || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
              No active grading scheme configured. Please set one up in the database.
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5" /> Assessment Structure
            </CardTitle>
            <CardDescription>Institution-wide score limits for Continuous Assessment and Examinations.</CardDescription>
          </div>
          <Button onClick={handleEditStructure} variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" /> Configure Limits
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg bg-muted/20 text-center">
              <div className="text-sm text-muted-foreground mb-1">Max CA Score</div>
              <div className="text-3xl font-bold text-primary">{assessmentStructure.max_ca}</div>
              <div className="text-xs text-muted-foreground mt-1">Continuous Assessment</div>
            </div>
            <div className="p-4 border rounded-lg bg-muted/20 text-center">
              <div className="text-sm text-muted-foreground mb-1">Max Exam Score</div>
              <div className="text-3xl font-bold text-primary">{assessmentStructure.max_exam}</div>
              <div className="text-xs text-muted-foreground mt-1">End of Semester Exam</div>
            </div>
            <div className="p-4 border rounded-lg bg-muted/20 text-center">
              <div className="text-sm text-muted-foreground mb-1">Total Limit</div>
              <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{assessmentStructure.max_total}</div>
              <div className="text-xs text-muted-foreground mt-1">Maximum 100% Scale</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditingStructure} onOpenChange={setIsEditingStructure}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Assessment Structure</DialogTitle>
            <DialogDescription>
              Set the institutional maximum limits for Continuous Assessment (CA) and Semester Examination.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Presets:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setEditMaxCa(30);
                  setEditMaxExam(70);
                  setEditMaxTotal(100);
                }}
              >
                30 CA / 70 Exam
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setEditMaxCa(40);
                  setEditMaxExam(60);
                  setEditMaxTotal(100);
                }}
              >
                40 CA / 60 Exam
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_ca">Max CA Score</Label>
                <Input
                  id="max_ca"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={editMaxCa}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditMaxCa(val);
                    const nVal = parseFloat(val);
                    if (!isNaN(nVal)) {
                      const examVal = parseFloat(String(editMaxExam)) || 0;
                      setEditMaxTotal(nVal + examVal);
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_exam">Max Exam Score</Label>
                <Input
                  id="max_exam"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={editMaxExam}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditMaxExam(val);
                    const nVal = parseFloat(val);
                    if (!isNaN(nVal)) {
                      const caVal = parseFloat(String(editMaxCa)) || 0;
                      setEditMaxTotal(caVal + nVal);
                    }
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_total">Total Maximum Score</Label>
              <Input
                id="max_total"
                type="number"
                min={1}
                max={200}
                step="any"
                value={editMaxTotal}
                onChange={(e) => setEditMaxTotal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sum of CA ({Number(editMaxCa) || 0}) and Exam ({Number(editMaxExam) || 0}) is{" "}
                <span
                  className={
                    Number(editMaxCa) + Number(editMaxExam) === Number(editMaxTotal)
                      ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "text-destructive font-semibold"
                  }
                >
                  {Number(editMaxCa) + Number(editMaxExam)}
                </span>
                {Number(editMaxCa) + Number(editMaxExam) !== Number(editMaxTotal) && (
                  <span className="text-destructive ml-1">(Must equal Total Limit)</span>
                )}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingStructure(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveStructure} disabled={savingStructure}>
              {savingStructure && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Limits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Configure Grading Scheme</DialogTitle>
            <DialogDescription>Define the score ranges and corresponding letter grades.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Scheme Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Min Score</TableHead>
                    <TableHead>Max Score</TableHead>
                    <TableHead>Letter Grade</TableHead>
                    <TableHead>Grade Point</TableHead>
                    <TableHead>Remark</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editRanges.map((range, index) => (
                    <TableRow key={range.id || index}>
                      <TableCell className="p-2"><Input type="number" value={range.min_score} onChange={(e) => updateRange(index, 'min_score', e.target.value)} className="w-20" /></TableCell>
                      <TableCell className="p-2"><Input type="number" value={range.max_score} onChange={(e) => updateRange(index, 'max_score', e.target.value)} className="w-20" /></TableCell>
                      <TableCell className="p-2"><Input value={range.letter_grade} onChange={(e) => updateRange(index, 'letter_grade', e.target.value)} className="w-20 uppercase" maxLength={2} /></TableCell>
                      <TableCell className="p-2"><Input type="number" value={range.grade_point} onChange={(e) => updateRange(index, 'grade_point', e.target.value)} className="w-20" step="0.1" /></TableCell>
                      <TableCell className="p-2"><Input value={range.remark} onChange={(e) => updateRange(index, 'remark', e.target.value)} /></TableCell>
                      <TableCell className="p-2">
                        <Button variant="ghost" size="icon" onClick={() => removeRange(index)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-2 bg-muted/20 border-t">
                <Button variant="outline" size="sm" onClick={addRange} className="w-full"><Plus className="w-4 h-4 mr-2" /> Add Range</Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={saveScheme} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Scheme</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

