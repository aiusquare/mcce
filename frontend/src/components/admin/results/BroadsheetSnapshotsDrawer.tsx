import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  ShieldCheck,
  CheckCircle2,
  History,
  Lock,
  ExternalLink,
  PlusCircle,
  Copy,
} from "lucide-react";
import { api, API_BASE } from "@/lib/api";
import { toast } from "sonner";

interface BroadsheetSnapshotsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  semesterId: string;
  programmeId: string;
  level?: string;
  basis?: string;
  cohort?: string;
  entryMode?: string;
  onSnapshotSelected?: (snapshot: any) => void;
  onSnapshotUpdated?: () => void;
}

export function BroadsheetSnapshotsDrawer({
  open,
  onOpenChange,
  sessionId,
  semesterId,
  programmeId,
  level,
  basis,
  cohort,
  entryMode,
  onSnapshotSelected,
  onSnapshotUpdated,
}: BroadsheetSnapshotsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);

  // New snapshot state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNotes, setCreateNotes] = useState("");
  const [allowIncomplete, setAllowIncomplete] = useState(false);

  // Sign-off state
  const [signRole, setSignRole] = useState("Head of Department");
  const [signStatus, setSignStatus] = useState("approved");
  const [signNotes, setSignNotes] = useState("");

  useEffect(() => {
    if (open && sessionId && semesterId && programmeId) {
      loadSnapshots();
    }
  }, [open, sessionId, semesterId, programmeId, level]);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      let url = `/api/admin/results/snapshots?session_id=${sessionId}&semester_id=${semesterId}&programme_id=${programmeId}`;
      if (level && level !== "all") {
        url += `&level=${encodeURIComponent(level)}`;
      }
      const res = (await api.get(url)) as any;
      const list = res.data || [];
      setSnapshots(list);
      if (list.length > 0) {
        loadSnapshotDetail(list[0].id);
      } else {
        setSelectedSnapshot(null);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load snapshots");
    } finally {
      setLoading(false);
    }
  };

  const loadSnapshotDetail = async (id: string) => {
    try {
      const res = (await api.get(`/api/admin/results/snapshots/item?id=${id}`)) as any;
      setSelectedSnapshot(res.data || null);
    } catch (err: any) {
      toast.error("Failed to load snapshot details");
    }
  };

  const handleCreateSnapshot = async () => {
    setCreating(true);
    try {
      const res = (await api.post("/api/admin/results/snapshots/create", {
        session_id: sessionId,
        semester_id: semesterId,
        programme_id: programmeId,
        level: level && level !== "all" ? level : null,
        basis: basis || "published",
        cohort: cohort || "all",
        entry_mode: entryMode || "all",
        notes: createNotes,
        allow_incomplete: allowIncomplete,
      })) as any;
      toast.success(res.message || "Official snapshot created successfully!");
      setShowCreateForm(false);
      setCreateNotes("");
      setAllowIncomplete(false);
      loadSnapshots();
      if (onSnapshotUpdated) {
        onSnapshotUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to create snapshot");
    } finally {
      setCreating(false);
    }
  };

  const handleSignOff = async () => {
    if (!selectedSnapshot) return;
    setSigning(true);
    try {
      const roleKey = signRole.toLowerCase().includes("dean")
        ? "dean"
        : signRole.toLowerCase().includes("director")
        ? "director"
        : signRole.toLowerCase().includes("board") || signRole.toLowerCase().includes("senate")
        ? "academic_board"
        : signRole.toLowerCase().includes("coordinator")
        ? "coordinator"
        : "hod";

      const res = (await api.post("/api/admin/results/snapshots/sign-off", {
        snapshot_id: selectedSnapshot.id,
        role: signRole,
        role_key: roleKey,
        status: signStatus,
        action: signStatus === "approved" ? "approve" : "reject",
        notes: signNotes,
        comment: signNotes,
      })) as any;
      toast.success(res.message || `Sign-off recorded as ${signStatus}!`);
      setSignNotes("");
      loadSnapshotDetail(selectedSnapshot.id);
      loadSnapshots();
      if (onSnapshotUpdated) {
        onSnapshotUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Sign-off failed");
    } finally {
      setSigning(false);
    }
  };

  const copyVerificationLink = (code: string) => {
    const url = `${window.location.origin}/verify/broadsheet/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Verification link copied to clipboard!");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Broadsheet Governance & Snapshots
          </SheetTitle>
          <SheetDescription>
            Manage immutable version snapshots, multi-tier approvals, and public verification.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Loading versions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Create Snapshot Button / Form */}
            {!showCreateForm ? (
              <div className="p-4 bg-muted/40 rounded-lg border flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Create New Official Snapshot</h4>
                  <p className="text-xs text-muted-foreground">
                    Locks current published results into an immutable audit snapshot with SHA-256 hash.
                  </p>
                </div>
                <Button size="sm" onClick={() => setShowCreateForm(true)}>
                  <PlusCircle className="h-4 w-4 mr-1.5" />
                  New Snapshot
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-muted/30 rounded-lg border space-y-3">
                <h4 className="font-semibold text-sm">Generate Version Snapshot</h4>
                <div className="space-y-1">
                  <Label className="text-xs">Notes / Purpose of Snapshot</Label>
                  <Textarea
                    placeholder="e.g. Approved by Academic Board meeting on 22nd October 2026"
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="allow_incomplete"
                    checked={allowIncomplete}
                    onCheckedChange={(c) => setAllowIncomplete(!!c)}
                  />
                  <Label htmlFor="allow_incomplete" className="text-xs font-normal">
                    Allow incomplete results (bypass 100% submission requirement)
                  </Label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateForm(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreateSnapshot} disabled={creating}>
                    {creating ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Lock className="h-4 w-4 mr-1.5" />
                    )}
                    Generate & Hash
                  </Button>
                </div>
              </div>
            )}

            {/* Versions List */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <History className="h-4 w-4 text-muted-foreground" />
                Snapshot Versions ({snapshots.length})
              </h4>
              {snapshots.length === 0 ? (
                <div className="p-6 text-center border rounded-lg text-muted-foreground text-xs">
                  No snapshots created yet for this session/programme. Click &quot;New Snapshot&quot; above to create one.
                </div>
              ) : (
                <div className="border rounded-md divide-y">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      onClick={() => loadSnapshotDetail(snap.id)}
                      className={`p-3 cursor-pointer transition-colors flex items-center justify-between text-xs ${
                        selectedSnapshot?.id === snap.id
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">Version {snap.version}</span>
                          <Badge
                            variant={
                              snap.status === "approved"
                                ? "default"
                                : snap.status === "rejected"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px] uppercase font-semibold"
                          >
                            {snap.status}
                          </Badge>
                          {snap.verification_code && (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {snap.verification_code}
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          Created: {new Date(snap.created_at).toLocaleString()}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate max-w-xs">
                          Hash: {snap.payload_hash?.substring(0, 16)}...
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-medium text-primary hover:underline">
                          View Details &rarr;
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Snapshot Details & Multi-tier Approvals */}
            {selectedSnapshot && (
              <div className="p-4 border rounded-lg bg-card space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-base flex items-center gap-2">
                      Version {selectedSnapshot.version} Details
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Code: <strong className="font-mono">{selectedSnapshot.verification_code}</strong> | Status:{" "}
                      <strong className="uppercase">{selectedSnapshot.status}</strong>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => copyVerificationLink(selectedSnapshot.verification_code)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy Verify Link
                  </Button>
                </div>

                {/* Hash & Verification Info */}
                <div className="p-2.5 bg-muted/50 rounded font-mono text-[11px] break-all space-y-1">
                  <div>
                    <span className="text-muted-foreground font-sans text-xs">SHA-256 Digest:</span>{" "}
                    {selectedSnapshot.payload_hash}
                  </div>
                  <div>
                    <span className="text-muted-foreground font-sans text-xs">Public Verification:</span>{" "}
                    <a
                      href={`${API_BASE}/public/verify-broadsheet/${selectedSnapshot.verification_code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      /api/public/verify-broadsheet/{selectedSnapshot.verification_code}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Approval Chain Progress */}
                <div>
                  <h5 className="font-semibold text-xs mb-2">Approval Chain Progress</h5>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["Course Coordinator", "Head of Department", "Dean / Director", "Academic Board"].map(
                      (role) => {
                        const approval = selectedSnapshot.approvals?.find(
                          (a: any) => a.role?.toLowerCase() === role.toLowerCase()
                        );
                        return (
                          <div
                            key={role}
                            className={`p-2 rounded border text-center text-xs ${
                              approval?.status === "approved"
                                ? "bg-green-50/50 border-green-200"
                                : approval?.status === "rejected"
                                ? "bg-red-50/50 border-red-200"
                                : "bg-muted/20 border-dashed"
                            }`}
                          >
                            <p className="font-semibold text-[11px]">{role}</p>
                            {approval ? (
                              <div className="mt-1 flex items-center justify-center gap-1">
                                {approval.status === "approved" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                ) : (
                                  <Badge variant="destructive" className="text-[9px]">
                                    Rejected
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground">
                                  {approval.signed_by_name || "Signed"}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">Pending</span>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Sign-Off Form */}
                <div className="p-3 bg-muted/20 rounded border space-y-3">
                  <h5 className="font-semibold text-xs">Record Sign-Off / Approval</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Your Institutional Role</Label>
                      <Select value={signRole} onValueChange={setSignRole}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Course Coordinator">Course Coordinator</SelectItem>
                          <SelectItem value="Head of Department">Head of Department</SelectItem>
                          <SelectItem value="Dean / Director">Dean / Director</SelectItem>
                          <SelectItem value="Academic Board">Academic Board / Senate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Decision</Label>
                      <Select value={signStatus} onValueChange={setSignStatus}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approve & Sign</SelectItem>
                          <SelectItem value="rejected">Reject with Comment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Comments / Minutes Reference</Label>
                    <Input
                      placeholder="e.g. Confirmed in Board Meeting #42"
                      value={signNotes}
                      onChange={(e) => setSignNotes(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      onClick={handleSignOff}
                      disabled={signing}
                      className={signStatus === "rejected" ? "bg-red-600 hover:bg-red-700" : ""}
                    >
                      {signing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Submit Decision
                    </Button>
                  </div>
                </div>

                {/* Audit Log Table */}
                {selectedSnapshot.audit_log && selectedSnapshot.audit_log.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-xs mb-1">Audit Trail</h5>
                    <div className="border rounded max-h-[160px] overflow-y-auto">
                      <Table className="text-[10px]">
                        <TableHeader className="bg-muted/40 sticky top-0">
                          <TableRow>
                            <TableHead className="w-24">Action</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead className="w-28">Timestamp</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedSnapshot.audit_log.map((log: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono font-bold">{log.action}</TableCell>
                              <TableCell>{log.user_name || log.user_id}</TableCell>
                              <TableCell>{log.notes || JSON.stringify(log.details || "")}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
