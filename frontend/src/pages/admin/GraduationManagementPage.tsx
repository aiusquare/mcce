import { AdminLayout } from "@/components/layouts/AdminLayout";
import { GraduationTab } from "@/components/admin/graduation/GraduationTab";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function GraduationManagementPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <ErrorBoundary fallbackTitle="Error in Graduation Management">
          <GraduationTab />
        </ErrorBoundary>
      </div>
    </AdminLayout>
  );
}

