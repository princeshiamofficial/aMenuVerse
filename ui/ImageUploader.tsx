import React, { useState, useEffect } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface ImageUploaderProps {
  onUploadSuccess: (url: string) => void;
  label?: string;
  className?: string;
  buttonClassName?: string;
  multiple?: boolean;
}

export default function ImageUploader({
  onUploadSuccess,
  label = "Upload Image",
  className,
  buttonClassName,
  multiple = false,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Limit file size to 10MB
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File "${file.name}" must be under 10MB`);
        }

        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch(
          "https://api.imgbb.com/1/upload?key=61035b18442b2c9815d6945f6f7bccd2",
          {
            method: "POST",
            body: formData,
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to upload "${file.name}".`);
        }

        const result = await response.json();
        if (result.success && result.data?.url) {
          onUploadSuccess(result.data.url);
        } else {
          throw new Error(result.error?.message || `Upload of "${file.name}" unsuccessful`);
        }
      }
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Something went wrong during upload";
      setErrorMsg(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      uploadFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      uploadFiles(files);
    }
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        uploadFiles(files);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, []);

  const hasHeightClass = buttonClassName
    ?.split(" ")
    .some((c) => c.startsWith("h-") || c.startsWith("py-"));
  const heightClass = hasHeightClass ? "" : "h-10";

  return (
    <div className={className}>
      <label
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center justify-center gap-2 px-4 rounded-xl border border-dashed cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-[#ff7a00] bg-orange-50/20"
            : "border-slate-350 hover:border-[#ff7a00] hover:bg-orange-50/10"
        } ${heightClass} ${buttonClassName || ""}`}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 text-[#ff7a00] animate-spin" />
            <span className="text-[11px] font-bold text-slate-500">Uploading...</span>
          </>
        ) : status === "success" ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px] font-bold text-emerald-600">Uploaded</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 text-slate-405 group-hover:text-[#ff7a00]" />
            <span className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
              {label}
            </span>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
          multiple={multiple}
        />
      </label>
      {status === "error" && (
        <span className="text-[9px] font-semibold text-rose-500 mt-1.5 flex items-center gap-1">
          <AlertCircle className="w-2.5 h-2.5 shrink-0" />
          <span>{errorMsg}</span>
        </span>
      )}
    </div>
  );
}
