import { useState } from "react";
import useSWR from "swr";
import { Target } from "lucide-react";

import { AssetDetailDrawer } from "@/components/asset/AssetDetailDrawer";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { swrFetcher } from "@/lib/api";
import { buildCard } from "@/lib/render-spec";
import type {
  AssetsResponse, ContactsResponse, EventsResponse, FilesResponse,
} from "@/lib/types";
import type { AccentColor } from "@/lib/render-spec";

/**
 * SubjectBanner — shown at the very top of ChatPage when the current
 * session is a home discussion for a specific entity / asset (M2.3).
 *
 * The subject is the FOCAL POINT — visually heavier than ContextChipRail's
 * additive context. Tap → opens the subject's AssetDetailDrawer.
 *
 * Only one of (contact_id / event_id / file_id / subject_asset_id) should
 * be set per session; we render whichever is non-null.
 */

interface SubjectBannerProps {
  /** Whichever of the four FKs is non-null determines the subject */
  contactId?:        string | null;
  eventId?:          string | null;
  fileId?:           string | null;
  subjectAssetId?:   string | null;
}

export function SubjectBanner({
  contactId, eventId, fileId, subjectAssetId,
}: SubjectBannerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { bySkill } = useSkillRegistry();

  // Fetch the right entity by populated FK. SWR keys only fire when needed
  // (null key = no fetch).
  const contactsSWR = useSWR<ContactsResponse>(contactId ? "/api/contacts" : null, swrFetcher);
  const eventsSWR   = useSWR<EventsResponse>(eventId ? "/api/events" : null, swrFetcher);
  const filesSWR    = useSWR<FilesResponse>(fileId ? "/api/files" : null, swrFetcher);
  const assetsSWR   = useSWR<AssetsResponse>(
    subjectAssetId ? "/api/assets?limit=500" : null, swrFetcher,
  );

  // Pick the one that's populated; produce a uniform { icon, accent, title,
  // subtitle, payload, source_session } for rendering.
  const subject = (() => {
    if (contactId) {
      const c = contactsSWR.data?.contacts?.find((x) => x.id === contactId);
      if (!c) return null;
      return {
        icon: "👤",
        accent: "neutral" as AccentColor,
        cardType: "contact",
        title: c.name,
        subtitle: c.company || c.title || c.phone || "",
        payload: c as unknown as Record<string, unknown>,
        sourceSessionId: null,
      };
    }
    if (eventId) {
      const e = eventsSWR.data?.events?.find((x) => x.event_id === eventId);
      if (!e) return null;
      return {
        icon: "📅",
        accent: "purple" as AccentColor,
        cardType: "event",
        title: e.title,
        subtitle: [e.start_at, e.location].filter(Boolean).join(" · "),
        payload: e as unknown as Record<string, unknown>,
        sourceSessionId: null,
      };
    }
    if (fileId) {
      const f = filesSWR.data?.files?.find((x) => x.id === fileId);
      if (!f) return null;
      return {
        icon: "📎",
        accent: "gray" as AccentColor,
        cardType: "file",
        title: `${f.source_tag === "flash" ? "🎙 闪念录音"
                : f.source_tag === "meeting" ? "📁 会议录音" : "📎 文件"}`,
        subtitle: `${f.file_type ?? ""}`,
        payload: f as unknown as Record<string, unknown>,
        sourceSessionId: null,
      };
    }
    if (subjectAssetId) {
      const a = assetsSWR.data?.assets?.find((x) => x.id === subjectAssetId);
      if (!a) return null;
      const skill = bySkill.get(a.user_skill_name);
      const p = a.payload as { content?: unknown; title?: unknown; name?: unknown };
      return {
        icon: skill?.render_spec?.icon ?? "•",
        accent: (skill?.render_spec?.accent_color ?? "gray") as AccentColor,
        cardType: a.user_skill_name,
        title: String(p.content ?? p.title ?? p.name ?? a.user_skill_name),
        subtitle: skill?.display_name ?? a.user_skill_name,
        payload: a.payload,
        sourceSessionId: a.session_id,
      };
    }
    return null;
  })();

  if (!subject) return null;

  const cardData = buildCard({
    payload: subject.payload,
    spec: bySkill.get(subject.cardType)?.render_spec ?? null,
    assetId: contactId ?? eventId ?? fileId ?? subjectAssetId ?? null,
    cardType: subject.cardType,
    displayName: subject.title,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={[
          "w-full flex items-center gap-eu-md px-eu-md py-eu-sm",
          "border-b border-eu-rule",
          ACCENT_TINT[subject.accent],
          "text-left hover:brightness-110 transition-all duration-eu-fast",
        ].join(" ")}
      >
        <div className="shrink-0 inline-flex items-center justify-center gap-1 text-eu-xs uppercase tracking-eu-caps font-mono text-eu-text-lo">
          <Target size={11} strokeWidth={1.75} />
          主语
        </div>
        <div className={[
          "shrink-0 h-8 w-8 rounded-eu-md flex items-center justify-center",
          "font-mono font-semibold text-eu-md border",
          ACCENT_ICON_BG[subject.accent], ACCENT_ICON_FG[subject.accent], ACCENT_BORDER[subject.accent],
        ].join(" ")}>
          {subject.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-eu-base text-eu-text-hi font-medium truncate">{subject.title}</div>
          {subject.subtitle && (
            <div className="text-eu-xs text-eu-text-mid truncate">{subject.subtitle}</div>
          )}
        </div>
      </button>

      {drawerOpen && (
        <AssetDetailDrawer
          card={cardData}
          payload={subject.payload}
          sourceSessionId={subject.sourceSessionId}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}

const ACCENT_TINT: Record<AccentColor, string> = {
  blue:    "bg-eu-accent-blue-bg/40",
  amber:   "bg-eu-accent-amber-bg/40",
  green:   "bg-eu-accent-green-bg/40",
  red:     "bg-eu-accent-red-bg/40",
  purple:  "bg-eu-accent-purple-bg/40",
  gray:    "bg-eu-accent-gray-bg/40",
  neutral: "bg-eu-accent-neutral-bg/40",
};
const ACCENT_ICON_BG: Record<AccentColor, string> = {
  blue: "bg-eu-accent-blue-bg",       amber:  "bg-eu-accent-amber-bg",
  green: "bg-eu-accent-green-bg",     red:    "bg-eu-accent-red-bg",
  purple: "bg-eu-accent-purple-bg",   gray:   "bg-eu-accent-gray-bg",
  neutral: "bg-eu-accent-neutral-bg",
};
const ACCENT_ICON_FG: Record<AccentColor, string> = {
  blue: "text-eu-accent-blue-fg",     amber:  "text-eu-accent-amber-fg",
  green: "text-eu-accent-green-fg",   red:    "text-eu-accent-red-fg",
  purple: "text-eu-accent-purple-fg", gray:   "text-eu-accent-gray-fg",
  neutral: "text-eu-accent-neutral-fg",
};
const ACCENT_BORDER: Record<AccentColor, string> = {
  blue: "border-eu-accent-blue-edge",     amber:  "border-eu-accent-amber-edge",
  green: "border-eu-accent-green-edge",   red:    "border-eu-accent-red-edge",
  purple: "border-eu-accent-purple-edge", gray:   "border-eu-accent-gray-edge",
  neutral: "border-eu-accent-neutral-edge",
};
