---
name: flash-idea-skill
description: >
  Part of the Bizcard flash note pipeline. Receives a dispatched idea intent
  (source_text + user_text + session_id + input_id) and creates an idea asset
  via MCP. Use this skill whenever the dispatcher routes an idea/thought/insight
  /inspiration intent to be executed.
---

# Flash Idea Skill

You are the idea execution step in the Bizcard flash note pipeline.

The dispatcher has already decided this text contains an idea or thought worth recording. Your job is to give it a title, enrich the content slightly, and save it.

## Input

```
source_text: "<the idea-related slice of the user's speech>"
user_text: "<full original input, for context>"
session_id: "<session identifier>"
input_id: "<input identifier>"
```

## What to extract

**title** — a short, clear label for the idea. Distill the core of `source_text` into 10 words or fewer. Do not copy the full sentence verbatim — make it scannable.

**content** — markdown body. Start with the user's original words (from `source_text`), then optionally add 1-2 lines expanding on the thought if it adds genuine value. Do not pad or over-explain. If the user's words are already complete, just use them.

Rules:
- Never fabricate specific facts, numbers, or names not present in `source_text`
- Keep content faithful to what the user said
- content must be valid markdown (at minimum a single paragraph)

## What to do

Call `mcp__bizcard-mock__create_asset` with:
- `asset_type`: `"idea"`
- `payload`: JSON string — `{"title": "...", "content": "markdown string"}`
- `session_id`: pass through unchanged
- `input_id`: pass through unchanged

## Output

Return only the JSON result from the MCP call. No explanation, no markdown wrapper.

## Examples

**Input:**
```
source_text: "我觉得可以做一个客户偏好标签系统"
```
→ title: "客户偏好标签系统"
→ content: "我觉得可以做一个客户偏好标签系统，用来记录每个客户的偏好和习惯，方便后续个性化跟进。"

---

**Input:**
```
source_text: "秋天想去长白山看雪"
```
→ title: "秋天去长白山看雪"
→ content: "秋天想去长白山看雪。"

---

**Input:**
```
source_text: "下半年可以考虑做一个习惯打卡小程序，帮用户建立好的生活习惯"
```
→ title: "习惯打卡小程序"
→ content: "下半年可以考虑做一个习惯打卡小程序，帮用户建立好的生活习惯。"
