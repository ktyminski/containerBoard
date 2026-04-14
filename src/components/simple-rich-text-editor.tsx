"use client";

import { useEffect, useRef } from "react";
import { getRichTextLength } from "@/lib/listing-rich-text";

type SimpleRichTextEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  maxCharacters: number;
  placeholder?: string;
  disabled?: boolean;
};

function normalizeEditorHtml(input: string): string {
  const normalized = input.trim();
  if (
    normalized === "<br>" ||
    normalized === "<div><br></div>" ||
    normalized === "<p><br></p>"
  ) {
    return "";
  }

  return normalized;
}

export function SimpleRichTextEditor({
  value,
  onChange,
  maxCharacters,
  placeholder = "Wpisz opis...",
  disabled = false,
}: SimpleRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const currentLength = getRichTextLength(value);
  const isLimitExceeded = currentLength > maxCharacters;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  const runCommand = (command: "bold" | "italic" | "insertUnorderedList" | "insertOrderedList") => {
    if (disabled) {
      return;
    }

    editorRef.current?.focus();
    document.execCommand(command);
    const html = normalizeEditorHtml(editorRef.current?.innerHTML ?? "");
    onChange(html);
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runCommand("bold")}
          disabled={disabled}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          title="Pogrubienie"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => runCommand("italic")}
          disabled={disabled}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800 italic hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          title="Kursywa"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => runCommand("insertUnorderedList")}
          disabled={disabled}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          title="Lista punktowana"
        >
          Lista
        </button>
        <button
          type="button"
          onClick={() => runCommand("insertOrderedList")}
          disabled={disabled}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          title="Lista numerowana"
        >
          1.
        </button>
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={disabled}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          title="Wyczysc opis"
        >
          Wyczysc
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={(event) => {
          const nextHtml = normalizeEditorHtml(event.currentTarget.innerHTML);
          onChange(nextHtml);
        }}
        className="min-h-32 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#4e86c3] empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-400"
      />

      <p
        className={`text-xs ${
          isLimitExceeded ? "font-medium text-rose-700" : "text-neutral-500"
        }`}
      >
        {currentLength}/{maxCharacters}
      </p>
    </div>
  );
}
