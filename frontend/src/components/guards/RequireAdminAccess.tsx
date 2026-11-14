import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api from "@/lib/api";
import {
  AdminSession,
  canAccessPath,
  canAccessResource,
  firstAccessibleAdminPath,
  normalizeAdminSession,
  readAdminSession,
  clearAdminSession,
  saveAdminSession,
} from "@/lib/adminAccess";

type RequireAdminAccessProps = {
  children: ReactNode;
  resourceSlug?: string;
};

export default function RequireAdminAccess({
  children,
  resourceSlug,
}: RequireAdminAccessProps) {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [session, setSession] = useState<AdminSession | null>(() =>
    readAdminSession(),
  );

  useEffect(() => {
    let mounted = true;

    const refreshSession = async () => {
      const storedSession = readAdminSession();
      if (!storedSession) {
        if (!mounted) return;
        setSession(null);
        setIsChecking(false);
        return;
      }

      try {
        const response = await api.get("/api/admin/me");
        const refreshedSession = normalizeAdminSession(
          response,
          storedSession.email,
        );

        if (!refreshedSession.roles.length && storedSession.roles.length) {
          refreshedSession.roles = storedSession.roles;
        }
        if (
          !refreshedSession.permissions.length &&
          storedSession.permissions.length
        ) {
          refreshedSession.permissions = storedSession.permissions;
        }

        saveAdminSession(refreshedSession);
        if (mounted) setSession(refreshedSession);
      } catch (error) {
        const status =
          error && typeof error === "object" && "status" in error
            ? (error as { status?: number }).status
            : undefined;

        if (status === 401 || status === 403) {
          clearAdminSession();
          if (mounted) setSession(null);
          return;
        }

        if (mounted) setSession(storedSession);
      } finally {
        if (mounted) setIsChecking(false);
      }
    };

    void refreshSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (isChecking) {
    return null;
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (session.must_change_password && location.pathname !== "/admin/change-password") {
    return <Navigate to="/admin/change-password" replace />;
  }

  const hasAccess = resourceSlug
    ? canAccessResource(session, resourceSlug)
    : canAccessPath(session, location.pathname);

  if (!hasAccess) {
    return <Navigate to={firstAccessibleAdminPath(session)} replace />;
  }

  return <>{children}</>;
}
