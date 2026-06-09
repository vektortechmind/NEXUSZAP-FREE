import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type EmojiMartSelection = {
  native?: string;
};

type EmojiMartPopupProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
  position?: { left: number; top: number };
};

export const EMOJI_PICKER_WIDTH = 292;
export const EMOJI_PICKER_HEIGHT = 340;
const EMOJI_PICKER_CATEGORIES = ["people", "nature", "foods", "activity", "places", "objects", "symbols", "flags"];

export function EmojiMartPopup({ onSelect, onClose, className = "", position }: EmojiMartPopupProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const popup = (
    <div
      ref={panelRef}
      className={`${position ? "fixed z-[90]" : ""} ${className}`.trim()}
      style={position ? { left: position.left, top: position.top, width: EMOJI_PICKER_WIDTH } : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <Picker
        data={data}
        emojiVersion="14.0"
        theme="auto"
        categories={EMOJI_PICKER_CATEGORIES}
        perLine={8}
        emojiSize={18}
        emojiButtonSize={30}
        maxFrequentRows={1}
        previewPosition="none"
        searchPosition="sticky"
        navPosition="bottom"
        style={{ height: `${EMOJI_PICKER_HEIGHT}px`, maxHeight: "min(340px, calc(100vh - 16px))" }}
        onEmojiSelect={(selection: EmojiMartSelection) => {
          if (!selection.native) return;
          onSelect(selection.native);
        }}
      />
    </div>
  );

  if (position && typeof document !== "undefined") return createPortal(popup, document.body);
  return popup;
}
