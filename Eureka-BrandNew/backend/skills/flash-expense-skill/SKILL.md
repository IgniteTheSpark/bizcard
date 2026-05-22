---
name: flash-expense-skill
description: >
  Part of the Bizcard flash note pipeline. Receives a dispatched expense intent
  (source_text + user_text + session_id + input_id) and handles all expense
  CRUD operations: create, update, and delete. Use this skill whenever the
  dispatcher routes an expense/spending/payment/purchase/reimbursement intent
  — whether creating a new record, correcting an existing one, or removing one.
---

# Flash Expense Skill

You are the expense execution step in the Bizcard flash note pipeline.

The dispatcher has already decided this text involves an expense record. Your job is to determine **which operation** is needed, carry it out with MCP tools, and return the result.

## Input

```
source_text: "<the expense-related slice of the user's speech>"
user_text: "<full original input, for context>"
session_id: "<session identifier>"
input_id: "<input identifier>"
```

---

## Step 1 — Determine the operation

| Operation | Signal words / patterns |
|-----------|------------------------|
| `create`  | 花了、买了、消费了、付了、报销、刚刚、记一笔 |
| `update`  | 改成、金额不对、修改、更新、应该是、刚才记错了 |
| `delete`  | 删除、取消、移除、不算、那笔消费不对 |

When ambiguous, default to `create`.

---

## Step 2 — Execute

### CREATE

Extract these fields from `source_text`:

**amount** (required) — numeric value. If missing, return error.

**currency** — default `"CNY"` unless user says otherwise ("美元", "USD", "港币", etc.).

**category** — infer from context:
- 餐饮 — eating out, food delivery, coffee, drinks
- 交通 — taxi, ride-hailing, subway, fuel
- 购物 — shopping, clothing, electronics
- 娱乐 — movies, games, leisure
- 住宿 — hotel, accommodation
- 医疗 — pharmacy, hospital, clinic
- 办公 — office supplies, business tools
- 其他 — when unclear

Only assign a category you're confident about. Default to `"其他"` if unclear.

**merchant** — vendor name if explicitly stated, else `""`.

**date** — when the spending happened:
- "今天" / no time reference → today's date
- "昨天" → yesterday's date
- Specific date → that date
- Store as `"YYYY-MM-DD"` (date only, no time component)

Today's date for relative resolution: use the current date from your context.

**description** — brief note from `source_text`. Keep it short. Don't invent details.

Call `tool_create_asset`:
- `asset_type`: `"expense"`
- `payload`: `{"amount": <number>, "currency": "CNY", "category": "...", "merchant": "...", "date": "YYYY-MM-DD", "description": "..."}`
- `session_id`, `input_id`: pass through

---

### UPDATE

1. Extract a **search keyword** — amount, merchant, or description word that identifies the record.
2. Call `tool_query_asset` with `asset_type="expense"` and `contains=<keyword>`.
3. Pick the most relevant match (most recent or closest content match).
4. Determine which fields changed (amount, category, merchant, date, description).
5. Call `tool_update_asset` with `asset_id` and a `payload_patch` JSON string of only the changed fields.

If no match found, fall back to **CREATE**.

---

### DELETE

1. Extract a **search keyword**.
2. Call `tool_query_asset` with `asset_type="expense"` and `contains=<keyword>`.
3. Pick the most relevant match.
4. Call `tool_delete_asset` with `asset_id`.

If no match found, return `{"ok": false, "message": "未找到匹配的消费记录"}`.

---

## Output

Return only the JSON result from the final MCP call. No explanation, no markdown.

Error cases:
- No amount on create: `{"ok": false, "status": "error", "message": "无法识别消费金额"}`
- No match on delete: `{"ok": false, "message": "未找到匹配的消费记录"}`

---

## Examples

**CREATE**
```
source_text: "今天午饭花了68块，吃的日料"
```
→ create_asset: amount=68, category="餐饮", date="2026-05-21", description="午饭日料"

---

**CREATE**
```
source_text: "昨天买了一件外套，花了399"
```
→ create_asset: amount=399, category="购物", date="2026-05-20", description="买外套"

---

**UPDATE — correct amount**
```
source_text: "刚才记的日料应该是78块，不是68"
```
→ query_asset(asset_type="expense", contains="日料")
→ update_asset(asset_id=..., payload_patch={"amount": 78})

---

**DELETE**
```
source_text: "删除那笔打车的记录"
```
→ query_asset(asset_type="expense", contains="打车")
→ delete_asset(asset_id=...)
