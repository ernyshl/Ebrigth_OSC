"use client";

import { ROLE_CODE_OPTIONS } from "@/lib/constants";

interface EmployeeIdInputProps {
  prefix: string;
  suffix: string;
  onPrefixChange: (value: string) => void;
  onSuffixChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  warning?: string;
  label?: string;
}

export default function EmployeeIdInput({
  prefix,
  suffix,
  onPrefixChange,
  onSuffixChange,
  required = true,
  disabled = false,
  error,
  warning,
  label = "Employee ID",
}: EmployeeIdInputProps) {
  const handleSuffixChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
    onSuffixChange(digitsOnly);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={prefix}
          onChange={(e) => onPrefixChange(e.target.value)}
          disabled={disabled}
          className={`px-3 py-2 border rounded-lg text-gray-900 bg-white text-sm w-44 focus:ring-2 focus:ring-blue-500 ${
            error && !prefix ? "border-red-500" : "border-gray-300"
          }`}
        >
          <option value="">— Select role —</option>
          {ROLE_CODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={suffix}
          onChange={handleSuffixChange}
          disabled={disabled}
          placeholder="6 digits"
          className={`flex-1 px-3 py-2 border rounded-lg text-gray-900 text-sm tracking-widest font-mono focus:ring-2 focus:ring-blue-500 ${
            error && suffix.length !== 6 ? "border-red-500" : "border-gray-300"
          }`}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        8 digits total — first 2 from dropdown, last 6 entered manually.
      </p>
      {warning && <p className="text-amber-600 text-xs mt-1">{warning}</p>}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
