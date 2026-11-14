import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ADMIN_RESOURCES } from "@/lib/adminAccess";

interface Permission {
  id: string;
  name: string;
  description: string;
  is_active: number;
}

interface Resource {
  id: string;
  name: string;
  slug: string;
  path: string;
  module?: string;
  description?: string;
}

interface Role {
  id: string;
  name: string;
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

function normalizePermission(
  permission: Partial<Permission> & Record<string, unknown>,
): Permission {
  return {
    id: String(permission.id || permission.permission_id || ""),
    name: String(permission.name || permission.action || ""),
    description: String(permission.description || ""),
    is_active:
      permission.is_active === false ||
      permission.is_active === 0 ||
      permission.is_active === "0"
        ? 0
        : 1,
  };
}

function normalizeResource(
  resource: Partial<Resource> & Record<string, unknown>,
): Resource {
  const slug = String(resource.slug || resource.resource_slug || "");
  return {
    id: String(resource.id || resource.resource_id || slug),
    name: String(resource.name || slug || "Untitled page"),
    slug,
    path: String(resource.path || ""),
    module: typeof resource.module === "string" ? resource.module : undefined,
    description:
      typeof resource.description === "string"
        ? resource.description
        : undefined,
  };
}

function normalizeRole(role: Partial<Role> & Record<string, unknown>): Role {
  return {
    id: String(role.id || role.role_id || ""),
    name: String(role.name || role.slug || "Untitled role"),
  };
}

function fallbackResources(): Resource[] {
  return ADMIN_RESOURCES.map((resource) => ({
    id: resource.slug,
    name: resource.name,
    slug: resource.slug,
    path: resource.path,
    module: resource.module,
    description: resource.description,
  }));
}

export default function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAssignDialog, setOpenAssignDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedPermission, setSelectedPermission] = useState<string>("");
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [selectedAccessRole, setSelectedAccessRole] = useState<string>("");
  const [selectedAccessResource, setSelectedAccessResource] =
    useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [permsRes, resourcesRes, rolesRes] = await Promise.allSettled([
        api.get("/api/admin/get-permissions"),
        api.get("/api/admin/get-resources"),
        api.get("/api/admin/get-roles"),
      ]);

      setPermissions(
        permsRes.status === "fulfilled"
          ? extractList<Partial<Permission> & Record<string, unknown>>(
              permsRes.value,
              ["permissions"],
            ).map(normalizePermission)
          : [],
      );
      const resourceList =
        resourcesRes.status === "fulfilled"
          ? extractList<Partial<Resource> & Record<string, unknown>>(
              resourcesRes.value,
              ["resources"],
            ).map(normalizeResource)
          : [];
      setResources(resourceList.length ? resourceList : fallbackResources());
      setRoles(
        rolesRes.status === "fulfilled"
          ? extractList<Partial<Role> & Record<string, unknown>>(
              rolesRes.value,
              ["roles"],
            ).map(normalizeRole)
          : [],
      );
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPermission = async () => {
    if (!selectedRole || !selectedPermission) {
      toast({
        title: "Error",
        description: "Please select a role and permission",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAssigning(true);
      await api.post("/api/admin/assign-permission", {
        role_id: selectedRole,
        permission_id: selectedPermission,
        resource_id: selectedResource || null,
      });
      toast({
        title: "Success",
        description: "Permission assigned successfully",
      });
      setSelectedRole("");
      setSelectedPermission("");
      setSelectedResource("");
      setOpenAssignDialog(false);
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to assign permission",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAllowPageAccess = async () => {
    const viewPermission = permissions.find(
      (permission) => permission.name.toLowerCase() === "view",
    );
    const resource = resources.find(
      (item) =>
        item.id === selectedAccessResource || item.slug === selectedAccessResource,
    );

    if (!selectedAccessRole || !resource) {
      toast({
        title: "Error",
        description: "Please select a role and page",
        variant: "destructive",
      });
      return;
    }

    if (!viewPermission) {
      toast({
        title: "View permission is missing",
        description: "Seed a permission named view before allowing page access.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAssigning(true);
      await api.post("/api/admin/assign-permission", {
        role_id: selectedAccessRole,
        permission_id: viewPermission.id,
        resource_id: resource.id,
      });
      toast({
        title: "Success",
        description: `${resource.name} access allowed for the selected role`,
      });
      setSelectedAccessRole("");
      setSelectedAccessResource("");
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to allow page access",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
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
        <h1 className="text-3xl font-bold">Permission Management</h1>
        <Dialog open={openAssignDialog} onOpenChange={setOpenAssignDialog}>
          <DialogTrigger asChild>
            <Button>Assign Permission to Role</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Permission to Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.filter((role) => role.id).map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedPermission}
                onValueChange={setSelectedPermission}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Permission" />
                </SelectTrigger>
                <SelectContent>
                  {permissions.filter((perm) => perm.id).map((perm) => (
                    <SelectItem key={perm.id} value={perm.id}>
                      {perm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedResource}
                onValueChange={setSelectedResource}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Resource (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  {resources.filter((res) => res.id).map((res) => (
                    <SelectItem key={res.id} value={res.id}>
                      {res.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleAssignPermission}
                disabled={isAssigning}
                className="w-full"
              >
                {isAssigning ? "Assigning..." : "Assign Permission"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Permissions</CardTitle>
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
              {permissions.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell className="font-medium">{perm.name}</TableCell>
                  <TableCell>{perm.description}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${perm.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {perm.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allow Page Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <Select
              value={selectedAccessRole}
              onValueChange={setSelectedAccessRole}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                {roles.filter((role) => role.id).map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedAccessResource}
              onValueChange={setSelectedAccessResource}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Page" />
              </SelectTrigger>
              <SelectContent>
                {resources.filter((resource) => resource.id).map((resource) => (
                  <SelectItem key={resource.id} value={resource.id}>
                    {resource.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleAllowPageAccess} disabled={isAssigning}>
              {isAssigning ? "Allowing..." : "Allow Access"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Page Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.map((res) => (
                <TableRow key={res.id}>
                  <TableCell className="font-medium">{res.name}</TableCell>
                  <TableCell className="capitalize">{res.module || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {res.path}
                  </TableCell>
                  <TableCell>{res.description || "-"}</TableCell>
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
