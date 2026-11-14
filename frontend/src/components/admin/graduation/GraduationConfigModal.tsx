import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationConfig, GraduationFramework } from "./types";
import { ShieldCheck, BookOpen, Building, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

interface GraduationConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: GraduationConfig | null;
  sessionId?: string;
  programmeId?: string;
  onSaved: (newConfig: GraduationConfig) => void;
}

export function GraduationConfigModal({
  open,
  onOpenChange,
  config,
  sessionId,
  programmeId,
  onSaved,
}: GraduationConfigModalProps) {
  const [formData, setFormData] = useState<GraduationConfig>({
    framework: "CCMAS",
    min_cgpa_ccmas: "1.50",
    min_cgpa_bmas: "1.00",
    min_tce_utme: "120",
    min_tce_de: "90",
    final_contact: "all",
    strict_zero_carryovers: "1",
    strict_zero_pending: "1",
    require_fee_clearance: "0",
    institution_name: "FEDERAL UNIVERSITY DUTSIN-MA",
    institution_address: "P.M.B. 5001 KATSINA STATE",
    affiliate_name: "MASLAHA COMMUNITY COLLEGE OF EDUCATION, FUNTUA",
    faculty_name: "FACULTY OF EDUCATION",
    signatory_hod: "Name of H.O.D",
    signatory_dean: "Name of Dean",
    signatory_vc: "Name of Vice Chancellor",
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleFrameworkChange = (fw: GraduationFramework) => {
    setFormData((prev) => ({
      ...prev,
      framework: fw,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let res: any;
      try {
        res = await api.post("/admin_graduation/save_config", {
          session_id: sessionId,
          programme_id: programmeId,
          settings: formData,
        });
      } catch (firstErr: any) {
        if (firstErr?.status === 404 || firstErr?.message?.includes("404")) {
          res = await api.post("/api/admin/graduation/config", {
            session_id: sessionId,
            programme_id: programmeId,
            settings: formData,
          });
        } else {
          throw firstErr;
        }
      }
      toast.success(res?.message || res?.data?.message || "Graduation policy saved successfully");
      const savedConfig = res?.data?.framework ? res.data : (res?.framework ? res : formData);
      onSaved(savedConfig);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Graduation Requirements & Policy Configuration
              </DialogTitle>
              <DialogDescription>
                Configure BMAS / CCMAS standards, credit thresholds, zero-deficiency rules, and document signatories.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="framework" className="w-full mt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="framework" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span>Framework & Rules</span>
            </TabsTrigger>
            <TabsTrigger value="credits" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span>TCE & Thresholds</span>
            </TabsTrigger>
            <TabsTrigger value="institution" className="gap-2">
              <Building className="h-4 w-4" />
              <span>Document & Signatures</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Framework & Clearance Rules */}
          <TabsContent value="framework" className="space-y-4 pt-3">
            <div>
              <Label className="text-sm font-semibold">Academic Policy Framework</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Decide whether to apply NUC BMAS or CCMAS graduation classifications for this session/cohort.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => handleFrameworkChange("CCMAS")}
                  className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.framework === "CCMAS"
                      ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-muted hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">CCMAS (Modern)</span>
                    {formData.framework === "CCMAS" && (
                      <span className="p-0.5 rounded-full bg-emerald-600 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Min CGPA: <strong>1.50</strong> (No Pass Degree)</li>
                    <li>• 1st Class: 4.50 – 5.00</li>
                    <li>• 2nd Class Upper: 3.50 – 4.49</li>
                    <li>• 2nd Class Lower: 2.50 – 3.49</li>
                    <li>• 3rd Class: 1.50 – 2.49</li>
                  </ul>
                </div>

                <div
                  onClick={() => handleFrameworkChange("BMAS")}
                  className={`p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.framework === "BMAS"
                      ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-muted hover:border-muted-foreground/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">BMAS (Legacy Standard)</span>
                    {formData.framework === "BMAS" && (
                      <span className="p-0.5 rounded-full bg-emerald-600 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Min CGPA: <strong>1.00</strong> (Includes Pass Degree)</li>
                    <li>• 1st Class: 4.50 – 5.00</li>
                    <li>• 2nd Class Upper: 3.50 – 4.49</li>
                    <li>• 2nd Class Lower: 2.40 – 3.49</li>
                    <li>• 3rd Class: 1.50 – 2.39</li>
                    <li>• Pass Degree: 1.00 – 1.49</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold">Strict Graduation Clearance Criteria</Label>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium">Strict Zero Outstanding Courses</Label>
                  <p className="text-xs text-muted-foreground">
                    Candidates with any unresolved failure (Grade F or ABS not cleared) are completely blocked from the graduation list.
                  </p>
                </div>
                <Switch
                  checked={formData.strict_zero_carryovers === "1"}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      strict_zero_carryovers: checked ? "1" : "0",
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium">Strict Zero Incomplete / Pending Scores</Label>
                  <p className="text-xs text-muted-foreground">
                    Candidates with registered courses that have no approved score or are marked NR (Not Reported) are blocked.
                  </p>
                </div>
                <Switch
                  checked={formData.strict_zero_pending === "1"}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      strict_zero_pending: checked ? "1" : "0",
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium">Require Fee Clearance</Label>
                  <p className="text-xs text-muted-foreground">
                    Require candidate to have no unpaid tuition/exam invoices before appearing on graduation list.
                  </p>
                </div>
                <Switch
                  checked={formData.require_fee_clearance === "1"}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      require_fee_clearance: checked ? "1" : "0",
                    }))
                  }
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: TCE & Thresholds */}
          <TabsContent value="credits" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_tce_utme">Minimum TCE for UTME (Credits)</Label>
                <Input
                  id="min_tce_utme"
                  type="number"
                  value={formData.min_tce_utme}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_tce_utme: e.target.value,
                    }))
                  }
                  placeholder="120"
                />
                <span className="text-xs text-muted-foreground">
                  Default: 120 credit units for 4-year UTME degree.
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_tce_de">Minimum TCE for Direct Entry (Credits)</Label>
                <Input
                  id="min_tce_de"
                  type="number"
                  value={formData.min_tce_de}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_tce_de: e.target.value,
                    }))
                  }
                  placeholder="90"
                />
                <span className="text-xs text-muted-foreground">
                  Default: 90 credit units for Direct Entry candidates.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_cgpa_ccmas">CCMAS Cutoff CGPA</Label>
                <Input
                  id="min_cgpa_ccmas"
                  type="number"
                  step="0.01"
                  value={formData.min_cgpa_ccmas}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_cgpa_ccmas: e.target.value,
                    }))
                  }
                  placeholder="1.50"
                />
                <span className="text-xs text-muted-foreground">
                  Minimum CGPA required to graduate under CCMAS (typically 1.50).
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_cgpa_bmas">BMAS Cutoff CGPA</Label>
                <Input
                  id="min_cgpa_bmas"
                  type="number"
                  step="0.01"
                  value={formData.min_cgpa_bmas}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_cgpa_bmas: e.target.value,
                    }))
                  }
                  placeholder="1.00"
                />
                <span className="text-xs text-muted-foreground">
                  Minimum CGPA required to graduate under BMAS (typically 1.00).
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="final_contact">Terminal Level / Contact Filter</Label>
              <Input
                id="final_contact"
                value={formData.final_contact}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    final_contact: e.target.value,
                  }))
                }
                placeholder="all (or Contact 4, Contact 6, 400)"
              />
              <span className="text-xs text-muted-foreground">
                Set to <code>all</code> to evaluate all active students, or specify a terminal period like <code>Contact 4</code> or <code>600</code>.
              </span>
            </div>
          </TabsContent>

          {/* TAB 3: Document Header & Signatures */}
          <TabsContent value="institution" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label htmlFor="institution_name">Institution Name (Top Header)</Label>
              <Input
                id="institution_name"
                value={formData.institution_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    institution_name: e.target.value,
                  }))
                }
                placeholder="FEDERAL UNIVERSITY DUTSIN-MA"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="institution_address">Institution Sub-Header / P.M.B.</Label>
                <Input
                  id="institution_address"
                  value={formData.institution_address}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      institution_address: e.target.value,
                    }))
                  }
                  placeholder="P.M.B. 5001 KATSINA STATE"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="faculty_name">Faculty / School</Label>
                <Input
                  id="faculty_name"
                  value={formData.faculty_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      faculty_name: e.target.value,
                    }))
                  }
                  placeholder="FACULTY OF EDUCATION"
                />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <Label className="text-sm font-semibold">Signatory Labels (Document Footer)</Label>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="signatory_hod" className="text-xs">Left Signatory</Label>
                  <Input
                    id="signatory_hod"
                    value={formData.signatory_hod}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        signatory_hod: e.target.value,
                      }))
                    }
                    placeholder="Name of H.O.D"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signatory_dean" className="text-xs">Middle Signatory</Label>
                  <Input
                    id="signatory_dean"
                    value={formData.signatory_dean}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        signatory_dean: e.target.value,
                      }))
                    }
                    placeholder="Name of Dean"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signatory_vc" className="text-xs">Right Signatory</Label>
                  <Input
                    id="signatory_vc"
                    value={formData.signatory_vc}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        signatory_vc: e.target.value,
                      }))
                    }
                    placeholder="Name of Vice Chancellor"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {saving ? "Saving Changes..." : "Save & Apply Policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

