import { useEffect } from "react";
import { ExternalLink, MessageCircle, X } from "lucide-react";

import { GenericField } from "@/components/skill/GenericField";
import type { CardData, FieldFormat } from "@/lib/render-spec";

/**
 * AssetDetailDrawer — M1 read-only edition.
 *
 * Mobile: bottom sheet, slides up to ~80vh, can drag down to dismiss
 * (M1 placeholder: just an Esc/backdrop close).
 * Desktop: right-side drawer 480px wide.
 *
 * M4 will add edit / delete, SessionTurnCard (来源 session),
 * 「在 chat 里继续讨论」按钮 with per-entity session routing.
 */

interface AssetDetailDrawerProps {
  card: CardData;
  payload: Record<string, unknown>;
  onClose: () => void;
}

export function AssetDetailDrawer({ card, payload, onClose }: AssetDetailDrawerProps) {
  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      // Heavy backdrop so the FloatingDock fades behind the drawer cleanly
      className="fixed inset-0 z-50 bg-eu-bg/92 backdrop-blur-md"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className={[
          // Mobile: bottom sheet
          "fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-eu-xl",
          // Desktop: right drawer
          "md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[480px] md:rounded-none md:border-l",
          "bg-eu-surface-raised border-t border-eu-border",
          "shadow-eu-lg pt-eu-md pb-safe overflow-y-auto",
          "flex flex-col gap-eu-md",
        ].join(" ")}
      >
        {/* drag handle (mobile only) */}
        <div className="md:hidden h-1 w-12 rounded-full bg-eu-rule mx-auto" />

        <header className="flex items-start gap-eu-md px-eu-lg">
          <div className={[
            "shrink-0 h-10 w-10 rounded-eu-md border",
            "flex items-center justify-center font-mono font-semibold text-eu-lg",
            ACCENT_BG[card.accentColor],
            ACCENT_FG[card.accentColor],
            ACCENT_BORDER[card.accentColor],
          ].join(" ")}>
            {card.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">
              {card.cardType}
            </div>
            <h2 className="text-eu-lg text-eu-text-hi font-medium tracking-tight mt-0.5 break-words">
              {card.title}
            </h2>
            {card.subtitle && (
              <div className="text-eu-sm text-eu-text-mid mt-1">{card.subtitle}</div>
            )}
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-eu-sm text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>

        {/* Action row (M4 wires real handlers) */}
        <div className="px-eu-lg flex flex-wrap gap-eu-sm">
          <ActionButton icon={<MessageCircle size={14} strokeWidth={1.75} />} label="在 chat 里讨论" disabled />
          {externalUrl(payload) && (
            <a
              href={externalUrl(payload) ?? "#"}
              target="_blank"
              rel="noopener"
              className={[
                "px-eu-md py-1.5 rounded-eu-md text-eu-sm",
                "bg-eu-accent-purple-bg text-eu-accent-purple-fg border border-eu-accent-purple-edge",
                "hover:brightness-110 inline-flex items-center gap-1.5",
                "transition-all duration-eu-fast",
              ].join(" ")}
            >
              <ExternalLink size={14} strokeWidth={1.75} />
              打开外部链接
            </a>
          )}
        </div>

        <div className="px-eu-lg border-t border-eu-rule pt-eu-md flex flex-col gap-eu-md">
          {/* Payload fields */}
          {Object.entries(payload).map(([key, value]) => {
            if (shouldSkipField(key, value)) return null;
            // Arrays get a custom string-list renderer (attendees etc.)
            if (Array.isArray(value)) {
              return <ArrayField key={key} label={key} items={value} />;
            }
            return (
              <GenericField
                key={key}
                label={key}
                value={value}
                format={inferFormat(key, value)}
                multiline={MULTILINE_KEYS.has(key)}
              />
            );
          })}
        </div>
      </aside>
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

// Fields that are internal plumbing — never useful to show
const SKIP_KEYS = new Set([
  "task_id",            // internal — not user-facing
  "external_id",        // shown via the link button
  "external_url",       // shown via the link button
  "external_system",    // shown via the link button styling
  "external_type",      // not interesting on the detail page
  "event_id",           // shown in header context
  "asset_id",           // duplicate of context
  "contact_id",         // ditto
  "file_id",            // ditto
  "source_input_turn_id", // M4 surfaces as SessionTurnCard
  "session_id",         // M4 surfaces via "在 chat 里讨论" routing
  "sync_source",        // implementation detail
  "sync_external_id",   // implementation detail
  "recurrence_rule",    // shown elsewhere when UI for it exists (post-MVP)
  "updated_at",         // not interesting except for audit
  "user_skill_id",      // implementation detail
  "logId",              // some MCP responses include this trace id
  "trace_id",           // same
]);

/** Heuristic: should this field be hidden from the drawer? */
function shouldSkipField(key: string, value: unknown): boolean {
  if (SKIP_KEYS.has(key)) return true;
  // Empty containers contribute no information
  if (value == null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return true;
  return false;
}

/** Render array fields specially — strings as a chip list, objects as
 *  "name (role)" or just JSON-stringified primitives. */
function ArrayField({ label, items }: { label: string; items: unknown[] }) {
  // Pull a sensible label out of each item
  const display = items.map((it) => {
    if (it == null) return "—";
    if (typeof it === "string" || typeof it === "number") return String(it);
    if (typeof it === "object") {
      const o = it as Record<string, unknown>;
      const name = o.name ?? o.title ?? o.display_name;
      const role = o.role;
      if (name && role) return `${name} (${role})`;
      if (name) return String(name);
      return JSON.stringify(o).slice(0, 80);
    }
    return String(it);
  });
  return (
    <div className="flex flex-col gap-1">
      <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {display.map((d, i) => (
          <span
            key={`${label}-${i}`}
            className="px-2 py-0.5 rounded-eu-sm bg-eu-surface border border-eu-border text-eu-sm text-eu-text"
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

const MULTILINE_KEYS = new Set([
  "content", "description", "summary", "notes", "markdown", "body", "asr_text",
]);

function inferFormat(key: string, value: unknown): FieldFormat | undefined {
  if (typeof value !== "string") return undefined;
  if (key === "amount" || key === "price")  return "currency";
  if (key.endsWith("_date") || key.endsWith("_at")) return "relative_date";
  if (key === "date")                       return "absolute_date";
  if (key === "duration_sec")               return undefined;
  return undefined;
}

function externalUrl(payload: Record<string, unknown>): string | null {
  const v = payload.external_url;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function ActionButton({
  icon, label, disabled,
}: { icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? "M4 接入" : undefined}
      className={[
        "px-eu-md py-1.5 rounded-eu-md text-eu-sm inline-flex items-center gap-1.5",
        "bg-eu-surface border border-eu-border text-eu-text-mid",
        "hover:bg-eu-surface-hover hover:text-eu-text-hi",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-all duration-eu-fast",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

// Per-accent class maps so Tailwind's purge keeps them
const ACCENT_BG: Record<string, string> = {
  blue: "bg-eu-accent-blue-bg",       amber:  "bg-eu-accent-amber-bg",
  green: "bg-eu-accent-green-bg",     red:    "bg-eu-accent-red-bg",
  purple: "bg-eu-accent-purple-bg",   gray:   "bg-eu-accent-gray-bg",
  neutral: "bg-eu-accent-neutral-bg",
};
const ACCENT_FG: Record<string, string> = {
  blue: "text-eu-accent-blue-fg",     amber:  "text-eu-accent-amber-fg",
  green: "text-eu-accent-green-fg",   red:    "text-eu-accent-red-fg",
  purple: "text-eu-accent-purple-fg", gray:   "text-eu-accent-gray-fg",
  neutral: "text-eu-accent-neutral-fg",
};
const ACCENT_BORDER: Record<string, string> = {
  blue: "border-eu-accent-blue-edge",     amber:  "border-eu-accent-amber-edge",
  green: "border-eu-accent-green-edge",   red:    "border-eu-accent-red-edge",
  purple: "border-eu-accent-purple-edge", gray:   "border-eu-accent-gray-edge",
  neutral: "border-eu-accent-neutral-edge",
};
