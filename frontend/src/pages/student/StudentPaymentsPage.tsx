import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle,
  Clock,
  Copy,
  CreditCard,
  Landmark,
  Printer,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  createStudentWalletFundingAccount,
  getStudentPayments,
  payStudentInvoice,
  requeryStudentWalletFundingAccount,
} from "@/lib/api";
import {
  buildPaymentReference,
  initializePaystackPayment,
} from "@/lib/paystack";
import { schoolConfig } from "@/config/schoolConfig";

type InvoiceStatus = "pending" | "overdue" | "paid";

type InvoiceItem = {
  description: string;
  amount: number;
};

type Invoice = {
  id: string;
  title: string;
  description?: string;
  amount: number;
  items?: InvoiceItem[];
  dueDate: string | null;
  status: InvoiceStatus;
};

type Transaction = {
  id: string;
  type: "debit" | "credit";
  amount: number;
  date: string | null;
  reference: string;
  description: string;
  status: "completed" | "pending";
};

type ReceiptItem = {
  id: string;
  invoiceId: string;
  title: string;
  amount: number;
  date: string | null;
  reference: string;
  method: string;
};

type FundingAccountStatus = "active" | "pending" | "failed" | "inactive";

type WalletFundingAccount = {
  id: string;
  gateway: string;
  provider: string;
  providerSlug?: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  status: FundingAccountStatus;
  createdAt?: string | null;
};

type PaymentGateway = {
  id: string;
  name: string;
  type: "wallet" | "bank_transfer" | "checkout";
  status: "available" | "coming_soon" | "unavailable";
  feeDescription?: string;
  supportsDedicatedVirtualAccount?: boolean;
};

type PaymentSnapshot = {
  walletBalance: number;
  walletCurrency?: string;
  payerEmail?: string;
  fundingAccounts: WalletFundingAccount[];
  gateways: PaymentGateway[];
  invoices: Invoice[];
  transactions: Transaction[];
  receipts: ReceiptItem[];
  summary?: {
    outstandingAmount?: number;
    totalPaid?: number;
    netBalance?: number;
  };
};

const emptySnapshot: PaymentSnapshot = {
  walletBalance: 0,
  walletCurrency: "NGN",
  fundingAccounts: [],
  gateways: [],
  invoices: [],
  transactions: [],
  receipts: [],
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value);
    }
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const numberValue = Number(value);
    if (!Number.isNaN(numberValue)) return numberValue;
  }
  return 0;
}

function getStoredStudentProfile() {
  try {
    const stored =
      localStorage.getItem("mccas_profile") ||
      localStorage.getItem("MCCAS_profile") ||
      localStorage.getItem("mcchst_profile");
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getStoredStudentEmail() {
  const profile = getStoredStudentProfile();
  return firstString(
    profile.email,
    profile.Email,
    profile.studentEmail,
    profile.student_email,
  );
}

function sanitizeReferencePart(value: string) {
  return value.replace(/[^A-Z0-9]/gi, "-").replace(/-+/g, "-").toUpperCase();
}

function waitForDialogTeardown() {
  return new Promise((resolve) => window.setTimeout(resolve, 150));
}

function normalizeFundingAccount(raw: unknown): WalletFundingAccount | null {
  if (!isObject(raw)) return null;

  const bank = isObject(raw.bank) ? raw.bank : {};
  const assignment = isObject(raw.assignment) ? raw.assignment : {};
  const accountNumber = firstString(
    raw.accountNumber,
    raw.account_number,
    raw.nuban,
    raw.account,
  );

  if (!accountNumber) return null;

  const statusText = firstString(raw.status).toLowerCase();
  const isActive =
    raw.active === true ||
    raw.assigned === true ||
    statusText === "active" ||
    statusText === "assigned";
  const status: FundingAccountStatus =
    statusText === "pending"
      ? "pending"
      : statusText === "failed"
        ? "failed"
        : isActive
          ? "active"
          : "inactive";

  return {
    id: firstString(raw.id, raw.account_id, accountNumber),
    gateway: firstString(raw.gateway, raw.provider, "paystack").toLowerCase(),
    provider: firstString(raw.provider, raw.provider_name, bank.name, "Paystack"),
    providerSlug: firstString(
      raw.provider_slug,
      raw.providerSlug,
      raw.preferred_bank,
      bank.slug,
      assignment.provider_slug,
    ),
    bankName: firstString(
      raw.bankName,
      raw.bank_name,
      bank.name,
      typeof raw.bank === "string" ? raw.bank : undefined,
    ),
    accountName: firstString(raw.accountName, raw.account_name, raw.name),
    accountNumber,
    currency: firstString(raw.currency, "NGN"),
    status,
    createdAt: firstString(raw.createdAt, raw.created_at) || null,
  };
}

function collectFundingAccounts(data: Record<string, unknown>) {
  const wallet = isObject(data.wallet) ? data.wallet : {};
  const customer = isObject(data.customer) ? data.customer : {};
  const rawSources = [
    data.fundingAccounts,
    data.funding_accounts,
    data.virtualAccounts,
    data.virtual_accounts,
    data.dedicatedAccount,
    data.dedicated_account,
    wallet.fundingAccounts,
    wallet.funding_accounts,
    wallet.virtualAccounts,
    wallet.virtual_accounts,
    wallet.dedicatedAccount,
    wallet.dedicated_account,
    customer.dedicated_account,
    data,
  ];

  return rawSources.flatMap((source) => {
    if (Array.isArray(source)) {
      return source
        .map(normalizeFundingAccount)
        .filter(Boolean) as WalletFundingAccount[];
    }
    const account = normalizeFundingAccount(source);
    return account ? [account] : [];
  });
}

function normalizeGateways(raw: unknown): PaymentGateway[] {
  if (!Array.isArray(raw)) {
    return [
      {
        id: "paystack",
        name: "Paystack",
        type: "bank_transfer",
        status: "available",
        feeDescription: "Bank transfers are credited after webhook confirmation",
        supportsDedicatedVirtualAccount: true,
      },
    ];
  }

  return raw.map((item) => {
    const gateway = isObject(item) ? item : {};
    return {
      id: firstString(gateway.id, gateway.gateway, gateway.code).toLowerCase(),
      name: firstString(gateway.name, gateway.label),
      type:
        firstString(gateway.type) === "checkout"
          ? "checkout"
          : firstString(gateway.type) === "wallet"
            ? "wallet"
            : "bank_transfer",
      status:
        firstString(gateway.status) === "coming_soon"
          ? "coming_soon"
          : firstString(gateway.status) === "unavailable"
            ? "unavailable"
            : "available",
      feeDescription: firstString(
        gateway.feeDescription,
        gateway.fee_description,
      ),
      supportsDedicatedVirtualAccount: Boolean(
        gateway.supportsDedicatedVirtualAccount ??
          gateway.supports_dedicated_virtual_account,
      ),
    };
  });
}

function unwrapSnapshot(response: unknown): PaymentSnapshot {
  const data = isObject(response) && isObject(response.data)
    ? response.data
    : response;

  if (!isObject(data)) {
    return emptySnapshot;
  }

  const wallet = isObject(data.wallet) ? data.wallet : {};

  return {
    walletBalance: firstNumber(
      data.walletBalance,
      data.wallet_balance,
      wallet.balance,
      wallet.walletBalance,
      wallet.wallet_balance,
    ),
    walletCurrency: firstString(data.walletCurrency, wallet.currency, "NGN"),
    payerEmail: firstString(
      data.email,
      data.studentEmail,
      data.student_email,
      data.applicantEmail,
      data.applicant_email,
      wallet.email,
    ),
    fundingAccounts: collectFundingAccounts(data),
    gateways: normalizeGateways(data.gateways ?? data.paymentGateways),
    invoices: Array.isArray(data.invoices) ? (data.invoices as Invoice[]) : [],
    transactions: Array.isArray(data.transactions)
      ? (data.transactions as Transaction[])
      : [],
    receipts: Array.isArray(data.receipts) ? (data.receipts as ReceiptItem[]) : [],
    summary: isObject(data.summary)
      ? {
          outstandingAmount: Number(data.summary.outstandingAmount ?? 0),
          totalPaid: Number(data.summary.totalPaid ?? 0),
          netBalance: Number(data.summary.netBalance ?? 0),
        }
      : undefined,
  };
}

function mergePaymentSnapshot(
  current: PaymentSnapshot,
  response: unknown,
): PaymentSnapshot {
  const next = unwrapSnapshot(response);
  const hasLedgerData =
    next.invoices.length > 0 ||
    next.transactions.length > 0 ||
    next.receipts.length > 0 ||
    next.summary;

  if (hasLedgerData) return next;

  return {
    ...current,
    walletBalance: next.walletBalance || current.walletBalance,
    walletCurrency: next.walletCurrency || current.walletCurrency,
    fundingAccounts:
      next.fundingAccounts.length > 0
        ? next.fundingAccounts
        : current.fundingAccounts,
    gateways: next.gateways.length > 0 ? next.gateways : current.gateways,
  };
}

const StudentPaymentsPage = () => {
  const [searchParams] = useSearchParams();
  const [snapshot, setSnapshot] = useState<PaymentSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEnsuringFundingAccount, setIsEnsuringFundingAccount] =
    useState(false);
  const [isRequeryingFunding, setIsRequeryingFunding] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("wallet");
  const [selectedGateway, setSelectedGateway] = useState("paystack");
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [referenceInput, setReferenceInput] = useState("");
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);
  const [receiptToPrint, setReceiptToPrint] = useState<ReceiptItem | null>(null);

  const activeFundingAccount = useMemo(
    () =>
      snapshot.fundingAccounts.find(
        (account) =>
          account.gateway === selectedGateway && account.status === "active",
      ) ||
      snapshot.fundingAccounts.find((account) => account.status === "active") ||
      snapshot.fundingAccounts[0] ||
      null,
    [selectedGateway, snapshot.fundingAccounts],
  );

  const transferGateway = useMemo(
    () =>
      snapshot.gateways.find(
        (gateway) =>
          gateway.id === selectedGateway &&
          gateway.supportsDedicatedVirtualAccount,
      ) ||
      snapshot.gateways.find(
        (gateway) => gateway.supportsDedicatedVirtualAccount,
      ) ||
      snapshot.gateways[0] ||
      null,
    [selectedGateway, snapshot.gateways],
  );

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const response = await getStudentPayments();
      setSnapshot(unwrapSnapshot(response));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load payments",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPayments();
  }, []);

  useEffect(() => {
    if (transferGateway?.id && transferGateway.id !== selectedGateway) {
      setSelectedGateway(transferGateway.id);
    }
  }, [selectedGateway, transferGateway?.id]);

  useEffect(() => {
    const targetInvoiceId = searchParams.get("invoiceId");
    if (!targetInvoiceId || snapshot.invoices.length === 0) return;

    const targetInvoice = snapshot.invoices.find(
      (invoice) => invoice.id === targetInvoiceId,
    );
    if (!targetInvoice || targetInvoice.status === "paid") return;

    setActiveInvoice(targetInvoice);
    setPaymentMethod("wallet");
    setReferenceInput("");
    setIsPayDialogOpen(true);
  }, [snapshot.invoices, searchParams]);

  const outstandingAmount = useMemo(
    () =>
      snapshot.summary?.outstandingAmount ??
      snapshot.invoices
        .filter((invoice) => invoice.status !== "paid")
        .reduce((sum, invoice) => sum + invoice.amount, 0),
    [snapshot.invoices, snapshot.summary?.outstandingAmount],
  );

  const totalPaid = useMemo(
    () =>
      snapshot.summary?.totalPaid ??
      snapshot.invoices
        .filter((invoice) => invoice.status === "paid")
        .reduce((sum, invoice) => sum + invoice.amount, 0),
    [snapshot.invoices, snapshot.summary?.totalPaid],
  );

  const credits = useMemo(
    () =>
      snapshot.transactions
        .filter((txn) => txn.type === "credit")
        .reduce((sum, txn) => sum + txn.amount, 0),
    [snapshot.transactions],
  );

  const debits = useMemo(
    () =>
      snapshot.transactions
        .filter((txn) => txn.type === "debit")
        .reduce((sum, txn) => sum + txn.amount, 0),
    [snapshot.transactions],
  );

  const netBalance =
    snapshot.summary?.netBalance ?? snapshot.walletBalance - outstandingAmount;
  const netStatus = netBalance >= 0 ? "In Credit" : "Outstanding";
  const payerEmail = snapshot.payerEmail || getStoredStudentEmail();
  const selectedGatewayName =
    snapshot.gateways.find((gateway) => gateway.id === selectedGateway)?.name ||
    (selectedGateway === "paystack" ? "Paystack" : selectedGateway);

  const handleOpenPayDialog = (invoice: Invoice) => {
    setActiveInvoice(invoice);
    setPaymentMethod("wallet");
    setReferenceInput("");
    setIsPayDialogOpen(true);
  };

  const handleCopy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  };

  const handleEnsureFundingAccount = async () => {
    setIsEnsuringFundingAccount(true);
    try {
      const response = await createStudentWalletFundingAccount({
        gateway: selectedGateway,
        consent: true,
      });
      setSnapshot((current) => mergePaymentSnapshot(current, response));
      toast.success("Wallet funding account requested", {
        description: "Refresh if the account is still being assigned.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to create wallet funding account",
      );
    } finally {
      setIsEnsuringFundingAccount(false);
    }
  };

  const handleRequeryFundingAccount = async () => {
    if (!activeFundingAccount) {
      toast.error("No wallet funding account is available yet.");
      return;
    }

    setIsRequeryingFunding(true);
    try {
      const response = await requeryStudentWalletFundingAccount({
        gateway: activeFundingAccount.gateway,
        account_number: activeFundingAccount.accountNumber,
        provider_slug: activeFundingAccount.providerSlug,
      });
      setSnapshot((current) => mergePaymentSnapshot(current, response));
      toast.success("Transfer status check requested", {
        description: "Confirmed transfers will reflect in your wallet balance.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to check wallet transfer status",
      );
    } finally {
      setIsRequeryingFunding(false);
    }
  };

  const handlePayInvoice = async () => {
    if (!activeInvoice) return;

    if (paymentMethod === "wallet" && snapshot.walletBalance < activeInvoice.amount) {
      toast.error("Wallet balance is not enough for this invoice.", {
        description: "Fund your wallet with your virtual account, then try again.",
      });
      setPaymentMethod("fund-wallet");
      return;
    }

    if (paymentMethod === "fund-wallet") {
      if (!activeFundingAccount) {
        await handleEnsureFundingAccount();
      } else {
        await handleRequeryFundingAccount();
      }
      return;
    }

    setIsSubmitting(true);
    try {
      if (paymentMethod === "gateway-checkout" && selectedGateway === "paystack") {
        if (!payerEmail) {
          toast.error("Student email is required for Paystack Checkout.");
          return;
        }

        setIsPayDialogOpen(false);
        await waitForDialogTeardown();

        const reference = buildPaymentReference(
          `${schoolConfig.payment.invoicePrefix}${sanitizeReferencePart(activeInvoice.id)}`,
        );
        const payment = await initializePaystackPayment({
          email: payerEmail,
          amount: activeInvoice.amount,
          reference,
          label: activeInvoice.title,
          metadata: {
            payment_type: "student_invoice",
            invoice_id: activeInvoice.id,
            invoice_title: activeInvoice.title,
            gateway: "paystack",
          },
        });

        const response = await payStudentInvoice({
          invoice_id: activeInvoice.id,
          method: "gateway-checkout",
          gateway: "paystack",
          reference: payment.reference || reference,
        });
        setSnapshot(unwrapSnapshot(response));
        toast.success("Paystack payment successful. Receipt generated.", {
          description: `Reference: ${payment.reference || reference}`,
        });
        setIsPayDialogOpen(false);
        setActiveInvoice(null);
        return;
      }

      const response = await payStudentInvoice({
        invoice_id: activeInvoice.id,
        method: paymentMethod,
        gateway: paymentMethod === "wallet" ? undefined : selectedGateway,
        reference: referenceInput.trim() || undefined,
      });
      setSnapshot(unwrapSnapshot(response));
      toast.success("Payment successful. Receipt generated.");
      setIsPayDialogOpen(false);
      setActiveInvoice(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to record payment",
      );
      if (paymentMethod === "gateway-checkout" && activeInvoice) {
        setIsPayDialogOpen(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = (receipt: ReceiptItem) => {
    setReceiptToPrint(receipt);
    setTimeout(() => {
      window.print();
      setReceiptToPrint(null);
    }, 200);
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    setInvoiceToPrint(invoice);
    setTimeout(() => {
      window.print();
      setInvoiceToPrint(null);
    }, 200);
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Payments & Receipts
            </h1>
            <p className="text-muted-foreground">
              Track your wallet, invoices, transactions, and receipts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={netBalance >= 0 ? "emerald" : "destructive"}>
              {netStatus}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadPayments()}
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Wallet Balance
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(snapshot.walletBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">Live balance</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Outstanding Invoices
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(outstandingAmount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pending + overdue
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Balance</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(netBalance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Wallet minus outstanding
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-info/10">
                  <CreditCard className="h-6 w-6 text-info" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalPaid)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    All settled invoices
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Wallet className="h-5 w-5 text-secondary" />
              Balance Snapshot
            </CardTitle>
            <CardDescription>
              Wallet summary and outstanding obligations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Credits</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(credits)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Debits</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(debits)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-lg font-semibold">
                  {netBalance >= 0 ? "Wallet in Credit" : "Outstanding Balance"}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Outstanding amount is based on unpaid backend invoices.
              </p>
              <Badge variant={netBalance >= 0 ? "emerald" : "destructive"}>
                {netStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-serif">
                  <Landmark className="h-5 w-5 text-secondary" />
                  Wallet Funding Account
                </CardTitle>
                <CardDescription>
                  Transfer into your wallet, then settle invoices from your balance
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {snapshot.gateways.length > 1 && (
                  <Select
                    value={selectedGateway}
                    onValueChange={setSelectedGateway}
                  >
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Gateway" />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshot.gateways.map((gateway) => (
                        <SelectItem
                          key={gateway.id}
                          value={gateway.id}
                          disabled={gateway.status !== "available"}
                        >
                          {gateway.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRequeryFundingAccount()}
                  disabled={!activeFundingAccount || isRequeryingFunding}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isRequeryingFunding ? "Checking..." : "Check Transfer"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeFundingAccount ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">Bank</p>
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <p className="font-semibold">
                      {activeFundingAccount.bankName || "Bank unavailable"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activeFundingAccount.provider || "Funding provider"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">
                        Account Number
                      </p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          void handleCopy(
                            activeFundingAccount.accountNumber,
                            "Account number",
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="font-mono text-lg font-semibold">
                      {activeFundingAccount.accountNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activeFundingAccount.currency}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground">
                        Account Name
                      </p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          void handleCopy(
                            activeFundingAccount.accountName,
                            "Account name",
                          )
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="font-semibold">
                      {activeFundingAccount.accountName ||
                        schoolConfig.payment.walletName}
                    </p>
                    <Badge
                      className="mt-2"
                      variant={
                        activeFundingAccount.status === "active"
                          ? "emerald"
                          : activeFundingAccount.status === "failed"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {activeFundingAccount.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">
                      Transfers to this account credit your wallet after
                      confirmation.
                    </p>
                    <p>
                      Use the exact account details above. Then refresh or check
                      transfer status before paying an invoice.
                    </p>
                  </div>
                  <Button
                    variant="outline-primary"
                    onClick={() => void loadPayments()}
                    disabled={isLoading}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Balance
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4 rounded-lg border border-dashed p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">
                    No wallet funding account assigned yet.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Request a dedicated transfer account from{" "}
                    {transferGateway?.name || "the active gateway"} to fund your
                    wallet by bank transfer.
                  </p>
                </div>
                <Button
                  onClick={() => void handleEnsureFundingAccount()}
                  disabled={isEnsuringFundingAccount}
                >
                  <Landmark className="mr-2 h-4 w-4" />
                  {isEnsuringFundingAccount ? "Requesting..." : "Request Account"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Receipt className="h-5 w-5 text-secondary" />
              Invoices Raised for You
            </CardTitle>
            <CardDescription>
              Pay outstanding invoices and view status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      Loading payments...
                    </TableCell>
                  </TableRow>
                ) : snapshot.invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No invoices have been raised for you.
                    </TableCell>
                  </TableRow>
                ) : (
                  snapshot.invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="font-medium">{invoice.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.id}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                      <TableCell>{invoice.dueDate || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            invoice.status === "paid"
                              ? "emerald"
                              : invoice.status === "overdue"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintInvoice(invoice)}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </Button>
                          {invoice.status === "paid" ? (
                            <Badge variant="emerald">Paid</Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPayDialog(invoice)}
                            >
                              Pay Now
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <ArrowUpRight className="h-5 w-5 text-success" />
                Credits & Debits
              </CardTitle>
              <CardDescription>All account transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No transactions yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    snapshot.transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {txn.type === "credit" ? (
                              <ArrowUpRight className="h-4 w-4 text-success" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-destructive" />
                            )}
                            <div>
                              <div className="font-medium">
                                {txn.type === "credit" ? "Credit" : "Debit"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {txn.reference}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(txn.amount)}</TableCell>
                        <TableCell>{txn.date || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              txn.status === "completed" ? "emerald" : "warning"
                            }
                          >
                            {txn.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Receipt className="h-5 w-5 text-secondary" />
                Receipts
              </CardTitle>
              <CardDescription>
                Print receipts for completed payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.receipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No receipts yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    snapshot.receipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>
                          <div className="font-medium">{receipt.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {receipt.reference}
                          </div>
                        </TableCell>
                        <TableCell>{formatCurrency(receipt.amount)}</TableCell>
                        <TableCell>{receipt.date || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handlePrintReceipt(receipt)}
                          >
                            Print
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
            <DialogDescription>
              Complete payment for {activeInvoice?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Invoice Amount
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(activeInvoice?.amount || 0)}
                  </p>
                </div>
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              {activeInvoice?.items && activeInvoice.items.length > 0 && (
                <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                  {activeInvoice.items.map((item, index) => (
                    <div key={`${item.description}-${index}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {item.description}
                      </span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wallet">Wallet Balance</SelectItem>
                  <SelectItem value="fund-wallet">
                    Fund Wallet by Bank Transfer
                  </SelectItem>
                  <SelectItem value="gateway-checkout">
                    {selectedGateway === "paystack"
                      ? "Paystack Checkout"
                      : `${selectedGatewayName} Checkout`}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === "wallet" && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    Available wallet balance
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(snapshot.walletBalance)}
                  </span>
                </div>
                {activeInvoice &&
                  snapshot.walletBalance < activeInvoice.amount && (
                    <p className="mt-2 text-warning">
                      Fund your wallet before settling this invoice.
                    </p>
                  )}
              </div>
            )}

            {paymentMethod === "fund-wallet" && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                {activeFundingAccount ? (
                  <>
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Bank</p>
                        <p className="font-medium">
                          {activeFundingAccount.bankName || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Account Number</p>
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-medium">
                            {activeFundingAccount.accountNumber}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() =>
                              void handleCopy(
                                activeFundingAccount.accountNumber,
                                "Account number",
                              )
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Account Name</p>
                        <p className="font-medium">
                          {activeFundingAccount.accountName ||
                            schoolConfig.payment.walletName}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Transfer at least{" "}
                      {formatCurrency(activeInvoice?.amount || 0)} before
                      checking transfer status.
                    </p>
                    <Button
                      variant="outline-primary"
                      onClick={() => void handleRequeryFundingAccount()}
                      disabled={isRequeryingFunding}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {isRequeryingFunding ? "Checking..." : "Check Transfer"}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Request a dedicated virtual account to fund your wallet.
                    </p>
                    <Button
                      onClick={() => void handleEnsureFundingAccount()}
                      disabled={isEnsuringFundingAccount}
                    >
                      <Landmark className="mr-2 h-4 w-4" />
                      {isEnsuringFundingAccount
                        ? "Requesting..."
                        : "Request Account"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "gateway-checkout" && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">
                      {selectedGateway === "paystack"
                        ? "Pay with Paystack Checkout"
                        : `Pay with ${selectedGatewayName} Checkout`}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedGateway === "paystack"
                        ? "You will complete this invoice payment securely in Paystack, then the receipt will be generated here."
                        : "This checkout route is handled by the selected payment provider on the backend."}
                    </p>
                  </div>
                </div>

                {selectedGateway === "paystack" ? (
                  <div className="rounded-md bg-background p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">{payerEmail || "Not found"}</span>
                    </div>
                    {!payerEmail && (
                      <p className="mt-2 text-warning">
                        Update your student profile email before using Paystack
                        Checkout.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="reference">Gateway Reference (optional)</Label>
                    <Input
                      id="reference"
                      placeholder="Enter payment reference"
                      value={referenceInput}
                      onChange={(event) => setReferenceInput(event.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPayDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayInvoice}
              disabled={
                isSubmitting || isEnsuringFundingAccount || isRequeryingFunding
              }
            >
              {isSubmitting
                ? "Processing..."
                : paymentMethod === "fund-wallet"
                  ? activeFundingAccount
                    ? "Check Transfer"
                    : "Request Account"
                  : paymentMethod === "gateway-checkout" &&
                      selectedGateway === "paystack"
                    ? "Pay with Paystack"
                  : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {invoiceToPrint && (
        <div className="fixed inset-0 z-[-1] hidden print:block">
          <div className="mx-auto w-full max-w-2xl border p-8 text-sm">
            <div className="mb-6 flex items-start justify-between gap-6">
              <div>
                <p className="text-xl font-bold tracking-tight text-primary">
                  {schoolConfig.name.acronym}
                </p>
                <p className="font-medium text-xs text-muted-foreground">
                  {schoolConfig.documents.letterheadTitle}
                </p>
                <p className="font-semibold text-sm mt-1">
                  {schoolConfig.documents.invoiceHeader}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{invoiceToPrint.id}</p>
                <p>Issued: {new Date().toISOString().split("T")[0]}</p>
                <p>Due: {invoiceToPrint.dueDate || "-"}</p>
              </div>
            </div>

            <div className="mb-6 border-y py-4">
              <p className="text-lg font-semibold">{invoiceToPrint.title}</p>
              {invoiceToPrint.description && (
                <p className="mt-1 text-muted-foreground">
                  {invoiceToPrint.description}
                </p>
              )}
              <p className="mt-2">
                <strong>Status:</strong> {invoiceToPrint.status}
              </p>
            </div>

            <table className="mb-6 w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border-b py-2">Item</th>
                  <th className="border-b py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoiceToPrint.items && invoiceToPrint.items.length > 0
                  ? invoiceToPrint.items
                  : [{ description: invoiceToPrint.title, amount: invoiceToPrint.amount }]
                ).map((item, index) => (
                  <tr key={`${item.description}-${index}`}>
                    <td className="border-b py-2">{item.description}</td>
                    <td className="border-b py-2 text-right">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-4 text-right font-semibold">Total</td>
                  <td className="pt-4 text-right font-semibold">
                    {formatCurrency(invoiceToPrint.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-8 text-xs text-muted-foreground">
              <p>Generated from the {schoolConfig.name.acronym} Student Portal.</p>
              <p>Present this invoice when making bank or administrative payment enquiries.</p>
            </div>
          </div>
        </div>
      )}

      {receiptToPrint && (
        <div className="fixed inset-0 z-[-1] hidden print:block">
          <div className="mx-auto w-full max-w-md border p-6 text-sm">
            <div className="mb-4 text-center">
              <p className="text-xl font-bold tracking-tight text-primary">{schoolConfig.name.acronym}</p>
              <p className="text-xs text-muted-foreground">{schoolConfig.name.official}</p>
              <p className="font-semibold text-sm mt-1">{schoolConfig.documents.receiptHeader}</p>
            </div>
            <div className="space-y-2">
              <p>
                <strong>Receipt:</strong> {receiptToPrint.id}
              </p>
              <p>
                <strong>Invoice:</strong> {receiptToPrint.invoiceId}
              </p>
              <p>
                <strong>Title:</strong> {receiptToPrint.title}
              </p>
              <p>
                <strong>Amount:</strong> {formatCurrency(receiptToPrint.amount)}
              </p>
              <p>
                <strong>Date:</strong> {receiptToPrint.date || "-"}
              </p>
              <p>
                <strong>Reference:</strong> {receiptToPrint.reference}
              </p>
              <p>
                <strong>Method:</strong> {receiptToPrint.method}
              </p>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
};

export default StudentPaymentsPage;
