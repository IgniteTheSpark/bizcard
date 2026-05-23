# Phase B — Eureka 架构蓝图

> 版本：v1.0 | 2026-05-24
> 状态：定稿
> 用途：Eureka 从零重建的架构基线。定义数据模型、模块边界、Agent 编排、API 契约、前端组件地图。Phase C(后端重建)、Phase D(前端重建)按此为准。

---

## 一、与 Phase A 的关系

本文档建立在 [Phase A 产品定义](phase-a-product-definition.md) 之上,把 Phase A 的产品决定 + 四条架构原则,落实成具体架构。

Phase A 的四条架构原则贯穿全文:
1. 生产级核心 + demo 级边缘,干净接缝
2. AI 体验生产级(流式 / 低延迟 / 自然)
3. 资产类型由 skill 产出、可扩展
4. 数据模型按生产级设计(多用户-ready / Transcript 一等实体 / 会议留位)

---

## 二、八项核心决定

| # | 主题 | 决定 |
|---|---|---|
| 1 | 多用户准备 | 不建 User 表;FastAPI 依赖 `get_current_user_id()` 做单一来源,demo 返回常量,上线时换鉴权实现 |
| 2 | MCP 接口形态 | 真 FastMCP server,stdio 子进程;ADK `MCPToolset` 标准接入;部署仍是单服务 |
| 3 | 对话上下文窗口 | 固定近 N=20 条消息窗口;长 transcript(会议)**不进 chat history**,走 MCP 工具(`query_transcript` / `get_transcript`)按需检索 |
| 4 | agent 编排 | 双形态 ADK:统一助手(单 LlmAgent + tools)+ Flash Pipeline(Python 编排 3 步、内部用 LlmAgent 实例);共用 MCPToolset;自定义 `PostgresSessionService` |
| 5 | Transcript / File / flash 关系 | 新增 `File`、`Transcript` 表;**取消 `flash` 资产类型**;所有派生资产用 `source_transcript_id` FK 关联 Transcript |
| 6 | 流式输出 | SSE。后端 `StreamingResponse` + `text/event-stream`;前端 `EventSource` |
| 7 | 呈现模式存储 | localStorage + `usePresentationMode()` hook 抽象;上线接鉴权时改 hook 内部实现,调用方不动 |
| 8 | 资产类型渲染 | D2 完整愿景:`UserSkill.render_spec` 受限 DSL 驱动统一 `SkillCard` 渲染器;5 个初始 skill 预置 spec;**demo 阶段就含 add-skill UI + design agent**,用户加 skill 时 AI 帮设计 card |

---

## 三、数据模型

PostgreSQL 16 + pgvector。

### 3.1 总览(ER)

```
User(隐式,demo 阶段不建表;user_id 字符串)
    │
    ├─ owns ─→ File          (音频元数据,demo 不写,真实硬件上线后启用)
    │              │
    │              └─ asr ─→ Transcript  (转录文本,可空 file_id 适配「typed」来源)
    │                            │
    │                            └─ derives ─→ Asset (派生资产 source_transcript_id)
    │
    ├─ owns ─→ Session       (App 层组织:daily / meeting / agent_chat)
    │              ├─ holds ─→ Transcript  (一对多)
    │              ├─ holds ─→ Asset
    │              └─ holds ─→ Message    (对话消息,服务于统一助手)
    │
    ├─ owns ─→ Asset         (todo / event / idea / expense / ...,payload JSONB)
    │              └─ indexed_by ─→ AssetField (倒排索引)
    │
    ├─ owns ─→ Contact       (名片,独立实体)
    │
    └─ owns ─→ UserSkill     (skill 注册表,含 payload_schema + render_spec)
                   └─ ref ─→ GlobalSkill
```

### 3.2 表定义

**file** —— 音频文件元数据(demo 不写,留位)
```
id              uuid pk
user_id         varchar(50) not null
storage_url     text                  ← 上线时填 GCS / OSS URL
file_type       varchar(50)           ← audio/mp4, audio/wav, ...
duration_sec    integer
source_tag      varchar(20)           ← flash | meeting
asr_status      varchar(20)           ← pending | processing | completed | failed
created_at      timestamptz
```

**transcript** —— 转录文本(一等实体)
```
id              uuid pk
user_id         varchar(50) not null
file_id         uuid fk file(id)      ← nullable;typed 来源没有 file
session_id      uuid fk session(id)
text            text not null
segments        jsonb                 ← meeting 时填 [{speaker: "Speaker 1", start: 0, end: 12.5, text: "..."}]
source          varchar(20) not null  ← voice_flash | typed | meeting
asr_provider    varchar(50)           ← web_speech | whisper | ...
language        varchar(10)           ← zh-CN, en-US, ...
created_at      timestamptz
INDEX(user_id, session_id, created_at)
INDEX(user_id, source, created_at)
```

**session** —— App 层组织(保留并精简 session_type)
```
id              uuid pk
user_id         varchar(50) not null
session_type    varchar(20) not null  ← daily | meeting | agent_chat
title           varchar(255)
date            date                  ← daily session 有,其它可空
created_at      timestamptz
INDEX(user_id, date desc)
```

**asset** —— 派生资产(取消 flash 类型,新增 source_transcript_id)
```
id                    uuid pk
user_id               varchar(50) not null
user_skill_id         uuid fk user_skill(id) not null   ← 强约束,asset 必属于某 skill
session_id            uuid fk session(id)
source_transcript_id  uuid fk transcript(id)             ← 可空(agent chat 直接 create_asset 时为空)
payload               jsonb not null                     ← 字段集由 user_skill.payload_schema 约束
created_at            timestamptz
INDEX(user_id, created_at desc)
INDEX(user_id, user_skill_id, created_at desc)
INDEX(user_id, source_transcript_id)
```
> 注:`payload.asset_type` 字段移除 —— 类型由 `user_skill_id` 链回 GlobalSkill.name 得到,不再硬编码进 payload。

**asset_field** —— 字段倒排索引(保留)
```
asset_id        uuid fk asset(id) on delete cascade
user_id         varchar(50)
field_name      varchar(100)
value_text      text
value_number    numeric
value_date      timestamptz
PK(asset_id, user_id, field_name)
INDEX(user_id, field_name, value_text)
INDEX(user_id, field_name, value_number)
INDEX(user_id, field_name, value_date)
```

**contact** —— 名片(轻量容器,保留)
```
id              uuid pk
user_id         varchar(50) not null
name            varchar(255) not null
phone           varchar(50)
company         varchar(255)
title           varchar(255)
email           varchar(255)
notes           text[]
created_at      timestamptz
INDEX(user_id, name)
```
> 未来手动 speaker↔contact 匹配预留:`transcript_speaker_link` 表,但本轮不建。

**message** —— 对话消息(保留,服务统一助手 + Flash Pipeline 出的 agent_summary 也走这)
```
id              uuid pk
session_id      uuid fk session(id) on delete cascade
user_id         varchar(50)
role            varchar(10)            ← user | agent | tool
text            text
tool_call       jsonb                  ← {name, args} when role=agent and tool was called
tool_result     jsonb                  ← when role=tool
cards           jsonb                  ← 资产卡片渲染数据(派生 asset 的引用 + 渲染快照)
elapsed_ms      integer
created_at      timestamptz
INDEX(session_id, created_at)
```

**global_skill** —— 全局 skill 元定义
```
id              serial pk
name            varchar(50) unique not null     ← todo, event, idea, contact_skill, expense, qa
description     text
created_at      timestamptz
```

**user_skill** —— 用户启用的 skill(含 schema 与 render_spec)
```
id                  uuid pk
user_id             varchar(50) not null
skill_id            integer fk global_skill(id)
display_name        varchar(100)
payload_schema      jsonb not null     ← 字段定义,见 §九
render_spec         jsonb not null     ← 受限 DSL,见 §九
queryable_fields    jsonb              ← [{field, index_type}]
created_at          timestamptz
UNIQUE(user_id, skill_id)
```

### 3.3 关键关系说明

- **Asset 一定从某个 UserSkill 出**(强 FK):新加资产类型 = 加 UserSkill,不需要改架构。
- **Asset.source_transcript_id 可空**:agent chat 中用户说「帮我建个待办」直接产生的资产无 transcript 来源。
- **Transcript 一对多 Asset**:一次闪念可能派生多个 asset(todo + expense + contact);会议同理。
- **Transcript ↔ Session 多对一**:一个 daily session 有多次闪念 transcripts;一个 meeting session 通常一条主 transcript。
- **Message 服务于对话流**:统一助手的对话 + Flash Pipeline 完成后的 agent_summary 都写进 message,前端用统一接口拉取。

---

## 四、后端模块结构

```
backend/
├── main.py                   FastAPI app 入口,挂路由,初始化生命周期
├── config.py                 settings(已存在,扩展)
│
├── core/
│   ├── auth.py               get_current_user_id() FastAPI 依赖(决定 #1)
│   ├── session_service.py    PostgresSessionService(继承 ADK BaseSessionService,决定 #4)
│   ├── streaming.py          SSE 工具:event 编码、心跳、断连处理(决定 #6)
│   └── llm.py                LLM 客户端配置(LiteLLM via OpenRouter)
│
├── db/
│   ├── database.py           async engine + session(已存在)
│   ├── models.py             SQLAlchemy 模型(按 §三 重定义)
│   ├── queries.py            通用查询工具(asset_fields 索引、结构化查询)
│   ├── migrations/           Alembic
│   └── seed.py               初始化 GlobalSkill + 5 个 UserSkill 的 spec(开发用)
│
├── api/
│   ├── chat.py               POST /api/chat   (SSE,统一助手对话)
│   ├── flash.py              POST /api/flash  (闪念 transcript ingest → Flash Pipeline)
│   ├── transcripts.py        GET  /api/transcripts/{id}
│   ├── sessions.py           GET  /api/sessions, GET /api/sessions/{id}/messages
│   ├── assets.py             CRUD /api/assets
│   ├── contacts.py           CRUD /api/contacts
│   └── skills.py             GET  /api/skills, POST /api/skills (add-skill + design agent)
│
├── agents/
│   ├── assistant.py          统一助手 LlmAgent + MCPToolset
│   ├── flash_pipeline.py     Python 编排 3 步:dispatcher → 并行 skill agents → 聚合
│   ├── design_agent.py       生成 payload_schema + render_spec 的 LLM agent
│   └── skill_factory.py      根据 UserSkill 注册表造 sub-skill LlmAgent
│
├── mcp/
│   ├── server.py             真 FastMCP server,暴露所有工具(决定 #2)
│   └── tools.py              工具实现,被 server.py 调用(保留并清理)
│
└── skills/
    └── (5 个 SKILL.md prompts:todo / event / idea / contact / expense / qa)
```

死代码 / 旧文件,在 Phase C 全部删除:
- `agents/root_agent.py`、`agents/flash_agent.py`(被 assistant.py / flash_pipeline.py 替代)
- `agents/query_agent.py` (并入 assistant.py)
- `api/query.py`、`api/flash_audio.py`(被 chat.py 替代;audio 暂缓)
- `scripts/fix_skills.py`(临时迁移脚本)
- 各文件里重复的 `tool_*` 包装

---

## 五、API 契约

### 5.1 POST /api/chat —— 统一助手(SSE)

请求:
```json
{
  "session_id": "uuid (optional, empty = create new agent_chat session)",
  "user_text": "用户这一轮的输入"
}
```

响应:`text/event-stream`,逐条 SSE event:
```
event: meta
data: {"session_id": "uuid"}

event: token
data: {"text": "已经"}

event: token
data: {"text": "为你"}

event: tool_call
data: {"name": "create_asset", "args": {...}}

event: tool_result
data: {"asset_id": "uuid", "card": {...spec + payload...}}

event: token
data: {"text": "创建了一个待办。"}

event: precipitate_option
data: {"text": "<最终的 agent 文字回复,可被用户『沉淀为资产』>"}  # 仅当本轮无 tool_call 时发

event: done
data: {"elapsed_ms": 2341, "message_id": "uuid"}
```

说明:
- `tool_call` / `tool_result` 用于前端实时显示资产卡片
- `precipitate_option` 在「无明确意图、纯生成」时出现,前端据此显示「沉淀为资产」交互(决定 Phase A §五)

### 5.2 POST /api/flash —— 闪念 transcript ingest

请求:
```json
{
  "text": "转录或文字内容",
  "session_id": "optional, default = today's daily session",
  "source": "voice_flash | typed"
}
```

响应:`text/event-stream`(同 SSE)或同步 JSON(待 Phase C 评估)。最终产物:
```json
{
  "transcript_id": "uuid",
  "session_id": "uuid",
  "derived_assets": [
    {"asset_id": "uuid", "user_skill_id": "uuid", "card": {...}}
  ],
  "summary": "已记录 3 项内容。",
  "elapsed_ms": 3214
}
```

### 5.3 GET /api/skills —— 获取 skill 注册表(前端启动用)

响应:
```json
{
  "skills": [
    {
      "user_skill_id": "uuid",
      "name": "todo",
      "display_name": "待办",
      "payload_schema": { ... },
      "render_spec": { ... }
    },
    ...
  ]
}
```

### 5.4 POST /api/skills —— 加 skill(design agent)

请求:
```json
{
  "description": "我想记录跑步训练"
}
```

响应:`text/event-stream`(design agent 流式输出):
```
event: payload_schema_draft
data: {"fields": [...]}

event: render_spec_draft
data: {...}

event: preview_payload
data: {...mock data for preview...}

event: done
data: {"draft_id": "uuid"}    # 用户审核后 POST /api/skills/{draft_id}/confirm 落库
```

### 5.5 其它(CRUD)

- `GET /api/sessions?type=daily&date=YYYY-MM-DD`
- `GET /api/sessions/{id}/messages`
- `GET /api/sessions/{id}/transcripts`
- `GET /api/assets?type=todo&limit=50&contains=...`
- `PUT /api/assets/{id}` (payload_patch 合并)
- `DELETE /api/assets/{id}`
- `GET /api/transcripts/{id}` —— 拉取完整 transcript text(给 MCP 工具用,也可直接调)
- `CRUD /api/contacts`

不再有 `/api/query`(并入 `/api/chat`);不再有 `/api/flash/audio`(暂缓)。

---

## 六、MCP server 工具集

`backend/mcp/server.py` 暴露(FastMCP):

| 工具 | 用途 |
|---|---|
| `create_asset(user_skill_name, payload, session_id?, source_transcript_id?)` | 创建资产,根据 skill 名查 user_skill_id |
| `query_asset(user_skill_name?, contains?, limit?)` | 查询资产 |
| `update_asset(asset_id, payload_patch)` | 更新 |
| `delete_asset(asset_id)` | 删除 |
| `create_contact(name, phone?, company?, title?, email?, notes?)` | 新建名片 |
| `query_contact(name_query?)` | 查名片 |
| `update_contact(contact_id, field, value)` | 更新名片字段 |
| `delete_contact(contact_id)` | 删除名片 |
| `query_transcript(contains, source?)` | 全文关键词搜索 transcripts |
| `get_transcript(transcript_id)` | 拉取完整 transcript(长文档懒加载) |

所有工具签名稳定 —— 跟 Phase A skill prompt 兼容,只是从「直接 import 函数」改为「ADK 通过 stdio 调」。

---

## 七、Agent 编排

### 7.1 统一助手(对话)

```python
# backend/agents/assistant.py
def make_assistant(user_id: str, session_id: str) -> LlmAgent:
    mcp_tools = MCPToolset(connection_params=StdioServerParameters(
        command="python", args=["-m", "mcp.server"],
        env={"USER_ID": user_id}
    ))
    return LlmAgent(
        name="assistant",
        model=ASSISTANT_MODEL,
        instruction=_load_prompt("assistant.md", session_id=session_id),
        tools=[mcp_tools],
    )
```

调用:`Runner(agent=..., session_service=PostgresSessionService()).run_async(...)` —— 流式 event 透传到 SSE。

System prompt 包含:
- 用户身份(为 personalization 留位)
- 当前日期、当前 session 信息
- 关联的 long transcripts ID 列表(让 agent 知道可以调 `query_transcript`)
- 行为规则:意图明确直接 CRUD,模糊则对答(Phase A §五)
- 可用工具说明(从 MCP server 自动获取)

### 7.2 Flash Pipeline

```python
# backend/agents/flash_pipeline.py
async def run_flash_pipeline(transcript_id: str, user_id: str) -> FlashResult:
    tx = await get_transcript(transcript_id)

    # Step 1: dispatcher
    intents = await dispatch(tx.text, user_id, today_str())

    # Step 2: 并行 sub-skill agents
    results = await asyncio.gather(*[
        run_intent(i, tx, user_id) for i in intents
    ])

    # Step 3: Python 聚合(无 LLM)
    return aggregate(results, tx.id)
```

`run_intent` 内部:
- 根据 intent.type 找 UserSkill,造一个 LlmAgent + MCPToolset
- 单回合调用,产出 result 含 asset_id

### 7.3 Design Agent

```python
# backend/agents/design_agent.py
async def design_skill(description: str) -> SkillDraft:
    # 一个 LlmAgent,输出受限 JSON schema:
    # { payload_schema: {...}, render_spec: {...}, sample_payload: {...} }
    # 用 response_schema 强约束
```

仅在加 skill 流程中用。

### 7.4 Session 管理

`core/session_service.py` 自定义 `PostgresSessionService(BaseSessionService)`:
- ADK 调 `get_session` / `append_event` 时读写 `session` + `message` 表
- 注入 context 时,用决定 #3 的策略:近 N=20 条消息 + system prompt(含 long transcript IDs)

---

## 八、前端模块结构

```
frontend-next/
├── app/
│   ├── layout.tsx
│   ├── page.tsx              入口(根据 presentation_mode 决定 home)
│   └── ...
│
├── components/
│   ├── AppShell.tsx
│   ├── shell/                top bar, fab, tab bar
│   ├── pages/
│   │   ├── ChatPage.tsx          AI 对话(决定 #6 SSE)
│   │   ├── TimelinePage.tsx      时间流
│   │   ├── CalendarPage.tsx      日历(新)
│   │   ├── LibraryPage.tsx       资产库(原 Workspace/Library 合并)
│   │   └── AssetDetailPage.tsx   资产详情
│   ├── chat/
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── AssetCardInChat.tsx
│   │   └── PrecipitateButton.tsx 「沉淀为资产」交互
│   ├── skill/
│   │   ├── SkillCard.tsx         统一 card 渲染器,读 render_spec
│   │   ├── GenericField.tsx      根据 spec 元素画字段
│   │   └── AddSkillWizard.tsx    加 skill UI(design agent 交互)
│   └── ui/                       基础 UI 元素
│
├── hooks/
│   ├── useChat.ts                SSE EventSource 封装
│   ├── useFlashCapture.ts        闪念输入 → /api/flash SSE
│   ├── useSkillRegistry.ts       skill 注册表加载 + SWR 缓存
│   ├── useAssets.ts              资产查询
│   ├── useSessions.ts
│   ├── useTranscript.ts
│   └── usePresentationMode.ts    localStorage 模式开关(决定 #7)
│
├── lib/
│   ├── api.ts                    HTTP / SSE 客户端
│   ├── sse.ts                    EventSource 工具(决定 #6)
│   ├── render-spec.ts            render_spec 类型 + 解析
│   └── types.ts
│
└── context/
    ├── NavContext.tsx
    └── PresentationModeContext.tsx
```

旧组件 Phase D 删除:
- `pages/StreamPage.tsx` → 重写为 `TimelinePage`
- `pages/WorkspacePage.tsx`、`pages/LibraryPage.tsx` → 合并重写
- `pages/FlashSessionPage.tsx`、`pages/FlashOverallPage.tsx` → 删,功能并入 ChatPage / TimelinePage
- `pages/DayViewPage.tsx`、`pages/PlaceholderPage.tsx` → 删
- 旧 `pages/AgentChatPage.tsx`、`AssetDetailPage.tsx` → 重写

---

## 九、渲染系统(render_spec DSL)

### 9.1 受限词汇表

```typescript
type RenderSpec = {
  card_layout: 'horizontal' | 'stacked' | 'inline' | 'compact'
  icon: string                            // emoji 或预定义 icon token
  accent_color: AccentColor               // 枚举,不允许任意 hex
  primary_field: string                   // payload 字段名
  primary_format?: FieldFormat            // 可选格式化
  secondary_field?: string
  secondary_format?: FieldFormat
  meta_fields?: Array<{field: string, format?: FieldFormat, label?: string}>
  actions?: Array<'check' | 'edit' | 'delete' | 'open'>
  // 位置渲染元数据
  timeline_position?: {time_field?: string, fallback: 'created_at'}
  calendar_render?: {date_field: string, time_field?: string}
}

type FieldFormat = 'text' | 'relative_date' | 'absolute_date' | 'time' | 'currency' | 'duration' | 'badge' | 'truncate_40'

type AccentColor = 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'gray' | 'neutral'
```

### 9.2 5 个初始 skill 的预置 render_spec

**todo**:
```json
{
  "card_layout": "horizontal",
  "icon": "✅",
  "accent_color": "blue",
  "primary_field": "content",
  "secondary_field": "due_date",
  "secondary_format": "relative_date",
  "actions": ["check", "edit"],
  "timeline_position": {"time_field": "due_date", "fallback": "created_at"},
  "calendar_render": {"date_field": "due_date"}
}
```

**event**:
```json
{
  "card_layout": "horizontal",
  "icon": "📅",
  "accent_color": "purple",
  "primary_field": "title",
  "secondary_field": "start_at",
  "secondary_format": "absolute_date",
  "meta_fields": [{"field": "duration_min", "format": "duration"}, {"field": "location"}],
  "actions": ["edit", "open"],
  "calendar_render": {"date_field": "start_at", "time_field": "start_at"}
}
```

**idea**:
```json
{
  "card_layout": "stacked",
  "icon": "💡",
  "accent_color": "amber",
  "primary_field": "title",
  "secondary_field": "content",
  "secondary_format": "truncate_40",
  "actions": ["edit", "open"]
}
```

**expense**:
```json
{
  "card_layout": "horizontal",
  "icon": "💰",
  "accent_color": "green",
  "primary_field": "amount",
  "primary_format": "currency",
  "secondary_field": "description",
  "meta_fields": [{"field": "category", "format": "badge"}, {"field": "date", "format": "absolute_date"}],
  "actions": ["edit"]
}
```

**contact**:
```json
{
  "card_layout": "horizontal",
  "icon": "👤",
  "accent_color": "neutral",
  "primary_field": "name",
  "secondary_field": "company",
  "meta_fields": [{"field": "title"}, {"field": "phone"}],
  "actions": ["edit", "open"]
}
```

### 9.3 统一渲染器

```typescript
// components/skill/SkillCard.tsx
<SkillCard
  spec={userSkill.render_spec}
  payload={asset.payload}
  onAction={(action) => ...}
/>
```

内部根据 `spec.card_layout` 选布局组件,根据 `primary_field` / `meta_fields` 等读 payload 画字段。**没有任何 if-type-equals**。

### 9.4 Add-skill Wizard

`AddSkillWizard.tsx`:
1. 用户描述新 skill —— textarea
2. 调 `POST /api/skills` —— SSE 流式接收 design agent 的 draft
3. 实时显示 schema + spec 预览,带 sample payload 渲染
4. 用户微调(改 icon / 改颜色 / 改字段顺序)
5. 确认 → 落库 → skill 立即可用

---

## 十、迁移策略(Phase C / Phase D 入口)

### 10.1 Phase C(后端)的实施顺序

1. **数据层先行**:写新 Alembic migration(0003_phase_b_schema)按 §三 重塑表;`seed.py` 写入 5 个 UserSkill 的 spec
2. **MCP server 实写**:`mcp/server.py` 暴露所有工具(决定 #2);`mcp/tools.py` 调整签名以适配新 schema(`user_skill_name` 替代 `asset_type`)
3. **core 层**:`auth.py`(决定 #1)、`session_service.py`(决定 #4)、`streaming.py`(决定 #6)、`llm.py`
4. **agents 层**:`assistant.py`、`flash_pipeline.py`(重写)、`design_agent.py`、`skill_factory.py`
5. **API 层**:`chat.py`、`flash.py`、`skills.py`、其它 CRUD
6. **清理死代码**:删 §四 列出的旧文件
7. **`nest_asyncio` 根因排查并清除**(实施时定位,大概率是 LiteLLM 内部 async pattern)

### 10.2 Phase D(前端)的实施顺序

1. **基础设施**:`lib/sse.ts`、`useChat.ts`、`useSkillRegistry.ts`、`render-spec.ts`、`usePresentationMode.ts`
2. **SkillCard 系统**:`SkillCard.tsx` + `GenericField.tsx` —— 渲染核心
3. **ChatPage**:统一对话,SSE 流式 + 沉淀交互
4. **TimelinePage / CalendarPage / LibraryPage / AssetDetailPage** —— 用 SkillCard 统一渲染
5. **AddSkillWizard**:add-skill 工作流 + design agent 接入
6. **应用 PresentationMode**:home 根据模式跳转
7. **删除旧组件**(§八列出)

### 10.3 数据迁移

demo 阶段无生产数据。Phase C 实施前清库重建:
```bash
docker compose down -v
docker compose up db -d
alembic upgrade head
python -m db.seed
```

---

## 十一、Phase B 输出验收

完成 Phase B = 本文档定稿 + 已得到用户同意。验收标准:
- ✅ 八项核心决定都有明确选择
- ✅ 数据模型可直接生成 Alembic migration
- ✅ API 契约可直接写 OpenAPI / 前端 SDK
- ✅ 后端 / 前端模块树可直接对应文件夹结构
- ✅ Phase C、Phase D 的实施顺序明确

Phase C / Phase D 各自启动时,会基于本文档展开各自的 spec(细化到任务 / 测试 / 校验标准)。
