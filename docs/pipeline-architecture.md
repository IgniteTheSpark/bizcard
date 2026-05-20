# Eureka 3.0 Agentic Pipeline — 架构设计文档

> 整理自产品与技术讨论，供开发团队和相关人员同步使用。
> 日期：2026-05-13

---

## 一、整体架构概述

### 核心理念

用户的输入（语音或文字）经过 ASR 转录后，由不同的 Pipeline 处理，最终将结构化数据落库，并返回可渲染的卡片 JSON 给 App。

### 三种输入类型与路由

**路由由输入的元数据决定，不依赖 LLM 推断。**

```
输入
├── 音频文件 + "闪念" 标签  →  Flash Note Pipeline
├── 音频文件 + "会议" 标签  →  Meeting Pipeline（待设计）
└── Chat 文字输入          →  Conversational Agent（无 dispatcher）
```

| 输入类型 | 触发方式 | 处理路径 | 输出 |
|---|---|---|---|
| 闪念语音 | 硬件按钮录音 | Flash Note Pipeline | 卡片 JSON |
| 会议录音 | 硬件会议录音 | Meeting Pipeline | 会议摘要 + 卡片 JSON |
| 文字追问 | App 对话框输入 | Conversational Agent | 自然语言 + 工具调用 |

---

## 二、数据模型

共五张独立的表，职责清晰分离。

### 2.1 实体关系

```
File（原始音频）
    ↓ ASR 处理（与 Session 无关）
Transcript（转录文本）

Session（App 层组织概念）
    ├── 引用 File
    ├── 引用 Transcript
    ├── 引用 Asset[]
    └── 引用 Contact[]（变更记录）

Asset（结构化提炼结果）
Contact（联系人实体）
```

**关键设计原则：**
- File → Transcript 是纯技术处理流，不需要 Session 上下文
- Session 是 App 层的组织概念，负责将各实体聚合在一起
- Session 持有 file_id / transcript_id / asset_id 的引用，反向不成立

### 2.2 File 表

```json
{
  "file_id": "uuid",
  "storage_url": "https://...",
  "file_type": "audio/mp4 | audio/wav | ...",
  "duration_sec": 120,
  "source_tag": "flash_note | meeting",
  "asr_status": "pending | processing | completed | failed",
  "created_at": "ISO8601"
}
```

### 2.3 Transcript 表

```json
{
  "transcript_id": "uuid",
  "file_id": "uuid",
  "text": "完整转录文本（可能很长）",
  "speakers": ["Alice", "Bob"],
  "asr_provider": "whisper-local | cloud-xxx",
  "created_at": "ISO8601"
}
```

> 闪念 transcript 无 speakers（单人）；会议 transcript 含多说话人标注。

### 2.4 Asset 表

仅包含结构化提炼结果，**不含 transcript**。

```json
{
  "asset_id": "uuid",
  "asset_type": "todo | idea | expense | note",
  "session_id": "uuid",
  "source_transcript_id": "uuid（可选，溯源用）",
  "created_at": "ISO8601",
  "payload": {}
}
```

各类型 payload 结构：

| asset_type | payload 字段 |
|---|---|
| `todo` | `title`, `due_at`（ISO8601 或 null）, `status` |
| `idea` | `title`, `content`（markdown）|
| `expense` | `amount`, `currency`, `category`, `merchant`, `date`, `description` |
| `note` | `title`, `content`（markdown）, `template_id`（或 null）|

### 2.5 Contact 表

联系人是独立实体，不归入 Asset。

```json
{
  "contact_id": "uuid",
  "name": "string（必填）",
  "phone": "string",
  "company": "string",
  "title": "string",
  "email": "string",
  "notes": ["追加记录数组"],
  "created_at": "ISO8601"
}
```

### 2.6 Session 表

```json
{
  "session_id": "uuid",
  "session_type": "flash_note | meeting",
  "file_ids": ["uuid"],
  "transcript_ids": ["uuid"],
  "asset_ids": ["uuid"],
  "created_at": "ISO8601"
}
```

---

## 三、ASR 层设计

两类音频对 ASR 的要求不同，使用不同的服务。

| | 闪念 ASR | 会议 ASR |
|---|---|---|
| 音频时长 | 几秒到几十秒 | 30 分钟到几小时 |
| 说话人 | 单人 | 多人，需要 diarization |
| 精度要求 | 一般 | 高，需识别专业术语 |
| 推荐方案 | 本地 Whisper 或廉价云 API | 专业云 ASR（含说话人分离）|
| 输出格式 | 纯文本 | 带 `[Speaker X - HH:MM:SS]` 标注 |

**处理流：**

```
硬件上传音频
    ↓
写 File 表（asr_status: pending）
    ↓
ASR Service 处理（独立服务，不感知 Session）
    ↓
写 Transcript 表
更新 File.asr_status → completed
    ↓
App 层将 transcript_id 挂载到对应 Session
    ↓
触发对应 Pipeline
```

---

## 四、Flash Note Pipeline

### 4.1 整体流程

```
Transcript.text
      ↓
Flash Note Dispatcher（意图识别 + 文本切分）
      ↓ dispatch[]（并行）
┌─────────────────────────────────────┐
│  todo-skill    contact-skill        │
│  idea-skill    expense-skill        │
│  qa-skill      misc（归档杂项）      │
└─────────────────────────────────────┘
      ↓ 所有 results 汇聚
Session Writer
      ↓
卡片 JSON 返回 App
```

### 4.2 Dispatcher 意图类型

| 意图 | 触发条件 |
|---|---|
| `todo` | 待办、提醒、截止时间、任务跟进 |
| `contact` | 保存联系人、更新联系人信息 |
| `idea` | 灵感、想法、感悟、随手记、长期计划 |
| `expense` | 消费记录、花了多少钱、买了什么 |
| `qa` | 需要直接回答的问题（"是什么"、"帮我查"）|
| `misc` | 无法归类的内容（纯数字、感叹词、噪音）|

**冲突优先级：** todo > idea；contact > idea

**Dispatcher 输出格式：**

```json
{
  "user_text": "原文",
  "session_id": "xxx",
  "input_id": "xxx",
  "dispatch": [
    { "skill": "todo-skill", "source_text": "原文子串" },
    { "skill": "contact-skill", "source_text": "原文子串" }
  ]
}
```

### 4.3 各 Sub-skill 设计

**todo-skill**
- 提取：`title`（必填）、`due_at`（ISO8601 或 null）
- 时间规则：有日期无时间 → 当天 09:00+08:00；无时间引用 → null
- 调用：`create_asset("todo", payload)`

**contact-skill**
- Step 1：提取 name（必填）、phone、company、title、email、notes
- Step 2：`query_contact(name)` 查是否已存在
- Step 3a：0 条匹配 → `create_contact`
- Step 3b：1 条匹配 → `update_contact`（逐字段）
- Step 4：2+ 条匹配 → 返回 `pending_confirmation`，不写入

**idea-skill**
- 提取：`title`（≤10 词，提炼核心）、`content`（markdown，忠于原文）
- 规则：不捏造原文中没有的事实
- 调用：`create_asset("idea", payload)`

**expense-skill**
- 提取：`amount`（必填）、`currency`（默认 CNY）、`category`（推断）、`merchant`、`date`、`description`
- 时间规则：今天/无引用 → 今日 T00:00:00+08:00；昨天 → 昨日
- 调用：`create_asset("expense", payload)`

**qa-skill**
- 直接回答，不调用任何 MCP 工具，不写入任何 asset
- 输出：`{ ok: true, answer: "string" }`

**misc**
- 无对应 skill，dispatcher 识别后不路由
- Session Writer 感知到 misc 存在时，summary 轻提示或静默忽略

### 4.4 Session Writer 输出

汇总所有 sub-skill 结果，输出供 App 渲染的卡片 JSON。

```json
{
  "ok": true,
  "session_id": "xxx",
  "input_id": "xxx",
  "summary": "已记录 3 项内容。",
  "cards": [
    {
      "card_type": "todo | idea | expense | contact | qa | pending_contact | error",
      "title": "主标题",
      "subtitle": "副标题（一行）",
      "action": {
        "type": "navigate | expand | disambiguate",
        "route": "/todos/asset_id"
      }
    }
  ],
  "has_pending": false
}
```

**Card 类型说明：**

| card_type | title | subtitle | action |
|---|---|---|---|
| `todo` | 任务标题 | 截止时间（"今天 17:00"）| navigate → /todos/:id |
| `idea` | 想法标题 | content 前 30 字 | navigate → /ideas/:id |
| `expense` | ¥金额 | 分类 · 商家 · 描述 | navigate → /expenses/:id |
| `contact` | 联系人姓名 | 已新建/已更新 · 公司 | navigate → /contacts/:id |
| `qa` | "回答" | 答案前 40 字 | expand（展开全文）|
| `pending_contact` | 联系人姓名 | "找到 N 个同名，请确认" | disambiguate（弹选择器）|
| `error` | 意图类型 | 失败原因 | null |

---

## 五、Conversational Agent（文字追问）

### 5.1 触发条件

- 输入来自 App 对话框（文字）
- 不带音频标签
- **不走 Dispatcher，不走任何 sub-skill**

### 5.2 设计原则

- Agent 直接理解用户意图，调用对应 MCP 工具
- 有完整的 session 对话历史，可理解"刚才那个"等上下文引用
- 输出自然语言回复

### 5.3 与 Pipeline 的对比

| | Flash Note Pipeline | Conversational Agent |
|---|---|---|
| 状态 | 无状态，每次独立 | 有 session 对话历史 |
| 执行方式 | 并行 fan-out | 顺序 tool call |
| 中间层 | Dispatcher + Skills | 无，直接调 MCP |
| 适合场景 | 硬件语音，一次多意图 | 追问、修改、查询 |

### 5.4 典型场景

```
[Pipeline 处理后]
待办 a-001：给刘洋发合同，明天 09:00

[用户文字追问]
"第一个待办改成后天"
    ↓
Agent 从对话历史知道 a-001 是"给刘洋发合同"
    ↓
调用 update_asset(a-001, { due_at: "2026-05-15T09:00:00+08:00" })
    ↓
回复："已更新，截止时间改为后天 09:00"
```

---

## 六、MCP 工具接口

所有 Pipeline 和 Conversational Agent 共用同一套工具。

### Asset 工具

| 工具 | 参数 | 说明 |
|---|---|---|
| `create_asset` | asset_type, payload, session_id, input_id | 创建资产 |
| `query_asset` | asset_type, contains | 查询资产（含关键词搜索）|
| `update_asset` | asset_id, payload_patch | 更新资产字段 |
| `delete_asset` | asset_id | 删除资产 |

### Contact 工具

| 工具 | 参数 | 说明 |
|---|---|---|
| `create_contact` | name, phone, company, title, email, notes | 创建联系人 |
| `query_contact` | name_query | 按名字模糊搜索 |
| `update_contact` | contact_id, field, value | 更新单字段 |
| `delete_contact` | contact_id | 删除联系人 |

### Transcript 工具（独立于 Asset）

| 工具 | 参数 | 说明 |
|---|---|---|
| `create_transcript` | file_id, text, speakers, asr_provider | 写入转录结果 |
| `query_transcript` | contains | 全文关键词搜索 |
| `get_transcript` | transcript_id | 获取完整文本 |

---

## 七、Session 生命周期（以闪念为例）

```
① 用户按下硬件闪念按钮
② 音频上传 → 写 File（asr_status: pending）
③ App 创建 Session（session_type: flash_note）
④ ASR 处理 → 写 Transcript，更新 File.asr_status
⑤ App 将 transcript_id 挂载到 Session
⑥ 触发 Flash Note Pipeline（输入：Transcript.text）
⑦ Sub-skills 并行处理 → 写 Asset / Contact
⑧ Session Writer 汇总 → 返回卡片 JSON
⑨ App 渲染卡片，用户看到结果

⑩ 用户文字追问 → Conversational Agent
⑪ Agent 调 MCP 工具修改/查询
⑫ 自然语言回复
```

---

## 八、待设计部分

| 模块 | 状态 | 说明 |
|---|---|---|
| Flash Note Pipeline | ✅ 已完成 | dispatcher + 6 个 skill + session writer |
| Mock MCP Server | ✅ 已完成 | server.py + store.py，本地测试用 |
| 本地 Orchestrator | ✅ 已完成 | orchestrator.py，串联完整 pipeline |
| Meeting Pipeline | 🔲 待设计 | dispatcher 意图不同（action_item / participant / decision / summary），输入为长 transcript |
| Conversational Agent | 🔲 待设计 | system prompt + session history + 直接 MCP 调用 |
| 真实数据库对接 | 🔲 待实现 | 替换 store.py 为 MongoDB 或其他非关系型数据库 |
| 云端部署 | 🔲 待实现 | 替换本地 mock，接真实 ASR 服务和后端 API |

---

## 九、当前本地测试方式

**环境要求：**
- Python 3.12
- 依赖：`pip install mcp[cli] anthropic`
- 环境变量：`ANTHROPIC_API_KEY=sk-ant-xxx`

**直接在 Claude Desktop 测试（推荐）：**
- MCP server 已配置在 Claude Desktop 中
- 在对话框中直接输入内容，Claude 会调用 MCP 工具并返回结果

**命令行端到端测试：**

```bash
cd mcp-server

# 运行内置测试用例
python orchestrator.py

# 或传入自定义输入
python orchestrator.py "今晚5点开会；明天去工厂考察；帮我添加alice的联系方式123456789"
```
