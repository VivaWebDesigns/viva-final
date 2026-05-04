import { lazy, Suspense } from "react";
import type { EmojiClickData, PickerProps } from "emoji-picker-react";

export type RichTextEmojiClickData = Pick<EmojiClickData, "emoji">;

const EmojiPicker = lazy(() => import("emoji-picker-react"));

type LazyEmojiPickerProps = Omit<PickerProps, "theme"> & {
  theme?: PickerProps["theme"] | "light" | "dark" | "auto";
};

export default function LazyEmojiPicker(props: LazyEmojiPickerProps) {
  return (
    <Suspense fallback={<EmojiPickerFallback width={props.width} height={props.height} />}>
      <EmojiPicker {...(props as PickerProps)} />
    </Suspense>
  );
}

function EmojiPickerFallback({
  width,
  height,
}: {
  width?: LazyEmojiPickerProps["width"];
  height?: LazyEmojiPickerProps["height"];
}) {
  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      aria-busy="true"
      className="flex items-center justify-center rounded-xl border border-gray-200 bg-white text-xs text-gray-400"
      style={style}
    >
      Loading emojis...
    </div>
  );
}
