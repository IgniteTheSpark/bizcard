import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { useTimeline, toLocalDayKey } from "@/hooks/useTimeline";
import type { TimelineItem } from "@/lib/types";

/**
 * ScheduleView — colored day-tile vertical timeline (M3-redo).
 *
 * Implements `rebuild/design-canvas/var-b-calendar.jsx#CalSchedule` literally:
 *
 *   ┌──────────────────────────────────────────┐
 *   │ 5月  2026                       ⌕  ⋮     │  month + tools
 *   ├──────────────────────────────────────────┤
 *   │ [● 全部 52][● 事件 8][● 待办 14]...      │  type-filter chips (replaces
 *   ├──────────┬───────────────────────────────┤  the standalone 时间流 page)
 *   │   THU    │  ┌─────────────────────────┐  │
 *   │    22    │  │ 14:00 ● 设计评审       │  │  ← colored day tile;
 *   │          │  └─────────────────────────┘  │    background COMPUTED from
 *   │   FRI    │  ┌─────────────────────────┐  │    that day's dominant accent
 *   │    23    │  │ 11:00 ● 一对一 · Lin   │  │    (purple=event, blue=todo,
 *   │          │  │ all-day ● 体检报告寄到 │  │    mixed=purple+blue, amber=
 *   │          │  └─────────────────────────┘  │    idea, dark=empty)
 *   │   SAT    │  ┌──────────── TODAY ──────┐  │
 *   │   24*    │  │ 12:30 ● 团队午餐       │  │  ← today: brand vertical
 *   │          │  │ 15:00 ● 准备 demo 脚本 │  │    rail accent + glow on
 *   │          │  └─────────────────────────┘  │    date number
 *   │   SUN    │  ┌──────── TOMORROW ───────┐  │
 *   │   25     │  │   空闲                   │  │  ← empty day: 50px tile +
 *   │          │  └─────────────────────────┘  │    italic 空闲
 *   └──────────┴───────────────────────────────┘
 *
 * Numbers (time / counts / weekday caps) all run JetBrains Mono with
 * 0.16-0.22em letter-spacing per design-system §3.3.
 *
 * Bucketing window: from earliest item back to ~14 days before today, then
 * forward to ~21 days after — enough for the user to see both context and
 * upcoming agenda. Empty days inside that window still render as 空闲 tiles.
 */

interface ScheduleViewProps {
  /** Item taps route up to the parent — events open editor, assets open drawer. */
  onItemTap: (item: TimelineItem) => void;
  /** Day-tile tap (whole tile, not item row) → DayDetailSheet. */
  onDayTap?: (dayKey: string) => void;
}

type FilterKey = "all" | "event" | "todo" | "idea" | "expense" | "contact";

/**
 * Show-empty toggle persisted in localStorage so the user's preference
 * survives reloads (the alternative — re-flooding the rail with grey
 * tiles on every visit — feels broken when data is sparse).
 */
const EMPTY_PREF_KEY = "eureka:schedule_show_empty";

const FILTERS: Array<{ key: FilterKey; label: string; dot?: string }> = [
  { key: "all",      label: "全部" },
  { key: "event",    label: "事件",   dot: "#c4a8ff" },  // accent.purple lighter (per canvas)
  { key: "todo",     label: "待办",   dot: "#8ab4ff" },  // accent.blue lighter
  { key: "idea",     label: "想法",   dot: "#f5c977" },  // accent.amber lighter
  { key: "expense",  label: "记账",   dot: "#86e0a5" },  // accent.green lighter
  { key: "contact",  label: "名片",   dot: "#d4dbe6" },  // accent.neutral
];

export function ScheduleView({ onItemTap, onDayTap }: ScheduleViewProps) {
  const { items, isLoading } = useTimeline();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showEmpty, setShowEmpty] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(EMPTY_PREF_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(EMPTY_PREF_KEY, showEmpty ? "1" : "0");
  }, [showEmpty]);

  // ── Compute per-filter counts (for the chip labels) ──────────────────────
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: 0, event: 0, todo: 0, idea: 0, expense: 0, contact: 0,
    };
    for (const it of items) {
      c.all += 1;
      const k = subKindOf(it);
      if (k && k in c) (c as Record<string, number>)[k] += 1;
    }
    return c;
  }, [items]);

  // ── Apply filter ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => subKindOf(it) === filter);
  }, [items, filter]);

  // ── Build day buckets across the visible window ──────────────────────────
  // Window: -14d ... earliest item ... +21d from today.
  const fullDayWindow = useMemo(() => buildDayWindow(items), [items]);
  const byDay = useMemo(() => {
    const m = new Map<string, TimelineItem[]>();
    for (const it of filtered) {
      const k = toLocalDayKey(it.effective_at);
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.effective_at.localeCompare(b.effective_at));
    }
    return m;
  }, [filtered]);

  const todayKey    = toLocalDayKey(new Date().toISOString());
  const tomorrowKey = toLocalDayKey(addDays(new Date(), 1).toISOString());

  // Compact mode (default): show only days with content + today + tomorrow.
  // When a stretch of empty days exists between two visible days, we render
  // ONE collapsible separator "N 天空闲" instead of N grey tiles.
  // Full mode: render every day in the window (the original canvas behavior).
  const visibleRows = useMemo<RailRow[]>(
    () => buildRows(fullDayWindow, byDay, todayKey, tomorrowKey, showEmpty),
    [fullDayWindow, byDay, todayKey, tomorrowKey, showEmpty],
  );

  // Auto-scroll to today on mount so user lands on "now" instead of the
  // window's start. data-day-key marker is on each row.
  const tilesRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = tilesRef.current?.querySelector<HTMLElement>(`[data-day-key="${todayKey}"]`);
    if (el && el.parentElement) {
      // Center today in the visible scroll area
      el.scrollIntoView({ block: "center", behavior: "auto" });
    }
    // Run only on first mount + when visibleRows length changes (not item taps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows.length]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#06070d" }}>
      {/* ── Top header: month + tools ─────────────────────────────────── */}
      <header className="flex items-center justify-between px-eu-md pt-1 pb-2.5">
        <div className="flex items-baseline gap-2">
          <span
            className="font-display font-bold"
            style={{
              fontSize: 20, color: "#a4c2ff", letterSpacing: "-0.01em",
              textShadow: "0 0 14px rgba(111,158,255,0.4)",
            }}
          >
            {currentMonthLabel()}
          </span>
          <span
            className="font-mono"
            style={{
              fontSize: 11, color: "rgba(255,255,255,0.40)", letterSpacing: "0.14em",
            }}
          >
            {new Date().getFullYear()}
          </span>
        </div>
        <div className="flex gap-2 items-center">
          {/* M4-polish: 「显示空闲」toggle — default off so sparse calendars
              don't look empty. Persisted in localStorage. */}
          <button
            type="button"
            onClick={() => setShowEmpty((v) => !v)}
            className="font-mono"
            style={{
              padding: "4px 10px", borderRadius: 999,
              fontSize: 10.5, letterSpacing: "0.16em",
              background: showEmpty ? "rgba(111,158,255,0.14)" : "rgba(255,255,255,0.03)",
              color: showEmpty ? "#a4c2ff" : "rgba(255,255,255,0.55)",
              border: `1px solid ${showEmpty ? "rgba(111,158,255,0.32)" : "rgba(255,255,255,0.08)"}`,
              cursor: "pointer",
            }}
            title={showEmpty ? "隐藏空闲日" : "显示空闲日"}
          >
            {showEmpty ? "全部" : "仅有事"}
          </button>
          <IconChip glyph="⌕" />
          <IconChip glyph="⋮" />
        </div>
      </header>

      {/* ── Type-filter chips (absorbs 时间流 — design-system §5.2) ─────── */}
      <div
        className="flex gap-1.5 px-eu-md pb-3 overflow-x-auto"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap"
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                background: active ? "rgba(111,158,255,0.14)" : "rgba(255,255,255,0.03)",
                color: active ? "#a4c2ff" : "rgba(255,255,255,0.62)",
                border: `1px solid ${active ? "rgba(111,158,255,0.32)" : "transparent"}`,
                fontSize: 11.5, fontWeight: 500,
                cursor: "pointer",
                fontFamily: "Manrope, sans-serif",
              }}
            >
              {f.dot && (
                <span
                  style={{
                    width: 5, height: 5, borderRadius: 999,
                    background: f.dot, boxShadow: `0 0 5px ${f.dot}`,
                  }}
                />
              )}
              {f.label}
              <span
                className="font-mono"
                style={{ fontSize: 10, opacity: 0.62 }}
              >
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="px-eu-md py-eu-md text-eu-sm text-eu-text-lo font-mono">加载…</div>
      )}

      {/* ── Rail + tile stream — single scroll container so rail stays
          vertically aligned with tiles (each row is its own 64px+1fr grid) ── */}
      <div
        ref={tilesRef}
        className="flex-1 overflow-y-auto eu-noscroll"
        style={{ paddingTop: 6, paddingBottom: 16 }}
      >
        {visibleRows.map((row) => {
          if (row.kind === "gap") {
            return (
              <GapRow
                key={`gap-${row.from}-${row.to}`}
                count={row.count}
                onExpand={() => setShowEmpty(true)}
              />
            );
          }

          const dayKey = row.dayKey;
          const dayItems = byDay.get(dayKey) ?? [];
          const tone = dayTone(dayItems);
          const empty = dayItems.length === 0;
          const tileHeight = tileHeightFor(dayItems.length);
          const isToday = dayKey === todayKey;
          const label =
            dayKey === todayKey    ? "TODAY"
          : dayKey === tomorrowKey ? "TOMORROW"
          : null;

          return (
            <div
              key={dayKey}
              data-day-key={dayKey}
              className="grid"
              style={{
                gridTemplateColumns: "64px 1fr",
                marginBottom: 6,
                paddingRight: 16,
              }}
            >
              {/* Rail cell */}
              <div
                className="relative flex flex-col items-end justify-start pt-3 pr-2"
                style={{
                  height: tileHeight,
                  borderRight: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {isToday && (
                  <div
                    className="absolute"
                    style={{
                      top: 10, bottom: 10, right: 0, width: 2,
                      background: "#6f9eff",
                      boxShadow: "0 0 8px rgba(111,158,255,0.7)",
                    }}
                  />
                )}
                <span
                  className="font-mono"
                  style={{
                    fontSize: 9.5, letterSpacing: "0.16em",
                    color: isToday ? "#6f9eff" : "rgba(255,255,255,0.40)",
                  }}
                >
                  {weekdayCap(dayKey)}
                </span>
                <span
                  className="font-display"
                  style={{
                    fontSize: isToday ? 22 : 18,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? "#a4c2ff" : "rgba(255,255,255,0.85)",
                    letterSpacing: "-0.01em",
                    marginTop: 1,
                    textShadow: isToday ? "0 0 12px rgba(111,158,255,0.5)" : "none",
                  }}
                >
                  {dayOfMonth(dayKey)}
                </span>
              </div>

              {/* Tile cell */}
              <button
                type="button"
                onClick={() => onDayTap?.(dayKey)}
                className="relative overflow-hidden text-left flex flex-col ml-1.5"
                style={{
                  minHeight: tileHeight,
                  background: tone.bg,
                  borderRadius: 14,
                  padding: empty ? "12px 16px" : "14px 18px",
                  justifyContent: empty ? "center" : "flex-start",
                  gap: 8,
                  cursor: "pointer",
                  border: "none",
                }}
              >
                {label && (
                  <span
                    className="font-mono absolute"
                    style={{
                      top: 10, right: 14,
                      fontSize: 9.5, letterSpacing: "0.20em",
                      color: "rgba(255,255,255,0.55)", fontWeight: 600,
                    }}
                  >
                    {label}
                  </span>
                )}
                {empty ? (
                  <span style={{ color: tone.meta, fontSize: 12, fontStyle: "italic", opacity: 0.7 }}>
                    空闲
                  </span>
                ) : (
                  dayItems.map((it) => (
                    <ItemRow
                      key={`${it.kind}-${it.id}`}
                      item={it}
                      tone={tone}
                      onClick={(e) => { e.stopPropagation(); onItemTap(it); }}
                    />
                  ))
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * GapRow — collapsed-empty-days separator.
 * Replaces a sequence of empty days with one slim "N 天空闲" row that
 * expands into full empty tiles on click. Keeps the schedule scannable
 * when the user has only a few real items.
 */
function GapRow({ count, onExpand }: { count: number; onExpand: () => void }) {
  return (
    <div
      className="grid"
      style={{ gridTemplateColumns: "64px 1fr", marginBottom: 6, paddingRight: 16 }}
    >
      <div
        style={{
          borderRight: "1px solid rgba(255,255,255,0.04)",
          height: 26,
        }}
      />
      <button
        type="button"
        onClick={onExpand}
        className="flex items-center justify-center ml-1.5 font-mono"
        style={{
          height: 26, borderRadius: 999,
          background: "rgba(255,255,255,0.025)",
          border: "1px dashed rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.40)",
          fontSize: 10.5, letterSpacing: "0.16em",
          cursor: "pointer",
        }}
        title="展开空闲日"
      >
        ⌄ {count} 天空闲
      </button>
    </div>
  );
}

/* ── Day tile item row ─────────────────────────────────────────────────── */

function ItemRow({
  item, tone, onClick,
}: {
  item: TimelineItem;
  tone: ReturnType<typeof dayTone>;
  onClick: (e: React.MouseEvent) => void;
}) {
  const time = formatTime(item);
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 active:scale-[0.99]"
      style={{ cursor: "pointer" }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: 10.5, color: tone.meta, fontWeight: 500,
          minWidth: 44, letterSpacing: "0.02em",
        }}
      >
        {time}
      </span>
      <span
        style={{
          width: 5, height: 5, borderRadius: 999,
          background: dotForItem(item),
          boxShadow: `0 0 6px ${dotForItem(item)}`,
          flex: "0 0 5px",
        }}
      />
      <span
        style={{
          fontSize: 13.5, color: tone.text, fontWeight: 500,
          letterSpacing: "-0.005em", lineHeight: 1.35,
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {item.title}
      </span>
    </div>
  );
}

function IconChip({ glyph }: { glyph: string }) {
  return (
    <button
      type="button"
      style={{
        width: 28, height: 28, borderRadius: 999,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.65)",
        fontSize: 13, cursor: "pointer",
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      {glyph}
    </button>
  );
}

/* ── dayTone — colored-tile recipe (mirrors canvas dayTone) ────────────── */

interface DayTone {
  bg: string;        // CSS background (gradient + base color)
  text: string;      // primary text color (item titles)
  meta: string;      // mono time + chrome
  dot: string;       // accent dot color (per item rows fall back to per-item)
}

function dayTone(items: TimelineItem[]): DayTone {
  const kinds = new Set(items.map(subKindOf));
  const hasEvent = kinds.has("event");
  const hasTodoOrExpense = kinds.has("todo") || kinds.has("expense");
  const hasIdea = kinds.has("idea");

  if (hasEvent && hasTodoOrExpense) {
    return {
      bg: "linear-gradient(135deg, rgba(156,128,240,0.40) 0%, rgba(111,158,255,0.20) 100%), #16183a",
      text: "#ffffff", meta: "rgba(255,255,255,0.72)", dot: "#c4a8ff",
    };
  }
  if (hasEvent) {
    return {
      bg: "linear-gradient(135deg, rgba(156,128,240,0.42) 0%, rgba(120,98,200,0.22) 100%), #18143a",
      text: "#ffffff", meta: "rgba(255,255,255,0.74)", dot: "#c4a8ff",
    };
  }
  if (hasTodoOrExpense) {
    return {
      bg: "linear-gradient(135deg, rgba(111,158,255,0.34) 0%, rgba(82,128,200,0.18) 100%), #131a35",
      text: "#ffffff", meta: "rgba(255,255,255,0.72)", dot: "#8ab4ff",
    };
  }
  if (hasIdea) {
    return {
      bg: "linear-gradient(135deg, rgba(245,201,119,0.24) 0%, rgba(180,140,80,0.12) 100%), #1f1c14",
      text: "#fff5e0", meta: "rgba(255,245,224,0.72)", dot: "#f5c977",
    };
  }
  // Empty
  return { bg: "#0e1426", text: "#5b6478", meta: "rgba(255,255,255,0.35)", dot: "transparent" };
}

function dotForItem(it: TimelineItem): string {
  const k = subKindOf(it);
  return ACCENT_DOT[k ?? "neutral"];
}

const ACCENT_DOT: Record<string, string> = {
  event:   "#c4a8ff",
  todo:    "#8ab4ff",
  idea:    "#f5c977",
  expense: "#86e0a5",
  contact: "#d4dbe6",
  neutral: "rgba(255,255,255,0.55)",
};

/* ── sub-kind derivation ──────────────────────────────────────────────── */

/**
 * subKindOf — Schedule + filter logic groups items by a 5-way kind:
 * event / todo / idea / expense / contact. For asset items, the source skill
 * name dictates which bucket. Anything else returns null and falls into
 * the "all" bucket only.
 */
function subKindOf(it: TimelineItem): FilterKey | null {
  if (it.kind === "event") return "event";
  switch (it.skill_name) {
    case "todo":    return "todo";
    case "idea":    return "idea";
    case "expense": return "expense";
    case "contact": return "contact";
    default:        return null;
  }
}

/* ── window + bucket math ─────────────────────────────────────────────── */

/**
 * buildDayWindow — return a contiguous list of day keys (YYYY-MM-DD, asc)
 * covering the items' date range plus padding so the user sees context.
 *
 * Past edge: min(earliest item, today − 14d).
 * Future edge: max(latest item, today + 21d).
 *
 * Returned in DESCENDING order so newest is at the TOP of the rail —
 * matches the user's mental model: 「最近发生」 + 上面是「快来到」.
 *
 * Hmm — actually descending puts the future at TOP. Canvas's CalSchedule
 * appears to render days in the order shown (22, 23, 24=today, 25, 26, …)
 * which is ASCENDING. Match the canvas: ascending; scroll position can
 * snap to today on mount (TODO).
 */
function buildDayWindow(items: TimelineItem[]): string[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let minMs = +addDays(today, -14);
  let maxMs = +addDays(today, +21);
  for (const it of items) {
    const t = +new Date(it.effective_at);
    if (t < minMs) minMs = t;
    if (t > maxMs) maxMs = t;
  }
  // Clamp the window: don't sprawl beyond ~120 days either side, dev-time
  // sanity — keeps the rail responsive even if a stray distant event exists.
  const MAX_SIDE_MS = 120 * 24 * 3600 * 1000;
  minMs = Math.max(minMs, +today - MAX_SIDE_MS);
  maxMs = Math.min(maxMs, +today + MAX_SIDE_MS);

  const days: string[] = [];
  for (let t = minMs; t <= maxMs; t += 24 * 3600 * 1000) {
    days.push(toLocalDayKey(new Date(t).toISOString()));
  }
  return days;
}

/**
 * RailRow — discriminated union of items rendered in the schedule stream.
 *   - { kind: "day", dayKey } → render a full day tile + rail cell
 *   - { kind: "gap", from, to, count } → render one slim "N 天空闲" separator
 *
 * Used by `buildRows` to compress a window's empty days into a single
 * collapsible row when `showEmpty=false`. Today and tomorrow are ALWAYS
 * shown as day rows (even empty) so the user always sees "现在 / 接下来"
 * even on a brand-new install with no data.
 */
type RailRow =
  | { kind: "day"; dayKey: string }
  | { kind: "gap"; from: string; to: string; count: number };

function buildRows(
  fullDayWindow: string[],
  byDay: Map<string, TimelineItem[]>,
  todayKey: string,
  tomorrowKey: string,
  showEmpty: boolean,
): RailRow[] {
  if (showEmpty) return fullDayWindow.map((k) => ({ kind: "day", dayKey: k }));

  const rows: RailRow[] = [];
  let gap: { from: string; to: string; count: number } | null = null;

  const flushGap = () => {
    if (gap && gap.count > 0) rows.push({ kind: "gap", ...gap });
    gap = null;
  };

  for (const k of fullDayWindow) {
    const isAnchored = k === todayKey || k === tomorrowKey || (byDay.get(k)?.length ?? 0) > 0;
    if (isAnchored) {
      flushGap();
      rows.push({ kind: "day", dayKey: k });
    } else {
      if (!gap) gap = { from: k, to: k, count: 0 };
      gap.to = k;
      gap.count += 1;
    }
  }
  flushGap();
  return rows;
}

function tileHeightFor(n: number): number {
  // Match canvas heights: 50 / 82 / 112 / 136+ for 0 / 1 / 2 / 3+ items.
  if (n === 0) return 50;
  if (n === 1) return 82;
  if (n === 2) return 112;
  return 136 + (n - 3) * 24;
}

/* ── formatters ────────────────────────────────────────────────────────── */

function formatTime(it: TimelineItem): string {
  if (it.kind === "event" && it.all_day) return "all-day";
  const d = new Date(it.effective_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function weekdayCap(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return ["SUN","MON","TUE","WED","THU","FRI","SAT"][new Date(y, m - 1, d).getDay()];
}

function dayOfMonth(dayKey: string): number {
  return Number(dayKey.split("-")[2]);
}

function currentMonthLabel(): string {
  return `${new Date().getMonth() + 1}月`;
}

function addDays(d: Date, delta: number): Date {
  const out = new Date(d); out.setDate(out.getDate() + delta); return out;
}

/* ── re-export — DayDetailSheet still uses TimelineRow shape for now ──── */

/**
 * Legacy export kept for DayDetailSheet's import compatibility. The new
 * DayDetailSheet (M3-redo) doesn't use this; once it's rewritten the
 * export can be removed.
 */
export function TimelineRow({
  item, onTap,
}: { item: TimelineItem; onTap: () => void }) {
  const time = formatTime(item);
  const accent = subKindOf(item) ?? "neutral";
  const rowStyle: CSSProperties = { cursor: "pointer" };
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center gap-eu-md px-eu-md py-eu-sm rounded-eu-md border border-transparent hover:border-eu-border hover:bg-eu-surface-hover text-left"
      style={rowStyle}
    >
      <span className="font-mono" style={{ fontSize: 11, minWidth: 44, color: ACCENT_DOT[accent] }}>{time}</span>
      <span className="shrink-0 h-2 w-2 rounded-full" style={{ background: ACCENT_DOT[accent] }} />
      <span className="flex-1 truncate text-eu-base text-eu-text-hi">{item.title}</span>
    </button>
  );
}
