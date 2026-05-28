import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { ExternalLink, History, MessageCircle, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { EventForm } from "@/components/calendar/EventForm";
import { GenericField } from "@/components/skill/GenericField";
import { SkillCreateForm } from "@/components/skill/SkillCreateForm";
import { useModalMount } from "@/context/ModalContext";
import { useEvents } from "@/hooks/useEvents";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { openSession, type SubjectType } from "@/hooks/useSessions";
import { apiFetch } from "@/lib/api";
import type { CardData, FieldFormat } from "@/lib/render-spec";
import type { Asset } from "@/lib/types";

/**
 * AssetDetailDrawer — read-only detail + actions (M2.2).
 *
 * Mobile: bottom sheet (~85vh max). Desktop: right-side drawer 480px wide.
 *
 * Actions (M2.2):
 *   - 「在 chat 里讨论」 → creates a NEW chat session with this asset attached
 *     as context_asset_ids[0], navigates to /chat. Agent will see it in the
 *     prompt as「本 session 携带的上下文资产」.
 *   - 「跳到创建该 asset 的 session」 → navigates to /chat with the asset's
 *     existing session_id (if any), letting the user see the conversation
 *     that produced this asset.
 */

interface AssetDetailDrawerProps {
  card: CardData;
  payload: Record<string, unknown>;
  onClose: () => void;
  /** Asset's session_id (creator session) — for the source-trace button */
  sourceSessionId?: string | null;
}

export function AssetDetailDrawer({ card, payload, onClose, sourceSessionId }: AssetDetailDrawerProps) {
  useModalMount();
  const navigate = useNavigate();
  const location = useLocation();
  const { mutate } = useSWRConfig();
  const { bySkill } = useSkillRegistry();
  const { events } = useEvents();
  const [discussLoading, setDiscussLoading] = useState(false);

  // RV3: edit + delete state.
  // - editing: which inner form is open (event / asset / null)
  // - confirmDel: double-click delete pattern (same as EventForm)
  // - busy: prevents re-clicks during the delete API call
  const [editing,    setEditing]    = useState<"event" | "asset" | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy,       setBusy]       = useState(false);

  // Esc to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Look up the matching skill + event row (for the edit branch).
  const isEvent  = card.cardType === "event";
  const isContact = card.cardType === "contact";
  const skill    = bySkill.get(card.cardType);
  const eventRow = isEvent
    ? events.find((e) => e.event_id === card.assetId)
    : undefined;
  // Edit/delete only make sense when we have an id AND know how to act
  // on it. Contact-edit is not built (would need a Contact-form) so it's
  // disabled for now.
  const editable   = !!card.assetId && (isEvent ? !!eventRow : (!!skill && !isContact));
  const deletable  = !!card.assetId && !isContact;

  async function handleDelete() {
    if (!card.assetId || busy) return;
    setBusy(true);
    try {
      const url = isEvent
        ? `/api/events/${card.assetId}`
        : `/api/assets/${card.assetId}`;
      const resp = await apiFetch<{ ok: boolean; error?: string }>(
        url, { method: "DELETE" },
      );
      if (!resp.ok) throw new Error(resp.error ?? "删除失败");
      await mutate((key) => typeof key === "string" && (
        key.startsWith("/api/assets") ||
        key.startsWith("/api/events")  ||
        key.startsWith("/api/timeline")
      ));
      onClose();
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert((e as Error).message ?? "删除失败");
      setBusy(false);
      setConfirmDel(false);
    }
  }

  function handleEdit() {
    setEditing(isEvent ? "event" : "asset");
  }

  // Build the Asset-shaped object the SkillCreateForm needs for prefill.
  // We have payload + assetId + cardType so this is straightforward.
  const assetForEdit: Asset | null = card.assetId && !isEvent ? {
    id: card.assetId,
    user_skill_name: card.cardType,
    payload: payload,
    session_id: sourceSessionId ?? null,
    source_input_turn_id: null,
    created_at: "",
  } : null;

  /**
   * 在 chat 里讨论 — M2.3 home-session pattern.
   *
   * Each asset / first-class entity has ONE chat session anchored to it. We
   * map card.cardType to the right subject_type:
   *   contact → "contact" (uses contacts.id)
   *   event   → "event"   (uses events.id)
   *   file    → "file"    (uses files.id)
   *   any other (todo / idea / notes / misc / expense) → "asset"
   *
   * Repeated clicks return the same session — no fragmentation.
   */
  async function openDiscuss() {
    if (!card.assetId || discussLoading) return;
    setDiscussLoading(true);
    try {
      const subjectType: SubjectType =
          card.cardType === "contact" ? "contact"
        : card.cardType === "event"   ? "event"
        : card.cardType === "file"    ? "file"
        : "asset";
      const { sessionId } = await openSession({
        subject: { type: subjectType, id: card.assetId },
      });
      window.localStorage.setItem("eureka:active_chat_session", sessionId);
      onClose();
      // Pass `from` so ChatPage's back button can return here cleanly. We
      // also send a short label derived from the subject so the back button
      // renders 「← Kevin」 instead of just 「← 资产库」.
      navigate("/chat", {
        state: { from: location.pathname, fromLabel: card.title || "上一页" },
      });
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert("打开对话失败:" + ((e as Error).message ?? "未知错误"));
    } finally {
      setDiscussLoading(false);
    }
  }

  /** 跳到创建该 asset 的 session — opens chat with the existing creator session. */
  function openSourceSession() {
    if (!sourceSessionId) return;
    window.localStorage.setItem("eureka:active_chat_session", sourceSessionId);
    onClose();
    navigate("/chat", {
      state: { from: location.pathname, fromLabel: card.title || "上一页" },
    });
  }

  // RV3: when an edit form is open, hand off to it entirely (the form is
  // a fullscreen modal on its own). Closing it just clears the editing
  // state — the parent drawer stays mounted underneath so the user lands
  // back on the detail view, where SWR cache invalidation already
  // refreshed the displayed payload.
  if (editing === "event" && eventRow) {
    return <EventForm existing={eventRow} onClose={() => setEditing(null)} />;
  }
  if (editing === "asset" && assetForEdit && skill) {
    return (
      <SkillCreateForm
        skill={skill}
        existing={assetForEdit}
        onClose={() => setEditing(null)}
      />
    );
  }

  return (
    <div
      // Heavy backdrop so the FloatingDock fades behind the drawer cleanly
      className="fixed inset-0 z-50 bg-eu-bg/92 backdrop-blur-md"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className={[
          // VF: phone-frame is always mobile-shaped, so bottom sheet only —
          // killed the old md: right-drawer override which used to width
          // 480px (escapes the 393px frame).
          "fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-eu-xl",
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

        {/* Action row */}
        <div className="px-eu-lg flex flex-wrap gap-eu-sm">
          <ActionButton
            icon={discussLoading
              ? <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              : <MessageCircle size={14} strokeWidth={1.75} />}
            label={discussLoading ? "创建中…" : "在 chat 里讨论"}
            onClick={openDiscuss}
            disabled={!card.assetId || discussLoading}
            variant="primary"
          />
          {editable && (
            <ActionButton
              icon={<Pencil size={14} strokeWidth={1.75} />}
              label="编辑"
              onClick={handleEdit}
            />
          )}
          {deletable && (
            <button
              type="button"
              onClick={() => (confirmDel ? handleDelete() : setConfirmDel(true))}
              disabled={busy}
              className={[
                "px-eu-md py-1.5 rounded-eu-md text-eu-sm inline-flex items-center gap-1.5",
                "transition-all duration-eu-fast",
                confirmDel
                  ? "bg-eu-accent-red-bg text-eu-accent-red-fg border border-eu-accent-red-edge"
                  : "text-eu-accent-red-fg hover:bg-eu-accent-red-bg border border-transparent",
                "disabled:opacity-50",
              ].join(" ")}
            >
              {busy
                ? <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                : <Trash2 size={14} strokeWidth={1.75} />}
              {confirmDel ? "确认删除" : "删除"}
            </button>
          )}
          {sourceSessionId && (
            <ActionButton
              icon={<History size={14} strokeWidth={1.75} />}
              label="跳到创建对话"
              onClick={openSourceSession}
            />
          )}
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
  "ok",                  // RV3: tool_result envelope flag, never user-facing
  "card_type",           // RV3: synthesized by extractCardFromToolResult
  "kind",                // timeline kind discriminator
  "skill_name",          // duplicate of cardType caps
  "user_skill_name",     // ditto
  "user_id",             // implementation detail
  "all_day",             // RV3: shown via the time-range formatting in the header
  "status",              // mostly always "scheduled" — noise
  "task_id",             // internal — not user-facing
  "external_id",         // shown via the link button
  "external_url",        // shown via the link button
  "external_system",     // shown via the link button styling
  "external_type",       // not interesting on the detail page
  "event_id",            // shown in header context
  "asset_id",            // duplicate of context
  "id",                  // ditto (event row uses `id` too sometimes)
  "contact_id",          // ditto
  "file_id",             // ditto
  "source_input_turn_id", // M4 surfaces as SessionTurnCard
  "session_id",          // M4 surfaces via "在 chat 里讨论" routing
  "sync_source",         // implementation detail
  "sync_external_id",    // implementation detail
  "recurrence_rule",     // shown elsewhere when UI for it exists (post-MVP)
  "updated_at",          // not interesting except for audit
  "user_skill_id",       // implementation detail
  "logId",               // some MCP responses include this trace id
  "trace_id",            // same
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
  icon, label, onClick, disabled, variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary";
}) {
  const primary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-eu-md py-1.5 rounded-eu-md text-eu-sm inline-flex items-center gap-1.5",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-all duration-eu-fast",
        primary
          ? "bg-eu-brand text-white hover:bg-eu-brand-hi"
          : "bg-eu-surface border border-eu-border text-eu-text-mid hover:bg-eu-surface-hover hover:text-eu-text-hi",
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
