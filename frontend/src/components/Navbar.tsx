import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, Mail, GraduationCap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { schoolConfig } from "@/config/schoolConfig";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: "Home", href: "/", isExternal: false },
    { name: "About", href: "/about", isExternal: false },
    { name: "Admissions", href: "/admissions", isExternal: false },
    { name: "News & Events", href: "/news", isExternal: false },
    { name: "Contact", href: "/contact", isExternal: false },
    // { name: "Hostel", href: schoolConfig.externalLinks.hostelPortal, isExternal: true },
    {
      name: "E-Library",
      href: schoolConfig.externalLinks.elibraryPortal,
      isExternal: true,
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full transition-all shadow-xs">
      {/* Top Utility Announcement Bar */}
      <div className="hidden border-b border-primary/10 bg-primary px-4 py-1.5 text-xs text-primary-foreground/90 md:block">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5 font-medium">
              <Phone className="h-3.5 w-3.5 text-gold" />
              {schoolConfig.contact.primaryPhone}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Mail className="h-3.5 w-3.5 text-gold" />
              {schoolConfig.contact.emails.admissions}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold">
              {schoolConfig.academics.currentSession} Admissions Open
            </span>
            <span className="text-primary-foreground/60">•</span>
            <span className="text-[11px] text-primary-foreground/80">
              {schoolConfig.name.motto}
            </span>
          </div>
        </div>
      </div>

      {/* Main Glassmorphic Navbar */}
      <div className="border-b border-border/60 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="container flex h-16 items-center justify-between md:h-20">
          <Logo />

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              if (link.isExternal) {
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
                  >
                    {link.name}
                  </a>
                );
              }

              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={cn(
                    "rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-150",
                    isActive(link.href)
                      ? "bg-primary/10 text-primary font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                  )}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Portal Quick Access Buttons */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <Button variant="outline-primary" size="sm" asChild>
              <Link to="/student/login" className="flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4" />
                <span>Student Portal</span>
              </Link>
            </Button>
            {/* <Button variant="portal" size="sm" asChild>
              <Link to="/admin/login" className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                <span>Admin Console</span>
              </Link>
            </Button> */}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle navigation menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="border-b border-border/70 bg-background/95 backdrop-blur-xl lg:hidden animate-fade-in">
          <nav className="container flex flex-col gap-1.5 py-4">
            {navLinks.map((link) => {
              if (link.isExternal) {
                return (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {link.name}
                  </a>
                );
              }

              return (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                  )}
                >
                  {link.name}
                </Link>
              );
            })}

            <div className="mt-4 flex flex-col gap-2.5 border-t border-border/60 pt-4">
              <Button
                variant="outline-primary"
                asChild
                className="w-full justify-center"
              >
                <Link to="/student/login" onClick={() => setIsOpen(false)}>
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Student Portal
                </Link>
              </Button>
              {/* <Button
                variant="portal"
                asChild
                className="w-full justify-center"
              >
                <Link to="/admin/login" onClick={() => setIsOpen(false)}>
                  <Shield className="mr-2 h-4 w-4" />
                  Admin Console
                </Link>
              </Button> */}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
