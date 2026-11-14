import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  BarChart3,
  FileSpreadsheet,
  BookOpen,
  Settings,
  GraduationCap,
} from "lucide-react";
import { ResultsTab } from "@/components/admin/results/ResultsTab";
import { BroadsheetTab } from "@/components/admin/results/BroadsheetTab";
import { StudentStatementsTab } from "@/components/admin/results/StudentStatementsTab";
import { GpaCgpaTab } from "@/components/admin/results/GpaCgpaTab";
import { ResultConfigurationTab } from "@/components/admin/results/ResultConfigurationTab";
import { GraduationTab } from "@/components/admin/graduation/GraduationTab";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useSearchParams } from "react-router-dom";

export default function ResultManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "results";

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="font-serif text-2xl font-bold md:text-3xl">
            Result Management
          </h1>
          <p className="text-muted-foreground">
            Manage semester results, academic performance, graduation clearance and publication
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 lg:w-auto lg:inline-grid overflow-auto">
            <TabsTrigger value="results" className="gap-2">
              <FileText className="h-4 w-4" />
              <span>Results</span>
            </TabsTrigger>
            <TabsTrigger value="broadsheet" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span>Broadsheet</span>
            </TabsTrigger>
            <TabsTrigger value="graduation" className="gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Graduation</span>
            </TabsTrigger>
            <TabsTrigger value="statements" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Student Statements</span>
              <span className="sm:hidden">Statements</span>
            </TabsTrigger>
            <TabsTrigger value="gpa" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>GPA / CGPA</span>
            </TabsTrigger>
            <TabsTrigger value="configuration" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configuration</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="results">
            <ErrorBoundary fallbackTitle="Error in Results Management">
              <ResultsTab />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="broadsheet">
            <ErrorBoundary fallbackTitle="Error in Broadsheet">
              <BroadsheetTab />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="graduation">
            <ErrorBoundary fallbackTitle="Error in Graduation Management">
              <GraduationTab />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="statements">
            <ErrorBoundary fallbackTitle="Error in Student Statements">
              <StudentStatementsTab />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="gpa">
            <ErrorBoundary fallbackTitle="Error in GPA / CGPA Calculation">
              <GpaCgpaTab />
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="configuration">
            <ErrorBoundary fallbackTitle="Error in Result Configuration">
              <ResultConfigurationTab />
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
