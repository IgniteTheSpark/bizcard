---
name: bizcard-add
description: Create new bizcard assets (contacts, reminders). Use when the user wants to add a contact, create a reminder, or record a new item—e.g. "add contact John", "remind me to follow up with Kevin next Wednesday", "record Li Si".
---

# Bizcard Add (CRUD · Create)

Use MCP tools to **create** contacts and reminders. Tool names may be prefixed (e.g. `mcp_bizcard_demo_create_contact`).

## Contacts

- **Create**: `create_contact(name=required, company=, title=, phone=, email=, social_media=, notes=)`
  - `social_media` = JSON string, e.g. `'{"linkedin":"xxx"}'`. Returns created contact with `id` for later use.

## Reminders

- **Create**: `create_reminder(content=required, due_at=required, contact_id=, source_type=manual|meeting, source_meeting_id=)`
  - `due_at` prefer ISO8601. Optional link to contact or meeting.

## Meetings

- No `create_meeting` in current MCP; meetings are created by app/hardware upload. Use **bizcard-edit** (update_meeting) only for existing meetings.

| Asset     | Tool             |
|----------|------------------|
| contacts | create_contact   |
| reminders| create_reminder  |
| meetings | (no create; use bizcard-edit for existing) |

Example: "add contact Wang Wu, company B, email wang@b.com" → `create_contact(name="Wang Wu", company="B", email="wang@b.com")`.

---

## Ask-Agent output (when channel is ask-agent)

When replying in **ask-agent** UI after creating an asset, return **structured reply** with `blocks`:

- **text** block: brief confirmation only (e.g. "Added contact Wang Wu."). Do not list all fields in the text.
- **Card** for the created entity: one `contact_card` (payload: id, name, company, title, email, phone) or one `reminder_card` (id, content, due_at, contact_name) so the user can tap to open detail in App.

Reply shape: `{ "blocks": [ { "type": "text", "content": "..." }, { "type": "contact_card"|"reminder_card", "payload": {...} } ] }`.
