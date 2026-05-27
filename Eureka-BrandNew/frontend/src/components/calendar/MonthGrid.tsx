import { useMemo, useState } from "react";

import { useTimeline, toLocalDayKey } from "@/hooks/useTimeline";
import type { TimelineItem } from "@/lib/types";

/**
 * MonthGrid — dot-grid month view + selected-day summary (M3-redo).
 *
 * Implements `rebuild/design-canvas/var-b-calendar.jsx#CalMonth` literally:
 *
 *   ┌──────────────────────────────────────┐
 *   │  ▓▓▓  5月  ← brand-glow 36px title  │
 *   │  ▓▓▓  2026                            │
 *   │  ▓▓▓  ← 3×3 brand pixel logo          │
 *   ├──────────────────────────────────────┤
 *   │   S    M   T   W   T   F   S          │  ← mono caps 0.16em
 *   ├──────────────────────────────────────┤
 *   │  ·    ·   ·   ·   ·   1   2           │  ← 32px round dots
 *   │  3    4   5   6●  7   8   9           │    purple ring + tint  = event
 *   │  10  11  12  13●  14  15○ 16          │    blue   ring + tint  = todo
 *   │  17  18  19  20  21● 22● 23●          │    deeper tint        = mixed
 *   │  24■ 25  [26]● 27●  28  29●  30       │    today: white solid + glow
 *   │  31  ·  ·  ·   ·   ·   ·              │    selected: white 1.5px ring
 *   ├──────────────────────────────────────┤
 *   │  5月 26 日 · 周一                      │  ← selected-day summary
 *   │  2 件事                                 │    (caps brand)
 *   │  10:00 ● 产品评审 · Eureka v2          │    each event row
 *   │  14:00 ● 财务对账                      │
 *   │  + 添加事件                            │
 *   └──────────────────────────────────────┘ │ ║ ← right-edge 3px multi-accent
 *                                            ║   gesture strip
 *
 * No FAB — the global FloatingDock owns the create entry. + 新建 / + 添加
 * 事件 lives inside the selected-day summary panel.
 */

interface MonthGridProps {
  /** The month to display. Selecting a day or shifting month is owned by parent. */
  cursor: Date;
  /** Optional currently-selected day in YYYY-MM-DD (local TZ); defaults to today. */
  selectedKey?: string | null;
  /** Tapping a day cell calls this (parent updates `selectedKey`). */
  onSelectDay?: (dayKey: string) => void;
  /** "+ 添加事件" inside the summary panel. */
  onCreateEvent?: (dayKey: string) => void;
  /** Tap a row inside the selected-day summary → AssetDetailDrawer / EventEditor. */
  onItemTap?: (item: TimelineItem) => void;
}

export function MonthGrid({
  cursor, selectedKey, onSelectDay, onCreateEvent, onItemTap,
}: MonthGridProps) {
  const { byDay } = useTimeline();

  const cells = useMemo(() => buildCells(cursor), [cursor]);
  const todayKey = toLocalDayKey(new Date().toISOString());
  const cursorMonth = cursor.getMonth();

  // Default selection: today if in cursor month, else 1st of cursor month.
  const inCursor = (k: string) => {
    const [y, m] = k.split("-").map(Number);
    return y === cursor.getFullYear() && m - 1 === cursorMonth;
  };
  const [internalSel, setInternalSel] = useState<string>(
    () => (selectedKey && inCursor(selectedKey)) ? selectedKey
        : inCursor(todayKey) ? todayKey
        : firstOfCursorMonth(cursor),
  );
  const selected = selectedKey ?? internalSel;

  function handleSelect(dayKey: string) {
    setInternalSel(dayKey);
    onSelectDay?.(dayKey);
  }

  return (
    <div
      className="relative flex flex-col h-full"
      style={{
        background: "#06070d",
        color: "#d4dbe6",
        fontFamily: '"Manrope","Noto Sans SC", system-ui, sans-serif',
      }}
    >
      {/* ── Title block: brand pixel logo + 5月 + 2026 ─────────────── */}
      <header
        className="flex items-center gap-3.5"
        style={{ padding: "12px 28px 16px" }}
      >
        <BrandPixelLogo />
        <div>
          <div
            className="font-display"
            style={{
              fontSize: 36, fontWeight: 700,
              color: "#a4c2ff", letterSpacing: "0.04em",
              textShadow: "0 0 24px rgba(111,158,255,0.45)",
              lineHeight: 1,
            }}
          >
            {cursor.getMonth() + 1}月
          </div>
          <div
            className="font-mono mt-1"
            style={{
              fontSize: 12, color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.14em",
            }}
          >
            {cursor.getFullYear()}
          </div>
        </div>
      </header>

      {/* ── Weekday header: S M T W T F S ─────────────────────────── */}
      <div
        className="grid mb-2"
        style={{ gridTemplateColumns: "repeat(7, 1fr)", padding: "0 18px" }}
      >
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div
            key={i}
            className="font-mono text-center"
            style={{
              fontSize: 10.5, color: "rgba(255,255,255,0.32)",
              letterSpacing: "0.16em",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Day-dot grid ───────────────────────────────────────────── */}
      <div
        className="grid relative"
        style={{ gridTemplateColumns: "repeat(7, 1fr)", padding: "4px 18px", gap: 4 }}
      >
        {cells.map((c) => {
          const items = byDay.get(c.key) ?? [];
          const kind = dominantKind(items);
          const isToday    = c.key === todayKey;
          const isSelected = c.key === selected;
          const isOut      = !c.inCursor;

          // Colors per canvas dot recipe
          let bg = "transparent", fg = "rgba(255,255,255,0.85)",
              border = "transparent", glow: string | undefined;
          if (isOut)               fg = "rgba(255,255,255,0.18)";
          if (kind === "event") { bg = "rgba(156,128,240,0.28)"; border = "rgba(196,168,255,0.40)"; fg = "#e5d9ff"; }
          if (kind === "todo")  { bg = "rgba(111,158,255,0.20)"; border = "rgba(138,180,255,0.40)"; fg = "#d4e2ff"; }
          if (kind === "mixed") { bg = "rgba(156,128,240,0.32)"; border = "rgba(196,168,255,0.50)"; fg = "#e5d9ff"; }
          if (isToday) {
            bg = "#ffffff"; fg = "#1a1735"; border = "transparent";
            glow = "0 0 20px rgba(255,255,255,0.65)";
          }
          if (isSelected && !isToday) {
            border = "#ffffff"; bg = "rgba(156,128,240,0.20)"; fg = "#ffffff";
          }

          return (
            <button
              key={c.key}
              type="button"
              onClick={() => handleSelect(c.key)}
              className="flex items-center justify-center"
              style={{ padding: "6px 0", background: "transparent", border: "none", cursor: "pointer" }}
            >
              <div
                className="flex items-center justify-center font-mono"
                style={{
                  width: 32, height: 32, borderRadius: 999,
                  background: bg,
                  border: `1.5px solid ${border}`,
                  boxShadow: glow,
                  fontSize: isToday ? 14 : 13,
                  fontWeight: isToday ? 700 : 500,
                  color: fg, letterSpacing: "0.02em",
                  transition: "all 280ms cubic-bezier(.2,.7,.3,1)",
                }}
              >
                {c.d}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Selected-day summary ──────────────────────────────────── */}
      <SelectedDaySummary
        dayKey={selected}
        items={byDay.get(selected) ?? []}
        onCreateEvent={() => onCreateEvent?.(selected)}
        onItemTap={onItemTap}
      />

      {/* ── Right-edge gesture strip (6 accent slices) ─────────────── */}
      <GestureStrip />
    </div>
  );
}

/* ── Brand pixel logo (3×3 grid of bright dots) ─────────────────────── */

function BrandPixelLogo() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "4px 4px 4px",
        gridTemplateRows: "4px 4px 4px",
        gap: 3,
      }}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "#a4c2ff",
            boxShadow: "0 0 4px rgba(164,194,255,0.6)",
          }}
        />
      ))}
    </div>
  );
}

/* ── Selected-day summary panel (below the grid) ────────────────────── */

function SelectedDaySummary({
  dayKey, items, onCreateEvent, onItemTap,
}: {
  dayKey: string;
  items: TimelineItem[];
  onCreateEvent: () => void;
  onItemTap?: (item: TimelineItem) => void;
}) {
  return (
    <div
      className="flex-1 flex flex-col gap-3.5"
      style={{
        padding: "24px 28px 0",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        marginTop: 16,
      }}
    >
      <div className="flex items-baseline gap-2.5">
        <span
          className="font-mono"
          style={{
            fontSize: 10.5, letterSpacing: "0.24em",
            color: "rgba(255,255,255,0.45)", fontWeight: 600,
          }}
        >
          {formatFullDate(dayKey)}
        </span>
      </div>
      <div
        className="font-display"
        style={{
          fontSize: 13.5, color: "#a4c2ff", letterSpacing: "0.04em",
          textTransform: "uppercase", fontWeight: 600,
        }}
      >
        {items.length === 0 ? "空闲" : `${items.length} 件事`}
      </div>
      {items.map((it, i) => (
        <button
          key={`${it.kind}-${it.id}`}
          type="button"
          onClick={() => onItemTap?.(it)}
          className="flex items-center gap-3 text-left"
          style={{
            paddingBottom: 10,
            borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            background: "transparent", border: "none", cursor: "pointer",
          }}
        >
          <span
            className="font-mono"
            style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", minWidth: 40 }}
          >
            {formatTime(it)}
          </span>
          <span
            style={{
              width: 6, height: 6, borderRadius: 999,
              background: dotForKind(subKindOf(it) ?? "neutral"),
              boxShadow: `0 0 6px ${dotForKind(subKindOf(it) ?? "neutral")}`,
            }}
          />
          <span style={{ fontSize: 14, color: "#f4f7fb", fontWeight: 500 }}>
            {it.title}
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onCreateEvent}
        className="font-mono text-left"
        style={{
          fontSize: 12, color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.12em", marginTop: 4,
          background: "transparent", border: "none", cursor: "pointer",
          padding: 0, alignSelf: "flex-start",
        }}
      >
        + 添加事件
      </button>
    </div>
  );
}

/* ── Right-edge gesture strip (6 accent slices) ─────────────────────── */

function GestureStrip() {
  const colors = ["#9c80f0", "#6f9eff", "#86e0a5", "#f5c977", "#ec6a83"];
  return (
    <div
      className="absolute flex flex-col"
      style={{ top: 80, bottom: 80, right: 0, width: 3, gap: 3 }}
    >
      {colors.map((c, i) => (
        <div key={i} style={{ flex: 1, background: c, opacity: 0.7 }} />
      ))}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

interface Cell {
  key: string;
  d: number;
  inCursor: boolean;
}

function buildCells(cursor: Date): Cell[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // back to Sunday on/before 1st
  const out: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({
      key: toLocalDayKey(d.toISOString()),
      d: d.getDate(),
      inCursor: d.getMonth() === cursor.getMonth(),
    });
  }
  return out;
}

function firstOfCursorMonth(cursor: Date): string {
  const d = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  return toLocalDayKey(d.toISOString());
}

/**
 * dominantKind — derives the cell tint kind from a day's items.
 *   event-only  → 'event'    (purple tint)
 *   todo-only   → 'todo'     (blue tint)
 *   event+todo  → 'mixed'    (deeper purple tint)
 *   otherwise   → undefined  (no fill)
 */
function dominantKind(items: TimelineItem[]): "event" | "todo" | "mixed" | undefined {
  const hasEvent = items.some((i) => i.kind === "event");
  const hasTodo  = items.some((i) => i.kind === "asset" && (i.skill_name === "todo" || i.skill_name === "expense"));
  if (hasEvent && hasTodo) return "mixed";
  if (hasEvent)            return "event";
  if (hasTodo)             return "todo";
  return undefined;
}

function subKindOf(it: TimelineItem): string | null {
  if (it.kind === "event") return "event";
  switch (it.skill_name) {
    case "todo": case "idea": case "expense": case "contact":
      return it.skill_name;
    default: return null;
  }
}

const DOT: Record<string, string> = {
  event:   "#c4a8ff",
  todo:    "#8ab4ff",
  idea:    "#f5c977",
  expense: "#86e0a5",
  contact: "#d4dbe6",
  neutral: "rgba(255,255,255,0.55)",
};
function dotForKind(k: string): string { return DOT[k] ?? DOT.neutral; }

function formatTime(it: TimelineItem): string {
  if (it.kind === "event" && it.all_day) return "全天";
  const d = new Date(it.effective_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFullDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = ["周日","周一","周二","周三","周四","周五","周六"][date.getDay()];
  return `${m}月 ${d} 日 · ${weekday}`;
}
