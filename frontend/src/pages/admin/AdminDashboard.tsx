import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Users,
  FileText,
  CreditCard,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  GraduationCap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import schoolConfig from "@/config/schoolConfig";
import api from "@/lib/api";
import { toast } from "sonner";

type DashboardData = {
  session?: {
    id?: string | null;
    name?: string | null;
  } | null;
  summary?: {
    totalStudents?: number;
    activeApplications?: number;
    monthlyRevenue?: number;
    hostelOccupancy?: number;
    reviewApplications?: number;
    pendingPayments?: number;
    hostelRequests?: number;
    supportTickets?: number;
  } | null;
  recentApplications?: Array<{
    id: string;
    name: string;
    program: string;
    date?: string | null;
    status: string;
  }>;
  recentPayments?: Array<{
    student: string;
    type: string;
    amount: number;
    status: string;
    date?: string | null;
  }>;
};

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("en-NG").format(value || 0);
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPercentage(value?: number | null) {
  return `${Math.round(value || 0)}%`;
}

const systemServices = [
  { name: "Student Portal", status: "operational" },
  { name: "Payment Gateway", status: "operational" },
  { name: "NIN Verification", status: "operational" },
  { name: "Email Service", status: "degraded" },
] as const;

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.getAdminDashboard();
        setDashboard((response?.data as DashboardData) || null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load dashboard",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const summary = dashboard?.summary;
  const stats = [
    {
      title: "Total Students",
      value: formatNumber(summary?.totalStudents),
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Active Applications",
      value: formatNumber(summary?.activeApplications),
      icon: FileText,
      color: "bg-info/10 text-info",
    },
    {
      title: "Degree Programmes",
      value: schoolConfig.academics.programCount.toString(),
      icon: GraduationCap,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      title: "Revenue (This Month)",
      value: formatCurrency(summary?.monthlyRevenue),
      icon: CreditCard,
      color: "bg-success/10 text-success",
    },
  ];

  const quickActions = [
    {
      title: "Review Applications",
      count: summary?.reviewApplications || 0,
      href: "/admin/applications",
    },
    {
      title: "Pending Payments",
      count: summary?.pendingPayments || 0,
      href: "/admin/payments",
    },
    {
      title: "Hostel Requests",
      count: summary?.hostelRequests || 0,
      href: "/admin/dashboard",
    },
    {
      title: "Support Tickets",
      count: summary?.supportTickets || 0,
      href: "/admin/dashboard",
    },
  ];

  const recentApplications = dashboard?.recentApplications || [];
  const recentPayments = dashboard?.recentPayments || [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl text-primary">
              {schoolConfig.name.acronym} Admin Console
            </h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Here's an overview of the institution's performance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="gold" className="px-3 py-1">
              <Clock className="mr-1 h-3 w-3" />
              {dashboard?.session?.name || "No Active Session"}
            </Badge>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="card-elevated">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}
                    >
                      <stat.icon className="h-6 w-6" />
                    </div>
                    {isLoading ? (
                      <span className="text-xs text-muted-foreground">
                        Loading...
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4">
                    <p className="font-serif text-2xl font-bold">
                      {stat.value}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {stat.title}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="hero-gradient border-0">
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {quickActions.map((action) => (
                  <div
                    key={action.title}
                    className="flex items-center justify-between rounded-lg bg-primary-foreground/10 p-4"
                  >
                    <div>
                      <p className="text-sm text-primary-foreground/80">
                        {action.title}
                      </p>
                      <p className="font-serif text-2xl font-bold text-primary-foreground">
                        {action.count}
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="hero"
                      size="icon"
                      className="h-8 w-8"
                    >
                      <Link to={action.href}>
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Two Column Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Applications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card className="card-elevated h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-serif">
                    Recent Applications
                  </CardTitle>
                  <CardDescription>
                    Latest admission applications
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/applications">View All</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentApplications.length > 0 ? (
                  <div className="space-y-4">
                    {recentApplications.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <GraduationCap className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{app.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {app.program} • {app.id}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={
                            app.status === "approved"
                              ? "approved"
                              : app.status === "rejected"
                                ? "rejected"
                                : "pending"
                          }
                        >
                          {app.status === "approved" && (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          )}
                          {app.status === "rejected" && (
                            <XCircle className="mr-1 h-3 w-3" />
                          )}
                          {app.status !== "approved" &&
                            app.status !== "rejected" && (
                              <Clock className="mr-1 h-3 w-3" />
                            )}
                          {app.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isLoading
                      ? "Loading applications..."
                      : "No recent applications found."}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Payments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <Card className="card-elevated h-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="font-serif">Recent Payments</CardTitle>
                  <CardDescription>
                    Latest financial transactions
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/payments">View All</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentPayments.length > 0 ? (
                  <div className="space-y-4">
                    {recentPayments.map((payment, index) => (
                      <div
                        key={`${payment.student}-${payment.type}-${index}`}
                        className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full ${
                              payment.status === "completed"
                                ? "bg-success/10"
                                : "bg-warning/10"
                            }`}
                          >
                            <CreditCard
                              className={`h-5 w-5 ${
                                payment.status === "completed"
                                  ? "text-success"
                                  : "text-warning"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-medium">{payment.student}</p>
                            <p className="text-xs text-muted-foreground">
                              {payment.type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p
                            className={`text-xs ${
                              payment.status === "completed"
                                ? "text-success"
                                : "text-warning"
                            }`}
                          >
                            {payment.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {isLoading
                      ? "Loading payments..."
                      : "No recent payments found."}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="font-serif">System Status</CardTitle>
              <CardDescription>
                Current status of system components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {systemServices.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <span className="text-sm font-medium">{service.name}</span>
                    <Badge
                      variant={
                        service.status === "operational" ? "success" : "warning"
                      }
                    >
                      {service.status === "operational" ? (
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                      ) : (
                        <AlertCircle className="mr-1 h-3 w-3" />
                      )}
                      {service.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
