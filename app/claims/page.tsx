"use client"; // This MUST be the first line

import { useState, useRef } from "react";
import Sidebar from "@/app/components/Sidebar";
import UserHeader from "@/app/components/UserHeader";
import Link from "next/link";

// 1. Updated Sub-component with File Explorer & Submission logic
interface ClaimFormProps {
  claim: { id: string; title: string; icon: string; color: string };
  onBack: () => void;
}

const ClaimForm = ({ claim, onBack }: ClaimFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false); // Track success state

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Logic for API calls would go here
    console.log("Submitting:", claim.title);
    setIsSubmitted(true); // Show success screen
  };

  // SUCCESS SCREEN VIEW
  if (isSubmitted) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center animate-in zoom-in duration-300">
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-5xl">
          ✓
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Claim Submitted!</h2>
        <p className="text-gray-500 mb-8 max-w-sm mx-auto">
          Your <strong>{claim.title}</strong> has been successfully sent to the HR and Finance teams for review.
        </p>
        <button 
          onClick={onBack}
          className={`${claim.color} text-white px-10 py-3 rounded-xl font-bold shadow-lg hover:brightness-110 transition-all`}
        >
          Return to Claims
        </button>
      </div>
    );
  }

  // FORM VIEW
  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Form Header */}
      <div className={`${claim.color} p-6 text-white flex justify-between items-center`}>
        <div className="flex items-center gap-4">
          <span className="text-4xl bg-white/20 p-2 rounded-lg">{claim.icon}</span>
          <div>
            <h2 className="text-2xl font-bold">{claim.title} Application</h2>
            <p className="text-white/80 text-sm">Please provide the details for your request</p>
          </div>
        </div>
        <button 
          onClick={onBack}
          className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors font-semibold"
        >
          ✕ Cancel
        </button>
      </div>

      {/* Form Body */}
      <form className="p-8 space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Claim Date</label>
            <input required type="date" className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Amount ($)</label>
            <input required type="number" step="0.01" className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Reason / Description</label>
          <textarea 
            required
            rows={4} 
            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={`Explain the reason for this ${claim.title}...`}
          ></textarea>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Attachment (Receipt/MC)</label>
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf"
          />
          <div 
            onClick={handleUploadClick}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center
              ${selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-500'}`}
          >
            {selectedFile ? (
              <>
                <p className="text-green-600 font-bold">📄 File Selected</p>
                <p className="text-sm text-gray-600 italic">{selectedFile.name}</p>
                <button 
                  type="button" 
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  className="mt-2 text-xs text-red-500 hover:underline"
                >
                  Remove & Replace
                </button>
              </>
            ) : (
              <p>Click to upload or drag and drop files here</p>
            )}
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            type="button" 
            onClick={onBack}
            className="flex-1 py-3 px-6 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Go Back
          </button>
          <button 
            type="submit" 
            className={`flex-1 py-3 px-6 ${claim.color} text-white rounded-xl font-bold shadow-lg hover:brightness-110 transition-all`}
          >
            Submit Claim
          </button>
        </div>
      </form>
    </div>
  );
};

// 2. Main Page Component
const CLAIM_TYPES = [
  { id: "sales", title: "Sales Claim", icon: "📈", color: "bg-blue-600" },
  { id: "health", title: "Health Claim", icon: "🏥", color: "bg-green-600" },
  { id: "transport", title: "Transport Claim", icon: "🚗", color: "bg-yellow-500" },
  { id: "mc", title: "MC Claim", icon: "🤒", color: "bg-purple-600" },
];

export default function ClaimsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<typeof CLAIM_TYPES[0] | null>(null);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg shrink-0">
        <div className="flex justify-between items-center px-4 py-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Claims Management</h1>
            <p className="text-blue-100 mt-1 opacity-90">Submit and track your claims</p>
          </div>
          <UserHeader userName="Admin User" userRole="SUPER_ADMIN" userEmail="admin@ebright.com" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} onCollapse={() => setSidebarOpen(false)} />

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-12 bg-white shadow-lg hover:bg-gray-50 transition-colors border-r border-gray-200 flex items-center justify-center text-blue-600 font-bold text-2xl"
          >
            ☰
          </button>
        )}

        <main className="flex-1 overflow-y-auto px-8 py-8 bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] text-[#1a1d23]">
          <div className="mx-auto w-full max-w-5xl">
            {selectedClaim ? (
              <ClaimForm 
                claim={selectedClaim} 
                onBack={() => setSelectedClaim(null)} 
              />
            ) : (
              <>
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-3xl font-extrabold text-[#1e293b]">Select a Claim Type</h2>
                    <p className="text-slate-500">Choose the category of the claim you wish to file</p>
                  </div>
                  <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-white shadow-sm border border-gray-200 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                    ← Back to Dashboard
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {CLAIM_TYPES.map((claim) => (
                    <div 
                      key={claim.id} 
                      onClick={() => setSelectedClaim(claim)}
                      className="cursor-pointer group"
                    >
                      <div className="rounded-2xl border border-white/40 bg-white/70 shadow-xl backdrop-blur-md transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 overflow-hidden h-full flex flex-col">
                        <div className={`${claim.color} h-2 w-full`}></div>
                        <div className="p-8 flex items-center gap-6">
                          <div className={`${claim.color} bg-opacity-10 w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                            <span className="group-hover:drop-shadow-md">{claim.icon}</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-800 mb-1">{claim.title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">
                              File a new {claim.title.toLowerCase()} for processing.
                            </p>
                          </div>
                        </div>
                        <div className="mt-auto px-8 py-4 bg-slate-50/50 border-t border-gray-100 flex justify-between items-center group-hover:bg-white transition-colors">
                          <span className="text-sm font-bold text-slate-600 group-hover:text-blue-600 uppercase tracking-wider">Start Application</span>
                          <span className="text-slate-400 group-hover:text-blue-600 transition-all transform group-hover:translate-x-2">→</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}