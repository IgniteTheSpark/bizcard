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
  secondary_field?: string;
  secondary_format?: FieldFormat;
  meta_fields?: MetaFieldSpec[];
  actions?: CardAction[];
  timeline_position?: { time_field?: string; fallback: "created_at" };
  calendar_render?: { date_field: string; time_field?: string };
  /**
   * Per-field unit suffix, keyed by payload field name. Renderer appends
   * "<value> <unit>" wherever the field is shown (title / subtitle / meta /
   * detail drawer raw field). Per the May audit, units are field-scoped
   * (not slot-scoped) — they describe the value, not the position.
   *
   * Example: { distance: "km", pace: "/km" }
   *
   * Legacy compatibility: primary_label / primary_unit / secondary_label /
   * secondary_unit are accepted on read for skills already in the DB but
   * are no longer emitted by the wizard. decorate() ignores labels (per
   * user feedback: card icon + skill display_name provide enough context).
   */
  field_units?: Record<string, string>;
  /** @deprecated label-decoration removed per May audit. Kept on type for old data. */
  primary_label?: string;
  /** @deprecated use field_units. Kept on type for old skills. */
  primary_unit?: string;
  /** @deprecated label-decoration removed per May audit. */
  secondary_label?: string;
  /** @deprecated use field_units. */
  secondary_unit?: string;
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

/**
 * Append unit when present. Labels (前缀) are intentionally dropped — the
 * card already shows the skill icon + display_name above the value, so a
 * field-name prefix is redundant. May audit (user feedback: "不需要事件
 * 之类的标识了").
 *
 * decorate("124", "km") → "124 km"
 * decorate("吃辅食", undefined) → "吃辅食"
 */
function decorate(value: string, unit?: string): string {
  return unit ? `${value} ${unit}` : value;
}

/** Look up a unit for the given field, tolerating legacy slot-scoped fields. */
function unitFor(spec: RenderSpec, field: string | undefined): string | undefined {
  if (!field) return undefined;
  if (spec.field_units && spec.field_units[field]) return spec.field_units[field];
  // Legacy: skills authored before field_units existed had primary_unit /
  // secondary_unit on the spec. Honor them so existing data renders right.
  if (field === spec.primary_field   && spec.primary_unit)   return spec.primary_unit;
  if (field === spec.secondary_field && spec.secondary_unit) return spec.secondary_unit;
  return undefined;
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

  // Decorate with unit only — no label prefix. The card's icon + skill
  // display_name above already say what the value is; a "距离" prefix in
  // front of "5 km" reads as noise (May audit user feedback).
  const primaryValue = applyFormat(primaryRaw, spec.primary_format);
  const title = primaryValue
    ? decorate(primaryValue, unitFor(spec, spec.primary_field))
    : (displayName || cardType);
  const secondaryValue = applyFormat(secondaryRaw, spec.secondary_format);
  const subtitle = secondaryValue
    ? decorate(secondaryValue, unitFor(spec, spec.secondary_field))
    : "";

  const metaFields = (spec.meta_fields ?? [])
    .map((mf) => {
      const raw = payload[mf.field];
      const formatted = applyFormat(raw, mf.format);
      if (!formatted) return null;
      const value = decorate(formatted, unitFor(spec, mf.field));
      return { field: mf.field, value, format: mf.format };
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
