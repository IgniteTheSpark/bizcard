/**
 * lib/types — API response shapes returned by the Eureka backend.
 * Kept narrow — only the fields the frontend currently consumes. Extend as needed.
 */

import type { RenderSpec } from "./render-spec";

/* ── /api/skills ─────────────────────────────────────────────────────────── */

export interface Skill {
  user_skill_id: string;
  name: string;           // machine name: "todo" | "idea" | ...
  display_name: string;   // localized: "待办" | "想法" | ...
  payload_schema: Record<string, unknown> | null;
  render_spec: RenderSpec | null;
  queryable_fields: Array<{ field: string; index_type: string }> | null;
}

export interface SkillsResponse {
  ok: boolean;
  skills: Skill[];
}

/* ── /api/assets ─────────────────────────────────────────────────────────── */

export interface Asset {
  id: string;
  user_skill_name: string;
  payload: Record<string, unknown>;
  session_id: string | null;
  source_input_turn_id: string | null;
  created_at: string;
}

export interface AssetsResponse {
  ok: boolean;
  assets: Asset[];
}

/* ── /api/events ─────────────────────────────────────────────────────────── */

export interface Event {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  description: string | null;
  recurrence_rule: string | null;
  status: string;
  source_input_turn_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventsResponse {
  ok: boolean;
  events: Event[];
}

/* ── /api/files ─────────────────────────────────────────────────────────── */

export interface FileRow {
  id: string;
  file_type: string | null;
  source_tag: string | null;
  duration_sec: number | null;
  asr_status: string | null;
  asr_text: string | null;
  turn_count: number;
  asset_count: number;
  created_at: string;
}

export interface FilesResponse {
  ok: boolean;
  files: FileRow[];
}

/* ── /api/contacts ──────────────────────────────────────────────────────── */

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  notes: string[];
  created_at: string;
}

export interface ContactsResponse {
  ok: boolean;
  contacts: Contact[];
}

/* ── /api/sessions ──────────────────────────────────────────────────────── */

export interface Session {
  id: string;
  session_type: "flash" | "chat" | "meeting" | "manual";
  title: string | null;
  date: string | null;
  created_at: string;
}

export interface SessionsResponse {
  ok: boolean;
  sessions: Session[];
}

/* ── /api/sessions/:id/messages ─────────────────────────────────────────── */

export interface Message {
  id: string;
  role: "user" | "agent" | "tool";
  text: string;
  tool_call: { name: string; args: Record<string, unknown> } | null;
  tool_result: { name: string; response: Record<string, unknown> } | null;
  cards: Array<Record<string, unknown>>;
  elapsed_ms: number | null;
  created_at: string;
}

export interface MessagesResponse {
  ok: boolean;
  messages: Message[];
}

/* ── /api/tasks ─────────────────────────────────────────────────────────── */

export interface Task {
  id: string;
  user_text: string;
  mcp_target: string | null;
  status: "pending" | "running" | "done" | "failed";
  error_message: string | null;
  result_asset_id: string | null;
  result_asset_payload: Record<string, unknown> | null;
  session_id: string | null;
  source_input_turn_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TasksResponse {
  ok: boolean;
  tasks: Task[];
}
