---
name: bizcard-edit
description: Update existing bizcard assets (contacts, meetings, reminders). Use when the user wants to change or correct something—e.g. "update Kevin's phone to 138xxx", "move the Friday report deadline to next Monday", "update that meeting's summary".
---

# Bizcard Edit (CRUD · Update)

Use MCP tools to **update** contacts, reminders, and meetings. Only pass fields that change. IDs come from **bizcard-search** / list.

## Contacts

- **Update**: `update_contact(contact_id=required, name=, company=, title=, phone=, email=, social_media=, notes=)`
  - Get contact_id from search_my_contacts or get_contact_details.

## Reminders

- **Update**: `update_reminder(reminder_id=required, content=, due_at=, contact_id=)`
  - Get reminder_id from list_my_reminders.

## Meetings

- **Update**: `update_meeting(meeting_id=required, title=, meeting_at=, transcript=, summary_md=, summary_audio_url=, participant_contact_ids=)`
  - `participant_contact_ids` = comma-separated contact ids. Get meeting_id from search_my_meetings.

| Asset     | Tool            |
|----------|-----------------|
| contacts | update_contact  |
| reminders| update_reminder |
| meetings | update_meeting  |

Example: "move the Friday report deadline to next Monday" → list_my_reminders to find id → `update_reminder(reminder_id=..., due_at="...")`.

---

## Ask-Agent output (when channel is ask-agent)

When replying in **ask-agent** UI after updating an asset, return **structured reply** with `blocks`:

- **text** block: brief confirmation only (e.g. "Updated Kevin's phone to 138xxx."). Do not list all fields in the text.
- **Card** for the updated entity: one `contact_card`, `reminder_card`, or `meeting_card` with the agreed payload (see bizcard-search Ask-Agent section) so the user can tap to open detail in App.

Reply shape: `{ "blocks": [ { "type": "text", "content": "..." }, { "type": "contact_card"|"reminder_card"|"meeting_card", "payload": {...} } ] }`.
