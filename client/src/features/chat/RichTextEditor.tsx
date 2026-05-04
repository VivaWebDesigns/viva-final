import { forwardRef, lazy, Suspense } from "react";
import type { RichTextEditorHandle, RichTextEditorProps } from "./RichTextEditorImpl";

export type { RichTextEditorHandle, RichTextEditorProps } from "./RichTextEditorImpl";
export { sanitizeHtml } from "./richTextSanitize";

const RichTextEditorImpl = lazy(() => import("./RichTextEditorImpl"));

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ disabled, placeholder, "data-testid": testId, ...props }, ref) => (
    <Suspense fallback={<RichTextEditorFallback disabled={disabled} placeholder={placeholder} testId={testId} />}>
      <RichTextEditorImpl
        {...props}
        ref={ref}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={testId}
      />
    </Suspense>
  )
);

RichTextEditor.displayName = "RichTextEditor";

function RichTextEditorFallback({
  disabled,
  placeholder,
  testId,
}: {
  disabled?: boolean;
  placeholder: string;
  testId?: string;
}) {
  return (
    <div
      aria-busy="true"
      data-testid={testId}
      className={`flex-1 min-h-[86px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      {placeholder}
    </div>
  );
}

export default RichTextEditor;
