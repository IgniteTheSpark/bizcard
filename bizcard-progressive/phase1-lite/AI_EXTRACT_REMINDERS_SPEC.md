# AI 从会议纪要提取 Reminders — Input / Output / Prompt 规范

> **目标**：从会议总结/纪要中自动提取可操作的待办事项（Reminders），作为 Meeting 详情页「AI Suggested」的数据来源。  
> **约定**：提取结果默认 **日期 = 会议日期**、**联系人 = Self**，由用户在后端或前端 Accept 后写入；本规范只定义「提取」的输入、输出与 Prompt 逻辑。

---

## 1. Input（输入）

### 1.1 建议的 Input 结构

调用 AI 时建议传入一个 **单个 JSON 对象**，包含会议上下文与待分析文本，便于模型同时利用结构化摘要和原文。

```json
{
  "meetingId": "meeting_001",
  "meetingTitle": "Product Design Sync",
  "meetingDate": "2026-01-22",
  "language": "zh",
  "summary": "此次会议主要讨论了 Contact 页面的设计，重点在于如何将 meeting summary 与人名关联，以便于检索。",
  "summaryData": {
    "overview": "此次会议主要讨论了 Contact 页面的设计...",
    "background": {
      "participants": "Kevin Chen, Alice Wang 及其他相关人员",
      "roles": "Kevin (决策者)、Alice (讨论者)",
      "purpose": "讨论 Contact 页面的设计方案"
    },
    "keyConclusions": [
      "将 meeting summary 与 Contact 页面的人名关联",
      "需要 UI 设计和 PD 描述支持"
    ],
    "topics": [
      {
        "title": "Contact 页面设计",
        "opinion": "将 meeting summary 与人名关联，方便检索",
        "detail": "...",
        "conclusion": "明确了下一步的具体行动"
      },
      {
        "title": "下一步行动",
        "opinion": "需要 UI 设计和 PD 描述",
        "detail": "...",
        "conclusion": "明确了下一步的具体行动"
      }
    ],
    "highlights": [
      "\"我觉得接下来就是让 UI 的小伙伴一起设计一下，然后让 PD 同学出一份 PRD...\""
    ],
    "risks": []
  }
}
```

> 上述示例**不包含** `transcript`，以避免长会 transcript 过长导致的不合理输入；Reminder 提取以 summary / summaryData 为主（见 1.4）。

### 1.2 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `meetingId` | string | ✅ | 会议唯一 ID，便于与会议绑定。 |
| `meetingTitle` | string | 建议 | 会议标题，帮助模型理解场景。 |
| `meetingDate` | string (YYYY-MM-DD) | ✅ | 会议日期；未提取到具体日期时，Reminder 默认使用此日期。 |
| `language` | string | 建议 | 纪要/摘要主要语言，如 `zh` / `en`，用于要求输出语言一致。 |
| `summary` | string | 建议 | 会议总结短文（1–2 段），通常已包含结论与下一步。 |
| `summaryData` | object | 可选 | 结构化纪要（overview / background / keyConclusions / topics / highlights / risks）。若已有则传入，便于模型聚焦「结论」与「下一步」。 |
| `transcript` | string | 见下 | **不推荐**作为 Reminder 提取的主输入；若必须使用，需做长度限制或分段/采样（见 1.4）。 |

### 1.3 使用策略（优先级）

- **推荐：仅用 `summary` + `summaryData` 作为 Reminder 提取的输入。**  
  总结/纪要已经压缩了会议要点，信息密度高、长度可控，适合直接送进模型且效果更稳定。
- **不推荐：把完整长 transcript 作为输入。**  
  长会 transcript 可能动辄几万字符，会导致上下文超长、成本高、延迟大、且噪音多，不利于稳定抽取（见 1.4）。
- **统一传入 `meetingDate`**：用于输出中的 `dueDateHint` 以及后端默认日期。

### 1.4 长时间会议与 Transcript 的处理

**问题**：长时间会议的 transcript 会非常长，若整篇作为输入不合理：

| 风险 | 说明 |
|------|------|
| 上下文超限 | 单次请求易超出模型 context window，导致截断或失败。 |
| 成本与延迟 | Token 过多，调用贵、耗时长。 |
| 信噪比低 | 大量无关对话会干扰模型，待办易遗漏或重复。 |

**建议**：

1. **Reminder 提取的默认输入 = summary + summaryData，不传 transcript。**  
   流程上应确保「先产总结/纪要，再调 Reminder 提取」；提取接口只消费摘要类字段。

2. **若当前没有 summary/summaryData（例如尚未生成）**：  
   - **方案 A（推荐）**：先异步生成会议总结/纪要，再对总结/纪要做 Reminder 提取；不直接对 raw transcript 做一次性抽取。  
   - **方案 B**：若必须从 transcript 抽，则**不要传全文**，而是：  
     - 对 transcript 做**长度上限**（例如只取前 N 个字符/词，或前若干分钟对应段落），并在文档和接口中明确上限（如 8k 字符）；或  
     - 先做**分段摘要**（按时间或主题切块，每块用模型生成一两句摘要），再对「分段摘要」做 Reminder 提取。

3. **在接口契约中明确**：  
   - `transcript` 为可选；  
   - 若传 `transcript`，调用方需保证长度不超过约定上限（例如 6000–8000 字符），超长时由调用方先截断或先 summarise 再传入。

---

## 2. Output（输出）

### 2.1 建议的 Output 结构

AI 返回一个 **JSON 对象**，便于解析、去重和与会议关联。

```json
{
  "reminders": [
    {
      "title": "UI 设计团队进行 Contact 页面设计",
      "dueDateHint": null
    },
    {
      "title": "PD 团队撰写 PRD 描述",
      "dueDateHint": "2026-01-25"
    }
  ],
  "language": "zh"
}
```

### 2.2 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `reminders` | array | ✅ | 提取出的 Reminder 列表。 |
| `reminders[].title` | string | ✅ | 一条待办的主题文案，用户可见、可编辑。应简洁、可执行。 |
| `reminders[].dueDateHint` | string \| null | 可选 | 若纪要中明确提到日期/时间（如「周五前」「下周三」），用 `YYYY-MM-DD`；否则为 `null`，后端用 `meetingDate`。 |
| `language` | string | 建议 | 与 input 的 `language` 一致，便于前端/多语言处理。 |

### 2.3 与现有前端/后端约定对齐

- 前端「AI Suggested」当前为 **字符串数组**（仅 title）。  
- 两种兼容方式任选其一：  
  - **方案 A**：后端/网关将 AI 返回的 `reminders[]` 转为 `string[]`（只取 `title`），前端不改。  
  - **方案 B**：前端改为消费 `reminders[]`，并在一期只展示 `title`；若某条有 `dueDateHint`，Accept 时优先用该日期，否则用 `meetingDate`。

---

## 3. Prompt 逻辑（要点）

### 3.1 角色与任务

- **角色**：从会议纪要/总结中抽取「待办事项」的助手。  
- **任务**：只输出用户或团队**需要去执行**的、可勾选完成的具体事项，且每条一句话概括（title）。

### 3.2 抽取规则（Do）

- 抽取明确承诺或分配：  
  「……我会在下周五前提交」「Kevin 负责跟进」「我们下周要定稿」→ 提取为一条 Reminder，必要时用 `dueDateHint`。
- 抽取结论中的下一步：  
  如 summaryData.topics 的 conclusion、keyConclusions、highlights 中提到的「下一步」「需要做」。
- 每条 Reminder：  
  - 用 **一句简洁的中文或英文**（与 `language` 一致）描述「谁/什么时间点要做什么」或「要做什么」；  
  - 若原文有明确日期/相对日期且能推算，则填写 `dueDateHint`（YYYY-MM-DD），否则填 `null`。

### 3.3 不抽取（Don't）

- 泛泛表述：如「我们会保持沟通」「后续再讨论」不单独成条，除非有具体交付物或时间点。
- 纯事实陈述：如「已经完成了 UI 设计」不当作待办。
- 重复：同一件事只保留一条，选更具体的那条。

### 3.4 输出格式与约束

- 严格输出 **仅一个 JSON 对象**，且可被 `JSON.parse` 解析。  
- 不输出 markdown 代码块包裹（或约定可 strip 掉 \`\`\`json ... \`\`\`）。  
- 若无任何可抽取的 Reminder，返回 `{ "reminders": [], "language": "zh" }`。

### 3.5 示例 Prompt（可直接或微调使用）

```text
你是一个从会议纪要中提取「待办事项」的助手。根据下面提供的会议信息，只提取用户或团队需要去执行的具体事项，每条用一句话概括。

【抽取规则】
- 只提取：有明确动作、责任人或时间点的承诺或下一步（如「某人负责…」「下周五前…」「需要撰写 PRD」）。
- 不提取：泛泛的「再沟通」「后续讨论」、或已经完成的事实陈述。
- 同一件事只保留一条，选更具体的一条。
- 若原文中有明确日期或可推算的相对日期（如「周五前」「下周三」），在 dueDateHint 中写出 YYYY-MM-DD；否则 dueDateHint 填 null。会议日期已提供，可作为参考。

【输出格式】
只输出一个合法 JSON 对象，不要用 markdown 代码块包裹，格式如下：
{
  "reminders": [
    { "title": "一条待办描述", "dueDateHint": null 或 "YYYY-MM-DD" }
  ],
  "language": "zh 或 en"
}

【会议信息】
- 会议日期：{{meetingDate}}
- 会议标题：{{meetingTitle}}
- 语言：{{language}}

会议总结/纪要：
{{summary}}

（若存在结构化 summaryData，此处可追加 summaryData 的 JSON 或关键字段摘要）
```

将上述 `{{meetingDate}}`、`{{meetingTitle}}`、`{{language}}`、`{{summary}}` 等替换为 1.1 中 Input 的对应字段即可。

**说明**：本 Prompt 假定输入为**会议总结/纪要（summary / summaryData）**，**不传入完整长 transcript**，以避免长会文本带来的上下文与成本问题（见 1.4）。

---

## 4. 与现有流程的衔接

| 环节 | 说明 |
|------|------|
| **触发时机** | 会议总结/纪要生成完成后调用本 AI 接口（或异步任务），写入 `summaryData.nextActions` 或等价字段。 |
| **Accept 后** | 后端/前端用 `meetingDate` 与 `dueDateHint`：若 `dueDateHint` 非空则用其作为默认日期，否则用 `meetingDate`；联系人默认 **Self**。 |
| **去重** | 若某条 AI 建议的 `title` 与已有 My Calendar 中同 meeting 的某条 Reminder 的 title 相同或高度相似，可视为已存在，不再重复写入（或在 UI 上不再展示为「未处理」）。 |

---

## 5. 小结

- **Input**：会议 ID、标题、日期、语言 + 会议总结（summary）与/或结构化纪要（summaryData）与/或 transcript。  
- **Output**：`{ reminders: [ { title, dueDateHint } ], language }`，其中 `dueDateHint` 可为 null。  
- **Prompt**：强调「只抽可执行、有动作/责任/时间的待办」「一条一句」「输出纯 JSON」「无则 reminders 为空数组」。  

按此规范实现后，即可用 AI 输出驱动 Meeting 详情页的「AI Suggested」列表，并与现有默认「会议日期 + Self」逻辑兼容。
