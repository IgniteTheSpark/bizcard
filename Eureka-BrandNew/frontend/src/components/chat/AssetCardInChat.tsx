import { EventCard } from "@/components/calendar/EventCard";
import { SkillCard } from "@/components/skill/SkillCard";
import { useSkillRegistry } from "@/hooks/useSkillRegistry";
import { useToggleTodo } from "@/hooks/useToggleTodo";
import { buildCard } from "@/lib/render-spec";
import type { CardData } from "@/lib/render-spec";

/**
 * AssetCardInChat — render a card that came inline in a chat agent message.
 *
 * Two ways the card can arrive:
 *  1. Live chat tool_result (`tool_create_asset` → response.payload)
 *  2. History replay (Message.cards JSON from the messages table — flash also
 *     writes here)
 *
 * Both surface as a `{user_skill_name?, payload, asset_id?, ...}` dict.
 * We look up the matching UserSkill to get its render_spec, then hand to
 * SkillCard with the inline layout so the card sits cleanly inside the
 * chat bubble flow.
 *
 * Special-case skills (event / task / external_ref) fall back to sensible
 * defaults when no render_spec is registered for them.
 */

interface AssetCardInChatProps {
  /** Either the raw tool_result.response or a Message.cards[i] entry */
  data: Record<string, unknown>;
  onOpen?: (cardData: CardData, payload: Record<string, unknown>) => void;
}

export function AssetCardInChat({ data, onOpen }: AssetCardInChatProps) {
  const { bySkill } = useSkillRegistry();
  const toggleTodo = useToggleTodo();

  const skillName = pickString(data, ["user_skill_name", "card_type", "skill_name"]);
  const payload   = pickObject(data, "payload") ?? data;
  const assetId   = pickString(data, ["asset_id", "id"]);
  const eventId   = pickString(data, ["event_id"]);
  const taskId    = pickString(data, ["task_id"]);

  // M4-bugfix-2: events route through the unified EventCard so chat /
  // library / day-detail show identical surfaces. The tool_create_event
  // response carries title / start_at / end_at / all_day / location at
  // the top level.
  if (skillName === "event" && (eventId || data.title)) {
    return (
      <EventCard
        event={{
          event_id: eventId ?? undefined,
          title:    String(data.title ?? ""),
          start_at: String(data.start_at ?? ""),
          end_at:   typeof data.end_at === "string" ? data.end_at : null,
          all_day:  Boolean(data.all_day),
          location: typeof data.location === "string" ? data.location : null,
        }}
        onClick={onOpen ? () => onOpen(buildEventCardData(data), payload) : undefined}
      />
    );
  }

  const skill = skillName ? bySkill.get(skillName) : undefined;

  // Pick a render spec — prefer the registered one, else synthesize for
  // first-class entity / task cards based on conventions in M1.
  const spec = skill?.render_spec ?? synthesizeSpec(skillName, data);

  const cardData = buildCard({
    payload,
    spec,
    assetId: assetId ?? eventId ?? taskId ?? null,
    cardType: skillName ?? "asset",
    displayName: skill?.display_name ?? skillName ?? "资产",
  });

  return (
    <SkillCard
      data={cardData}
      // Chat-embedded cards always use the compact horizontal style; respect
      // existing layout if explicitly set (rare).
      layoutOverride={cardData.layout === "compact" ? "compact" : "horizontal"}
      onClick={onOpen ? () => onOpen(cardData, payload) : undefined}
      onToggleCheck={cardData.checkDone !== undefined && assetId
        ? (next) => toggleTodo(assetId, next)
        : undefined}
    />
  );
}

/** Build a minimal CardData for the onOpen callback when the event branch
 *  is taken — keeps the existing onOpen signature happy. */
function buildEventCardData(data: Record<string, unknown>): CardData {
  return buildCard({
    payload: data,
    spec: {
      card_layout: "horizontal", icon: "📅", accent_color: "purple",
      primary_field: "title", secondary_field: "start_at",
    },
    assetId:    String(data.event_id ?? data.id ?? ""),
    cardType:   "event",
    displayName: String(data.title ?? "事件"),
  });
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function pickObject(obj: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = obj[key];
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

/**
 * Fallback render_spec for things we don't have a registered UserSkill for.
 * Mirrors the inline synthesis in CategoryDetail so chat-rendered cards look
 * the same as drill-down cards.
 */
function synthesizeSpec(
  skillName: string | null,
  data: Record<string, unknown>,
): Parameters<typeof buildCard>[0]["spec"] {
  if (skillName === "event") {
    return {
      card_layout: "horizontal",
      icon: "📅",
      accent_color: "purple",
      primary_field: "title",
      secondary_field: "start_at",
      secondary_format: "relative_date",
      meta_fields: [{ field: "location" }],
    };
  }
  if (skillName === "task") {
    return {
      card_layout: "horizontal",
      icon: "⏳",
      accent_color: "amber",
      primary_field: "title",
      secondary_field: "external_system",
    };
  }
  if (skillName === "external_ref") {
    return {
      card_layout: "horizontal",
      icon: "🔗",
      accent_color: "purple",
      primary_field: "title",
      secondary_field: "external_system",
    };
  }
  // Best-effort: render whatever field looks like a title
  void data;
  return null;
}
