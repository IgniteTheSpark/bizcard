import { useState } from "react";
import { Calendar as CalendarIcon, Loader2, Trash2, X } from "lucide-react";

import { useModalMount } from "@/context/ModalContext";
import { useEventMutations, type EventInput } from "@/hooks/useEvents";
import type { Event } from "@/lib/types";

/**
 * EventEditor — modal for creating or editing a single event.
 *
 * Two modes:
 *   - create: pass `defaultStart` (optional) to pre-fill the date picker.
 *     The form starts empty; on save POSTs /api/events.
 *   - edit:   pass `existing` (full Event) — form is pre-populated; save
 *     issues PUT /api/events/:id with only changed fields. Delete button
 *     also renders (with confirm).
 *
 * Form fields match the backend's EventCreate / EventPatch schemas:
 *   title, start_at (ISO8601+TZ), end_at?, all_day, location?, description?
 *
 * Attendees and recurrence_rule are deferred (see Phase D spec §三.2 — ❌).
 * The MCP server adds attendees via a separate endpoint; we'll wire that
 * up in M4 / drawer edit if needed.
 */

interface EventEditorProps {
  /** Pass when editing — pre-fills the form and enables delete. */
  existing?: Event;
  /** Pre-fill the start datetime when creating (e.g. from MonthGrid day-tap). */
  defaultStart?: Date;
  /** Called on close (saved, deleted, or cancelled). */
  onClose: () => void;
  /** Optional — caller can refresh extra caches after save (e.g. session list). */
  onSaved?: (eventId: string) => void;
}

export function EventEditor(props: EventEditorProps) {
  useModalMount();
  return <EventEditorBody {...props} />;
}

function EventEditorBody({ existing, defaultStart, onClose, onSaved }: EventEditorProps) {
  const isEdit = !!existing;
  const { create, update, remove } = useEventMutations();

  // ── form state (initialized from existing or defaults) ──────────────────
  const initStart = existing
    ? isoToLocalInput(existing.start_at)
    : toLocalInput(defaultStart ?? roundToNextHalfHour(new Date()));
  const initEnd = existing?.end_at
    ? isoToLocalInput(existing.end_at)
    : addOneHour(initStart);

  const [title, setTitle]       = useState(existing?.title ?? "");
  const [allDay, setAllDay]     = useState(existing?.all_day ?? false);
  const [startStr, setStartStr] = useState(initStart);
  const [endStr, setEndStr]     = useState(initEnd);
  const [location, setLocation] = useState(existing?.location ?? "");
  const [description, setDesc]  = useState(existing?.description ?? "");

  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  async function handleSave() {
    if (!title.trim()) {
      setError("请输入标题");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: EventInput = {
        title:    title.trim(),
        start_at: localInputToIso(startStr, allDay, "start"),
        end_at:   endStr ? localInputToIso(endStr, allDay, "end") : "",
        all_day:  allDay,
        location: location.trim(),
        description: description.trim(),
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
    setError(null);
    try {
      await remove(existing.event_id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

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
          "flex flex-col gap-eu-sm max-h-[92vh]",
        ].join(" ")}
      >
        <div className="md:hidden h-1 w-12 rounded-full bg-eu-rule mx-auto" />
        <header className="flex items-center justify-between px-eu-lg pb-eu-sm">
          <h2 className="font-display text-eu-lg text-eu-text-hi tracking-tight inline-flex items-center gap-2">
            <CalendarIcon size={16} strokeWidth={1.75} className="text-eu-accent-purple-fg" />
            {isEdit ? "编辑事件" : "新建事件"}
          </h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="p-1.5 rounded-eu-sm text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-eu-lg pb-eu-md flex flex-col gap-eu-md">
          <Field label="标题">
            <input
              autoFocus={!isEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例:跟客户开会"
              className={INPUT_CLASS}
            />
          </Field>

          <div className="flex items-center justify-between">
            <label className="text-eu-sm text-eu-text-mid inline-flex items-center gap-eu-sm">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="accent-eu-brand"
              />
              全天
            </label>
            <span className="text-eu-xs text-eu-text-lo font-mono">
              当前时区:{Intl.DateTimeFormat().resolvedOptions().timeZone}
            </span>
          </div>

          <Field label="开始">
            <input
              type={allDay ? "date" : "datetime-local"}
              value={allDay ? startStr.slice(0, 10) : startStr}
              onChange={(e) => {
                const v = e.target.value;
                setStartStr(allDay ? `${v}T00:00` : v);
              }}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="结束(可选)">
            <input
              type={allDay ? "date" : "datetime-local"}
              value={allDay ? endStr.slice(0, 10) : endStr}
              onChange={(e) => {
                const v = e.target.value;
                setEndStr(allDay ? `${v}T23:59` : v);
              }}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="地点">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例:会议室 B"
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="描述">
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="可选:议程 / 备注"
              className={`${INPUT_CLASS} resize-none`}
            />
          </Field>

          {error && (
            <div className="text-eu-sm text-eu-accent-red-fg bg-eu-accent-red-bg border border-eu-accent-red-edge rounded-eu-md px-eu-md py-eu-sm">
              {error}
            </div>
          )}
        </div>

        <footer className="border-t border-eu-rule px-eu-lg pt-eu-md flex items-center justify-between gap-eu-sm">
          {isEdit ? (
            <button
              type="button"
              onClick={() => (confirmDel ? handleDelete() : setConfirmDel(true))}
              disabled={busy}
              className={[
                "px-eu-md py-eu-sm rounded-eu-md text-eu-sm font-medium",
                "inline-flex items-center gap-1.5",
                confirmDel
                  ? "bg-eu-accent-red-solid text-white hover:brightness-110"
                  : "text-eu-accent-red-fg hover:bg-eu-accent-red-bg",
                "disabled:opacity-50",
                "transition-all duration-eu-fast",
              ].join(" ")}
            >
              <Trash2 size={14} strokeWidth={2} />
              {confirmDel ? "确认删除" : "删除"}
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-eu-sm">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-eu-md py-eu-sm text-eu-sm text-eu-text-mid hover:text-eu-text-hi"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !title.trim()}
              className={[
                "px-eu-md py-eu-sm rounded-eu-md text-eu-sm font-medium",
                "bg-eu-brand text-white hover:bg-eu-brand-hi",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "inline-flex items-center gap-1.5",
                "transition-colors duration-eu-fast",
              ].join(" ")}
            >
              {busy && <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
              {isEdit ? "保存" : "创建"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── small atoms ───────────────────────────────────────────────────────── */

const INPUT_CLASS = [
  "w-full bg-eu-surface border border-eu-border rounded-eu-md",
  "px-eu-md py-eu-sm text-eu-base text-eu-text",
  "placeholder:text-eu-text-muted",
  "focus:outline-none focus:border-eu-brand",
  "transition-colors duration-eu-fast",
].join(" ");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">
        {label}
      </span>
      {children}
    </label>
  );
}

/* ── time conversion ───────────────────────────────────────────────────── */

/**
 * Convert a Date to `<input type="datetime-local">` value: "YYYY-MM-DDTHH:MM"
 * in LOCAL time (no TZ suffix). The picker won't accept anything else.
 */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    d.getFullYear(), "-", pad(d.getMonth() + 1), "-", pad(d.getDate()), "T",
    pad(d.getHours()), ":", pad(d.getMinutes()),
  ].join("");
}

/** Backend ISO (with TZ) → local-input format. Drops the TZ since the picker shows local. */
function isoToLocalInput(iso: string): string {
  return toLocalInput(new Date(iso));
}

/**
 * Convert a local-input "YYYY-MM-DDTHH:MM" back to a TZ-anchored ISO that
 * the backend accepts. Includes the user's offset (e.g. "+08:00") so the
 * server stores the correct instant.
 *
 * For all-day events: backend stores start at 00:00 local, end at 23:59
 * local on the chosen date.
 */
function localInputToIso(localStr: string, allDay: boolean, edge: "start" | "end"): string {
  // Force HH:MM presence for all-day mode (date-only input can leave it bare).
  const norm = localStr.length === 10
    ? `${localStr}T${edge === "start" ? "00:00" : "23:59"}`
    : localStr;
  const _ = allDay;          // (no special handling beyond normalization above)
  void _;
  // `new Date(localStr)` interprets ISO-without-TZ as LOCAL time — exactly what
  // we want. Then we ask for ISO with offset.
  const d = new Date(norm);
  return toIsoWithOffset(d);
}

/** ISO8601 with the user's local TZ offset: "2026-05-30T06:00:00+08:00". */
function toIsoWithOffset(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return [
    d.getFullYear(), "-", pad(d.getMonth() + 1), "-", pad(d.getDate()), "T",
    pad(d.getHours()), ":", pad(d.getMinutes()), ":", pad(d.getSeconds()),
    sign, oh, ":", om,
  ].join("");
}

/** Round a Date up to the next :00 or :30. Used for sensible default start time. */
function roundToNextHalfHour(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  const m = out.getMinutes();
  out.setMinutes(m < 30 ? 30 : 60);
  return out;
}

/** Add one hour to a "YYYY-MM-DDTHH:MM" local-input string. */
function addOneHour(localStr: string): string {
  const d = new Date(localStr);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}
