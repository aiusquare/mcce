import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import api from "@/lib/api";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Users, User } from "lucide-react";

interface CarryoverSyncTabProps {
  session: string;
  semester: string;
}

export function CarryoverSyncTab({ session, semester }: CarryoverSyncTabProps) {
  const [activeTab, setActiveTab] = useState("individual");

  // Individual State
  const [studentId, setStudentId] = useState("");
  
  // Bulk State
  const [programmeId, setProgrammeId] = useState("");
  const [entrySession, setEntrySession] = useState("");
  const [level, setLevel] = useState("");
  
  const [previewData, setPreviewData] = useState<any>(null);

  const queryClient = useQueryClient();

  // Load Sessions
  const { data: sessions } = useQuery({
    queryKey: ["admin-sessions-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-sessions");
      return res.data || [];
    },
  });

  // Fetch Programmes from existing API for Bulk Sync
  const { data: programmes } = useQuery({
    queryKey: ["admin-programmes-list"],
    queryFn: async () => {
      const res = await api.get("/api/admin/get-programmes");
      return res.data || [];
    },
  });

  // Calculate available levels based on selected programme
  const selectedProgramme = programmes?.find((p: any) => p.id === programmeId);
  const availableLevels = React.useMemo(() => {
    if (!selectedProgramme) return [];

    const isContact = selectedProgramme.programme_structure === "contact";
    const maxYears = isContact ? 6 : (selectedProgramme.duration_years || 4);

    return Array.from({ length: maxYears }).map((_, i) => {
      if (isContact) {
        return `Contact ${i + 1}`;
      }
      return `${(i + 1) * 100}`;
    });
  }, [selectedProgramme]);

  // Preview Mutation (Individual)
  const individualPreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/admin_carryover_sync/preview", {
        student_id: studentId,
        session_id: session,
        semester_id: semester,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      toast.success("Individual preview generated");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to generate preview");
    },
  });

  // Commit Mutation (Individual)
  const individualCommitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/admin_carryover_sync/commit", {
        student_id: studentId,
        session_id: session,
        semester_id: semester,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success("Carryover sync completed successfully");
      setPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to execute sync");
    },
  });

  // Preview Mutation (Bulk)
  const bulkPreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/admin_carryover_sync/bulk_preview", {
        programme_id: programmeId,
        entry_session: entrySession,
        level: level,
        session_id: session,
        semester_id: semester,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      toast.success("Bulk preview generated");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to generate bulk preview");
    },
  });

  // Commit Mutation (Bulk)
  const bulkCommitMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/admin_carryover_sync/bulk_commit", {
        programme_id: programmeId,
        entry_session: entrySession,
        level: level,
        session_id: session,
        semester_id: semester,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Bulk sync completed for ${data?.students_processed || 0} students`);
      setPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ["course-registrations"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to execute bulk sync");
    },
  });

  const handlePreview = () => {
    setPreviewData(null);
    if (!session || !semester) {
      toast.error("Please select a target session and semester at the top of the page");
      return;
    }
    
    if (activeTab === "individual") {
      if (!studentId) {
        toast.error("Please enter a student ID");
        return;
      }
      individualPreviewMutation.mutate();
    } else {
      if (!programmeId || !entrySession || !level) {
        toast.error("Please fill in all bulk targeting fields");
        return;
      }
      bulkPreviewMutation.mutate();
    }
  };

  const handleCommit = () => {
    if (activeTab === "individual") {
      individualCommitMutation.mutate();
    } else {
      bulkCommitMutation.mutate();
    }
  };

  const isPendingPreview = individualPreviewMutation.isPending || bulkPreviewMutation.isPending;
  const isPendingCommit = individualCommitMutation.isPending || bulkCommitMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Carryover Registration Sync</CardTitle>
          <CardDescription>
            Automatically resolve and synchronize outstanding previous failures into the target academic period ({session} - {semester}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={(val) => {
            setActiveTab(val);
            setPreviewData(null);
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual"><User className="w-4 h-4 mr-2" /> Individual Sync</TabsTrigger>
              <TabsTrigger value="bulk"><Users className="w-4 h-4 mr-2" /> Bulk Sync</TabsTrigger>
            </TabsList>
            
            <div className="mt-6">
              <TabsContent value="individual" className="mt-0">
                <div className="space-y-2">
                  <Label>Student ID (UUID)</Label>
                  <Input
                    placeholder="Enter Student UUID..."
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="bulk" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Target Entry Session</Label>
                    <Select value={entrySession} onValueChange={setEntrySession}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Entry Session" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions?.map((s: any) => (
                          <SelectItem key={`entry-${s.id}`} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Programme</Label>
                    <Select value={programmeId} onValueChange={setProgrammeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Programme" />
                      </SelectTrigger>
                      <SelectContent>
                        {programmes?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select value={level} onValueChange={setLevel} disabled={!programmeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Level" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLevels.map((lvl) => (
                          <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between bg-gray-50/50 pt-4">
          <Button 
            onClick={handlePreview} 
            disabled={isPendingPreview || !session || !semester || (activeTab === "individual" && !studentId) || (activeTab === "bulk" && (!programmeId || !entrySession || !level))}
          >
            {isPendingPreview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Preview
          </Button>
        </CardFooter>
      </Card>

      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Preview {activeTab === "bulk" && "(Aggregated)"}</CardTitle>
            <CardDescription>
              {activeTab === "bulk" 
                ? `Review the aggregated actions that will be performed across ${previewData.students_affected || 0} students.`
                : "Review the actions that will be performed for this student."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {activeTab === "bulk" && previewData.students_affected === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <Users className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>No eligible students found in this cohort for the selected target period.</p>
              </div>
            ) : (
              <>
                {/* TO ADD */}
                <div>
                  <h3 className="text-lg font-semibold flex items-center mb-2 text-green-600">
                    <CheckCircle className="mr-2 h-5 w-5" /> To Be Added ({previewData.to_add?.length || 0})
                  </h3>
                  {(previewData.to_add?.length || 0) > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {activeTab === "bulk" && <TableHead>Student (ID/Matric)</TableHead>}
                          <TableHead>Course Code</TableHead>
                          {activeTab === "individual" && <TableHead>Title</TableHead>}
                          <TableHead>Origin Grade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.to_add.map((item: any, i: number) => (
                          <TableRow key={i}>
                            {activeTab === "bulk" && <TableCell className="text-xs font-mono">{item.student_id}</TableCell>}
                            <TableCell className="font-medium">{item.course_code}</TableCell>
                            {activeTab === "individual" && <TableCell>{item.course_title}</TableCell>}
                            <TableCell>{item.origin_grade}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-gray-500">No new carryovers to add.</p>
                  )}
                </div>

                {/* TO REMOVE */}
                <div>
                  <h3 className="text-lg font-semibold flex items-center mb-2 text-red-600">
                    <XCircle className="mr-2 h-5 w-5" /> To Be Removed ({previewData.to_remove?.length || 0})
                  </h3>
                  {(previewData.to_remove?.length || 0) > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {activeTab === "bulk" && <TableHead>Student</TableHead>}
                          <TableHead>Item ID</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.to_remove.map((item: any, i: number) => (
                          <TableRow key={i}>
                            {activeTab === "bulk" && <TableCell className="text-xs font-mono">{item.student_id}</TableCell>}
                            <TableCell className="font-medium text-xs font-mono">{item.item_id}</TableCell>
                            <TableCell>{item.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-gray-500">No obsolete carryovers to remove.</p>
                  )}
                </div>

                {/* CONFLICTS */}
                {(previewData.conflicts?.length || 0) > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold flex items-center mb-2 text-orange-600">
                      <AlertTriangle className="mr-2 h-5 w-5" /> Conflicts / Manual Review ({previewData.conflicts.length})
                    </h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {activeTab === "bulk" && <TableHead>Student</TableHead>}
                          <TableHead>Course Code</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.conflicts.map((item: any, i: number) => (
                          <TableRow key={i} className="bg-orange-50">
                            {activeTab === "bulk" && <TableCell className="text-xs font-mono">{item.student_id}</TableCell>}
                            <TableCell className="font-medium">{item.course_code}</TableCell>
                            <TableCell>{item.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* TO KEEP */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mt-4">
                    Already Synced & Keeping: {previewData.to_keep?.length || 0} course(s)
                  </h3>
                </div>
              </>
            )}

          </CardContent>
          <CardFooter className="bg-gray-50 flex justify-end gap-2 border-t mt-4 pt-4">
            <Button variant="outline" onClick={() => setPreviewData(null)}>Cancel</Button>
            <Button onClick={handleCommit} disabled={isPendingCommit || (activeTab === "bulk" && previewData.students_affected === 0)}>
              {isPendingCommit ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Execute Sync
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
