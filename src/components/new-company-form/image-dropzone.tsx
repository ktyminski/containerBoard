"use client";

import { useRef } from "react";

type ImageDropzoneProps = {
  title: string;
  hintText: string;
  multiple?: boolean;
  variant?: "dark" | "light";
  onFilesAdded: (files: File[]) => void;
};

export function ImageDropzone(props: ImageDropzoneProps) {
  const { title, hintText, multiple = true, variant = "dark", onFilesAdded } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isLight = variant === "light";

  const handleFileList = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    onFilesAdded(Array.from(files));
  };

  return (
    <div
      className={`rounded-md border border-dashed p-4 text-center ${
        isLight
          ? "border-neutral-300 bg-neutral-100/85"
          : "border-[#334155] bg-[#0b1730]"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        handleFileList(event.dataTransfer.files);
      }}
    >
      <p className={`text-sm ${isLight ? "text-neutral-800" : "text-[#e2efff]"}`}>{title}</p>
      <button
        type="button"
        className={`mt-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-lg transition ${
          isLight
            ? "border-neutral-400 text-neutral-700 hover:border-neutral-500"
            : "border-[#475569] text-[#dbeafe] hover:border-[#64748b]"
        }`}
        aria-label={title}
        onClick={() => {
          fileInputRef.current?.click();
        }}
      >
        +
      </button>
      <p className={`mt-2 text-xs ${isLight ? "text-neutral-600" : "text-[#94a3b8]"}`}>{hintText}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          handleFileList(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}


