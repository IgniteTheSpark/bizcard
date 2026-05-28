import { useEffect, useRef, useState } from "react";

import { AssetDetailDrawer } from "@/components/asset/AssetDetailDrawer";
import { DayDetailSheet } from "@/components/calendar/DayDetailSheet";
import { MonthPane } from "@/components/calendar/MonthPane";
import { YearPane } from "@/components/calendar/YearPane";
import { CreateAssetMenu } from "@/components/library/CreateAssetMenu";
import { ScheduleView } from "@/components/calendar/ScheduleView";
import { useEvents } from "@/hooks/useEvents";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { swrFetcher } from "@/lib/api";
import { buildCard } from "@/lib/render-spec";
import useSWR from "swr";
import type { AssetsResponse, TimelineItem } from "@/lib/types";

/**
 * CalendarPage — SW: Timepage-style horizontal swipe deck.
 *
 *   ┌─────────────────────────────────────────┐
 *   │ 日程 · 月 · 年   (slim tappable dots)     │ ← header indicator
 *   ├─────────────────────────────────────────┤
 *   │ [ Schedule ][ Month ][ Year ]           │ ← 3 panes, translateX deck
 *   │   swipe ←/→ (touch) or trackpad deltaX    │
 *   └─────────────────────────────────────────┘
 *
 * Pane 0 = Schedule (colored-tile timeline), 1 = Month (continuous scroll
 * + selected-day footer), 2 = Year (12 mini months). Horizontal swipe /
 * two-finger trackpad scroll moves between them. The old 日程/月 toggle is
 * gone (per user #1).
 */

const PANES = ["schedule", "month", "year"] as const;

export function CalendarPage() {
  const [cursor]                        = useState<Date>(() => new Date());
  const [paneIndex, setPaneIndex]       = useState(0); // 0 schedule / 1 month / 2 year
  const [focusMonthKey, setFocusMonthKey] = useState<string | null>(null);
  const [dayDetailKey, setDayDetailKey] = useState<string | null>(null);
  const [openEventId, setOpenEventId]   = useState<string | null>(null);
  const [createMenuDate, setCreateMenuDate] = useState<Date | null>(null);
  const [openAssetId, setOpenAssetId]   = useState<string | null>(null);

  function handleItemTap(item: TimelineItem) {
    if (item.kind === "event") {
      setOpenEventId(item.event_id ?? item.id);
    } else {
      setOpenAssetId(item.id);
    }
    setDayDetailKey(null);
  }

  function handleCreateFromDay(dayKey: string) {
    const [y, m, d] = dayKey.split("-").map(Number);
    setCreateMenuDate(new Date(y, m - 1, d, 9, 0, 0, 0));
  }

  // Year pane → tap a month → swipe to Month pane + scroll it to that month.
  function handlePickMonth(monthKey: string) {
    setFocusMonthKey(monthKey);
    setPaneIndex(1);
  }

  // ── Swipe gesture: drag-following carousel (touch) + trackpad wheel ─────
  // The deck tracks the finger live (dragX) and snaps on release. Touch
  // listeners are attached natively with { passive: false } so that, once a
  // horizontal swipe is locked, preventDefault() stops the pane's own
  // vertical scroll / browser back-swipe from stealing the gesture — the bug
  // behind "横向滑动有问题". React's synthetic onTouch* handlers are passive
  // and cannot preventDefault, so we bypass them here.
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [dragX, setDragX] = useState(0);     // live finger offset (px)
  const [dragging, setDragging] = useState(false); // disables snap transition
  const paneIndexRef = useRef(0);
  const dragXRef = useRef(0);

  function setDrag(v: number) { dragXRef.current = v; setDragX(v); }

  function step(delta: number) {
    setPaneIndex((i) => {
      const n = Math.max(0, Math.min(PANES.length - 1, i + delta));
      paneIndexRef.current = n;
      return n;
    });
  }

  useEffect(() => { paneIndexRef.current = paneIndex; }, [paneIndex]);

  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;

    // ── trackpad: discrete horizontal-scroll step ──
    let wheelAccum = 0;
    let wheelLock = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // vertical → pane
      e.preventDefault();
      if (wheelLock) return;
      wheelAccum += e.deltaX;
      if (Math.abs(wheelAccum) > 60) {
        step(wheelAccum > 0 ? 1 : -1);
        wheelAccum = 0;
        wheelLock = true;
        window.setTimeout(() => { wheelLock = false; }, 450);
      }
    };

    // ── touch: live drag + snap ──
    let startX = 0, startY = 0, lockH: boolean | null = null, active = false;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY; lockH = null; active = true;
      setDragging(true);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (lockH === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        lockH = Math.abs(dx) > Math.abs(dy);
        if (!lockH) { active = false; setDragging(false); return; } // vertical → let pane scroll
      }
      if (lockH) {
        e.preventDefault(); // own the gesture: no vertical scroll / back-swipe
        const i = paneIndexRef.current;
        const atEdge = (i === 0 && dx > 0) || (i === PANES.length - 1 && dx < 0);
        setDrag(atEdge ? dx * 0.35 : dx); // rubber-band past the ends
      }
    };
    const onTouchEnd = () => {
      if (!active) return;
      active = false;
      setDragging(false);
      const w = el.clientWidth || 1;
      const d = dragXRef.current;
      if (lockH && Math.abs(d) > w * 0.2) step(d < 0 ? 1 : -1);
      setDrag(0);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Swipe deck — 3 panes side by side. No tab/indicator header: swipe
       *  (touch) or two-finger trackpad scroll is the sole navigation (user #1).
       *  Each pane carries its own title (日程「5月 2026」/ 月「2026」/ 年「‹2026›」)
       *  so the current view is always self-evident. */}
      <div
        ref={deckRef}
        className="flex-1 overflow-hidden relative"
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(${-paneIndex * 100}% + ${dragX}px))`,
            transition: dragging ? "none" : "transform 280ms cubic-bezier(.2,.7,.3,1)",
          }}
        >
          <div className="h-full w-full shrink-0">
            <ScheduleView onItemTap={handleItemTap} onDayTap={(k) => setDayDetailKey(k)} />
          </div>
          <div className="h-full w-full shrink-0">
            <MonthPane
              cursor={cursor}
              focusMonthKey={focusMonthKey}
              onItemTap={handleItemTap}
              onCreateEvent={handleCreateFromDay}
              onDayOpen={(k) => setDayDetailKey(k)}
            />
          </div>
          <div className="h-full w-full shrink-0">
            <YearPane initialYear={cursor.getFullYear()} onPickMonth={handlePickMonth} />
          </div>
        </div>
      </div>

      {/* ── overlays ─────────────────────────────────────────────────── */}

      {dayDetailKey && (
        <DayDetailSheet
          dayKey={dayDetailKey}
          onClose={() => setDayDetailKey(null)}
          onItemTap={handleItemTap}
        />
      )}

      {createMenuDate && (
        <CreateAssetMenu
          open
          defaultDate={createMenuDate}
          onClose={() => setCreateMenuDate(null)}
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
      // OP12: use a precomputed clean "when" string (was secondary_field:
      // start_at → rendered the raw ISO "2026-05-27T16:00:00+00:00" in the
      // drawer header).
      secondary_field: "when",
    },
    assetId:     event.event_id,
    cardType:    "event",
    displayName: event.title,
  });

  // Make a payload object so GenericField can render the readable fields
  // (title / start_at / end_at / location / description). SKIP_KEYS hides
  // the noisy internals (status, all_day, ok, event_id, etc.). `when` is a
  // synthetic field only used for the card subtitle, not shown in the body.
  const payload = {
    ...(event as unknown as Record<string, unknown>),
    when: eventWhenLabel(event),
  };

  return (
    <AssetDetailDrawer
      card={card}
      payload={payload}
      sourceSessionId={null}
      onClose={onClose}
    />
  );
}

/** OP12: clean "when" subtitle for the event drawer header. */
function eventWhenLabel(e: { start_at: string; end_at?: string | null; all_day?: boolean }): string {
  const d = new Date(e.start_at);
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (e.all_day) return `${md} · 全天`;
  const pad = (n: number) => String(n).padStart(2, "0");
  const startT = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (!e.end_at) return `${md} ${startT}`;
  const e2 = new Date(e.end_at);
  return `${md} ${startT} — ${pad(e2.getHours())}:${pad(e2.getMinutes())}`;
}
