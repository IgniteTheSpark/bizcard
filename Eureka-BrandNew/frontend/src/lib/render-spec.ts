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

  const title = applyFormat(primaryRaw, spec.primary_format) || displayName || cardType;
  const subtitle = applyFormat(secondaryRaw, spec.secondary_format);

  const metaFields = (spec.meta_fields ?? [])
    .map((mf) => {
      const raw = payload[mf.field];
      const value = applyFormat(raw, mf.format);
      return value ? { field: mf.field, value, format: mf.format } : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return {
    cardType,
    layout: spec.card_layout ?? DEFAULT_LAYOUT,
    icon: spec.icon ?? DEFAULT_ICON,
    accentColor: spec.accent_color ?? DEFAULT_ACCENT,
    title,
    subtitle,
    metaFields,
    actions: spec.actions ?? [],
    assetId,
  };
}
