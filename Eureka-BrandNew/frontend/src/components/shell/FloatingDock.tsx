import { useState } from "react";
import { CalendarDays, Grid3x3, Loader2, Mic, Plus, Send, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { CreateAssetMenu } from "@/components/library/CreateAssetMenu";
import { AssetCardInChat } from "@/components/chat/AssetCardInChat";
import { useFlashCapture } from "@/hooks/useFlashCapture";
import { useIsAnyModalOpen, useModalMount } from "@/context/ModalContext";

/**
 * FloatingDock — global floating action capsule, replaces the old bottom
 * TabBar. Always present (across all pages), floats above content with margin
 * from screen edges.
 *
 * Items, left → right:
 *   1. Today      — calendar icon with today's date → /calendar
 *   2. Library    — grid icon → /library
 *   ──── divider ────
 *   3. Quick create — (+) → CreateAssetMenu popover (M1 wires this up)
 *   4. Flash      — mic → full-screen capture sheet (was FlashFab in M0)
 *   ──── divider ────
 *   5. Agent      — ✨ Agent pill (purple gradient) → /chat
 *
 * Per Phase D spec amendment (2026-05-26): no current-page active state on
 * the dock — TopBar already shows the page title; dock is pure shortcut bar.
 */
export function FloatingDock() {
  const navigate = useNavigate();
  const [flashOpen, setFlashOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Hide the dock whenever any modal is mounted — backdrop-blur + saturated
  // dock items would otherwise bleed through any z-50 backdrop overlay.
  const hidden = useIsAnyModalOpen();

  return (
    <>
      {/* OP1: gradient bottom fade so content scrolling under the dock
          fades into the background instead of clashing with the floating
          icons. Lives above the dock layer-wise but pointer-events:none
          so it doesn't catch taps. */}
      <div
        aria-hidden="true"
        className={[
          "fixed inset-x-0 bottom-0 z-20 pointer-events-none",
          "h-24",
          "transition-opacity duration-eu-fast",
          hidden ? "opacity-0" : "opacity-100",
        ].join(" ")}
        style={{
          background: "linear-gradient(180deg, rgba(6,7,13,0) 0%, rgba(6,7,13,0.6) 55%, rgba(6,7,13,0.92) 100%)",
        }}
      />

      {/* OP1: dock without an opaque capsule container. Each icon is its
          own self-contained chip (subtle bg + blur), so the visual reads
          as "5 floating dots", not "1 bar". The previous design was a
          single capsule with bg-eu-surface-raised/85 which felt heavy. */}
      <nav
        aria-label="主要操作"
        aria-hidden={hidden}
        className={[
          "fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]",
          "left-1/2 -translate-x-1/2 z-30",
          "flex items-center gap-2",
          "transition-all duration-eu-fast ease-eu-out",
          hidden ? "opacity-0 pointer-events-none translate-y-3" : "",
        ].join(" ")}
      >
        <FloatChip ariaLabel="日历" onClick={() => navigate("/calendar")}>
          <CalendarDays size={18} strokeWidth={1.6} />
        </FloatChip>

        <FloatChip ariaLabel="资产库" onClick={() => navigate("/library")}>
          <Grid3x3 size={17} strokeWidth={1.75} />
        </FloatChip>

        <FloatChip ariaLabel="快创" onClick={() => setCreateOpen(true)}>
          <Plus size={19} strokeWidth={2} />
        </FloatChip>

        <FloatChip ariaLabel="闪念输入" onClick={() => setFlashOpen(true)}>
          <Mic size={17} strokeWidth={1.75} />
        </FloatChip>

        {/* Agent — purple gradient pill (kept distinctive, the brand entry) */}
        <button
          type="button"
          aria-label="Agent 对话"
          onClick={() => navigate("/chat")}
          className={[
            "h-10 pl-3 pr-4 rounded-eu-full",
            "bg-gradient-to-br from-eu-accent-purple-solid to-eu-accent-blue-solid",
            "text-white font-medium text-eu-sm",
            "flex items-center gap-1.5",
            "shadow-[0_8px_24px_rgba(111,158,255,0.35),0_0_0_1px_rgba(255,255,255,0.06)]",
            "transition-all duration-eu-fast ease-eu-out",
            "active:scale-95",
          ].join(" ")}
        >
          <Sparkles size={14} strokeWidth={2} />
          Agent
        </button>
      </nav>

      {flashOpen && (
        <FlashSheet onClose={() => setFlashOpen(false)} />
      )}
      <CreateAssetMenu open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

/* ── Internal pieces ───────────────────────────────────────────────────── */

interface FloatChipProps {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}

/**
 * FloatChip — OP5: pure outline ring, no fill. Removed bg + backdrop-blur
 * + shadow that had been creating a visible "chip plate" under each icon.
 * Now the icon hangs in space and only the 1px ring outlines it. The
 * page's bottom gradient handles legibility against scrolling content.
 */
function FloatChip({ ariaLabel, onClick, children }: FloatChipProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        "h-10 w-10 rounded-eu-full",
        "flex items-center justify-center",
        "text-eu-text-mid hover:text-eu-text-hi",
        "bg-transparent",
        "ring-1 ring-white/15 hover:ring-white/30",
        "transition-all duration-eu-fast ease-eu-out",
        "active:scale-90",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ── Flash sheet (was FlashFab) ────────────────────────────────────────── */

function FlashSheet({ onClose }: { onClose: () => void }) {
  useModalMount();
  const [text, setText] = useState("");
  const { capture, submitting, lastResult, error, reset } = useFlashCapture();

  async function submit() {
    if (!text.trim() || submitting) return;
    const result = await capture(text);
    if (result?.ok && !result.error) {
      setText("");
      // Keep sheet open so user sees the reply + cards. Close on tap-out or
      // explicit close. (If they want to flash again, just type.)
    }
  }

  function handleClose() {
    reset();
    setText("");
    onClose();
  }

  const hasResult = lastResult && (lastResult.reply || lastResult.cards.length > 0 || lastResult.summary);

  return (
    <div
      // Heavy backdrop so FloatingDock items don't bleed into the sheet.
      className="fixed inset-0 z-50 bg-eu-bg/92 backdrop-blur-md"
      onClick={handleClose}
    >
      <div
        className={[
          // VF: bottom sheet only (phone-frame is mobile-shaped).
          "fixed inset-x-0 bottom-0",
          "bg-eu-surface-raised border-t border-eu-border rounded-t-eu-xl",
          "p-eu-lg pb-safe flex flex-col gap-eu-md shadow-eu-lg",
          "max-h-[88vh] overflow-y-auto",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-eu-lg text-eu-text-hi">闪念</h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={handleClose}
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
          rows={3}
          disabled={submitting}
          className={[
            "w-full resize-none",
            "bg-eu-surface border border-eu-border rounded-eu-md",
            "p-eu-md text-eu-base text-eu-text",
            "placeholder:text-eu-text-muted",
            "focus:outline-none focus:border-eu-brand",
            "disabled:opacity-50",
            "transition-colors duration-eu-fast",
          ].join(" ")}
        />

        <div className="flex justify-between items-center gap-eu-sm">
          <div className="text-eu-xs text-eu-text-lo font-mono">
            {submitting
              ? "AI 处理中…(约 15-30 秒)"
              : hasResult ? "继续打字开新一条" : "⌘/Ctrl+Enter 也行"}
          </div>
          <div className="flex gap-eu-sm">
            <button
              type="button"
              onClick={handleClose}
              className="px-eu-md py-eu-sm text-eu-sm text-eu-text-mid hover:text-eu-text-hi"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || submitting}
              className={[
                "px-eu-md py-eu-sm rounded-eu-md text-eu-sm font-medium",
                "bg-eu-brand text-white",
                "hover:bg-eu-brand-hi disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors duration-eu-fast flex items-center gap-1.5",
              ].join(" ")}
            >
              {submitting
                ? <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                : <Send size={14} strokeWidth={2} />}
              {submitting ? "处理中" : "提交"}
            </button>
          </div>
        </div>

        {error && !lastResult && (
          <div className="text-eu-sm text-eu-accent-red-fg bg-eu-accent-red-bg border border-eu-accent-red-edge rounded-eu-md px-eu-md py-eu-sm">
            {error}
          </div>
        )}

        {lastResult && (
          <FlashResultPanel result={lastResult} />
        )}
      </div>
    </div>
  );
}

/**
 * FlashResultPanel — shows the backend's reply / summary / cards after a
 * successful flash submit.
 */
function FlashResultPanel({ result }: { result: ReturnType<typeof useFlashCapture>["lastResult"] }) {
  if (!result) return null;
  return (
    <div className="border-t border-eu-rule pt-eu-md flex flex-col gap-eu-sm">
      {result.reply && (
        <div className="text-eu-base text-eu-text whitespace-pre-wrap leading-relaxed">
          {result.reply}
        </div>
      )}
      {result.summary && !result.reply && (
        <div className="text-eu-sm text-eu-text-mid">{result.summary}</div>
      )}
      {result.cards.length > 0 && (
        <div className="flex flex-col gap-eu-sm">
          {result.cards.map((c, i) => (
            <AssetCardInChat
              key={i}
              data={c as unknown as Record<string, unknown>}
            />
          ))}
        </div>
      )}
      {result.error && (
        <div className="text-eu-xs text-eu-accent-red-fg font-mono">
          ⚠ {result.error}
        </div>
      )}
    </div>
  );
}

