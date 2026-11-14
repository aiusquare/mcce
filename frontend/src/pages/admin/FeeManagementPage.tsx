import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertCircle,
  Download,
  Globe,
  Target,
  User,
  Settings,
  Save,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GeneralInvoiceTab } from "@/components/admin/invoices/GeneralInvoiceTab";
import { SpecificInvoiceTab } from "@/components/admin/invoices/SpecificInvoiceTab";
import { IndividualInvoiceTab } from "@/components/admin/invoices/IndividualInvoiceTab";
import { API_BASE } from "@/lib/api";
import {
  getAcademicSessions,
  getFeeInvoices,
  getFeeSummary,
  getSessionFeeSettings,
  saveSessionFeeSetting,
} from "@/lib/fees";
import type {
  AcademicSessionOption,
  SessionFeeSettings,
} from "@/lib/fees";

export default function FeeManagementPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    studentsPaid: 0,
    collectionRate: 0,
  });

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setSummary(await getFeeSummary());
      } catch (error) {
        try {
          const invoices = await getFeeInvoices();
          const totalRevenue = invoices
            .filter((invoice) => invoice.status === "paid")
            .reduce((total, invoice) => total + invoice.amount, 0);
          const pendingPayments = invoices
            .filter((invoice) => invoice.status !== "paid")
            .reduce((total, invoice) => total + invoice.amount, 0);
          const paidCount = invoices.filter(
            (invoice) => invoice.status === "paid",
          ).length;

          setSummary({
            totalRevenue,
            pendingPayments,
            studentsPaid: paidCount,
            collectionRate: invoices.length
              ? Math.round((paidCount / invoices.length) * 1000) / 10
              : 0,
          });
        } catch {
          setSummary({
            totalRevenue: 0,
            pendingPayments: 0,
            studentsPaid: 0,
            collectionRate: 0,
          });
        }
      }
    };

    void loadSummary();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      notation: amount >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: 1,
    }).format(amount);

  const stats = [
    {
      title: "Total Revenue",
      value: formatCurrency(summary.totalRevenue),
      change: "Live data",
      trend: "up",
      icon: DollarSign,
    },
    {
      title: "Pending Payments",
      value: formatCurrency(summary.pendingPayments),
      change: "Live data",
      trend: summary.pendingPayments > 0 ? "down" : "up",
      icon: AlertCircle,
    },
    {
      title: "Students Paid",
      value: summary.studentsPaid.toLocaleString(),
      change: "Live data",
      trend: "up",
      icon: Users,
    },
    {
      title: "Collection Rate",
      value: `${summary.collectionRate}%`,
      change: "Live data",
      trend: "up",
      icon: TrendingUp,
    },
  ];

  const handleExport = () => {
    window.open(`${API_BASE}/api/admin/fees/export`, "_blank", "noopener");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold md:text-3xl">
              Fee Management
            </h1>
            <p className="text-muted-foreground">
              Create and manage invoices for students
            </p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
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
                      <p
                        className={`text-sm ${
                          stat.trend === "up"
                            ? "text-emerald-600"
                            : "text-destructive"
                        }`}
                      >
                        {stat.change}
                      </p>
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

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-4 lg:w-[660px]">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="specific" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Specific</span>
            </TabsTrigger>
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Individual</span>
            </TabsTrigger>
            <TabsTrigger value="setup" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Setup</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralInvoiceTab />
          </TabsContent>

          <TabsContent value="specific">
            <SpecificInvoiceTab />
          </TabsContent>

          <TabsContent value="individual">
            <IndividualInvoiceTab />
          </TabsContent>

          <TabsContent value="setup">
            <SessionFeeSetup />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function SessionFeeSetup() {
  const [sessions, setSessions] = useState<AcademicSessionOption[]>([]);
  const [settings, setSettings] = useState<SessionFeeSettings[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [applicationFee, setApplicationFee] = useState("5000");
  const [acceptanceFee, setAcceptanceFee] = useState("25000");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSetup = async () => {
      try {
        setIsLoading(true);
        const [sessionList, settingList] = await Promise.all([
          getAcademicSessions(),
          getSessionFeeSettings(),
        ]);
        setSessions(sessionList);
        setSettings(settingList);

        const initialSession =
          settingList.find((setting) => setting.isActive)?.sessionId ||
          sessionList.find((session) => session.isActive)?.id ||
          settingList[0]?.sessionId ||
          sessionList[0]?.id ||
          "";
        applySelectedSession(initialSession, sessionList, settingList);
      } catch (error) {
        toast.error("Failed to load fee setup");
      } finally {
        setIsLoading(false);
      }
    };

    void loadSetup();
  }, []);

  const applySelectedSession = (
    sessionId: string,
    sessionList = sessions,
    settingList = settings,
  ) => {
    const session = sessionList.find((item) => item.id === sessionId);
    const saved = settingList.find((item) => item.sessionId === sessionId);

    setSelectedSessionId(sessionId);
    setApplicationFee(String(saved?.applicationFee ?? 5000));
    setAcceptanceFee(String(saved?.acceptanceFee ?? 25000));
    setIsActive(saved?.isActive ?? session?.isActive ?? false);
  };

  const selectedSession = sessions.find(
    (session) => session.id === selectedSessionId,
  );

  const handleSave = async () => {
    if (!selectedSessionId) {
      toast.error("Select an academic session");
      return;
    }

    const nextApplicationFee = Number(applicationFee);
    const nextAcceptanceFee = Number(acceptanceFee);
    if (
      !Number.isFinite(nextApplicationFee) ||
      nextApplicationFee < 0 ||
      !Number.isFinite(nextAcceptanceFee) ||
      nextAcceptanceFee < 0
    ) {
      toast.error("Enter valid fee amounts");
      return;
    }

    try {
      setIsSaving(true);
      const saved = await saveSessionFeeSetting({
        sessionId: selectedSessionId,
        sessionName: selectedSession?.name || selectedSessionId,
        applicationFee: nextApplicationFee,
        acceptanceFee: nextAcceptanceFee,
        isActive,
      });
      setSettings((current) => {
        const remaining = current.filter(
          (item) => item.sessionId !== saved.sessionId,
        );
        const next = saved.isActive
          ? [...remaining.map((item) => ({ ...item, isActive: false })), saved]
          : [...remaining, saved];
        return next.sort((a, b) => a.sessionName.localeCompare(b.sessionName));
      });
      toast.success("Session fees saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save session fees",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
      <Card>
        <CardHeader>
          <CardTitle>Session Fee Setup</CardTitle>
          <CardDescription>
            Set application and acceptance fees for each academic session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fee-session">Academic Session</Label>
              <Select
                value={selectedSessionId}
                onValueChange={(value) => applySelectedSession(value)}
                disabled={isLoading}
              >
                <SelectTrigger id="fee-session">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end rounded-md border bg-muted/30 p-3">
              <div className="flex w-full items-center justify-between gap-4">
                <div>
                  <Label htmlFor="active-session">Active Session</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use these fees for current applicants.
                  </p>
                </div>
                <Switch
                  id="active-session"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="application-fee">Application Fee</Label>
              <Input
                id="application-fee"
                type="number"
                min="0"
                step="100"
                value={applicationFee}
                onChange={(event) => setApplicationFee(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acceptance-fee">Acceptance Fee</Label>
              <Input
                id="acceptance-fee"
                type="number"
                min="0"
                step="100"
                value={acceptanceFee}
                onChange={(event) => setAcceptanceFee(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedSessionId
                ? `Saving fees for ${selectedSession?.name || selectedSessionId}`
                : "Select a session to continue"}
            </div>
            <Button onClick={handleSave} disabled={isSaving || isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Fees"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured Sessions</CardTitle>
          <CardDescription>Current application and acceptance fees.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.length ? (
            settings.map((setting) => (
              <button
                key={setting.sessionId}
                type="button"
                onClick={() => applySelectedSession(setting.sessionId)}
                className="w-full rounded-md border p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{setting.sessionName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Application: {formatCurrency(setting.applicationFee)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Acceptance: {formatCurrency(setting.acceptanceFee)}
                    </p>
                  </div>
                  {setting.isActive && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No session fee settings saved yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
