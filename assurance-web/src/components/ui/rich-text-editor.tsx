import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Eraser, Italic, List, ListOrdered, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const EMPTY_DOCUMENT = "<p></p>";
const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

function toEditorContent(value: string) {
  if (!value) return EMPTY_DOCUMENT;
  if (HTML_TAG_PATTERN.test(value)) return value;
  return value
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Saisir les prestations...",
  disabled = false,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorContent(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "min-h-36 px-3 py-2 text-sm outline-none",
          "[&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5",
        ),
        "aria-label": "Prestations",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.isEmpty ? "" : currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const nextValue = toEditorContent(value);
    if (editor.getHTML() !== nextValue) {
      editor.commands.setContent(nextValue, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return <div className={cn("min-h-44 rounded-md border bg-muted/30", className)} />;
  }

  const controls = [
    { label: "Gras", icon: Bold, active: editor.isActive("bold"), disabled: false, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Italique", icon: Italic, active: editor.isActive("italic"), disabled: false, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Liste à puces", icon: List, active: editor.isActive("bulletList"), disabled: false, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Liste numérotée", icon: ListOrdered, active: editor.isActive("orderedList"), disabled: false, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Annuler", icon: Undo2, active: false, disabled: !editor.can().chain().focus().undo().run(), run: () => editor.chain().focus().undo().run() },
    { label: "Rétablir", icon: Redo2, active: false, disabled: !editor.can().chain().focus().redo().run(), run: () => editor.chain().focus().redo().run() },
    { label: "Effacer la mise en forme", icon: Eraser, active: false, disabled: false, run: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
  ];

  return (
    <div className={cn("overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/40", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-1.5">
        {controls.map((control) => (
          <Tooltip key={control.label}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={control.active ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label={control.label}
                aria-pressed={control.active}
                disabled={disabled || control.disabled}
                onClick={control.run}
              >
                <control.icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{control.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <EditorContent
        editor={editor}
        className={cn(
          "[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:float-left",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:h-0",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        )}
      />
    </div>
  );
}
