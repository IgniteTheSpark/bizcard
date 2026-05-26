import { useState } from "react";
import { Calendar, Grid3x3, Loader2, Mic, Plus, Send, Sparkles, X } from "lucide-react";
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
  const today = new Date().getDate();
  // Hide the dock whenever any modal is mounted — backdrop-blur + saturated
  // dock items would otherwise bleed through any z-50 backdrop overlay.
  const hidden = useIsAnyModalOpen();

  return (
    <>
      {/* Capsule — fixed bottom, centered, with safe-area + margin from edge */}
      <nav
        aria-label="主要操作"
        aria-hidden={hidden}
        className={[
          "fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)]",
          "left-1/2 -translate-x-1/2 z-30",
          "flex items-center gap-1",
          "h-14 px-2 rounded-eu-full",
          "bg-eu-surface-raised/85 backdrop-blur-md",
          "border border-eu-border shadow-eu-lg",
          "transition-all duration-eu-fast ease-eu-out",
          hidden ? "opacity-0 pointer-events-none translate-y-3" : "",
        ].join(" ")}
      >
        <DockIcon ariaLabel="今天" onClick={() => navigate("/calendar")}>
          {/* Calendar icon with today's date as a small overlay tag —
              styled like an iOS app icon's day-of-month badge. */}
          <span className="relative inline-flex items-center justify-center">
            <Calendar size={20} strokeWidth={1.6} className="text-eu-accent-red-fg" />
            <span
              className={[
                "absolute -bottom-0.5 -right-1.5",
                "min-w-[14px] h-[14px] px-0.5",
                "rounded-eu-sm",
                "bg-eu-accent-red-solid text-white",
                "text-[9px] font-semibold leading-none",
                "flex items-center justify-center",
                "border border-eu-surface-raised",
              ].join(" ")}
            >
              {today}
            </span>
          </span>
        </DockIcon>

        <DockIcon ariaLabel="资产库" onClick={() => navigate("/library")}>
          <Grid3x3 size={18} strokeWidth={1.75} />
        </DockIcon>

        <Divider />

        <DockIcon ariaLabel="快创" onClick={() => setCreateOpen(true)}>
          <Plus size={20} strokeWidth={2} />
        </DockIcon>

        <DockIcon ariaLabel="闪念输入" onClick={() => setFlashOpen(true)}>
          <Mic size={18} strokeWidth={1.75} />
        </DockIcon>

        <Divider />

        {/* Agent — purple gradient pill */}
        <button
          type="button"
          aria-label="Agent 对话"
          onClick={() => navigate("/chat")}
          className={[
            "h-10 pl-3 pr-4 ml-0.5 rounded-eu-full",
            "bg-gradient-to-br from-eu-accent-purple-solid to-eu-accent-blue-solid",
            "text-white font-medium text-eu-sm",
            "flex items-center gap-1.5",
            "shadow-eu-sm hover:shadow-eu-md",
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

interface DockIconProps {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
  accentClass?: string;
}

function DockIcon({ ariaLabel, onClick, children, accentClass = "" }: DockIconProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        "h-10 w-10 rounded-eu-full",
        "flex items-center justify-center",
        "transition-all duration-eu-fast ease-eu-out",
        "active:scale-90",
        accentClass
          ? `${accentClass} hover:brightness-110`
          : "text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div aria-hidden="true" className="h-6 w-px bg-eu-rule mx-0.5" />;
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
          "fixed inset-x-0 bottom-0 md:inset-auto",
          "md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[520px]",
          "bg-eu-surface-raised border-t border-eu-border md:border md:rounded-eu-xl",
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

