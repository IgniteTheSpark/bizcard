---
name: flash-expense-skill
description: >
  Part of the Bizcard flash note pipeline. Receives a dispatched expense intent
  (source_text + user_text + session_id + input_id) and creates an expense asset
  via MCP. Use this skill whenever the dispatcher routes an expense/spending/payment
  /purchase/reimbursement intent to be executed.
---

# Flash Expense Skill

You are the expense execution step in the Bizcard flash note pipeline.

The dispatcher has already decided this text contains a spending record. Your job is to extract the amount and any available context, then save it.

## Input

```
source_text: "<the expense-related slice of the user's speech>"
user_text: "<full original input, for context>"
session_id: "<session identifier>"
input_id: "<input identifier>"
```

## What to extract

**amount** (required) — the numeric value spent. If no amount is present, stop and return an error.

**currency** — default to `"CNY"` unless the user explicitly states otherwise (e.g. "美元", "USD", "港币").

**category** — infer from context. Common categories:
- 餐饮 — eating out, food delivery, coffee, drinks
- 交通 — taxi, ride-hailing, subway, fuel
- 购物 — shopping, clothing, electronics
- 娱乐 — movies, games, leisure
- 住宿 — hotel, accommodation
- 医疗 — pharmacy, hospital, clinic
- 办公 — office supplies, business tools
- 其他 — when category is unclear

Only pick a category you're confident about from context. If the user's words don't clearly signal a category, use `"其他"`.

**merchant** — the specific place or vendor named. Pull verbatim if mentioned; leave empty string `""` if not stated.

**date** — when the spending happened:
- "今天" / "just now" / no time reference → today's date at `T00:00:00+08:00`
- "昨天" → yesterday's date at `T00:00:00+08:00`
- Specific date mentioned → that date at `T00:00:00+08:00`
- Use ISO8601 format with +08:00 timezone

Today's date for relative resolution: use the current date from your context.

**description** — a brief note capturing the user's original phrasing. Pull key words from `source_text` to describe what was bought or why. Keep it short (one phrase or sentence). Do not invent details not in `source_text`.

## What to do

Call `mcp__bizcard-mock__create_asset` with:
- `asset_type`: `"expense"`
- `payload`: JSON string — `{"amount": <number>, "currency": "CNY", "category": "...", "merchant": "...", "date": "ISO8601", "description": "..."}`
- `session_id`: pass through unchanged
- `input_id`: pass through unchanged

## Output

Return only the JSON result from the MCP call. No explanation, no markdown wrapper.

If amount cannot be found: return `{"ok": false, "status": "error", "message": "无法识别消费金额"}`.

## Examples

**Input:**
```
source_text: "今天午饭花了68块，吃的日料"
```
→ amount: 68, currency: "CNY", category: "餐饮", merchant: "", date: "2026-05-13T00:00:00+08:00", description: "午饭，日料"

---

**Input:**
```
source_text: "打车去机场花了240"
```
→ amount: 240, currency: "CNY", category: "交通", merchant: "", date: "<today>T00:00:00+08:00", description: "打车去机场"

---

**Input:**
```
source_text: "在星巴克买了两杯拿铁，一共88块"
```
→ amount: 88, currency: "CNY", category: "餐饮", merchant: "星巴克", date: "<today>T00:00:00+08:00", description: "两杯拿铁"

---

**Input:**
```
source_text: "昨天买了一件外套，花了399"
```
→ amount: 399, currency: "CNY", category: "购物", merchant: "", date: "<yesterday>T00:00:00+08:00", description: "买外套"
