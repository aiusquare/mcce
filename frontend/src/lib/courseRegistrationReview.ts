export type RegistrationProcessInput = {
  action: "approve" | "return";
  reason?: string;
};

export type RegistrationIndexRow = {
  id?: unknown;
  student_id?: unknown;
};

type RegistrationRecord = Record<string, unknown> & {
  id?: unknown;
};

type RegistrationItem = Record<string, unknown> & {
  id?: unknown;
  course_level?: unknown;
  code?: unknown;
};

export type RegistrationDetails = {
  registration?: RegistrationRecord;
  items?: RegistrationItem[];
};

export function registrationDetailsQueryKey(registrationId: string) {
  return ["course-registration-details", registrationId] as const;
}

export function buildRegistrationDetailsPath(registrationId: string) {
  return `/api/admin/course-registration/registrations/details?id=${encodeURIComponent(registrationId)}`;
}

export function buildRegistrationProcessPayload(
  registrationId: string,
  input: RegistrationProcessInput,
) {
  return {
    registration_id: registrationId,
    ...input,
  };
}

export function collectStudentRegistrationIds(
  registrations: RegistrationIndexRow[],
  studentId: string,
  selectedRegistrationId: string,
) {
  const ids = new Set<string>([selectedRegistrationId]);

  registrations.forEach((registration) => {
    if (
      registration.student_id === studentId &&
      typeof registration.id === "string" &&
      registration.id
    ) {
      ids.add(registration.id);
    }
  });

  return Array.from(ids);
}

export function mergeStudentRegistrationDetails(
  selectedRegistrationId: string,
  details: RegistrationDetails[],
) {
  const selectedDetails =
    details.find(
      (detail) => detail.registration?.id === selectedRegistrationId,
    ) || details[0];

  if (!selectedDetails?.registration) {
    return null;
  }

  const seenItemIds = new Set<string>();
  const items = details
    .flatMap((detail) => detail.items || [])
    .filter((item) => {
      if (typeof item.id !== "string" || !item.id) return true;
      if (seenItemIds.has(item.id)) return false;
      seenItemIds.add(item.id);
      return true;
    })
    .sort((left, right) => {
      const levelOrder = String(left.course_level || "").localeCompare(
        String(right.course_level || ""),
        undefined,
        { numeric: true, sensitivity: "base" },
      );
      if (levelOrder !== 0) return levelOrder;
      return String(left.code || "").localeCompare(String(right.code || ""));
    });

  return {
    registration: selectedDetails.registration,
    items,
  };
}
