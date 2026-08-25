import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../src/lib/utils";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
}

export default function Dropdown({
  value,
  onChange,
  options,
  className,
  buttonClassName,
  menuClassName,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const label = selectedOption ? selectedOption.label : value;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "bg-white border border-slate-200 rounded-xl text-xs font-bold px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 shadow-sm focus:outline-none cursor-pointer",
          buttonClassName,
        )}
      >
        <span>{label}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-1.5 flex flex-col gap-0.5 min-w-[140px] z-50 animate-in fade-in slide-in-from-top-1 duration-150",
            menuClassName,
          )}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors font-sans",
                  isSelected
                    ? "bg-[#ff7a00] text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
