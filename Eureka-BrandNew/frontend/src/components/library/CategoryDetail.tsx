import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import useSWR from "swr";

import { useAssets } from "@/hooks/useAssets";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { swrFetcher } from "@/lib/api";
import { buildCard } from "@/lib/render-spec";
import type {
  ContactsResponse, EventsResponse, FilesResponse,
} from "@/lib/types";

import { SkillCard } from "@/components/skill/SkillCard";
import { AssetDetailDrawer } from "@/components/asset/AssetDetailDrawer";

/**
 * CategoryDetail — drill-down list for one skill type.
 *
 * Driven by the URL param `:skillName`. For asset-backed skills
 * (todo/idea/notes/misc/expense/contact-as-asset) we hit /api/assets with
 * filter. For first-class entity types (event/file/contact) we hit their
 * dedicated endpoints and synthesize CardData inline using a hardcoded
 * "fake render_spec" that matches what we'd seed if they were skills.
 *
 * Tapping a card opens AssetDetailDrawer (M1: read-only).
 */
export function CategoryDetail() {
  const { skillName = "" } = useParams<{ skillName: string }>();
  const { bySkill } = useSkillRegistry();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const skill = bySkill.get(skillName);

  // Determine data source for this skill
  const isEvent   = skillName === "event";
  const isFile    = skillName === "file";
  const isContact = skillName === "contact" && !skill;
  // (regular skill 'contact' is asset-backed; first-class 'contact' table is
  // accessed when no skill registered — defensive)

  const assetsHook = useAssets({
    skillName: !isEvent && !isFile && !isContact ? skillName : undefined,
    limit: 200,
  });

  const eventsSWR = useSWR<EventsResponse>(isEvent ? "/api/events" : null, swrFetcher);
  const filesSWR  = useSWR<FilesResponse>(isFile ? "/api/files" : null, swrFetcher);
  const contactsSWR = useSWR<ContactsResponse>(isContact ? "/api/contacts" : null, swrFetcher);

  const titleText = skill?.display_name ?? FALLBACK_LABEL[skillName] ?? skillName;

  // Build CardData list per source
  let cards: { id: string; data: ReturnType<typeof buildCard>; payload: Record<string, unknown> }[] = [];

  if (isEvent) {
    cards = (eventsSWR.data?.events ?? []).map((ev) => ({
      id: ev.id,
      payload: ev as unknown as Record<string, unknown>,
      data: buildCard({
        payload: ev as unknown as Record<string, unknown>,
        spec: {
          card_layout: "horizontal",
          icon: "📅",
          accent_color: "purple",
          primary_field: "title",
          secondary_field: "start_at",
          secondary_format: "relative_date",
          meta_fields: [{ field: "location" }],
        },
        assetId: ev.id,
        cardType: "event",
        displayName: "事件",
      }),
    }));
  } else if (isFile) {
    cards = (filesSWR.data?.files ?? []).map((f) => ({
      id: f.id,
      payload: f as unknown as Record<string, unknown>,
      data: buildCard({
        payload: { ...f, label: fileLabel(f) } as Record<string, unknown>,
        spec: {
          card_layout: "horizontal",
          icon: "📎",
          accent_color: "gray",
          primary_field: "label",
          secondary_field: "file_type",
          meta_fields: [
            { field: "asr_status" },
            { field: "asset_count", format: "badge" },
          ],
        },
        assetId: f.id,
        cardType: "file",
        displayName: "文件",
      }),
    }));
  } else if (isContact) {
    cards = (contactsSWR.data?.contacts ?? []).map((c) => ({
      id: c.id,
      payload: c as unknown as Record<string, unknown>,
      data: buildCard({
        payload: c as unknown as Record<string, unknown>,
        spec: {
          card_layout: "horizontal",
          icon: "👤",
          accent_color: "neutral",
          primary_field: "name",
          secondary_field: "company",
          meta_fields: [{ field: "title" }, { field: "phone" }],
        },
        assetId: c.id,
        cardType: "contact",
        displayName: "联系人",
      }),
    }));
  } else {
    cards = assetsHook.assets.map((a) => ({
      id: a.id,
      payload: a.payload,
      data: buildCard({
        payload: a.payload,
        spec: skill?.render_spec ?? null,
        assetId: a.id,
        cardType: skillName,
        displayName: titleText,
      }),
    }));
  }

  const loading = assetsHook.isLoading || eventsSWR.isLoading || filesSWR.isLoading || contactsSWR.isLoading;
  const empty = !loading && cards.length === 0;

  const selectedPayload =
    selectedId != null ? cards.find((c) => c.id === selectedId)?.payload ?? null : null;
  const selectedCard =
    selectedId != null ? cards.find((c) => c.id === selectedId)?.data ?? null : null;

  return (
    <div className="px-eu-md pt-eu-md">
      <div className="flex items-center gap-eu-sm mb-eu-md">
        <Link
          to="/library"
          className={[
            "h-8 w-8 rounded-eu-md flex items-center justify-center",
            "text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover",
            "transition-colors duration-eu-fast",
          ].join(" ")}
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>
        <h2 className="font-display text-eu-xl text-eu-text-hi tracking-tight">{titleText}</h2>
        <span className="font-mono text-eu-sm text-eu-text-lo">{cards.length}</span>
      </div>

      {loading && <SkeletonList />}
      {empty && (
        <div className="rounded-eu-lg border border-dashed border-eu-border p-eu-xl text-center">
          <div className="text-eu-text-mid text-eu-sm">还没有 {titleText}</div>
          <div className="text-eu-text-lo text-eu-xs mt-1 font-mono">
            通过闪念 / Agent / 「+」按钮创建
          </div>
        </div>
      )}

      <div className="flex flex-col gap-eu-sm">
        {cards.map((c) => (
          <SkillCard
            key={c.id}
            data={c.data}
            onClick={() => setSelectedId(c.id)}
            selected={selectedId === c.id}
          />
        ))}
      </div>

      {selectedCard && selectedPayload && (
        <AssetDetailDrawer
          card={selectedCard}
          payload={selectedPayload}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

const FALLBACK_LABEL: Record<string, string> = {
  event:   "事件",
  file:    "文件",
  contact: "联系人",
};

function fileLabel(f: { source_tag: string | null; created_at: string }): string {
  // Files don't carry a user-visible name natively — synthesize one
  const tag = f.source_tag === "flash" ? "🎙 闪念录音"
            : f.source_tag === "meeting" ? "📁 会议录音"
            : "📎 文件";
  const d = new Date(f.created_at);
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  return `${tag} · ${date}`;
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-eu-sm">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-eu-md bg-eu-surface animate-pulse opacity-50"
        />
      ))}
    </div>
  );
}
