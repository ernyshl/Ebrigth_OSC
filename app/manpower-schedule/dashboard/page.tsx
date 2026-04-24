"use client";

import { Suspense } from "react";
import ManpowerDashboard from "@/app/components/ManpowerDashboard";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading…</div>}>
      <ManpowerDashboard />
    </Suspense>
  );
}
