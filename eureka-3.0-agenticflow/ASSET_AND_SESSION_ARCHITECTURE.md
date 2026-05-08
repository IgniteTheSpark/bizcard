# 资产与 Session 统一架构

**版本**：v0.5  
**状态**：草案  
**关联文档**：
- [FLASH_NOTE_SKILL_ARCHITECTURE.md](./FLASH_NOTE_SKILL_ARCHITECTURE.md)（闪念 Skill 细节）
- [APP_PRD.md](./APP_PRD.md)（App 入口、Session 与展示边界）

---

## 一、设计哲学：Skill 即产品功能

本系统的终极目标是构建一个**以 Skill 为扩展单元的内容生产平台**。

**产品、技术、前端的解耦边界**：

```
PM 定义 Skill
    ├── 触发条件：什么语义输入匹配这个 Skill
    ├── 输出 Schema：产出什么结构的 JSON
    └── 类型标签：asset_type 的值（如 "expense"、"todo"、"idea"）

Agent（运行时）
    └── 用户输入 → dispatcher 匹配 Skill → 执行 → 输出 JSON

后端
    └── 统一存储 { asset_type, payload, session_id, input_id, created_at }
    └── 默认不理解 payload 业务语义；必要时可按 asset_type 做平台能力所需的字段抽取

前端
    └── 新 asset_type → 新入口 + 新渲染模板
    └── 按 asset_type 从后端取数，放入对应容器展示
```

**新增一个产品功能的完整路径**：
1. PM 写一个新 Skill 的触发描述和输出 Schema
2. 在 dispatcher 注册表里加一行触发条件
3. 前端新增对应 `asset_type` 的渲染模板和入口
4. 后端保持统一存储；只有当该类型需要平台级能力（如推送、排序、提醒调度）时，才按需抽取必要字段

> **示例：记账功能**
> 用户闪念说「刚才在星巴克花了 38 块，两杯拿铁」→ dispatcher 匹配 `expense-skill` → 输出 `{ asset_type: "expense", payload: { amount: 38, location: "星巴克", ... } }` → 后端统一存储 → 前端账本入口取所有 `asset_type="expense"` 的记录渲染账本。

---

## 二、三张核心数据表

系统由三张独立的数据表构成，职责完全分离：

```
files 表        基础设施层：原始文件 + 解析内容 + 文件专属扩展字段
contacts 表     业务实体层：联系人，独立生命周期，支持增删改查
assets 表       内容生产层：所有 Skill 产出的结构化内容，后端对 payload 透明
```

**关联关系只存在于以下三处，全部由用户主动操作建立，系统不自动推断**：

```
File.speakers[].contact_id     音频说话人 → Contact（用户手动关联）
File.attachments[].file_id     音频现场附件 → 其他 File（用户手动关联）
Contact.update_log[]           记录哪些 Session/Input 改动过这条联系人
```

assets 表内部没有任何横向关联。所有 asset 只通过 `source_session_id` + `source_input_id` 溯源，不互相引用。

**全局系统约束**：
- 所有顶层实体（File / Contact / Asset / Session）都归属于用户，需具备 `owner_user_id`。
- 当前阶段按个人用户空间建模；未来如引入团队或企业空间，可再扩展 `workspace_id` / `tenant_id`。
- 所有持久化时间使用 ISO 8601，并带 timezone offset。
- 自然语言时间解析必须传入用户当前时区，例如“今晚 5 点”按用户时区归一化为 `due_at`。
- 默认采用软删思路：删除或归档优先表现为 `deleted_at` / `archived_at` / `status`，避免 Session 溯源出现不可解释的悬空历史。

---

## 三、files 表

### 3.1 通用字段（所有 file_type 共有）

```json
{
  "id": "file_001",
  "owner_user_id": "user_001",
  "file_type": "audio",
  "url": "https://storage/.../meeting_001.m4a",
  "parsed_content": "完整的文字化内容（转写 / OCR / 正文提取）",
  "created_at": "2026-05-06T14:00:00+08:00"
}
```

`parsed_content` 字段名统一，内容随 `file_type` 变化：
- `audio` → ASR 语音转写文字
- `image` → OCR 文字 / 图片描述
- `pdf` → 提取的正文文字

### 3.2 audio 专属扩展字段

```json
{
  "file_type": "audio",
  "duration_sec": 3600,

  "speakers": [
    {
      "speaker_id": "speaker_1",
      "contact_id": "kevin_001",
      "segments": [
        { "start": 0, "end": 45, "text": "我们这次会议主要讨论..." }
      ]
    },
    {
      "speaker_id": "speaker_2",
      "contact_id": null,
      "segments": [
        { "start": 46, "end": 119, "text": "预算方面需要再确认..." }
      ]
    }
  ],

  "attachments": [
    { "file_id": "file_image_001", "note": "白板照片", "added_at": "2026-05-06T15:00:00+08:00" },
    { "file_id": "file_image_002", "note": "现场照片", "added_at": "2026-05-06T15:01:00+08:00" }
  ]
}
```

- `speakers[]`：ASR 自动识别说话人，`contact_id` 初始为 null，用户手动关联后填入。说话人关联即定义了这场录音的参与者。
- `attachments[]`：用户事后补充的关联材料（照片等），挂在录音 File 下。默认只供查看，用户主动追问时可将 `file_id` 作为新 input 传入 Session 触发处理。

### 3.3 image 专属扩展字段

```json
{
  "file_type": "image",
  "dimensions": { "width": 3024, "height": 4032 }
}
```

### 3.4 pdf 专属扩展字段

```json
{
  "file_type": "pdf",
  "page_count": 12
}
```

> 不同 `file_type` 按需定义自己的扩展字段，互不干扰。未来新增 `video` 等类型时在此补充。

---

## 四、contacts 表

Contact 是独立的业务实体，有自己的生命周期。所有字段地位平等，`notes[]` 和 `phone`、`email` 没有区别，均支持增删改查。

```json
{
  "id": "contact_kevin",
  "owner_user_id": "user_001",
  "name": "Kevin Chen",
  "company": "Acme Corp",
  "title": "产品总监",
  "phone": "12345",
  "email": "kevin@acme.com",
  "avatar_url": "",
  "notes": [
    { "content": "喜欢喝拿铁", "updated_at": "2026-05-06T21:00:00+08:00" }
  ],

  "update_log": [
    {
      "source_type": "manual",
      "actor_user_id": "user_001",
      "session_id": null,
      "input_id": null,
      "updated_at": "2026-05-01T10:00:00+08:00"
    },
    {
      "source_type": "session",
      "actor_user_id": "user_001",
      "session_id": "session_005",
      "input_id": "input_002",
      "updated_at": "2026-05-06T22:00:00+08:00"
    }
  ]
}
```

- `update_log[]`：极简变更记录，只记录「谁动过我」，不记录改了什么字段。具体改动内容去对应 Session 的 input 里查看。
- Contact 本身不存储任何 `session_id` 作为关联关系，`update_log` 是操作历史，不是关联。

**Contact 的创建来源**：
- NFC 名片交换（硬件）
- App 内手动填表
- Ask Agent 对话：「帮我创建一个联系人 Kevin，电话 12345」→ conversation-skill → contact-sub-skill → create_contact MCP Tool

**Contact 的 Agent 写入原则**：
- 唯一且高置信匹配：Agent 可以执行更新，并在 `Session.output.items[]` 中留下操作结果。
- 多个候选：Agent 不直接写入，在 Session 对话框列出候选联系人，由用户确认后再更新。
- 无匹配或低置信：创建草稿 Contact，或降级为 Note / Idea，等待用户后续整理。

---

## 五、assets 表

### 5.1 通用数据结构

`asset_type` 是开放可扩展的字段，由 Skill 定义。后端默认对 `payload` 内容透明，只按 `asset_type` 做通用索引和查询。

```json
{
  "id": "asset_001",
  "owner_user_id": "user_001",
  "asset_type": "todo",
  "schema_version": 1,

  "source_type": "meeting",
  "source_session_id": "session_xyz",
  "source_input_id": "input_001",

  "payload": {},

  "created_at": "2026-05-06T21:00:00+08:00",
  "updated_at": "2026-05-06T21:00:00+08:00"
}
```

**两级溯源**：
- `source_session_id` → 定位整体上下文（这场会议 / 这组闪念 / 这次对话）
- `source_input_id` → 定位 Session 中产生该 Asset 的具体输入（原始音频 / 某张照片 / 某轮追问）

手动创建的 Asset：`source_type = "manual"`，两个 source ID 均为 null。

`schema_version` 由对应 Skill 定义，用于区分同一 `asset_type` 下不同版本的 payload。前端渲染和后端必要字段抽取都应按 `(asset_type, schema_version)` 理解数据。

> 说明：当某类 Asset 需要平台级能力时，后端可以基于该 `asset_type` 的 schema 抽取必要字段。例如 Todo 后续涉及消息推送时，可以从 payload 中识别 `due_at`。这个抽取不改变 Asset 的统一 JSON 结构。

### 5.2 内置 asset_type 及其 payload schema

**todo**
```json
{
  "title": "下周一给 Kevin 发报价",
  "due_at": "2026-05-11T10:00:00+08:00",
  "status": "pending_confirmation"
}
```
> `status` 初始为 `pending_confirmation`（待认领），用户认领后变为 `pending`，完成后变为 `done`，用户忽略后变为 `dismissed`。Todo 不关联 Contact，语义只存在于 `title` 文字中。

**idea**
```json
{
  "content": "可以考虑给销售团队做一个客户偏好标签系统",
  "tags": []
}
```

**note**
```json
{
  "note_type": "meeting_summary",
  "title": "产品同步会 · 2026-05-06",
  "content": "## 主要议题\n..."
}
```

| `note_type` | 场景 |
|-------------|------|
| `meeting_summary` | AI 对会议录音的结构化总结 |
| `manual` | 用户手动输入的笔记 |

### 5.3 扩展 asset_type 示例

后端同等存储，payload 由各 Skill 自定义：

| asset_type | 对应 Skill | payload 核心字段 |
|-----------|-----------|----------------|
| `expense` | expense-skill | amount / currency / category / location / occurred_at |
| `health_log` | health-skill | type / value / unit / occurred_at |
| `vocabulary` | vocab-skill | word / definition / example |

---

## 六、Session：内容生产过程的完整记录

### 6.1 Session 的三种类型

| `session_type` | 数量 | input 形态 | 典型产出 |
|----------------|------|------------|---------|
| `flash_note` | 每用户 1 个逻辑 Session | 每轮可以是硬件短录音或文字追问，均为 `turn_input`；硬件短录音需要同时保留音频文件和 ASR 转录文本 | Todo / Idea / Note / Contact 操作 |
| `meeting` | N 个，每场会议 1 个 | 首轮会议音频是 `anchor_input`，后续追问是 `turn_input` | Note(meeting_summary) / Todo[] |
| `conversation` | N 个 | 普通 Ask 只有 `turn_input`；对象详情页 Ask 可先写入对象 `anchor_input` | 依赖用户意图，Asset 增删改查均可 |

**闪念使用用户级全局 Session**：`flash_note` 是 per-user global session。产品语义上，用户的闪念共享同一条上下文；实现上允许按时间或 input 数量做物理分段，并通过分页和检索访问历史输入。每次生成的 Asset 通过 `source_input_id` 精确定位到具体哪次录音。

**会议每场独立 Session**：一场会议是强边界的上下文单元，每场独立创建。

### 6.2 Input Role：输入在 Session 中的角色

`input_type` 描述输入形态，`input_role` 描述输入在 Session 中承担的上下文角色。

| 字段 | 取值 | 说明 |
|---|---|---|
| `input_type` | `audio` / `file` / `text` / `asset` / `contact` / `virtual_markdown` | 输入的内容形态或上下文对象；`audio` 通常仍由 `file_id` 指向底层音频 File |
| `input_role` | `anchor_input` | 建立整个 Session 上下文的核心输入，进入 Session sources |
| `input_role` | `turn_input` | 某一轮用户给 Agent 的输入，只属于当前 turn |

规则：

1. Session sources 只由 `anchor_input` 及其派生资料构成。
2. 普通语音、文字追问、闪念短录音都是 `turn_input`，只在对应 turn 中展示。
3. Meeting 的首轮会议音频是 `anchor_input`，其 audio / transcript / speakers / attachments 贯穿整个 Session。
4. Flash Note 通常没有 `anchor_input`；它是一个 conversation-like 的用户级闪念流，每轮可以是 audio 或 text。
5. Flash Note 的硬件短录音是 `input_type = "audio"` + `input_role = "turn_input"`。UI 必须在该 Turn 内展示原始音频信息（例如播放入口、时长、录入时间）和 ASR 转录文本；它不进入 Session Sources。
6. 未来如果在追问中插入文件，应根据语义判断：作为分析对象建立上下文时是 `anchor_input`；只服务当前轮时是 `turn_input`。
7. 从 Asset / Contact / File / 系统生成 Markdown 详情页进入 Ask Agent 时，当前对象作为新 `conversation` Session 的 `anchor_input`；用户选择建议问题或手动输入后，才生成第一轮 `turn_input`。
8. 从 existing Session 工作台继续追问时，不创建新 Session，也不新增 anchor，只追加新的 `turn_input`。

### 6.3 Session 通用数据结构

```json
{
  "id": "session_xyz",
  "owner_user_id": "user_001",
  "session_type": "meeting",

  "inputs": [
    {
      "input_id": "input_001",
      "turn_id": "turn_001",
      "input_type": "file",
      "input_role": "anchor_input",
      "file_id": "file_audio_001",
      "text": null,
      "created_at": "2026-05-06T14:00:00+08:00"
    },
    {
      "input_id": "input_002",
      "turn_id": "turn_002",
      "input_type": "text",
      "input_role": "turn_input",
      "file_id": null,
      "text": "帮我重新生成一个更简洁的 summary",
      "created_at": "2026-05-06T15:30:00+08:00"
    }
  ],

  "turns": [
    {
      "turn_id": "turn_001",
      "input_ids": ["input_001"],
      "output": {
        "text": "我已完成会议转写和初步解析，生成了会议摘要和待认领待办。",
        "items": [
          { "type": "asset_created", "asset_id": "asset_001" },
          { "type": "asset_created", "asset_id": "asset_002" }
        ]
      }
    },
    {
      "turn_id": "turn_002",
      "input_ids": ["input_002"],
      "output": {
        "text": "我已重新生成一版更简洁的 summary。",
        "items": [
          { "type": "asset_updated", "asset_id": "asset_001" }
        ]
      }
    }
  ],

  "output": {
    "items": [
      { "type": "asset_created", "asset_id": "asset_001" },
      { "type": "asset_created", "asset_id": "asset_002" },
      {
        "type": "contact_update_pending",
        "candidates": ["contact_kevin_001", "contact_kevin_002"],
        "message": "找到多个 Kevin，请确认要更新哪一位"
      }
    ]
  },

  "messages": [],

  "status": "done",
  "created_at": "2026-05-06T14:00:00+08:00"
}
```

每条 input 有唯一 `input_id`，`file_id` 和 `text` 互斥：文件输入填 `file_id`，对话输入填 `text`。`inputs[]` 是底层 append-only 输入时间线；`turns[]` 是 App 和 Agent 运行时使用的轮次视图，每个 turn 可以引用一条或多条 input。

### 6.4 Session 与三张表的关系图

```
Session
│
├── inputs[]
│     ├── input_001 { input_role: "anchor_input", file_id: "file_audio_001" } ──→ files 表
│     └── input_002 { input_role: "turn_input", text: "帮我重新生成 summary" }
│
├── turns[]
│     ├── turn_001 { input_ids: ["input_001"], output: {...} }
│     └── turn_002 { input_ids: ["input_002"], output: {...} }
│
└── output.items[]
      ├── asset_created { asset_id: "note_001" } ──→ assets 表
      ├── asset_created { asset_id: "todo_001" } ──→ assets 表
      └── contact_update_pending { candidates: [...] } ──→ contacts 表候选

files 表（audio）
  └── speakers[].contact_id ──→ contacts 表（用户手动关联）
  └── attachments[].file_id ──→ files 表（用户手动关联）

contacts 表
  └── update_log[]：记录哪些 session_id / input_id 改动过此联系人
```

`Session.output.items[]` 是开放结果列表，不只记录 Asset。它可以记录 Asset 创建、Contact 更新候选、确认请求、执行失败、Agent 回复等运行结果。各 item 的具体结构由顶层 Skill 定义，前端按 `type` 渲染 Session 详情页。

**统一 output item type**：

| type | 说明 |
|---|---|
| `asset_created` | 创建了 Todo / Idea / Note 等 Asset |
| `asset_updated` | 修改、认领、忽略、完成或替换了某条 Asset |
| `contact_updated` | 已更新某个 Contact 字段 |
| `contact_update_pending` | 需要用户确认候选 Contact 或更新字段 |
| `assistant_message` | Agent 产生了一条可展示消息 |
| `unknown` | 无法分类的输入，保留原始内容供用户整理 |
| `error` | ASR、Skill、写入、权限或网络失败 |

`output.items[]` 是 Session 的历史结果，不因目标实体被删除而物理移除。若目标实体已删除或归档，读取时展示“来源已删除 / 联系人已删除 / 资产已归档”等状态。

---

## 七、处理管线

### 7.1 音频输入管线（闪念 / 会议）

```
[ 硬件录音 ]
      │
      ▼
[ 创建 File Asset，写入 url ]
      │
      ▼
[ ASR → File.parsed_content，audio 专属：识别 speakers[] ]
      │
      ▼
[ 追加 input 到 Session.inputs[]，生成 input_id，并归入对应 turn ]
      │  闪念 → 追加到用户级 flash_note Session，作为 audio turn_input，在 Turn 内展示音频和转录文本
      │  会议 → 首轮会议音频作为本场 Session 的 anchor_input
      │
      ▼
[ 路由到对应顶层 Skill ]
      ├── flash_note → flash-note-skill（全量语义拆解）
      └── meeting    → meeting-skill（两阶段：先生成 summary，再提取 Todo）
      │
      ▼
[ 顶层 Skill 调度子 Skill，每个产出 Asset 携带 source_input_id ]
      ├── todo-sub-skill    → Todo Asset
      ├── idea-sub-skill    → Idea Asset
      ├── note-sub-skill    → Note Asset
      └── contact-sub-skill → contacts 表增删改查（写入 update_log）
      │
      ▼
[ 写入 Session.output.items，返回结果 ]
```

### 7.2 追问管线（Session 内持续对话）

任何 Session 都支持持续追问。每轮追问会生成新的 turn，并追加一条或多条 `turn_input`。产出的新 Asset 携带对应 `source_input_id`，与原始输入产出的 Asset 在同一 Session 下共存且可区分。

未来如果支持在追问中插入文件，需要判断该文件的 `input_role`：
- 若文件成为整个 Session 的核心分析对象，则作为 `anchor_input`，进入 Session sources；
- 若文件只服务当前轮追问，则作为 `turn_input`，只展示在当前 turn。

示例：
```
用户：「帮我把这张白板照片里的 action items 提取成代办」
  → 追加 input_00N { input_type: "file", input_role: "turn_input", file_id: "file_image_001" } 到 Session.inputs[]
  → todo-sub-skill 处理 → Todo Assets { source_input_id: "input_00N" }
```

### 7.3 对话输入管线（Ask Agent Conversation）

普通 Ask Agent 从用户文字或语音转文字开始，不带固定上下文锚点。

```
[ 用户文字 / 语音输入 ]
      │
      ▼
[ 创建或复用 conversation Session，追加 input ]
      │
      ▼
[ conversation-skill 语义理解 ]
      ├── 查询意图  → semantic_search / MCP 查询工具，返回结果
      ├── 创建意图  → 调用对应子 Skill，Asset 携带 source_input_id
      ├── 修改意图  → MCP 更新工具（contacts 写入 update_log；多候选时进入确认）
      └── 删除意图  → MCP 删除工具
      │
      ▼
[ 写入 messages[]，Session 保持活跃 ]
```

### 7.4 对象详情页 Ask 管线（Object Detail Ask）

当用户从某个具体对象详情页发问时，App 不继续该对象的 `source_session_id`，而是创建新的 `conversation` Session，并将当前对象写入 `anchor_input`。

对象详情页本身不创建 Session。用户应先看到对象内容，例如 `note.md` 的完整 Markdown、`idea.MD` 的聚合内容或 Contact 的字段信息；只有点击 `Ask Agent` 后，才创建下面这条 anchored conversation。

适用对象：
- `asset`：例如手动创建的 Todo、系统生成的 Note。
- `contact`：例如 Kevin Chen 的联系人详情。
- `file`：例如普通 PDF、图片、附件或尚未形成专属业务 Session 的文件。
- `virtual_markdown`：例如 `idea.MD`、`expense.md` 这类系统生成聚合视图。

`virtual_markdown` 是组合型 anchor。它的 input payload 应保留组成项，例如 `asset_ids`，而不是只保存渲染后的 Markdown 文本。这样 App 可以像展示 File source 一样展示一个 anchor block，并在点击后展开它包含的所有 Asset。

```
[ 用户在对象详情页点击 Ask about this ]
      │
      ▼
[ 创建 conversation Session ]
      │
      ├── input_anchor_001 { input_role: "anchor_input", input_type: "asset/contact/file/virtual_markdown", asset_ids?: [...] }
      └── input_turn_001   { input_role: "turn_input", text: "用户问题" }
      │
      ▼
[ conversation-skill 基于 anchor + turn_input 回复 ]
      │
      ▼
[ 后续追问继续追加 turn_input，anchor 保持不变 ]
```

这条规则也覆盖手动创建的 Asset。即使 Asset 没有 `source_session_id`，它仍然可以作为新 conversation 的 `anchor_input` 被 Ask Agent 使用。

Object Detail Ask 刚进入时可以只有 `anchor_input`，尚未有 `turn_input`。此时 UI 可展示建议问题，`Generated Results` 为空；用户选择建议问题或输入问题后，再创建第一轮 turn。

### 7.5 手动创建

用户在 App 内手动创建 Asset 时，直接生成，`source_type = "manual"`，`source_session_id` 和 `source_input_id` 均为 null，不创建 Session。

---

## 八、顶层 Skill 与子 Skill 的关系

子 Skill 无状态可复用，只关心「给我一段文字，产出对应结构」。三条管线共享同一套子 Skill。

| 子 Skill | 输入 | 输出 | 调用方 |
|----------|------|------|--------|
| `todo-sub-skill` | 意图文字片段 | Todo payload JSON | flash-note / meeting / conversation |
| `idea-sub-skill` | 意图文字片段 | Idea payload JSON | flash-note / meeting / conversation |
| `note-sub-skill` | 全文或意图片段 | Note payload JSON | flash-note / meeting / conversation |
| `contact-sub-skill` | 人物信息片段 | contacts 表操作指令 | flash-note / meeting / conversation |

**闪念 vs 会议的顶层 Skill 差异**：

| | flash-note-skill | meeting-skill |
|--|--|--|
| 调度策略 | 全量派发：整段 transcript 一次性拆解所有意图 | 两阶段：先整体生成 summary Note，再从 summary 提取 Todo |
| 原因 | 闪念内容短，意图离散 | 会议有叙事结构，强行打散会丢失上下文 |

---

## 九、展示层：两种浏览维度

### 9.1 资产维度（主视图）——按类型浏览

```
Todo 列表       全量：手动创建 + 闪念生成 + 会议生成 + 对话创建
Idea 列表       全量，同上
Note 列表       全量，note_type 决定卡片样式
Contact 列表    全量，点进详情可查看所有字段和 update_log
File 列表       全量，file_type 决定图标，可播放 / 预览原始内容
```

每条 Asset 显示来源标签（`来自闪念` / `来自会议` / `手动创建`），点击标签跳转到对应 Session。

### 9.2 溯源维度（辅视图）——Session 详情页

闪念和会议复用同一套模板：

```
┌─────────────────────────────────────────┐
│  [类型：闪念 / 会议] · 时间              │
│                                          │
│  📁 输入内容                             │
│  ├─ [▶ 播放录音] · 转写文字（折叠）      │  ← File(audio)
│  └─ [🖼 白板照片]                        │  ← File(audio).attachments[]
│                                          │
│  👤 参与者                               │  ← File(audio).speakers[].contact_id
│  ├─ Kevin Chen                           │
│  └─ speaker_2（未关联）[关联联系人]       │
│                                          │
│  由此生成                                │
│  📋 Todos (N)      [认领] [忽略]         │
│  💡 Ideas (N)                            │
│  📝 Notes (N)                            │
├─────────────────────────────────────────┤
│  [继续追问...]                           │
└─────────────────────────────────────────┘
```

---

## 十、Todo 认领机制

AI 从音频提取的 Todo 初始状态为 `pending_confirmation`，不直接进入 Todo 列表：

```
生成时：  status = "pending_confirmation"，展示在 Session 详情页
用户认领：status = "pending"，进入 Todo 列表
用户忽略：status = "dismissed"，从 Session 详情页隐藏
```

Todo 不关联 Contact。「给 Kevin 发报价」的语义只存在于 title 文字中，系统不建立数据层关联。

---

## 十一、设计原则总结

1. **Skill 即产品功能，后端低感知**：新功能 = 新 Skill + 新前端模板，assets 表结构保持统一；需要推送、排序、调度等平台能力时，后端可按 `asset_type` 抽取必要字段。
2. **三张表各司其职**：files（基础设施）/ contacts（业务实体）/ assets（内容生产），不混用。
3. **两级溯源**：`source_session_id` 定位上下文，`source_input_id` 定位具体触发输入，同一 Session 不同时机的产出可精确区分。
4. **inputs[] 是统一的输入时间线，turns[] 是交互轮次视图**：输入按时间顺序追加；App 以 turn 为单位呈现一轮 input/output。
5. **attachments 挂在 File 下**：现场补充材料（照片等）是对录音物理现场的描述，归属 File 而非 Session。默认只供查看，用户主动追问时可转为 input。
6. **所有关联由用户主动建立**：speakers → contact（说话人关联），File.attachments（附件关联），Contact.update_log（变更溯源）。系统不自动推断任何关联关系。
7. **Session 保持纯粹**：只持有 inputs[] / turns[] / output.items[] / messages[]，不持有任何 Contact 关联字段；Contact 候选和写入结果作为 output item 记录。
8. **闪念是用户级全局 Session，会议独立 Session**：闪念内容离散但上下文需连贯；会议是强边界单元，各自独立。实现上闪念可做物理分段、分页和归档。
9. **Todo 只归属自己**：AI 不推断 Todo 与 Contact 的关联，认领后 owner 永远是用户自己。
10. **手动创建是平等的一条路**：`source_type = "manual"`，两个 source ID 为 null，数据结构与 AI 生成完全一致。
11. **Asset 无横向关联是有意取舍**：当前阶段不建立 Asset 与 Asset、Asset 与 Contact 的强一致外键关系，以降低模型复杂度；这会暂时牺牲“Kevin 相关 Todo 精确聚合”等结构化能力，相关需求先通过文本语义和检索召回解决。
12. **Schema 可演进**：所有 Asset 带 `schema_version`，同一 `asset_type` 的 payload 变更必须显式升级版本，避免历史数据被新模板误读。
13. **Source 只来自 anchor input**：Session sources 只展示 `anchor_input` 及其派生资料；普通 text/audio/file 追问属于 `turn_input`，只在对应 turn 中展示。
