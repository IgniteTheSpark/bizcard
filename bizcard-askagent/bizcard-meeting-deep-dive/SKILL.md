---
name: bizcard-meeting-deep-dive
description: Deep analysis and secondary summary of a specific meeting. Use when the user wants to dig into one meeting—e.g. extract key points by topic, pull action items from transcript, combine with external info (web search), or produce tables, charts, or reports. Use when the user asks for "deep dive this meeting", "break down by topic", "extract action items from transcript", "compare with industry/competitor info", "generate a meeting report/chart". As the user's personal agent, use the user's preferences, profession, and domain (from Memory) as auxiliary context to tailor the analysis and terminology.
---

# Bizcard Meeting Deep Dive

When the user does **in-depth discussion or analysis** of a **specific meeting**, combine transcript, optional external search, and **user context** (preferences, profession, domain) to produce a **secondary summary** or **structured output** (tables, charts, reports) as requested.

## 1. Get meeting content

- **Transcript** (required for deep dive): `get_meeting_transcript(meeting_id)` via MCP. If meeting_id is unknown, use `search_my_meetings(...)` first (see **bizcard-search**).
- **Summary** (optional): `get_meeting_summary(meeting_id)` for existing structure (topics, next steps); use to align your secondary summary or to cross-check.

## 2. Use user context as auxiliary reference

You are the user's **personal agent**. Use **Memory** (MEMORY.md, HISTORY.md) for:
- **User preferences**: e.g. preferred summary style, level of detail, language.
- **Profession / domain**: e.g. industry terms, metrics they care about, so the analysis uses the right framing and terminology.
- **Past context**: e.g. "user often cares about timeline and owners" so you emphasize those in the secondary summary.

Weave this into the analysis without repeating it verbatim—tailor **what you extract and how you phrase it** to the user.

## 3. Extract and secondary summary

- From the **transcript**, extract information that matches the **user's focus** (e.g. action items, owners, timeline, conclusions, risks, topic breakdown).
- Produce a **secondary summary** that is more focused or structured than the first summary, e.g. by topic, by speaker, by action item, or by timeline.
- If the user asks for comparison with external facts (industry, competitors, standards), or for clarification of terms, use **web_search** (or equivalent) and then integrate results into the analysis.

## 4. External information when needed

- When the user asks to "combine with external info", "look up industry/competitors", or to validate/explain something with public knowledge: use **web_search** (or the agent's search tool), then summarize and tie back to the meeting content.
- Cite sources briefly when you use external results.

## 5. Output format (tables, charts, reports)

- **Tables**: Use Markdown tables (e.g. action item | owner | due).
- **Charts**: Use Mermaid in Markdown (e.g. timeline, flowchart) or describe a chart and suggest axes; if the stack supports image generation from description, use it when the user asks for "chart".
- **Reports**: Structure as Markdown sections (background, key conclusions, action items, risks, appendix) and optionally write to a file with `write`/`edit_file` if the user wants a saved report.

Deliver in the **form the user asked for** (report, chart, bullet list); if unclear, offer a short structured summary plus optional table/chart.

## Flow summary

1. Resolve **meeting_id** (search if needed) → get **transcript** (and optionally summary).
2. Load **user context** from Memory (preferences, domain, profession) as auxiliary reference.
3. **Extract** from transcript according to user focus → **secondary summary**; if needed, **web_search** and integrate.
4. **Format** output as requested (table, chart, report, or file).

---

## Ask-Agent output (when channel is ask-agent)

Reply with **blocks**: use **text** for your analysis (tables, charts, report in markdown).

**When to attach a meeting_card**:
- **User is already in this meeting’s context** (e.g. opened Ask from “问 Agent 关于这场会” on that meeting): **Do not** attach a meeting_card for the *same* meeting—they are already on it. Only attach cards for **other** meetings/contacts/reminders mentioned in the analysis.
- **User came from Global** (or other context) and asked to deep-dive **one** meeting: attach one **meeting_card** for that meeting so they can tap to open it in the App.

Same idea for contacts/reminders: add **contact_card** / **reminder_card** only when the analysis references **other** entities the user might want to open. See **bizcard-search** SKILL.md "Ask-Agent output" for payload shapes.
