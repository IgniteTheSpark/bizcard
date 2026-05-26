import { ChevronRight, Plus, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import useSWR from "swr";

import { swrFetcher } from "@/lib/api";
import type {
  AssetsResponse, ContactsResponse, EventsResponse, FilesResponse,
} from "@/lib/types";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import type { AccentColor } from "@/lib/render-spec";

/**
 * CategoryList — primary library view (M1).
 *
 * iOS-Files-style: each registered skill is one row showing icon + name + count
 * + chevron. Tap → drill into CategoryDetail for that skill.
 *
 * Counts:
 *   - regular skills (todo/idea/notes/misc/expense/contact)  → /api/assets
 *     grouped by user_skill_name
 *   - event                                                   → /api/events
 *   - file                                                    → /api/files
 *
 * Bottom area: + 添加新技能 row → AddSkillWizard (M5, placeholder for now).
 */
export function CategoryList() {
  const { skills } = useSkillRegistry();

  // Pull everything in parallel; SWR dedupes
  const allAssets  = useSWR<AssetsResponse>("/api/assets?limit=500", swrFetcher);
  const events     = useSWR<EventsResponse>("/api/events", swrFetcher);
  const files      = useSWR<FilesResponse>("/api/files", swrFetcher);
  const contacts   = useSWR<ContactsResponse>("/api/contacts", swrFetcher);

  // Count assets by user_skill_name
  const assetCounts = new Map<string, number>();
  for (const a of allAssets.data?.assets ?? []) {
    assetCounts.set(a.user_skill_name, (assetCounts.get(a.user_skill_name) ?? 0) + 1);
  }

  // Build the row list — skill-driven for asset skills, plus 3 first-class
  // entities (event / file / contact) that live in separate tables.
  const rows: CategoryRowData[] = [];

  // Order asset-backed skills first (filtered: skip qa which has no card,
  // skip external_ref which is task-skill output not user-facing)
  for (const s of skills) {
    if (s.name === "qa" || s.name === "external_ref") continue;
    if (!s.render_spec) continue; // system skills
    rows.push({
      to: `/library/${s.name}`,
      icon: s.render_spec.icon ?? "•",
      accent: (s.render_spec.accent_color ?? "gray") as AccentColor,
      label: s.display_name || s.name,
      count: assetCounts.get(s.name) ?? 0,
      sub: subLabelForSkill(s.name),
    });
  }

  // Inject first-class entities that live outside `assets` table.
  // NB: skip "contact" first-class row because we already have a
  // 名片 (contact-asset) row from the skill loop above — they'd visually
  // duplicate. The first-class contacts table is wired separately when
  // its CategoryDetail page is opened.
  rows.push({
    to: "/library/event",
    icon: "📅",
    accent: "purple",
    label: "事件",
    count: events.data?.events?.length ?? 0,
    sub: "日历 events",
  });
  rows.push({
    to: "/library/file",
    icon: "📎",
    accent: "gray",
    label: "文件",
    count: files.data?.files?.length ?? 0,
    sub: "录音 / 上传",
  });
  // (contacts SWR still loads in case the contact CategoryDetail wants it,
  // but it's not surfaced as a separate row to avoid duplicating 名片)
  void contacts;

  return (
    <div className="px-eu-md pt-eu-md flex flex-col gap-eu-sm">
      <SectionLabel>资产类型</SectionLabel>
      <div className="rounded-eu-lg overflow-hidden bg-eu-surface border border-eu-border divide-y divide-eu-rule">
        {rows.map((row) => (
          <CategoryRow key={row.to} {...row} />
        ))}
      </div>

      <SectionLabel className="mt-eu-md">扩展</SectionLabel>
      <div className="rounded-eu-lg overflow-hidden bg-eu-surface border border-eu-border">
        <AddSkillRow />
      </div>
    </div>
  );
}

/* ── Subcomponents ──────────────────────────────────────────────────────── */

interface CategoryRowData {
  to: string;
  icon: string;
  accent: AccentColor;
  label: string;
  count: number;
  sub: string;
}

function CategoryRow({ to, icon, accent, label, count, sub }: CategoryRowData) {
  return (
    <Link
      to={to}
      className={[
        "flex items-center gap-eu-md px-eu-md py-eu-sm",
        "transition-colors duration-eu-fast",
        "hover:bg-eu-surface-hover active:bg-eu-surface-raised",
      ].join(" ")}
    >
      <CategoryIcon icon={icon} accent={accent} />
      <div className="flex-1 min-w-0">
        <div className="text-eu-base text-eu-text-hi truncate">{label}</div>
        <div className="text-eu-xs text-eu-text-lo font-mono mt-0.5">{sub}</div>
      </div>
      <div className="font-mono text-eu-sm text-eu-text-mid shrink-0">{count}</div>
      <ChevronRight size={16} strokeWidth={1.75} className="text-eu-text-lo shrink-0" />
    </Link>
  );
}

function CategoryIcon({ icon, accent }: { icon: string; accent: AccentColor }) {
  // Per-accent classes (Tailwind-static so purger keeps them)
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
    <div className={[
      "shrink-0 h-9 w-9 rounded-eu-md border",
      "flex items-center justify-center",
      "text-eu-md font-mono font-semibold",
      a.bg, a.fg, a.border,
    ].join(" ")}>
      {icon}
    </div>
  );
}

function AddSkillRow() {
  return (
    <button
      type="button"
      onClick={() => alert("AddSkillWizard 在 M5 接入(design_agent 端到端验证)")}
      className={[
        "w-full flex items-center gap-eu-md px-eu-md py-eu-sm",
        "transition-colors duration-eu-fast",
        "hover:bg-eu-surface-hover active:bg-eu-surface-raised",
        "text-left",
      ].join(" ")}
    >
      <div className={[
        "shrink-0 h-9 w-9 rounded-eu-md border border-eu-accent-purple-edge",
        "bg-eu-accent-purple-bg text-eu-accent-purple-fg",
        "flex items-center justify-center",
      ].join(" ")}>
        <Sparkles size={16} strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <div className="text-eu-base text-eu-text-hi">添加新技能</div>
        <div className="text-eu-xs text-eu-text-lo font-mono mt-0.5">由 AI 帮你设计卡片</div>
      </div>
      <Plus size={16} strokeWidth={1.75} className="text-eu-text-lo" />
    </button>
  );
}

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-eu-sm text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono ${className}`}>
      {children}
    </div>
  );
}

function subLabelForSkill(name: string): string {
  // Static one-liners shown under each category name (the kind of thing
  // designers would write into design canvas's sample data)
  switch (name) {
    case "todo":    return "待办事项";
    case "idea":    return "灵感速记";
    case "notes":   return "笔记 / 纪要";
    case "misc":    return "其它";
    case "expense": return "消费记录";
    case "contact": return "名片资产";
    case "event":   return "日历 events";
    case "file":    return "录音 / 上传";
    default:        return name;
  }
}
