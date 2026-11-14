export type OnboardingFlags = {
  emailVerified?: boolean;
  applicationFeePaid?: boolean;
  ninVerified?: boolean;
};

export type OnboardingStep = 2 | 3 | 4 | 5;

export const SKIP_EMAIL_VERIFICATION = true;

const ONBOARDING_STORAGE_PREFIX = "mccas_onboarding_status:";
const LEGACY_ONBOARDING_STORAGE_PREFIX = "MCCAS_onboarding_status:";
const APPLICATION_FEE_STORAGE_PREFIX = "mccas_application_fee_paid:";
const LEGACY_APPLICATION_FEE_STORAGE_PREFIX = "MCCAS_application_fee_paid:";

const TRUE_VALUES = new Set([
  "1",
  "true",
  "yes",
  "y",
  "paid",
  "verified",
  "complete",
  "completed",
  "done",
  "success",
  "successful",
]);

const FALSE_VALUES = new Set([
  "0",
  "false",
  "no",
  "n",
  "unpaid",
  "pending",
  "failed",
  "failure",
  "unverified",
  "incomplete",
]);

const PROFILE_COMPLETE_VALUES = new Set([
  "complete",
  "completed",
  "verified",
  "updated",
]);

const PROFILE_INCOMPLETE_VALUES = new Set([
  "pending",
  "incomplete",
  "required",
  "needs_update",
  "needs update",
  "draft",
]);

const EMAIL_KEYS = [
  "email_verified",
  "emailverified",
  "is_email_verified",
  "isemailverified",
  "verified_email",
  "everified",
  "evarified",
];

const FEE_KEYS = [
  "application_fee_paid",
  "applicationfeepaid",
  "is_application_fee_paid",
  "isapplicationfeepaid",
  "fee_paid",
  "has_paid_application_fee",
  "application_payment_status",
  "paid",
];

const NIN_KEYS = [
  "nin_verified",
  "ninverified",
  "is_nin_verified",
  "isninverified",
  "nin_status",
  "nin_validation_status",
];

function normalizeKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TRUE_VALUES.has(normalized)) return true;
    if (FALSE_VALUES.has(normalized)) return false;
  }
  return undefined;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function collectObjects(source: unknown): Record<string, unknown>[] {
  const root = asObject(source);
  if (!root) return [];

  const out: Record<string, unknown>[] = [];
  const queue: Record<string, unknown>[] = [root];
  const seen = new Set<Record<string, unknown>>();
  let depth = 0;

  while (queue.length > 0 && depth < 3) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i += 1) {
      const current = queue.shift();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      out.push(current);
      Object.values(current).forEach((value) => {
        const obj = asObject(value);
        if (obj) queue.push(obj);
      });
    }
    depth += 1;
  }

  return out;
}

function readFlagFromObject(
  source: Record<string, unknown>,
  candidateKeys: string[],
): boolean | undefined {
  const wanted = new Set(candidateKeys.map(normalizeKey));
  for (const [key, value] of Object.entries(source)) {
    if (!wanted.has(normalizeKey(key))) continue;
    const parsed = toBoolean(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function readFlagFromSteps(source: Record<string, unknown>): OnboardingFlags {
  const steps = source.steps;
  if (!Array.isArray(steps)) return {};

  const resolved: OnboardingFlags = {};

  steps.forEach((rawStep) => {
    const step = asObject(rawStep);
    if (!step) return;

    const rawName = step.name ?? step.title ?? step.label;
    const name =
      typeof rawName === "string" ? rawName.trim().toLowerCase() : "";
    if (!name) return;

    const stateCandidates = [
      step.completed,
      step.done,
      step.verified,
      step.paid,
      step.status,
      step.state,
    ];

    let stepValue: boolean | undefined;
    for (const candidate of stateCandidates) {
      stepValue = toBoolean(candidate);
      if (stepValue !== undefined) break;
    }
    if (stepValue === undefined) return;

    if (name.includes("email") && name.includes("verif")) {
      resolved.emailVerified = stepValue;
    }
    if (
      (name.includes("application") && name.includes("fee")) ||
      (name.includes("application") && name.includes("payment")) ||
      (name.includes("fee") && name.includes("payment"))
    ) {
      resolved.applicationFeePaid = stepValue;
    }
    if (name.includes("nin") && name.includes("verif")) {
      resolved.ninVerified = stepValue;
    }
  });

  return resolved;
}

function readFlagFromProgressObject(
  source: Record<string, unknown>,
): OnboardingFlags {
  return {
    applicationFeePaid:
      readFlagFromObject(source, FEE_KEYS) ??
      toBoolean(source.application_fee_paid ?? source.applicationFeePaid),
  };
}

function mergeFlags(base: OnboardingFlags, incoming: OnboardingFlags) {
  return {
    emailVerified:
      incoming.emailVerified !== undefined
        ? incoming.emailVerified
        : base.emailVerified,
    applicationFeePaid:
      incoming.applicationFeePaid !== undefined
        ? incoming.applicationFeePaid
        : base.applicationFeePaid,
    ninVerified:
      incoming.ninVerified !== undefined
        ? incoming.ninVerified
        : base.ninVerified,
  };
}

export function resolveOnboardingFlags(...sources: unknown[]): OnboardingFlags {
  let resolved: OnboardingFlags = {};

  sources.forEach((source) => {
    const objects = collectObjects(source);
    objects.forEach((obj) => {
      resolved = mergeFlags(resolved, {
        emailVerified: readFlagFromObject(obj, EMAIL_KEYS),
        applicationFeePaid: readFlagFromObject(obj, FEE_KEYS),
        ninVerified: readFlagFromObject(obj, NIN_KEYS),
      });
      resolved = mergeFlags(resolved, readFlagFromSteps(obj));
      resolved = mergeFlags(resolved, readFlagFromProgressObject(obj));
    });
  });

  if (SKIP_EMAIL_VERIFICATION) {
    resolved.emailVerified = true;
    resolved.ninVerified = true;
  }

  return resolved;
}

export function hasOnboardingSignals(flags?: OnboardingFlags | null) {
  if (!flags) return false;
  return (
    flags.emailVerified !== undefined ||
    flags.applicationFeePaid !== undefined ||
    flags.ninVerified !== undefined
  );
}

export function resolveOnboardingStep(flags?: OnboardingFlags | null): OnboardingStep {
  if (SKIP_EMAIL_VERIFICATION) {
    if (flags?.applicationFeePaid !== true) return 3;
    return 5;
  }

  if (!flags || flags.emailVerified !== true) return 2;
  if (flags.applicationFeePaid !== true) return 3;
  if (flags.ninVerified !== true) return 4;
  return 5;
}

function readString(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) return "";
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function isExistingStudentProfile(source: unknown) {
  const objects = collectObjects(source);
  return objects.some((obj) => {
    const status = readString(obj, [
      "student_status",
      "admission_status",
      "status",
    ]).toLowerCase();
    return Boolean(
      obj.student_id ||
        obj.matric_number ||
        obj.matricNumber ||
        obj.admission_number ||
        obj.admissionNumber ||
        status === "admitted",
    );
  });
}

export function requiresStudentProfileUpdate(source: unknown) {
  const objects = collectObjects(source);
  return objects.some((obj) => {
    const requiredFlag = toBoolean(
      obj.account_update_required ??
        obj.requires_account_update ??
        obj.profile_update_required,
    );
    const completionStatus = readString(obj, [
      "profile_completion_status",
      "profile_status",
      "account_update_status",
      "onboarding_status",
    ]).toLowerCase();
    const sourceType = readString(obj, [
      "onboarding_source",
      "created_source",
      "source",
    ]).toLowerCase();

    if (requiredFlag === false) return false;
    if (PROFILE_COMPLETE_VALUES.has(completionStatus)) return false;
    if (requiredFlag === true) return true;
    if (PROFILE_INCOMPLETE_VALUES.has(completionStatus)) return true;
    return sourceType.includes("bulk") || sourceType.includes("import");
  });
}

export function hasCompletedStudentProfileUpdate(source: unknown) {
  return isExistingStudentProfile(source) && !requiresStudentProfileUpdate(source);
}

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

export function loadLocalOnboardingStatus(email?: string | null): OnboardingFlags | null {
  const keyEmail = normalizeEmail(email);
  if (!keyEmail) return null;

  try {
    const raw =
      localStorage.getItem(`${ONBOARDING_STORAGE_PREFIX}${keyEmail}`) ||
      localStorage.getItem(`${LEGACY_ONBOARDING_STORAGE_PREFIX}${keyEmail}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingFlags;
    const applicationFeePaid = loadApplicationFeePaidStatus(keyEmail) ?? false;
    return {
      emailVerified: toBoolean(parsed.emailVerified),
      applicationFeePaid,
      ninVerified: toBoolean(parsed.ninVerified),
    };
  } catch (error) {
    return null;
  }
}

export function saveLocalOnboardingStatus(
  email: string,
  patch: OnboardingFlags,
) {
  const keyEmail = normalizeEmail(email);
  if (!keyEmail) return;

  const current = loadLocalOnboardingStatus(keyEmail) || {};
  const next = mergeFlags(current, patch);

  try {
    localStorage.setItem(
      `${ONBOARDING_STORAGE_PREFIX}${keyEmail}`,
      JSON.stringify(next),
    );
    const json = JSON.stringify(next);
    localStorage.setItem(`${ONBOARDING_STORAGE_PREFIX}${keyEmail}`, json);
    localStorage.setItem(`${LEGACY_ONBOARDING_STORAGE_PREFIX}${keyEmail}`, json);
    if (patch.applicationFeePaid !== undefined) {
      setApplicationFeePaidStatus(keyEmail, patch.applicationFeePaid);
    }
  } catch (error) {
    // ignore storage failures
  }
}

export function loadApplicationFeePaidStatus(email?: string | null) {
  const keyEmail = normalizeEmail(email);
  if (!keyEmail) return undefined;

  try {
    return toBoolean(
      localStorage.getItem(`${APPLICATION_FEE_STORAGE_PREFIX}${keyEmail}`),
    );
    const val =
      localStorage.getItem(`${APPLICATION_FEE_STORAGE_PREFIX}${keyEmail}`) ||
      localStorage.getItem(`${LEGACY_APPLICATION_FEE_STORAGE_PREFIX}${keyEmail}`);
    return toBoolean(val);
  } catch (error) {
    return undefined;
  }
}

export function setApplicationFeePaidStatus(
  email: string,
  isPaid: boolean,
) {
  const keyEmail = normalizeEmail(email);
  if (!keyEmail) return;

  try {
    localStorage.setItem(
      `${APPLICATION_FEE_STORAGE_PREFIX}${keyEmail}`,
      String(isPaid),
    );
    const str = String(isPaid);
    localStorage.setItem(`${APPLICATION_FEE_STORAGE_PREFIX}${keyEmail}`, str);
    localStorage.setItem(`${LEGACY_APPLICATION_FEE_STORAGE_PREFIX}${keyEmail}`, str);
  } catch (error) {
    // ignore storage failures
  }
}

export function buildStudentRegisterRoute(
  step: OnboardingStep,
  email?: string | null,
) {
  if (step >= 5) return "/student/dashboard";
  const params = new URLSearchParams();
  params.set("step", String(step));
  if (email) {
    params.set("email", email);
  }
  return `/student/register?${params.toString()}`;
}

export function readStoredStudentProfile() {
  try {
    const raw =
      localStorage.getItem("mccas_profile") ||
      localStorage.getItem("MCCAS_profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string } & Record<string, unknown>;
    return parsed;
  } catch (error) {
    return null;
  }
}

export function extractApiData<T = unknown>(payload: unknown): T | null {
  const obj = asObject(payload);
  if (!obj) return null;
  if ("data" in obj) {
    return (obj.data as T) || null;
  }
  return obj as unknown as T;
}
