import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { useModalMount } from "@/context/ModalContext";
import { SkillCreateForm } from "@/components/skill/SkillCreateForm";
import type { AccentColor } from "@/lib/render-spec";
import type { Skill } from "@/lib/types";

/**
 * CreateAssetMenu — bottom-sheet menu shown when user taps the + button on
 * the FloatingDock or LibraryPage.
 *
 * M1 scope: list creatable asset types (skill-driven) + jump to that
 * category page. Per-type quick-create forms (the actual creation UX)
 * arrive in later milestones — for now tapping a row routes the user to
 * the appropriate flow:
 *   - "通过对话创建"   → /chat (works today)
 *   - "通过闪念创建"   → opens flash sheet (existing FloatingDock affordance)
 *   - per-skill rows   → /library/:name (placeholder; real form M2/M3/M4)
 */

interface CreateAssetMenuProps {
  open: boolean;
  onClose: () => void;
}

export function CreateAssetMenu({ open, onClose }: CreateAssetMenuProps) {
  if (!open) return null;
  return <CreateAssetMenuBody onClose={onClose} />;
}

function CreateAssetMenuBody({ onClose }: { onClose: () => void }) {
  useModalMount();
  const navigate = useNavigate();
  const { skills } = useSkillRegistry();
  // When user picks a skill, swap the menu for that skill's create form.
  // (We don't unmount this component — the form sits as a sibling overlay.)
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);

  if (activeSkill) {
    return (
      <SkillCreateForm
        skill={activeSkill}
        onClose={() => { setActiveSkill(null); onClose(); }}
      />
    );
  }

  const creatable = skills.filter(
    (s) => s.render_spec && s.name !== "qa" && s.name !== "external_ref",
  );

  return (
    <div
      // Heavy backdrop so the FloatingDock (Agent pill, calendar badge etc.)
      // doesn't bleed through and clash with the menu content above.
      className="fixed inset-0 z-50 bg-eu-bg/92 backdrop-blur-md flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={[
          "w-full md:w-[420px] max-w-md mx-auto",
          "bg-eu-surface-raised border-t border-eu-border md:border md:rounded-eu-xl",
          "rounded-t-eu-xl shadow-eu-lg pt-eu-md pb-safe",
          "flex flex-col gap-eu-sm",
        ].join(" ")}
      >
        <div className="md:hidden h-1 w-12 rounded-full bg-eu-rule mx-auto" />
        <div className="flex items-center justify-between px-eu-lg">
          <h2 className="font-display text-eu-lg text-eu-text-hi tracking-tight">创建</h2>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="p-1 rounded-eu-sm text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-eu-md text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">
          通过 AI
        </div>
        <div className="px-eu-md flex flex-col gap-eu-sm">
          <PrimaryRow
            label="跟 Agent 对话"
            sub="自然语言描述你要的"
            onClick={() => { onClose(); navigate("/chat"); }}
          />
          <PrimaryRow
            label="闪念输入"
            sub="录一句,AI 自动归类"
            onClick={() => {
              onClose();
              // Dock's mic button has the actual sheet — we just hint the user
              // to use it. M2 wires this directly into the same sheet.
              alert("点底部 dock 的 🎙 麦克风 icon 开始闪念");
            }}
          />
        </div>

        <div className="px-eu-md mt-eu-sm text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">
          直接创建
        </div>
        <div className="px-eu-md pb-eu-md grid grid-cols-2 gap-eu-sm">
          {creatable.map((s) => (
            <SkillTile
              key={s.name}
              icon={s.render_spec!.icon ?? "•"}
              label={s.display_name}
              accent={(s.render_spec!.accent_color ?? "gray") as AccentColor}
              onClick={() => setActiveSkill(s)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PrimaryRow({
  label, sub, onClick,
}: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full flex items-center gap-eu-md px-eu-md py-eu-sm rounded-eu-md",
        "bg-eu-surface border border-eu-border",
        "hover:bg-eu-surface-hover transition-colors",
        "text-left",
      ].join(" ")}
    >
      <div className="flex-1">
        <div className="text-eu-base text-eu-text-hi">{label}</div>
        <div className="text-eu-xs text-eu-text-lo font-mono mt-0.5">{sub}</div>
      </div>
    </button>
  );
}

function SkillTile({
  icon, label, accent, onClick,
}: { icon: string; label: string; accent: AccentColor; onClick: () => void }) {
  const map: Record<AccentColor, { bg: string; fg: string; border: string }> = {
    blue:    { bg: "bg-eu-accent-blue-bg",    fg: "text-eu-accent-blue-fg",    border: "border-eu-accent-blue-edge"    },
    amber:   { bg: "bg-eu-accent-amber-bg",   fg: "text-eu-accent-amber-fg",   border: "border-eu-accent-amber-edge"   },
    green:   { bg: "bg-eu-accent-green-bg",   fg: "text-eu-accent-green-fg",   border: "border-eu-accent-green-edge"   },
    red:     { bg: "bg-eu-accent-red-bg",     fg: "text-eu-accent-red-fg",     border: "border-eu-accent-red-edge"     },
    purple:  { bg: "bg-eu-accent-purple-bg",  fg: "text-eu-accent-purple-fg",  border: "border-eu-accent-purple-edge"  },
    gray:    { bg: "bg-eu-accent-gray-bg",    fg: "text-eu-accent-gray-fg",    border: "border-eu-accent-gray-edge"    },
    neutral: { bg: "bg-eu-accent-neutral-bg", fg: "text-eu-accent-neutral-fg", border: "border-eu-accent-neutral-edge" },
  };
  const a = map[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-eu-sm px-eu-md py-eu-sm rounded-eu-md",
        a.bg, "border", a.border,
        "hover:brightness-110 transition-all",
      ].join(" ")}
    >
      <span className={`font-mono text-eu-md ${a.fg}`}>{icon}</span>
      <span className="text-eu-sm text-eu-text-hi">{label}</span>
    </button>
  );
}
