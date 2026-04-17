"use client";

import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { type MouseEvent, useEffect, useRef } from "react";
import { getRichTextLength } from "@/lib/listing-rich-text";

type SimpleRichTextEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  maxCharacters: number;
  placeholder?: string;
  disabled?: boolean;
};

function normalizeEditorHtml(input: string): string {
  const normalized = input
    .replace(/<ol(\s[^>]*)?>/gi, (_match, attrs: string | undefined) => {
      return `<ul${attrs ?? ""}>`;
    })
    .replace(/<\/ol>/gi, "</ul>")
    .trim();
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
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const currentLength = getRichTextLength(value);
  const isLimitExceeded = currentLength > maxCharacters;
  const isEmpty = currentLength === 0;

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: !disabled,
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          orderedList: false,
          strike: false,
        }),
      ],
      content: normalizeEditorHtml(value) || "<p></p>",
      editorProps: {
        attributes: {
          class:
            "min-h-32 px-3 py-2 text-sm text-neutral-900 outline-none [&_p]:m-0 [&_p+p]:mt-2 [&_li]:leading-6 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        },
      },
      onUpdate: ({ editor: nextEditor }) => {
        const nextHtml = normalizeEditorHtml(nextEditor.getHTML());
        onChangeRef.current(nextHtml);
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const normalizedCurrent = normalizeEditorHtml(editor.getHTML());
    const normalizedIncoming = normalizeEditorHtml(value);
    if (normalizedCurrent !== normalizedIncoming) {
      editor.commands.setContent(normalizedIncoming || "<p></p>", {
        emitUpdate: false,
      });
    }
  }, [editor, value]);

  const onToolbarMouseDown = (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    event.preventDefault();
    if (disabled || !editor) {
      return;
    }
    action();
  };

  const onClear = () => {
    if (disabled || !editor) {
      return;
    }
    editor.commands.clearContent();
    editor.chain().focus("start").run();
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onMouseDown={(event) => {
            onToolbarMouseDown(event, () => {
              const nextEditor = editor;
              if (!nextEditor) {
                return;
              }
              nextEditor.chain().focus().toggleBold().run();
            });
          }}
          disabled={disabled || !editor}
          className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
            editor?.isActive("bold")
              ? "border-[#2f639a] bg-[#0f2b4f] text-[#e2efff]"
              : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100"
          }`}
          title="Pogrubienie"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(event) => {
            onToolbarMouseDown(event, () => {
              const nextEditor = editor;
              if (!nextEditor) {
                return;
              }
              nextEditor.chain().focus().toggleItalic().run();
            });
          }}
          disabled={disabled || !editor}
          className={`rounded-md border px-2.5 py-1 text-xs italic transition disabled:cursor-not-allowed disabled:opacity-60 ${
            editor?.isActive("italic")
              ? "border-[#2f639a] bg-[#0f2b4f] text-[#e2efff]"
              : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100"
          }`}
          title="Kursywa"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(event) => {
            onToolbarMouseDown(event, () => {
              const nextEditor = editor;
              if (!nextEditor) {
                return;
              }
              nextEditor.chain().focus().toggleBulletList().run();
            });
          }}
          disabled={disabled || !editor}
          className={`rounded-md border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
            editor?.isActive("bulletList")
              ? "border-[#2f639a] bg-[#0f2b4f] text-[#e2efff]"
              : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100"
          }`}
          title="Lista punktowana"
        >
          Lista
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || !editor}
          className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
          title="Wyczysc opis"
        >
          Wyczysc
        </button>
      </div>

      <div
        className={`relative rounded-md border bg-white transition ${
          disabled
            ? "border-neutral-200 bg-neutral-100/60"
            : "border-neutral-300 focus-within:ring-2 focus-within:ring-[#4e86c3]"
        }`}
      >
        {isEmpty ? (
          <span className="pointer-events-none absolute left-3 top-2 z-[1] text-sm text-neutral-400">
            {placeholder}
          </span>
        ) : null}
        <EditorContent editor={editor} />
      </div>

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
