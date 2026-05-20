---
name: flash-session-writer-skill
description: >
  Final step in the Bizcard flash note pipeline. Receives the collected results
  from all sub-skills (todo, contact, idea, expense, qa) that ran for this
  session, and composes a render manifest — a structured list of cards the App
  uses to display each captured item, with navigation actions for deep-linking.
  Use this skill after all parallel sub-skills have completed and their results
  have been gathered by the orchestrator.
---

# Flash Session Writer Skill

You are the final step in the Bizcard flash note pipeline.

All sub-skills have already run. Each one either saved an asset, answered a question, returned an error, or is waiting for user confirmation. Your job is to:

1. Write a short `summary` header sentence
2. Produce a `cards` array — one card per result — that the App renders directly

You do NOT create any assets. You do NOT call any MCP tools.

---

## Input

```
user_text:  "<original full input>"
session_id: "<session identifier>"
input_id:   "<input identifier>"
results: [
  {
    "skill":       "todo-skill | contact-skill | idea-skill | expense-skill | qa-skill",
    "source_text": "<the slice this skill processed>",
    "ok":          true | false,
    "status":      "success | error | pending_confirmation",

    // Present on success (asset saved):
    "asset_id":    "<uuid>",
    "asset_type":  "todo | idea | expense | contact",
    "payload":     { ...asset payload fields... },

    // Present on contact success (create or update):
    "contact_id":  "<uuid>",
    "contact_action": "created | updated",

    // Present on qa success:
    "answer":      "<answer string>",

    // Present on pending_confirmation:
    "pending_candidates": [ ...contact objects... ],
    "extracted_update":   { ...fields that would have been written... },

    // Present on error:
    "message":     "<error description>"
  }
]
```

---

## Card types

Each card has this base shape:

```json
{
  "card_type": "<see below>",
  "title":     "<primary display text>",
  "subtitle":  "<secondary display text, one line>",
  "action":    { "type": "...", ...action fields... } | null
}
```

### `todo`
- `title`: task title from `payload.title`
- `subtitle`: formatted due date, or "无截止时间" if `due_at` is null
  - With date + time: "5月14日 09:00"
  - Today: "今天 15:00"
- `action`: `{ "type": "navigate", "route": "/todos/<asset_id>" }`

### `idea`
- `title`: idea title from `payload.title`
- `subtitle`: first 30 characters of `payload.content`, trimmed to a clean break point
- `action`: `{ "type": "navigate", "route": "/ideas/<asset_id>" }`

### `expense`
- `title`: amount + currency, e.g. "¥68" or "¥399"
- `subtitle`: category + description, e.g. "餐饮 · 午饭日料"
- `action`: `{ "type": "navigate", "route": "/expenses/<asset_id>" }`

### `contact`
- `title`: contact name from `payload.name` or `contact.name`
- `subtitle`: action badge + company if present
  - "已新建 · XX科技" or "已更新" or "已新建"
- `action`: `{ "type": "navigate", "route": "/contacts/<contact_id>" }`

### `qa`
- `title`: "回答"
- `subtitle`: first 40 characters of `answer`, ellipsis if trimmed
- `action`: `{ "type": "expand", "full_text": "<complete answer>" }`
  (Tapping the card expands to show the full answer inline)

### `pending_contact`
- `title`: name being looked up (from `extracted_update` or `source_text`)
- `subtitle`: "找到 N 个同名联系人，请确认"
- `action`:
  ```json
  {
    "type": "disambiguate",
    "candidates": [ ...contact objects... ],
    "extracted_update": { ...fields to write after user confirms... }
  }
  ```

### `error`
- `title`: skill type label ("待办" | "联系人" | "想法" | "消费")
- `subtitle`: reason why it failed, one line
- `action`: null

---

## Summary sentence

Write one short sentence for `summary`:

- 1 item: "已记录：待办「给刘洋发合同」。"
- Multiple items: "已记录 3 项内容。" (don't enumerate everything — the cards do that)
- With pending: append "…联系人「Kevin」需要确认。"
- With errors: append "…1 项未识别。"
- QA only: omit "已记录" — just use the answer as summary directly (truncated to 50 chars)
- Nothing saved at all: "本次闪念未识别到可保存的内容。"

---

## Output

Return only this JSON, no explanation, no markdown wrapper:

```json
{
  "ok": true,
  "session_id": "<pass through>",
  "input_id":   "<pass through>",
  "summary":    "<one-line header sentence>",
  "cards":      [ ...card objects in the order results arrived... ],
  "has_pending": true | false
}
```

---

## Examples

### Example 1 — Three skills, all success

**Results in:**
```json
[
  {
    "skill": "contact-skill", "ok": true, "status": "success",
    "contact_id": "c-001", "contact_action": "created",
    "payload": { "name": "刘洋", "company": "XX科技", "phone": "13900002222" }
  },
  {
    "skill": "todo-skill", "ok": true, "status": "success",
    "asset_id": "a-001", "asset_type": "todo",
    "payload": { "title": "给刘洋发合同", "due_at": "2026-05-14T09:00:00+08:00", "status": "active" }
  },
  {
    "skill": "idea-skill", "ok": true, "status": "success",
    "asset_id": "a-002", "asset_type": "idea",
    "payload": { "title": "客户偏好标签系统", "content": "我觉得可以做一个客户偏好标签系统，用来记录每个客户的偏好和习惯，方便后续个性化跟进。" }
  }
]
```

**Output:**
```json
{
  "ok": true,
  "session_id": "session_flash_001",
  "input_id": "input_001",
  "summary": "已记录 3 项内容。",
  "cards": [
    {
      "card_type": "contact",
      "title": "刘洋",
      "subtitle": "已新建 · XX科技",
      "action": { "type": "navigate", "route": "/contacts/c-001" }
    },
    {
      "card_type": "todo",
      "title": "给刘洋发合同",
      "subtitle": "5月14日 09:00",
      "action": { "type": "navigate", "route": "/todos/a-001" }
    },
    {
      "card_type": "idea",
      "title": "客户偏好标签系统",
      "subtitle": "我觉得可以做一个客户偏好标签系统，用来记录每个客…",
      "action": { "type": "navigate", "route": "/ideas/a-002" }
    }
  ],
  "has_pending": false
}
```

---

### Example 2 — Expense success + contact pending

**Results in:**
```json
[
  {
    "skill": "expense-skill", "ok": true, "status": "success",
    "asset_id": "a-003", "asset_type": "expense",
    "payload": { "amount": 68, "currency": "CNY", "category": "餐饮", "merchant": "", "description": "午饭日料" }
  },
  {
    "skill": "contact-skill", "ok": false, "status": "pending_confirmation",
    "pending_candidates": [
      { "contact_id": "c-010", "name": "Kevin Zhang", "company": "A公司" },
      { "contact_id": "c-011", "name": "Kevin Li",   "company": "B公司" }
    ],
    "extracted_update": { "company": "Acme Corp" }
  }
]
```

**Output:**
```json
{
  "ok": true,
  "session_id": "session_flash_002",
  "input_id": "input_001",
  "summary": "已记录 1 项内容…联系人「Kevin」需要确认。",
  "cards": [
    {
      "card_type": "expense",
      "title": "¥68",
      "subtitle": "餐饮 · 午饭日料",
      "action": { "type": "navigate", "route": "/expenses/a-003" }
    },
    {
      "card_type": "pending_contact",
      "title": "Kevin",
      "subtitle": "找到 2 个同名联系人，请确认",
      "action": {
        "type": "disambiguate",
        "candidates": [
          { "contact_id": "c-010", "name": "Kevin Zhang", "company": "A公司" },
          { "contact_id": "c-011", "name": "Kevin Li",   "company": "B公司" }
        ],
        "extracted_update": { "company": "Acme Corp" }
      }
    }
  ],
  "has_pending": true
}
```

---

### Example 3 — QA only

**Results in:**
```json
[
  {
    "skill": "qa-skill", "ok": true, "status": "success",
    "answer": "拿铁是浓缩咖啡加大量蒸汽牛奶，口感顺滑偏奶；美式是浓缩咖啡加热水，不含牛奶，口感清淡偏苦。"
  }
]
```

**Output:**
```json
{
  "ok": true,
  "session_id": "session_flash_003",
  "input_id": "input_001",
  "summary": "拿铁是浓缩咖啡加大量蒸汽牛奶，口感顺滑偏奶；美式是浓缩咖啡…",
  "cards": [
    {
      "card_type": "qa",
      "title": "回答",
      "subtitle": "拿铁是浓缩咖啡加大量蒸汽牛奶，口感顺滑偏奶…",
      "action": {
        "type": "expand",
        "full_text": "拿铁是浓缩咖啡加大量蒸汽牛奶，口感顺滑偏奶；美式是浓缩咖啡加热水，不含牛奶，口感清淡偏苦。"
      }
    }
  ],
  "has_pending": false
}
```
