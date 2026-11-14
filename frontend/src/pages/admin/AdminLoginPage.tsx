import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroCampus from "@/assets/hero-campus.jpg";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, Shield } from "lucide-react";
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
import api from "@/lib/api";
import {
  firstAccessibleAdminPath,
  normalizeAdminSession,
  saveAdminSession,
} from "@/lib/adminAccess";
import { schoolConfig } from "@/config/schoolConfig";
import { Logo } from "@/components/Logo";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await api.post("/api/admin/login", formData);
      const session = normalizeAdminSession(response, formData.email);
      saveAdminSession(session);
      toast.success("Login successful!");
      if (session.must_change_password) {
        navigate("/admin/change-password");
        return;
      }
      const target = firstAccessibleAdminPath(session);
      if (!target || target === "/admin/login") {
        navigate("/admin/dashboard");
      } else {
        navigate(target);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in");
      setIsLoading(false);
      return;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src={heroCampus}
            alt="MCCE Campus"
            className="h-full w-full object-cover"
          />
          <div className="hero-overlay absolute inset-0" />
          <div className="pattern-overlay absolute inset-0" />
        </div>
        <div className="relative z-10 flex flex-col p-12 w-full h-full">
          <Link to="/" className="flex items-center gap-3">
            <Logo size="md" showText={false} />
            <div>
              <span className="font-serif text-xl font-bold text-primary-foreground block leading-tight">
                {schoolConfig.name.acronym}
              </span>
              <p className="text-xs text-primary-foreground/75 font-medium">
                Admin Portal
              </p>
            </div>
          </Link>

          <div className="mt-auto mb-auto">
            <div className="max-w-md mb-12">
              <h1 className="mb-6 font-serif text-4xl font-bold text-primary-foreground drop-shadow-lg">
                Administrative Portal
              </h1>
              <p className="text-lg text-primary-foreground/90 leading-relaxed drop-shadow-md">
                Manage admissions, student records, finances, and institutional
                operations from a centralized dashboard.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div className="rounded-lg bg-primary-foreground/10 p-4 backdrop-blur-sm">
                <p className="font-serif text-2xl font-bold text-gold">
                  5,000+
                </p>
                <p className="text-sm text-primary-foreground/70">
                  Active Students
                </p>
              </div>
              <div className="rounded-lg bg-primary-foreground/10 p-4 backdrop-blur-sm">
                <p className="font-serif text-2xl font-bold text-gold">200+</p>
                <p className="text-sm text-primary-foreground/70">
                  Staff Members
                </p>
              </div>
              <div className="rounded-lg bg-primary-foreground/10 p-4 backdrop-blur-sm">
                <p className="font-serif text-2xl font-bold text-gold">
                  {schoolConfig.academics.programCount}+
                </p>
                <p className="text-sm text-primary-foreground/70">
                  Degree Programmes
                </p>
              </div>
              <div className="rounded-lg bg-primary-foreground/10 p-4 backdrop-blur-sm">
                <p className="font-serif text-2xl font-bold text-gold">
                  Est. {schoolConfig.institution?.foundedYear || "2015"}
                </p>
                <p className="text-sm text-primary-foreground/70">
                  College Established
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center p-6 md:p-12 bg-background">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size="sm" showText={false} />
            <div>
              <span className="font-serif text-lg font-bold">
                {schoolConfig.name.acronym}
              </span>
              <p className="text-xs text-muted-foreground">Admin Portal</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-0 shadow-lg card-elevated">
              <CardHeader className="space-y-1 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="font-serif text-2xl">
                  Admin Login
                </CardTitle>
                <CardDescription>
                  Enter your credentials to access the{" "}
                  {schoolConfig.name.acronym} admin portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={schoolConfig.contact.emails.admin}
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    variant="portal"
                    size="lg"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        Signing in...
                      </span>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> Access to
                    the admin portal is restricted to authorized personnel only.
                    All activities are logged for security purposes.
                  </p>
                </div>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/" className="text-primary hover:underline">
                ← Return to Main Website
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
