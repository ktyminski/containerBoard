"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";

type JobDescriptionEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  labels: JobDescriptionEditorLabels;
};

export type JobDescriptionEditorLabels = {
  bold: string;
  italic: string;
  bulletList: string;
  orderedList: string;
  link: string;
  clearFormatting: string;
  formattingHint: string;
  linkPrompt: string;
  linkInvalidAlert: string;
  linkModalTitle: string;
  linkModalSave: string;
  linkModalCancel: string;
};

const EMPTY_CONTENT_HTML = "<p></p>";
const ALLOWED_TAGS = new Set([
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "a",
  "br",
]);

function isSafeLinkHref(value: string): boolean {
  const href = value.trim();
  if (!href) {
    return false;
  }

  try {
    const parsed = new URL(href, "https://example.com");
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "mailto:"
    );
  } catch {
    return false;
  }
}

export function sanitizeJobDescriptionHtml(input: string): string {
  const html = input.trim();
  if (!html) {
    return "";
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const body = parsed.body;

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        const fragment = parsed.createDocumentFragment();
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
        return;
      }

      if (tag === "a") {
        const href = element.getAttribute("href") ?? "";
        if (!isSafeLinkHref(href)) {
          const fragment = parsed.createDocumentFragment();
          while (element.firstChild) {
            fragment.appendChild(element.firstChild);
          }
          element.replaceWith(fragment);
          return;
        }

        element.setAttribute("href", href.trim());
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noopener noreferrer nofollow");

        for (const { name } of Array.from(element.attributes)) {
          if (name !== "href" && name !== "target" && name !== "rel") {
            element.removeAttribute(name);
          }
        }
      } else {
        for (const { name } of Array.from(element.attributes)) {
          element.removeAttribute(name);
        }
      }
    }

    for (const child of Array.from(node.childNodes)) {
      sanitizeNode(child);
    }
  };

  for (const child of Array.from(body.childNodes)) {
    sanitizeNode(child);
  }

  if (!body.textContent?.trim()) {
    return "";
  }

  return body.innerHTML.trim();
}

function ToolbarButton({
  label,
  isActive = false,
  disabled = false,
  onClick,
}: {
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-md border px-2 py-1 text-xs ${
        isActive
          ? "border-sky-500 bg-sky-500/15 text-sky-200"
          : "border-slate-700 text-slate-300 hover:border-slate-500"
      } disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function JobDescriptionEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  labels,
}: JobDescriptionEditorProps) {
  const uiLabels = labels;
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("https://");
  const [linkError, setLinkError] = useState<string | null>(null);
  const selectionRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
      }),
    ],
    content: sanitizeJobDescriptionHtml(value) || EMPTY_CONTENT_HTML,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "min-h-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:outline-none [&_a]:text-sky-300 [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const sanitized = sanitizeJobDescriptionHtml(currentEditor.getHTML());
      onChange(sanitized);
    },
  });

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

    const sanitized = sanitizeJobDescriptionHtml(value) || EMPTY_CONTENT_HTML;
    if (editor.getHTML() === sanitized) {
      return;
    }
    editor.commands.setContent(sanitized, { emitUpdate: false });
  }, [editor, value]);

  const canUseToolbar = Boolean(editor) && !disabled;
  const hint = placeholder?.trim() ?? "";
  const hasActiveLink = editor?.isActive("link") ?? false;

  const closeLinkModal = () => {
    setIsLinkModalOpen(false);
    setLinkError(null);
  };

  const openLinkModal = () => {
    if (!editor || disabled) {
      return;
    }
    const { from, to } = editor.state.selection;
    selectionRef.current = { from, to };
    const currentHref = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLinkDraft(currentHref || "https://");
    setLinkError(null);
    setIsLinkModalOpen(true);
  };

  const saveLinkFromModal = () => {
    if (!editor) {
      return;
    }
    const trimmed = linkDraft.trim();
    if (!trimmed) {
      setLinkError(uiLabels.linkInvalidAlert);
      return;
    }
    if (!isSafeLinkHref(trimmed)) {
      setLinkError(uiLabels.linkInvalidAlert);
      return;
    }
    const savedSelection = selectionRef.current;
    const hasSelection = Boolean(savedSelection && savedSelection.to > savedSelection.from);
    const isCurrentLinkActive = editor.isActive("link");
    const chain = editor.chain().focus();
    if (savedSelection) {
      chain.setTextSelection(savedSelection);
    }
    if (!hasSelection && !isCurrentLinkActive) {
      chain.insertContent({
        type: "text",
        text: trimmed,
        marks: [{ type: "link", attrs: { href: trimmed } }],
      });
    } else {
      chain.extendMarkRange("link").setLink({ href: trimmed });
    }
    chain.run();
    closeLinkModal();
  };

  useEffect(() => {
    if (!isLinkModalOpen) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLinkModal();
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
    };
  }, [isLinkModalOpen]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap">
        <ToolbarButton
          label={uiLabels.bold}
          disabled={!canUseToolbar}
          isActive={editor?.isActive("bold") ?? false}
          onClick={() => {
            editor?.chain().focus().toggleBold().run();
          }}
        />
        <ToolbarButton
          label={uiLabels.italic}
          disabled={!canUseToolbar}
          isActive={editor?.isActive("italic") ?? false}
          onClick={() => {
            editor?.chain().focus().toggleItalic().run();
          }}
        />
        <ToolbarButton
          label={uiLabels.bulletList}
          disabled={!canUseToolbar}
          isActive={editor?.isActive("bulletList") ?? false}
          onClick={() => {
            editor?.chain().focus().toggleBulletList().run();
          }}
        />
        <ToolbarButton
          label={uiLabels.orderedList}
          disabled={!canUseToolbar}
          isActive={editor?.isActive("orderedList") ?? false}
          onClick={() => {
            editor?.chain().focus().toggleOrderedList().run();
          }}
        />
        <ToolbarButton
          label={uiLabels.link}
          disabled={!canUseToolbar}
          isActive={hasActiveLink}
          onClick={() => {
            openLinkModal();
          }}
        />
        <ToolbarButton
          label={uiLabels.clearFormatting}
          disabled={!canUseToolbar}
          onClick={() => {
            editor?.chain().focus().clearNodes().unsetAllMarks().run();
          }}
        />
      </div>

      <div className="grid gap-1">
        <EditorContent editor={editor} />
        <p className="text-xs text-slate-400">{uiLabels.formattingHint}</p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>

      {isLinkModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto [&>div:not(.fixed)]:my-auto [&>div:not(.fixed)]:max-h-[calc(100dvh-2rem)] [&>div:not(.fixed)]:!overflow-y-auto p-4">
          <div
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm"
            onClick={closeLinkModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-100">{uiLabels.linkModalTitle}</h3>
            <label className="mt-3 grid gap-1 text-xs">
              <span className="text-slate-300">{uiLabels.linkPrompt}</span>
              <input
                value={linkDraft}
                onChange={(event) => {
                  setLinkDraft(event.target.value);
                  if (linkError) {
                    setLinkError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveLinkFromModal();
                  }
                }}
                placeholder="https://example.com"
                autoFocus
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            {linkError ? <p className="mt-2 text-xs text-rose-300">{linkError}</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                onClick={closeLinkModal}
              >
                {uiLabels.linkModalCancel}
              </button>
              <button
                type="button"
                className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-sky-400"
                onClick={saveLinkFromModal}
              >
                {uiLabels.linkModalSave}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


