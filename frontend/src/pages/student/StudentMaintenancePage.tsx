import { useEffect, useState } from "react";
import { MaslahaEmblem } from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import schoolConfig from "@/config/schoolConfig";

export default function StudentMaintenancePage() {
    const [maintenanceData, setMaintenanceData] = useState<{
        title?: string;
        message?: string;
        expected_end?: string;
    }>({});

    useEffect(() => {
        const data = sessionStorage.getItem("maintenance_data");
        if (data) {
            try {
                setMaintenanceData(JSON.parse(data));
            } catch (e) {
                // ignore
            }
        }
    }, []);

    return (
        <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary">
                <CardContent className="pt-10 pb-8 px-8 text-center space-y-6">
                    <div className="flex justify-center mb-6">
                        <MaslahaEmblem className="h-16 w-16" />
                    </div>
                    
                    <div className="space-y-2">
                        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                            {schoolConfig.name.acronym}
                        </h1>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                            {schoolConfig.name.full}
                        </p>
                    </div>

                    <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-2">
                        <Wrench className="h-8 w-8 text-primary" />
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-foreground">
                            {maintenanceData.title || "System Maintenance"}
                        </h2>
                        
                        <p className="text-muted-foreground leading-relaxed">
                            {maintenanceData.message || "The student portal is temporarily unavailable while we perform a system update. Please check back soon."}
                        </p>

                        {maintenanceData.expected_end && (
                            <div className="pt-4 border-t border-border/50">
                                <p className="text-sm font-medium text-foreground">
                                    Expected Restoration: <span className="text-primary">{maintenanceData.expected_end}</span>
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
