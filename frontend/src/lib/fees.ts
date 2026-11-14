import { api } from "@/lib/api";
import type {
  GeneralInvoice,
  IndividualInvoice,
  InvoiceItem,
  InvoiceType,
  SpecificInvoice,
} from "@/components/admin/invoices/InvoiceTypes";

type ApiObject = Record<string, unknown>;

export type FeeSummary = {
  totalRevenue: number;
  pendingPayments: number;
  studentsPaid: number;
  collectionRate: number;
};

export type InvoicePayload = {
  type: "general" | "specific" | "individual";
  title: string;
  description?: string;
  amount: number;
  items?: InvoiceItem[];
  dueDate: string;
  status?: string;
  targetPrograms?: string[];
  targetLevels?: string[];
  semester?: string;
  academicYear?: string;
  targetProgram?: string;
  targetLevel?: string;
  targetDepartment?: string;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  program?: string;
  level?: string;
};

export type FeeStudent = {
  id: string;
  name: string;
  email: string;
  program: string;
  level: string;
};

export type AcademicSessionOption = {
  id: string;
  name: string;
  isActive?: boolean;
};

export type SessionFeeSettings = {
  sessionId: string;
  sessionName: string;
  applicationFee: number;
  acceptanceFee: number;
  isActive: boolean;
};

const invoiceListPaths = [
  "/api/admin/fees/invoices",
  "/api/admin/invoices",
  "/api/admin/get-invoices",
];

const summaryPaths = [
  "/api/admin/fees/summary",
  "/api/admin/fees/dashboard",
  "/api/admin/fee-summary",
];

const sessionFeeSettingsPath = "/api/admin/fees/session-settings";
const publicSessionFeeSettingsPath = "/api/public/fees/session-settings";

const sessionPaths = [
  "/api/admin/get-sessions",
  "/api/admin/sessions",
  "/api/admin/academic-sessions",
];

function isApiObject(value: unknown): value is ApiObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function unwrap(value: unknown): unknown {
  if (!isApiObject(value)) {
    return value;
  }

  return (
    value.data ??
    value.settings ??
    value.session_fees ??
    value.sessionFees ??
    value.fee_settings ??
    value.feeSettings ??
    value.invoices ??
    value.invoice ??
    value.summary ??
    value.stats ??
    value.result ??
    value
  );
}

function asArray(value: unknown): unknown[] {
  const unwrapped = unwrap(value);
  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }
  if (isApiObject(unwrapped)) {
    const nested =
      unwrapped.data ??
      unwrapped.settings ??
      unwrapped.session_fees ??
      unwrapped.sessionFees ??
      unwrapped.fee_settings ??
      unwrapped.feeSettings ??
      unwrapped.invoices ??
      unwrapped.items ??
      unwrapped.rows;
    return Array.isArray(nested) ? nested : [];
  }
  return [];
}

function firstString(...values: unknown[]) {
  const value = values.find(
    (item) => typeof item === "string" && item.trim().length > 0,
  );
  return value ? String(value) : "";
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "active"].includes(normalized)) return true;
    if (["0", "false", "no", "inactive"].includes(normalized)) return false;
  }
  return fallback;
}

function toStringArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return fallback;
}

function normalizeSession(raw: unknown): AcademicSessionOption | null {
  if (!isApiObject(raw)) return null;
  const id = firstString(raw.id, raw.session_id);
  const name = firstString(raw.name, raw.session, raw.academic_year, raw.title);
  if (!id) return null;

  return {
    id,
    name: name || id,
    isActive: toBoolean(raw.is_active ?? raw.active ?? raw.current, false),
  };
}

function normalizeSessionFeeSetting(raw: unknown): SessionFeeSettings | null {
  if (!isApiObject(raw)) return null;
  const sessionId = firstString(
    raw.sessionId,
    raw.session_id,
    raw.academic_session_id,
    raw.id,
  );
  const sessionName = firstString(
    raw.sessionName,
    raw.session_name,
    raw.session,
    raw.academic_year,
  );
  if (!sessionId && !sessionName) return null;

  return {
    sessionId: sessionId || sessionName,
    sessionName: sessionName || sessionId,
    applicationFee: toNumber(
      raw.applicationFee ?? raw.application_fee ?? raw.app_fee,
      5000,
    ),
    acceptanceFee: toNumber(
      raw.acceptanceFee ?? raw.acceptance_fee ?? raw.admission_fee,
      25000,
    ),
    isActive: toBoolean(raw.isActive ?? raw.is_active ?? raw.active, false),
  };
}

function normalizeStatus(value: unknown): InvoiceType["status"] {
  const status = String(value || "draft").toLowerCase();
  if (["draft", "published", "paid", "overdue"].includes(status)) {
    return status as InvoiceType["status"];
  }
  if (status === "active" || status === "sent") {
    return "published";
  }
  return "draft";
}

function normalizeType(value: unknown): InvoicePayload["type"] {
  const type = String(value || "").toLowerCase();
  if (type === "specific" || type === "individual" || type === "general") {
    return type;
  }
  if (String(value || "").toUpperCase().startsWith("SPC")) {
    return "specific";
  }
  if (String(value || "").toUpperCase().startsWith("IND")) {
    return "individual";
  }
  return "general";
}

export function normalizeInvoice(raw: unknown): InvoiceType | null {
  if (!isApiObject(raw)) {
    return null;
  }

  const id = firstString(
    raw.id,
    raw.invoice_id,
    raw.invoiceId,
    raw.invoice_code,
    raw.invoiceCode,
    raw.code,
  );
  const type = normalizeType(raw.type ?? raw.target_type ?? raw.category ?? id);
  const title = firstString(raw.title, raw.name, raw.description);
  const dueDate = firstString(raw.dueDate, raw.due_date);

  const base = {
    id: id || `${type.toUpperCase()}-${Date.now()}`,
    type,
    title: title || "Untitled invoice",
    description: firstString(raw.description, raw.details),
    amount: toNumber(raw.amount, 0),
    items: asArray(raw.items ?? raw.invoice_items).map((item) => {
      const row = isApiObject(item) ? item : {};
      return {
        description: firstString(row.description, row.name, row.title),
        amount: toNumber(row.amount, 0),
      };
    }),
    dueDate,
    status: normalizeStatus(raw.status),
    createdAt: firstString(raw.createdAt, raw.created_at, raw.invoice_date),
  };

  if (type === "individual") {
    return {
      ...base,
      type: "individual",
      studentId: firstString(raw.studentId, raw.student_id, raw.matric_number),
      studentName: firstString(raw.studentName, raw.student_name, raw.full_name),
      studentEmail: firstString(raw.studentEmail, raw.student_email, raw.email),
      program: firstString(raw.program, raw.programme, raw.programme_name),
      level: firstString(raw.level, raw.current_level),
    } satisfies IndividualInvoice;
  }

  if (type === "specific") {
    return {
      ...base,
      type: "specific",
      targetProgram: firstString(
        raw.targetProgram,
        raw.target_program,
        raw.programme,
        raw.programme_name,
      ),
      targetLevel: firstString(raw.targetLevel, raw.target_level, raw.level),
      targetDepartment: firstString(
        raw.targetDepartment,
        raw.target_department,
        raw.department,
        raw.department_name,
      ),
      semester: firstString(raw.semester),
      studentsAffected: toNumber(
        raw.studentsAffected ?? raw.students_affected ?? raw.student_count,
      ),
    } satisfies SpecificInvoice;
  }

  return {
    ...base,
    type: "general",
    targetPrograms: toStringArray(raw.targetPrograms ?? raw.target_programs, [
      firstString(raw.targetProgram, raw.target_program) || "All Programs",
    ]),
    targetLevels: toStringArray(raw.targetLevels ?? raw.target_levels, [
      firstString(raw.targetLevel, raw.target_level) || "All Levels",
    ]),
    semester: firstString(raw.semester),
    academicYear: firstString(
      raw.academicYear,
      raw.academic_year,
      raw.session,
    ),
    studentsAffected: toNumber(
      raw.studentsAffected ?? raw.students_affected ?? raw.student_count,
    ),
  } satisfies GeneralInvoice;
}

function toBackendPayload(payload: InvoicePayload) {
  return {
    type: payload.type,
    title: payload.title,
    description: payload.description || "",
    amount: payload.amount,
    items: payload.items || [],
    invoice_items: payload.items || [],
    due_date: payload.dueDate,
    dueDate: payload.dueDate,
    status: payload.status,
    target_programs: payload.targetPrograms,
    targetPrograms: payload.targetPrograms,
    target_levels: payload.targetLevels,
    targetLevels: payload.targetLevels,
    semester: payload.semester,
    academic_year: payload.academicYear,
    academicYear: payload.academicYear,
    target_program: payload.targetProgram,
    targetProgram: payload.targetProgram,
    target_level: payload.targetLevel,
    targetLevel: payload.targetLevel,
    target_department: payload.targetDepartment,
    targetDepartment: payload.targetDepartment,
    student_id: payload.studentId,
    studentId: payload.studentId,
    student_name: payload.studentName,
    studentName: payload.studentName,
    student_email: payload.studentEmail,
    studentEmail: payload.studentEmail,
    program: payload.program,
    programme: payload.program,
    level: payload.level,
  };
}

async function tryGet(paths: string[]) {
  let lastError: unknown;
  for (const path of paths) {
    try {
      return await api.get(path);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function tryMutate(
  method: "post" | "put" | "patch" | "delete",
  paths: string[],
  body?: unknown,
) {
  let lastError: unknown;
  for (const path of paths) {
    try {
      if (method === "delete") {
        return await api.delete(path);
      }
      return await api[method](path, body);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function getFeeInvoices(type?: InvoicePayload["type"]) {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  const response = await tryGet(invoiceListPaths.map((path) => `${path}${query}`));
  return asArray(response)
    .map(normalizeInvoice)
    .filter(Boolean)
    .filter((invoice) => !type || invoice.type === type) as InvoiceType[];
}

export async function createFeeInvoice(payload: InvoicePayload) {
  const body = toBackendPayload({ ...payload, status: payload.status || "draft" });
  const response = await tryMutate("post", [
    "/api/admin/fees/invoices",
    "/api/admin/invoices",
    "/api/admin/create-invoice",
  ], body);
  return normalizeInvoice(unwrap(response));
}

export async function updateFeeInvoice(id: string, payload: Partial<InvoicePayload>) {
  const encodedId = encodeURIComponent(id);
  const body = { id, invoice_id: id, ...toBackendPayload(payload as InvoicePayload) };
  const response = await tryMutate("put", [
    `/api/admin/fees/invoices/${encodedId}`,
    `/api/admin/invoices/${encodedId}`,
  ], body).catch(() =>
    tryMutate("post", ["/api/admin/update-invoice"], body),
  );
  return normalizeInvoice(unwrap(response));
}

export async function deleteFeeInvoice(id: string) {
  const encodedId = encodeURIComponent(id);
  await tryMutate("delete", [
    `/api/admin/fees/invoices/${encodedId}`,
    `/api/admin/invoices/${encodedId}`,
  ]).catch(() =>
    tryMutate("post", ["/api/admin/delete-invoice"], {
      id,
      invoice_id: id,
    }),
  );
}

export async function publishFeeInvoice(id: string) {
  const encodedId = encodeURIComponent(id);
  const response = await tryMutate("post", [
    `/api/admin/fees/invoices/${encodedId}/publish`,
    `/api/admin/invoices/${encodedId}/publish`,
    "/api/admin/publish-invoice",
  ], {
    id,
    invoice_id: id,
    status: "published",
  }).catch(() => updateFeeInvoice(id, { status: "published" }));
  return normalizeInvoice(unwrap(response));
}

export async function getFeeSummary(): Promise<FeeSummary> {
  const response = await tryGet(summaryPaths);
  const summary = unwrap(response);
  if (!isApiObject(summary)) {
    return {
      totalRevenue: 0,
      pendingPayments: 0,
      studentsPaid: 0,
      collectionRate: 0,
    };
  }

  return {
    totalRevenue: toNumber(summary.totalRevenue ?? summary.total_revenue),
    pendingPayments: toNumber(
      summary.pendingPayments ?? summary.pending_payments,
    ),
    studentsPaid: toNumber(summary.studentsPaid ?? summary.students_paid),
    collectionRate: toNumber(summary.collectionRate ?? summary.collection_rate),
  };
}

export async function getFeeStudents(): Promise<FeeStudent[]> {
  const response = await tryGet([
    "/api/admin/fees/students",
    "/api/admin/students?status=active",
    "/api/admin/get-students",
  ]);

  return asArray(response).map((student) => {
    const item = isApiObject(student) ? student : {};
    const fullName = firstString(item.full_name, item.name);
    return {
      id: firstString(item.id, item.student_id, item.matric_number),
      name: fullName || firstString(item.email) || "Unnamed student",
      email: firstString(item.email),
      program: firstString(item.program, item.programme_name, item.programme),
      level: firstString(item.level, item.current_level),
    };
  });
}

export async function getAcademicSessions(): Promise<AcademicSessionOption[]> {
  const response = await tryGet(sessionPaths);
  return asArray(response)
    .map(normalizeSession)
    .filter(Boolean) as AcademicSessionOption[];
}

export async function getSessionFeeSettings(): Promise<SessionFeeSettings[]> {
  const response = await api.get(sessionFeeSettingsPath);
  return asArray(response)
    .map(normalizeSessionFeeSetting)
    .filter(Boolean) as SessionFeeSettings[];
}

export async function saveSessionFeeSetting(
  setting: SessionFeeSettings,
): Promise<SessionFeeSettings> {
  const normalized = normalizeSessionFeeSetting(setting);
  if (!normalized) {
    throw new Error("Session is required");
  }

  const body = {
    session_id: normalized.sessionId,
    sessionId: normalized.sessionId,
    session_name: normalized.sessionName,
    sessionName: normalized.sessionName,
    application_fee: normalized.applicationFee,
    applicationFee: normalized.applicationFee,
    acceptance_fee: normalized.acceptanceFee,
    acceptanceFee: normalized.acceptanceFee,
    is_active: normalized.isActive ? 1 : 0,
    isActive: normalized.isActive,
  };

  const response = await api.post(sessionFeeSettingsPath, body);
  const saved = normalizeSessionFeeSetting(unwrap(response));
  if (!saved) {
    throw new Error("The server returned an invalid session fee setting");
  }
  return saved;
}

export async function getActiveSessionFeeSettings() {
  const response = await api.get(publicSessionFeeSettingsPath);
  return normalizeSessionFeeSetting(unwrap(response));
}

export async function getSessionFeeSettingsForSession(
  session?: string | null,
) {
  const query = session ? `?session_id=${encodeURIComponent(session)}` : "";
  const response = await api.get(`${publicSessionFeeSettingsPath}${query}`);
  return normalizeSessionFeeSetting(unwrap(response));
}
