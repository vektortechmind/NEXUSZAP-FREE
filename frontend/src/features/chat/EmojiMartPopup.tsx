import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useEffect, useRef } from "react";

type EmojiMartSelection = {
  native?: string;
};

type EmojiMartPopupProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
};

export function EmojiMartPopup({ onSelect, onClose, className = "" }: EmojiMartPopupProps) {
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

  return (
    <div ref={panelRef} className={className} onClick={(event) => event.stopPropagation()}>
      <Picker
        data={data}
        emojiVersion="14.0"
        theme="auto"
        onEmojiSelect={(selection: EmojiMartSelection) => {
          if (!selection.native) return;
          onSelect(selection.native);
        }}
      />
    </div>
  );
}
