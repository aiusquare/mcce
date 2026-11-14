/**
 * Recursively cleans corrupted replacement characters (U+FFFD ),
 * Windows-1252 byte remnants, HTML entities, and mangled quotes,
 * normalizing them to standard apostrophe (').
 */
export function cleanCorruptedChars<T>(val: T): T {
  if (typeof val === "string") {
    return val
      .replace(/[\uFFFD\u0091\u0092\u2018\u2019\u02BC\u02BB`´]/g, "'")
      .replace(/&#65533;/g, "'") as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map(cleanCorruptedChars) as unknown as T;
  }
  if (val !== null && typeof val === "object") {
    const copy: any = {};
    for (const k of Object.keys(val)) {
      copy[k] = cleanCorruptedChars((val as any)[k]);
    }
    return copy as T;
  }
  return val;
}

export const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(
  /\/$/,
  "",
);

const ADMIN_SESSION_STORAGE_KEY = "mccas_admin_session";
const LEGACY_ADMIN_SESSION_STORAGE_KEY = "MCCAS_admin_session";

type ApiError = Error & {
  status?: number;
  body?: { message?: string };
};

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(method !== "GET" && method !== "HEAD"
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  try {
    const rawAdminSession =
      localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_ADMIN_SESSION_STORAGE_KEY);
    const adminSession = rawAdminSession
      ? (JSON.parse(rawAdminSession) as { token?: string })
      : null;
    if (adminSession?.token && !headers.Authorization) {
      headers.Authorization = `Bearer ${adminSession.token}`;
    }
  } catch (error) {
    // ignore storage failures
  }

  const res = await fetch(url, {
    headers,
    credentials: "include",
    ...options,
  });

  let body: unknown = null;
  try {
    const rawText = await res.text();
    try {
      body = JSON.parse(rawText);
    } catch {
      // If server printed PHP notices or warnings before the JSON array/object, extract valid JSON
      const arrayStart = rawText.indexOf("[");
      const objStart = rawText.indexOf("{");
      let startIdx = -1;
      if (arrayStart !== -1 && objStart !== -1) {
        startIdx = Math.min(arrayStart, objStart);
      } else if (arrayStart !== -1) {
        startIdx = arrayStart;
      } else if (objStart !== -1) {
        startIdx = objStart;
      }

      if (startIdx !== -1) {
        try {
          body = JSON.parse(rawText.slice(startIdx));
        } catch {
          // unable to parse
        }
      }
    }
    if (body) {
      body = cleanCorruptedChars(body);
    }
  } catch (e) {
    // ignore
  }

  if (!res.ok) {
    if (res.status === 503 && typeof body === "object" && body && (body as any).code === "STUDENT_PORTAL_MAINTENANCE") {
      sessionStorage.setItem("maintenance_data", JSON.stringify((body as any).data || {}));
      if (!window.location.pathname.includes("/student/maintenance")) {
          window.location.href = "/student/maintenance";
      }
      throw new Error("Student portal is in maintenance mode");
    }

    const err = new Error(
      typeof body === "object" &&
        body &&
        "message" in body &&
        (body as { message?: string }).message
        ? (body as { message?: string }).message
        : `Request failed: ${res.status}`,
    ) as ApiError;
    err.status = res.status;
    err.body = body as ApiError["body"];
    throw err;
  }

  // If we got a 200 but failed to parse JSON, the backend likely returned an HTML error page.
  if (
    body === null &&
    res.status !== 204 &&
    res.headers.get("content-length") !== "0"
  ) {
    throw new Error(
      "Received an invalid response from the server. Check your API connection.",
    );
  }

  return body;
}

export async function registerAccount(payload: {
  full_name: string;
  email: string;
  password: string;
  phone?: string | null;
  nin?: string | null;
}) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginAccount(payload: {
  email: string;
  password: string;
}) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function getStoredEmail() {
  try {
    const storedProfile =
      localStorage.getItem("mccas_profile") ||
      localStorage.getItem("MCCAS_profile");
    if (!storedProfile) {
      return null;
    }
    const profile = JSON.parse(storedProfile) as { email?: string };
    return profile?.email ? String(profile.email) : null;
  } catch (err) {
    return null;
  }
}

function withEmail(path: string) {
  const email = getStoredEmail();
  if (!email) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}email=${encodeURIComponent(email)}`;
}

function withProvidedEmail(path: string, email?: string | null) {
  const resolvedEmail = (email || "").trim() || getStoredEmail() || "";
  if (!resolvedEmail) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}email=${encodeURIComponent(resolvedEmail)}`;
}

export async function getStudentProfile() {
  return request(withEmail("/api/student/profile"), {
    method: "GET",
  });
}

export async function getApplicationProgress() {
  return request(withEmail("/api/student/progress"), {
    method: "GET",
  });
}

type StudentProgressUpdatePayload = {
  email?: string;
  stage?: string;
  current_step?: number;
  onboarding_step?: number;
  email_verified?: boolean;
  application_fee_paid?: boolean;
  nin_verified?: boolean;
  is_submitted?: boolean;
  status?: string;
};

function buildProgressUpdateBody(payload: StudentProgressUpdatePayload) {
  const body: Record<string, unknown> = {
    stage: payload.stage,
    current_step: payload.current_step,
    onboarding_step: payload.onboarding_step,
    email_verified: payload.email_verified,
    application_fee_paid: payload.application_fee_paid,
    nin_verified: payload.nin_verified,
    is_submitted: payload.is_submitted,
    status: payload.status,
  };

  // Compatibility aliases for different backend naming styles
  if (payload.current_step !== undefined) {
    body.currentStep = payload.current_step;
  }
  if (payload.onboarding_step !== undefined) {
    body.onboardingStep = payload.onboarding_step;
  }
  if (payload.email_verified !== undefined) {
    body.emailVerified = payload.email_verified;
  }
  if (payload.application_fee_paid !== undefined) {
    body.applicationFeePaid = payload.application_fee_paid;
    body.fee_paid = payload.application_fee_paid;
    body.paid = payload.application_fee_paid;
  }
  if (payload.nin_verified !== undefined) {
    body.ninVerified = payload.nin_verified;
    body.isValidated = payload.nin_verified;
  }
  if (payload.is_submitted !== undefined) {
    body.isSubmitted = payload.is_submitted;
  }

  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  );
}

async function updateStudentProgress(payload: StudentProgressUpdatePayload) {
  const requestBody = buildProgressUpdateBody(payload);
  const endpoints = [
    "/api/student/progress",
    "/api/student/progress/update",
    "/api/student/progress/onboarding",
    "/api/student/onboarding/progress",
    "/api/student/onboarding",
  ];
  const methods: Array<"PATCH" | "POST" | "PUT"> = ["PATCH", "POST", "PUT"];

  let lastError: ApiError | null = null;

  for (const endpoint of endpoints) {
    const path = withProvidedEmail(endpoint, payload.email);
    for (const method of methods) {
      try {
        return await request(path, {
          method,
          body: JSON.stringify(requestBody),
        });
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        lastError = apiErr;
        if ([404, 405, 501].includes(apiErr?.status || 0)) {
          continue;
        }
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to update student progress");
}

export async function updateOnboardingProgress(payload: {
  email?: string;
  onboarding_step?: number;
  email_verified?: boolean;
  application_fee_paid?: boolean;
  nin_verified?: boolean;
}) {
  return updateStudentProgress({
    ...payload,
    stage: "onboarding",
  });
}

export async function updateApplicationProgressStep(payload: {
  email?: string;
  current_step: number;
  status?: string;
}) {
  return updateStudentProgress({
    ...payload,
    stage: "application",
  });
}

export async function submitApplication(payload: unknown) {
  return request(withEmail("/api/student/application"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSubmittedApplication() {
  return request(withEmail("/api/student/application"), {
    method: "GET",
  });
}

export function getSubmittedApplicationPdfUrl() {
  return `${API_BASE}${withEmail("/api/student/application/pdf")}`;
}

export async function getNotifications() {
  return request(withEmail("/api/student/notifications"), {
    method: "GET",
  });
}

export async function getAdmissionStatus() {
  return request(withEmail("/api/student/admission-status"), {
    method: "GET",
  });
}

export async function markAcceptanceFeePaid(payload: {
  amount?: number;
  reference?: string;
  admission_number?: string | null;
}) {
  return request(withEmail("/api/student/acceptance-fee/mark-paid"), {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function getStudentPayments() {
  return request(withEmail("/api/student/payments"), {
    method: "GET",
  });
}

export async function payStudentInvoice(payload: {
  invoice_id: string;
  method: string;
  reference?: string;
  gateway?: string;
}) {
  return request(withEmail("/api/student/payments/pay"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function topUpStudentWallet(payload: {
  amount: number;
  method: string;
  reference?: string;
  gateway?: string;
}) {
  return request(withEmail("/api/student/wallet/top-up"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createStudentWalletFundingAccount(payload?: {
  gateway?: string;
  preferred_bank?: string;
  consent?: boolean;
}) {
  return request(withEmail("/api/student/wallet/funding-accounts"), {
    method: "POST",
    body: JSON.stringify({
      gateway: payload?.gateway || "paystack",
      preferred_bank: payload?.preferred_bank,
      consent: payload?.consent ?? true,
    }),
  });
}

export async function requeryStudentWalletFundingAccount(payload: {
  gateway?: string;
  account_number?: string;
  provider_slug?: string;
}) {
  return request(withEmail("/api/student/wallet/funding-accounts/requery"), {
    method: "POST",
    body: JSON.stringify({
      gateway: payload.gateway || "paystack",
      account_number: payload.account_number,
      provider_slug: payload.provider_slug,
    }),
  });
}

export async function verifyApplicationFeePayment(payload: {
  email?: string;
  reference: string;
  amount: number;
}) {
  return request(
    withProvidedEmail("/api/student/application-fee/verify", payload.email),
    {
      method: "POST",
      body: JSON.stringify({
        reference: payload.reference,
        amount: payload.amount,
      }),
    },
  );
}

export async function getCourseRegistration() {
  return request(withEmail("/api/student/course-registration"), {
    method: "GET",
  });
}

export async function submitCourseRegistration(payload: {
  course_ids: string[];
}) {
  return request(withEmail("/api/student/course-registration/submit"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCourseRegistrationTemplateUrl() {
  return `${API_BASE}${withEmail("/api/student/course-registration/template")}`;
}

export async function getAdminApplications() {
  return request("/api/admin/applications", { method: "GET" });
}

export async function updateApplicationStatus(payload: {
  id?: string | number | null;
  application_no?: string | null;
  status: string;
  notes?: string | null;
  department_id?: string | null;
  programme_id?: string | null;
  session?: string | null;
  entry_level?: string | null;
  mode_of_entry?: string | null;
  lecture_start?: string | null;
  registration_close?: string | null;
  matric_number?: string | null;
}) {
  const body = {
    id: payload.id ?? undefined,
    application_no: payload.application_no ?? undefined,
    status: payload.status,
    notes: payload.notes ?? undefined,
    department_id: payload.department_id ?? undefined,
    programme_id: payload.programme_id ?? undefined,
    session: payload.session ?? undefined,
    entry_level: payload.entry_level ?? undefined,
    mode_of_entry: payload.mode_of_entry ?? undefined,
    lecture_start: payload.lecture_start ?? undefined,
    registration_close: payload.registration_close ?? undefined,
    matric_number: payload.matric_number ?? undefined,
  };

  return request("/api/admin/applications/update-status", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function exportAdminApplicationsCsv() {
  return request("/api/admin/applications/export-csv", { method: "GET" });
}

export async function bulkAdmitApplicationsCsv(payload: {
  csv: string;
  programme_id: string;
  session: string;
  entry_level: string;
  mode_of_entry: string;
  lecture_start: string;
  registration_close: string;
  notes?: string | null;
}) {
  return request("/api/admin/applications/bulk-admit-csv", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type BulkOnboardStudentCsvPayload = {
  csv: string;
  default_status?: string;
  notify_students?: boolean;
};

export async function bulkOnboardStudentsCsv(
  payload: BulkOnboardStudentCsvPayload,
) {
  return request("/api/admin/students/bulk-onboard-csv", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function exportAdminStudentsCsv(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request(`/api/admin/students/export${query}`, { method: "GET" });
}

export function getBulkStudentOnboardingTemplateCsv() {
  return [
    "first_name,last_name,other_name,email,phone_number,admission_number,department,programme,level_of_admission,session_of_entry,entry_mode,status,temporary_password,programme_reference,reference_department,reference_code,reference_structure,reference_duration_years",
    'Amina,Sani,,amina.sani@example.com,"=""08012345670""",ADM-2026-001,Arts and Islamic Studies,B.A Hausa,200,2026/2027,Direct Entry,active,ChangeMe123!,,,,,',
  ].join("\n");
}

export type StudentProfileUpdatePayload = {
  phone?: string | null;
  address?: string | null;
  state?: string | null;
  lga?: string | null;
  dob?: string | null;
  gender?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_relationship?: string | null;
  guardian_address?: string | null;
  next_of_kin?: string | null;
  next_of_kin_phone?: string | null;
  primary_school?: string | null;
  primary_year?: string | null;
  secondary_school?: string | null;
  secondary_year?: string | null;
  qualification?: string | null;
  graduation_year?: string | null;
  exam_number?: string | null;
  exam_center?: string | null;
  exam_year?: string | null;
  qualification2?: string | null;
  exam_number2?: string | null;
  exam_center2?: string | null;
  exam_year2?: string | null;
  education?: unknown;
  academic?: unknown;
  oLevel?: unknown;
  profile_completion_status?: string;
  account_update_required?: boolean;
};

export async function updateStudentProfile(
  payload: StudentProfileUpdatePayload,
) {
  const endpoints = [
    { path: "/api/student/profile", method: "PATCH" as const },
    { path: "/api/student/profile", method: "PUT" as const },
    { path: "/api/student/profile/update", method: "POST" as const },
  ];

  let lastError: ApiError | null = null;
  for (const endpoint of endpoints) {
    try {
      return await request(withEmail(endpoint.path), {
        method: endpoint.method,
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      lastError = apiErr;
      if ([404, 405, 501].includes(apiErr?.status || 0)) {
        continue;
      }
      throw apiErr;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Unable to update student profile");
}

export async function getAdminDashboard() {
  return request("/api/admin/dashboard", { method: "GET" });
}

type QueryParams = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, params?: QueryParams) {
  if (!params) {
    return path;
  }
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    search.set(key, String(value));
  });
  const query = search.toString();
  if (!query) {
    return path;
  }
  return `${path}?${query}`;
}

export async function getAdminProNews(params?: {
  status?: string;
  search?: string;
}) {
  return request(withQuery("/api/admin/pro/news", params), { method: "GET" });
}

export async function createAdminProNews(payload: {
  title: string;
  excerpt?: string;
  content?: string;
  category?: string;
  featured?: boolean;
  status?: string;
  published_at?: string | null;
}) {
  return request("/api/admin/pro/news", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminProNews(
  id: string,
  payload: {
    title?: string;
    excerpt?: string;
    content?: string;
    category?: string;
    featured?: boolean;
    status?: string;
    published_at?: string | null;
  },
) {
  return request(`/api/admin/pro/news/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminProNews(id: string) {
  return request(`/api/admin/pro/news/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAdminProEvents(params?: {
  status?: string;
  search?: string;
}) {
  return request(withQuery("/api/admin/pro/events", params), { method: "GET" });
}

export async function createAdminProEvent(payload: {
  title: string;
  description?: string;
  location?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  status?: string;
  featured?: boolean;
}) {
  return request("/api/admin/pro/events", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminProEvent(
  id: string,
  payload: {
    title?: string;
    description?: string;
    location?: string;
    starts_at?: string | null;
    ends_at?: string | null;
    status?: string;
    featured?: boolean;
  },
) {
  return request(`/api/admin/pro/events/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminProEvent(id: string) {
  return request(`/api/admin/pro/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getAdminProMessages(params?: {
  status?: string;
  search?: string;
}) {
  return request(withQuery("/api/admin/pro/messages", params), {
    method: "GET",
  });
}

export async function updateAdminProMessage(
  id: string,
  payload: {
    status?: string;
    assigned_to?: string;
    internal_note?: string;
  },
) {
  return request(`/api/admin/pro/messages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getAdminProContactChannels() {
  return request("/api/admin/pro/contact-channels", { method: "GET" });
}

export async function updateAdminProContactChannels(payload: unknown) {
  return request("/api/admin/pro/contact-channels", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getPublicNews(params?: {
  category?: string;
  search?: string;
}) {
  return request(withQuery("/api/public/news", params), { method: "GET" });
}

export async function getPublicEvents(params?: { upcoming?: boolean }) {
  return request(withQuery("/api/public/events", params), { method: "GET" });
}

export async function getPublicContactChannels() {
  return request("/api/public/contact-channels", { method: "GET" });
}

export async function submitPublicContactMessage(payload: {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}) {
  return request("/api/public/contact-messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

const api = {
  registerAccount,
  loginAccount,
  getStudentProfile,
  getApplicationProgress,
  updateOnboardingProgress,
  updateApplicationProgressStep,
  submitApplication,
  getSubmittedApplication,
  getSubmittedApplicationPdfUrl,
  getNotifications,
  getAdmissionStatus,
  markAcceptanceFeePaid,
  getStudentPayments,
  payStudentInvoice,
  topUpStudentWallet,
  createStudentWalletFundingAccount,
  requeryStudentWalletFundingAccount,
  verifyApplicationFeePayment,
  getCourseRegistration,
  submitCourseRegistration,
  getCourseRegistrationTemplateUrl,
  getAdminDashboard,
  getAdminApplications,
  updateApplicationStatus,
  exportAdminApplicationsCsv,
  bulkAdmitApplicationsCsv,
  bulkOnboardStudentsCsv,
  exportAdminStudentsCsv,
  getBulkStudentOnboardingTemplateCsv,
  updateStudentProfile,
  getAdminProNews,
  createAdminProNews,
  updateAdminProNews,
  deleteAdminProNews,
  getAdminProEvents,
  createAdminProEvent,
  updateAdminProEvent,
  deleteAdminProEvent,
  getAdminProMessages,
  updateAdminProMessage,
  getAdminProContactChannels,
  updateAdminProContactChannels,
  getPublicNews,
  getPublicEvents,
  getPublicContactChannels,
  submitPublicContactMessage,

  // Generic GET/POST for admin/other endpoints
  get: (path: string) => request(path, { method: "GET" }),
  post: (path: string, body?: unknown) =>
    request(path, {
      method: "POST",
      body: body ? JSON.stringify(cleanCorruptedChars(body)) : undefined,
    }),
  put: (path: string, body?: unknown) =>
    request(path, {
      method: "PUT",
      body: body ? JSON.stringify(cleanCorruptedChars(body)) : undefined,
    }),
  patch: (path: string, body?: unknown) =>
    request(path, {
      method: "PATCH",
      body: body ? JSON.stringify(cleanCorruptedChars(body)) : undefined,
    }),
  delete: (path: string) =>
    request(path, {
      method: "DELETE",
    }),
};

export { api };
export default api;
