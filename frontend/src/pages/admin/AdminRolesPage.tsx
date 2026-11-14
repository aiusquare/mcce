import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { AdminLayout } from "@/components/layouts/AdminLayout";

interface Role {
  id: string;
  name: string;
  description: string;
  is_active: number;
}

function extractList<T>(payload: unknown, keys: string[] = []): T[] {
  if (Array.isArray(payload)) return payload.filter(Boolean) as T[];

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of [...keys, "data", "items", "rows", "results"]) {
      const value = record[key];
      if (Array.isArray(value)) return value.filter(Boolean) as T[];
      if (value && typeof value === "object" && "data" in value) {
        const nested = extractList<T>(value, keys);
        if (nested.length) return nested;
      }
    }
  }

  return [];
}

function normalizeRole(role: Partial<Role> & Record<string, unknown>): Role {
  return {
    id: String(role.id || role.role_id || role.slug || role.name || ""),
    name: String(role.name || role.slug || "Untitled role"),
    description: String(role.description || ""),
    is_active:
      role.is_active === false || role.is_active === 0 || role.is_active === "0"
        ? 0
        : 1,
  };
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const { toast } = useToast();

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/get-roles");
      setRoles(
        extractList<Partial<Role> & Record<string, unknown>>(res, [
          "roles",
        ]).map(normalizeRole),
      );
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!formData.name) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      await api.post("/api/admin/create-role", formData);
      toast({ title: "Success", description: "Role created successfully" });
      setFormData({ name: "", description: "" });
      setOpenDialog(false);
      loadRoles();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create role",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div>Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Role Management</h1>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button>Create Role</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Role Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              <Textarea
                placeholder="Description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
              <Button
                onClick={handleCreateRole}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${role.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {role.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </AdminLayout>
  );
}
