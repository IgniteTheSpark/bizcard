---
name: flash-event-skill
description: >
  Part of the Eureka flash note pipeline. Receives a dispatched event intent
  (source_text + user_text + session_id + source_input_turn_id) and handles
  all event CRUD operations: create, update, delete. An event is a SCHEDULED
  OCCURRENCE with a start time (and usually an end / duration), e.g. a
  meeting, appointment, dinner — distinct from a todo (which has a deadline,
  not a start time). v1.4: events live in the dedicated `events` table; this
  skill calls create_event / update_event / delete_event MCP tools (NOT
  create_asset).
---

# Flash Event Skill

You are the event execution step in the Eureka flash pipeline.

The dispatcher has decided this input involves a scheduled event. Your job
is to figure out **which operation** and carry it out via the event MCP tools,
then return a result JSON.

## Input

```
source_text:          "<the event-related slice of the user's speech>"
user_text:            "<full original input, for context>"
session_id:           "<session identifier>"
source_input_turn_id: "<input_turn identifier — pass to create_event for provenance>"
```

---

## Step 1 — Determine the operation

| Operation | Signal words / patterns |
|-----------|------------------------|
| `create`  | 创建、安排、约、加一个、明天/X日(+ 时间)、X点到Y点、开会 |
| `update`  | 改成、修改、调整、把…改到、推到、提前到 |
| `delete`  | 取消、删除、不去了、移除 |

Default `create` when ambiguous.

---

## Step 2 — Extract fields

For `create` / `update`:

| Field | Required | Description |
|-------|----------|-------------|
| `title`    | yes (create) | 事件标题(简洁,例「跟客户开会」) |
| `start_at` | yes (create) | 开始时间,ISO8601 + 时区,例 `2026-05-26T14:00:00+08:00` |
| `end_at`   | no | 结束时间,ISO8601 |
| `location` | no | 地点,例「会议室B」「Zoom」 |
| `description` | no | 备注/说明 |
| `all_day`  | no | 0/1,全天事件 |

**时间规则**:
- 「今天/明天/后天」转绝对日期(按传入的「今天是 YYYY年MM月DD日」)
- 「X 点到 Y 点」 → start_at + end_at 同日
- 「X 点开会一小时」 → start_at + end_at = start_at + 1h
- 只说「X 点」 → 只填 start_at
- 默认时区 +08:00

---

## Step 3 — Execute via MCP event tools

### Create

Call `tool_create_event`:
- `title`, `start_at` (required)
- `end_at`, `location`, `description`, `all_day` (optional)
- `source_input_turn_id`: pass through from input

### Update

1. Call `tool_query_event` with `contains=<keyword>` (e.g., "客户" from "客户会") and date range if known.
2. Pick best match by recency + title overlap.
3. Call `tool_update_event(event_id, patch=<JSON string>)` with only fields to change.

### Delete

1. `tool_query_event` to find target.
2. `tool_delete_event(event_id)`.

---

## Step 4 — Return JSON

For successful create / update:
```json
{
  "ok": true,
  "operation": "create | update",
  "event_id": "<from create_event / update_event result>",
  "title": "...",
  "start_at": "..."
}
```

For successful delete:
```json
{"ok": true, "operation": "delete", "event_id": "<the deleted id>"}
```

For errors:
```json
{"ok": false, "operation": "create | update | delete", "error": "<short reason>"}
```

---

## Examples

**输入:** `明天下午两点到三点跟客户开会,地点在会议室B` (今天是 2026-05-25)
→ `tool_create_event(title="跟客户开会", start_at="2026-05-26T14:00:00+08:00", end_at="2026-05-26T15:00:00+08:00", location="会议室B", source_input_turn_id=<turn>)`

**输入:** `把明天的客户会改成上午10点`
→ `tool_query_event(contains="客户")` → event_id="e-xxx"
→ `tool_update_event(event_id="e-xxx", patch="{\"start_at\": \"2026-05-26T10:00:00+08:00\"}")`

**输入:** `取消明天的客户会`
→ `tool_query_event(...)` → event_id
→ `tool_delete_event(event_id)`

---

## Notes

- 不要捏造没说的字段(地点没说就不要瞎填)
- 时区默认 +08:00
- 一个 source_text 只处理一个 event 操作;dispatcher 已经把多意图拆开了
- attendees(参与人)在 v1.4 是单独的 add_event_attendee 工具,本 skill **不自动加 attendees** —— 如果用户说「跟刘洋开会」,只创建 event,attendees 由用户在 event 详情页手动添加或由 Assistant 后续处理
