import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  roles?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
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

function normalizeUser(user: Partial<User> & Record<string, unknown>): User {
  const rawRoles = user.roles as unknown;
  const fullName = String(user.full_name || user.name || "").trim();
  const nameParts = fullName.split(/\s+/).filter(Boolean);

  return {
    id: String(user.id || user.user_id || user.email || crypto.randomUUID()),
    email: String(user.email || ""),
    first_name:
      typeof user.first_name === "string"
        ? user.first_name
        : nameParts.slice(0, -1).join(" ") || nameParts[0] || "",
    last_name:
      typeof user.last_name === "string"
        ? user.last_name
        : nameParts.length > 1
          ? nameParts[nameParts.length - 1]
          : "",
    roles:
      typeof rawRoles === "string"
        ? rawRoles
        : Array.isArray(rawRoles)
          ? rawRoles
              .map((role) =>
                typeof role === "string"
                  ? role
                  : (role as { name?: string; slug?: string })?.name ||
                    (role as { slug?: string })?.slug,
              )
              .filter(Boolean)
              .join(", ")
          : "",
  };
}

function normalizeRole(role: Partial<Role> & Record<string, unknown>): Role {
  return {
    id: String(role.id || role.role_id || ""),
    name: String(role.name || role.slug || "Untitled role"),
    description: String(role.description || ""),
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [usersRes, rolesRes] = await Promise.allSettled([
      api.get("/api/admin/get-users"),
      api.get("/api/admin/get-roles"),
    ]);

    setUsers(
      usersRes.status === "fulfilled"
        ? extractList<Partial<User> & Record<string, unknown>>(usersRes.value, [
            "users",
          ]).map(normalizeUser)
        : [],
    );
    setRoles(
      rolesRes.status === "fulfilled"
        ? extractList<Partial<Role> & Record<string, unknown>>(rolesRes.value, [
            "roles",
          ]).map(normalizeRole)
        : [],
    );

    if (usersRes.status === "rejected" || rolesRes.status === "rejected") {
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.first_name || !selectedRole) {
      toast({
        title: "Error",
        description: "Email, first name, and role are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();
      await api.post("/api/admin/create-user", {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        full_name: fullName,
        roles: selectedRole ? [selectedRole] : [],
      });
      toast({
        title: "Success",
        description: `User created. They can log in with ${formData.email} and temporary password 000000.`,
      });
      setFormData({ email: "", first_name: "", last_name: "" });
      setSelectedRole("");
      setOpenCreateDialog(false);
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRole) {
      toast({
        title: "Error",
        description: "Please select a role",
        variant: "destructive",
      });
      return;
    }

    try {
      await api.post("/api/admin/assign-role", {
        user_id: selectedUser.id,
        role_id: selectedRole,
      });
      toast({ title: "Success", description: "Role assigned successfully" });
      setOpenAssignDialog(false);
      setSelectedRole("");
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to assign role",
        variant: "destructive",
      });
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
          <h1 className="text-3xl font-bold">Admin User Management</h1>
          <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
            <DialogTrigger asChild>
              <Button>Create User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
                <Input
                  placeholder="First Name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                />
                <Input
                  placeholder="Last Name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                />
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Temporary password is <span className="font-mono text-foreground">000000</span>.
                  The admin must change it immediately after first login.
                </div>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles
                      .filter((role) => role.id)
                      .map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleCreateUser}
                  disabled={isCreating}
                  className="w-full"
                >
                  {isCreating ? "Creating..." : "Create User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Admin Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.first_name} {user.last_name}
                    </TableCell>
                    <TableCell>{user.roles || "No roles"}</TableCell>
                    <TableCell>
                      <Dialog
                        open={openAssignDialog && selectedUser?.id === user.id}
                        onOpenChange={setOpenAssignDialog}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setSelectedRole("");
                            }}
                          >
                            Assign Role
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              Assign Role to {user.email}
                            </DialogTitle>
                          </DialogHeader>
                          <Select
                            value={selectedRole}
                            onValueChange={setSelectedRole}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles
                                .filter((role) => role.id)
                                .map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={handleAssignRole} className="w-full">
                            Assign Role
                          </Button>
                        </DialogContent>
                      </Dialog>
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
