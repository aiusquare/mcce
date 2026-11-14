import React from "react";
import { Loader2, Search, Filter, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { allowedContactChoices, ContactEntryEligibility } from "./contactEligibility";

interface BroadsheetFiltersProps {
  sessions: any[];
  departments: any[];
  programmes: any[];
  formData: {
    session_id: string;
    cohort?: string;
    department_id: string;
    semester_id: string;
    programme_id: string;
    level: string;
    entry_mode: string;
    standing: string;
    basis: string;
    search: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  contactEligibility: ContactEntryEligibility | null;
  onGenerate: () => void;
  loading: boolean;
}

export function BroadsheetFilters({
  sessions,
  departments,
  programmes,
  formData,
  setFormData,
  contactEligibility,
  onGenerate,
  loading,
}: BroadsheetFiltersProps) {
  const filteredProgrammes =
    formData.department_id === "all"
      ? programmes
      : programmes.filter((p) => p.department_id === formData.department_id);

  const selectedProgramme = programmes.find((p) => p.id === formData.programme_id);
  const progStructure = selectedProgramme?.programme_structure || "semester";
  const levelLabel = progStructure === "semester" ? "Semester *" : "Contact *";
  const contactChoices = allowedContactChoices(sessions, formData.session_id);

  return (
    <Card className="print:hidden border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6 items-end">
          {/* Academic Session */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Academic Session <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.session_id}
              onValueChange={(v) =>
                setFormData({ ...formData, session_id: v, semester_id: "all", entry_mode: "all" })
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Department</Label>
            <Select
              value={formData.department_id}
              onValueChange={(v) =>
                setFormData({
                  ...formData,
                  department_id: v,
                  programme_id: "all",
                  semester_id: "all",
                })
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Departments
                </SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Programme */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Programme <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.programme_id}
              onValueChange={(v) =>
                setFormData({ ...formData, programme_id: v, semester_id: "all" })
              }
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select programme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Select Programme
                </SelectItem>
                {filteredProgrammes.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Semester / Contact */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{levelLabel}</Label>
            <Select
              value={formData.semester_id}
              onValueChange={(v) => setFormData({ ...formData, semester_id: v })}
              disabled={!formData.programme_id || formData.programme_id === "all"}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={`Select ${progStructure}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  Select {progStructure}
                </SelectItem>
                {progStructure === "semester" ? (
                  <>
                    <SelectItem value="First Semester" className="text-xs">
                      First Semester
                    </SelectItem>
                    <SelectItem value="Second Semester" className="text-xs">
                      Second Semester
                    </SelectItem>
                  </>
                ) : contactChoices ? (
                  contactChoices.map((contact) => (
                    <SelectItem key={contact.number} value={`Contact ${contact.number}`} className="text-xs">
                      {contact.label}
                    </SelectItem>
                  ))
                ) : (
                  [1, 2, 3, 4, 5, 6].map((contact) => (
                    <SelectItem key={contact} value={`Contact ${contact}`} className="text-xs">
                      Contact {contact}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Result Basis (Official vs Working) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Basis / Mode</Label>
            <Select
              value={formData.basis}
              onValueChange={(v) => setFormData({ ...formData, basis: v })}
            >
              <SelectTrigger className="h-9 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published" className="text-xs font-medium">
                  Official (Published)
                </SelectItem>
                <SelectItem value="working" className="text-xs font-medium text-amber-700">
                  Working Copy (Drafts)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <div className="space-y-1.5">
            <Button
              onClick={onGenerate}
              disabled={loading}
              className="w-full h-9 text-xs font-semibold shadow-sm"
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="mr-1.5 h-3.5 w-3.5" />
              )}
              Generate Broadsheet
            </Button>
          </div>
        </div>

        {/* Secondary Filter Bar: Mode of Entry, Standing Filter, Search */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-slate-600">Filters:</span>
            </div>

            {/* Mode of Entry */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Entry:</span>
              <Select
                value={contactEligibility?.entryMode || formData.entry_mode}
                onValueChange={(v) => setFormData({ ...formData, entry_mode: v })}
                disabled={Boolean(contactEligibility?.entryMode)}
              >
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Modes
                  </SelectItem>
                  <SelectItem value="fresh" className="text-xs">
                    {contactEligibility?.entryMode === "fresh"
                      ? `Fresh only (Contact ${contactEligibility.freshContact})`
                      : "Fresh"}
                  </SelectItem>
                  <SelectItem value="direct_entry" className="text-xs">
                    {contactEligibility?.entryMode === "direct_entry"
                      ? `Direct Entry only (Contact ${contactEligibility.directEntryContact})`
                      : "Direct Entry (DE)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Student Admission Cohort */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Cohort:</span>
              <Select
                value={formData.cohort || "all"}
                onValueChange={(v) => setFormData({ ...formData, cohort: v })}
              >
                <SelectTrigger className="h-8 text-xs w-[145px] font-medium border-blue-200 bg-blue-50/50 text-blue-900">
                  <GraduationCap className="h-3 w-3 mr-1 text-blue-600 shrink-0" />
                  <SelectValue placeholder="All Cohorts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Cohorts
                  </SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.name || s.id} className="text-xs">
                      {s.name || s.id} Set
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Academic Standing */}
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Standing:</span>
              <Select
                value={formData.standing}
                onValueChange={(v) => setFormData({ ...formData, standing: v })}
              >
                <SelectTrigger className="h-8 text-xs w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Standings
                  </SelectItem>
                  <SelectItem value="PASS" className="text-xs text-green-700">
                    Clean Pass
                  </SelectItem>
                  <SelectItem value="CO" className="text-xs text-orange-700">
                    Carryover (CO)
                  </SelectItem>
                  <SelectItem value="PROBATION" className="text-xs text-amber-700">
                    Probation (1.00–1.49)
                  </SelectItem>
                  <SelectItem value="WITHDRAWAL" className="text-xs text-red-700">
                    Withdrawal (&lt; 1.00)
                  </SelectItem>
                  <SelectItem value="INCOMPLETE" className="text-xs text-purple-700">
                    Incomplete Scores
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search box */}
          <div className="w-full sm:w-64">
            <Input
              type="text"
              placeholder="Filter by name or matric..."
              value={formData.search}
              onChange={(e) => setFormData({ ...formData, search: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
