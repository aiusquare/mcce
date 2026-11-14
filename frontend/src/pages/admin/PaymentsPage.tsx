import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { API_BASE, api } from "@/lib/api";

interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  program: string;
  type: string;
  amount: number;
  method: string;
  reference: string;
  status: "completed" | "pending" | "failed";
  date: string;
}

type PaymentStats = {
  todayRevenue: number;
  todayRevenueChange: number;
  weeklyRevenue: number;
  weeklyRevenueChange: number;
  pendingApprovals: number;
  pendingApprovalsChange: number;
  successRate: number;
  successRateChange: number;
};

const emptyStats: PaymentStats = {
  todayRevenue: 0,
  todayRevenueChange: 0,
  weeklyRevenue: 0,
  weeklyRevenueChange: 0,
  pendingApprovals: 0,
  pendingApprovalsChange: 0,
  successRate: 0,
  successRateChange: 0,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizePayment(raw: unknown): Payment | null {
  if (!isObject(raw)) {
    return null;
  }

  const status = String(raw.status || "pending").toLowerCase();
  return {
    id: String(raw.id || raw.payment_id || raw.reference || ""),
    studentId: String(raw.studentId || raw.student_id || ""),
    studentName: String(
      raw.studentName || raw.student_name || "Unknown Student",
    ),
    studentEmail: raw.studentEmail ? String(raw.studentEmail) : undefined,
    program: String(raw.program || raw.programme || "N/A"),
    type: String(raw.type || raw.invoice_title || "Fee Payment"),
    amount: toNumber(raw.amount),
    method: String(raw.method || "N/A"),
    reference: String(raw.reference || ""),
    status: ["completed", "pending", "failed"].includes(status)
      ? (status as Payment["status"])
      : "pending",
    date: String(raw.date || raw.paidAt || raw.createdAt || ""),
  };
}

function unwrapPayments(response: unknown) {
  const data = isObject(response) && isObject(response.data)
    ? response.data
    : response;
  const statsSource = isObject(data) && isObject(data.stats) ? data.stats : {};
  const paymentsSource = isObject(data) && Array.isArray(data.payments)
    ? data.payments
    : Array.isArray(data)
      ? data
      : [];

  return {
    stats: {
      todayRevenue: toNumber(statsSource.todayRevenue),
      todayRevenueChange: toNumber(statsSource.todayRevenueChange),
      weeklyRevenue: toNumber(statsSource.weeklyRevenue),
      weeklyRevenueChange: toNumber(statsSource.weeklyRevenueChange),
      pendingApprovals: toNumber(statsSource.pendingApprovals),
      pendingApprovalsChange: toNumber(statsSource.pendingApprovalsChange),
      successRate: toNumber(statsSource.successRate),
      successRateChange: toNumber(statsSource.successRateChange),
    },
    payments: paymentsSource.map(normalizePayment).filter(Boolean) as Payment[],
  };
}

export default function PaymentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/api/admin/payments");
      const snapshot = unwrapPayments(response);
      setPayments(snapshot.payments);
      setStats(snapshot.stats);
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

  const filteredPayments = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return payments.filter((payment) => {
      const matchesSearch =
        payment.studentName.toLowerCase().includes(query) ||
        payment.reference.toLowerCase().includes(query) ||
        payment.studentId.toLowerCase().includes(query) ||
        payment.program.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" || payment.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [payments, searchQuery, statusFilter]);

  const handleUpdatePaymentStatus = async (
    id: string,
    status: Payment["status"],
  ) => {
    setIsUpdating(true);
    try {
      await api.post(`/api/admin/payments/${encodeURIComponent(id)}/status`, {
        status,
      });
      await loadPayments();
      toast.success(
        status === "completed"
          ? "Payment approved successfully"
          : "Payment rejected",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update payment",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);

    try {
      const rawSession =
        localStorage.getItem("mccas_admin_session") ||
        localStorage.getItem("MCCAS_admin_session");
      const session = rawSession
        ? (JSON.parse(rawSession) as { token?: string })
        : null;
      const response = await fetch(
        `${API_BASE}/api/admin/payments/export${
          params.toString() ? `?${params}` : ""
        }`,
        {
          credentials: "include",
          headers: session?.token
            ? { Authorization: `Bearer ${session.token}` }
            : undefined,
        },
      );
      if (!response.ok) {
        throw new Error("Failed to export payments");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payment-transactions-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export payments",
      );
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      notation: amount >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: 1,
    }).format(amount);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const formatPercentChange = (change: number) =>
    `${change > 0 ? "+" : ""}${change}%`;

  const summaryCards = [
    {
      title: "Today's Revenue",
      value: formatCurrency(stats.todayRevenue),
      change: formatPercentChange(stats.todayRevenueChange),
      trend: stats.todayRevenueChange >= 0 ? "up" : "down",
      icon: CreditCard,
    },
    {
      title: "Weekly Revenue",
      value: formatCurrency(stats.weeklyRevenue),
      change: formatPercentChange(stats.weeklyRevenueChange),
      trend: stats.weeklyRevenueChange >= 0 ? "up" : "down",
      icon: TrendingUp,
    },
    {
      title: "Pending Approvals",
      value: stats.pendingApprovals.toLocaleString(),
      change: formatPercentChange(stats.pendingApprovalsChange),
      trend: stats.pendingApprovalsChange <= 0 ? "down" : "up",
      icon: Clock,
    },
    {
      title: "Success Rate",
      value: `${stats.successRate}%`,
      change: formatPercentChange(stats.successRateChange),
      trend: stats.successRateChange >= 0 ? "up" : "down",
      icon: CheckCircle,
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">
              Payments
            </h1>
            <p className="text-muted-foreground">
              Track and manage student payment transactions
            </p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <div className="flex items-center gap-1">
                        {stat.trend === "up" ? (
                          <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-destructive" />
                        )}
                        <span
                          className={`text-sm ${
                            stat.trend === "up"
                              ? "text-emerald-600"
                              : "text-destructive"
                          }`}
                        >
                          {stat.change}
                        </span>
                      </div>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <stat.icon className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Payment Transactions</CardTitle>
                <CardDescription>
                  View and manage all payment records
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search payments..."
                    className="w-64 pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Loading payments...
                      </TableCell>
                    </TableRow>
                  ) : filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No payment transactions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-sm">
                          {payment.reference}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {payment.studentName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payment.studentId || payment.studentEmail || "-"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{payment.program}</TableCell>
                        <TableCell>{payment.type}</TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>{payment.method}</TableCell>
                        <TableCell>
                          {payment.date
                            ? new Date(payment.date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.status === "completed"
                                ? "emerald"
                                : payment.status === "pending"
                                  ? "warning"
                                  : "destructive"
                            }
                            className="flex w-fit items-center gap-1"
                          >
                            {getStatusIcon(payment.status)}
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {payment.status === "pending" && (
                                <>
                                  <DropdownMenuItem
                                    disabled={isUpdating}
                                    onClick={() =>
                                      void handleUpdatePaymentStatus(
                                        payment.id,
                                        "completed",
                                      )
                                    }
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={isUpdating}
                                    onClick={() =>
                                      void handleUpdatePaymentStatus(
                                        payment.id,
                                        "failed",
                                      )
                                    }
                                    className="text-destructive"
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuItem onClick={handleExport}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Receipt
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
