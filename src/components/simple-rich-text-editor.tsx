"use client";

import { memo, useCallback } from "react";
import Editor, {
  BtnBold,
  BtnBulletList,
  BtnItalic,
  BtnUnderline,
  Toolbar,
  type ContentEditableEvent,
} from "react-simple-wysiwyg";
import { getRichTextLength } from "@/lib/listing-rich-text";

type SimpleRichTextEditorProps = {
  value: string;
  onChange: (nextValue: string) => void;
  maxCharacters: number;
  placeholder?: string;
  disabled?: boolean;
};

function SimpleRichTextEditorImpl({
  value,
  onChange,
  maxCharacters,
  placeholder = "Wpisz opis...",
  disabled = false,
}: SimpleRichTextEditorProps) {
  const currentLength = getRichTextLength(value);
  const isLimitExceeded = currentLength > maxCharacters;

  const handleChange = useCallback(
    (event: ContentEditableEvent) => {
      onChange(event.target.value ?? "");
    },
    [onChange],
  );

  return (
    <div className="grid gap-2">
      <Editor
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        containerProps={{
          className:
            "cb-rich-editor rounded-md border border-neutral-300 bg-white text-neutral-900",
        }}
      >
        <Toolbar>
          <BtnBold />
          <BtnItalic />
          <BtnUnderline />
          <BtnBulletList />
        </Toolbar>
      </Editor>

      <p
        className={`text-xs ${
          isLimitExceeded ? "font-medium text-rose-700" : "text-neutral-500"
        }`}
      >
        {currentLength}/{maxCharacters}
      </p>

      <style jsx global>{`
        .cb-rich-editor.rsw-editor {
          min-height: 128px;
        }
        .cb-rich-editor .rsw-toolbar {
          border-bottom-color: rgb(229 229 229);
          background: rgb(250 250 250);
        }
        .cb-rich-editor .rsw-btn {
          color: rgb(38 38 38);
          border-radius: 6px;
          margin: 0 1px;
        }
        .cb-rich-editor .rsw-btn:hover {
          background: rgb(245 245 245);
        }
        .cb-rich-editor .rsw-btn[data-active="true"] {
          background: rgb(229 231 235);
          color: rgb(38 38 38);
        }
        .cb-rich-editor .rsw-ce {
          min-height: 92px;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.55;
        }
        .cb-rich-editor .rsw-ce ul {
          list-style: disc;
          margin: 0.35rem 0 0.35rem 1.2rem;
          padding-left: 0.2rem;
        }
      `}</style>
    </div>
  );
}

export const SimpleRichTextEditor = memo(
  SimpleRichTextEditorImpl,
  (prev, next) =>
    prev.value === next.value &&
    prev.maxCharacters === next.maxCharacters &&
    prev.placeholder === next.placeholder &&
    prev.disabled === next.disabled,
);
