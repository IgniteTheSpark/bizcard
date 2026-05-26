import { Plus, X } from "lucide-react";

import { useModalMount } from "@/context/ModalContext";
import { useTimeline } from "@/hooks/useTimeline";
import { TimelineRow } from "@/components/calendar/ScheduleView";
import type { TimelineItem } from "@/lib/types";

/**
 * DayDetailSheet — half-screen sheet listing all timeline items on the tapped
 * day from MonthGrid. Has a "+ 新建事件" button that opens EventEditor with
 * the day pre-filled as start.
 *
 * Tap a row → onItemTap(item); parent routes (event → EventEditor edit,
 * asset → AssetDetailDrawer).
 */

interface DayDetailSheetProps {
  /** Day key "YYYY-MM-DD" (local TZ) */
  dayKey: string;
  onClose: () => void;
  onItemTap: (item: TimelineItem) => void;
  onCreateEvent: (dayKey: string) => void;
}

export function DayDetailSheet({
  dayKey, onClose, onItemTap, onCreateEvent,
}: DayDetailSheetProps) {
  useModalMount();
  const { byDay, isLoading } = useTimeline();
  const items = byDay.get(dayKey) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-eu-bg/92 backdrop-blur-md flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          "w-full md:w-[480px] max-w-md",
          "bg-eu-surface-raised border-t border-eu-border md:border md:rounded-eu-xl",
          "rounded-t-eu-xl shadow-eu-lg pt-eu-md pb-safe",
          "flex flex-col gap-eu-sm max-h-[70vh]",
        ].join(" ")}
      >
        <div className="md:hidden h-1 w-12 rounded-full bg-eu-rule mx-auto" />
        <header className="flex items-center justify-between px-eu-lg pb-eu-sm">
          <div>
            <h2 className="font-display text-eu-lg text-eu-text-hi tracking-tight">
              {formatHeader(dayKey)}
            </h2>
            <div className="text-eu-xs text-eu-text-lo font-mono mt-0.5">
              {items.length} 项
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="p-1.5 rounded-eu-sm text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-eu-md">
          {isLoading && (
            <div className="text-eu-sm text-eu-text-lo px-eu-md py-eu-md font-mono">加载中…</div>
          )}
          {!isLoading && items.length === 0 && (
            <div className="text-eu-sm text-eu-text-lo text-center py-eu-xl font-mono">
              这一天还什么都没有
            </div>
          )}
          <ul className="flex flex-col gap-eu-xs">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <TimelineRow item={it} onTap={() => onItemTap(it)} />
              </li>
            ))}
          </ul>
        </div>

        <footer className="border-t border-eu-rule px-eu-lg pt-eu-md">
          <button
            type="button"
            onClick={() => onCreateEvent(dayKey)}
            className={[
              "w-full inline-flex items-center justify-center gap-1.5",
              "px-eu-md py-eu-sm rounded-eu-md text-eu-sm font-medium",
              "bg-eu-brand text-white hover:bg-eu-brand-hi",
              "transition-colors duration-eu-fast",
            ].join(" ")}
          >
            <Plus size={14} strokeWidth={2} />
            在这天新建事件
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatHeader(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  return `${y}年${m}月${d}日 · ${weekday}`;
}
