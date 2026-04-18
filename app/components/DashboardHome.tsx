"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  BarChart3,
  Users,
  Mail,
  MessageSquare,
  Package,
  GraduationCap,
  Lock,
  ArrowRight,
  LucideIcon,
} from "lucide-react";

interface DashboardCard {
  id: string;
  title: string;
  Icon: LucideIcon;
  items: { name: string; href: string }[];
}

const dashboards: DashboardCard[] = [
  {
    id: "library",
    title: "Library",
    Icon: BookOpen,
    items: [
      { name: "Documents", href: "#" },
      { name: "Resources", href: "#" },
    ],
  },
  {
    id: "internal-dashboard",
    title: "Internal Dashboard",
    Icon: BarChart3,
    items: [
      { name: "Analytics", href: "#" },
      { name: "Reports", href: "#" },
    ],
  },
  {
    id: "hrms",
    title: "HRMS",
    Icon: Users,
    items: [
      { name: "Employee Dashboard", href: "/dashboard-employee-management" },
      { name: "Manpower Planning", href: "/manpower-schedule" },
      { name: "Attendance", href: "/attendance" },
      { name: "Claims", href: "/claims" },
      { name: "Manpower Cost Report", href: "/manpower-cost-report" },
    ],
  },
  {
    id: "crm",
    title: "CRM",
    Icon: Mail,
    items: [
      { name: "Content Manager", href: "#" },
      { name: "Media", href: "#" },
    ],
  },
  {
    id: "sms",
    title: "SMS",
    Icon: MessageSquare,
    items: [
      { name: "Messages", href: "#" },
      { name: "Templates", href: "#" },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    Icon: Package,
    items: [
      { name: "Stock Management", href: "#" },
      { name: "Warehouse", href: "#" },
    ],
  },
  {
    id: "academy",
    title: "Academy",
    Icon: GraduationCap,
    items: [
      { name: "Event Management", href: "/academy" },
      { name: "Courses", href: "#" },
    ],
  },
];

function getDisplayName(email?: string): string {
  if (!email) return "there";
  const local = email.split("@")[0];
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default function DashboardHome({ userRole, userEmail }: { userRole?: string; userEmail?: string }) {
  const isBranchManager =
    userRole === "BRANCH_MANAGER" || (userEmail?.toLowerCase().includes("ebright") ?? false);
  const accessibleCount = isBranchManager ? 1 : dashboards.length;
  const totalCount = dashboards.length;
  const displayName = getDisplayName(userEmail);
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("Good morning");
    else if (h < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  return (
    <div className="min-h-full bg-[#fafafa]">
      <section className="px-6 pt-12 pb-6 text-center">
        <div className="text-[10px] tracking-[2px] text-brand-red font-bold uppercase mb-2">
          Welcome Back
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1.5">
          {greeting}, {displayName}
        </h1>
        <p className="text-sm text-gray-500">
          {accessibleCount} of {totalCount} modules available
          {accessibleCount < totalCount && (
            <>
              {" · "}
              <span className="text-brand-red font-semibold inline-flex items-center gap-0.5">
                Request access
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
            </>
          )}
        </p>
      </section>

      <main className="max-w-[880px] mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {dashboards.map((dashboard) => {
            const isLocked = isBranchManager && dashboard.id !== "hrms";
            const targetHref =
              dashboard.id === "academy"
                ? "/academy"
                : dashboard.id === "sms"
                ? "/sms"
                : `/dashboards/${dashboard.id}`;

            if (isLocked) {
              return (
                <div
                  key={dashboard.id}
                  className="relative bg-white border border-gray-200 rounded-[10px] p-[18px] opacity-[0.65] hover:opacity-90 hover:shadow-sm cursor-default transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mb-3.5">
                    <dashboard.Icon className="w-[18px] h-[18px] text-gray-400" strokeWidth={2} />
                  </div>
                  <div className="font-bold text-gray-900 text-sm tracking-tight">
                    {dashboard.title}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {dashboard.items.length} tool{dashboard.items.length !== 1 ? "s" : ""}
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-[3px] bg-gray-100 px-[7px] py-[3px] rounded-full">
                    <Lock className="w-[9px] h-[9px] text-gray-400" strokeWidth={2.5} />
                    <span className="text-[9px] font-semibold uppercase tracking-[0.5px] text-gray-400">
                      Locked
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={dashboard.id}
                href={targetHref}
                className="group relative bg-white border border-gray-200 border-l-[3px] border-l-brand-red rounded-[10px] p-[18px] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-red hover:shadow-[0_10px_24px_rgba(237,28,36,0.12)]"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-red-soft flex items-center justify-center mb-3.5">
                  <dashboard.Icon className="w-[18px] h-[18px] text-brand-red" strokeWidth={2} />
                </div>
                <div className="font-bold text-gray-900 text-sm tracking-tight">
                  {dashboard.title}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {dashboard.items.length} tool{dashboard.items.length !== 1 ? "s" : ""}
                </div>
                <ArrowRight
                  className="absolute top-3.5 right-3.5 w-3.5 h-3.5 text-brand-red transition-transform duration-200 group-hover:translate-x-1"
                  strokeWidth={2.5}
                />
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
