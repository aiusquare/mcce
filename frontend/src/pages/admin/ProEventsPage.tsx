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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  createAdminProEvent,
  deleteAdminProEvent,
  getAdminProEvents,
  updateAdminProEvent,
} from "@/lib/api";

interface EventItem {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string | null;
  ends_at: string | null;
  status: "draft" | "published" | "archived";
  featured: boolean;
}

const defaultForm = {
  title: "",
  description: "",
  location: "",
  starts_at: "",
  ends_at: "",
  status: "draft" as "draft" | "published" | "archived",
  featured: false,
};

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
    if (Array.isArray(obj.events)) return obj.events as any[];
  }
  return [];
}

function mapEventItem(value: any): EventItem {
  const statusValue = String(value?.status || "draft").toLowerCase();
  const status: EventItem["status"] =
    statusValue === "published" || statusValue === "archived"
      ? statusValue
      : "draft";

  return {
    id: String(value?.id ?? value?.event_id ?? ""),
    title: String(value?.title ?? ""),
    description: String(value?.description ?? value?.content ?? ""),
    location: String(value?.location ?? ""),
    starts_at: value?.starts_at ? String(value.starts_at) : null,
    ends_at: value?.ends_at ? String(value.ends_at) : null,
    status,
    featured: Boolean(value?.featured ?? value?.is_featured),
  };
}

export default function ProEventsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<EventItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState(defaultForm);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [items, search, statusFilter]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await getAdminProEvents();
      setItems(toList(res).map(mapEventItem).filter((item) => item.id));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm(defaultForm);
  };

  const openCreateDialog = () => {
    resetForm();
    setOpenDialog(true);
  };

  const openEditDialog = (item: EventItem) => {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description,
      location: item.location,
      starts_at: item.starts_at ? item.starts_at.slice(0, 16) : "",
      ends_at: item.ends_at ? item.ends_at.slice(0, 16) : "",
      status: item.status,
      featured: item.featured,
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({
        title: "Validation",
        description: "Event title is required",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      status: form.status,
      featured: form.featured,
    };

    try {
      setSaving(true);
      if (editing) {
        await updateAdminProEvent(editing.id, payload);
        toast({ title: "Success", description: "Event updated successfully" });
      } else {
        await createAdminProEvent(payload);
        toast({ title: "Success", description: "Event created successfully" });
      }
      setOpenDialog(false);
      resetForm();
      await loadEvents();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Unable to save event",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: EventItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) {
      return;
    }
    try {
      await deleteAdminProEvent(item.id);
      toast({ title: "Success", description: "Event deleted successfully" });
      await loadEvents();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4">Loading events...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">PRO - Events Management</h1>
            <p className="text-sm text-muted-foreground">
              Plan and publish public-facing events.
            </p>
          </div>
          <Button onClick={openCreateDialog}>Create Event</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Search by title or location"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.location || "-"}</TableCell>
                    <TableCell>
                      {item.starts_at
                        ? new Date(item.starts_at).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "published"
                            ? "success"
                            : item.status === "archived"
                              ? "secondary"
                              : "warning"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.featured ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No events found.
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
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "Create Event"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input
                id="event-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                rows={4}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-start">Start Date & Time</Label>
                <Input
                  id="event-start"
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, starts_at: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-end">End Date & Time</Label>
                <Input
                  id="event-end"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, ends_at: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: "draft" | "published" | "archived") =>
                    setForm((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 self-end pb-2">
                <Checkbox
                  id="event-featured"
                  checked={form.featured}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, featured: Boolean(checked) }))
                  }
                />
                <Label htmlFor="event-featured">Featured</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
