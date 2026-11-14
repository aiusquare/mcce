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
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  createAdminProNews,
  deleteAdminProNews,
  getAdminProNews,
  updateAdminProNews,
} from "@/lib/api";

interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  featured: boolean;
  status: "draft" | "published" | "archived";
  published_at: string | null;
}

const defaultForm = {
  title: "",
  excerpt: "",
  content: "",
  category: "Admissions",
  featured: false,
  status: "draft" as "draft" | "published" | "archived",
  published_at: "",
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
    if (Array.isArray(obj.news)) return obj.news as any[];
  }
  return [];
}

function mapNewsItem(value: any): NewsItem {
  const statusValue = String(
    value?.status || value?.publish_status || "draft",
  ).toLowerCase();
  const status: NewsItem["status"] =
    statusValue === "published" || statusValue === "archived"
      ? statusValue
      : "draft";

  return {
    id: String(value?.id ?? value?.news_id ?? ""),
    title: String(value?.title ?? ""),
    excerpt: String(value?.excerpt ?? value?.summary ?? ""),
    content: String(value?.content ?? value?.body ?? ""),
    category: String(value?.category ?? "General"),
    featured: Boolean(value?.featured ?? value?.is_featured),
    status,
    published_at: value?.published_at ? String(value.published_at) : null,
  };
}

export default function ProNewsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState(defaultForm);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);
      return matchStatus && matchSearch;
    });
  }, [items, search, statusFilter]);

  const loadNews = async () => {
    try {
      setLoading(true);
      const res = await getAdminProNews();
      setItems(toList(res).map(mapNewsItem).filter((item) => item.id));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load news items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNews();
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

  const openEditDialog = (item: NewsItem) => {
    setEditing(item);
    setForm({
      title: item.title,
      excerpt: item.excerpt,
      content: item.content,
      category: item.category,
      featured: item.featured,
      status: item.status,
      published_at: item.published_at ? item.published_at.slice(0, 16) : "",
    });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({
        title: "Validation",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      category: form.category.trim() || "General",
      featured: form.featured,
      status: form.status,
      published_at: form.published_at || null,
    };

    try {
      setSaving(true);
      if (editing) {
        await updateAdminProNews(editing.id, payload);
        toast({ title: "Success", description: "News updated successfully" });
      } else {
        await createAdminProNews(payload);
        toast({ title: "Success", description: "News created successfully" });
      }
      setOpenDialog(false);
      resetForm();
      await loadNews();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Unable to save news item",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: NewsItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) {
      return;
    }
    try {
      await deleteAdminProNews(item.id);
      toast({ title: "Success", description: "News deleted successfully" });
      await loadNews();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete news item",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (
    item: NewsItem,
    status: "draft" | "published" | "archived",
  ) => {
    try {
      await updateAdminProNews(item.id, {
        status,
        published_at:
          status === "published"
            ? item.published_at || new Date().toISOString()
            : item.published_at,
      });
      toast({ title: "Success", description: "Status updated" });
      await loadNews();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4">Loading news records...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">PRO - News Management</h1>
            <p className="text-sm text-muted-foreground">
              Create, edit, publish and archive news posts.
            </p>
          </div>
          <Button onClick={openCreateDialog}>Create News</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>News Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="Search by title or category"
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
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.category}</TableCell>
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
                      {item.published_at
                        ? new Date(item.published_at).toLocaleString()
                        : "Not published"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(item)}
                        >
                          Edit
                        </Button>
                        {item.status !== "published" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(item, "published")}
                          >
                            Publish
                          </Button>
                        )}
                        {item.status === "published" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(item, "archived")}
                          >
                            Archive
                          </Button>
                        )}
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
                      No news records found.
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
            <DialogTitle>{editing ? "Edit News" : "Create News"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="news-title">Title</Label>
              <Input
                id="news-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter news title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-excerpt">Excerpt</Label>
              <Textarea
                id="news-excerpt"
                value={form.excerpt}
                onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                rows={3}
                placeholder="Short summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="news-content">Content</Label>
              <Textarea
                id="news-content"
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                rows={6}
                placeholder="Full content"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  placeholder="Admissions, Academic, Events..."
                />
              </div>
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
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="news-published-at">Published Date</Label>
                <Input
                  id="news-published-at"
                  type="datetime-local"
                  value={form.published_at}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, published_at: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-center gap-3 self-end pb-2">
                <Checkbox
                  id="news-featured"
                  checked={form.featured}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, featured: Boolean(checked) }))
                  }
                />
                <Label htmlFor="news-featured">Featured</Label>
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
