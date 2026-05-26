import { useMemo } from "react";
import { Calendar, CheckCircle2, Circle, Clock, MapPin } from "lucide-react";

import { useTimeline, toLocalDayKey } from "@/hooks/useTimeline";
import type { TimelineItem } from "@/lib/types";

/**
 * ScheduleView — agenda-style list grouped by day, descending from today
 * back into past (events / todos that already passed are still useful for
 * "what did I do last week").
 *
 * Each row → onItemTap(item) so the parent can route:
 *   - event → EventEditor (edit mode)
 *   - asset → AssetDetailDrawer
 *
 * Today's bucket gets a brighter header tint. Upcoming days are stacked
 * above today; past days below.
 */

interface ScheduleViewProps {
  onItemTap: (item: TimelineItem) => void;
}

export function ScheduleView({ onItemTap }: ScheduleViewProps) {
  const { items, isLoading } = useTimeline();

  // Group by local day; build a sorted day-list (asc into future, then past).
  const buckets = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const it of items) {
      const key = toLocalDayKey(it.effective_at);
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.effective_at.localeCompare(b.effective_at));
    }
    // Sort days descending so newest is at the top — matches the user's
    // mental model: "what's coming up" → scroll down for history.
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [items]);

  if (isLoading && items.length === 0) {
    return (
      <div className="p-eu-lg text-eu-sm text-eu-text-lo font-mono">加载日程…</div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="p-eu-2xl text-center">
        <Calendar size={32} strokeWidth={1.5} className="mx-auto text-eu-text-lo mb-eu-md" />
        <div className="text-eu-base text-eu-text-mid">还没有事件或待办</div>
        <div className="text-eu-xs text-eu-text-lo font-mono mt-1">
          顶部右上「+ 新建事件」或闪念输入开始
        </div>
      </div>
    );
  }

  const todayKey = toLocalDayKey(new Date().toISOString());

  return (
    <div className="flex flex-col gap-eu-lg p-eu-md">
      {buckets.map(([day, dayItems]) => (
        <DaySection
          key={day}
          day={day}
          items={dayItems}
          isToday={day === todayKey}
          onItemTap={onItemTap}
        />
      ))}
    </div>
  );
}

function DaySection({
  day, items, isToday, onItemTap,
}: {
  day: string;
  items: TimelineItem[];
  isToday: boolean;
  onItemTap: (item: TimelineItem) => void;
}) {
  return (
    <section>
      <header
        className={[
          "flex items-baseline gap-eu-sm pb-eu-xs mb-eu-sm",
          "border-b border-eu-rule",
        ].join(" ")}
      >
        <span
          className={[
            "font-display text-eu-lg font-medium",
            isToday ? "text-eu-brand-hi" : "text-eu-text-hi",
          ].join(" ")}
        >
          {formatDayHeader(day)}
        </span>
        {isToday && (
          <span className="text-eu-xs uppercase tracking-eu-caps text-eu-brand-hi font-mono">
            今天
          </span>
        )}
        <span className="ml-auto text-eu-xs text-eu-text-lo font-mono">
          {items.length} 项
        </span>
      </header>
      <ul className="flex flex-col gap-eu-xs">
        {items.map((it) => (
          <li key={`${it.kind}-${it.id}`}>
            <TimelineRow item={it} onTap={() => onItemTap(it)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── one row ───────────────────────────────────────────────────────────── */

export function TimelineRow({
  item, onTap,
}: { item: TimelineItem; onTap: () => void }) {
  const isEvent = item.kind === "event";
  const time = formatTime(item);
  const subtitle = item.subtitle || item.location || "";
  // Match the AccentColor language used elsewhere — events get purple,
  // todos amber, ideas green, etc. (Inherited from skill render_spec,
  // but for a quick agenda row we hard-code by kind/skill_name.)
  const accent = isEvent
    ? "purple"
    : item.skill_name === "todo" ? "amber"
    : item.skill_name === "idea" ? "green"
    : "gray";

  return (
    <button
      type="button"
      onClick={onTap}
      className={[
        "w-full flex items-start gap-eu-md px-eu-md py-eu-sm rounded-eu-md",
        "border border-transparent hover:border-eu-border",
        "hover:bg-eu-surface-hover transition-all duration-eu-fast",
        "text-left active:scale-[0.99]",
      ].join(" ")}
    >
      {/* Left rail: time + accent dot */}
      <div className="shrink-0 w-14 text-right">
        <div className={`text-eu-sm font-mono ${ACCENT_FG[accent]}`}>
          {time}
        </div>
      </div>
      <div className={`shrink-0 h-2 w-2 rounded-full mt-1.5 ${ACCENT_DOT[accent]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-eu-base text-eu-text-hi truncate">{item.title}</div>
        {subtitle && (
          <div className="text-eu-xs text-eu-text-mid font-mono truncate mt-0.5 inline-flex items-center gap-1">
            {item.kind === "event" && item.location && (
              <MapPin size={11} strokeWidth={1.75} />
            )}
            {subtitle}
          </div>
        )}
      </div>
      <div className="shrink-0 text-eu-text-lo">
        {isEvent
          ? <Clock size={14} strokeWidth={1.75} />
          : item.skill_name === "todo"
            ? <Circle size={14} strokeWidth={1.75} />
            : <CheckCircle2 size={14} strokeWidth={1.75} />}
      </div>
    </button>
  );
}

/* ── formatters ────────────────────────────────────────────────────────── */

/** "2026-05-30" → "5月30日 周六" (locale-Chinese short form). */
function formatDayHeader(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const month = m;
  const dayNum = d;
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  return `${month}月${dayNum}日 ${weekday}`;
}

/** Show HH:MM in local; for all-day events show "全天". */
function formatTime(it: TimelineItem): string {
  if (it.kind === "event" && it.all_day) return "全天";
  const d = new Date(it.effective_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ACCENT_DOT: Record<string, string> = {
  purple: "bg-eu-accent-purple-solid",
  amber:  "bg-eu-accent-amber-solid",
  green:  "bg-eu-accent-green-solid",
  gray:   "bg-eu-accent-gray-solid",
};
const ACCENT_FG: Record<string, string> = {
  purple: "text-eu-accent-purple-fg",
  amber:  "text-eu-accent-amber-fg",
  green:  "text-eu-accent-green-fg",
  gray:   "text-eu-accent-gray-fg",
};
