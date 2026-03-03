---
name: bizcard-search
description: Search and lookup bizcard assets (contacts, meetings, reminders). Use when the user wants to find, list, or get details—e.g. "who's at Acme", "list my reminders", "what did we discuss with Kevin", "get Alice's contact".
---

# Bizcard Search (CRUD · Read)

Use MCP tools to **search** or **get details** for contacts, meetings, and reminders. Tool names may be prefixed (e.g. `mcp_bizcard_demo_search_my_contacts`).

## Contacts

- **Search**: `search_my_contacts(query=, limit=)` — by name, company, email, title.
- **Details**: `get_contact_details(contact_id=, name=)` — provide one of contact_id or name; returns contact plus meeting_ids, reminder_ids.

## Reminders

- **List**: `list_my_reminders(limit=)` — all reminders with content, due_at, contact_name, source.

## Meetings

- **Search**: `search_my_meetings(participant_name=, topic_query=, from_date=, to_date=, limit=)` — use **topic_query** for "meetings about X" or "when we discussed X".
- **Summary**: `get_meeting_summary(meeting_id)` — full summary Markdown.
- **Transcript**: `get_meeting_transcript(meeting_id)` — raw transcript for deep detail.

| Asset     | Search / list           | Get one / details        |
|-----------|-------------------------|---------------------------|
| contacts  | search_my_contacts      | get_contact_details        |
| reminders | list_my_reminders       | (use list and match id)    |
| meetings  | search_my_meetings      | get_meeting_summary / get_meeting_transcript |

---

## Ask-Agent output (when channel is ask-agent)

When replying in **ask-agent** UI, return a **structured reply** with `blocks` so the App can render text + cards and deep links.

1. **Reply shape**: `{ "blocks": [ { "type": "text", "content": "..." }, { "type": "contact_card"|"meeting_card"|"reminder_card", "payload": {...} }, ... ] }`. Frontend renders all `text` blocks first, then cards below; order of blocks does not need to be strict.

2. **text block**: Give **only the direct answer** the user asked for.  
   - Example: if the user asks "Kevin's contact info", put in **text** only the phone/email (or whatever is directly needed to contact Kevin).  
   - Do **not** output full tables or long lists of all contact/meeting/reminder fields in the text. Full details are shown on the card and in the App detail page after the user taps "View details".

3. **Cards** (one block per entity you want to show):
   - **contact_card** — payload: `id`, `name`, `company`, `title`, `email`, `phone` (optional). For each contact you mention, add one `contact_card` so the user can tap to open contact detail in App.
   - **meeting_card** — payload: `meeting_id`, `title`, `meeting_at`, `summary_md` or short snippet. One block per meeting.
   - **reminder_card** — payload: `id`, `content`, `due_at`, `contact_name` (optional). One block per reminder.

So: **text = short, direct answer**; **cards = entities with minimal payload**; **full info = in App after tap**.
