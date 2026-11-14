import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Download,
  GraduationCap,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import { getSessionFeeSettingsForSession } from "@/lib/fees";
import {
  buildPaymentReference,
  initializePaystackPayment,
} from "@/lib/paystack";
import logo from "@/assets/logo.png";
import schoolConfig from "@/config/schoolConfig";

type ReviewStage = {
  name: string;
  completed: boolean;
  date?: string | null;
};

type AdmissionDetails = {
  admissionNumber?: string | null;
  admissionDate?: string | null;
  programAdmitted?: string | null;
  level?: string | null;
  session?: string | null;
  semester?: string | null;
  acceptanceDeadline?: string | null;
  acceptanceFeePaid?: boolean;
  acceptanceFee?: number;
  admissionCondition?: string | null;
  admission_condition?: string | null;
  offerType?: string | null;
  offer_type?: string | null;
  condition?: string | null;
};

type AdmissionStatusData = {
  applicationId?: string | null;
  status: string;
  email?: string | null;
  studentEmail?: string | null;
  applicantEmail?: string | null;
  session?: string | null;
  academicSession?: string | null;
  academic_year?: string | null;
  appliedDate?: string | null;
  programApplied?: string | null;
  department?: string | null;
  qualificationUsed?: string | null;
  reviewStages?: ReviewStage[];
  admissionDetails?: AdmissionDetails;
  applicantName?: string | null;
  hodConfirmed?: boolean;
  admissionCondition?: string | null;
  admission_condition?: string | null;
  offerType?: string | null;
  offer_type?: string | null;
  condition?: string | null;
};

type InvoiceItem = {
  description: string;
  amount: number;
};

type SchoolFeeInvoice = {
  id: string;
  title: string;
  description?: string;
  amount: number;
  items?: InvoiceItem[];
  dueDate: string | null;
  status: string;
};

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    icon: Clock,
    description: "Your application has been received and is awaiting review.",
  },
  under_review: {
    label: "Under Review",
    color: "bg-blue-100 text-blue-800 border-blue-300",
    icon: FileText,
    description:
      "Your application is currently being reviewed by the admissions committee.",
  },
  admitted: {
    label: "Admitted",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: CheckCircle,
    description: "Congratulations! You have been offered admission.",
  },
  rejected: {
    label: "Not Admitted",
    color: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
    description:
      "We regret to inform you that your application was not successful.",
  },
  waitlisted: {
    label: "Waitlisted",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    icon: AlertCircle,
    description: "You have been placed on the waiting list for admission.",
  },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount || 0);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function htmlEscape(value: unknown) {
  return stringValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStoredProfile() {
  try {
    const stored =
      localStorage.getItem("mccas_profile") ||
      localStorage.getItem("MCCAS_profile");
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getApplicantName(data: AdmissionStatusData) {
  const profile = getStoredProfile();
  return (
    data.applicantName ||
    stringValue(profile.full_name) ||
    stringValue(profile.fullName) ||
    stringValue(profile.name) ||
    stringValue(profile.Name) ||
    "Student"
  );
}

function hasAdmissionUndertaking(data: AdmissionStatusData) {
  const admissionDetails = data.admissionDetails || {};
  const values = [
    data.admissionCondition,
    data.admission_condition,
    data.offerType,
    data.offer_type,
    data.condition,
    admissionDetails.admissionCondition,
    admissionDetails.admission_condition,
    admissionDetails.offerType,
    admissionDetails.offer_type,
    admissionDetails.condition,
  ];

  return values.some((value) =>
    stringValue(value).toLowerCase().includes("undertaking"),
  );
}

function normalizeInvoice(raw: unknown): SchoolFeeInvoice | null {
  if (!isObject(raw)) return null;

  const id = stringValue(
    raw.id ??
      raw.invoiceId ??
      raw.invoice_id ??
      raw.pay_id ??
      raw.invoiceCode ??
      raw.invoice_code,
  );
  const title = stringValue(raw.title ?? raw.name ?? raw.description);
  const amount = Number(raw.amount ?? raw.total ?? raw.totalAmount ?? 0);

  if (!id || !title || Number.isNaN(amount)) return null;

  const items = Array.isArray(raw.items)
    ? (raw.items
        .map((item) => {
          if (!isObject(item)) return null;
          const description = stringValue(item.description ?? item.title);
          const itemAmount = Number(item.amount ?? 0);
          return description && !Number.isNaN(itemAmount)
            ? { description, amount: itemAmount }
            : null;
        })
        .filter(Boolean) as InvoiceItem[])
    : undefined;

  return {
    id,
    title,
    description:
      typeof raw.description === "string" && raw.description !== title
        ? raw.description
        : undefined,
    amount,
    items,
    dueDate: stringValue(raw.dueDate ?? raw.due_date) || null,
    status: stringValue(raw.status || "unpaid"),
  };
}

function collectInvoices(source: unknown): SchoolFeeInvoice[] {
  const data = isObject(source) && isObject(source.data) ? source.data : source;
  if (!isObject(data)) return [];

  const possibleSources = [
    data.invoices,
    data.invoice,
    data.schoolFeeInvoice,
    data.school_fee_invoice,
    data.paymentInvoice,
    data.payment_invoice,
  ];

  return possibleSources.flatMap((value) => {
    if (Array.isArray(value)) {
      return value.map(normalizeInvoice).filter(Boolean) as SchoolFeeInvoice[];
    }
    const invoice = normalizeInvoice(value);
    return invoice ? [invoice] : [];
  });
}

function loadStoredInvoices() {
  try {
    const stored =
      localStorage.getItem("mccas_student_invoices") ||
      localStorage.getItem("MCCAS_student_invoices");
    return stored
      ? ((JSON.parse(stored) as unknown[])
          .map(normalizeInvoice)
          .filter(Boolean) as SchoolFeeInvoice[])
      : [];
  } catch {
    return [];
  }
}

function isSchoolFeeInvoice(invoice: SchoolFeeInvoice) {
  const haystack =
    `${invoice.id} ${invoice.title} ${invoice.description || ""}`.toLowerCase();

  if (haystack.includes("acceptance") || haystack.includes("application")) {
    return false;
  }

  return [
    "school fee",
    "school fees",
    "school registration",
    "registration fee",
    "registration fees",
    "schedule of registration",
    "tuition",
  ].some((needle) => haystack.includes(needle));
}

const AdmissionStatusPage = () => {
  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPayingAcceptanceFee, setIsPayingAcceptanceFee] = useState(false);
  const [data, setData] = useState<AdmissionStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionAcceptanceFee, setSessionAcceptanceFee] = useState<
    number | null
  >(null);
  const [schoolFeeInvoice, setSchoolFeeInvoice] =
    useState<SchoolFeeInvoice | null>(null);
  const [isLoadingSchoolFeeInvoice, setIsLoadingSchoolFeeInvoice] =
    useState(false);

  useEffect(() => {
    const fetchAdmissionStatus = async () => {
      try {
        const res = await api.getAdmissionStatus();
        setData(res?.data || null);
        setLoadError(null);
      } catch (err: unknown) {
        const apiErr = err as { message?: string };
        const message = apiErr?.message || "Failed to load admission status";
        setLoadError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdmissionStatus();
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadFeeSettings = async () => {
      try {
        const activeFees = await getSessionFeeSettingsForSession(
          data?.admissionDetails?.session ||
            data?.session ||
            data?.academicSession ||
            data?.academic_year,
        );
        if (mounted && activeFees?.acceptanceFee) {
          setSessionAcceptanceFee(activeFees.acceptanceFee);
        }
      } catch {
        // keep default fee
      }
    };

    void loadFeeSettings();

    return () => {
      mounted = false;
    };
  }, [
    data?.admissionDetails?.session,
    data?.academicSession,
    data?.academic_year,
    data?.session,
  ]);

  useEffect(() => {
    let mounted = true;

    const findGeneratedSchoolFeeInvoice = async () => {
      if (!data?.admissionDetails?.acceptanceFeePaid) {
        setSchoolFeeInvoice(null);
        setIsLoadingSchoolFeeInvoice(false);
        return;
      }

      setIsLoadingSchoolFeeInvoice(true);

      const admissionInvoices = collectInvoices(data);
      const storedInvoices = loadStoredInvoices();

      try {
        const response = await api.getStudentPayments();
        const invoices = [
          ...admissionInvoices,
          ...collectInvoices(response),
          ...storedInvoices,
        ];
        const invoice = invoices.find(isSchoolFeeInvoice) || null;
        if (mounted) setSchoolFeeInvoice(invoice);
      } catch {
        const invoice =
          [...admissionInvoices, ...storedInvoices].find(isSchoolFeeInvoice) ||
          null;
        if (mounted) setSchoolFeeInvoice(invoice);
      } finally {
        if (mounted) setIsLoadingSchoolFeeInvoice(false);
      }
    };

    void findGeneratedSchoolFeeInvoice();

    return () => {
      mounted = false;
    };
  }, [data]);

  if (isLoading) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Admission Status
            </h1>
            <p className="text-muted-foreground">Loading admission status...</p>
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (!data) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Admission Status
            </h1>
            <p className="text-muted-foreground">
              {loadError || "No admission status available yet."}
            </p>
          </div>
        </div>
      </StudentLayout>
    );
  }

  const statusKey = data.status || "pending";
  const status =
    statusConfig[statusKey as keyof typeof statusConfig] ||
    statusConfig.pending;
  const StatusIcon = status.icon;
  const admissionDetails = data.admissionDetails || {};
  const admittedSession =
    admissionDetails.session ||
    data.session ||
    data.academicSession ||
    data.academic_year ||
    "";
  const reviewStages = data.reviewStages || [];
  const acceptancePaid = Boolean(admissionDetails.acceptanceFeePaid);
  const acceptanceFee =
    sessionAcceptanceFee ?? admissionDetails.acceptanceFee ?? 25000;
  const applicantName = getApplicantName(data);
  const isUndertakingAdmission = hasAdmissionUndertaking(data);

  const getPaymentEmail = () => {
    const apiEmail = data.email || data.studentEmail || data.applicantEmail;
    if (apiEmail) return apiEmail;

    const profile = getStoredProfile();
    return stringValue(profile.email || profile.Email);
  };

  const formatDate = (
    value?: string | null,
    style: "medium" | "long" = "medium",
  ) =>
    value
      ? new Date(value).toLocaleDateString("en-NG", { dateStyle: style })
      : "—";

  const buildOfferDetails = () => {
    const rows = [
      ["Applicant", applicantName],
      ["Admission Number", admissionDetails.admissionNumber || "—"],
      ["Programme", admissionDetails.programAdmitted || "—"],
      ["Level", admissionDetails.level || "—"],
      ["Session", admittedSession || "—"],
      ["Semester", admissionDetails.semester || "—"],
      [
        "Admission Type",
        isUndertakingAdmission
          ? "Admission with Undertaking"
          : "Direct Admission",
      ],
    ];

    return `
      <div class="details-grid">
        ${rows
          .map(
            ([label, value]) => `
              <div class="detail-cell">
                <span>${htmlEscape(label)}</span>
                <strong>${htmlEscape(value)}</strong>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  };

  const buildPaperShell = (title: string, reference: string, body: string) => `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${htmlEscape(title)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f3f4f6;
            color: #111827;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            line-height: 1.55;
          }
          .paper {
            width: 190mm;
            min-height: 270mm;
            margin: 16px auto;
            background: #fff;
            border: 1px solid #d1d5db;
            padding: 18mm;
          }
          .letterhead {
            display: flex;
            align-items: center;
            gap: 16px;
            border-bottom: 3px solid #1d4ed8;
            padding-bottom: 14px;
          }
          .logo {
            width: 72px;
            height: 72px;
            object-fit: contain;
          }
          .school-name {
            margin: 0;
            color: #0f172a;
            font-size: 20px;
            line-height: 1.2;
            text-transform: uppercase;
          }
          .school-subtitle {
            margin: 4px 0 0;
            color: #475569;
            font-size: 12px;
          }
          .doc-title {
            margin: 22px 0 6px;
            text-align: center;
            font-size: 19px;
            font-weight: 800;
            text-transform: uppercase;
            color: #0f172a;
          }
          .doc-ref {
            text-align: center;
            color: #475569;
            margin-bottom: 22px;
          }
          .details-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            border: 1px solid #cbd5e1;
            margin: 18px 0;
          }
          .detail-cell {
            min-height: 58px;
            border-bottom: 1px solid #e2e8f0;
            padding: 10px 12px;
          }
          .detail-cell:nth-child(odd) { border-right: 1px solid #e2e8f0; }
          .detail-cell span {
            display: block;
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: .06em;
          }
          .detail-cell strong {
            display: block;
            margin-top: 4px;
            color: #0f172a;
            font-size: 14px;
          }
          .section-title {
            margin: 20px 0 8px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
          }
          .amount-box {
            margin: 16px 0;
            border: 1px solid #f59e0b;
            background: #fffbeb;
            padding: 12px 14px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
          }
          th, td {
            border-bottom: 1px solid #d1d5db;
            padding: 10px 8px;
            text-align: left;
          }
          th { color: #334155; font-size: 12px; text-transform: uppercase; }
          .text-right { text-align: right; }
          .signature-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 48px;
            margin-top: 48px;
          }
          .signature-line {
            border-top: 1px solid #111827;
            padding-top: 8px;
            color: #334155;
            font-size: 12px;
          }
          .footer-note {
            margin-top: 28px;
            border-top: 1px solid #e5e7eb;
            padding-top: 12px;
            color: #64748b;
            font-size: 11px;
          }
          .print-action {
            position: fixed;
            right: 18px;
            top: 18px;
            border: 0;
            border-radius: 6px;
            background: #1d4ed8;
            color: #fff;
            padding: 10px 14px;
            font-weight: 700;
            cursor: pointer;
          }
          @media print {
            body { background: #fff; }
            .paper {
              width: auto;
              min-height: auto;
              margin: 0;
              border: 0;
              padding: 0;
            }
            .print-action { display: none; }
          }
        </style>
      </head>
      <body>
        <button class="print-action" onclick="window.print()">Save / Print</button>
        <main class="paper">
          <header class="letterhead">
            <img class="logo" src="${logo}" alt="${schoolConfig.name.acronym} logo" />
            <div>
              <h1 class="school-name">${htmlEscape(schoolConfig.documents.letterheadTitle)}</h1>
              <p class="school-subtitle">${htmlEscape(schoolConfig.documents.letterheadSubtitle)}</p>
            </div>
          </header>
          <h2 class="doc-title">${htmlEscape(title)}</h2>
          <p class="doc-ref">Reference: ${htmlEscape(reference)} | Issued: ${htmlEscape(
            new Date().toLocaleDateString("en-NG", { dateStyle: "long" }),
          )}</p>
          ${body}
          <p class="footer-note">
            This document was generated from the MCCE Student Portal. It is valid
            only with a matching portal record and may be verified by the Registry.
            ${htmlEscape(schoolConfig.documents.verificationNotice)}
          </p>
        </main>
      </body>
    </html>
  `;

  const openPrintableDocument = (title: string, html: string) => {
    const printWindow = window.open("", "_blank", "width=900,height=1200");
    if (!printWindow) {
      toast.error("Unable to open document window.");
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const buildAdmissionDocument = (
    type:
      | "notification"
      | "provisional"
      | "acceptance"
      | "undertaking"
      | "invoice",
  ) => {
    const admissionNumber = admissionDetails.admissionNumber || "";
    const programme = admissionDetails.programAdmitted || "your programme";
    const level = admissionDetails.level || "your admitted level";
    const session = admittedSession || "the admitted session";
    const admissionDate = formatDate(admissionDetails.admissionDate, "long");
    const deadline = formatDate(admissionDetails.acceptanceDeadline, "long");

    if (type === "invoice" && schoolFeeInvoice) {
      const rows =
        schoolFeeInvoice.items && schoolFeeInvoice.items.length > 0
          ? schoolFeeInvoice.items
          : [
              {
                description: schoolFeeInvoice.title,
                amount: schoolFeeInvoice.amount,
              },
            ];

      return buildPaperShell(
        "School Fees Payment Invoice",
        schoolFeeInvoice.id,
        `
          ${buildOfferDetails()}
          <p class="section-title">Invoice Details</p>
          <div class="details-grid">
            <div class="detail-cell"><span>Invoice ID</span><strong>${htmlEscape(
              schoolFeeInvoice.id,
            )}</strong></div>
            <div class="detail-cell"><span>Status</span><strong>${htmlEscape(
              schoolFeeInvoice.status,
            )}</strong></div>
            <div class="detail-cell"><span>Due Date</span><strong>${htmlEscape(
              schoolFeeInvoice.dueDate || "—",
            )}</strong></div>
            <div class="detail-cell"><span>Total Amount</span><strong>${htmlEscape(
              formatCurrency(schoolFeeInvoice.amount),
            )}</strong></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (item) => `
                    <tr>
                      <td>${htmlEscape(item.description)}</td>
                      <td class="text-right">${htmlEscape(formatCurrency(item.amount))}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr>
                <td class="text-right"><strong>Total</strong></td>
                <td class="text-right"><strong>${htmlEscape(
                  formatCurrency(schoolFeeInvoice.amount),
                )}</strong></td>
              </tr>
            </tfoot>
          </table>
          <p>Please present this invoice for school-fee payment and administrative enquiries.</p>
        `,
      );
    }

    const documents = {
      notification: {
        title: "Notification of Admission",
        body: `
          <p>Dear ${htmlEscape(applicantName)},</p>
          <p>
            We are pleased to inform you that you have been offered provisional
            admission into <strong>${htmlEscape(programme)}</strong> at
            <strong>${htmlEscape(level)}</strong> for the
            <strong>${htmlEscape(session)}</strong> academic session.
          </p>
          ${buildOfferDetails()}
          <p class="amount-box">
            Acceptance fee: ${htmlEscape(formatCurrency(acceptanceFee))}. Deadline:
            ${htmlEscape(deadline)}.
          </p>
          <p>This offer is subject to verification of your credentials and compliance with college requirements.</p>
          <div class="signature-row">
            <div class="signature-line">Registrar</div>
            <div class="signature-line">Date: ${htmlEscape(admissionDate)}</div>
          </div>
        `,
      },
      provisional: {
        title: "Provisional Admission Letter",
        body: `
          <p>Dear ${htmlEscape(applicantName)},</p>
          <p>
            This confirms that your acceptance fee has been received and your
            provisional admission into <strong>${htmlEscape(programme)}</strong>
            for the <strong>${htmlEscape(session)}</strong> academic session has
            been recorded by the college.
          </p>
          ${buildOfferDetails()}
          <p>
            You are required to complete registration, documentation, and any
            clearance requirements before the deadlines communicated by the
            college.
          </p>
          <div class="signature-row">
            <div class="signature-line">Registrar</div>
            <div class="signature-line">Applicant Signature</div>
          </div>
        `,
      },
      acceptance: {
        title: "Acceptance of Admission",
        body: `
          <p>I, <strong>${htmlEscape(applicantName)}</strong>, hereby accept the
          offer of admission granted to me by ${htmlEscape(schoolConfig.name.full)}.</p>
          ${buildOfferDetails()}
          <p>
            I agree to abide by the rules, regulations, academic requirements,
            and lawful directives of the college throughout my studentship.
          </p>
          <p class="amount-box">
            Acceptance fee paid: ${htmlEscape(formatCurrency(acceptanceFee))}.
          </p>
          <div class="signature-row">
            <div class="signature-line">Applicant Signature</div>
            <div class="signature-line">Registry Confirmation</div>
          </div>
        `,
      },
      undertaking: {
        title: "Admission Undertaking Form",
        body: `
          <p>I, <strong>${htmlEscape(applicantName)}</strong>, acknowledge that my
          admission is granted with undertaking and that I must satisfy all
          outstanding requirements within the period approved by the college.</p>
          ${buildOfferDetails()}
          <p class="section-title">Undertaking</p>
          <p>
            I undertake to submit all pending documents, complete clearance, and
            meet every condition attached to this admission. I understand that
            failure to comply may lead to suspension, withdrawal, or forfeiture
            of the admission offer.
          </p>
          <div class="signature-row">
            <div class="signature-line">Applicant Signature</div>
            <div class="signature-line">Parent / Guardian Signature</div>
          </div>
          <div class="signature-row">
            <div class="signature-line">Registrar</div>
            <div class="signature-line">Date</div>
          </div>
        `,
      },
    };

    const selected = documents[type as keyof typeof documents];
    return buildPaperShell(selected.title, admissionNumber, selected.body);
  };

  const handleDownloadDocument = async (
    type:
      | "notification"
      | "provisional"
      | "acceptance"
      | "undertaking"
      | "invoice",
  ) => {
    if (!admissionDetails.admissionDate || !admissionDetails.admissionNumber) {
      toast.error("Admission details are not available yet.");
      return;
    }

    if (type !== "notification" && !acceptancePaid) {
      toast.error("Pay the acceptance fee before downloading this document.");
      return;
    }

    if (type === "invoice" && !schoolFeeInvoice) {
      toast.error("School fees invoice has not been generated yet.");
      return;
    }

    try {
      setIsDownloading(true);
      const html = buildAdmissionDocument(type);
      const title =
        type === "notification"
          ? "Notification of Admission"
          : type === "provisional"
            ? "Provisional Admission Letter"
            : type === "acceptance"
              ? "Acceptance of Admission"
              : type === "undertaking"
                ? "Admission Undertaking Form"
                : "School Fees Payment Invoice";
      openPrintableDocument(title, html);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePayAcceptanceFee = async () => {
    if (!data.hodConfirmed) {
      return;
    }

    if (!admissionDetails.admissionNumber) {
      toast.error("Admission number is not available yet.");
      return;
    }

    const email = getPaymentEmail();
    if (!email) {
      toast.error("Student email is required for Paystack payment.");
      return;
    }

    const invoiceId = `INV-ACC-${admissionDetails.admissionNumber.replace(/\//g, "-")}`;
    setIsPayingAcceptanceFee(true);

    try {
      const payment = await initializePaystackPayment({
        email,
        amount: acceptanceFee,
        reference: buildPaymentReference(
          schoolConfig.payment.acceptanceFeePrefix,
        ),
        label: `${schoolConfig.name.acronym} Acceptance Fee`,
        metadata: {
          payment_type: "acceptance_fee",
          invoice_id: invoiceId,
          admission_number: admissionDetails.admissionNumber,
          programme: admissionDetails.programAdmitted,
          level: admissionDetails.level,
          session: admittedSession,
        },
      });

      await api.markAcceptanceFeePaid({
        amount: acceptanceFee,
        reference: payment.reference,
        admission_number: admissionDetails.admissionNumber,
      });

      setData((current) =>
        current
          ? {
              ...current,
              admissionDetails: {
                ...(current.admissionDetails || {}),
                acceptanceFee,
                acceptanceFeePaid: true,
              },
            }
          : current,
      );

      try {
        const stored =
          localStorage.getItem("mccas_student_invoices") ||
          localStorage.getItem("MCCAS_student_invoices");
        const parsed = stored
          ? (JSON.parse(stored) as Array<Record<string, unknown>>)
          : [];
        const withoutExisting = parsed.filter(
          (invoice) => invoice.id !== invoiceId,
        );
        const updatedInvoices = JSON.stringify([
          {
            id: invoiceId,
            title: `Acceptance Fee - ${admissionDetails.programAdmitted || "Admission"}`,
            amount: acceptanceFee,
            dueDate: admissionDetails.acceptanceDeadline,
            status: "paid",
            reference: payment.reference,
            paidAt: new Date().toISOString(),
          },
          ...withoutExisting,
        ]);
        localStorage.setItem("mccas_student_invoices", updatedInvoices);
        localStorage.setItem("MCCAS_student_invoices", updatedInvoices);
      } catch {
        // ignore storage failures
      }

      toast.success("Acceptance fee paid successfully", {
        description: `Reference: ${payment.reference}`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Payment was not completed",
      );
    } finally {
      setIsPayingAcceptanceFee(false);
    }
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Admission Status
          </h1>
          <p className="text-muted-foreground">
            Track your application and view admission decision
          </p>
        </div>

        {/* Status Overview Card */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>Application ID</CardDescription>
                <CardTitle className="text-lg font-mono">
                  {data.applicationId || "—"}
                </CardTitle>
              </div>
              <Badge
                className={`${status.color} px-4 py-2 text-sm font-medium`}
              >
                <StatusIcon className="w-4 h-4 mr-2" />
                {status.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{status.description}</p>
          </CardContent>
        </Card>

        {/* Application Details */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Application Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Applied Date</span>
                <span className="font-medium">
                  {formatDate(data.appliedDate)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Programme</span>
                <span className="font-medium">
                  {data.programApplied || "—"}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{data.department || "—"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Qualification</span>
                <span className="font-medium">
                  {data.qualificationUsed || "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Review Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Review Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reviewStages.map((stage, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded-full p-1 ${
                        stage.completed
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {stage.completed ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-medium ${stage.completed ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {stage.name}
                      </p>
                      {stage.completed && stage.date && (
                        <p className="text-sm text-muted-foreground">
                          {new Date(stage.date).toLocaleDateString("en-NG", {
                            dateStyle: "medium",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admission Details (shown only if admitted) */}
        {data.status === "admitted" && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                Admission Details
              </CardTitle>
              <CardDescription>
                Your admission offer details and next steps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Admission Number
                  </p>
                  <p className="font-semibold font-mono">
                    {admissionDetails.admissionNumber || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Programme</p>
                  <p className="font-semibold">
                    {admissionDetails.programAdmitted || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Level</p>
                  <p className="font-semibold">
                    {admissionDetails.level || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Session</p>
                  <p className="font-semibold">
                    {admissionDetails.session || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Semester</p>
                  <p className="font-semibold">
                    {admissionDetails.semester || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Acceptance Deadline
                  </p>
                  <p className="font-semibold text-destructive">
                    {formatDate(admissionDetails.acceptanceDeadline)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Admission Type
                  </p>
                  <p className="font-semibold">
                    {isUndertakingAdmission
                      ? "Admission with Undertaking"
                      : "Direct Admission"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex flex-col gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {acceptancePaid && (
                    <>
                      <Button
                        onClick={() => handleDownloadDocument("provisional")}
                        disabled={isDownloading}
                        className="w-full"
                        variant="portal"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Provisional Admission
                      </Button>

                      <Button
                        onClick={() => handleDownloadDocument("acceptance")}
                        disabled={isDownloading}
                        className="w-full"
                        variant="outline"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Acceptance Letter
                      </Button>

                      {schoolFeeInvoice && (
                        <Button
                          onClick={() => handleDownloadDocument("invoice")}
                          disabled={isDownloading}
                          className="w-full"
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          School Fees Invoice
                        </Button>
                      )}

                      {isUndertakingAdmission && (
                        <Button
                          onClick={() => handleDownloadDocument("undertaking")}
                          disabled={isDownloading}
                          className="w-full"
                          variant="outline"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Undertaking Form
                        </Button>
                      )}
                    </>
                  )}
                </div>

                {acceptancePaid &&
                  !schoolFeeInvoice &&
                  !isLoadingSchoolFeeInvoice && (
                    <p className="text-sm text-muted-foreground">
                      School fees invoice will appear here when it has been
                      generated for you.
                    </p>
                  )}

                {!acceptancePaid && (
                  <Button
                    variant="gold"
                    onClick={handlePayAcceptanceFee}
                    className="w-full"
                    disabled={!data.hodConfirmed || isPayingAcceptanceFee}
                  >
                    {isPayingAcceptanceFee
                      ? "Processing payment..."
                      : data.hodConfirmed
                        ? `Pay Acceptance Fee (₦${acceptanceFee.toLocaleString()})`
                        : "Awaiting HOD Confirmation"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejection Notice */}
        {data.status === "rejected" && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <XCircle className="w-8 h-8 text-destructive" />
                <div>
                  <h3 className="font-semibold text-lg">
                    Application Not Successful
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    We appreciate your interest in MCCE. While we were unable We
                    appreciate your interest in {schoolConfig.name.acronym}.
                    While we were unable to offer you admission at this time, we
                    encourage you to apply again in the future or consider other
                    programmes that may be a better fit.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/student/apply")}
                  >
                    Apply for Another Programme
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Waitlist Notice */}
        {data.status === "waitlisted" && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-8 h-8 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-lg text-orange-800">
                    You're on the Waiting List
                  </h3>
                  <p className="text-orange-700 mt-1">
                    Your application has been placed on our waiting list. You
                    will be notified if a position becomes available. Please
                    check back regularly for updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </StudentLayout>
  );
};

export default AdmissionStatusPage;
