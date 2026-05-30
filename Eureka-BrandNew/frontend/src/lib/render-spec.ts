/**
 * lib/render-spec — TypeScript type definitions for UserSkill.render_spec.
 *
 * Mirrors Phase B §九.1 RenderSpec DSL. Kept in sync with:
 *   backend/db/seed.py        — seeded UserSkill.render_spec values
 *   backend/agents/flash_pipeline.py — _build_card_from_render_spec / _apply_format
 *
 * M1 will add the actual interpreter (renderCardFromSpec) that takes a
 * payload + spec and returns Card props. For M0 we just establish types so
 * downstream files have something to import.
 */

export type CardLayout = "horizontal" | "stacked" | "inline" | "compact";

export type AccentColor =
  | "blue"
  | "amber"
  | "green"
  | "red"
  | "purple"
  | "gray"
  | "neutral";

export type FieldFormat =
  | "text"
  | "relative_date"
  | "absolute_date"
  | "time"
  | "currency"
  | "duration"
  | "badge"
  | "truncate_30"
  | "truncate_40"
  | "truncate_60";

export type CardAction = "check" | "edit" | "delete" | "open";

export interface MetaFieldSpec {
  field: string;
  format?: FieldFormat;
  label?: string;
}

export interface RenderSpec {
  card_layout: CardLayout;
  icon: string;
  accent_color: AccentColor;
  primary_field: string;
  primary_format?: FieldFormat;
  /** Optional human label prefix for the primary value (e.g., "距离"). */
  primary_label?: string;
  /** Optional unit suffix for the primary value (e.g., "km", "¥"). */
  primary_unit?: string;
  secondary_field?: string;
  secondary_format?: FieldFormat;
  secondary_label?: string;
  secondary_unit?: string;
  meta_fields?: MetaFieldSpec[];
  actions?: CardAction[];
  timeline_position?: { time_field?: string; fallback: "created_at" };
  calendar_render?: { date_field: string; time_field?: string };
}

/**
 * Card data produced from a (payload, render_spec) pair — what SkillCard
 * consumes. The interpreter (`buildCard` below) normalizes the heterogeneous
 * skill data into this single shape; SkillCard then renders it according to
 * `layout`.
 */
export interface CardData {
  cardType: string;        // skill machine name (todo / idea / notes / …)
  layout: CardLayout;
  icon: string;
  accentColor: AccentColor;
  title: string;
  subtitle: string;
  metaFields: Array<{ field: string; value: string; format?: FieldFormat }>;
  actions: CardAction[];
  assetId: string | null;
  /** OP3: when actions includes "check", derived done-state used by the
   *  SkillCard checkbox affordance. Undefined = no checkbox shown.
   *  True when payload.status === "done" or payload.done === true. */
  checkDone?: boolean;
}

/* ── Interpreter ──────────────────────────────────────────────────────────
 *
 * buildCard(payload, spec, fallback) — converts an asset's payload + its
 * UserSkill.render_spec into normalized CardData for the SkillCard renderer.
 *
 * `fallback` lets the caller pass the skill's display_name + machine_name
 * for sensible defaults when primary_field resolves to empty.
 *
 * Mirrors backend's _build_card_from_render_spec in agents/flash_pipeline.py.
 * Stays sync (no DB); takes the resolved spec in.
 */

import { applyFormat } from "./format";

export interface BuildCardInput {
  payload: Record<string, unknown>;
  spec: RenderSpec | null;
  assetId: string | null;
  cardType: string;        // usually = skill machine name
  displayName: string;     // for title fallback when payload[primary_field] is empty
}

const DEFAULT_LAYOUT: CardLayout = "horizontal";
const DEFAULT_ACCENT: AccentColor = "gray";
const DEFAULT_ICON = "•";

/** Prepend label + append unit when present; e.g. ("124","距离","km") → "距离 124 km". */
function decorate(value: string, label?: string, unit?: string): string {
  const parts: string[] = [];
  if (label) parts.push(label);
  parts.push(value);
  if (unit) parts.push(unit);
  return parts.join(" ");
}

export function buildCard(input: BuildCardInput): CardData {
  const { payload, spec, assetId, cardType, displayName } = input;

  // Defensive: render_spec can be null (qa-skill, system skills) or partial.
  if (!spec) {
    return {
      cardType,
      layout: DEFAULT_LAYOUT,
      icon: DEFAULT_ICON,
      accentColor: DEFAULT_ACCENT,
      title: displayName || cardType,
      subtitle: "",
      metaFields: [],
      actions: [],
      assetId,
    };
  }

  const primaryRaw = spec.primary_field ? payload[spec.primary_field] : undefined;
  const secondaryRaw = spec.secondary_field ? payload[spec.secondary_field] : undefined;

  // #6 (May audit): user-created skills like 跑步记录 used to show raw
  // numbers ("124", "7") because the design agent didn't emit labels/units.
  // Now: if the spec carries `primary_label` / `primary_unit`, prepend /
  // append them so the value has context: "距离 124 km" instead of "124".
  // Falls back to the bare formatted value when neither is set (keeps
  // existing seeded skills unchanged).
  const primaryValue = applyFormat(primaryRaw, spec.primary_format);
  const title = primaryValue
    ? decorate(primaryValue, spec.primary_label, spec.primary_unit)
    : (displayName || cardType);
  const secondaryValue = applyFormat(secondaryRaw, spec.secondary_format);
  const subtitle = secondaryValue
    ? decorate(secondaryValue, spec.secondary_label, spec.secondary_unit)
    : "";

  const metaFields = (spec.meta_fields ?? [])
    .map((mf) => {
      const raw = payload[mf.field];
      const value = applyFormat(raw, mf.format);
      return value ? { field: mf.field, value, format: mf.format } : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  // OP3: derive checkDone from payload when the spec exposes a "check"
  // action. Supports both shapes (todo uses status enum; some other skills
  // might add a simple boolean `done`).
  //
  // Defensive backstop for #6 (May audit): early design-agent runs sometimes
  // tagged measurement skills (跑步记录, etc.) with actions=["check"] even
  // though the payload has no status/done concept. Without this check the
  // card grew a meaningless checkbox stuck in unchecked state forever.
  // Now: only honor "check" when the payload actually carries one of the
  // state fields — keeps the phantom checkbox off for legacy bad specs.
  const actions = spec.actions ?? [];
  let checkDone: boolean | undefined;
  if (actions.includes("check")) {
    const hasStatus = Object.prototype.hasOwnProperty.call(payload, "status");
    const hasDone   = Object.prototype.hasOwnProperty.call(payload, "done");
    if (hasStatus || hasDone) {
      checkDone = payload.status === "done" || payload.done === true;
    }
  }

  return {
    cardType,
    layout: spec.card_layout ?? DEFAULT_LAYOUT,
    icon: spec.icon ?? DEFAULT_ICON,
    accentColor: spec.accent_color ?? DEFAULT_ACCENT,
    title,
    subtitle,
    metaFields,
    actions,
    assetId,
    checkDone,
  };
}
