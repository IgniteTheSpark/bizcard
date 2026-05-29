import { useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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
/**
 * FloatingDock — Mobile-Redesign spec (chat2 decision #2): one global glass
 * pill with Cal / Lib / [Mic hero, center, protruding] / Agent / Plus. The
 * mic is the brand entry (闪念 capture) and breathes a glow. Active tab gets a
 * brand-hi tint + glow + a dot. Hidden in agent/session and behind modals.
 */
export function FloatingDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const [flashOpen, setFlashOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Hide whenever any modal is mounted (the shell already drops the dock on
  // /chat — the agent/session surface — via AppShell's !onChat gate).
  const hidden = useIsAnyModalOpen();

  const active = location.pathname.startsWith("/calendar")
    ? "calendar"
    : location.pathname.startsWith("/library")
      ? "library"
      : location.pathname.startsWith("/chat")
        ? "agent"
        : "";

  return (
    <>
      <div
        aria-label="主要操作"
        aria-hidden={hidden}
        style={{
          position: "fixed",
          left: "50%",
          bottom: "calc(env(safe-area-inset-bottom) + 18px)",
          transform: `translate(-50%, ${hidden ? 110 : 0}px)`,
          opacity: hidden ? 0 : 1,
          transition: "transform var(--eu-dur-slow) var(--eu-ease-in-out), opacity var(--eu-dur-normal) var(--eu-ease-in-out)",
          zIndex: 60,
          pointerEvents: hidden ? "none" : "auto",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 0,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(14,20,38,0.78)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid var(--eu-border-strong)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          <DockBtn label="日历" active={active === "calendar"} onClick={() => navigate("/calendar")} icon={ICON.calendar} />
          <DockBtn label="资产库" active={active === "library"} onClick={() => navigate("/library")} icon={ICON.library} />

          {/* Mic — protruding brand hero (闪念 capture) */}
          <button
            type="button"
            aria-label="闪念输入"
            onClick={() => setFlashOpen(true)}
            className="eu-dock-mic"
            style={{
              width: 54,
              height: 54,
              borderRadius: 999,
              background: "linear-gradient(135deg, #6f9eff 0%, #9c80f0 100%)",
              border: "3px solid rgba(14,20,38,0.85)",
              margin: "0 4px",
              marginTop: -18,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 24px rgba(111,158,255,0.55), inset 0 0 0 1px rgba(255,255,255,0.10)",
              animation: "eu-pulse-glow 2.4s ease-in-out infinite",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="8.5" y="3" width="5" height="11" rx="2.5" fill="#fff" />
              <path d="M5 10v.8a6 6 0 0012 0V10M11 17.5V20" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          <DockBtn label="Agent 对话" active={active === "agent"} onClick={() => navigate("/chat")} icon={ICON.agent} />
          <DockBtn label="快创" active={false} onClick={() => setCreateOpen(true)} icon={ICON.plus} />
        </div>
      </div>

      {flashOpen && (
        <FlashSheet onClose={() => setFlashOpen(false)} />
      )}
      <CreateAssetMenu open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

/* ── Internal pieces ───────────────────────────────────────────────────── */

/** Spec inline SVGs (1.5-1.8 stroke), colored by the passed currentColor. */
const ICON = {
  calendar: (c: string) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="4" width="15" height="13" rx="2.5" stroke={c} strokeWidth="1.6" />
      <path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  library: (c: string) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="6" height="6" rx="1.4" stroke={c} strokeWidth="1.6" />
      <rect x="11" y="3" width="6" height="6" rx="1.4" stroke={c} strokeWidth="1.6" />
      <rect x="3" y="11" width="6" height="6" rx="1.4" stroke={c} strokeWidth="1.6" />
      <rect x="11" y="11" width="6" height="6" rx="1.4" stroke={c} strokeWidth="1.6" />
    </svg>
  ),
  agent: (c: string) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2.5l1.6 4.4 4.4 1.6-4.4 1.6L10 14.5l-1.6-4.4L4 8.5l4.4-1.6L10 2.5z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  plus: (c: string) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

/** DockBtn — 48×48 nav cell, brand-hi + glow + dot when active. */
function DockBtn({
  label, active, onClick, icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: (c: string) => React.ReactNode;
}) {
  const c = active ? "var(--eu-brand-hi)" : "var(--eu-text-mid)";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: 48,
        height: 48,
        borderRadius: 14,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: c,
        position: "relative",
        filter: active ? "drop-shadow(0 0 8px rgba(111,158,255,0.55))" : "none",
        transition: "color var(--eu-dur-fast) var(--eu-ease-in-out)",
      }}
    >
      {icon(c)}
      {active && (
        <span
          style={{
            position: "absolute",
            bottom: 5,
            left: "50%",
            transform: "translateX(-50%)",
            width: 4,
            height: 4,
            borderRadius: 999,
            background: "var(--eu-brand)",
            boxShadow: "var(--eu-brand-glow)",
          }}
        />
      )}
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
      className="fixed inset-0 z-50 bg-eu-bg/92 backdrop-blur-md eu-fade-in"
      onClick={handleClose}
    >
      <div
        className={[
          // VF: bottom sheet only (phone-frame is mobile-shaped).
          "fixed inset-x-0 bottom-0",
          "bg-eu-surface-raised border-t border-eu-border rounded-t-eu-xl",
          "eu-sheet-up",
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

