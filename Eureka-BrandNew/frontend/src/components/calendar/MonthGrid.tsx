import { useMemo } from "react";

import { useTimeline, toLocalDayKey } from "@/hooks/useTimeline";
import type { TimelineItem } from "@/lib/types";

/**
 * MonthGrid — calendar month view: 6 rows × 7 cols. Each cell shows day
 * number + up to 3 colored dots representing the kinds of items on that
 * day (purple=event, amber=todo, green=idea).
 *
 * Layout:
 *   ┌─────────┬─────┬─────┬─────┬─────┬─────┬─────┐
 *   │ Sun     │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │  ← header
 *   ├─────────┼─────┼─────┼─────┼─────┼─────┼─────┤
 *   │  1 ●    │  2  │  3  │  4 ●│  5  │  6  │  7  │
 *   │  ...                                          │
 *   └─────────┴─────┴─────┴─────┴─────┴─────┴─────┘
 *
 * Tap a day → onDayTap(dayKey) — parent opens DayDetailSheet.
 * Adjacent-month days are visually de-emphasized but still tappable.
 */

interface MonthGridProps {
  /** Which month to display. Cell numbering aligned to first-of-month's weekday. */
  cursor: Date;
  onDayTap: (dayKey: string) => void;
}

export function MonthGrid({ cursor, onDayTap }: MonthGridProps) {
  const { byDay } = useTimeline();

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);
  const todayKey = toLocalDayKey(new Date().toISOString());
  const cursorMonth = cursor.getMonth();

  return (
    <div className="flex flex-col h-full">
      {/* Weekday header */}
      <div className="grid grid-cols-7 px-eu-md pb-eu-xs">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono text-center py-1"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px bg-eu-rule border-t border-eu-rule flex-1 px-eu-md">
        {cells.map((cell) => {
          const items = byDay.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;
          const isThisMonth = cell.date.getMonth() === cursorMonth;
          return (
            <DayCell
              key={cell.key}
              date={cell.date}
              isToday={isToday}
              isThisMonth={isThisMonth}
              items={items}
              onTap={() => onDayTap(cell.key)}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  date, isToday, isThisMonth, items, onTap,
}: {
  date: Date;
  isToday: boolean;
  isThisMonth: boolean;
  items: TimelineItem[];
  onTap: () => void;
}) {
  const day = date.getDate();
  // Pick up to 3 dot colors representing kinds in this cell.
  const dots = pickDotAccents(items);

  return (
    <button
      type="button"
      onClick={onTap}
      className={[
        "relative h-full min-h-[64px] p-1 flex flex-col items-start",
        "bg-eu-bg hover:bg-eu-surface-hover transition-colors",
        "text-left",
        !isThisMonth ? "opacity-40" : "",
      ].join(" ")}
    >
      <div
        className={[
          "text-eu-sm font-mono leading-none",
          "h-6 w-6 inline-flex items-center justify-center rounded-eu-full",
          isToday
            ? "bg-eu-brand text-white font-semibold"
            : "text-eu-text-mid",
        ].join(" ")}
      >
        {day}
      </div>
      {dots.length > 0 && (
        <div className="absolute bottom-1 left-1 flex gap-0.5">
          {dots.map((accent, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[accent]}`}
            />
          ))}
        </div>
      )}
      {items.length > 3 && (
        <span className="absolute bottom-1 right-1 text-[9px] font-mono text-eu-text-lo">
          +{items.length - 3}
        </span>
      )}
    </button>
  );
}

/* ── grid math ──────────────────────────────────────────────────────────── */

interface Cell {
  key: string;          // YYYY-MM-DD (local TZ)
  date: Date;
}

/**
 * Build a fixed 6×7 grid for the month containing `cursor`. The grid starts
 * on the Sunday on/before the 1st and runs 42 cells; remaining cells spill
 * into the next month. Six rows is the universal calendar layout — keeps
 * the grid stable when months span 4/5/6 weeks.
 */
function buildMonthCells(cursor: Date): Cell[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  // Roll back to the Sunday on/before the 1st.
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      key: toLocalDayKey(d.toISOString()),
      date: d,
    });
  }
  return cells;
}

/**
 * Pick distinct accent colors (≤3) representing the mix of items on a day.
 * Kept stable order so dots don't flicker between renders.
 */
function pickDotAccents(items: TimelineItem[]): string[] {
  const seen = new Set<string>();
  for (const it of items) {
    const a = accentForItem(it);
    if (!seen.has(a)) seen.add(a);
    if (seen.size >= 3) break;
  }
  return [...seen];
}

function accentForItem(it: TimelineItem): string {
  if (it.kind === "event") return "purple";
  if (it.skill_name === "todo") return "amber";
  if (it.skill_name === "idea") return "green";
  return "gray";
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const ACCENT_DOT: Record<string, string> = {
  purple: "bg-eu-accent-purple-solid",
  amber:  "bg-eu-accent-amber-solid",
  green:  "bg-eu-accent-green-solid",
  gray:   "bg-eu-accent-gray-solid",
};
