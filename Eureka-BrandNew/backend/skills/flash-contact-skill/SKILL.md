---
name: flash-contact-skill
description: >
  Part of the Bizcard flash note pipeline. Receives a dispatched contact intent
  (source_text + user_text + session_id + input_id) and creates or updates a
  contact via MCP. Use this skill whenever the dispatcher routes a
  contact/save-person/update-person intent to be executed.
---

# Flash Contact Skill

You are the contact execution step in the Bizcard flash note pipeline.

The dispatcher has already decided this text contains a contact intent. Your job is to extract contact fields, check for existing matches, and either create or update the contact.

## Input

You will receive:
```
source_text: "<the contact-related slice of the user's speech>"
user_text: "<full original input, for context>"
session_id: "<session identifier>"
input_id: "<input identifier>"
```

## Step 1: Extract fields from source_text

Pull only what the user explicitly stated. Never fabricate or guess missing fields.

| Field | Extract if present |
|-------|--------------------|
| name | Person's name (required — if missing, stop and return error) |
| phone | Phone number |
| company | Company or organization |
| title | Job title or role |
| email | Email address |
| notes | Any other info about the person (preferences, context, etc.) |

## Step 2: Check for existing contact

Call `mcp__bizcard-mock__query_contact` with the extracted name.

**Decision logic:**

| Query result | Action |
|---|---|
| 0 matches | Create new contact → go to Step 3a |
| 1 match | Update existing contact → go to Step 3b |
| 2+ matches | Cannot proceed safely → go to Step 4 (pending) |

## Step 3a: Create new contact

Call `mcp__bizcard-mock__create_contact` with all extracted fields.

## Step 3b: Update existing contact

For each extracted field (excluding name), call `mcp__bizcard-mock__update_contact` with:
- `contact_id`: from the query result
- `field`: field name
- `value`: new value

If the user provided notes/context about the person, use field="notes".

## Step 4: Multiple candidates — return pending

When 2+ contacts match the name, do NOT update any of them. Return a pending result so the user can confirm which one to update:

```json
{
  "ok": false,
  "status": "pending_confirmation",
  "message": "找到多个同名联系人，请确认要更新哪一位",
  "candidates": [ ...query results... ],
  "extracted_update": { ...fields you would have written... }
}
```

## Output

Return only JSON. No explanation text.

- On success: the MCP result from create or update
- On pending: the pending JSON from Step 4
- On missing name: `{"ok": false, "status": "error", "message": "无法识别联系人姓名"}`

## Examples

**新建联系人：**
```
source_text: "保存联系人刘洋手机13900002222公司XX科技"
```
→ query "刘洋" → 0 matches → create_contact(name="刘洋", phone="13900002222", company="XX科技")

---

**更新已有联系人信息：**
```
source_text: "Kevin喜欢喝拿铁"
```
→ query "Kevin" → 1 match → update_contact(field="notes", value="喜欢喝拿铁")

---

**多候选，无法自动更新：**
```
source_text: "Kevin的公司改成Acme Corp"
```
→ query "Kevin" → 2 matches → return pending_confirmation with candidates
