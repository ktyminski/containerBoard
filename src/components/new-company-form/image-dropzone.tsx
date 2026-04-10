"use client";

import { useRef } from "react";

type ImageDropzoneProps = {
  title: string;
  hintText: string;
  multiple?: boolean;
  onFilesAdded: (files: File[]) => void;
};

export function ImageDropzone(props: ImageDropzoneProps) {
  const { title, hintText, multiple = true, onFilesAdded } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileList = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    onFilesAdded(Array.from(files));
  };

  return (
    <div
      className="rounded-md border border-dashed border-slate-600 bg-slate-950/70 p-4 text-center"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        handleFileList(event.dataTransfer.files);
      }}
    >
      <p className="text-sm text-slate-300">{title}</p>
      <button
        type="button"
        className="mt-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-600 text-lg text-slate-200 hover:border-slate-400"
        aria-label={title}
        onClick={() => {
          fileInputRef.current?.click();
        }}
      >
        +
      </button>
      <p className="mt-2 text-xs text-slate-500">{hintText}</p>
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
