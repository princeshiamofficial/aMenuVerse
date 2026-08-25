import React, { useRef } from "react";

interface FormattedTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export default function FormattedTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  className,
}: FormattedTextareaProps) {
  const displayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleScroll = () => {
    if (displayRef.current && textareaRef.current) {
      displayRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const renderFormattedTextInPlace = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <span key={index}>
            <span className="text-slate-350 font-normal">**</span>
            <strong className="text-slate-900 font-bold">{part.slice(2, -2)}</strong>
            <span className="text-slate-350 font-normal">**</span>
          </span>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <span key={index}>
            <span className="text-slate-350 font-normal">*</span>
            <strong className="text-slate-900 font-semibold">{part.slice(1, -1)}</strong>
            <span className="text-slate-350 font-normal">*</span>
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className={`relative w-full ${className || ""}`}>
      {/* Background display layer */}
      <div
        ref={displayRef}
        className="absolute inset-0 p-3.5 border border-transparent text-xs font-medium text-slate-700 bg-transparent pointer-events-none whitespace-pre-wrap wrap-break-word overflow-hidden"
        style={{ fontFamily: "inherit", lineHeight: "1.625" }}
      >
        {renderFormattedTextInPlace(value) || <span className="text-slate-400">{placeholder}</span>}
      </div>

      {/* Foreground interactive textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        rows={rows}
        className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-medium placeholder-transparent focus:outline-none focus:border-[#ff7a00] transition-colors bg-transparent resize-y text-transparent caret-slate-800 whitespace-pre-wrap wrap-break-word block"
        style={{
          fontFamily: "inherit",
          lineHeight: "1.625",
          color: "transparent",
          WebkitTextFillColor: "transparent",
        }}
      />
    </div>
  );
}
