import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import heroCampus from "@/assets/hero-campus.jpg";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Shield,
  AlertCircle,
  MailCheck,
  CreditCard,
  Fingerprint,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import api from "@/lib/api";
import schoolConfig from "@/config/schoolConfig";
import {
  extractApiData,
  hasOnboardingSignals,
  loadLocalOnboardingStatus,
  readStoredStudentProfile,
  resolveOnboardingFlags,
  resolveOnboardingStep,
  saveLocalOnboardingStatus,
  SKIP_EMAIL_VERIFICATION,
} from "@/lib/onboarding";
import {
  buildPaymentReference,
  initializePaystackPayment,
} from "@/lib/paystack";
import { getActiveSessionFeeSettings } from "@/lib/fees";

type RegisterFormData = {
  firstName: string;
  lastName: string;
  otherName: string;
  nin: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

type RegisterDraft = Omit<RegisterFormData, "password" | "confirmPassword">;

const REGISTER_DRAFT_PREFIX = "mccas_register_draft:";
const LEGACY_REGISTER_DRAFT_PREFIX = "MCCAS_register_draft:";
const REGISTER_DRAFT_FALLBACK_KEY = `${REGISTER_DRAFT_PREFIX}anonymous`;

const normalizeEmail = (email?: string | null) =>
  (email || "").trim().toLowerCase();

const getRegisterDraftKey = (email?: string | null) => {
  const normalized = normalizeEmail(email);
  return normalized
    ? `${REGISTER_DRAFT_PREFIX}${normalized}`
    : REGISTER_DRAFT_FALLBACK_KEY;
};

const loadRegisterDraft = (email?: string | null): RegisterDraft | null => {
  try {
    const key = getRegisterDraftKey(email);
    const normalized = normalizeEmail(email);
    const legacyKey = normalized
      ? `${LEGACY_REGISTER_DRAFT_PREFIX}${normalized}`
      : `${LEGACY_REGISTER_DRAFT_PREFIX}anonymous`;
    const raw = localStorage.getItem(key) || localStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegisterDraft>;
    return {
      firstName: String(parsed.firstName || ""),
      lastName: String(parsed.lastName || ""),
      otherName: String(parsed.otherName || ""),
      nin: String(parsed.nin || ""),
      email: String(parsed.email || ""),
      phone: String(parsed.phone || ""),
    };
  } catch (error) {
    return null;
  }
};

const saveRegisterDraft = (draft: RegisterDraft, email?: string | null) => {
  try {
    const activeEmail = email || draft.email;
    const normalized = normalizeEmail(activeEmail);
    const legacyKey = normalized
      ? `${LEGACY_REGISTER_DRAFT_PREFIX}${normalized}`
      : `${LEGACY_REGISTER_DRAFT_PREFIX}anonymous`;

    const json = JSON.stringify(draft);
    localStorage.setItem(getRegisterDraftKey(activeEmail), json);
    localStorage.setItem(REGISTER_DRAFT_FALLBACK_KEY, json);
    localStorage.setItem(legacyKey, json);
    localStorage.setItem(`${LEGACY_REGISTER_DRAFT_PREFIX}anonymous`, json);
  } catch (error) {
    // ignore storage failures
  }
};

const clearRegisterDraft = (email?: string | null) => {
  try {
    const normalized = normalizeEmail(email);
    const legacyKey = normalized
      ? `${LEGACY_REGISTER_DRAFT_PREFIX}${normalized}`
      : `${LEGACY_REGISTER_DRAFT_PREFIX}anonymous`;

    localStorage.removeItem(getRegisterDraftKey(email));
    localStorage.removeItem(REGISTER_DRAFT_FALLBACK_KEY);
    localStorage.removeItem(legacyKey);
    localStorage.removeItem(`${LEGACY_REGISTER_DRAFT_PREFIX}anonymous`);
  } catch (error) {
    // ignore storage failures
  }
};

const getProfileValue = (
  profile: Record<string, unknown> | null | undefined,
  ...keys: string[]
) => {
  if (!profile) return "";
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const getNamePartsFromProfile = (profile: Record<string, unknown> | null) => {
  const first = getProfileValue(profile, "first_name", "FirstName");
  const middle = getProfileValue(profile, "middle_name", "OtherName");
  const last = getProfileValue(profile, "last_name", "Surname");
  if (first || middle || last) {
    return { firstName: first, otherName: middle, lastName: last };
  }

  const fullName = getProfileValue(profile, "full_name", "FullName");
  if (!fullName) {
    return { firstName: "", otherName: "", lastName: "" };
  }
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], otherName: "", lastName: "" };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], otherName: "", lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    otherName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
};

const buildDraftFromProfile = (profile: Record<string, unknown> | null) => {
  if (!profile) return null;
  const names = getNamePartsFromProfile(profile);
  return {
    firstName: names.firstName,
    lastName: names.lastName,
    otherName: names.otherName,
    nin: getProfileValue(profile, "nin", "NIN"),
    email: getProfileValue(profile, "email", "Email"),
    phone: getProfileValue(profile, "phone", "phone_number", "PhoneNumber"),
  } satisfies RegisterDraft;
};

const mergeDraftIntoForm = (
  prev: RegisterFormData,
  draft: RegisterDraft | null,
  preferredEmail?: string,
): RegisterFormData => {
  if (!draft) return prev;

  const next = { ...prev };
  const assignIfValue = (
    key: keyof RegisterDraft,
    value: string,
    options?: { allowZero?: boolean },
  ) => {
    const normalized = String(value || "").trim();
    if (!normalized && !options?.allowZero) return;
    next[key] = normalized;
  };

  assignIfValue("firstName", draft.firstName);
  assignIfValue("lastName", draft.lastName);
  assignIfValue("otherName", draft.otherName);
  assignIfValue("nin", draft.nin);
  assignIfValue("phone", draft.phone);
  assignIfValue("email", preferredEmail || draft.email);

  return next;
};

const hasAnyDraftValue = (draft: RegisterDraft) =>
  Boolean(
    draft.firstName ||
    draft.lastName ||
    draft.otherName ||
    draft.nin ||
    draft.email ||
    draft.phone,
  );

const buildProfileFromForm = (formData: RegisterFormData) => ({
  email: formData.email,
  full_name: [formData.firstName, formData.otherName, formData.lastName]
    .filter(Boolean)
    .join(" "),
  first_name: formData.firstName,
  middle_name: formData.otherName,
  last_name: formData.lastName,
  phone: formData.phone,
  nin: formData.nin,
});

export default function StudentRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isVerifyingNin, setIsVerifyingNin] = useState(false);
  const [step, setStep] = useState(1);
  const [issuedCode, setIssuedCode] = useState("123456");
  const [emailVerified, setEmailVerified] = useState(SKIP_EMAIL_VERIFICATION);
  const [appFeePaid, setAppFeePaid] = useState(false);
  const [ninVerified, setNinVerified] = useState(SKIP_EMAIL_VERIFICATION);
  const [hasAccountCreated, setHasAccountCreated] = useState(false);
  const [isHydrationComplete, setIsHydrationComplete] = useState(false);
  const [applicationFee, setApplicationFee] = useState(5000);
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: "",
    lastName: "",
    otherName: "",
    nin: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadFeeSettings = async () => {
      try {
        const activeFees = await getActiveSessionFeeSettings();
        if (mounted && activeFees?.applicationFee) {
          setApplicationFee(activeFees.applicationFee);
        }
      } catch {
        // keep default fee
      }
    };

    void loadFeeSettings();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const hydrateRegistration = async () => {
      setIsHydrationComplete(false);
      const queryStep = Number(searchParams.get("step"));
      const requestedStep =
        Number.isFinite(queryStep) && queryStep >= 1 && queryStep <= 4
          ? SKIP_EMAIL_VERIFICATION && queryStep > 1
            ? 3
            : queryStep
          : null;

      const queryEmail = (searchParams.get("email") || "").trim();
      const storedProfile =
        (readStoredStudentProfile() as Record<string, unknown> | null) || null;
      const storedEmail =
        typeof storedProfile?.email === "string"
          ? String(storedProfile.email)
          : "";
      let email = queryEmail || storedEmail || "";

      const cachedDraft = loadRegisterDraft(email) || loadRegisterDraft();
      if (cachedDraft && mounted) {
        setFormData((prev) => mergeDraftIntoForm(prev, cachedDraft, email));
      }

      const profileDraft = buildDraftFromProfile(storedProfile);
      if (profileDraft && mounted) {
        setFormData((prev) => mergeDraftIntoForm(prev, profileDraft, email));
      }

      let profileData = storedProfile;
      let progressData: unknown = null;

      if (email) {
        const [profileRes, progressRes] = await Promise.allSettled([
          api.getStudentProfile(),
          api.getApplicationProgress(),
        ]);

        if (profileRes.status === "fulfilled") {
          const parsedProfile = extractApiData<Record<string, unknown>>(
            profileRes.value,
          );
          if (parsedProfile) {
            profileData = parsedProfile;
            const liveDraft = buildDraftFromProfile(parsedProfile);
            if (liveDraft && mounted) {
              setFormData((prev) => mergeDraftIntoForm(prev, liveDraft, email));
            }
            try {
              localStorage.setItem(
                "mccas_profile",
                JSON.stringify(parsedProfile),
              );
              localStorage.setItem(
                "MCCAS_profile",
                JSON.stringify(parsedProfile),
              );
            } catch (error) {
              // ignore storage failures
            }
          }
        }

        if (progressRes.status === "fulfilled") {
          progressData = extractApiData(progressRes.value);
        }
      }

      const resolvedEmail =
        getProfileValue(profileData, "email", "Email") ||
        cachedDraft?.email ||
        "" ||
        email;
      email = resolvedEmail || email;

      const localFlags = loadLocalOnboardingStatus(email);
      const resolvedFlags = resolveOnboardingFlags(
        localFlags,
        profileData,
        progressData,
      );
      const requiredStep = resolveOnboardingStep(resolvedFlags);
      const hasProfileIdentity = Boolean(
        getProfileValue(
          profileData,
          "id",
          "user_id",
          "application_id",
          "applicationId",
          "full_name",
          "first_name",
          "last_name",
          "FirstName",
          "Surname",
        ),
      );
      const accountExists =
        hasProfileIdentity || hasOnboardingSignals(localFlags);

      if (!mounted) return;

      if (accountExists && requiredStep >= 5) {
        navigate("/student/apply", { replace: true });
        return;
      }

      if (!accountExists) {
        setHasAccountCreated(false);
        setEmailVerified(SKIP_EMAIL_VERIFICATION);
        setAppFeePaid(false);
        setNinVerified(SKIP_EMAIL_VERIFICATION);
        setStep(1);
        setIsHydrationComplete(true);
        return;
      }

      setHasAccountCreated(accountExists);
      setEmailVerified(
        SKIP_EMAIL_VERIFICATION || resolvedFlags.emailVerified === true,
      );
      setAppFeePaid(resolvedFlags.applicationFeePaid === true);
      setNinVerified(
        SKIP_EMAIL_VERIFICATION || resolvedFlags.ninVerified === true,
      );

      if (email && accountExists) {
        void persistOnboardingState({
          email,
          onboardingStep: requiredStep,
          emailVerified:
            SKIP_EMAIL_VERIFICATION || resolvedFlags.emailVerified === true,
          applicationFeePaid: resolvedFlags.applicationFeePaid === true,
          ninVerified:
            SKIP_EMAIL_VERIFICATION || resolvedFlags.ninVerified === true,
        });
      }

      if (accountExists) {
        setStep(Math.max(2, Math.min(requiredStep, 4)));
      } else if (requestedStep) {
        setStep(requestedStep);
      } else {
        setStep(1);
      }
      setIsHydrationComplete(true);
    };

    void hydrateRegistration();

    return () => {
      mounted = false;
    };
  }, [navigate, searchParams]);

  useEffect(() => {
    const requiredStep = resolveOnboardingStep({
      emailVerified,
      applicationFeePaid: appFeePaid,
      ninVerified,
    });

    if (hasAccountCreated && step < 2) {
      setStep(SKIP_EMAIL_VERIFICATION ? 3 : 2);
      return;
    }

    if (step > 1 && step > requiredStep) {
      setStep(requiredStep);
    }
  }, [appFeePaid, emailVerified, hasAccountCreated, ninVerified, step]);

  useEffect(() => {
    if (!isHydrationComplete) return;

    const draft: RegisterDraft = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      otherName: formData.otherName,
      nin: formData.nin,
      email: formData.email,
      phone: formData.phone,
    };
    if (!hasAnyDraftValue(draft)) return;
    saveRegisterDraft(draft, formData.email);
  }, [
    isHydrationComplete,
    formData.email,
    formData.firstName,
    formData.lastName,
    formData.nin,
    formData.otherName,
    formData.phone,
  ]);

  const steps = SKIP_EMAIL_VERIFICATION
    ? [
        { id: 1, label: "Create profile" },
        { id: 3, label: "Pay application fee" },
      ]
    : [
        { id: 1, label: "Create profile" },
        { id: 2, label: "Verify email" },
        { id: 3, label: "Pay application fee" },
      ];

  const currentStageLabel =
    steps.find((current) => current.id === step)?.label || "Create profile";

  const persistOnboardingState = async (payload: {
    email?: string;
    onboardingStep: number;
    emailVerified: boolean;
    applicationFeePaid: boolean;
    ninVerified: boolean;
  }) => {
    const email = normalizeEmail(payload.email || formData.email);
    if (!email) return;

    saveLocalOnboardingStatus(email, {
      emailVerified: payload.emailVerified,
      applicationFeePaid: payload.applicationFeePaid,
      ninVerified: payload.ninVerified,
    });

    try {
      await api.updateOnboardingProgress({
        email,
        onboarding_step: payload.onboardingStep,
        email_verified: payload.emailVerified,
        application_fee_paid: payload.applicationFeePaid,
        nin_verified: payload.ninVerified,
      });
    } catch (error) {
      console.warn("Failed to sync onboarding progress to backend", error);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasAccountCreated) {
      setStep(SKIP_EMAIL_VERIFICATION ? 3 : 2);
      toast.error("Profile already exists. Complete application fee payment.");
      return;
    }

    if (!SKIP_EMAIL_VERIFICATION && formData.nin.length !== 11) {
      toast.error("NIN must be 11 digits");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const full_name = [
        formData.firstName,
        formData.otherName,
        formData.lastName,
      ]
        .filter(Boolean)
        .join(" ");
      const res = await api.registerAccount({
        full_name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || null,
        nin: formData.nin || null,
      });
      const profileData =
        extractApiData<Record<string, unknown>>(res) ||
        buildProfileFromForm(formData);
      try {
        const fullProfile = {
          ...buildProfileFromForm(formData),
          ...profileData,
        };
        localStorage.setItem("mccas_profile", JSON.stringify(fullProfile));
        localStorage.setItem("MCCAS_profile", JSON.stringify(fullProfile));
      } catch (error) {
        // ignore storage failures
      }
      await persistOnboardingState({
        email: formData.email,
        onboardingStep: SKIP_EMAIL_VERIFICATION ? 3 : 2,
        emailVerified: SKIP_EMAIL_VERIFICATION,
        applicationFeePaid: false,
        ninVerified: SKIP_EMAIL_VERIFICATION,
      });
      setHasAccountCreated(true);
      setIsLoading(false);
      setEmailVerified(SKIP_EMAIL_VERIFICATION);
      setNinVerified(SKIP_EMAIL_VERIFICATION);
      setStep(SKIP_EMAIL_VERIFICATION ? 3 : 2);
      toast.success(
        res?.message ||
          (SKIP_EMAIL_VERIFICATION
            ? "Profile created. Continue to application fee payment."
            : "Account created. Check your email for the verification code."),
      );
    } catch (err: unknown) {
      setIsLoading(false);
      const apiErr = err as { body?: { message?: string }; message?: string };
      const msg =
        apiErr?.body?.message || apiErr?.message || "Failed to create account";
      toast.error(msg);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verificationCode) {
      toast.error("Enter the verification code");
      return;
    }
    setIsVerifyingEmail(true);
    setTimeout(() => {
      setIsVerifyingEmail(false);
      if (verificationCode === issuedCode) {
        setEmailVerified(true);
        void persistOnboardingState({
          email: formData.email,
          onboardingStep: 3,
          emailVerified: true,
          applicationFeePaid: false,
          ninVerified: false,
        });
        setStep(3);
        toast.success("Email verified");
      } else {
        toast.error("Invalid verification code");
      }
    }, 900);
  };

  const handlePayApplicationFee = async () => {
    if (!SKIP_EMAIL_VERIFICATION && !emailVerified) {
      setStep(2);
      toast.error("Complete email verification first.");
      return;
    }

    setIsPaying(true);
    try {
      const payment = await initializePaystackPayment({
        email: normalizeEmail(formData.email),
        amount: applicationFee,
        reference: buildPaymentReference(
          schoolConfig.payment.applicationFeePrefix,
        ),
        label: `${schoolConfig.name.acronym} Application Fee`,
        metadata: {
          payment_type: "application_fee",
          full_name: [formData.firstName, formData.otherName, formData.lastName]
            .filter(Boolean)
            .join(" "),
          phone: formData.phone,
          nin: formData.nin,
        },
      });

      await api.verifyApplicationFeePayment({
        email: formData.email,
        reference: payment.reference,
        amount: applicationFee,
      });

      setIsPaying(false);
      setAppFeePaid(true);
      void persistOnboardingState({
        email: formData.email,
        onboardingStep: SKIP_EMAIL_VERIFICATION ? 5 : 4,
        emailVerified: true,
        applicationFeePaid: true,
        ninVerified: SKIP_EMAIL_VERIFICATION,
      });
      if (SKIP_EMAIL_VERIFICATION) {
        clearRegisterDraft(formData.email);
        toast.success(`Application fee paid. Reference: ${payment.reference}`);
        navigate("/student/apply", { replace: true });
        return;
      }
      setStep(4);
      toast.success(`Application fee paid. Reference: ${payment.reference}`);
    } catch (error) {
      setIsPaying(false);
      toast.error(
        error instanceof Error ? error.message : "Payment was not completed",
      );
    }
  };

  const handleVerifyNIN = async () => {
    if (!emailVerified) {
      setStep(2);
      toast.error("Complete email verification first.");
      return;
    }

    if (!appFeePaid) {
      setStep(3);
      toast.error("Pay the application fee before NIN verification.");
      return;
    }

    setIsVerifyingNin(true);
    setTimeout(() => {
      setIsVerifyingNin(false);
      setNinVerified(true);
      void persistOnboardingState({
        email: formData.email,
        onboardingStep: 5,
        emailVerified: true,
        applicationFeePaid: true,
        ninVerified: true,
      });
      clearRegisterDraft(formData.email);
      toast.success("NIN verified successfully");
      navigate("/student/dashboard", { replace: true });
    }, 1100);
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
                Create Your Student Profile
              </h1>
              <p className="text-lg text-primary-foreground/90 leading-relaxed drop-shadow-md">
                Join thousands of students at {schoolConfig.name.short} and
                start your admission journey today.
              </p>
            </div>

            <div className="space-y-4 max-w-md">
              <div className="flex items-center gap-4 rounded-lg bg-primary-foreground/10 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <Shield className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-primary-foreground">
                    Simplified Onboarding
                  </p>
                  <p className="text-sm text-primary-foreground/70">
                    Email checks are temporarily skipped
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-lg bg-primary-foreground/10 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <CheckCircle2 className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-medium text-primary-foreground">
                    Auto-fill Details
                  </p>
                  <p className="text-sm text-primary-foreground/70">
                    Faster account setup
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Registration Form */}
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
            {/* Progress Steps */}
            <div className="mb-6 flex items-center justify-center gap-3">
              {steps.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                      step >= s.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={`h-1 w-12 rounded ${
                        step > s.id ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mb-4 flex justify-center">
              <Badge variant="secondary">
                Current stage: {currentStageLabel}
              </Badge>
            </div>

            <Card className="border-0 shadow-lg">
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="font-serif text-2xl">
                  {step === 1 && "Create your profile"}
                  {step === 2 &&
                    !SKIP_EMAIL_VERIFICATION &&
                    "Verify your email"}
                  {step === 3 && "Pay application fee"}
                  {step === 4 && !SKIP_EMAIL_VERIFICATION && "Verify NIN"}
                </CardTitle>
                <CardDescription>
                  {step === 1 &&
                    (SKIP_EMAIL_VERIFICATION
                      ? "Provide your details to start your admission journey."
                      : "Provide your details to start.")}
                  {step === 2 &&
                    !SKIP_EMAIL_VERIFICATION &&
                    "Enter the code sent to your email to unlock payments."}
                  {step === 3 &&
                    (SKIP_EMAIL_VERIFICATION
                      ? "Pay the application fee to continue to your dashboard."
                      : "Pay the application fee to continue.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {step === 1 && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First name</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              firstName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last name</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              lastName: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="otherName">Other name</Label>
                        <Input
                          id="otherName"
                          value={formData.otherName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              otherName: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone number</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="+234XXXXXXXXXX"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              password: e.target.value,
                            })
                          }
                          placeholder="Create a strong password"
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

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="rounded-lg bg-info/10 p-4 text-sm text-info">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertCircle className="h-4 w-4" />
                        {SKIP_EMAIL_VERIFICATION
                          ? "Profile → Application fee → Application form."
                          : "Profile → Email verification → Application fee → Application form."}
                      </div>
                      <p className="mt-2 text-info/80">
                        {SKIP_EMAIL_VERIFICATION
                          ? "Email verification is temporarily disabled for this setup."
                          : "We will send a verification code to your email after creating the account."}
                      </p>
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
                          Creating profile...
                        </span>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Create profile
                        </>
                      )}
                    </Button>
                  </form>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="verificationCode">
                        Email verification code
                      </Label>
                      <Input
                        id="verificationCode"
                        placeholder="Enter the 6-digit code"
                        value={verificationCode}
                        onChange={(e) =>
                          setVerificationCode(e.target.value.replace(/\D/g, ""))
                        }
                        maxLength={6}
                      />
                    </div>
                    <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      <MailCheck className="mr-2 inline-block h-4 w-4 text-primary" />
                      We sent a code to {formData.email || "your email"}. Use it
                      to verify and continue.
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (hasAccountCreated) {
                            navigate("/student/login", { replace: true });
                            return;
                          }
                          setStep(1);
                        }}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button
                        variant="portal"
                        className="flex-1"
                        onClick={handleVerifyEmail}
                        disabled={isVerifyingEmail}
                      >
                        {isVerifyingEmail ? "Verifying..." : "Verify email"}
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-warning/10 p-4">
                      <div className="flex items-center gap-2 text-warning">
                        <CreditCard className="h-4 w-4" />
                        <span className="font-medium">
                          Application fee: ₦{applicationFee.toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-warning/80">
                        {SKIP_EMAIL_VERIFICATION
                          ? "Pay to continue to the application form."
                          : "Pay to continue to the application form."}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {!hasAccountCreated && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setStep(SKIP_EMAIL_VERIFICATION ? 1 : 2)
                          }
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" /> Back
                        </Button>
                      )}
                      <Button
                        variant="portal"
                        className="flex-1"
                        onClick={handlePayApplicationFee}
                        disabled={isPaying}
                      >
                        {isPaying
                          ? "Processing payment..."
                          : "Pay application fee"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/student/login"
                className="text-primary hover:underline"
              >
                Sign In
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
