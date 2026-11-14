import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, BarChart3 } from "lucide-react";
import { EntranceExamTab } from "@/components/admin/exams/EntranceExamTab";
import { ResultsManagementTab } from "@/components/admin/exams/ResultsManagementTab";

export default function ExamOfficePage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="font-serif text-2xl font-bold md:text-3xl">
            Exam Office
          </h1>
          <p className="text-muted-foreground">
            Manage entrance exams and publish results
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="entrance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="entrance" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Entrance/Post-UTME</span>
              <span className="sm:hidden">Entrance</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Results Management</span>
              <span className="sm:hidden">Results</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="entrance">
            <EntranceExamTab />
          </TabsContent>

          <TabsContent value="results">
            <ResultsManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
