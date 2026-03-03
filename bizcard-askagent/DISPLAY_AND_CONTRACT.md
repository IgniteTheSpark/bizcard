# 展示需求与 nanobot 响应约定

本文档主要关注 **ask-agent 内容的呈现**：用户通过 App 内问 Agent 入口提问，nanobot 返回的内容如何按类型、按场景在 chatbox 里展示。

---

## Ask-agent 呈现的三类场景

按用户意图与产出形态，ask-agent 的回复可以归纳为三类；每类对应不同的**呈现重点**和推荐的 **block** 组合。

### 1. 查（基础信息查询）

**典型问题**：上次开会聊了什么、Kevin 的联系方式是什么、明天有几个待办、和 Alice 相关的会议有哪些。

**呈现要点**：
- **以文本回答主要需求**：围绕用户**主要意图**在 `text` block 中直接给出答案（如「Kevin 的电话是 138xxx，邮箱是...」或「上次和 Kevin 的会主要聊了三点：…」），而不是把整张卡片的内容铺满气泡。
- **附带可跳转卡片**：在文本之后附上紧凑形态的 **contact / meeting / reminder** 卡片（如仅头像+姓名+查看详情），作为跳转到 App 内详情页的入口，方便用户深度查看或操作。

**block 组合示例**：`text`（直接给出核心答案）+ 若干 `contact_card` | `meeting_card` | `reminder_card`（作为附带跳转入口）。

---

### 2. 深入沟通（追问与深度探讨）

**典型场景**：用户基于某场会议、某个人或某个主题继续追问（如「这场会按话题拆一下」「和 Kevin 的几次会议总结成时间线」「结合行业信息分析一下」）。

**呈现要点**：
- **产出类型**：可能是用户明确要的形态（如**图表、表格、报告**），也可能是 agent 的**自然语言总结/分析**，多为 **markdown**（标题、列表、表格、代码块等）。
- **主载体**：以 `text` block 为主，内容为 MD；若后续支持「图表块」「表格块」可单独增加 block 类型，v1 也可用 MD 表格/描述 + 文字说明。
- 若回答中**再次引用**某条 contact/meeting/reminder，可附带对应卡片，便于跳转详情。

**block 组合示例**：以 `text`（MD 内容）为主；按需附带 `meeting_card` / `contact_card` / `reminder_card`。

---

### 3. 增/改（对 profile 或已有数据的修改）

**典型场景**：用户修改自己的 profile，或对已有联系人、提醒、会议等做增删改（如「把 Kevin 的电话改成 138xxx」「加一个提醒：下周三和 Alice 跟进」「把某条提醒改到下周一」）。

**呈现要点**：
- **操作确认**：用 `text` block 明确说明「已修改 / 已添加 / 已删除」以及改了什么（如「已把 Kevin 的电话更新为 138xxx」）。
- **修改后的实体卡片**：完成增/改后，把**更新后的**那条 contact / reminder / meeting 以对应卡片发出来，方便用户确认并跳转详情。即：`text`（确认语）+ 一个或多个 `contact_card` | `reminder_card` | `meeting_card`（当前状态）。

**block 组合示例**：`text`（修改确认）+ 若干 `contact_card` | `reminder_card` | `meeting_card`（展示修改后的数据）。

---

### 小结（三类与 block 的对应）

| 场景     | 用户意图           | 呈现重点                         | 主要 block 组合 |
|----------|--------------------|----------------------------------|------------------|
| **查**   | 问基础信息         | 主意图回复 + 关联资产可跳转卡片   | text + contact_card / meeting_card / reminder_card |
| **深入沟通** | 追问、深度分析 | 需求产出（图表/表格/报告或 MD）+ 必要时附带卡片 | 以 text（MD）为主，按需加卡片 |
| **增/改** | 改 profile 或数据  | 修改确认 + 修改后的实体卡片       | text（确认）+ contact_card / reminder_card / meeting_card |

三类都复用同一套基础 block（`text` + 三种资产卡片）；差异只在**谁为主、谁为辅**以及**卡片表达的是「命中的结果」还是「修改后的状态」**。这样 ask-agent 的内容呈现需求就聚焦在这三类上，便于前后端与 nanobot 对齐。

---

## 主要分工

**不完全是前端工作。** 分工如下：

| 层级 | 职责 |
|------|------|
| **前端（App chatbox）** | Super chat box：输入、消息列表、按 **JSON 契约**直接解析渲染（text、联系人卡片、会议卡片、提醒列表等）。 |
| **Nanobot** | 负责意图理解与推导，在响应中直接输出符合契约的结构化 JSON（包含核心解答 `text` 和相关实体的关键信息 `cards`）。 |
| **BizCard 后台** | 仅充当 API 网关，负责透传请求和响应，不再做二次格式组装。 |

---

## Agent 侧的结构化输出 (Skill 约束)

在梳理 Agent 返回数据的展示规范时，一个核心原则是：**前端直接基于一份标准的 JSON 契约来渲染排版，不管底层的意图和流程有多复杂。**

这套契约由 **Nanobot 的 Agent Skill** 直接约束和输出。Agent 在调用 MCP Tools 拿到数据后，直接在最后一轮的响应中，按照预设格式吐给前端。

---

## 主流 chatbox 是怎么做的？

多数产品采用下面几种方式之一；**没有**一种是让前端根据「用户问题」自主决定 block 类型。前端始终根据 **后端发来的内容**（纯内容或显式结构）来渲染。

### 1. Markdown / 纯文本（多数产品的默认）

- **后端**：返回一段 **文本**（常为 Markdown）：段落、列表、代码块、链接。
- **前端**：只有 **一套渲染器**（如 Markdown 解析 + 富文本组件）。不根据用户问题决定布局，只解析 **模型输出** 并渲染（标题、列表、代码等）。
- **谁决定长什么样？** **模型**（通过写 Markdown）。前端只是「模型写成什么样就按什么样渲染」。语义类型（卡片 / 列表 / 按钮）不区分，都是格式化文本。

例如：很多自建 chatbot、简单 ChatGPT 式界面、支持 markdown 的 Slack/Discord 机器人。

### 2. 后端发 content blocks（带类型结构）

- **后端**：返回 **content blocks** 数组，每项带 **type**（`text`、`image_url`、`tool_use` 等）和 payload，由 API 约定类型。
- **前端**：**按 type 渲染**（text → 文本组件，image → 图片组件）。不根据用户问题或纯文本猜测。
- **谁决定长什么样？** **后端 / API**。前端按类型做「傻瓜」渲染。

例如：**OpenAI**（`content[]` 含 `text` | `image_url` | `image_file`）、**Claude**（`text`、`tool_use`、`tool_result`、`thinking` 等）。流式时也会带 block 边界和类型。

### 3. 混合：文本用 Markdown，交互用结构化 blocks

- **后端**：简单回答用纯文本 / Markdown；需要富 UI（表格、卡片、按钮、表单）时发 **交互 block**（如 card、button、form）。
- **前端**：文本用 Markdown 渲染；已知 block 类型用对应组件。在 WhatsApp、Slack 等渠道常 **fallback 成文本**。
- **谁决定长什么样？** 后端决定何时发哪种格式；前端按类型渲染。

例如：Chat Data 的「Interactive Visual Responses」、支持「LLM 文本 + 结构化 UI 块」的 B2B 聊天搭建产品。

---

**小结**：渲染**从不**由用户问题单独驱动，始终由 **后端发什么** 驱动——要么 (1) 一段 text/markdown 由前端用一套渲染器解析，要么 (2) 带类型的 blocks 由前端按类型渲染。因此 ask-agent 要么只发 **markdown**（前端一套渲染器），要么发 **带类型 blocks**（我们约定契约，后端发类型，前端按类型渲染）。

---

## 约定的响应形状：Text + Cards (Attachments) 结构

基于“先展示文本，底部附带卡片提供跳转”的排版原则，我们将底层的结构从“扁平混排的 blocks 数组”明确收敛为 **`text` + `cards`** 的两层结构：

```json
{
  "text": "上次和 Kevin 的会议主要讨论了产品设计，他的联系方式是 138-xxxx-xxxx。\n\n另外提醒你明天有个相关的跟进待办。",
  "cards": [
    {
      "type": "meeting_card",
      "payload": {
        "meeting_id": "m1",
        "title": "Product Design Sync",
        "meeting_at": "2026-01-22T11:30:00Z"
      }
    },
    {
      "type": "contact_card",
      "payload": {
        "id": "c1",
        "name": "Kevin Chen",
        "title": "PM",
        "company": "Acme Corp"
      }
    },
    {
      "type": "reminder_card",
      "payload": {
        "id": "r1",
        "content": "跟进 Kevin 的需求",
        "due_at": "2026-01-23T18:00:00Z"
      }
    }
  ]
}
```

### 前端渲染要求 (Chatbox排版建议)

针对这种结构，前端在聊天气泡中的排版标准化为以下分层：

1. **上层：纯文本/Markdown 渲染区**
   - 直接将 `text` 字段交给 Markdown 渲染器，处理正文、列表、加粗等。用户一眼能看到解答的核心。
2. **底层：卡片附件区 (Cards Container)**
   - 如果 `cards` 数组不为空，则在文本下方渲染这些卡片。
   - **单张卡片**：100% 宽度铺满，或自然居中。
   - **多张卡片**：采用 **横向滚动 (Horizontal Scroll / Carousel)**，防止卡片堆叠导致气泡无限拉长。
   - 可在文本与卡片之间加一条极细的分割线，或微小的引导文字（如 `📁 相关引用`）进行视觉区隔。

---

## 采用方案：资产用基础卡片 + 其余用 markdown

因为我们的 **资产类型很具体**（联系人、提醒、会议），对它们做 **基础渲染**，其余保持普通 markdown。

### 原则

- **回答里出现某个联系人的完整名片** → 用 **简洁的联系人卡片 UI** 展示（姓名、公司、职位、邮箱等），用户可点击跳转到 App 内联系人详情。
- **回答里出现某条提醒** → 用 **简单提醒卡片**（内容、due_at、可选联系人），用户可点击跳转到提醒详情。
- **回答里出现某场会议** → 用 **简单会议卡片**（标题、meeting_at、可选摘要片段），用户可点击跳转到会议详情。
- **其余内容**（开场白、解释、列表、补充说明）→ 用 **普通 markdown** 在 `text` block 里渲染，不做特殊 UI，按标准 MD 解析。

因此 chatbox 具备：

1. **一套 markdown 渲染器**：处理 `text` blocks（默认用于正文和「其余」）。
2. **三种简单卡片组件**：对应三种资产类型，每种带可选 **「跳转详情」** 链接（deep link 到 App 内该联系人/提醒/会议）。

不需要很多 block 类型：只需 **text**（markdown）+ **contact_card**、**reminder_card**、**meeting_card** 表示具体资产。可选：若更喜欢「一屏多条提醒」可用 **reminder_list**；后续可加 **quick_reply** 做快捷操作。

### v1 的 Card 集合（精简）

| Card type        | 何时使用                           | App 渲染方式 | Payload 最小字段 |
|------------------|------------------------------------|--------------|-------------------|
| `contact_card`   | 提供了某联系人的完整信息作为附件入口 | 简洁卡片；点击 → 联系人详情 | `id`, `name`, `company`, `title`, `email`, `phone`（可选） |
| `reminder_card`  | 提供了某条提醒作为附件入口         | 简单卡片；点击 → 提醒详情 | `id`, `content`, `due_at`, `contact_name`（可选） |
| `meeting_card`   | 提供了某场会议作为附件入口         | 简单卡片；点击 → 会议详情 | `meeting_id`, `title`, `meeting_at`, `summary_md` 或短摘要 |

这样体验统一、简单：资产有清晰卡片和跳转详情，其余保持可读的 markdown。

---

## Skill 要不要指定 block 类型，还是只出内容？

两种衔接 **skill** 与 **展示** 的方式：

### 1. Skill（或按 skill 执行的 agent）输出 block 类型

- **思路**：在 skill 的说明里约定：向 ask-agent App 返回联系人/会议/提醒时，按展示约定格式化为 **带类型 blocks**（contact_card、reminder_list、meeting_summary 等）。
- **落点**：在 **SKILL.md** 写「ask-agent 渠道下使用 block 类型：…」，或在渠道专属 system prompt 里列出 block 类型与使用场景。
- **优点**：每个 skill 明确自己的结果该如何展示（联系人 → 卡片，提醒 → 列表）。单一来源。
- **缺点**：需要富 UI 的 skill 都要改、都要知道 block schema；agent 必须输出合法 JSON blocks。

即：**由 skill 驱动 block 类型**——「返回联系人时用 `contact_card` 且 payload 形状如此」；App 只负责渲染，不决定类型。

### 2. Skill 只出内容，App 负责渲染

- **思路**：Skill 只关心 **内容**（如良好的 markdown 或纯文本）。Agent 只返回 **一个内容块**（如一段 markdown）。App 只有一种 block 类型（如 `markdown`），渲染该字符串。没有 contact_card / reminder_list，全是 agent 产出的格式化文本。
- **落点**：不改 skill；仅回复形态是「一大段」。App chatbox = 一套富文本/markdown 渲染器。
- **优点**：简单。Skill 与展示解耦；不涉及 block schema。与当前 nanobot（纯文本/markdown）兼容。
- **缺点**：没有联系人/会议/提醒的原生 UI（无卡片、无结构化列表、无快捷按钮），全是「agent 写的那段字」。

即：**skill 不指定 block 类型**，只产出内容，App「直接渲染」这段内容在一个 block 里。

### 3. Agent 根据 Skill 直接产出完整结构化 JSON

- **思路**：Skill 在约束文本输出的同时，要求 Agent 如果认为需要给用户展示特定资产，就在响应中直接把这些资产详情按照 `cards` 数组的格式输出。前端直接拿到 `{ "text": "...", "cards": [...] }` 结构。
- **落点**：针对性的 Agent Skill：Skill 负责意图与是否挂载的判断（比如在会议上下文内不重复挂载会议卡片），并由大模型直接生成最终的展示结构。
- **优点**：兼顾了 Agent 的上下文感知能力（由 Skill 保证防冗余和逻辑约束），且彻底去除了后端的二次拦截与格式组装层，架构极其轻量，真正做到了“Agent as a UI builder”。
- **缺点**：大模型需要吐出部分 UI 卡片所需的 JSON 结构，需要依赖模型稳定的 JSON 输出能力（现代模型如 GPT-4 / Claude 3.5 已完全具备）。

**结论**：这是我们最终在 BizCard 中采用的设计（详见 `SKILL_PRD.md` 和 `APP_PRD.md` ），它将意图决策和格式产出都交给了大模型（Skill），做到了最极致的前后端解耦。

---

## Nanobot 如何产出这种结构

- **最终敲定方案：Agent Skill 强约束输出 JSON**：Agent 在独立 Skill 的约束下，直接输出包含精简文本 `text` 和目标实体对象 `cards` 数组的 JSON 结构；后端仅做透传，前端直接解析渲染。

---

## Ask-agent 还可考虑的功能（建议）

在「查 / 深入沟通 / 增改 + 结构化呈现」之外，从体验和产品角度可以考虑：

| 能力 | 说明 | 优先级建议 |
|------|------|------------|
| **快捷入口 / 建议问题** | 进入 ask-agent 时展示几条常用问题（如「我明天有什么待办」「最近和 Kevin 的会议要点」），减少冷启动时的空白感。 | 高，实现简单 |
| **从卡片/详情反查** | 在联系人/会议/提醒详情页提供「问 Agent 关于 TA/这场会/这条提醒」的入口，带着上下文（如 contact_id）打开 chatbox，便于追问。 | 中高 |
| **多轮上下文** | 用户连续追问时，agent 能基于本会话内已出现的 contact/meeting/reminder 理解「把**这个**改到下周一」等指代。依赖 session（见下）。 | 必须（若支持多轮） |
| **语音输入** | 在 chatbox 内支持语音转文字再发给 agent，适合移动端。 | 中，按平台能力 |
| **导出/分享** | 将某轮问答或某段会话导出为文本/图片/链接，便于留存或分享（注意脱敏）。 | 中低 |
| **「正在处理」与取消** | 长耗时请求（如深度分析）时展示 loading 或进度，并支持用户取消。 | 中 |

与「呈现」强相关的已写在前面三类场景；上表是**体验增强**，可按版本迭代。

---

## 打开 App 后要不要展示之前的聊天记录？

**建议：要展示，但需约定范围和策略。**

- **为什么展示**：用户再次打开 App 时期望看到「上次聊到哪了」，便于延续话题、对照之前的回复（如某张名片、某场会议）做操作。不展示则每次都是新对话，体验割裂。
- **展示范围可选**：
  - **方案 A**：只展示**当前 session** 的历史（见下「是否 session-based」）。本次打开 App 后的对话在当次使用内可见；下次打开若 session 重置则从空开始。
  - **方案 B**：**持久化最近 N 条会话**（按用户维度存，如最近 1 个或 3 个「会话」），打开 App 时默认进入「最近一次未关闭的会话」或展示会话列表（最近几条），用户可点进某条继续看。
  - **方案 C**：持久化**全部历史**，并支持按时间/主题浏览；实现和存储成本更高，适合「对话即知识库」的产品定位。

**建议 v1**：至少做到 **当前 thread 内历史在当次打开时完整展示**（即进入某条对话后，该 thread 的消息在 chatbox 内可滚动查看）。所有 thread 统一进入 chat history 列表（不管是通过后端的 Session 管理还是前端的缓存，都可以拉取过往记录）。

---

## 是否需要 session-based？

**需要。**
Nanobot 侧用 `session_key` 管理会话历史；ask-agent 的**一条对话**= 一个 **thread**，对应一个 session_key。同一 thread 内的消息都带该 session_key，agent 才能拿到多轮历史；所有 thread 共享**全局 memory**（如 MEMORY.md）。因此 **session-based（按 thread）是必须的**。

---

## Chat history 列表 + 双入口（General / Context-based）

用户**无论从哪个入口**进入问询（全局入口，或某 meeting/contact/reminder 详情内的入口），都会在**同一份 chat history 列表**里看到并进入。每个列表项是一条**对话**；每条对话有自己独立的**上下文**，同时所有对话共享一份**全局 memory**。下面先约定命名和结构，再说明双入口与列表的关系。

---

### 命名：Thread 还是 Session？

- **建议产品侧统一叫 thread（线程/对话）**：用户看到的「一条对话」= 一个 **thread**。UI 上可用「会话」「对话」等中文，后端和文档里用 **thread** 表示这一概念，避免和「登录 session」「HTTP session」混淆。
- **后端/nanobot 侧仍用 session 管理**：nanobot 的 `session_key` 对应「当前在聊的那条 thread」。即：**一个 thread = 一个 session_key**；session 是技术实现，thread 是产品概念。列表里存的是 thread 的元数据（thread_id、标题、来源、时间等），打开某条 thread 时用该 thread 的 session_key 拉取/续写消息。

下文统一用 **thread** 表示「一条对话」，用 **session_key** 表示 nanobot 侧与该 thread 绑定的会话键。

---

### 统一的 Chat history 列表与展示范围

- **入口与默认视图**：用户点击**中间突出的 Ask Agent** 后，**直接进入新对话**（主输入框为页面核心，参考 ChatGPT/Gemini）；Chat history 通过**汉堡按钮**在**侧边**展示，不占首屏。
- **Chat history 的展示范围**（重要）：
  - **从 Global 入口进入**：侧边只展示**当次 app 进程内**产生的 global threads。即本次打开 App 后新建的「新对话」都会出现在侧边；**每次进入 Ask（进程仍在）都展示当次的这份列表**。进程重启后是否持久化可按产品约定（v1 可仅当次进程）。
  - **从 Context-based 入口进入**：侧边只展示**该 context 下的 threads**（如该 meeting 下的所有对话）。从另一 meeting/contact/reminder 进入则看到另一份列表。即 **context 入口 → 该 context 的 chat history**；**global 入口 → 当次进程的 chat history**。
- **每条列表项 = 一个 thread**：有唯一 `thread_id`、标题/首句/时间、可选来源。点进某条即主区展示该 thread 的消息流；可随时通过侧边切换或点「新对话」。
- **每个 thread 有自己的上下文**；**所有 thread 共享全局 memory**。

---

### 双入口：General Ask Agent vs Context-based Ask Agent

与竞品类似，ask-agent 有**两种入口**，但**都写入同一份全局的 chat history 列表**；差异只在「是否带预置 context」和「初始的对话 hint」。

#### 1. General Ask Agent（全局入口）

- **入口**：底部 **4 个 Tab + 1 个突出的 Ask Agent**（中间位置，视觉突出）。点击后**直接进入新对话**，主界面以主输入框为核心；Chat history 通过汉堡按钮在侧边展示，**仅展示当次 app 进程内的 global threads**。
- **初始 hint**：展示 general 类 hint（如「我明天有什么待办」「Kevin 的联系方式」「上次和 Alice 开会聊了什么」），引导用户发问。

#### 2. Context-based Ask Agent（某 meeting / contact / reminder 详情内）

- **入口**：在**某 meeting / contact / reminder 详情页**内的悬浮操作栏（Floating Action Bar）。
- **进入后**：可新建或进入该 context 下已有 thread；**初始 hint** 为基于该 context 的 hint（如会议：「按话题拆一下」「总结这场会的待办」「给参会人发跟进邮件」）。
- **Chat history 侧边**：展示**全局的统一列表**（无论从哪进入，侧边栏的历史记录都应该是共享且一致的）。Session key 示例：`ask_agent:meeting:{meeting_id}:{thread_id}` 等。

#### 3. 对比小结

| 维度 | General 入口 | Context-based 入口 |
|------|--------------|---------------------|
| 入口位置 | 底部**中间突出的 Ask Agent**（4 Tab + 1 Ask） | 某 meeting / contact / reminder 详情页内 (悬浮栏) |
| 进入后默认 | **直接新对话**（主输入框 + general hint） | 新对话或该 context 已有 thread（context hint） |
| Chat history 侧边 | 全局共享的会话列表 | 全局共享的会话列表 |
| Thread 绑定 | 无预置实体 | 绑定 meeting_id / contact_id / reminder_id |
| 全局 memory | 共享 | 共享 |

这样：**Global 入口** = 直接新对话 + 侧边展示全局 chat history；**Context 入口** = 该 context 的 hint + 全局 chat history。每个 chat 是一个 **thread**，各有自己的上下文，同时共用一份**全局 memory**。

---

## 首页与导航栏：加入 Ask Agent 后的建议

基于当前首页设计（个人 profile 卡片、今日会议、Reminders、Scan to Add / Start Capture、底部 BizCard / Calendar / Contacts / Messages / Me）与「统一 chat history + 双入口」的约定，对**首页布局**和 **Nav bar** 的调整建议如下。

### 首页布局是否需要大改？

**建议：首页主体布局可保持不变，Ask Agent 不嵌在首页内容里。**

- **当前首页的定位**：更像「工作台」——一眼看到 profile、今日会议、待办提醒、快捷操作（Scan / Start Capture）。信息密度已经不低，若再在首页塞入 chat history 列表或一个大块 Ask 区域，会拉长首屏、分散焦点。
- **Ask Agent 的形态**：我们约定的是「统一 chat history 列表 + 点进某条 = 一个 thread 的对话」。这类**以对话列表为主体的界面**，更适合作为**独立的一屏**（类似 ChatGPT 的对话列表 + 当前对话），而不是嵌在首页的某个 section 里。
- **建议做法**：
  - **首页保持**：Profile 卡片、今日会议、Reminders、底部浮动按钮、空态（无会议/无提醒）的展示逻辑都不变。
  - **不在首页放 Ask 入口**：Ask Agent 已作为底部 Tab 主入口（见下「Nav bar」），用户从 Ask Tab 进入即可；首页不再增加「Ask anything…」或 Ask 按钮，避免重复与分散心智。
  - 不推荐：在首页直接展开 chat history 列表或内嵌完整 chatbox，否则首页会过长、与「工作台」定位冲突。

**结论**：首页**不必为 Ask Agent 做大规模布局调整**；保持现有结构，通过 **Tab 或轻量入口** 进入 Ask Agent 即可。

### Nav bar 是否需要调整？

**当前**：5 个 Tab——BizCard（首页）、Calendar、Contacts、Messages、Me。Calendar / Contacts 已是独立能力入口。

**建议：Messages 收敛到 Me，空出的位置给 Ask Agent；Ask Agent 放在底部中间并突出；首页不放 Ask 入口。**

| 方案 | 做法 | 说明 |
|------|------|------|
| **推荐** | **Messages 收敛到 Me**；底部为 **4 个 Tab + 1 个 Ask Agent**：BizCard、Calendar、**（Ask Agent，中间突出）**、Contacts、Me。点击 Ask Agent 后**直接进入新对话**（主输入框为核心），Chat history 通过**汉堡按钮**在侧边展示。 | Ask Agent 为突出主功能；不占常规 Tab 序列；进入即新对话，历史在侧边。 |
| 备选 | 若暂不调整 Messages：可保留 5 Tab 或 6 Tab，Ask 仍以「直接新对话 + 侧边 history」为准。 | 仅在不想动 Messages 时考虑。 |

**首页**：不放置 Ask 入口；用户从底部 Ask Agent 进入即可。

**Calendar、Contacts**：保持现有 Tab 即可，无需为 Ask Agent 单独调整；context-based 的「问 Agent 关于这场会/这个人」仍从各详情页内进入，与 Tab 并列。

### Messages 收敛到 Me；Ask 作为主 Tab 后首页不再放 Ask 入口

- **Messages 的定位**：当前本质是**所有 notifications**（通知汇总）。可将 Messages **收敛到 Me 页**：在 Me 下增加「通知」或「Messages」区块，用户从 Me 进入查看通知即可。这样底部 Tab 从 5 个变为 **BizCard、Calendar、Contacts、Ask、Me**（Messages 不再占独立 Tab，空出的位置给 Ask Agent）。
- **Ask 已作为主 Tab 时，首页是否还要放 Ask 入口？**  
  **不需要。** Ask Agent 已是 Tab 上的主功能入口，用户有明确路径「点 Ask Tab → chat history / 新对话」；首页再放一个「Ask anything…」或 Ask 按钮会**重复**，且分散心智。建议：**Ask 仅保留 Tab 入口**，首页不再增加 Ask 的独立入口；若后续数据表明用户从首页发起问询的诉求很强，再考虑在首页加轻量快捷方式。

---

## 后续步骤

1. **锁定 v1 的 block 类型与 payload**（如 text、reminder_list、contact_card、meeting_summary、quick_reply）。
2. **在本文档（或 SCHEMA.md）中写清** 每种类型的展示契约。
3. **App 前端** 实现 super chat box，并按 block 类型渲染。
4. **Nanobot**（或 ask-agent 适配层）在 App 的 ask-agent 入口按约定结构返回。

若方向没问题，可再细化 schema（字段名、更多 block 类型），并确定「结构化回复」在 nanobot 还是适配层组装。
