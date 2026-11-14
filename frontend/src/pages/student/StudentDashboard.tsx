import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import {
  FileText,
  CheckSquare,
  Bell,
  Clock,
  AlertCircle,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import schoolConfig from "@/config/schoolConfig";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StudentLayout } from "@/components/layouts/StudentLayout";
import { Logo } from "@/components/Logo";
import api from "@/lib/api";
import { toast } from "sonner";

const quickActions = [
  {
    title: "Apply for Admission",
    description: "Start your application",
    icon: FileText,
    href: "/student/apply",
    color: "bg-primary/10 text-primary",
  },
  {
    title: "Check Status",
    description: "View admission status",
    icon: CheckSquare,
    href: "/student/admission-status",
    color: "bg-success/10 text-success",
  },
];

export default function StudentDashboard() {
  const [notifications, setNotifications] = useState<Array<{
    id: number;
    title: string;
    message: string;
    type: "warning" | "info" | "success";
    time: string;
  }> | null>(null);
  const [applicationProgress, setApplicationProgress] = useState<{
    current_step: number;
    steps: Array<{ name: string; completed: boolean }>;
  } | null>(null);
  const [profile, setProfile] = useState<{
    full_name?: string;
    email?: string;
    application_id?: string;
  } | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      const raw =
        localStorage.getItem("mccas_profile") ||
        localStorage.getItem("MCCAS_profile");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [notifRes, progressRes, profileRes] = await Promise.all([
          api.getNotifications(),
          api.getApplicationProgress(),
          api.getStudentProfile(),
        ]);
        setNotifications(notifRes?.data || []);
        setApplicationProgress(progressRes?.data || null);
        if (profileRes?.data) {
          setProfile(profileRes.data);
          try {
            localStorage.setItem(
              "mccas_profile",
              JSON.stringify(profileRes.data),
            );
            localStorage.setItem(
              "MCCAS_profile",
              JSON.stringify(profileRes.data),
            );
          } catch (e) {
            // ignore storage failures
          }
        }
      } catch (err: unknown) {
        const apiErr = err as { message?: string };
        toast.error(apiErr?.message || "Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const progressPercentage = applicationProgress
    ? (applicationProgress.current_step / applicationProgress.steps.length) *
      100
    : 0;

  return (
    <StudentLayout
      profile={profile}
      notificationCount={notifications?.length || 0}
    >
      <div className="space-y-6">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="hero-gradient border-0 relative overflow-hidden shadow-emerald">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Logo className="h-64 w-64 grayscale" />
            </div>
            <CardContent className="p-6 md:p-10 relative z-10 backdrop-blur-sm">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <Badge variant="gold" className="mb-4">
                    {schoolConfig.academics.currentSession} Session
                  </Badge>
                  <h2 className="mb-2 font-serif text-3xl font-bold text-primary-foreground md:text-4xl">
                    Welcome to {schoolConfig.name.acronym} Portal
                  </h2>
                  <p className="text-primary-foreground/90 max-w-xl text-lg">
                    Complete your admission application and track your progress.
                    Applications for {schoolConfig.academics.nextSession} open
                    on {schoolConfig.academics.applicationOpenDate}.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="hero"
                    size="xl"
                    className="shadow-gold shadow-lg"
                    asChild
                  >
                    <Link to="/student/apply">
                      Continue Application
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Application Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Clock className="h-5 w-5 text-secondary" />
                Application Progress
              </CardTitle>
              <CardDescription>
                Track your admission application status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {Math.round(progressPercentage)}%
                  </span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
              <div className="flex flex-wrap gap-2">
                {applicationProgress?.steps?.map((step, index) => (
                  <div
                    key={step.name}
                    className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                      step.completed
                        ? "bg-success/10 text-success"
                        : index === (applicationProgress?.current_step || 0) - 1
                          ? "bg-warning/10 text-warning"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        step.completed
                          ? "bg-success"
                          : index ===
                              (applicationProgress?.current_step || 0) - 1
                            ? "bg-warning animate-pulse"
                            : "bg-muted-foreground"
                      }`}
                    />
                    {step.name}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & Notifications Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h3 className="mb-4 font-serif text-lg font-semibold">
                Quick Actions
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {quickActions.map((action, index) => (
                  <Link key={action.title} to={action.href}>
                    <Card className="card-elevated h-full transition-all hover:border-primary/20">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color}`}
                        >
                          <action.icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium">{action.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {action.description}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold">
                Notifications
              </h3>
              <Badge variant="emerald">{notifications?.length || 0} new</Badge>
            </div>
            <Card className="card-elevated">
              <CardContent className="p-0">
                <div className="divide-y">
                  {notifications?.map((notification) => (
                    <div key={notification.id} className="flex gap-3 p-4">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          notification.type === "warning"
                            ? "bg-warning/10"
                            : notification.type === "info"
                              ? "bg-info/10"
                              : "bg-success/10"
                        }`}
                      >
                        {notification.type === "warning" ? (
                          <AlertCircle className="h-4 w-4 text-warning" />
                        ) : notification.type === "info" ? (
                          <Bell className="h-4 w-4 text-info" />
                        ) : (
                          <CheckSquare className="h-4 w-4 text-success" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {notification.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </StudentLayout>
  );
}
