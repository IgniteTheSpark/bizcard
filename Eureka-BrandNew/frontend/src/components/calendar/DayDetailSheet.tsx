import { useMemo } from "react";

import { EventCard } from "@/components/calendar/EventCard";
import { useModalMount } from "@/context/ModalContext";
import { useTimeline } from "@/hooks/useTimeline";
import type { TimelineItem } from "@/lib/types";

/**
 * DayDetailSheet — full-screen colored Day Detail (M3-redo).
 *
 * Implements `rebuild/design-canvas/var-b-calendar.jsx#CalDay`:
 *
 *   ╔══════════════════════════════════════╗  ← full-screen with gradient bg
 *   ║                                      ║    derived from the day's
 *   ║   ‹  周一                         +  ║    DOMINANT accent (purple for
 *   ║      MAY 26                          ║    event-heavy, blue for todo-
 *   ║                                      ║    heavy, mixed for both)
 *   ║   ──── 事件 ────                     ║
 *   ║   ┌──────────────────────────────┐   ║  ← glass card (translucent
 *   ║   │ 10:00 — 11:00          EVENT │   ║    white + backdrop blur),
 *   ║   │ 产品评审 · Eureka v2         │   ║    caps mono group header,
 *   ║   │ 会议室 B · 60 min            │   ║    per-card caps mono kind label
 *   ║   └──────────────────────────────┘   ║
 *   ║   ──── 待办 ────                     ║
 *   ║   ┌──────────────────────────────┐   ║
 *   ║   │ 14:00 截止              TODO │   ║
 *   ║   │ 财务对账                     │   ║
 *   ║   │   ♪ 闪念 · 14:32 →           │   ║  ← source chip (when item has
 *   ║   └──────────────────────────────┘   ║    source_input_turn_id)
 *   ║   ──── 今日捕捉 ────                 ║
 *   ║   ┌──────────────────────────────┐   ║
 *   ║   │  ◇  IDEA                     │   ║  ← mini-icon block + caps label
 *   ║   │  SkillCard 的「沉淀」动画... │   ║
 *   ║   └──────────────────────────────┘   ║
 *   ╚══════════════════════════════════════╝
 *
 * Groups (per design-system §5.5):
 *   - 事件       — items where kind === 'event'
 *   - 待办       — assets where skill_name === 'todo'
 *   - 今日捕捉   — anything time-less that just exists today
 *                 (idea / expense / contact / notes / misc)
 *   - 来源       — files associated with the day (future: from /api/files)
 *
 * No old "+ 在这天新建事件" CTA — that's the top-right "+" instead, matching
 * canvas.
 */

interface DayDetailSheetProps {
  dayKey: string;                              // YYYY-MM-DD local
  onClose: () => void;
  onItemTap: (item: TimelineItem) => void;     // routes to editor or drawer
  onCreateEvent: (dayKey: string) => void;     // top-right + button
}

export function DayDetailSheet({
  dayKey, onClose, onItemTap, onCreateEvent,
}: DayDetailSheetProps) {
  useModalMount();
  const { byDay } = useTimeline();
  const items = byDay.get(dayKey) ?? [];

  // Pick the gradient based on the day's dominant content.
  const gradient = pickGradient(items);

  // Bucket into the 4 design-system groups.
  const groups = useMemo(() => bucket(items), [items]);

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ background: "rgba(6,7,13,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed flex flex-col overflow-hidden text-white"
        style={{
          // Full-screen sheet
          inset: 0,
          background: gradient,
          fontFamily: '"Manrope","Noto Sans SC", system-ui, sans-serif',
        }}
      >
        {/* ── Ambient glows (decorative) ─────────────────────────────── */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: -60, right: -60, width: 280, height: 280, borderRadius: 999,
            background: "radial-gradient(circle, rgba(196,168,255,0.35), transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute"
          style={{
            bottom: -100, left: -80, width: 320, height: 320, borderRadius: 999,
            background: "radial-gradient(circle, rgba(111,158,255,0.20), transparent 70%)",
          }}
        />

        {/* ── Top bar: ‹  date block  + ──────────────────────────────── */}
        <header
          className="relative flex items-center justify-between"
          style={{ padding: "20px 20px 0" }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="返回"
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff", fontSize: 16, cursor: "pointer",
            }}
          >
            ‹
          </button>
          <div className="text-center">
            <div
              className="font-display"
              style={{
                fontSize: 22, fontWeight: 700, letterSpacing: "0.20em",
                color: "#ffffff",
                textShadow: "0 0 24px rgba(255,255,255,0.30)",
              }}
            >
              {weekdayLabel(dayKey)}
            </div>
            <div
              className="font-mono mt-1"
              style={{
                fontSize: 11, color: "rgba(255,255,255,0.65)",
                letterSpacing: "0.18em",
              }}
            >
              {monthDayCaps(dayKey)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCreateEvent(dayKey)}
            aria-label="新建事件"
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff", fontSize: 18, cursor: "pointer",
            }}
          >
            +
          </button>
        </header>

        {/* ── Scrollable groups ─────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto eu-noscroll relative"
          style={{ padding: "24px 20px 32px", display: "flex", flexDirection: "column", gap: 16 }}
        >
          {groups.event.length > 0 && (
            <Group label="事件" items={groups.event} onItemTap={onItemTap} kindLabel="EVENT" />
          )}
          {groups.todo.length > 0 && (
            <Group label="待办" items={groups.todo} onItemTap={onItemTap} kindLabel="TODO" />
          )}
          {groups.captured.length > 0 && (
            <Group label="今日捕捉" items={groups.captured} onItemTap={onItemTap} kindLabel={null} />
          )}
          {items.length === 0 && (
            <div
              style={{
                color: "rgba(255,255,255,0.55)", fontSize: 14,
                fontStyle: "italic", textAlign: "center", marginTop: 48,
              }}
            >
              这一天什么都没有
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Group rendering ──────────────────────────────────────────────────── */

function Group({
  label, items, onItemTap, kindLabel,
}: {
  label: string;
  items: TimelineItem[];
  onItemTap: (it: TimelineItem) => void;
  kindLabel: string | null;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{label}</SectionLabel>
      {items.map((it) => {
        // M4-bugfix-2: events render via the unified EventCard so the
        // visual matches Library and Chat. Todo / captured stay on the
        // bespoke DayCard for now (their unification waits on an asset
        // counterpart; this PR only unifies events).
        if (it.kind === "event") {
          return (
            <EventCard
              key={`${it.kind}-${it.id}`}
              event={{
                event_id: it.event_id ?? it.id,
                title:    it.title,
                start_at: it.effective_at,
                end_at:   it.end_at,
                all_day:  it.all_day,
                location: it.location,
              }}
              onClick={() => onItemTap(it)}
            />
          );
        }
        return (
          <DayCard
            key={`${it.kind}-${it.id}`}
            item={it}
            onClick={() => onItemTap(it)}
            forcedKindLabel={kindLabel}
          />
        );
      })}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono"
      style={{
        fontSize: 10.5, letterSpacing: "0.22em",
        color: "rgba(255,255,255,0.50)", fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function DayCard({
  item, onClick, forcedKindLabel,
}: {
  item: TimelineItem;
  onClick: () => void;
  forcedKindLabel: string | null;
}) {
  const isEvent = item.kind === "event";
  const skill = item.skill_name;
  const kindLabel = forcedKindLabel ?? (
    isEvent ? "EVENT"
    : skill === "todo"    ? "TODO"
    : skill === "idea"    ? "IDEA"
    : skill === "expense" ? "EXPENSE"
    : skill === "contact" ? "CONTACT"
    : skill === "notes"   ? "NOTE"
    : (skill ?? "").toUpperCase() || "ITEM"
  );

  // Captured items get a mini icon block; event/todo get a stronger row.
  const isCaptured = !isEvent && skill && !["todo"].includes(skill);

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left"
      style={{
        padding: "14px 16px", borderRadius: 14,
        background: "rgba(255,255,255,0.10)",
        border: "1px solid rgba(255,255,255,0.18)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.20)",
        color: "#fff", cursor: "pointer",
      }}
    >
      {/* Header row: time / kind label OR mini-icon + caps */}
      {isCaptured ? (
        <div className="flex items-center gap-2.5" style={{ marginBottom: 6 }}>
          <CaptureIcon skill={skill ?? ""} />
          <span
            className="font-mono"
            style={{
              fontSize: 10, color: "rgba(255,255,255,0.50)",
              letterSpacing: "0.16em",
            }}
          >
            {kindLabel}
          </span>
          {skill === "expense" && (
            <span
              className="ml-auto font-mono"
              style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}
            >
              {extractAmount(item)}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
          <span
            className="font-mono"
            style={{
              fontSize: 11, color: "rgba(255,255,255,0.68)",
              letterSpacing: "0.14em",
            }}
          >
            {timeOrDeadline(item)}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 10, color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.16em",
            }}
          >
            {kindLabel}
          </span>
        </div>
      )}

      {/* Title */}
      <div
        style={{
          fontSize: isEvent ? 17 : 16,
          fontWeight: isEvent ? 600 : 500,
          color: "#ffffff", letterSpacing: "-0.005em",
          marginBottom: item.subtitle || item.location ? 4 : 0,
        }}
      >
        {item.title}
      </div>

      {/* Subtitle (for events: location + duration; for assets: subtitle) */}
      {(item.subtitle || item.location) && (
        <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)" }}>
          {isEvent && item.location ? formatEventMeta(item) : item.subtitle}
        </div>
      )}

      {/* Source chip — when there's a source_input_turn_id (came from flash) */}
      {item.source_input_turn_id && (
        <div className="mt-2">
          <SourceChip />
        </div>
      )}
    </button>
  );
}

function CaptureIcon({ skill }: { skill: string }) {
  const map: Record<string, { glyph: string; fg: string; bg: string; border: string }> = {
    idea:    { glyph: "◇", fg: "#f5c977", bg: "rgba(245,201,119,0.16)", border: "rgba(245,201,119,0.30)" },
    expense: { glyph: "¥", fg: "#86e0a5", bg: "rgba(134,224,165,0.16)", border: "rgba(134,224,165,0.30)" },
    contact: { glyph: "·", fg: "#d4dbe6", bg: "rgba(212,219,230,0.10)", border: "rgba(212,219,230,0.22)" },
    notes:   { glyph: "≡", fg: "#a4c2ff", bg: "rgba(111,158,255,0.14)", border: "rgba(111,158,255,0.26)" },
  };
  const s = map[skill] ?? { glyph: "·", fg: "#9aa6b8", bg: "rgba(154,166,184,0.10)", border: "rgba(154,166,184,0.22)" };
  return (
    <span
      className="font-mono inline-flex items-center justify-center"
      style={{
        width: 22, height: 22, borderRadius: 6,
        background: s.bg, border: `1px solid ${s.border}`,
        color: s.fg, fontSize: 12,
      }}
    >
      {s.glyph}
    </span>
  );
}

function SourceChip({ label = "闪念" }: { label?: string }) {
  return (
    <div
      className="inline-flex items-center font-mono"
      style={{
        gap: 5,
        padding: "3px 8px 3px 7px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.22)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.62)",
        fontSize: 10, letterSpacing: "0.06em",
      }}
    >
      <span style={{ color: "rgba(164,194,255,0.85)" }}>♪</span>
      <span>{label}</span>
      <span style={{ color: "rgba(255,255,255,0.45)" }}>→</span>
    </div>
  );
}

/* ── Bucketing ────────────────────────────────────────────────────────── */

function bucket(items: TimelineItem[]) {
  const event:    TimelineItem[] = [];
  const todo:     TimelineItem[] = [];
  const captured: TimelineItem[] = [];
  for (const it of items) {
    if (it.kind === "event")               event.push(it);
    else if (it.skill_name === "todo")      todo.push(it);
    else                                    captured.push(it);
  }
  return { event, todo, captured };
}

/* ── Background-gradient picker (mirrors canvas hardcoded gradient) ───── */

function pickGradient(items: TimelineItem[]): string {
  const hasEvent = items.some((i) => i.kind === "event");
  const hasTodo  = items.some((i) => i.kind === "asset" && i.skill_name === "todo");
  const hasIdea  = items.some((i) => i.kind === "asset" && i.skill_name === "idea");
  if (hasEvent && hasTodo) return "linear-gradient(180deg, #3d2f7a 0%, #2a2655 100%)";
  if (hasEvent)            return "linear-gradient(180deg, #3d2f7a 0%, #2a1f5a 100%)";
  if (hasTodo)             return "linear-gradient(180deg, #1f3a7a 0%, #131f48 100%)";
  if (hasIdea)             return "linear-gradient(180deg, #3a2f1a 0%, #1f1a10 100%)";
  return "linear-gradient(180deg, #1a1d28 0%, #0e1018 100%)";
}

/* ── Item formatters ───────────────────────────────────────────────────── */

function timeOrDeadline(it: TimelineItem): string {
  if (it.kind === "event") {
    if (it.all_day) return "全天";
    const start = formatHourMinute(it.effective_at);
    if (it.end_at) {
      const end = formatHourMinute(it.end_at);
      return `${start} — ${end}`;
    }
    return start;
  }
  // todo etc.
  if (it.skill_name === "todo") {
    return `${formatHourMinute(it.effective_at)} 截止`;
  }
  return formatHourMinute(it.effective_at);
}

function formatHourMinute(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatEventMeta(it: TimelineItem): string {
  const parts: string[] = [];
  if (it.location) parts.push(it.location);
  if (it.end_at) {
    const startMs = +new Date(it.effective_at);
    const endMs   = +new Date(it.end_at);
    const mins    = Math.max(0, Math.round((endMs - startMs) / 60000));
    if (mins > 0) parts.push(`${mins} min`);
  }
  return parts.join(" · ");
}

function extractAmount(it: TimelineItem): string {
  const amount = (it.payload as { amount?: number } | undefined)?.amount;
  if (typeof amount === "number") return `¥ ${amount}`;
  return "";
}

function weekdayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return ["周日","周一","周二","周三","周四","周五","周六"][new Date(y, m - 1, d).getDay()];
}

function monthDayCaps(dayKey: string): string {
  const [, m, d] = dayKey.split("-").map(Number);
  const monthsEn = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${monthsEn[m - 1]} ${d}`;
}
