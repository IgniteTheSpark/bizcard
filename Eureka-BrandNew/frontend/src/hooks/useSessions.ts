import useSWR from "swr";

import { apiFetch, swrFetcher } from "@/lib/api";
import type {
  CreateSessionResponse, MessagesResponse, SessionDetailResponse, SessionsResponse,
} from "@/lib/types";

/**
 * useSessions — SWR-cached list of sessions, optionally filtered by type/date.
 * Drives SessionSidebar in ChatPage.
 */
export function useSessions(opts: { sessionType?: string; date?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.sessionType) params.set("session_type", opts.sessionType);
  if (opts.date)        params.set("date", opts.date);
  if (opts.limit)       params.set("limit", String(opts.limit));
  const qs = params.toString();
  const key = qs ? `/api/sessions?${qs}` : "/api/sessions";

  const { data, error, isLoading, mutate } = useSWR<SessionsResponse>(key, swrFetcher);
  return {
    sessions: data?.sessions ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * useSessionMessages — message log for a single session, for ChatPage history replay.
 *
 * Returns null when sessionId is null/empty (don't fetch). This lets ChatPage
 * just pass the current sessionId in and not branch on existence.
 */
export function useSessionMessages(sessionId: string | null | undefined) {
  const key = sessionId ? `/api/sessions/${sessionId}/messages` : null;
  const { data, error, isLoading, mutate } = useSWR<MessagesResponse>(key, swrFetcher);
  return {
    messages: data?.messages ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * useSessionDetail — full session metadata including context_asset_ids.
 * Used by ContextChipRail to know which assets to render as chips.
 */
export function useSessionDetail(sessionId: string | null | undefined) {
  const key = sessionId ? `/api/sessions/${sessionId}` : null;
  const { data, error, isLoading, mutate } = useSWR<SessionDetailResponse>(key, swrFetcher);
  return {
    session: data?.session ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}

/**
 * createChatSessionWithContext — convenience for the「在 chat 里讨论」flow.
 * Creates a chat session with the given assets attached as context, returns
 * the new session_id. Caller is responsible for navigating to /chat after.
 */
export async function createChatSessionWithContext(
  assetIds: string[],
  title?: string,
): Promise<string> {
  const resp = await apiFetch<CreateSessionResponse>("/api/sessions", {
    method: "POST",
    body: {
      session_type: "chat",
      title: title ?? "",
      context_asset_ids: assetIds,
    },
  });
  if (!resp.ok || !resp.session_id) {
    throw new Error("failed to create session with context");
  }
  return resp.session_id;
}
