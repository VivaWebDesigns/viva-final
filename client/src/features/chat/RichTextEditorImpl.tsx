import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useImperativeHandle, forwardRef, useState, useRef } from "react";
import { Bold, Italic, Strikethrough, Link2, Smile } from "lucide-react";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import { sanitizeHtml } from "./richTextSanitize";

export interface RichTextEditorHandle {
  clearEditor: () => void;
  focusEditor: () => void;
  insertText: (text: string) => void;
  insertMentionText: (queryLength: number, name: string) => void;
  isEmpty: () => boolean;
  getHTML: () => string;
  getText: () => string;
}

export interface RichTextEditorProps {
  placeholder: string;
  onSend: (html: string) => void;
  onTextChange: (text: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  "data-testid"?: string;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ placeholder, onSend, onTextChange, onBlur, disabled, "data-testid": testId }, ref) => {
    const [showLinkPopover, setShowLinkPopover] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [linkUrl, setLinkUrl] = useState("");
    const linkInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const linkPopoverRef = useRef<HTMLDivElement>(null);

    const onSendRef = useRef(onSend);
    useEffect(() => { onSendRef.current = onSend; }, [onSend]);

    const onTextChangeRef = useRef(onTextChange);
    useEffect(() => { onTextChangeRef.current = onTextChange; }, [onTextChange]);

    const EnterToSend = Extension.create({
      name: "enterToSend",
      addKeyboardShortcuts() {
        return {
          Enter: () => {
            if (!this.editor.isEmpty) {
              const html = sanitizeHtml(this.editor.getHTML());
              onSendRef.current(html);
              return true;
            }
            return false;
          },
        };
      },
    });

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
        EnterToSend,
      ],
      editable: !disabled,
      onUpdate: ({ editor }) => {
        onTextChangeRef.current(editor.getText());
      },
      onBlur: () => {
        onBlur?.();
      },
      editorProps: {
        attributes: {
          class: "tiptap focus:outline-none min-h-[40px] max-h-[120px] overflow-y-auto px-3 py-2.5 text-sm text-gray-900 leading-relaxed",
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

    useImperativeHandle(ref, () => ({
      clearEditor: () => editor?.commands.clearContent(true),
      focusEditor: () => editor?.commands.focus(),
      insertText: (text: string) => {
        editor?.commands.insertContent(text);
        editor?.commands.focus();
      },
      insertMentionText: (queryLength: number, name: string) => {
        if (!editor) return;
        const { state } = editor;
        const { from } = state.selection;
        editor.chain().focus().deleteRange({ from: from - queryLength, to: from }).insertContent(`@${name} `).run();
      },
      isEmpty: () => editor?.isEmpty ?? true,
      getHTML: () => editor ? sanitizeHtml(editor.getHTML()) : "",
      getText: () => editor?.getText() ?? "",
    }));

    const toggleBold = () => editor?.chain().focus().toggleBold().run();
    const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
    const toggleStrike = () => editor?.chain().focus().toggleStrike().run();

    const applyLink = () => {
      const url = linkUrl.trim();
      if (!url) {
        editor?.chain().focus().unsetLink().run();
      } else {
        const href = url.startsWith("http") ? url : `https://${url}`;
        editor?.chain().focus().setLink({ href }).run();
      }
      setShowLinkPopover(false);
      setLinkUrl("");
    };

    const handleEmojiClick = (data: EmojiClickData) => {
      editor?.chain().focus().insertContent(data.emoji).run();
      setShowEmojiPicker(false);
    };

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
          setShowEmojiPicker(false);
        }
        if (linkPopoverRef.current && !linkPopoverRef.current.contains(e.target as Node)) {
          setShowLinkPopover(false);
          setLinkUrl("");
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
      if (showLinkPopover) {
        setTimeout(() => linkInputRef.current?.focus(), 50);
        const existingUrl = editor?.getAttributes("link").href ?? "";
        setLinkUrl(existingUrl);
      }
    }, [showLinkPopover, editor]);

    if (!editor) return null;

    return (
      <div className="flex-1 flex flex-col border border-gray-200 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-[#0D9488]/30 focus-within:border-[#0D9488] transition-colors overflow-visible">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-1 border-b border-gray-100 bg-white/80 rounded-t-lg flex-shrink-0">
          <ToolbarButton onClick={toggleBold} active={editor.isActive("bold")} title="Negrita (Ctrl+B)" data-testid="toolbar-bold">
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={toggleItalic} active={editor.isActive("italic")} title="Cursiva (Ctrl+I)" data-testid="toolbar-italic">
            <Italic className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton onClick={toggleStrike} active={editor.isActive("strike")} title="Tachado" data-testid="toolbar-strike">
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolbarButton>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {/* Link button */}
          <div className="relative" ref={linkPopoverRef}>
            <ToolbarButton
              onClick={() => { setShowLinkPopover(!showLinkPopover); setShowEmojiPicker(false); }}
              active={editor.isActive("link") || showLinkPopover}
              title="Insertar enlace"
              data-testid="toolbar-link"
            >
              <Link2 className="w-3.5 h-3.5" />
            </ToolbarButton>
            {showLinkPopover && (
              <div className="absolute bottom-full left-0 mb-2 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-72">
                <p className="text-xs font-semibold text-gray-600 mb-2">Insertar enlace</p>
                <div className="flex gap-1.5">
                  <input
                    ref={linkInputRef}
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); applyLink(); }
                      if (e.key === "Escape") { setShowLinkPopover(false); }
                    }}
                    placeholder="https://ejemplo.com"
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D9488]/40 focus:border-[#0D9488]"
                    data-testid="input-link-url"
                  />
                  <button
                    onClick={applyLink}
                    className="text-xs bg-[#0D9488] text-white px-2.5 py-1.5 rounded hover:bg-[#0F766E] transition-colors font-medium"
                    data-testid="button-apply-link"
                  >
                    OK
                  </button>
                </div>
                {editor.isActive("link") && (
                  <button
                    onClick={() => { editor.chain().focus().unsetLink().run(); setShowLinkPopover(false); }}
                    className="mt-1.5 text-xs text-red-500 hover:text-red-600"
                  >
                    Quitar enlace
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-gray-200 mx-1" />

          {/* Emoji button */}
          <div className="relative" ref={emojiPickerRef}>
            <ToolbarButton
              onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowLinkPopover(false); }}
              active={showEmojiPicker}
              title="Emojis"
              data-testid="toolbar-emoji"
            >
              <Smile className="w-3.5 h-3.5" />
            </ToolbarButton>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 z-50 shadow-xl rounded-xl overflow-hidden" data-testid="emoji-picker-full">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.LIGHT}
                  width={320}
                  height={380}
                  searchPlaceholder="Buscar emoji..."
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                />
              </div>
            )}
          </div>

          <span className="ml-auto text-[10px] text-gray-300 pr-1 hidden lg:block select-none">
            Enter enviar · Shift+Enter línea nueva
          </span>
        </div>

        {/* Editable area */}
        <EditorContent editor={editor} className="flex-1 min-w-0" />
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";

function ToolbarButton({
  children,
  onClick,
  active,
  title,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title?: string;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      data-testid={testId}
      className={`p-1 rounded transition-colors ${
        active
          ? "bg-[#0D9488]/10 text-[#0D9488]"
          : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

export default RichTextEditor;
