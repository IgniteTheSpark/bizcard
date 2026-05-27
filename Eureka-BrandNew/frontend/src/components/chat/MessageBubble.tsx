import { Wrench, AlertCircle, Bookmark } from "lucide-react";
import { useState } from "react";

import { AssetCardInChat } from "./AssetCardInChat";
import { AssetDetailDrawer } from "@/components/asset/AssetDetailDrawer";
import type { ChatMessage, ChatPart } from "@/hooks/useChat";
import type { CardData } from "@/lib/render-spec";

/**
 * MessageBubble — renders one user or agent message.
 *
 * User bubble: right-aligned, brand-tinted, single line of text.
 * Agent bubble: left-aligned, plain background, contains a sequence of parts
 *               (text / tool_call / tool_result / cards / error) so the
 *               streaming order is preserved.
 *
 * Cards inside agent messages are rendered with the inline SkillCard layout
 * and click-open an AssetDetailDrawer (M1 read-only style).
 */

interface MessageBubbleProps {
  message: ChatMessage;
  /** If user clicks "save as asset" button — wires PrecipitateButton */
  onPrecipitate?: (text: string) => void;
}

export function MessageBubble({ message, onPrecipitate }: MessageBubbleProps) {
  if (message.role === "user") {
    return <UserBubble text={message.text ?? ""} />;
  }
  return <AgentBubble parts={message.parts ?? []} streaming={message.streaming} onPrecipitate={onPrecipitate} />;
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className={[
          "max-w-[85%] md:max-w-[70%]",
          "bg-eu-brand-faint text-eu-text-hi",
          "border border-eu-brand-line",
          "rounded-eu-lg rounded-tr-eu-sm",
          "px-eu-md py-eu-sm",
          "text-eu-base whitespace-pre-wrap break-words",
        ].join(" ")}
      >
        {text}
      </div>
    </div>
  );
}

function AgentBubble({
  parts, streaming, onPrecipitate,
}: { parts: ChatPart[]; streaming?: boolean; onPrecipitate?: (text: string) => void }) {
  const [drawerCard, setDrawerCard] = useState<{ card: CardData; payload: Record<string, unknown> } | null>(null);

  // Concatenate all text parts into one string for the "save as asset" action
  const fullText = parts.filter((p): p is Extract<ChatPart, { type: "text" }> => p.type === "text")
                        .map((p) => p.text).join("");

  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] md:max-w-[78%] flex flex-col gap-eu-sm">
        {parts.map((part, idx) => (
          <PartRenderer
            key={idx}
            part={part}
            onOpenCard={(card, payload) => setDrawerCard({ card, payload })}
          />
        ))}

        {streaming && parts.length === 0 && (
          <div className="text-eu-sm text-eu-text-lo italic">思考中…</div>
        )}

        {/* Precipitate button only on completed agent messages with text */}
        {!streaming && fullText.length > 8 && onPrecipitate && (
          <button
            type="button"
            onClick={() => onPrecipitate(fullText)}
            className={[
              "self-start mt-1 flex items-center gap-1.5",
              "px-2 py-1 rounded-eu-sm text-eu-xs",
              "text-eu-text-lo hover:text-eu-text-hi hover:bg-eu-surface-hover",
              "border border-dashed border-eu-border hover:border-eu-border-strong",
              "transition-colors duration-eu-fast",
            ].join(" ")}
          >
            <Bookmark size={12} strokeWidth={1.75} />
            沉淀为资产
          </button>
        )}
      </div>

      {drawerCard && (
        <AssetDetailDrawer
          card={drawerCard.card}
          payload={drawerCard.payload}
          onClose={() => setDrawerCard(null)}
        />
      )}
    </div>
  );
}

/* ── Per-part renderers ─────────────────────────────────────────────────── */

function PartRenderer({
  part, onOpenCard,
}: {
  part: ChatPart;
  onOpenCard: (card: CardData, payload: Record<string, unknown>) => void;
}) {
  if (part.type === "text") {
    return (
      <div className="text-eu-base text-eu-text whitespace-pre-wrap leading-relaxed">
        {part.text}
        <Cursor />
      </div>
    );
  }
  if (part.type === "tool_call") {
    return (
      <div
        className={[
          "inline-flex items-center gap-1.5 self-start",
          "px-2 py-1 rounded-eu-sm",
          "text-eu-xs font-mono text-eu-accent-amber-fg",
          "bg-eu-accent-amber-bg border border-eu-accent-amber-edge",
        ].join(" ")}
      >
        <Wrench size={11} strokeWidth={1.75} />
        {part.name}
      </div>
    );
  }
  if (part.type === "tool_result") {
    // If the tool_result carries an asset-shaped payload, render the card.
    // Otherwise skip — the user doesn't need to see raw tool JSON.
    const card = extractCardFromToolResult(part.response);
    if (!card) {
      return (
        <div className="text-eu-xs text-eu-text-lo font-mono italic">
          ↩ {part.name} ok
        </div>
      );
    }
    return <AssetCardInChat data={card} onOpen={onOpenCard} />;
  }
  if (part.type === "cards") {
    return (
      <div className="flex flex-col gap-eu-sm">
        {part.cards.map((c, i) => (
          <AssetCardInChat key={i} data={c} onOpen={onOpenCard} />
        ))}
      </div>
    );
  }
  if (part.type === "error") {
    return (
      <div
        className={[
          "inline-flex items-center gap-1.5 self-start",
          "px-2 py-1 rounded-eu-sm",
          "text-eu-xs text-eu-accent-red-fg",
          "bg-eu-accent-red-bg border border-eu-accent-red-edge",
        ].join(" ")}
      >
        <AlertCircle size={11} strokeWidth={1.75} />
        {part.message}
      </div>
    );
  }
  return null;
}

function Cursor() {
  // Subtle blinking caret to suggest streaming. Tailwind animate-pulse.
  return (
    <span className="inline-block w-0.5 h-3 -mb-0.5 ml-0.5 bg-eu-brand animate-pulse opacity-60" />
  );
}

/**
 * Unwrap FastMCP-style nested response shapes. Backend tool_create_asset
 * returns either {ok, asset_id, payload, ...} (our internal tools) or
 * {content: [{text: '<JSON>'}], structuredContent: {...}} (FastMCP wrap).
 *
 * Always tags the unwrapped dict with a `card_type` derived from which id
 * field is present (event_id → "event", task_id → "task"). asset responses
 * already carry user_skill_name from create_asset so they don't need a tag.
 * Without this tag the downstream AssetCardInChat falls through to a
 * generic 「资产」 card — which is the bug the user saw on tool_create_event
 * results before this layer existed.
 */
function extractCardFromToolResult(response: Record<string, unknown>): Record<string, unknown> | null {
  if (!response) return null;
  const tagged = tagByIdField(response);
  if (tagged) return tagged;

  // FastMCP structuredContent
  const sc = response.structuredContent;
  if (sc && typeof sc === "object" && !Array.isArray(sc)) {
    const t = tagByIdField(sc as Record<string, unknown>);
    if (t) return t;
  }

  // FastMCP content[0].text JSON
  const content = response.content;
  if (Array.isArray(content) && content[0] && typeof content[0] === "object") {
    const text = (content[0] as Record<string, unknown>).text;
    if (typeof text === "string") {
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          const t = tagByIdField(parsed as Record<string, unknown>);
          if (t) return t;
        }
      } catch { /* fall through */ }
    }
  }
  return null;
}

/** Stamp the response with the right card_type so AssetCardInChat can pick
 *  the matching render_spec (synthesizeSpec(card_type) keys off this). */
function tagByIdField(d: Record<string, unknown>): Record<string, unknown> | null {
  if (d.asset_id) return d;                      // user_skill_name already present
  if (d.event_id) return { ...d, card_type: "event" };
  if (d.task_id)  return { ...d, card_type: "task" };
  return null;
}
