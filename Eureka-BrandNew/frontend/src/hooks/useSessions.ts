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
 *
 * Note: as of M2.3, the「在 chat 里讨论」 button uses getOrCreateSubjectSession
 * instead. This helper is kept for the multi-select / 一起讨论 flow which
 * doesn't have a single subject.
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

/**
 * getOrCreateSubjectSession — M2.3 home-session pattern.
 *
 * Each asset / first-class entity has at most ONE chat session anchored
 * to it via sessions.{contact_id|event_id|file_id|subject_asset_id}. Calling
 * this with the same (type, id) returns the existing session id instead of
 * creating a new one.
 *
 * Used by AssetDetailDrawer's「在 chat 里讨论」 — user can revisit the same
 * Kevin / event / todo discussion as one continuous thread.
 */
export type SubjectType = "contact" | "event" | "file" | "asset";

export async function getOrCreateSubjectSession(
  subjectType: SubjectType,
  subjectId: string,
): Promise<{ session_id: string; created: boolean }> {
  const resp = await apiFetch<{
    ok: boolean; session_id: string; created: boolean; error?: string;
  }>("/api/sessions/for-subject", {
    method: "POST",
    body: { subject_type: subjectType, subject_id: subjectId },
  });
  if (!resp.ok || !resp.session_id) {
    throw new Error(resp.error ?? "failed to open subject session");
  }
  return { session_id: resp.session_id, created: resp.created };
}

/**
 * patchSessionContext — M2.3 add/remove context_asset_ids on a live session.
 * Used by ContextChipRail's「+ 添加资产」 picker and the chip × remove button.
 */
export async function patchSessionContext(
  sessionId: string,
  changes: { add?: string[]; remove?: string[] },
): Promise<string[]> {
  const resp = await apiFetch<{ ok: boolean; context_asset_ids: string[]; error?: string }>(
    `/api/sessions/${sessionId}/context`,
    { method: "PATCH", body: changes },
  );
  if (!resp.ok) throw new Error(resp.error ?? "patch context failed");
  return resp.context_asset_ids ?? [];
}
