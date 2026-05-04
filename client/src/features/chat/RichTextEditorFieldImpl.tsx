import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState, forwardRef } from "react";
import { Bold, Italic, Strikethrough, Link2, Smile } from "lucide-react";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { sanitizeHtml } from "./richTextSanitize";

export interface RichTextEditorFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  onChange?: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  "data-testid"?: string;
}

const RichTextEditorField = forwardRef<HTMLDivElement, RichTextEditorFieldProps>(
  (
    {
      value = "",
      onChange,
      onBlur,
      placeholder = "Write something...",
      disabled = false,
      minHeight = "80px",
      "data-testid": testId,
      ...rest
    },
    ref
  ) => {
    const [showLinkPopover, setShowLinkPopover] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const linkInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const linkPopoverRef = useRef<HTMLDivElement>(null);

    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    const initialValueRef = useRef(value);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: false,
          horizontalRule: false,
          blockquote: false,
          codeBlock: false,
          link: false,
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer",
            class: "text-[#0D9488] underline cursor-pointer",
          },
          validate: (href) => /^https?:\/\//.test(href),
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass: "is-editor-empty",
        }),
      ],
      content: initialValueRef.current || "",
      editable: !disabled,
      onUpdate: ({ editor }) => {
        onChangeRef.current?.(sanitizeHtml(editor.getHTML()));
      },
      onBlur: () => {
        onBlur?.();
      },
      editorProps: {
        attributes: {
          class: `tiptap focus:outline-none overflow-y-auto px-3 py-2.5 text-sm text-gray-900 leading-relaxed`,
          style: `min-height: ${minHeight}; max-height: 400px;`,
          ...(testId ? { "data-testid": testId } : {}),
        },
      },
    });

    useEffect(() => {
      if (!editor) return;
      editor.extensionManager.extensions.forEach((ext) => {
        if (ext.name === "placeholder") {
          ext.options.placeholder = placeholder;
        }
      });
      editor.view.dispatch(editor.state.tr);
    }, [editor, placeholder]);

    useEffect(() => {
      if (!editor) return;
      editor.setEditable(!disabled);
    }, [editor, disabled]);

    useEffect(() => {
      if (!editor) return;
      const current = sanitizeHtml(editor.getHTML());
      const incoming = value ?? "";
      if (current !== incoming && incoming !== current) {
        const isFocused = editor.isFocused;
        if (!isFocused) {
          editor.commands.setContent(incoming);
        }
      }
    }, [value, editor]);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
          setShowEmojiPicker(false);
        }
        if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node)) {
          setShowLinkPopover(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleBold = () => editor?.chain().focus().toggleBold().run();
    const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
    const toggleStrike = () => editor?.chain().focus().toggleStrike().run();

    const openLinkPopover = () => {
      const existingHref = editor?.getAttributes("link").href ?? "";
      setLinkUrl(existingHref);
      setShowLinkPopover(true);
      setTimeout(() => linkInputRef.current?.focus(), 50);
    };

    const applyLink = () => {
      if (!linkUrl.trim()) {
        editor?.chain().focus().unsetLink().run();
      } else {
        const href = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
        editor?.chain().focus().setLink({ href }).run();
      }
      setShowLinkPopover(false);
      setLinkUrl("");
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
      editor?.chain().focus().insertContent(emojiData.emoji).run();
      setShowEmojiPicker(false);
    };

    const isActive = (type: string, attrs?: object) => editor?.isActive(type, attrs) ?? false;

    return (
      <div
        ref={ref}
        {...rest}
        className={`border rounded-lg bg-white focus-within:ring-2 focus-within:ring-[#0D9488]/30 focus-within:border-[#0D9488] transition-colors ${disabled ? "opacity-60 pointer-events-none" : ""} ${rest.className ?? ""}`}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/60 rounded-t-lg">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleBold(); }}
            className={`p-1.5 rounded text-xs font-bold transition-colors ${isActive("bold") ? "bg-[#0D9488]/15 text-[#0D9488]" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"}`}
            title="Bold"
            data-testid="toolbar-bold"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleItalic(); }}
            className={`p-1.5 rounded text-xs transition-colors ${isActive("italic") ? "bg-[#0D9488]/15 text-[#0D9488]" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"}`}
            title="Italic"
            data-testid="toolbar-italic"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); toggleStrike(); }}
            className={`p-1.5 rounded text-xs transition-colors ${isActive("strike") ? "bg-[#0D9488]/15 text-[#0D9488]" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"}`}
            title="Strikethrough"
            data-testid="toolbar-strike"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <div className="relative" ref={linkPopoverRef}>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); openLinkPopover(); }}
              className={`p-1.5 rounded text-xs transition-colors ${isActive("link") ? "bg-[#0D9488]/15 text-[#0D9488]" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"}`}
              title="Insert Link"
              data-testid="toolbar-link"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
            {showLinkPopover && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex gap-1.5 min-w-[220px]">
                <input
                  ref={linkInputRef}
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setShowLinkPopover(false); }}
                  placeholder="https://..."
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#0D9488]"
                />
                <button
                  type="button"
                  onClick={applyLink}
                  className="text-xs bg-[#0D9488] text-white px-2 py-1 rounded hover:bg-[#0F766E]"
                >
                  OK
                </button>
              </div>
            )}
          </div>
          <div className="relative" ref={emojiPickerRef}>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowEmojiPicker(!showEmojiPicker); }}
              className={`p-1.5 rounded text-xs transition-colors ${showEmojiPicker ? "bg-[#0D9488]/15 text-[#0D9488]" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"}`}
              title="Emoji"
              data-testid="toolbar-emoji"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-1 z-50">
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  theme={Theme.LIGHT}
                  searchPlaceholder="Search emoji..."
                  width={300}
                  height={360}
                />
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <EditorContent editor={editor} />
      </div>
    );
  }
);

RichTextEditorField.displayName = "RichTextEditorField";
export default RichTextEditorField;
