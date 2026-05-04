import { forwardRef, lazy, Suspense } from "react";
import type { RichTextEditorFieldProps } from "./RichTextEditorFieldImpl";

export type { RichTextEditorFieldProps } from "./RichTextEditorFieldImpl";

const RichTextEditorFieldImpl = lazy(() => import("./RichTextEditorFieldImpl"));

const RichTextEditorField = forwardRef<HTMLDivElement, RichTextEditorFieldProps>(
  ({ className, disabled, minHeight = "80px", placeholder = "Write something...", "data-testid": testId, ...props }, ref) => (
    <Suspense
      fallback={
        <RichTextEditorFieldFallback
          className={className}
          disabled={disabled}
          minHeight={minHeight}
          placeholder={placeholder}
          testId={testId}
        />
      }
    >
      <RichTextEditorFieldImpl
        {...props}
        ref={ref}
        className={className}
        disabled={disabled}
        minHeight={minHeight}
        placeholder={placeholder}
        data-testid={testId}
      />
    </Suspense>
  )
);

RichTextEditorField.displayName = "RichTextEditorField";

function RichTextEditorFieldFallback({
  className,
  disabled,
  minHeight,
  placeholder,
  testId,
}: {
  className?: string;
  disabled?: boolean;
  minHeight: string;
  placeholder: string;
  testId?: string;
}) {
  return (
    <div
      aria-busy="true"
      data-testid={testId}
      className={`rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-400 ${
        disabled ? "opacity-60" : ""
      } ${className ?? ""}`}
      style={{ minHeight }}
    >
      {placeholder}
    </div>
  );
}

export default RichTextEditorField;
