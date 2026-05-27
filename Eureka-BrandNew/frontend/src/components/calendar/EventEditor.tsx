import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { useModalMount } from "@/context/ModalContext";
import { useEventMutations, useEvents, type EventInput } from "@/hooks/useEvents";
import type { Event } from "@/lib/types";

/**
 * EventEditor — full-screen colored editor (M3-redo).
 *
 * Implements `rebuild/design-canvas/var-b-calendar.jsx#CalEditor`:
 *
 *   ╔══════════════════════════════════════╗  ← top 64% colored panel
 *   ║                              EVENT   ║    (purple gradient + corner glow)
 *   ║                                      ║
 *   ║  产品评审 · Eureka v2 |               ║  ← title (large, blinking cursor)
 *   ║  会议室 B                              ║  ← location subtitle
 *   ║                                      ║
 *   ║              周一                     ║  ← date block
 *   ║             MAY 26                    ║
 *   ║                                      ║
 *   ║       10:00  →   11:00                ║  ← big mono time range
 *   ║                                      ║
 *   ║   ▁▁▁▁▁▁██████████▁▁▁▁▁▁▁▁           ║  ← 48-cell time scrub bar
 *   ║                                      ║    (selected segment highlighted)
 *   ║   SET TIME  ALL DAY  MULTI-DAY       ║  ← mode tabs (caps mono + underline)
 *   ╠══════════════════════════════════════╣
 *   ║   ✕    ≡    ◎    ◯    ⌗ → ✓         ║  ← toolbar (5 icons)
 *   ╠══════════════════════════════════════╣
 *   ║   最近事件                           ║
 *   ║   │ 客户拜访 · 林一帆   5月29日 16:00 ║  ← recent events quick-pick
 *   ║   │ demo 脚本草稿       5月22日 · 想法║
 *   ║   ...                                ║
 *   ╚══════════════════════════════════════╝
 *
 * Mode tabs only behave for the colored-panel UI:
 *   - SET TIME    — show + edit start_at + end_at + scrub bar
 *   - ALL DAY     — hide time, set all_day=true and snap to 00:00→23:59
 *   - MULTI-DAY   — show separate end_date picker (no-op for MVP; flagged)
 *
 * Save / delete actions live on the toolbar:
 *   ✕ close (no-save) · ≡ notes · ◎ location · ◯ contacts ·
 *   ⌗ → ✓ = save / commit (brand color, highlighted)
 *
 * Delete goes on the recent-events list (long-press, deferred); for now
 * the existing event has a small caption row below the toolbar with
 * 「删除」 button to keep it discoverable.
 */

interface EventEditorProps {
  existing?:     Event;
  defaultStart?: Date;
  onClose:       () => void;
  onSaved?:      (eventId: string) => void;
}

type Mode = "set-time" | "all-day" | "multi-day";

export function EventEditor(props: EventEditorProps) {
  useModalMount();
  return <EventEditorBody {...props} />;
}

function EventEditorBody({ existing, defaultStart, onClose, onSaved }: EventEditorProps) {
  const isEdit = !!existing;
  const { create, update, remove } = useEventMutations();
  const { events } = useEvents();

  // ── initial state ───────────────────────────────────────────────────
  const initStartDate = existing
    ? new Date(existing.start_at)
    : (defaultStart ?? roundToNextHalfHour(new Date()));
  const initEndDate = existing?.end_at
    ? new Date(existing.end_at)
    : addMinutes(initStartDate, 60);

  const [title,   setTitle]    = useState(existing?.title    ?? "");
  const [location,setLocation] = useState(existing?.location ?? "");
  const [start,   setStart]    = useState<Date>(initStartDate);
  const [end,     setEnd]      = useState<Date>(initEndDate);
  const [mode,    setMode]     = useState<Mode>(existing?.all_day ? "all-day" : "set-time");
  const [busy,    setBusy]     = useState(false);
  const [error,   setError]    = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  // ── derive scrub bar selection (only when set-time) ─────────────────
  const scrubBar = useMemo(() => deriveScrubSegment(start, end), [start, end]);

  // ── save ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!title.trim()) { setError("请输入标题"); return; }
    setBusy(true); setError(null);
    try {
      const body: EventInput = {
        title:    title.trim(),
        start_at: toIsoWithOffset(mode === "all-day" ? startOfDay(start) : start),
        end_at:   mode === "all-day"
                    ? toIsoWithOffset(endOfDay(start))
                    : toIsoWithOffset(end),
        all_day:  mode === "all-day",
        location: location.trim(),
      };
      let id: string;
      if (isEdit && existing) {
        await update(existing.event_id, body);
        id = existing.event_id;
      } else {
        id = await create(body);
      }
      onSaved?.(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setBusy(true);
    try {
      await remove(existing.event_id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  // ── adjust start/end via scrub or +/- buttons (set-time only) ──────
  function shiftStart(deltaMin: number) {
    const next = addMinutes(start, deltaMin);
    setStart(next);
    // Preserve duration so end follows start
    const dur = +end - +start;
    setEnd(new Date(+next + dur));
  }
  function shiftEnd(deltaMin: number) {
    setEnd(addMinutes(end, deltaMin));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "rgba(6,7,13,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {/* M4-polish: desktop = centered sheet (canvas-faithful 380×~720,
          relaxed to 480×min(720,90vh) so the colored panel doesn't lose its
          proportions on wide screens). Mobile = full-width bottom sheet. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col overflow-hidden"
        style={{
          width: "100%",
          maxWidth: 480,
          height: "min(720px, 92vh)",
          background: "#06070d",
          color: "#d4dbe6",
          fontFamily: '"Manrope","Noto Sans SC", system-ui, sans-serif',
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        }}
      >
        {/* ── Top 60%: colored panel ─────────────────────────────────── */}
        <div
          className="relative flex flex-col overflow-hidden"
          style={{
            flex: "0 0 60%",
            background: "linear-gradient(155deg, #4a3a8f 0%, #2a1f6a 100%)",
            padding: "20px 24px 22px",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          {/* corner glow */}
          <div
            className="pointer-events-none absolute"
            style={{
              top: -60, right: -40, width: 240, height: 240, borderRadius: 999,
              background: "radial-gradient(circle, rgba(196,168,255,0.30), transparent 70%)",
            }}
          />

          {/* EVENT caps (top-right) + close button (top-left for safety) */}
          <div className="flex items-start justify-between">
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              style={{
                width: 32, height: 32, borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff", fontSize: 14, cursor: "pointer",
              }}
            >
              ✕
            </button>
            <span
              className="font-mono"
              style={{
                fontSize: 11, color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.18em",
              }}
            >
              EVENT
            </span>
          </div>

          {/* Title input — large + auto-grow */}
          <div className="mt-4">
            <input
              autoFocus={!isEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="事件名称…"
              className="w-full bg-transparent border-none outline-none"
              style={{
                fontSize: 26, fontWeight: 700, color: "#ffffff",
                letterSpacing: "-0.015em", lineHeight: 1.3,
                fontFamily: '"Manrope","Noto Sans SC", system-ui, sans-serif',
              }}
            />
          </div>

          {/* Location subtitle */}
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="地点(可选)"
            className="w-full bg-transparent border-none outline-none mt-1"
            style={{
              fontSize: 13, color: "rgba(255,255,255,0.70)",
              fontFamily: '"Manrope","Noto Sans SC", system-ui, sans-serif',
            }}
          />

          <div className="flex-1" />

          {/* Date block (centered) */}
          <div className="text-center mt-2">
            <div
              className="font-display"
              style={{
                fontSize: 20, fontWeight: 700, letterSpacing: "0.18em",
                color: "#ffffff",
                textShadow: "0 0 20px rgba(255,255,255,0.30)",
              }}
            >
              {weekdayCn(start)}
            </div>
            <div
              className="font-mono mt-1"
              style={{
                fontSize: 11, color: "rgba(255,255,255,0.55)",
                letterSpacing: "0.20em",
              }}
            >
              {monthDayCaps(start)}
            </div>
          </div>

          {/* Time range — only when SET TIME */}
          {mode === "set-time" && (
            <>
              <div
                className="flex items-baseline justify-center"
                style={{ marginTop: 18, gap: 16 }}
              >
                <TimeStepper value={start} onChange={(d) => { setStart(d); if (+d >= +end) setEnd(addMinutes(d, 60)); }} />
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 18 }}>→</span>
                <TimeStepper value={end}   onChange={setEnd}   muted />
              </div>

              {/* Time scrub bar — 48 cells (0:00 → 24:00, 30-min each) */}
              <div
                className="relative overflow-hidden mt-3.5"
                style={{
                  height: 24,
                  background: "rgba(255,255,255,0.10)",
                  borderRadius: 4,
                }}
              >
                <div
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${scrubBar.leftPct}%`,
                    right: `${scrubBar.rightPct}%`,
                    background: "rgba(255,255,255,0.30)",
                    borderRadius: 4,
                  }}
                />
                <div className="absolute inset-0 flex">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1"
                      style={{
                        borderRight: i < 47 ? "1px solid rgba(255,255,255,0.10)" : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Quick duration shortcuts (instead of true scrub-drag for MVP) */}
              <div className="flex justify-center gap-2 mt-2.5">
                {[15, 30, 60, 90, 120].map((mins) => {
                  const active = Math.round((+end - +start) / 60000) === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setEnd(addMinutes(start, mins))}
                      className="font-mono"
                      style={{
                        fontSize: 10, padding: "3px 8px", borderRadius: 999,
                        background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)",
                        color: active ? "#fff" : "rgba(255,255,255,0.55)",
                        border: `1px solid ${active ? "rgba(255,255,255,0.30)" : "transparent"}`,
                        letterSpacing: "0.08em", cursor: "pointer",
                      }}
                    >
                      {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  );
                })}
              </div>

              {/* +/− start time stepper hints (subtle row) */}
              <div className="flex justify-center gap-3 mt-1.5">
                {[-30, -15, +15, +30].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => shiftStart(delta)}
                    className="font-mono"
                    style={{
                      fontSize: 9.5, color: "rgba(255,255,255,0.40)",
                      letterSpacing: "0.08em",
                      background: "transparent", border: "none", cursor: "pointer", padding: 0,
                    }}
                    title={`移动开始 ${delta > 0 ? "+" : ""}${delta}m`}
                  >
                    {delta > 0 ? `+${delta}m` : `${delta}m`}
                  </button>
                ))}
                <span className="font-mono" style={{ fontSize: 9.5, color: "rgba(255,255,255,0.30)" }}>· 开始</span>
                <button
                  type="button"
                  onClick={() => shiftEnd(-15)}
                  className="font-mono"
                  style={{ fontSize: 9.5, color: "rgba(255,255,255,0.40)", background: "transparent", border: "none", cursor: "pointer" }}
                >-15m</button>
                <button
                  type="button"
                  onClick={() => shiftEnd(+15)}
                  className="font-mono"
                  style={{ fontSize: 9.5, color: "rgba(255,255,255,0.40)", background: "transparent", border: "none", cursor: "pointer" }}
                >+15m</button>
                <span className="font-mono" style={{ fontSize: 9.5, color: "rgba(255,255,255,0.30)" }}>· 结束</span>
              </div>
            </>
          )}

          {mode === "all-day" && (
            <div
              className="text-center mt-4"
              style={{ color: "rgba(255,255,255,0.78)", fontSize: 14 }}
            >
              全天事件 · {monthDayCaps(start)}
            </div>
          )}

          {mode === "multi-day" && (
            <div
              className="text-center mt-4 font-mono"
              style={{ color: "rgba(255,255,255,0.50)", fontSize: 11, letterSpacing: "0.16em" }}
            >
              MULTI-DAY 待实现 — 暂用 ALL DAY 表达整天
            </div>
          )}

          {/* Mode tabs */}
          <div className="flex justify-around items-center mt-3.5">
            {(["set-time", "all-day", "multi-day"] as const).map((k) => {
              const active = mode === k;
              const label = k === "set-time" ? "SET TIME" : k === "all-day" ? "ALL DAY" : "MULTI-DAY";
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMode(k)}
                  className="font-mono"
                  style={{
                    fontSize: 10, letterSpacing: "0.16em",
                    color: active ? "#ffffff" : "rgba(255,255,255,0.50)",
                    fontWeight: active ? 700 : 400,
                    paddingBottom: 6,
                    borderBottom: `2px solid ${active ? "#ffffff" : "transparent"}`,
                    background: "transparent", border: "none",
                    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {error && (
            <div
              className="mt-2 text-center font-mono"
              style={{ fontSize: 11, color: "#ec6a83", letterSpacing: "0.08em" }}
            >
              {error}
            </div>
          )}
        </div>

        {/* ── Toolbar (5 icons) ─────────────────────────────────────── */}
        <div
          className="flex items-center justify-around"
          style={{
            background: "#0b0d14",
            padding: "12px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* close (already top-left of panel; kept for canvas parity) */}
          <ToolButton glyph="✕" onClick={onClose} />
          <ToolButton glyph="≡" disabled title="备注(待实现)" />
          <ToolButton glyph="◎" disabled title="位置(用上方输入)" />
          <ToolButton glyph="◯" disabled title="联系人(待实现)" />
          {/* SAVE — highlighted brand */}
          <ToolButton
            glyph={busy ? null : "⌗ → ✓"}
            brand
            disabled={busy || !title.trim()}
            onClick={handleSave}
            title={isEdit ? "保存" : "创建"}
          >
            {busy && <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
          </ToolButton>
        </div>

        {/* ── Recent events tray (acts as the bottom ~36%) ──────────── */}
        <div
          className="flex-1 overflow-y-auto eu-noscroll"
          style={{ padding: "14px 22px 18px" }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span
              className="font-mono"
              style={{
                fontSize: 10.5, letterSpacing: "0.22em",
                color: "rgba(255,255,255,0.55)", fontWeight: 600,
              }}
            >
              最近事件
            </span>
            {isEdit && (
              <button
                type="button"
                onClick={() => (confirmDel ? handleDelete() : setConfirmDel(true))}
                disabled={busy}
                className="font-mono"
                style={{
                  fontSize: 10, letterSpacing: "0.16em",
                  color: confirmDel ? "#ec6a83" : "rgba(255,255,255,0.45)",
                  background: "transparent", border: "none", cursor: "pointer",
                }}
              >
                {confirmDel ? "确认删除" : "删除"}
              </button>
            )}
          </div>
          <div className="flex flex-col">
            {events.slice(0, 5).map((e, i) => (
              <RecentEventRow key={e.event_id} event={e} divider={i < Math.min(events.length, 5) - 1} />
            ))}
            {events.length === 0 && (
              <div className="text-center font-mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", padding: "16px 0" }}>
                还没有其他事件
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────── */

function TimeStepper({
  value, onChange, muted,
}: { value: Date; onChange: (d: Date) => void; muted?: boolean }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return (
    <input
      type="time"
      value={text}
      onChange={(e) => {
        const [h, m] = e.target.value.split(":").map(Number);
        const next = new Date(value);
        next.setHours(h ?? 0, m ?? 0, 0, 0);
        onChange(next);
      }}
      className="font-mono bg-transparent border-none outline-none text-center"
      style={{
        fontSize: 26, fontWeight: 600,
        color: muted ? "rgba(255,255,255,0.85)" : "#ffffff",
        letterSpacing: "0.02em",
        width: 96,
      }}
    />
  );
}

function ToolButton({
  glyph, onClick, disabled, title, brand, children,
}: {
  glyph: string | null;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  brand?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center justify-center"
      style={{
        width: 44, height: 36, borderRadius: 8,
        color: brand ? "#a4c2ff" : "rgba(255,255,255,0.85)",
        background: brand ? "rgba(111,158,255,0.12)" : "transparent",
        border: `1px solid ${brand ? "rgba(111,158,255,0.30)" : "transparent"}`,
        fontFamily: brand ? '"JetBrains Mono", monospace' : "inherit",
        fontSize: brand ? 11 : 16,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && !brand ? 0.4 : 1,
        gap: 6,
      }}
    >
      {children ?? glyph}
    </button>
  );
}

function RecentEventRow({ event, divider }: { event: Event; divider: boolean }) {
  const c = event.all_day ? "#f5c977" : "#c4a8ff";
  const d = new Date(event.start_at);
  const sub = `${d.getMonth() + 1}月${d.getDate()}日${event.all_day ? " · 全天" : ` ${pad(d.getHours())}:${pad(d.getMinutes())}`}`;
  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: "9px 0",
        borderBottom: divider ? "1px solid rgba(255,255,255,0.04)" : "none",
      }}
    >
      <span style={{ width: 3, height: 22, background: c }} />
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 13.5, color: "#d4dbe6", fontWeight: 500 }}>{event.title}</div>
        <div className="font-mono" style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", letterSpacing: "0.04em" }}>{sub}</div>
      </div>
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────────────── */

function pad(n: number): string { return String(n).padStart(2, "0"); }

function addMinutes(d: Date, m: number): Date {
  return new Date(+d + m * 60_000);
}

function roundToNextHalfHour(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  const m = out.getMinutes();
  out.setMinutes(m < 30 ? 30 : 60);
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d); out.setHours(0, 0, 0, 0); return out;
}
function endOfDay(d: Date): Date {
  const out = new Date(d); out.setHours(23, 59, 0, 0); return out;
}

function toIsoWithOffset(d: Date): string {
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(offMin) / 60));
  const om = pad(Math.abs(offMin) % 60);
  return [
    d.getFullYear(), "-", pad(d.getMonth() + 1), "-", pad(d.getDate()), "T",
    pad(d.getHours()), ":", pad(d.getMinutes()), ":", pad(d.getSeconds()),
    sign, oh, ":", om,
  ].join("");
}

function weekdayCn(d: Date): string {
  return ["周日","周一","周二","周三","周四","周五","周六"][d.getDay()];
}
function monthDayCaps(d: Date): string {
  const monthsEn = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${monthsEn[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Compute the highlighted segment on the 24h scrub bar (in %), clamped to
 * the visible day. If the event crosses midnight we only render the in-day
 * portion (this MVP isn't multi-day aware).
 */
function deriveScrubSegment(start: Date, end: Date): { leftPct: number; rightPct: number } {
  const dayStart = startOfDay(start);
  const dayEnd   = endOfDay(start);
  const totalMin = (+dayEnd - +dayStart) / 60_000;
  const startMin = Math.max(0, (+start - +dayStart) / 60_000);
  const endMin   = Math.min(totalMin, Math.max(startMin, (+end - +dayStart) / 60_000));
  return {
    leftPct:  (startMin / totalMin) * 100,
    rightPct: 100 - (endMin / totalMin) * 100,
  };
}
