---
name: bizcard-delete
description: Remove bizcard assets (contacts, meetings, reminders). Use when the user wants to delete or remove something—e.g. "delete contact John", "remove that reminder", "delete that meeting record".
---

# Bizcard Delete (CRUD · Delete)

Use MCP tools to **delete** contacts, reminders, and meetings. Resolve id from **bizcard-search** / list first.

## Contacts

- **Delete**: `delete_contact(contact_id=)`
  - Unlinks this contact from meeting_participants and reminders; then deletes the contact.

## Reminders

- **Delete**: `delete_reminder(reminder_id=)`
  - Get reminder_id from list_my_reminders.

## Meetings

- **Delete**: `delete_meeting(meeting_id=)`
  - Unlinks reminders that referenced this meeting; removes participants and the meeting. Get meeting_id from search_my_meetings.

| Asset     | Tool            |
|----------|-----------------|
| contacts | delete_contact  |
| reminders| delete_reminder |
| meetings | delete_meeting  |

Example: "delete the renewal reminder for Alice" → list_my_reminders, find the one for Alice → `delete_reminder(reminder_id=...)`.
