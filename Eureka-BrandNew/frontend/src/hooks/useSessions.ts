import useSWR from "swr";

import { swrFetcher } from "@/lib/api";
import type { MessagesResponse, SessionsResponse } from "@/lib/types";

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
