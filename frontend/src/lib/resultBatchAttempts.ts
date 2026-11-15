type ResultAttempt = Record<string, unknown> & {
  student_id?: string;
  is_pending_carryover?: boolean;
};

type ClassListEntry = Record<string, unknown> & {
  student_id?: string;
  registration_type?: string;
};

export function getResultAttemptIdentifier(
  attempt?: Record<string, unknown> | null,
): string {
  if (!attempt || typeof attempt !== "object") return "";
  return String(attempt.matric_number || attempt.admission_number || "");
}

export function mergeMissingCarryoverAttempts(
  savedAttempts: ResultAttempt[],
  classList: ClassListEntry[],
): ResultAttempt[] {
  const safeAttempts = Array.isArray(savedAttempts) ? savedAttempts : [];
  const safeClassList = Array.isArray(classList) ? classList : [];

  const includedStudentIds = new Set(
    safeAttempts
      .filter((attempt): attempt is ResultAttempt => Boolean(attempt && typeof attempt === "object"))
      .map((attempt) => attempt.student_id)
      .filter((studentId): studentId is string => Boolean(studentId)),
  );
  const missingCarryovers: ResultAttempt[] = [];

  safeClassList.forEach((student) => {
    if (!student || typeof student !== "object") return;
    const studentId = student.student_id;
    const registrationType = String(
      student.registration_type || "",
    ).toUpperCase();
    const isVerifiedCarryover = Boolean(
      (student as any).is_carryover === true ||
      (student as any).is_carryover === 1 ||
      (student as any).origin_result_attempt_id ||
      (student as any).previous_attempt
    );
    if (
      !studentId ||
      includedStudentIds.has(studentId) ||
      !["CARRYOVER", "REPEAT"].includes(registrationType) ||
      !isVerifiedCarryover
    ) {
      return;
    }

    missingCarryovers.push({
      ...student,
      id: null,
      ca_score: null,
      exam_score: null,
      total_score: null,
      grade: null,
      grade_point: null,
      quality_point: null,
      is_locked: 0,
      is_pending_carryover: true,
      is_carryover: 1,
      registration_type: "CARRYOVER",
    });
    includedStudentIds.add(studentId);
  });

  return [...safeAttempts, ...missingCarryovers];
}

export function selectAttemptsForSave(
  attempts: ResultAttempt[],
): ResultAttempt[] {
  const safeAttempts = Array.isArray(attempts) ? attempts : [];
  return safeAttempts.filter((attempt) => {
    if (!attempt || typeof attempt !== "object") return false;
    if (!attempt.is_pending_carryover) {
      return true;
    }

    const hasCaScore =
      attempt.ca_score !== null &&
      attempt.ca_score !== undefined &&
      attempt.ca_score !== "";
    const hasExamScore =
      attempt.exam_score !== null &&
      attempt.exam_score !== undefined &&
      attempt.exam_score !== "";
    const isAbsent = String(attempt.grade || "").toUpperCase() === "ABS";

    return hasCaScore || hasExamScore || isAbsent;
  });
}
