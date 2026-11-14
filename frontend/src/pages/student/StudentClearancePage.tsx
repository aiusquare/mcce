import { useMemo, useState } from "react";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle,
  FileSignature,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { schoolConfig } from "@/config/schoolConfig";

type Invoice = {
  id: string;
  title: string;
  status: "pending" | "overdue" | "paid";
};

const INVOICE_STORAGE_KEY = "mccas_student_invoices";
const LEGACY_INVOICE_STORAGE_KEY = "MCCAS_student_invoices";
const DOCUMENTS_SUBMITTED_KEY = "mccas_clearance_documents_submitted";
const LEGACY_DOCUMENTS_SUBMITTED_KEY = "MCCAS_clearance_documents_submitted";
const STATIONERY_PROVIDED_KEY = "mccas_clearance_stationery_provided";
const LEGACY_STATIONERY_PROVIDED_KEY = "MCCAS_clearance_stationery_provided";
const UNDERTAKING_REQUESTED_KEY = "mccas_clearance_undertaking_requested";
const LEGACY_UNDERTAKING_REQUESTED_KEY =
  "MCCAS_clearance_undertaking_requested";
const UNDERTAKING_APPROVED_KEY = "mccas_clearance_undertaking_approved";
const LEGACY_UNDERTAKING_APPROVED_KEY = "MCCAS_clearance_undertaking_approved";

const studentInfo = {
  name: "Abubakar M. Ibrahim",
  regNumber: `${schoolConfig.academics.regNumberPrefix}/2024/0001234`,
  program: "B.Sc. Computer Science",
  department: "Science and Computing",
  session: "2024/2025",
};

const loadInvoices = (): Invoice[] => {
  const stored =
    localStorage.getItem(INVOICE_STORAGE_KEY) ||
    localStorage.getItem(LEGACY_INVOICE_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as Invoice[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getStoredBool = (key: string, legacyKey: string) => {
  return (
    localStorage.getItem(key) === "true" ||
    localStorage.getItem(legacyKey) === "true"
  );
};

const setStoredBool = (key: string, legacyKey: string, value: boolean) => {
  const str = String(value);
  localStorage.setItem(key, str);
  localStorage.setItem(legacyKey, str);
};

const isRegistrationInvoice = (invoice: Invoice) => {
  const title = invoice.title.toLowerCase();
  return (
    invoice.id.startsWith("INV-REG-") ||
    invoice.id.startsWith(`${schoolConfig.payment.invoicePrefix}REG-`) ||
    title.includes("registration fee")
  );
};

export default function StudentClearancePage() {
  const [invoices, setInvoices] = useState<Invoice[]>(loadInvoices);
  const [documentsSubmitted, setDocumentsSubmitted] = useState(() =>
    getStoredBool(DOCUMENTS_SUBMITTED_KEY, LEGACY_DOCUMENTS_SUBMITTED_KEY),
  );
  const [stationeryProvided, setStationeryProvided] = useState(() =>
    getStoredBool(STATIONERY_PROVIDED_KEY, LEGACY_STATIONERY_PROVIDED_KEY),
  );
  const [undertakingRequested, setUndertakingRequested] = useState(() =>
    getStoredBool(UNDERTAKING_REQUESTED_KEY, LEGACY_UNDERTAKING_REQUESTED_KEY),
  );
  const [undertakingApproved, setUndertakingApproved] = useState(() =>
    getStoredBool(UNDERTAKING_APPROVED_KEY, LEGACY_UNDERTAKING_APPROVED_KEY),
  );

  const registrationPaid = useMemo(
    () =>
      invoices.some(
        (invoice) =>
          isRegistrationInvoice(invoice) && invoice.status === "paid",
      ),
    [invoices],
  );

  const fullyCleared =
    registrationPaid && documentsSubmitted && stationeryProvided;

  const pendingItems = [
    !registrationPaid && "Registration fee invoice unpaid",
    !documentsSubmitted &&
      "Required documents not submitted to Students Affairs/Registry",
    !stationeryProvided && "Stationery submission pending",
  ].filter(Boolean) as string[];

  const handleRefresh = () => {
    setInvoices(loadInvoices());
    toast.success("Clearance status refreshed");
  };

  const handleDocumentsSubmitted = () => {
    setStoredBool(
      DOCUMENTS_SUBMITTED_KEY,
      LEGACY_DOCUMENTS_SUBMITTED_KEY,
      true,
    );
    setDocumentsSubmitted(true);
    toast.success("Documents marked as submitted");
  };

  const handleStationeryProvided = () => {
    setStoredBool(
      STATIONERY_PROVIDED_KEY,
      LEGACY_STATIONERY_PROVIDED_KEY,
      true,
    );
    setStationeryProvided(true);
    toast.success("Stationery marked as provided");
  };

  const handleRequestUndertaking = () => {
    setStoredBool(
      UNDERTAKING_REQUESTED_KEY,
      LEGACY_UNDERTAKING_REQUESTED_KEY,
      true,
    );
    setUndertakingRequested(true);
    toast.success("Undertaking request submitted");
  };

  const handleApproveUndertaking = () => {
    setStoredBool(
      UNDERTAKING_APPROVED_KEY,
      LEGACY_UNDERTAKING_APPROVED_KEY,
      true,
    );
    setUndertakingApproved(true);
    toast.success("Undertaking approved");
  };

  const handleDownloadClearance = (type: "full" | "temporary") => {
    const title = type === "full" ? "FULL CLEARANCE" : "TEMPORARY CLEARANCE";
    const footerNote =
      type === "full"
        ? "All clearance conditions have been satisfied."
        : "Issued on approved undertaking pending final clearance.";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked. Please allow popups to print the clearance.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${studentInfo.regNumber}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; color: #0f172a; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #006837; padding-bottom: 20px; }
            .header h1 { color: #006837; font-size: 24px; margin: 0 0 10px 0; text-transform: uppercase; }
            .header p { margin: 0; font-size: 14px; font-weight: bold; color: #64748b; }
            .title { text-align: center; font-size: 20px; font-weight: bold; margin: 30px 0; text-decoration: underline; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 40px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .details div { font-size: 15px; }
            .details strong { color: #334155; }
            .status-summary { margin-bottom: 40px; }
            .status-summary h3 { font-size: 16px; margin-bottom: 15px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
            .status-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
            .status-row strong { font-weight: normal; }
            .footer-note { text-align: center; font-style: italic; margin-bottom: 60px; font-size: 14px; color: #475569; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
            .sign-box { text-align: center; width: 250px; }
            .sign-line { border-top: 1px solid #000; margin-bottom: 8px; }
            .meta { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 40px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${schoolConfig.name.full}</h1>
            <p>${schoolConfig.documents.clearanceHeader}</p>
          </div>
          
          <div class="title">${title}</div>
          
          <div class="details">
            <div><strong>Date:</strong> ${new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}</div>
            <div><strong>Student Name:</strong> ${studentInfo.name}</div>
            <div><strong>Registration No:</strong> ${studentInfo.regNumber}</div>
            <div><strong>Programme:</strong> ${studentInfo.program}</div>
            <div><strong>Department:</strong> ${studentInfo.department}</div>
            <div><strong>Session:</strong> ${studentInfo.session}</div>
          </div>

          <div class="status-summary">
            <h3>Clearance Checklist Status</h3>
            <div class="status-row"><strong>Registration Fee</strong> <span>${registrationPaid ? "PAID ✓" : "PENDING ✗"}</span></div>
            <div class="status-row"><strong>Documents Submitted</strong> <span>${documentsSubmitted ? "CONFIRMED ✓" : "PENDING ✗"}</span></div>
            <div class="status-row"><strong>Stationery Provided</strong> <span>${stationeryProvided ? "CONFIRMED ✓" : "PENDING ✗"}</span></div>
            <div class="status-row"><strong>Undertaking Approved</strong> <span>${undertakingApproved ? "APPROVED ✓" : "N/A"}</span></div>
          </div>

          <div class="footer-note">${footerNote}</div>

          <div class="signatures">
            <div class="sign-box">
              <div class="sign-line"></div>
              <strong>${schoolConfig.documents.registrarSignatureLabel}</strong>
              <div>${schoolConfig.name.short}</div>
            </div>
            <div class="sign-box">
              <div class="sign-line"></div>
              <strong>Student Signature & Date</strong>
            </div>
          </div>

          <div class="meta">${schoolConfig.documents.verificationNotice}</div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">
            Student Clearance
          </h1>
          <p className="text-muted-foreground">
            Track clearance requirements and download your clearance letter.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <ShieldCheck className="h-5 w-5 text-secondary" />
                Clearance Requirements
              </CardTitle>
              <CardDescription>
                All three requirements must be completed for full clearance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>Registration fee invoice paid</span>
                </div>
                <Badge variant={registrationPaid ? "emerald" : "warning"}>
                  {registrationPaid ? "Paid" : "Pending"}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-muted-foreground" />
                  <span>Required documents submitted</span>
                </div>
                <Badge variant={documentsSubmitted ? "emerald" : "warning"}>
                  {documentsSubmitted ? "Submitted" : "Pending"}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSignature className="h-4 w-4 text-muted-foreground" />
                  <span>Stationery provided</span>
                </div>
                <Badge variant={stationeryProvided ? "emerald" : "warning"}>
                  {stationeryProvided ? "Provided" : "Pending"}
                </Badge>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="outline" onClick={handleRefresh}>
                  Refresh status
                </Button>
                <Badge variant={fullyCleared ? "emerald" : "destructive"}>
                  {fullyCleared ? "Full clearance ready" : "Pending items"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <CheckCircle className="h-5 w-5 text-success" />
                Clearance Outcome
              </CardTitle>
              <CardDescription>
                Download full clearance or request an undertaking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fullyCleared ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-emerald-800">
                        Clearance complete
                      </p>
                      <p className="text-sm text-emerald-700">
                        You have satisfied all clearance requirements.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="portal"
                    onClick={() => handleDownloadClearance("full")}
                    className="w-full"
                  >
                    Download Full Clearance
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-medium text-amber-800">
                          Pending clearance items
                        </p>
                        <ul className="mt-1 text-sm text-amber-700 space-y-1">
                          {pendingItems.map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {!undertakingRequested && (
                    <Button
                      variant="outline-primary"
                      onClick={handleRequestUndertaking}
                    >
                      Request Undertaking
                    </Button>
                  )}

                  {undertakingRequested && !undertakingApproved && (
                    <div className="space-y-3">
                      <Badge variant="warning">
                        Undertaking awaiting approval
                      </Badge>
                      <Button
                        variant="outline"
                        onClick={handleApproveUndertaking}
                      >
                        Approve Undertaking (Demo)
                      </Button>
                    </div>
                  )}

                  {undertakingApproved && (
                    <Button
                      variant="gold"
                      onClick={() => handleDownloadClearance("temporary")}
                      className="w-full"
                    >
                      Download Temporary Clearance
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <FileText className="h-5 w-5 text-secondary" />
              Submit Documents & Stationery
            </CardTitle>
            <CardDescription>
              Confirm submissions with Students Affairs / Academic Registry.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium">Required Documents</p>
              <p className="text-sm text-muted-foreground">
                WAEC/NECO/NABTEB certificates, birth certificate, medical
                fitness report, and official admission letter.
              </p>
              <Button
                variant="outline"
                className="mt-3"
                disabled={documentsSubmitted}
                onClick={handleDocumentsSubmitted}
              >
                {documentsSubmitted ? "Submitted" : "Mark as Submitted"}
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium">Stationery & Folders</p>
              <p className="text-sm text-muted-foreground">
                Academic logbook, matriculation file, and registration folders.
              </p>
              <Button
                variant="outline"
                className="mt-3"
                disabled={stationeryProvided}
                onClick={handleStationeryProvided}
              >
                {stationeryProvided ? "Provided" : "Mark as Provided"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </StudentLayout>
  );
}
