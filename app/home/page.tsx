"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardHome from "@/app/components/DashboardHome";
import Sidebar from "@/app/components/Sidebar";
import UserHeader from "@/app/components/UserHeader";

export default function HomePage() {
  // Grab the live session data!
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/login'); // Kick them to login if they aren't authenticated
    },
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Show a simple loading state while checking who they are
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] text-gray-500 text-sm">
        Loading Dashboard…
      </div>
    );
  }

  const userEmail = session?.user?.email || "";
  const userRole = (session?.user as any)?.role || "USER";
  const branchName = (session?.user as any)?.branchName || "Admin User";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <header className="bg-white border-b border-gray-200">
        <div className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setSidebarOpen(p => !p)}
              aria-label="Toggle sidebar"
              className="w-7 h-7 flex flex-col justify-center gap-[4px] cursor-pointer"
            >
              <span className="h-[2px] bg-gray-900 rounded-sm"></span>
              <span className="h-[2px] bg-gray-900 rounded-sm"></span>
              <span className="h-[2px] bg-gray-900 rounded-sm"></span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-[26px] h-[26px] bg-brand-red rounded-md flex items-center justify-center text-white font-extrabold text-[13px]">
                E
              </div>
              <div>
                <div className="font-bold text-gray-900 text-[15px] tracking-tight leading-none">
                  Ebright Portal
                </div>
                <div className="text-gray-500 text-[11px] mt-0.5 leading-none">
                  Dashboard
                </div>
              </div>
            </div>
          </div>

          <UserHeader
            userName={branchName}
            userEmail={userEmail}
          />
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-62px)]">
        <Sidebar sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen(p => !p)} />

        <main className="flex-1 overflow-y-auto">
          <DashboardHome userRole={userRole} userEmail={userEmail} />
        </main>
      </div>
    </div>
  );
}
