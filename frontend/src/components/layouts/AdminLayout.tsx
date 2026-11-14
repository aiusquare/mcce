import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  Menu,
  X,
  Bell,
  Shield,
} from "lucide-react";
import { MaslahaEmblem } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  clearAdminSession,
  readAdminSession,
  visibleMenuGroups,
} from "@/lib/adminAccess";
import { isAdminSidebarEnabled } from "@/config/sidebarMenu";
import schoolConfig from "@/config/schoolConfig";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const session = readAdminSession();
  const menuGroups = visibleMenuGroups(session);
  const adminName = session?.full_name || session?.email || "Admin User";
  const primaryRole =
    typeof session?.roles?.[0] === "string"
      ? session.roles[0]
      : session?.roles?.[0]?.name || session?.roles?.[0]?.slug || "Admin";
  const roleLabel = primaryRole
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const handleLogout = () => {
    clearAdminSession();
    toast.success("Logged out successfully");
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
        <Link to="/admin/dashboard" className="flex items-center gap-2.5">
          <MaslahaEmblem className="h-8 w-8" />
          <span className="font-serif font-bold text-foreground">
            {schoolConfig.name.acronym} Admin
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
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-svh w-64 transform flex-col border-r bg-background transition-transform duration-300 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Sidebar Header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b px-4 lg:h-16">
            <Link to="/admin/dashboard" className="flex items-center gap-2.5">
              <MaslahaEmblem className="h-9 w-9" />
              <div>
                <span className="font-serif text-sm font-bold text-foreground block leading-tight">
                  {schoolConfig.name.acronym} Admin
                </span>
                <span className="text-[10px] text-muted-foreground font-medium block leading-tight truncate max-w-[140px]">
                  {schoolConfig.name.short}
                </span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.3)_transparent]">
            {menuGroups.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    const isEnabled = isAdminSidebarEnabled(item.resourceSlug);
                    const itemClassName = cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      !isEnabled
                        ? "cursor-not-allowed text-muted-foreground/50"
                        : isActive
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    );
                    const itemContent = (
                      <>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">{item.name}</span>
                        {!isEnabled && (
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
                </div>
              </div>
            ))}
          </nav>

          {/* User Section */}
          <div className="shrink-0 border-t p-4 bg-muted/20">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{adminName}</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
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
        <main className="flex-1 lg:ml-64 min-w-0 flex flex-col min-h-screen">
          {/* Desktop Header */}
          <header className="sticky top-0 z-40 hidden h-16 items-center justify-between border-b bg-background/90 backdrop-blur px-6 lg:flex">
            <div>
              <h1 className="font-serif text-lg font-semibold text-foreground">
                {schoolConfig.name.acronym} Administrative Console
              </h1>
              <p className="text-xs text-muted-foreground">
                {schoolConfig.name.full}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  3
                </span>
              </Button>
              <div className="h-8 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{adminName}</p>
                  <Badge variant="emerald" className="text-[10px]">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

