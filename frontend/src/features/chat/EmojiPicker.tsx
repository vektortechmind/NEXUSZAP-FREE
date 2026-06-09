import { useEffect, useRef } from "react";
import { EMOJI_CATEGORIES } from "./emojiOptions";

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
};

export function EmojiPicker({ onSelect, onClose, className = "" }: EmojiPickerProps) {
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
    <div
      ref={panelRef}
      className={`w-64 rounded-lg border border-slate-200 bg-white p-2 text-slate-900 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${className}`}
      onClick={(event) => event.stopPropagation()}
      role="dialog"
      aria-label="Seletor de emojis"
    >
      <div className="max-h-72 overflow-y-auto pr-1">
        {EMOJI_CATEGORIES.map((category) => (
          <section key={category.label} className="mb-2 last:mb-0">
            <h3 className="mb-1 px-1 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">{category.label}</h3>
            <div className="grid grid-cols-6 gap-1">
              {category.emojis.map((emoji) => (
                <button
                  key={`${category.label}-${emoji}`}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800"
                  aria-label={`Reagir com ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
