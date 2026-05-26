import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Plus, Sparkles, X as XIcon } from "lucide-react";

import { AssetDetailDrawer } from "@/components/asset/AssetDetailDrawer";
import { AssetPickerSheet } from "@/components/chat/AssetPickerSheet";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { patchSessionContext } from "@/hooks/useSessions";
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
  /** The current session's context_asset_ids */
  assetIds: string[];
  /** Session whose context we're editing — null disables add/remove buttons */
  sessionId: string | null;
}

export function ContextChipRail({ assetIds, sessionId }: ContextChipRailProps) {
  const { bySkill } = useSkillRegistry();
  const { mutate } = useSWRConfig();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleAdd(ids: string[]) {
    if (!sessionId) return;
    setBusy(true);
    try {
      await patchSessionContext(sessionId, { add: ids });
      await mutate(`/api/sessions/${sessionId}`);
    } finally {
      setBusy(false);
      setPickerOpen(false);
    }
  }

  async function handleRemove(id: string) {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      await patchSessionContext(sessionId, { remove: [id] });
      await mutate(`/api/sessions/${sessionId}`);
    } finally {
      setBusy(false);
    }
  }

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

  // Render even when assetIds is empty so the「+ 添加资产」 button stays
  // accessible (subject-only sessions still want to grow context).
  const showRail = assetIds.length > 0 || sessionId != null;
  if (!showRail) return null;

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
            <div
              key={a.id}
              className={[
                "shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-eu-full",
                ACCENT_CHIP[accent],
                "border text-eu-sm",
                "hover:brightness-110",
                "transition-all duration-eu-fast",
                "max-w-[22ch]",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => setOpenId(a.id)}
                className="inline-flex items-center gap-1.5 min-w-0 active:scale-95"
              >
                <span className="font-mono shrink-0">{icon}</span>
                <span className="truncate">{String(title)}</span>
              </button>
              {sessionId && (
                <button
                  type="button"
                  aria-label="移除"
                  onClick={() => handleRemove(a.id)}
                  disabled={busy}
                  className="shrink-0 ml-0.5 -mr-0.5 p-0.5 rounded-full hover:bg-white/10 disabled:opacity-50"
                >
                  <XIcon size={11} strokeWidth={2} />
                </button>
              )}
            </div>
          );
        })}

        {sessionId && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={busy}
            className={[
              "shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-eu-full",
              "border border-dashed border-eu-border text-eu-text-mid text-eu-sm",
              "hover:bg-eu-surface-hover hover:text-eu-text-hi hover:border-eu-border-strong",
              "active:scale-95 disabled:opacity-50",
              "transition-all duration-eu-fast",
            ].join(" ")}
          >
            <Plus size={12} strokeWidth={2} />
            添加资产
          </button>
        )}
      </div>

      {openCard && openEntry && (
        <AssetDetailDrawer
          card={openCard}
          payload={openEntry.payload}
          sourceSessionId={openEntry.session_id}
          onClose={() => setOpenId(null)}
        />
      )}

      {pickerOpen && (
        <AssetPickerSheet
          onConfirm={handleAdd}
          onClose={() => setPickerOpen(false)}
          excludeIds={assetIds}
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
