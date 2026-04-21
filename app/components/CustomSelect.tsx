"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  icon,
  className = "",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
          open
            ? "bg-white text-slate-800 border-slate-400 shadow-sm"
            : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
        }`}
      >
        {icon && <span className="w-4 h-4 shrink-0">{icon}</span>}
        <span className="truncate">{selected?.label || placeholder}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl z-50 min-w-[200px] py-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {options.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                value === opt.value
                  ? "text-blue-600 font-semibold bg-blue-50"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt.icon && <span className="w-4 h-4 text-slate-400 shrink-0">{opt.icon}</span>}
              {!opt.icon && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: value === opt.value ? "#3b82f6" : "#cbd5e1" }} />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
