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
 * Card shape produced from a (payload, render_spec) pair — what SkillCard
 * consumes. M1 implements the builder; M0 just exports the type so other
 * scaffold imports compile.
 */
export interface SkillCardProps {
  cardType: string; // skill machine name (todo / idea / notes / …)
  title: string;
  subtitle?: string;
  icon?: string;
  accentColor?: AccentColor;
  metaFields?: Array<{ field: string; value: string; format?: FieldFormat }>;
  actions?: CardAction[];
  assetId?: string | null;
}
