"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SubAccountSwitcher from "./SubAccountSwitcher";
import Sidebar from "./Sidebar";

interface AppealRequest {
  id: string;
  type: string;
  date: string;
  status: "Pending" | "Approved" | "Rejected";
  reason: string;
}

const appealTypes = [
  {
    id: "warning-letter",
    name: "Warning Letter",
    icon: "⚠️",
    description: "Appeal against a warning letter issued",
  },
  {
    id: "pip",
    name: "PIP",
    icon: "📈",
    description: "Appeal against Personal Improvement Plan",
  },
  {
    id: "show-cause-letter",
    name: "Show Cause Letter",
    icon: "📋",
    description: "Appeal against a show cause letter",
  },
];

export default function AppealOptions() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    reason: "",
  });
  const [appeals, setAppeals] = useState<AppealRequest[]>([
    {
      id: "1",
      type: "Warning Letter",
      date: "15/03/26",
      status: "Pending",
      reason: "I believe the warning was issued in error",
    },
    {
      id: "2",
      type: "PDP",
      date: "10/03/26",
      status: "Approved",
      reason: "Request for timeline extension",
    },
  ]);

  const handleAppealSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedType || !formData.reason) {
      alert("Please select an appeal type and provide a reason");
      return;
    }

    const selectedTypeObj = appealTypes.find((t) => t.id === selectedType);

    const newAppeal: AppealRequest = {
      id: String(appeals.length + 1),
      type: selectedTypeObj?.name || "",
      date: new Date().toLocaleDateString("en-GB"),
      status: "Pending",
      reason: formData.reason,
    };

    setAppeals([newAppeal, ...appeals]);
    setFormData({ reason: "" });
    setSelectedType(null);
    alert("Appeal submitted successfully!");
  };

  return (
    <div className="flex min-h-screen bg-blue-50">
      <Sidebar sidebarOpen={sidebarOpen} onCollapse={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex-1">
        {/* Header */}
        <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 flex items-center gap-4">            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title="Toggle Sidebar"
            >
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>          <SubAccountSwitcher />
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-blue-800">File an Appeal</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Appeal Types Cards */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Appeal Categories
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {appealTypes.map((type) => (
                  <div
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedType === type.id
                        ? "border-blue-600 bg-blue-50 shadow-lg"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md"
                    }`}
                  >
                    <div className="text-4xl mb-3">{type.icon}</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                      {type.name}
                    </h3>
                    <p className="text-sm text-gray-600">{type.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Appeals History */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Appeal History</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {appeals.map((appeal) => (
                      <tr
                        key={appeal.id}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 text-sm text-gray-800">
                          {appeal.type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-800">
                          {appeal.date}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-800">
                          {appeal.reason}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              appeal.status === "Approved"
                                ? "bg-green-100 text-green-800"
                                : appeal.status === "Pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {appeal.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Appeal Form */}
          <div className="lg:col-span-1">
            <form onSubmit={handleAppealSubmit} className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Submit Appeal</h3>

              <div className="space-y-5">
                {/* Selected Type Display */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appeal Type
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-gray-800 font-medium">
                      {selectedType
                        ? appealTypes.find((t) => t.id === selectedType)?.name
                        : "Select a type above"}
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Appeal
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    placeholder="Explain your reason for filing this appeal..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={6}
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={!selectedType}
                >
                  Submit Appeal
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}