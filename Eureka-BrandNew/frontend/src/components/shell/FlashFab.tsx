import { useState } from "react";
import { Mic, Send, X } from "lucide-react";

/**
 * FlashFab — middle pill button on the TabBar, opens a full-screen sheet
 * for the user to type / dictate a flash input.
 *
 * M0 deliverable: opens the sheet, accepts text, "submits" via console.log.
 * M2 will replace the placeholder submit with the real /api/flash call
 * (via useFlashCapture hook).
 */
export function FlashFab() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  function submit() {
    // M2 wires this to useFlashCapture; for M0 just log it
    console.log("[FlashFab] M0 placeholder submit:", text);
    setText("");
    setOpen(false);
  }

  return (
    <>
      {/* The floating button itself. Positioned over the TabBar's center slot. */}
      <button
        type="button"
        aria-label="闪念输入"
        onClick={() => setOpen(true)}
        className={[
          "fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)]",
          "left-1/2 -translate-x-1/2 z-40",
          "h-14 w-14 rounded-eu-full",
          "bg-gradient-to-br from-eu-accent-purple-solid to-eu-accent-blue-solid",
          "text-white shadow-eu-lg",
          "flex items-center justify-center",
          "transition-transform duration-eu-fast ease-eu-out",
          "active:scale-95",
        ].join(" ")}
      >
        <Mic size={22} strokeWidth={2} />
      </button>

      {/* Sheet — full-screen on mobile, centered modal on desktop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-eu-bg/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className={[
              "fixed inset-x-0 bottom-0 md:inset-auto",
              "md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
              "md:w-[480px]",
              "bg-eu-surface-raised border-t border-eu-border md:border md:rounded-eu-xl",
              "p-eu-lg pb-safe",
              "shadow-eu-lg",
              "flex flex-col gap-eu-md",
            ].join(" ")}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-eu-lg text-eu-text-hi">闪念</h2>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setOpen(false)}
                className="p-1 rounded-eu-sm hover:bg-eu-surface-hover text-eu-text-mid"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
              }}
              placeholder="说点什么…(⌘/Ctrl+Enter 提交)"
              rows={4}
              className={[
                "w-full resize-none",
                "bg-eu-surface border border-eu-border rounded-eu-md",
                "p-eu-md text-eu-base text-eu-text",
                "placeholder:text-eu-text-muted",
                "focus:outline-none focus:border-eu-brand",
                "transition-colors duration-eu-fast",
              ].join(" ")}
            />

            <div className="flex justify-end gap-eu-sm">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-eu-md py-eu-sm text-eu-sm text-eu-text-mid hover:text-eu-text-hi"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!text.trim()}
                className={[
                  "px-eu-md py-eu-sm rounded-eu-md text-eu-sm font-medium",
                  "bg-eu-brand text-white",
                  "hover:bg-eu-brand-hi disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors duration-eu-fast",
                  "flex items-center gap-1.5",
                ].join(" ")}
              >
                <Send size={14} strokeWidth={2} />
                提交
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
