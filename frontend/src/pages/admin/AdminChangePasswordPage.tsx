import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import api from "@/lib/api";
import {
  firstAccessibleAdminPath,
  normalizeAdminSession,
  readAdminSession,
  saveAdminSession,
  clearAdminSession,
} from "@/lib/adminAccess";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function AdminChangePasswordPage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    const session = readAdminSession();
    if (!session) {
      navigate("/admin/login", { replace: true });
      return;
    }
    if (!session.must_change_password) {
      const target = firstAccessibleAdminPath(session);
      navigate(
        !target || target === "/admin/login" ? "/admin/dashboard" : target,
        {
          replace: true,
        },
      );
    }
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Local session cleanup is enough for the frontend.
    }
    clearAdminSession();
    navigate("/admin/login", { replace: true });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (
      !formData.current_password ||
      !formData.new_password ||
      !formData.confirm_password
    ) {
      toast.error("Fill all password fields");
      return;
    }
    if (formData.new_password !== formData.confirm_password) {
      toast.error("New password and confirmation do not match");
      return;
    }
    if (formData.new_password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (formData.new_password === "000000") {
      toast.error("Choose a password different from the temporary password");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await api.post("/api/admin/change-password", formData);
      const currentSession = readAdminSession();
      const session = normalizeAdminSession(
        response,
        currentSession?.email || "",
      );
      session.must_change_password = false;
      saveAdminSession(session);
      toast.success("Password changed successfully");
      const target = firstAccessibleAdminPath(session);
      navigate(
        !target || target === "/admin/login" ? "/admin/dashboard" : target,
        {
          replace: true,
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to change password",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <Link
            to="/"
            className="mx-auto flex items-center justify-center gap-3"
          >
            <img
              src={logo}
              alt="MCCE logo"
              className="h-12 w-12 rounded-full border bg-background object-contain"
            />
            <span className="font-serif text-2xl font-bold">MCCE</span>
          </Link>
          <Logo className="mx-auto justify-center" size="md" />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="font-serif text-3xl">
              Change Password
            </CardTitle>
            <CardDescription>
              Your account is using a temporary password. Set a new password to
              continue.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password">Current Password</Label>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                value={formData.current_password}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    current_password: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                value={formData.new_password}
                onChange={(event) =>
                  setFormData({ ...formData, new_password: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                value={formData.confirm_password}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    confirm_password: event.target.value,
                  })
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <KeyRound className="mr-2 h-4 w-4" />
              {isSubmitting ? "Saving..." : "Save New Password"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
