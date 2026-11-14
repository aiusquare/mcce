import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "@/lib/api";

type RequireAdmittedStudentProps = {
  children: ReactNode;
};

export default function RequireAdmittedStudent({
  children,
}: RequireAdmittedStudentProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAdmitted, setIsAdmitted] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAdmission = async () => {
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
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    void checkAdmission();

    return () => {
      mounted = false;
    };
  }, []);

  if (isChecking) {
    return null;
  }

  if (!isAdmitted) {
    return <Navigate to="/student/admission-status" replace />;
  }

  return <>{children}</>;
}
