import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import {
  buildStudentRegisterRoute,
  extractApiData,
  isExistingStudentProfile,
  loadLocalOnboardingStatus,
  readStoredStudentProfile,
  requiresStudentProfileUpdate,
  resolveOnboardingFlags,
  resolveOnboardingStep,
  saveLocalOnboardingStatus,
} from "@/lib/onboarding";

type RequireOnboardingCompleteProps = {
  children: ReactNode;
};

export default function RequireOnboardingComplete({
  children,
}: RequireOnboardingCompleteProps) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      const storedProfile = readStoredStudentProfile();
      const storedEmail =
        typeof storedProfile?.email === "string" ? storedProfile.email : "";

      if (!storedEmail) {
        if (!mounted) return;
        setRedirectTo("/student/login");
        setIsChecking(false);
        return;
      }

      let profileData = storedProfile;
      let progressData: unknown = null;

      const [profileRes, progressRes] = await Promise.allSettled([
        api.getStudentProfile(),
        api.getApplicationProgress(),
      ]);

      if (profileRes.status === "fulfilled") {
        const parsed = extractApiData<Record<string, unknown>>(profileRes.value);
        if (parsed) {
          profileData = parsed;
          try {
            localStorage.setItem("mccas_profile", JSON.stringify(parsed));
            localStorage.setItem("MCCAS_profile", JSON.stringify(parsed));
          } catch (error) {
            // ignore storage failures
          }
        }
      }

      if (progressRes.status === "fulfilled") {
        progressData = extractApiData(progressRes.value);
      }

      const email =
        (typeof profileData?.email === "string" && profileData.email) ||
        storedEmail;

      const localFlags = loadLocalOnboardingStatus(email);
      const mergedFlags = resolveOnboardingFlags(
        localFlags,
        profileData,
        progressData,
        isExistingStudentProfile(profileData)
          ? { application_fee_paid: true }
          : null,
      );

      saveLocalOnboardingStatus(email, mergedFlags);

      const step = resolveOnboardingStep(mergedFlags);
      if (!mounted) return;

      if (step < 5) {
        setRedirectTo(buildStudentRegisterRoute(step, email));
      } else if (
        requiresStudentProfileUpdate(profileData) &&
        location.pathname !== "/student/profile"
      ) {
        setRedirectTo("/student/profile");
      } else {
        setRedirectTo(null);
      }
      setIsChecking(false);
    };

    void checkAccess();

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  if (isChecking) {
    return null;
  }

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
