import { applyFormat } from "@/lib/format";
import type { FieldFormat } from "@/lib/render-spec";

/**
 * GenericField — renders one (label, value) pair from a payload using an
 * optional `format` directive. Used by AssetDetailDrawer to show the full
 * payload after the user opens a card.
 *
 * Keeps the same format vocabulary as SkillCard so display is consistent
 * between the compact card view and the expanded detail panel.
 */

interface GenericFieldProps {
  label: string;
  value: unknown;
  format?: FieldFormat;
  /** For long-form fields like content / description / markdown */
  multiline?: boolean;
}

export function GenericField({ label, value, format, multiline }: GenericFieldProps) {
  const display = applyFormat(value, format);
  if (!display) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">
        {label}
      </div>
      <div
        className={[
          "text-eu-base text-eu-text-hi",
          multiline ? "whitespace-pre-wrap leading-relaxed" : "truncate",
        ].join(" ")}
      >
        {display}
      </div>
    </div>
  );
}
