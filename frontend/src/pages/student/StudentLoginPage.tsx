import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import heroCampus from "@/assets/hero-campus.jpg";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
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
import { Logo, MaslahaEmblem } from "@/components/Logo";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { toast } from "sonner";
import api from "@/lib/api";
import schoolConfig from "@/config/schoolConfig";
import {
  buildStudentRegisterRoute,
  extractApiData,
  loadLocalOnboardingStatus,
  resolveOnboardingFlags,
  resolveOnboardingStep,
  saveLocalOnboardingStatus,
} from "@/lib/onboarding";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) return "";
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeStudentProfile(
  payload: Record<string, unknown> | null,
  fallbackEmail: string,
) {
  if (!payload) {
    return fallbackEmail.trim() ? { email: fallbackEmail.trim() } : null;
  }

  const source =
    asRecord(payload.user) ||
    asRecord(payload.student) ||
    asRecord(payload.profile) ||
    asRecord(payload.account) ||
    asRecord(payload.applicant) ||
    payload;
  const email =
    firstString(source, ["email", "Email"]) ||
    firstString(payload, ["email", "Email"]) ||
    fallbackEmail.trim();

  return {
    ...source,
    email,
    token:
      firstString(payload, ["token", "access_token"]) ||
      firstString(source, ["token", "access_token"]) ||
      undefined,
  };
}

function saveStudentProfile(profile: Record<string, unknown> | null) {
  if (!profile) return;
  try {
    localStorage.setItem("mccas_profile", JSON.stringify(profile));
    localStorage.setItem("MCCAS_profile", JSON.stringify(profile));
  } catch (error) {
    // ignore storage failures
  }
}

function getStatusValue(...sources: unknown[]) {
  for (const source of sources) {
    const record = asRecord(source);
    const status = firstString(record, [
      "status",
      "application_status",
      "admission_status",
    ]);
    if (status) return status.toLowerCase();
  }
  return "";
}

function isSubmittedApplication(progressData: unknown, admissionData: unknown) {
  const progress = asRecord(progressData);
  const submittedFlag = progress?.is_submitted ?? progress?.isSubmitted;
  const progressStatus = getStatusValue(progressData);
  const admissionStatus = getStatusValue(admissionData);

  return (
    submittedFlag === true ||
    submittedFlag === 1 ||
    submittedFlag === "1" ||
    submittedFlag === "true" ||
    (Boolean(progressStatus) && progressStatus !== "draft") ||
    Boolean(admissionStatus)
  );
}

function resolveStudentLoginRoute({
  email,
  onboardingStep,
  progressData,
  admissionData,
}: {
  email: string;
  onboardingStep: 2 | 3 | 4 | 5;
  progressData: unknown;
  admissionData: unknown;
}) {
  if (onboardingStep < 5) {
    return buildStudentRegisterRoute(onboardingStep, email);
  }

  if (getStatusValue(admissionData) === "admitted") {
    return "/student/dashboard";
  }

  if (isSubmittedApplication(progressData, admissionData)) {
    return "/student/admission-status";
  }

  return "/student/apply";
}

export default function StudentLoginPage() {
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
      const res = await api.loginAccount({
        email: formData.email,
        password: formData.password,
      });
      const loginData = extractApiData<Record<string, unknown>>(res);
      const loginProfile = normalizeStudentProfile(loginData, formData.email);
      saveStudentProfile(loginProfile);

      let profileData = loginProfile || loginData;
      let progressData: unknown = null;
      let admissionData: unknown = null;

      const [profileRes, progressRes, admissionRes] = await Promise.allSettled([
        api.getStudentProfile(),
        api.getApplicationProgress(),
        api.getAdmissionStatus(),
      ]);

      if (profileRes.status === "fulfilled") {
        const parsedProfile = extractApiData<Record<string, unknown>>(
          profileRes.value,
        );
        if (parsedProfile) {
          profileData =
            normalizeStudentProfile(parsedProfile, formData.email) ||
            parsedProfile;
          saveStudentProfile(profileData);
        }
      }

      if (progressRes.status === "fulfilled") {
        progressData = extractApiData(progressRes.value);
      }

      if (admissionRes.status === "fulfilled") {
        admissionData = extractApiData(admissionRes.value);
      }

      const email =
        (typeof profileData?.email === "string" && profileData.email) ||
        formData.email;
      const localFlags = loadLocalOnboardingStatus(email);
      const hasApplicationOrAdmission = isSubmittedApplication(
        progressData,
        admissionData,
      );
      const onboardingFlags = resolveOnboardingFlags(
        localFlags,
        profileData,
        progressData,
        hasApplicationOrAdmission ? { application_fee_paid: true } : null,
      );
      saveLocalOnboardingStatus(email, onboardingFlags);
      const onboardingStep = resolveOnboardingStep(onboardingFlags);
      const nextRoute = resolveStudentLoginRoute({
        email,
        onboardingStep,
        progressData,
        admissionData,
      });

      setIsLoading(false);
      toast.success(
        (asRecord(res)?.message as string | undefined) || "Login successful!",
      );
      navigate(nextRoute, { replace: true });
    } catch (err: unknown) {
      setIsLoading(false);
      const apiErr = err as { body?: { message?: string }; message?: string };
      const msg = apiErr?.body?.message || apiErr?.message || "Login failed";
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex">
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
            <MaslahaEmblem className="h-14 w-14" />
            <div>
              <span className="font-serif text-xl font-bold text-primary-foreground block leading-tight">
                {schoolConfig.name.acronym}
              </span>
              <p className="text-xs text-primary-foreground/75 font-medium">
                Student Portal
              </p>
            </div>
          </Link>

          <div className="mt-auto mb-auto">
            <div className="max-w-md mb-12">
              <h1 className="mb-6 font-serif text-4xl font-bold text-primary-foreground drop-shadow-lg">
                Welcome Back, Scholar
              </h1>
              <p className="text-lg text-primary-foreground/90 leading-relaxed drop-shadow-md">
                Access your academic records, track your admission status,
                register for courses, and manage your student profile.
              </p>
            </div>

            <div className="space-y-4 max-w-md">
              <div className="flex items-center gap-4 rounded-lg bg-primary-foreground/10 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <span className="font-serif font-bold text-secondary-foreground">
                    1
                  </span>
                </div>
                <div>
                  <p className="font-medium text-primary-foreground">
                    Apply for Admission
                  </p>
                  <p className="text-sm text-primary-foreground/70">
                    Start your journey here
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg bg-primary-foreground/10 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <span className="font-serif font-bold text-secondary-foreground">
                    2
                  </span>
                </div>
                <div>
                  <p className="font-medium text-primary-foreground">
                    Track Your Status
                  </p>
                  <p className="text-sm text-primary-foreground/70">
                    Monitor admission progress
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg bg-primary-foreground/10 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <span className="font-serif font-bold text-secondary-foreground">
                    3
                  </span>
                </div>
                <div>
                  <p className="font-medium text-primary-foreground">
                    Register Courses
                  </p>
                  <p className="text-sm text-primary-foreground/70">
                    Complete your enrollment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full lg:w-1/2 flex-col justify-center p-6 md:p-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="font-serif text-2xl">
                  Student Login
                </CardTitle>
                <CardDescription>
                  Enter your credentials to access your portal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@email.com"
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
                        to="/student/forgot-password"
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
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

                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        New to {schoolConfig.name.acronym}?
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline-primary"
                    size="lg"
                    className="mt-4 w-full"
                    asChild
                  >
                    <Link to="/student/register">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create Account
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Need help?{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Contact Support
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
