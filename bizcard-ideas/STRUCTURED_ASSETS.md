# BizCard 结构化资产梳理

本文档梳理当前讨论到的五类**结构化资产**：Notes、Reminder、Idea、Event、Contact。目的是明确各自定义、边界、**是否可合并**以及**关联关系**。

---

## 1. 五类资产定义与边界

| 资产 | 定义 | 核心属性（最小） | 边界说明 |
|------|------|------------------|----------|
| **Note** | 用户**被动捕获**或**主动衍生**的内容：会议、闪念、手输、**想法**。 | 类型（meeting / 闪念 / manual / **idea**）、总结、Transcript、录音、内容、时间等。 | 以「一条记录」为粒度；想法（Idea）归类为 Note 的一种类型（type=IDEA），与会议/闪念/手输并列。 |
| **Reminder** | 用户或 Agent 产生的**待办/提醒**，具时间点与完成态。 | 标题、时间点、来源（常为某 Note）、done、可选关联 Note。 | 以「一条待办」为粒度；可独立存在，也可挂到 Note/后续 Idea Note。 |
| **Idea** | **Note 的一种类型**（type=IDEA）：用户主动发起、基于一条或多条 Note、由 AI 生成的衍生产出。 | 同 Note 基类 + content、ideaType、sourceNoteIds 等。 | 以「一条 Note」为粒度；在列表与筛选中与会议/闪念/手输并列，必须关联 ≥1 条来源 Note。 |
| **Event** | 日历上的**日程**：有明确开始/结束，来自同步（如 Google）或本地创建。 | 标题、start、end、全天、来源/calendarId、参会人、地点、描述等；**briefing**（会前/会后内容块，可选，作为 Event 的属性）。 | 以「一个日程槽」为粒度；与 Note 不同——Note 是「已发生并被记录」的内容，Event 是「计划或已同步的日程」。 |
| **Contact** | **人物**实体，作为参会人/提及对象被关联到其他资产。 | 名称、标识（如邮箱/手机）、可选头像等。 | 以「一个人」为粒度；不单独成主流程，主要作为关联对象出现。 |

**说明**：**Briefing**（会前 briefing / 会后回溯）不作为独立资产，而是 **Event 的属性**：在 Event 上挂会前/会后内容块，用于会前准备或会后回顾；同一 Event 可有会前 + 会后。在 Event 详情（及对应会议 Note 详情）中展示为该 Event 的 Briefing 区块。

---

## 2. 可否合并

| 维度 | 结论 | 说明 |
|------|------|------|
| **Note 与 Event** | **不合并为同一实体** | Event = 日历上的日程（计划或同步）；Note = 一次捕获（会议/闪念）。同一场会议可以既有 Event（日历上的日程）又有 Note（录音与总结）；在日历上「历史会议」用 Event 卡片承载 Note 的展示，但底层仍是两套数据。 |
| **Note 与 Idea** | **Idea 归入 Note** | Idea 作为 Note 的一种类型（type=IDEA）存在；关系仍是「来源 Note → Idea Note」，但 Idea 与会议/闪念/手输同属 Notes 体系，在列表与筛选中并列。 |
| **Reminder 与 Note/Event** | **不合并** | Reminder 是待办点，Note/Event 是内容或日程；Reminder 可「关联到」某 Note（或某 Event），但自身是独立资产。 |
| **Contact 与其余** | **不合并** | Contact 是人物主数据，其余资产可「关联人物」；Contact 作为关联侧存在。 |
| **Event 与「会议 Note」的展示** | **展示层统一** | 在日历上，会议 Note 用 **Event 卡片** 形式展示、用同一套详情页（即 Note 详情）；数据层 Event 与 Note 仍分开，仅展示与详情页复用。 |

**总结**：五类资产**不做实体级合并**；通过**关联关系**串联。展示层上，会议 Note 可复用 Event 卡片与详情页，以减少重复建设。

---

## 3. 关联关系（谁连谁）

- **Note → Reminder**：一条 Note 可关联多条 Reminder（会议/闪念里「关联的 Reminders」）。
- **Reminder → Note**：一条 Reminder 可有「来源 Note」；在 Note 详情中展示「关联的 Reminders」即依赖此关系。
- **Note → Idea**：一条 Note 可被多条 Idea 引用（作为 sourceNoteIds 之一）；Idea 详情展示来源 Notes。
- **Idea → Note**：每条 Idea 必须关联 ≥1 条 Note（sourceNoteIds）；Note 详情可展示「关联的 Ideas」。
- **Note → Contact**：一条 Note 可关联多条 Contact（会议/闪念里「关联的人物」）。
- **Contact → Note**：反查「该人物出现在哪些 Note」可做，属展示/查询层。
- **Event → Contact**：Event 的参会人可以是 Contact 或仅展示用字符串；若统一用 Contact，则 Event 关联 Contact。
- **Event 的 Briefing**：Briefing 是 **Event 的属性**（会前/会后内容块），不是独立资产；Event 详情中展示 Briefing 区块。若该 Event 对应已发生的会议并有 Note，同一 Briefing 可在 Note 详情中复用展示。
- **人物（Contact）的关联**：已在上述体现——**Note → Contact**（会议/闪念里「关联的人物」）、**Event → Contact**（参会人）；Contact 侧可反查「出现在哪些 Note / 哪些 Event」。
- **Reminder ↔ Event**：Reminder 可「挂到某日」或「关联到某 Event」（如「会议 A 的跟进」）；当前以「日期 + 来源 Note」为主，与 Event 的关联可选。
- **Idea ↔ Reminder**：目前未强制；后续可支持「从 Idea 创建 Reminder」，则 Idea → Reminder。

下图用文字表达（箭头表示「关联到」）：

```
                    ┌─────────┐
                    │ Contact │
                    └────┬────┘
                         │ 关联
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │  Note    │◄───│  Event   │    │ Reminder │
   │(会议/闪念/│    │(日程+    │    │ (待办)   │
   │ 手输/想法)│    │ Briefing)│    └────▲─────┘
   └────┬─────┘    └──────────┘          │
        │ 来源             │ 展示         │ 来源/关联
        │ (Idea Note       │ (会议 Note   │
        │  引用来源 Note)   │  用 Event    │
        │                  │  卡片展示)   │
        └──────────────────┴─────────────┘
```

- **Note**：包含会议/闪念/手输/**想法**（Idea 为 Note 类型之一）；被 Reminder（来源）、Contact（关联人物）指向；Idea Note 指向来源 Note（sourceNoteIds）；会议 Note 在日历上用 Event 卡片展示。
- **Event**：可关联 Contact（参会人）；**Briefing 为 Event 的属性**（会前/会后内容）；与 Note 在「会议」场景下通过展示层统一，数据层分离。
- **Reminder**：指向 Note（来源）；可选指向 Event；未来可从 Idea Note 创建 Reminder。
- **Idea（Note 类型）**：Idea Note 指向来源 Note（sourceNoteIds）；Note 反查「关联的 Ideas」。
- **Contact**：被 Note、Event 引用；支持反查「该人物出现在哪些 Note / 哪些 Event」。

---

## 4. 小结表（速查）

| 资产 | 可否与其它合并 | 主要关联 |
|------|----------------|----------|
| **Note** | 否；与 Event 仅在「会议」展示上复用卡片与详情 | ← Reminder（来源）、← Contact（关联人物）；Idea Note ← 来源 Note（sourceNoteIds）；会议 Note 用 Event 卡片展示 |
| **Reminder** | 否 | → Note（来源）；可选 → Event |
| **Idea（Note 类型）** | 已归入 Note | Idea Note → 来源 Note（sourceNoteIds）；Note 展示「关联的 Ideas」 |
| **Event** | 否；与会议 Note 展示统一、数据分离 | → Contact（参会人）；**含 Briefing 属性**（会前/会后）；会议 Note 以 Event 形式展示 |
| **Contact** | 否 | ← Note（关联人物）、← Event（参会人）；双向均可反查 |

如需，我可以把这份梳理同步到各模块（如 `bizcard-calendar`、`bizcard-ideas`）的 README 或 ROADMAP 里，并在文档中引用本资产说明。
