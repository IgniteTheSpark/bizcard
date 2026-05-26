import { useCallback, useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";

import { ChatInput } from "@/components/chat/ChatInput";
import { ContextChipRail } from "@/components/chat/ContextChipRail";
import { MessageList } from "@/components/chat/MessageList";
import { SessionSidebar } from "@/components/chat/SessionSidebar";
import { useChat, type ChatMessage, type ChatPart } from "@/hooks/useChat";
import { useSessionDetail, useSessionMessages } from "@/hooks/useSessions";
import type { Message as DbMessage } from "@/lib/types";

const ACTIVE_SESSION_KEY = "eureka:active_chat_session";

/**
 * ChatPage — M2 implementation.
 *
 * Layout:
 *   ┌────────────┬────────────────────────┐
 *   │SessionSide │  ┌──────────────────┐  │
 *   │  (desktop) │  │  MessageList     │  │
 *   │            │  │   (scrolls)      │  │
 *   │            │  └──────────────────┘  │
 *   │            │  ┌──────────────────┐  │
 *   │            │  │  ChatInput       │  │
 *   │            │  └──────────────────┘  │
 *   └────────────┴────────────────────────┘
 *
 * Mobile: sidebar collapses into a drawer; toggled by the History icon on
 * the page's own toolbar (top of right column).
 *
 * State machine:
 *   - activeSessionId persists in localStorage so reload picks up where left
 *   - useSessionMessages fetches that session's history → seed into useChat
 *   - Sending merges live SSE stream into the same messages array
 *   - Switching session → reset messages, useSessionMessages re-fetches
 */
export function ChatPage() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_SESSION_KEY) || null;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeSessionId) window.localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    else window.localStorage.removeItem(ACTIVE_SESSION_KEY);
  }, [activeSessionId]);

  // Load history + session detail (for context_asset_ids) for the active session
  const { messages: dbMessages, isLoading: historyLoading } = useSessionMessages(activeSessionId);
  const { session: sessionDetail } = useSessionDetail(activeSessionId);

  // Convert DB messages → ChatMessage format (consistent with live stream)
  const initialMessages = useMemo<ChatMessage[]>(() => dbMessages.map(dbToChatMessage), [dbMessages]);

  // Chat orchestrator — pass session id + seed messages
  const chat = useChat({
    sessionId: activeSessionId,
    initialMessages,
  });

  // When history loads / session changes, replace the chat state. Reset
  // happens via the chat.reset helper.
  useEffect(() => {
    chat.reset(initialMessages);
    // intentional: reset only when initialMessages identity changes (new session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages]);

  // When backend tells us the session_id (first turn of a new session),
  // remember it so subsequent turns continue + history loads next reload.
  useEffect(() => {
    if (chat.sessionId && chat.sessionId !== activeSessionId) {
      setActiveSessionId(chat.sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.sessionId]);

  const handleSelectSession = useCallback((id: string | null) => {
    setActiveSessionId(id);
    chat.reset([]); // optimistic; useEffect above will re-seed when history loads
  }, [chat]);

  const handlePrecipitate = useCallback((_text: string) => {
    // M2 placeholder — M5 / future will open the SkillCreateForm with the
    // text pre-filled into the relevant skill (probably notes by default).
    alert("「沉淀为资产」M5 接 design-agent 后会展开;\n目前先用 dock 的 + 按钮手动创建。");
  }, []);

  return (
    // h-full = fit within AppShell's <main>, which already reserves pb-28
    // for the floating dock. Using 100dvh here would push the ChatInput
    // under the dock.
    <div className="flex h-full">
      <SessionSidebar
        activeId={activeSessionId}
        onSelect={handleSelectSession}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile-only toolbar: history toggle */}
        <div className="md:hidden flex items-center justify-between px-eu-md py-1.5 border-b border-eu-rule">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-1.5 text-eu-sm text-eu-text-mid hover:text-eu-text-hi"
          >
            <History size={14} strokeWidth={1.75} />
            历史
          </button>
          <div className="text-eu-xs text-eu-text-lo font-mono truncate max-w-[60%]">
            {activeSessionId ? `session ${activeSessionId.slice(0, 8)}` : "新对话"}
          </div>
        </div>

        {historyLoading && activeSessionId && (
          <div className="text-eu-xs text-eu-text-lo px-eu-md py-eu-sm font-mono">加载历史…</div>
        )}

        {sessionDetail && sessionDetail.context_asset_ids.length > 0 && (
          <ContextChipRail assetIds={sessionDetail.context_asset_ids} />
        )}

        <MessageList
          messages={chat.messages}
          onPrecipitate={handlePrecipitate}
        />

        <ChatInput
          onSend={chat.send}
          streaming={chat.streaming}
        />
      </div>
    </div>
  );
}

/**
 * Convert a DB Message row into the ChatMessage shape useChat uses.
 *
 * DB Message has flat fields (text, tool_call, tool_result, cards) and a
 * single `role`. We split them into ordered parts so the bubble renderer
 * can show them in the same sequence as live-streamed events.
 *
 * Order chosen to feel natural: tool_call → tool_result → text → cards.
 */
function dbToChatMessage(m: DbMessage): ChatMessage {
  if (m.role === "user") {
    return { id: m.id, role: "user", text: m.text ?? "" };
  }
  const parts: ChatPart[] = [];
  if (m.tool_call) {
    parts.push({
      type: "tool_call",
      name: m.tool_call.name,
      args: (m.tool_call.args as Record<string, unknown>) ?? {},
    });
  }
  if (m.tool_result) {
    parts.push({
      type: "tool_result",
      name: m.tool_result.name,
      response: (m.tool_result.response as Record<string, unknown>) ?? {},
    });
  }
  if (m.text) {
    parts.push({ type: "text", text: m.text });
  }
  if (Array.isArray(m.cards) && m.cards.length > 0) {
    parts.push({ type: "cards", cards: m.cards as Array<Record<string, unknown>> });
  }
  return { id: m.id, role: "agent", parts };
}
