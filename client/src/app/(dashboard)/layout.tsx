import { Sidebar } from "@/components/Sidebar";
import { FeatureProvider } from "@/contexts/FeatureContext";
import { AuthGuard } from "@/components/phone/AuthGuard";
import { FilteredViewBanner } from "@/components/shared/FilteredViewBanner";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <FeatureProvider>
                <div className="flex h-screen bg-[#eff0eb] dark:bg-black">
                    <Sidebar />
                    <main className="flex-1 overflow-hidden flex flex-col">
                        <FilteredViewBanner />
                        <div className="flex-1 overflow-y-auto h-full">
                            {children}
                        </div>
                    </main>
                </div>
            </FeatureProvider>
        </AuthGuard>
    );
}

