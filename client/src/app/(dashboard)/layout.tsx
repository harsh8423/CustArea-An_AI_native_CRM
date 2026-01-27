import { Sidebar } from "@/components/Sidebar";
import { FeatureProvider } from "@/contexts/FeatureContext";
import { AuthGuard } from "@/components/AuthGuard";

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
                    <main className="flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </FeatureProvider>
        </AuthGuard>
    );
}
