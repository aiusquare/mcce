import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Save, UserCog, ShieldAlert, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AdminLayout } from "@/components/layouts/AdminLayout";
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
import api from "@/lib/api";
import {
  normalizeAdminSession,
  readAdminSession,
  saveAdminSession,
} from "@/lib/adminAccess";
import { toast } from "sonner";

type AdminAccountResponse = {
  data?: {
    user?: {
      phone?: unknown;
    };
  };
};

export default function AdminSettingsPage() {
  const session = readAdminSession();
  const [profileForm, setProfileForm] = useState({
    full_name: session?.full_name || "",
    email: session?.email || "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const isSuperAdmin = session?.roles?.some((r: { name: string }) => r.name.toLowerCase() === 'super admin');
  const hasSettingsPerm = session?.permissions?.some((p: { name: string }) => p.name === 'manage_settings');
  const canManageSettings = isSuperAdmin || hasSettingsPerm;

  const [maintenanceForm, setMaintenanceForm] = useState({
    student_portal_enabled: true,
    maintenance_title: "",
    maintenance_message: "",
    maintenance_expected_end: "",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [tempMaintenanceForm, setTempMaintenanceForm] = useState(maintenanceForm);

  useEffect(() => {
    const loadAccount = async () => {
      try {
        const response = await api.get("/api/admin/me");
        const freshSession = normalizeAdminSession(
          response,
          session?.email || "",
        );
        const phone = (response as AdminAccountResponse)?.data?.user?.phone;
        saveAdminSession(freshSession);
        setProfileForm({
          full_name: freshSession.full_name || "",
          email: freshSession.email || "",
          phone: phone ? String(phone) : "",
        });
      } catch {
        // The route guard already handles authentication failure.
      }
    };

    const loadSettings = async () => {
        if (canManageSettings) {
          try {
            const settingsRes = await api.get("/api/admin/settings");
            if (settingsRes.data) {
                const settingsData = {
                    student_portal_enabled: settingsRes.data.student_portal_enabled !== '0',
                    maintenance_title: settingsRes.data.maintenance_title || "",
                    maintenance_message: settingsRes.data.maintenance_message || "",
                    maintenance_expected_end: settingsRes.data.maintenance_expected_end || "",
                };
                setMaintenanceForm(settingsData);
                setTempMaintenanceForm(settingsData);
            }
          } catch (e) {
            // ignore
          }
        }
    };
    void loadSettings();
    void loadAccount();
  }, [canManageSettings, session?.email]);

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileForm.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }

    try {
      setIsSavingProfile(true);
      const response = await api.post("/api/admin/account", {
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone.trim() || null,
      });
      const updatedSession = normalizeAdminSession(
        response,
        profileForm.email,
      );
      saveAdminSession(updatedSession);
      setProfileForm((current) => ({
        ...current,
        full_name: updatedSession.full_name || current.full_name,
        email: updatedSession.email || current.email,
      }));
      toast.success("Account settings updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update account",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

    const handleSettingsSubmit = async () => {
    try {
      setIsSavingSettings(true);
      await api.post("/api/admin/settings/update", tempMaintenanceForm);
      setMaintenanceForm(tempMaintenanceForm);
      toast.success("Portal access settings updated");
      setShowDisableDialog(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update settings"
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const onSaveSettingsClick = (e: FormEvent) => {
    e.preventDefault();
    if (maintenanceForm.student_portal_enabled && !tempMaintenanceForm.student_portal_enabled) {
        setShowDisableDialog(true);
    } else {
        handleSettingsSubmit();
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !passwordForm.current_password ||
      !passwordForm.new_password ||
      !passwordForm.confirm_password
    ) {
      toast.error("Fill all password fields");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New password and confirmation do not match");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (passwordForm.new_password === "000000") {
      toast.error("Choose a password different from the temporary password");
      return;
    }

    try {
      setIsChangingPassword(true);
      const response = await api.post("/api/admin/change-password", passwordForm);
      const updatedSession = normalizeAdminSession(
        response,
        profileForm.email,
      );
      updatedSession.must_change_password = false;
      saveAdminSession(updatedSession);
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      toast.success("Password changed successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to change password",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your admin account details and password.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Account Details
              </CardTitle>
              <CardDescription>
                Update the name and phone number attached to your admin account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="settings_full_name">Full Name</Label>
                  <Input
                    id="settings_full_name"
                    value={profileForm.full_name}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        full_name: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings_email">Email Address</Label>
                  <Input
                    id="settings_email"
                    value={profileForm.email}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings_phone">Phone Number</Label>
                  <Input
                    id="settings_phone"
                    value={profileForm.phone}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        phone: event.target.value,
                      })
                    }
                  />
                </div>
                <Button type="submit" disabled={isSavingProfile}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingProfile ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>
                Use a password different from the temporary default.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="settings_current_password">
                    Current Password
                  </Label>
                  <Input
                    id="settings_current_password"
                    type="password"
                    autoComplete="current-password"
                    value={passwordForm.current_password}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        current_password: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings_new_password">New Password</Label>
                  <Input
                    id="settings_new_password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.new_password}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        new_password: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings_confirm_password">
                    Confirm New Password
                  </Label>
                  <Input
                    id="settings_confirm_password"
                    type="password"
                    autoComplete="new-password"
                    value={passwordForm.confirm_password}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirm_password: event.target.value,
                      })
                    }
                  />
                </div>
                <Button type="submit" disabled={isChangingPassword}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  {isChangingPassword ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        
        {canManageSettings && (
          <Card className="border-t-4 border-t-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                Portal Access Control
              </CardTitle>
              <CardDescription>
                Control student access during maintenance, upgrades, result processing or other administrative work.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSaveSettingsClick} className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">Student Portal Access</Label>
                    <p className="text-sm text-muted-foreground">
                      {tempMaintenanceForm.student_portal_enabled ? "Students can access the portal normally." : "Students are prevented from accessing protected portal functionality."}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${tempMaintenanceForm.student_portal_enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {tempMaintenanceForm.student_portal_enabled ? "Portal Online" : "Maintenance Mode"}
                    </span>
                    <Switch
                      checked={tempMaintenanceForm.student_portal_enabled}
                      onCheckedChange={(c) => setTempMaintenanceForm({ ...tempMaintenanceForm, student_portal_enabled: c })}
                    />
                  </div>
                </div>

                {!tempMaintenanceForm.student_portal_enabled && (
                    <div className="space-y-4 pt-2 border-t">
                        <div className="space-y-2">
                            <Label htmlFor="maintenance_title">Maintenance Title</Label>
                            <Input
                                id="maintenance_title"
                                value={tempMaintenanceForm.maintenance_title}
                                onChange={(e) => setTempMaintenanceForm({ ...tempMaintenanceForm, maintenance_title: e.target.value })}
                                placeholder="System Maintenance"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maintenance_message">Maintenance Message</Label>
                            <Input
                                id="maintenance_message"
                                value={tempMaintenanceForm.maintenance_message}
                                onChange={(e) => setTempMaintenanceForm({ ...tempMaintenanceForm, maintenance_message: e.target.value })}
                                placeholder="The student portal is temporarily unavailable..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maintenance_expected_end">Expected Restoration Time (optional)</Label>
                            <Input
                                id="maintenance_expected_end"
                                value={tempMaintenanceForm.maintenance_expected_end}
                                onChange={(e) => setTempMaintenanceForm({ ...tempMaintenanceForm, maintenance_expected_end: e.target.value })}
                                placeholder="e.g. 2:00 PM today"
                            />
                        </div>
                    </div>
                )}

                <Button type="submit" disabled={isSavingSettings} variant={!tempMaintenanceForm.student_portal_enabled ? "destructive" : "default"}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingSettings ? "Saving..." : "Save Access Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disable Student Portal Access?</AlertDialogTitle>
              <AlertDialogDescription>
                Students currently using the portal will no longer be able to access protected student services.
                <br /><br />
                Administrator and staff access will remain completely available.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSettingsSubmit} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Disable Student Portal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AdminLayout>
  );
}