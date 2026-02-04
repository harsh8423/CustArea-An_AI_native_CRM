"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { api } from "@/lib/api"
import { useFeatures } from "@/contexts/FeatureContext"
import { usePermissions } from "@/hooks/usePermissions"
import {
    Bot,
    BarChart2,
    Search,
    Settings,
    User,
    LayoutDashboard,
    ShieldCheck,
    UserCog,
    Megaphone,
    MessageSquare,
    ChevronRight,
    ChevronDown,
    Book,
    Hammer,
    PlayCircle,
    Rocket,
    GitBranch,
    Users,
    Sparkles,
    Ticket,
    List,
    Zap,
    Tag,
    AlertCircle,
    Clock,
    PauseCircle,
    CheckCircle2,
    XCircle,
    LogOut,
    Phone
} from "lucide-react"

interface SubItem {
    label: string
    href: string
    icon?: any
    isStatusFilter?: boolean  // For visual grouping
    isDivider?: boolean       // To add separator line
    subItems?: SubItem[]      // Support nested dropdowns
}

interface Route {
    label: string
    icon: any
    href: string
    badge?: number
    color?: string
    subItems?: SubItem[]
    feature?: string  // Feature key required to show this route
}

const routes: Route[] = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        color: "from-violet-500 to-purple-600",
        badge: 4
        // Core feature - always visible
    },
    {
        label: "Sales",
        icon: Users,
        href: "/sales/contacts",
        color: "from-blue-500 to-cyan-500",
        // Core feature - always visible
        subItems: [
            { label: "Contacts", href: "/sales/contacts", icon: Users },
            { label: "Leads", href: "/sales/leads", icon: Users },
            { label: "Groups", href: "/sales/contact-groups", icon: Users },
            { label: "Lead Board", href: "/sales/lead-board", icon: Users },
        ]
    },
    {
        label: "Campaign",
        icon: Megaphone,
        href: "/campaign",
        color: "from-orange-400 to-rose-500",
        feature: "campaign"  // Matches 'campaign' feature_key
    },
    {
        label: "Conversation",
        icon: MessageSquare,
        href: "/conversation",
        color: "from-emerald-500 to-teal-600",
        // Core feature - always visible
    },
    {
        label: "Phone Calls",
        icon: Phone,
        href: "/phone-calls",
        color: "from-blue-500 to-cyan-500",
        feature: "phone_calls",  // Matches 'phone_calls' feature_key
        subItems: [
            { label: "Dialer", href: "/phone-calls?tab=dialer", icon: Phone },
            { label: "Logs", href: "/phone-calls?tab=logs", icon: Phone },
            { label: "Voice Agents", href: "/voice-agents", icon: Bot },
            { label: "Phone Numbers", href: "/voice-agents?tab=numbers", icon: Phone },
        ]
    },
    {
        label: "Tickets",
        icon: Ticket,
        href: "/tickets",
        color: "from-rose-500 to-pink-600",
        feature: "ticketing",  // Matches 'ticketing' feature_key
        subItems: [
            { label: "All Tickets", href: "/tickets", icon: List },
            { label: "New", href: "/tickets?status=new", icon: AlertCircle, isStatusFilter: true },
            { label: "Open", href: "/tickets?status=open", icon: Clock, isStatusFilter: true },
            { label: "Pending", href: "/tickets?status=pending", icon: PauseCircle, isStatusFilter: true },
            { label: "On Hold", href: "/tickets?status=on_hold", icon: PauseCircle, isStatusFilter: true },
            { label: "Resolved", href: "/tickets?status=resolved", icon: CheckCircle2, isStatusFilter: true },
            { label: "Closed", href: "/tickets?status=closed", icon: XCircle, isStatusFilter: true },
            { label: "divider", href: "", isDivider: true },
            { label: "Macros", href: "/tickets/macros", icon: Zap },
            { label: "Tags", href: "/tickets/tags", icon: Tag },
        ]
    },
    {
        label: "Workflow",
        icon: GitBranch,
        href: "/workflow",
        color: "from-pink-500 to-rose-500",
        feature: "workflow"  // Matches 'workflow' feature_key
    },
    {
        label: "AI Agent",
        icon: Bot,
        href: "/ai-agent",
        color: "from-indigo-500 to-purple-600",
        // Core feature - always visible
        subItems: [
            {
                label: "Knowledge",
                href: "/ai-agent/knowledge",
                icon: Book,
                subItems: [
                    { label: "Base Knowledge", href: "/ai-agent/knowledge?tab=base", icon: Sparkles },
                    { label: "Articles", href: "/ai-agent/knowledge?tab=articles", icon: Book },
                    { label: "Documents", href: "/ai-agent/knowledge?tab=documents", icon: Book }
                ]
            },
            {
                label: "Train",
                href: "/ai-agent/train",
                icon: Hammer,
                subItems: [
                    { label: "Guidance", href: "/ai-agent/train?tab=guidance", icon: MessageSquare },
                    { label: "Guardrails", href: "/ai-agent/train?tab=guardrails", icon: Bot },
                    { label: "Escalation", href: "/ai-agent/train?tab=escalation", icon: AlertCircle }
                ]
            },
            { label: "Test", href: "/ai-agent/test", icon: PlayCircle },
            { label: "Deploy", href: "/ai-agent/deploy", icon: Rocket },
        ]
    },
    {
        label: "Report",
        icon: BarChart2,
        href: "/report",
        color: "from-amber-500 to-orange-600",
        feature: "reports"  // Matches 'reports' feature_key
    },
    {
        label: "Settings",
        icon: Settings,
        href: "/settings",
        color: "from-gray-500 to-slate-600",
    },
]

export function Sidebar() {
    const pathname = usePathname()
    const { hasFeature } = useFeatures();
    const [activeRoute, setActiveRoute] = useState<string | null>(null)
    const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set())
    const [expandedSubItems, setExpandedSubItems] = useState<Set<string>>(new Set())
    // Collapsed by default, expanded only for dashboard
    const [isCollapsed, setIsCollapsed] = useState(!pathname.startsWith('/dashboard'))

    const handleRouteClick = (route: Route) => {
        setActiveRoute(route.label)
        // Only expand for Dashboard, collapse for everything else
        if (route.label === "Dashboard") {
            setIsCollapsed(false)
        } else {
            setIsCollapsed(true)
        }
    }

    const toggleRoute = (routeLabel: string) => {
        const newExpanded = new Set(expandedRoutes)
        if (newExpanded.has(routeLabel)) {
            newExpanded.delete(routeLabel)
        } else {
            newExpanded.add(routeLabel)
        }
        setExpandedRoutes(newExpanded)
    }

    const toggleSubItem = (subItemLabel: string) => {
        const newExpanded = new Set(expandedSubItems)
        if (newExpanded.has(subItemLabel)) {
            newExpanded.delete(subItemLabel)
        } else {
            newExpanded.add(subItemLabel)
        }
        setExpandedSubItems(newExpanded)
    }

    const activeItem = routes.find(r => r.label === activeRoute)

    // Filter routes by enabled features
    const visibleRoutes = routes.filter(route =>
        !route.feature || hasFeature(route.feature)
    );

    return (
        <div className="flex h-full">
            {/* Main Sidebar */}
            <div className={cn(
                "flex flex-col h-full bg-[#eff0eb] text-[#333] transition-all duration-300 ease-out",
                isCollapsed ? "w-[72px] items-center" : "w-64"
            )}>
                {/* Logo */}
                <div className="p-4 mb-2 shrink-0">
                    <div
                        className="h-10 w-10 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center cursor-pointer shadow-lg shadow-gray-900/20 hover:shadow-xl hover:shadow-gray-900/30 transition-all duration-300 hover:scale-105"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                    >
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex-1 px-3 space-y-1.5 w-full overflow-y-auto">
                    {visibleRoutes.map((route) => {
                        const isActive = activeRoute === route.label || pathname.startsWith(route.href)

                        return (
                            <Link
                                key={route.href}
                                href={route.href}
                                onClick={() => handleRouteClick(route)}
                                className={cn(
                                    "flex items-center px-3 py-2.5 rounded-xl group transition-all duration-200 cursor-pointer relative",
                                    isActive
                                        ? "bg-white shadow-sm"
                                        : "hover:bg-white/60",
                                    isCollapsed ? "justify-center px-2.5" : "justify-between"
                                )}
                            >
                                <div className="flex items-center">
                                    <div className={cn(
                                        "flex items-center justify-center rounded-lg transition-all duration-200",
                                        isActive
                                            ? `bg-gradient-to-br ${route.color} p-1.5`
                                            : "p-1.5",
                                        isCollapsed ? "mr-0" : "mr-3"
                                    )}>
                                        <route.icon className={cn(
                                            "h-4 w-4 transition-colors",
                                            isActive ? "text-white" : "text-gray-500 group-hover:text-gray-700"
                                        )} />
                                    </div>
                                    {!isCollapsed && (
                                        <span className={cn(
                                            "font-medium text-sm transition-colors",
                                            isActive ? "text-gray-900" : "text-gray-600 group-hover:text-gray-800"
                                        )}>
                                            {route.label}
                                        </span>
                                    )}
                                </div>
                                {!isCollapsed && route.badge && (
                                    <span className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                                        isActive
                                            ? "bg-rose-100 text-rose-600"
                                            : "bg-gray-100 text-gray-500"
                                    )}>
                                        {route.badge}
                                    </span>
                                )}
                                {isCollapsed && route.badge && (
                                    <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-rose-500 rounded-full ring-2 ring-[#eff0eb]" />
                                )}
                            </Link>
                        )
                    })}
                </div>

                {/* Bottom Actions */}
                <div className="p-3 mt-auto space-y-1.5 w-full">
                    <button className={cn(
                        "flex items-center px-3 py-2.5 text-gray-600 hover:bg-white/60 rounded-xl transition-all duration-200 w-full group",
                        isCollapsed ? "justify-center" : ""
                    )}>
                        <Search className={cn(
                            "h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-colors",
                            isCollapsed ? "mr-0" : "mr-3"
                        )} />
                        {!isCollapsed && (
                            <div className="flex-1 text-left flex justify-between items-center">
                                <span className="text-sm font-medium group-hover:text-gray-800">Search</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white text-gray-400 font-medium shadow-sm">⌘K</span>
                            </div>
                        )}
                    </button>
                    <button className={cn(
                        "flex items-center px-3 py-2.5 text-gray-600 hover:bg-white/60 rounded-xl transition-all duration-200 w-full group",
                        isCollapsed ? "justify-center" : ""
                    )}>
                        <div className={cn(
                            "h-7 w-7 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold shadow-sm",
                            isCollapsed ? "mr-0" : "mr-3"
                        )}>
                            JD
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 text-left">
                                <p className="text-sm font-medium text-gray-800">John Doe</p>
                                <p className="text-[10px] text-gray-400">Admin</p>
                            </div>
                        )}
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                await api.auth.signout();
                                window.location.href = '/';
                            } catch (err) {
                                console.error('Logout failed:', err);
                            }
                        }}
                        className={cn(
                            "flex items-center px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 w-full group",
                            isCollapsed ? "justify-center" : ""
                        )}
                        title="Logout"
                    >
                        <LogOut className={cn(
                            "h-4 w-4 transition-colors",
                            isCollapsed ? "mr-0" : "mr-3"
                        )} />
                        {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
                    </button>
                </div>
            </div>

            {/* Sub-Sidebar Panel - Only show if activeItem has subItems */}
            {isCollapsed && activeItem && activeItem.label !== "Dashboard" && activeItem.subItems && activeItem.subItems.length > 0 && (
                <div className="w-64 bg-[#eff0eb] h-full flex flex-col py-4 pr-3 animate-in slide-in-from-left-2 duration-200">
                    <div className="bg-white h-full rounded-2xl shadow-sm flex flex-col overflow-hidden">
                        <div className="p-5">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm",
                                    activeItem.color
                                )}>
                                    <activeItem.icon className="h-4 w-4 text-white" />
                                </div>
                                <h2 className="font-semibold text-gray-900">{activeItem.label}</h2>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-3 pb-3">
                            {activeItem.subItems ? (
                                <div className="space-y-1">
                                    {activeItem.subItems.map((sub, index) => {
                                        // Handle divider
                                        if (sub.isDivider) {
                                            return <div key={index} className="border-t border-gray-100 my-2" />;
                                        }

                                        const isActive = pathname === sub.href ||
                                            (sub.href.includes('?') && pathname + window?.location?.search === sub.href);

                                        const hasNestedItems = sub.subItems && sub.subItems.length > 0;
                                        const isExpanded = expandedSubItems.has(sub.label);

                                        return (
                                            <div key={sub.href}>
                                                {/* Main Sub-Item */}
                                                {hasNestedItems ? (
                                                    <div
                                                        onClick={() => toggleSubItem(sub.label)}
                                                        className={cn(
                                                            "flex items-center justify-between py-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer",
                                                            sub.isStatusFilter ? "pl-10 pr-3" : "px-3",
                                                            isActive
                                                                ? "bg-rose-50 text-rose-600"
                                                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {sub.icon && <sub.icon className={cn(
                                                                "h-4 w-4",
                                                                isActive ? "text-rose-500" : "text-gray-400"
                                                            )} />}
                                                            <span>{sub.label}</span>
                                                        </div>
                                                        <ChevronDown className={cn(
                                                            "h-3.5 w-3.5 transition-transform duration-200",
                                                            isActive ? "text-rose-400" : "text-gray-300",
                                                            isExpanded && "rotate-180"
                                                        )} />
                                                    </div>
                                                ) : (
                                                    <Link
                                                        href={sub.href}
                                                        className={cn(
                                                            "flex items-center justify-between py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                                                            sub.isStatusFilter ? "pl-10 pr-3" : "px-3",
                                                            isActive
                                                                ? "bg-rose-50 text-rose-600"
                                                                : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {sub.icon && <sub.icon className={cn(
                                                                "h-4 w-4",
                                                                isActive ? "text-rose-500" : "text-gray-400"
                                                            )} />}
                                                            <span>{sub.label}</span>
                                                        </div>
                                                        <ChevronRight className={cn(
                                                            "h-3.5 w-3.5",
                                                            isActive ? "text-rose-400" : "text-gray-300"
                                                        )} />
                                                    </Link>
                                                )}

                                                {/* Nested Sub-Items (Level 2) */}
                                                {hasNestedItems && isExpanded && (
                                                    <div className="mt-1 ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                                        {sub.subItems!.map((nestedItem) => {
                                                            const isNestedActive = pathname.includes(nestedItem.href.split('?')[0]);
                                                            return (
                                                                <Link
                                                                    key={nestedItem.href}
                                                                    href={nestedItem.href}
                                                                    className={cn(
                                                                        "flex items-center gap-2 py-2 px-3 text-sm rounded-lg transition-all",
                                                                        isNestedActive
                                                                            ? "bg-rose-50 text-rose-600 font-medium"
                                                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                                                                    )}
                                                                >
                                                                    {nestedItem.icon && <nestedItem.icon className="h-3.5 w-3.5" />}
                                                                    <span>{nestedItem.label}</span>
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-4 text-center text-gray-400 text-sm">
                                    No sub-items
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
