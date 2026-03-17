"use client";

import { useState } from "react";
import DashboardHome from "@/app/components/DashboardHome";
import Sidebar from "@/app/components/Sidebar";
import UserHeader from "@/app/components/UserHeader";

export default function HomePage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="flex justify-between items-center px-4 py-6">
          <div>
            <h1 className="text-3xl font-bold">Ebright HR System</h1>
            <p className="text-blue-100 mt-1">Dashboard Home</p>
          </div>
          <UserHeader userName="Admin User" userRole="SUPER_ADMIN" userEmail="admin@ebright.com" />
        </div>
      </header>

      <div className="flex h-[calc(100vh-100px)]">
        <Sidebar sidebarOpen={sidebarOpen} onCollapse={() => setSidebarOpen(false)} />

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-16 bg-white shadow-lg hover:bg-gray-50 transition-colors border-r border-gray-200 flex items-center justify-center text-blue-600 font-bold text-2xl"
          >
            ☰
          </button>
        )}

        <main className="flex-1 overflow-y-auto">
          <DashboardHome />
        </main>
      </div>
    </div>
  );
}
