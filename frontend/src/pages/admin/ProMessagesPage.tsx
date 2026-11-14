import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAdminProMessages, updateAdminProMessage } from "@/lib/api";

interface MessageItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved";
  assigned_to: string;
  internal_note: string;
  created_at: string | null;
}

function toList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as any[];
    if (
      obj.data &&
      typeof obj.data === "object" &&
      Array.isArray((obj.data as Record<string, unknown>).items)
    ) {
      return (obj.data as Record<string, any[]>).items;
    }
    if (Array.isArray(obj.items)) return obj.items as any[];
    if (Array.isArray(obj.messages)) return obj.messages as any[];
  }
  return [];
}

function mapMessage(value: any): MessageItem {
  const statusValue = String(value?.status || "new").toLowerCase();
  const status: MessageItem["status"] =
    statusValue === "in_progress" || statusValue === "resolved"
      ? statusValue
      : "new";

  return {
    id: String(value?.id ?? value?.message_id ?? ""),
    name: String(
      value?.name ??
        `${value?.first_name || ""} ${value?.last_name || ""}`.trim(),
    ),
    email: String(value?.email ?? ""),
    phone: String(value?.phone ?? ""),
    subject: String(value?.subject ?? ""),
    message: String(value?.message ?? value?.body ?? ""),
    status,
    assigned_to: String(value?.assigned_to ?? ""),
    internal_note: String(value?.internal_note ?? value?.note ?? ""),
    created_at: value?.created_at ? String(value.created_at) : null,
  };
}

export default function ProMessagesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<MessageItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<MessageItem | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [formStatus, setFormStatus] = useState<MessageItem["status"]>("new");
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formNote, setFormNote] = useState("");

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [items, search, statusFilter]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const res = await getAdminProMessages();
      setItems(toList(res).map(mapMessage).filter((item) => item.id));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openMessageDialog = (item: MessageItem) => {
    setSelected(item);
    setFormStatus(item.status);
    setFormAssignedTo(item.assigned_to);
    setFormNote(item.internal_note);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!selected) return;

    try {
      setSaving(true);
      await updateAdminProMessage(selected.id, {
        status: formStatus,
        assigned_to: formAssignedTo.trim() || undefined,
        internal_note: formNote.trim() || undefined,
      });
      toast({ title: "Success", description: "Message updated successfully" });
      setOpenDialog(false);
      setSelected(null);
      await loadMessages();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update message",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4">Loading messages...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">PRO - Messages Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Receive contact messages and track resolution workflow.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Incoming Messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Search name, email, subject"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sender</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{item.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{item.subject || "(No subject)"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "resolved"
                            ? "success"
                            : item.status === "in_progress"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openMessageDialog(item)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No messages found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={openDialog}
        onOpenChange={(open) => {
          setOpenDialog(open);
          if (!open) {
            setSelected(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Sender</Label>
                  <p className="text-sm">{selected.name || "Unknown"}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="text-sm">{selected.email || "-"}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="text-sm">{selected.phone || "-"}</p>
                </div>
                <div>
                  <Label>Subject</Label>
                  <p className="text-sm">{selected.subject || "(No subject)"}</p>
                </div>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea value={selected.message} readOnly rows={6} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formStatus}
                    onValueChange={(value: MessageItem["status"]) => setFormStatus(value)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assigned-to">Assigned To</Label>
                  <Input
                    id="assigned-to"
                    className="mt-2"
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    placeholder="e.g. Admissions Officer"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="internal-note">Internal Note</Label>
                <Textarea
                  id="internal-note"
                  className="mt-2"
                  rows={4}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Add follow-up notes for admin staff"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Close
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
