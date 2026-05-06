# 资产与 Session 统一架构

**版本**：v0.5  
**状态**：草案  
**关联文档**：
- [FLASH_NOTE_SKILL_ARCHITECTURE.md](./FLASH_NOTE_SKILL_ARCHITECTURE.md)（闪念 Skill 细节）
- [SKILL_PRD.md](./SKILL_PRD.md)（Ask Agent Skill 总体规划）
- [APP_PRD.md](./APP_PRD.md)（前端展示与页面结构）

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
    └── 不理解 payload 内容，只按 asset_type 索引和查询

前端
    └── 新 asset_type → 新入口 + 新渲染模板
    └── 按 asset_type 从后端取数，放入对应容器展示
```

**新增一个产品功能的完整路径**：
1. PM 写一个新 Skill 的触发描述和输出 Schema
2. 在 dispatcher 注册表里加一行触发条件
3. 前端新增对应 `asset_type` 的渲染模板和入口
4. **后端零改动**

> **示例：记账功能**
> 用户闪念说「刚才在星巴克花了 38 块，两杯拿铁」→ dispatcher 匹配 `expense-skill` → 输出 `{ asset_type: "expense", amount: 38, location: "星巴克", ... }` → 后端存储 → 前端账本入口取所有 `asset_type="expense"` 的记录渲染账本。全程后端不改一行代码。

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

---

## 三、files 表

### 3.1 通用字段（所有 file_type 共有）

```json
{
  "id": "file_001",
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
      "session_id": null,
      "input_id": null,
      "updated_at": "2026-05-01T10:00:00+08:00"
    },
    {
      "source_type": "session",
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

---

## 五、assets 表

### 5.1 通用数据结构

`asset_type` 是开放可扩展的字段，由 Skill 定义。后端对 `payload` 内容透明，只按 `asset_type` 索引。

```json
{
  "id": "asset_001",
  "asset_type": "todo",

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

### 5.2 内置 asset_type 及其 payload schema

**todo**
```json
{
  "title": "下周一给 Kevin 发报价",
  "due_at": "2026-05-11T10:00:00+08:00",
  "status": "pending_confirmation"
}
```
> `status` 初始为 `pending_confirmation`（待认领），用户认领后变为 `pending`，完成后变为 `done`。Todo 不关联 Contact，语义只存在于 `title` 文字中。

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

| `session_type` | 触发方式 | inputs 形态 | 典型产出 |
|----------------|---------|------------|---------|
| `flash_note` | 硬件长按录音按钮 | 每次录音追加一条 input（file） | Todo / Idea / Note |
| `meeting` | 硬件点击会议按钮 | 初始一条音频 input，后续追问为文字 input | Note(meeting_summary) / Todo[] |
| `conversation` | App 内 Ask Agent 对话 | 每轮用户发言一条文字 input | 依赖用户意图，Asset 增删改查均可 |

**闪念使用全局共享 Session**：所有闪念录音追加到同一个 `flash_note` Session 的 `inputs[]`，共享对话上下文，支持跨多次录音的追问。每次生成的 Asset 通过 `source_input_id` 精确定位到具体哪次录音。

**会议每场独立 Session**：一场会议是强边界的上下文单元，每场独立创建。

### 6.2 Session 通用数据结构

```json
{
  "id": "session_xyz",
  "session_type": "meeting",

  "inputs": [
    {
      "input_id": "input_001",
      "file_id": "file_audio_001",
      "text": null,
      "created_at": "2026-05-06T14:00:00+08:00"
    },
    {
      "input_id": "input_002",
      "file_id": null,
      "text": "帮我重新生成一个更简洁的 summary",
      "created_at": "2026-05-06T15:30:00+08:00"
    }
  ],

  "output": {
    "asset_ids": ["asset_001", "asset_002", "asset_003"]
  },

  "messages": [],

  "status": "done",
  "created_at": "2026-05-06T14:00:00+08:00"
}
```

每条 input 有唯一 `input_id`，`file_id` 和 `text` 互斥：文件输入填 `file_id`，对话输入填 `text`。所有输入类型在 `inputs[]` 时间线上平等排列。

### 6.3 Session 与三张表的关系图

```
Session
│
├── inputs[]
│     ├── input_001 { file_id: "file_audio_001" } ──→ files 表
│     └── input_002 { text: "帮我重新生成 summary" }
│
└── output.asset_ids[]
      ├── note_001 { source_input_id: "input_001" } ──→ assets 表
      ├── note_002 { source_input_id: "input_002" } ──→ assets 表
      └── todo_001 { source_input_id: "input_001" } ──→ assets 表

files 表（audio）
  └── speakers[].contact_id ──→ contacts 表（用户手动关联）
  └── attachments[].file_id ──→ files 表（用户手动关联）

contacts 表
  └── update_log[]：记录哪些 session_id / input_id 改动过此联系人
```

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
[ 追加 input 到 Session.inputs[]，生成 input_id ]
      │  闪念 → 追加到全局 flash_note Session
      │  会议 → 追加到本场独立 Session
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
[ 写入 Session.output.asset_ids，返回结果 ]
```

### 7.2 追问管线（Session 内持续对话）

任何 Session 都支持持续追问。每轮追问是一条新的文字 input，产出的新 Asset 携带对应 `source_input_id`，与原始输入产出的 Asset 在同一 Session 下共存且可区分。

用户也可以将 File.attachments[] 中的附件照片作为新 input 传入，触发 AI 处理：
```
用户：「帮我把这张白板照片里的 action items 提取成代办」
  → 追加 input_00N { file_id: "file_image_001" } 到 Session.inputs[]
  → todo-sub-skill 处理 → Todo Assets { source_input_id: "input_00N" }
```

### 7.3 对话输入管线（Ask Agent Conversation）

```
[ 用户文字 / 语音输入 ]
      │
      ▼
[ 创建或复用 conversation Session，追加 input ]
      │
      ▼
[ conversation-skill 语义理解 ]
      ├── 查询意图  → semantic_search / MCP 查询工具，返回 citations
      ├── 创建意图  → 调用对应子 Skill，Asset 携带 source_input_id
      ├── 修改意图  → MCP 更新工具（contacts 写入 update_log）
      └── 删除意图  → MCP 删除工具
      │
      ▼
[ 写入 messages[]，Session 保持活跃 ]
```

### 7.4 手动创建

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

1. **Skill 即产品功能，后端零感知**：新功能 = 新 Skill + 新前端模板，assets 表结构永远不变，`asset_type` 是唯一扩展点。
2. **三张表各司其职**：files（基础设施）/ contacts（业务实体）/ assets（内容生产），不混用。
3. **两级溯源**：`source_session_id` 定位上下文，`source_input_id` 定位具体触发输入，同一 Session 不同时机的产出可精确区分。
4. **inputs[] 是统一的输入时间线**：音频文件、图片、文字追问地位平等，按时间顺序追加，没有主次之分。
5. **attachments 挂在 File 下**：现场补充材料（照片等）是对录音物理现场的描述，归属 File 而非 Session。默认只供查看，用户主动追问时可转为 input。
6. **所有关联由用户主动建立**：speakers → contact（说话人关联），File.attachments（附件关联），Contact.update_log（变更溯源）。系统不自动推断任何关联关系。
7. **Session 保持纯粹**：只持有 inputs[] / output[] / messages[]，不持有任何 Contact 关联字段。
8. **闪念共享 Session，会议独立 Session**：闪念内容离散但上下文需连贯；会议是强边界单元，各自独立。
9. **Todo 只归属自己**：AI 不推断 Todo 与 Contact 的关联，认领后 owner 永远是用户自己。
10. **手动创建是平等的一条路**：`source_type = "manual"`，两个 source ID 为 null，数据结构与 AI 生成完全一致。
