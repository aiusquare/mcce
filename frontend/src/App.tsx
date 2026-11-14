import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Public Pages
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import AdmissionsPage from "./pages/AdmissionsPage";
import NewsPage from "./pages/NewsPage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";

// Student Portal
import StudentLoginPage from "./pages/student/StudentLoginPage";
import StudentMaintenancePage from "./pages/student/StudentMaintenancePage";
import StudentRegisterPage from "./pages/student/StudentRegisterPage";
import StudentDashboard from "./pages/student/StudentDashboard";
import ApplicationPage from "./pages/student/ApplicationPage";
import AdmissionStatusPage from "./pages/student/AdmissionStatusPage";
import CourseRegistrationPage from "./pages/student/CourseRegistrationPage";
import StudentPaymentsPage from "./pages/student/StudentPaymentsPage";
import StudentClearancePage from "./pages/student/StudentClearancePage";
import StudentExamCardPage from "./pages/student/StudentExamCardPage";
import StudentProfilePage from "./pages/student/StudentProfilePage";

// Admin Portal
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminChangePasswordPage from "./pages/admin/AdminChangePasswordPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import FeeManagementPage from "./pages/admin/FeeManagementPage";
import PaymentsPage from "./pages/admin/PaymentsPage";
import CourseManagementPage from "./pages/admin/CourseManagementPage";
import ApplicationReviewPage from "./pages/admin/ApplicationReviewPage";
import StudentManagementPage from "./pages/admin/StudentManagementPage";
import ExamOfficePage from "./pages/admin/ExamOfficePage";
import ResultManagementPage from "./pages/admin/ResultManagementPage";
import GraduationManagementPage from "./pages/admin/GraduationManagementPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminRolesPage from "./pages/admin/AdminRolesPage";
import AdminPermissionsPage from "./pages/admin/AdminPermissionsPage";
import AdminProgrammesPage from "./pages/admin/AdminProgrammesPage";
import AdminCourseRegistrationPage from "./pages/admin/AdminCourseRegistrationPage";
import RequireOnboardingComplete from "./components/guards/RequireOnboardingComplete";
import RequireAdmittedStudent from "./components/guards/RequireAdmittedStudent";
import RequireAdminAccess from "./components/guards/RequireAdminAccess";
import ProNewsPage from "./pages/admin/ProNewsPage";
import ProEventsPage from "./pages/admin/ProEventsPage";
import ProMessagesPage from "./pages/admin/ProMessagesPage";
import ProContactsPage from "./pages/admin/ProContactsPage";
import AdminLecturersPage from "./pages/admin/AdminLecturersPage";

// Student Portal - Additional Pages
import ExamResultsPage from "./pages/student/ExamResultsPage";

const queryClient = new QueryClient();

const adminPage = (resourceSlug: string, element: JSX.Element) => (
  <RequireAdminAccess resourceSlug={resourceSlug}>{element}</RequireAdminAccess>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public Website */}
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/admissions" element={<AdmissionsPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Student Portal */}
          <Route
            path="/student/maintenance"
            element={<StudentMaintenancePage />}
          />
          <Route path="/student/login" element={<StudentLoginPage />} />
          <Route path="/student/register" element={<StudentRegisterPage />} />
          <Route
            path="/student/dashboard"
            element={
              <RequireOnboardingComplete>
                <StudentDashboard />
              </RequireOnboardingComplete>
            }
          />
          <Route
            path="/student/apply"
            element={
              <RequireOnboardingComplete>
                <ApplicationPage />
              </RequireOnboardingComplete>
            }
          />
          <Route
            path="/student/admission-status"
            element={
              <RequireOnboardingComplete>
                <AdmissionStatusPage />
              </RequireOnboardingComplete>
            }
          />
          <Route
            path="/student/course-registration"
            element={
              <RequireOnboardingComplete>
                <RequireAdmittedStudent>
                  <CourseRegistrationPage />
                </RequireAdmittedStudent>
              </RequireOnboardingComplete>
            }
          />
          <Route
            path="/student/payments"
            element={
              <RequireOnboardingComplete>
                <RequireAdmittedStudent>
                  <StudentPaymentsPage />
                </RequireAdmittedStudent>
              </RequireOnboardingComplete>
            }
          />
          <Route
            path="/student/clearance"
            element={
              <RequireOnboardingComplete>
                <RequireAdmittedStudent>
                  <StudentClearancePage />
                </RequireAdmittedStudent>
              </RequireOnboardingComplete>
            }
          />
          <Route
            path="/student/exam-card"
            element={
              <RequireOnboardingComplete>
                <RequireAdmittedStudent>
                  <StudentExamCardPage />
                </RequireAdmittedStudent>
              </RequireOnboardingComplete>
            }
          />
          <Route
            path="/student/results"
            element={
              <RequireOnboardingComplete>
                <RequireAdmittedStudent>
                  <ExamResultsPage />
                </RequireAdmittedStudent>
              </RequireOnboardingComplete>
            }
          />
          <Route
            path="/student/profile"
            element={
              <RequireOnboardingComplete>
                <StudentProfilePage />
              </RequireOnboardingComplete>
            }
          />

          {/* Admin Portal */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin/change-password"
            element={<AdminChangePasswordPage />}
          />
          <Route
            path="/admin/settings"
            element={adminPage("account-settings", <AdminSettingsPage />)}
          />
          <Route
            path="/admin/dashboard"
            element={adminPage("dashboard", <AdminDashboard />)}
          />
          <Route
            path="/admin/fees"
            element={adminPage("fees", <FeeManagementPage />)}
          />
          <Route
            path="/admin/payments"
            element={adminPage("payments", <PaymentsPage />)}
          />
          <Route
            path="/admin/courses"
            element={adminPage("courses", <CourseManagementPage />)}
          />
          <Route
            path="/admin/course-registration"
            element={adminPage(
              "course-registration",
              <AdminCourseRegistrationPage />,
            )}
          />
          <Route
            path="/admin/programmes"
            element={adminPage("programmes", <AdminProgrammesPage />)}
          />
          <Route
            path="/admin/applications"
            element={adminPage("applications", <ApplicationReviewPage />)}
          />
          <Route
            path="/admin/students"
            element={adminPage("students", <StudentManagementPage />)}
          />
          <Route
            path="/admin/exams"
            element={adminPage("exams", <ExamOfficePage />)}
          />
          <Route
            path="/admin/results"
            element={adminPage("results", <ResultManagementPage />)}
          />
          <Route
            path="/admin/graduation"
            element={adminPage("graduation", <GraduationManagementPage />)}
          />
          <Route
            path="/admin/lecturers"
            element={adminPage("lecturers", <AdminLecturersPage />)}
          />
          <Route
            path="/admin/pro/news"
            element={adminPage("pro-news", <ProNewsPage />)}
          />
          <Route
            path="/admin/pro/events"
            element={adminPage("pro-events", <ProEventsPage />)}
          />
          <Route
            path="/admin/pro/messages"
            element={adminPage("pro-messages", <ProMessagesPage />)}
          />
          <Route
            path="/admin/pro/contacts"
            element={adminPage("pro-contacts", <ProContactsPage />)}
          />
          <Route
            path="/admin/users"
            element={adminPage("admin-users", <AdminUsersPage />)}
          />
          <Route
            path="/admin/roles"
            element={adminPage("admin-roles", <AdminRolesPage />)}
          />
          <Route
            path="/admin/permissions"
            element={adminPage("admin-permissions", <AdminPermissionsPage />)}
          />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
