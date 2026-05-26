import { useState } from "react";
import useSWR from "swr";
import { Sparkles } from "lucide-react";

import { AssetDetailDrawer } from "@/components/asset/AssetDetailDrawer";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { swrFetcher } from "@/lib/api";
import { buildCard } from "@/lib/render-spec";
import type { AssetsResponse } from "@/lib/types";
import type { CardData } from "@/lib/render-spec";

/**
 * ContextChipRail — horizontal strip shown at the top of ChatPage when the
 * current session has context_asset_ids attached.
 *
 * Each chip = one attached asset's icon + title + tiny chip styling.
 * Tap → opens AssetDetailDrawer for that asset (preserving the same UX as
 * the Library drill-down). From the drawer the user can:
 *   - read full payload
 *   - jump to the asset's creator session (source trace)
 *   - open another "在 chat 里讨论" recursively (creates yet another session)
 *
 * M2.2 fetches each asset by id via the existing /api/assets list filter.
 * Cheap because contexts are typically 1-3 assets at most.
 */

interface ContextChipRailProps {
  assetIds: string[];
}

export function ContextChipRail({ assetIds }: ContextChipRailProps) {
  const { bySkill } = useSkillRegistry();
  const [openId, setOpenId] = useState<string | null>(null);

  // Fetch all assets once (capped at 500 backend-side); filter to the
  // requested ids. For small N this is fine and avoids per-id round-trips
  // — switching to /api/assets/:id when individual GET exists.
  const assetsSWR = useSWR<AssetsResponse>(
    assetIds.length > 0 ? "/api/assets?limit=500" : null,
    swrFetcher,
  );
  const allAssets = assetsSWR.data?.assets ?? [];
  const matched = assetIds
    .map((id) => allAssets.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => a != null);

  if (assetIds.length === 0) return null;

  const openEntry = openId ? matched.find((a) => a.id === openId) : null;
  const openCard: CardData | null = openEntry
    ? buildCard({
        payload: openEntry.payload,
        spec: bySkill.get(openEntry.user_skill_name)?.render_spec ?? null,
        assetId: openEntry.id,
        cardType: openEntry.user_skill_name,
        displayName: bySkill.get(openEntry.user_skill_name)?.display_name ?? openEntry.user_skill_name,
      })
    : null;

  return (
    <>
      <div
        className={[
          "border-b border-eu-rule bg-eu-bg/60 backdrop-blur",
          "px-eu-md py-eu-sm flex items-center gap-eu-sm",
          "overflow-x-auto",
        ].join(" ")}
      >
        <div className="shrink-0 inline-flex items-center gap-1 text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">
          <Sparkles size={11} strokeWidth={1.75} />
          上下文
        </div>
        {matched.length === 0 && (
          <div className="text-eu-xs text-eu-text-lo font-mono">加载中…</div>
        )}
        {matched.map((a) => {
          const skill = bySkill.get(a.user_skill_name);
          const icon = skill?.render_spec?.icon ?? "•";
          const accent = skill?.render_spec?.accent_color ?? "gray";
          const title = (
            (a.payload as { content?: unknown; title?: unknown; name?: unknown }).content ||
            (a.payload as { title?: unknown }).title ||
            (a.payload as { name?: unknown }).name ||
            a.user_skill_name
          );
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpenId(a.id)}
              className={[
                "shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-eu-full",
                ACCENT_CHIP[accent],
                "border text-eu-sm",
                "hover:brightness-110 active:scale-95",
                "transition-all duration-eu-fast",
                "max-w-[20ch]",
              ].join(" ")}
            >
              <span className="font-mono shrink-0">{icon}</span>
              <span className="truncate">{String(title)}</span>
            </button>
          );
        })}
      </div>

      {openCard && openEntry && (
        <AssetDetailDrawer
          card={openCard}
          payload={openEntry.payload}
          sourceSessionId={openEntry.session_id}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

const ACCENT_CHIP: Record<string, string> = {
  blue:    "bg-eu-accent-blue-bg text-eu-accent-blue-fg border-eu-accent-blue-edge",
  amber:   "bg-eu-accent-amber-bg text-eu-accent-amber-fg border-eu-accent-amber-edge",
  green:   "bg-eu-accent-green-bg text-eu-accent-green-fg border-eu-accent-green-edge",
  red:     "bg-eu-accent-red-bg text-eu-accent-red-fg border-eu-accent-red-edge",
  purple:  "bg-eu-accent-purple-bg text-eu-accent-purple-fg border-eu-accent-purple-edge",
  gray:    "bg-eu-accent-gray-bg text-eu-accent-gray-fg border-eu-accent-gray-edge",
  neutral: "bg-eu-accent-neutral-bg text-eu-accent-neutral-fg border-eu-accent-neutral-edge",
};
