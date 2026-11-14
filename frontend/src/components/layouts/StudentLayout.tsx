import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  FileText,
  CheckSquare,
  ClipboardList,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  Bell,
  FileCheck,
  IdCard,
} from "lucide-react";
import { MaslahaEmblem } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/lib/api";
import { isStudentSidebarEnabled } from "@/config/sidebarMenu";
import { schoolConfig } from "@/config/schoolConfig";
import { requiresStudentProfileUpdate } from "@/lib/onboarding";

type StudentProfile = {
  full_name?: string;
  email?: string;
  application_id?: string;
};

interface StudentLayoutProps {
  children: ReactNode;
  profile?: StudentProfile | null;
  notificationCount?: number;
}

const menuItems: Array<{
  key: string;
  name: string;
  href: string;
  icon: typeof Home;
  requiresAdmission?: boolean;
}> = [
  { key: "dashboard", name: "Dashboard", href: "/student/dashboard", icon: Home },
  { key: "apply", name: "Apply for Admission", href: "/student/apply", icon: FileText },
  {
    key: "admissionStatus",
    name: "Admission Status",
    href: "/student/admission-status",
    icon: CheckSquare,
  },
  {
    key: "courseRegistration",
    name: "Course Registration",
    href: "/student/course-registration",
    icon: ClipboardList,
    requiresAdmission: true,
  },
  {
    key: "results",
    name: "Exam Results",
    href: "/student/results",
    icon: ClipboardList,
    requiresAdmission: true,
  },
  {
    key: "payments",
    name: "Payments & Receipts",
    href: "/student/payments",
    icon: CreditCard,
    requiresAdmission: true,
  },
  {
    key: "clearance",
    name: "Clearance",
    href: "/student/clearance",
    icon: FileCheck,
    requiresAdmission: true,
  },
  {
    key: "examCard",
    name: "Exam Card",
    href: "/student/exam-card",
    icon: IdCard,
    requiresAdmission: true,
  },
  { key: "profile", name: "Profile", href: "/student/profile", icon: User },
];

const getFirstName = (fullName?: string) => {
  const name = (fullName || "").trim();
  return name ? name.split(" ")[0] : "Student";
};

export function StudentLayout({
  children,
  profile,
  notificationCount = 0,
}: StudentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmitted, setIsAdmitted] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const needsProfileUpdate = profile ? requiresStudentProfileUpdate(profile) : false;

  useEffect(() => {
    if (needsProfileUpdate && location.pathname !== "/student/profile") {
      navigate("/student/profile", { replace: true });
    }
  }, [needsProfileUpdate, location.pathname, navigate]);

  useEffect(() => {
    let mounted = true;

    const loadAdmissionStatus = async () => {
      try {
        const res = await api.getAdmissionStatus();
        const status = String(res?.data?.status || "").toLowerCase();
        if (mounted) {
          setIsAdmitted(status === "admitted");
        }
      } catch (error) {
        if (mounted) {
          setIsAdmitted(false);
        }
      }
    };

    void loadAdmissionStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("mccas_profile");
      localStorage.removeItem("MCCAS_profile");
    } catch (error) {
      // ignore storage failures
    }
    toast.success("Logged out successfully");
    navigate("/student/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
        <Link to="/student/dashboard" className="flex items-center gap-2.5">
          <MaslahaEmblem className="h-8 w-8" />
          <span className="font-serif font-bold text-foreground">
            {schoolConfig.name.acronym} Portal
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 transform bg-sidebar transition-transform duration-300 lg:translate-x-0 flex flex-col",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 lg:h-20 shrink-0">
            <Link to="/student/dashboard" className="flex items-center gap-3">
              <MaslahaEmblem className="h-10 w-10" />
              <div>
                <span className="font-serif text-lg font-bold text-sidebar-foreground block leading-tight">
                  {schoolConfig.name.acronym}
                </span>
                <span className="text-[10px] text-sidebar-foreground/75 font-medium block leading-tight truncate max-w-[130px]">
                  {schoolConfig.name.short}
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-sidebar-foreground lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.href;
              const isEnabled = isStudentSidebarEnabled(item.key);
              const isLockedByAdmission = Boolean(item.requiresAdmission && !isAdmitted);
              const isLockedByProfile = Boolean(needsProfileUpdate && item.key !== "profile");
              const isLocked = isLockedByAdmission || isLockedByProfile;

              const itemClassName = cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                !isEnabled || isLocked
                  ? "cursor-not-allowed text-sidebar-foreground/40"
                  : isActive
                    ? "bg-sidebar-accent text-sidebar-primary shadow-xs font-semibold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              );
              const itemContent = (
                <>
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1 text-left">
                    {item.name}
                  </span>
                  {isLocked && (
                    <Badge variant="secondary" className="text-[10px]">
                      Locked
                    </Badge>
                  )}
                  {!isLocked && !isEnabled && (
                    <Badge variant="secondary" className="text-[10px]">
                      Coming soon
                    </Badge>
                  )}
                </>
              );

              if (!isEnabled) {
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      toast.info("Coming soon", {
                        description:
                          "This section is disabled while development is focused elsewhere.",
                      });
                    }}
                    className={itemClassName}
                  >
                    {itemContent}
                  </button>
                );
              }

              if (isLockedByProfile) {
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      toast.error("Profile Update Required", {
                        description: "You must complete your profile update before accessing other sections.",
                      });
                    }}
                    className={itemClassName}
                  >
                    {itemContent}
                  </button>
                );
              }

              if (isLockedByAdmission) {
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false);
                      toast.info("Available after admission", {
                        description:
                          "This section opens once your admission is approved.",
                      });
                    }}
                    className={itemClassName}
                  >
                    {itemContent}
                  </button>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={itemClassName}
                >
                  {itemContent}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="border-t border-sidebar-border p-4 shrink-0">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-foreground/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-64">
          {/* Desktop Header */}
          <header className="sticky top-0 z-40 hidden h-16 items-center justify-between border-b bg-background/90 backdrop-blur px-6 lg:flex">
            <div>
              <h1 className="font-serif text-xl font-semibold">
                Welcome back,{" "}
                <span className="text-primary font-bold">
                  {getFirstName(profile?.full_name)}
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                {schoolConfig.name.short} Portal • App ID: {profile?.application_id || "--"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  {notificationCount}
                </span>
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-medium">
                    {profile?.full_name || "Student"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.email || "--"}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
