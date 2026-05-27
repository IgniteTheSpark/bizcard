import { useState } from "react";
import { ChevronLeft, ChevronRight, List, LayoutGrid } from "lucide-react";

import { AssetDetailDrawer } from "@/components/asset/AssetDetailDrawer";
import { DayDetailSheet } from "@/components/calendar/DayDetailSheet";
import { EventForm } from "@/components/calendar/EventForm";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { ScheduleView } from "@/components/calendar/ScheduleView";
import { useEvents } from "@/hooks/useEvents";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { swrFetcher } from "@/lib/api";
import { buildCard } from "@/lib/render-spec";
import useSWR from "swr";
import type { AssetsResponse, TimelineItem } from "@/lib/types";

/**
 * CalendarPage — M3 → M4-polish.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │ « 2026年5月 » │ [Schedule | Month]            │ ← CalendarHeader
 *   ├──────────────────────────────────────────────┤
 *   │                                              │
 *   │   <ScheduleView/> or <MonthGrid/>            │
 *   │                                              │
 *   └──────────────────────────────────────────────┘
 *
 * Interactions:
 *   - Schedule row tap → event → EventForm (edit); asset → AssetDetailDrawer
 *   - Month day tap   → DayDetailSheet (which can route to either above)
 *   - 新建事件         → FloatingDock + → CreateAssetMenu → 事件 tile → EventForm
 *                         (M4-polish: removed the redundant top-bar + button;
 *                          the global dock + already routes to EventForm)
 *
 * MonthGrid uses a navigable cursor (prev/next month); ScheduleView always
 * shows everything sorted desc (no cursor).
 */

type View = "schedule" | "month";

export function CalendarPage() {
  const [view, setView]                 = useState<View>("schedule");
  const [cursor, setCursor]             = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay]   = useState<string | null>(null); // for MonthGrid
  const [dayDetailKey, setDayDetailKey] = useState<string | null>(null);
  // RV5: tap event → AssetDetailDrawer (view first), drawer's 编辑 button
  // (RV3) opens EventForm. Same flow as assets — no special-case "tap
  // event = jump to editor".
  const [openEventId, setOpenEventId]   = useState<string | null>(null);
  // creating/createDefault still used by NEW event flow (DayDetail
  // 「+ add」, MonthGrid 「+ 添加事件」, Dock + 「事件」 tile).
  const [createDefault, setCreateDefault] = useState<Date | undefined>(undefined);
  const [creating, setCreating]         = useState(false);
  const [openAssetId, setOpenAssetId]   = useState<string | null>(null);

  function handleItemTap(item: TimelineItem) {
    if (item.kind === "event") {
      setOpenEventId(item.event_id ?? item.id);
    } else {
      setOpenAssetId(item.id);
    }
    // Tap on a row from DayDetailSheet should also close that sheet so the
    // editor/drawer takes over the screen cleanly.
    setDayDetailKey(null);
  }

  function handleCreateFromDay(dayKey: string) {
    setDayDetailKey(null);
    // Build a sensible default time on that day: 09:00 local.
    const [y, m, d] = dayKey.split("-").map(Number);
    const def = new Date(y, m - 1, d, 9, 0, 0, 0);
    setCreateDefault(def);
    setCreating(true);
  }

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const next = new Date(c);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      <CalendarHeader
        view={view}
        onSetView={setView}
        cursor={cursor}
        onShiftMonth={shiftMonth}
        onToday={() => setCursor(new Date())}
      />

      <div className="flex-1 overflow-y-auto">
        {view === "schedule"
          ? <ScheduleView
              onItemTap={handleItemTap}
              onDayTap={(k) => setDayDetailKey(k)}
            />
          : <MonthGrid
              cursor={cursor}
              selectedKey={selectedDay}
              onSelectDay={setSelectedDay}
              onCreateEvent={handleCreateFromDay}
              onItemTap={handleItemTap}
            />}
      </div>

      {/* ── overlays ─────────────────────────────────────────────────── */}

      {dayDetailKey && (
        <DayDetailSheet
          dayKey={dayDetailKey}
          onClose={() => setDayDetailKey(null)}
          onItemTap={handleItemTap}
          onCreateEvent={handleCreateFromDay}
        />
      )}

      {creating && (
        <EventForm
          defaultStart={createDefault}
          onClose={() => { setCreating(false); setCreateDefault(undefined); }}
        />
      )}

      {openEventId && (
        <EventDetailModal
          eventId={openEventId}
          onClose={() => setOpenEventId(null)}
        />
      )}

      {openAssetId && (
        <AssetDetailModal
          assetId={openAssetId}
          onClose={() => setOpenAssetId(null)}
        />
      )}
    </div>
  );
}

/* ── CalendarHeader ────────────────────────────────────────────────────── */

function CalendarHeader({
  view, onSetView, cursor, onShiftMonth, onToday,
}: {
  view: View;
  onSetView: (v: View) => void;
  cursor: Date;
  onShiftMonth: (delta: number) => void;
  onToday: () => void;
}) {
  const label = view === "month"
    ? `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`
    : "日程";

  return (
    <header className="flex items-center gap-eu-sm px-eu-md py-eu-sm border-b border-eu-rule">
      {view === "month" && (
        <>
          <IconBtn ariaLabel="上个月" onClick={() => onShiftMonth(-1)}>
            <ChevronLeft size={16} strokeWidth={1.75} />
          </IconBtn>
          <button
            type="button"
            onClick={onToday}
            className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo hover:text-eu-text-hi font-mono"
          >
            今天
          </button>
          <IconBtn ariaLabel="下个月" onClick={() => onShiftMonth(1)}>
            <ChevronRight size={16} strokeWidth={1.75} />
          </IconBtn>
        </>
      )}
      <h1 className="font-display text-eu-lg text-eu-text-hi tracking-tight">
        {label}
      </h1>

      {/* M4-polish: only view toggle remains here. + 新建事件 absorbed by
          the global FloatingDock + button (CreateAssetMenu → 事件 tile
          opens EventForm). */}
      <div className="ml-auto inline-flex rounded-eu-md border border-eu-border p-0.5">
        <ToggleBtn active={view === "schedule"} onClick={() => onSetView("schedule")}>
          <List size={14} strokeWidth={1.75} />
          日程
        </ToggleBtn>
        <ToggleBtn active={view === "month"} onClick={() => onSetView("month")}>
          <LayoutGrid size={14} strokeWidth={1.75} />
          月
        </ToggleBtn>
      </div>
    </header>
  );
}

function IconBtn({
  ariaLabel, onClick, children,
}: { ariaLabel: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="h-7 w-7 rounded-eu-md inline-flex items-center justify-center text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover"
    >
      {children}
    </button>
  );
}

function ToggleBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1 px-eu-sm py-1 rounded-eu-sm text-eu-xs font-mono",
        "transition-colors duration-eu-fast",
        active
          ? "bg-eu-surface-hover text-eu-text-hi"
          : "text-eu-text-mid hover:text-eu-text-hi",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/**
 * AssetDetailModal — convenience wrapper that loads an asset by id and renders
 * AssetDetailDrawer when ready. CalendarPage opens this when the user taps a
 * non-event timeline item (todo / idea / etc.).
 *
 * Uses the same /api/assets list endpoint as ContextChipRail does — for the
 * MVP scale of <500 assets this is cheap and avoids a per-id round-trip.
 */
function AssetDetailModal({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const { bySkill } = useSkillRegistry();
  const { data } = useSWR<AssetsResponse>("/api/assets?limit=500", swrFetcher);
  const asset = data?.assets.find((a) => a.id === assetId);
  if (!asset) return null;

  const skill = bySkill.get(asset.user_skill_name);
  const card = buildCard({
    payload: asset.payload,
    spec: skill?.render_spec ?? null,
    assetId: asset.id,
    cardType: asset.user_skill_name,
    displayName: skill?.display_name ?? asset.user_skill_name,
  });

  return (
    <AssetDetailDrawer
      card={card}
      payload={asset.payload}
      sourceSessionId={asset.session_id}
      onClose={onClose}
    />
  );
}

/**
 * EventDetailModal — RV5 wrapper that opens AssetDetailDrawer for an
 * event row. Tap event in Schedule / DayDetail / Month-summary now lands
 * here first (view), and the drawer's 编辑 button hands off to EventForm
 * — same flow as assets. No more "tap event = jump to editor" special
 * case.
 */
function EventDetailModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { events } = useEvents();
  const event = events.find((e) => e.event_id === eventId);
  if (!event) return null;

  // Build a CardData with cardType="event" so AssetDetailDrawer's edit
  // branch knows to route to EventForm (not SkillCreateForm).
  const card = buildCard({
    payload: event as unknown as Record<string, unknown>,
    spec: {
      card_layout:    "horizontal",
      icon:           "📅",
      accent_color:   "purple",
      primary_field:  "title",
      secondary_field: "start_at",
    },
    assetId:     event.event_id,
    cardType:    "event",
    displayName: event.title,
  });

  // Make a payload object so GenericField can render the readable fields
  // (title / start_at / end_at / location / description). SKIP_KEYS hides
  // the noisy internals (status, all_day, ok, event_id, etc.).
  const payload = event as unknown as Record<string, unknown>;

  return (
    <AssetDetailDrawer
      card={card}
      payload={payload}
      sourceSessionId={null}
      onClose={onClose}
    />
  );
}
