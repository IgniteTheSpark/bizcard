# Eureka 3.0 — 实现规格说明书 (SPEC)

> 版本：v1.4 | 2026-05-21
> 用途：**定义当前实现状态与设计目标，指导后续迭代。**

---

## 一、总体 Gap 概览

| 模块 | 设计目标 | 当前状态 | 优先级 |
|---|---|---|---|
| Stream — 时间流方向 | 最新在上，往下滚动看更早内容 | ✅ 已实现 | — |
| Stream — 连续纵向滚动 | 不限当天，跨日期连续滚动 | ✅ 已实现 | — |
| Stream — 资产生效时间 | 记账/待办按语义时间定位 | ✅ 已实现（Method B） | — |
| Stream — 月历面板 | 可折叠月历 + heat dots | ✅ 已实现 | — |
| Stream — Tab 筛选 | 多类型 tab | ✅ 已实现 | — |
| Stream — 闪念行 | 只展示语音闪念，显示转录内容 | ✅ 已实现（is_voice 标记） | — |
| Stream — 无时间项沉底 | 无明确时间的条目排在当日底部 | ⚠️ 设计确认，待实现 | P1 |
| Stream — 会议卡片 | 会议文件展示在时间流中 | ❌ 未实现 | P2 |
| Session 页 — 聊天界面 | Flash session 为气泡式对话 | ✅ 已实现 | — |
| Session 页 — 侧边历史面板 | 分闪念/问答两区；Agent 区有新建按钮 | ⚠️ 已有抽屉，分区未实现 | P1 |
| Flash Session — 命名 | `"5月21日 闪念"`，按天创建 | ⚠️ 当前显示"今日闪念" | P1 |
| Flash Session — 追问路由 | 追问走 MCP 直连，不走 Pipeline | ❌ 当前仍走 Pipeline | P1 |
| Agent Session — 续聊 | 刷新前恢复上次 session | ❌ 未实现 | P1 |
| Agent Session — 懒创建 | 发第一条消息时才创建 session | ❌ 未实现 | P1 |
| Session 页 — 耗时展示 | Agent 气泡下方显示 Xs | ✅ 已实现 | — |
| Session 页 — QA 去重 | QA 卡片不在气泡中重复展示 | ✅ 已实现 | — |
| Flash Pipeline — 字段对齐 | todo 用 content/due_date/pending | ✅ 已实现 | — |
| Flash Pipeline — 联系人工具 | tool_create_contact 单 payload 参数 | ✅ 已实现 | — |
| Flash Overall — Turn 溯源 | Turn N chip | ⚠️ 有跳转但无来源标注 | P2 |
| Day View 页 | 单日时间轴 | ✅ 已实现（基础版） | — |
| Workspace 页 | 资产按类型浏览 | ✅ 已实现 | — |
| 资产详情页 | 可编辑各字段 | ✅ 已实现（基础版） | — |
| 待办 Checkbox | 卡片内直接勾选完成 | ✅ 已实现 | — |
| 联系人模块 | 独立 Contact 表，全字段 | ✅ 已实现 | — |
| Meeting Session 页 | 音频 + 说话人 + 行动项 | ❌ 未实现 | P3 |

---

## 二、页面级规格

### 2.1 Stream 页（p-stream）

#### 2.1.1 Header

```
[✦ Eureka 3.0]         [5月 2026 ▾]           [↺]
```

点击月份 pill → 展开/收起月历面板。刷新按钮在右侧。

#### 2.1.2 月历面板

- 位置：header 正下方，可折叠
- 内容：7 列星期头 + 日期格子 + heat dots（按该日 asset 数量分级）
- 今天：蓝色圆形背景
- 点击日期 → 跳转 Day View 页

#### 2.1.3 Tab 筛选栏

横向滚动：全部 · ⚡闪念 · ✅待办 · 💰记账 · 👤联系人 · 💡想法

#### 2.1.4 时间流布局

##### 排序规则

- **最新在最上**：打开 App 默认看到今天，往下滚动看更早内容
- **连续跨日滚动**：有截止日的待办出现在截止日那天（未来行位于今天上方）
- **今天锚点**：页面加载后自动 scrollIntoView 到 #today-row

日期排列顺序（从上至下）：
```
周六 17 明天       ← 有截止日待办的未来行
周五 16 明天
周四 15 今天       ← 默认可见，蓝色圆圈
周三 14 昨天       ← 往下滚
...
```

##### 资产生效时间（effective_date，Method B）

有语义时间的资产只出现在语义时间的日期行，**不在闪念行内重复展示**：

| 资产类型 | 生效时间来源 |
|---|---|
| `flash`（语音闪念） | `created_at` |
| `expense` | `payload.date`（AI 解析的交易日期，如「昨天」→ 实际日期） |
| `todo` | `payload.due_date`（截止日期，可能是未来） |
| `contact` / `idea` / `note` | `created_at` |

##### 日期内排序规则

- 有明确时间（HH:MM）的条目：按该时间排序，时间列显示 HH:MM
- **无明确时间的条目：沉底**——排在当日有时间戳的条目之后，时间列为空
- 同为无时间的条目：按 `created_at` 排序（最新提交的在上）

```
周三 20 昨天
│  18:00  语音闪念：帮我安排…   ← 有时间
│  15:30  联系人：张三          ← 有时间（created_at）
│
│  [——]   ¥150 昨晚麦当劳       ← 无明确时间，沉底
│  [——]   ¥20  昨午咖啡         ← 无明确时间，沉底
```

##### 卡片类型规格

**① 语音闪念行**（仅 `is_voice=true` 的 flash 出现在时间流）

```
[时间]  🎙  {转录内容前 40 字}              [N 项] [›]
            {派生资产类型摘要，如 ✅ 💰 👤}
```

- 转录内容截取前 40 字，`overflow: ellipsis`
- badge：有派生资产 → 绿色「N 项」；无派生 → 橙色「待处理」
- 点击 → 进入 Flash Session 页（对应 session_id）

**什么不出现在时间流：**
- 文字 FAB 输入（`is_voice=false`, `is_followup=false`）
- FlashSession 追问输入（`is_followup=true`）
- 上述输入的派生资产（todo/expense 等）作为独立资产行出现

**② 独立资产行**（non-flash，出现在生效日期行）

```
[时间]  ✅  给刘洋发合同         [›]
            明天截止
```

```
[时间]  💰  ¥150 昨晚麦当劳     [›]
            记账 · 2026-05-20
```

Todo 三种状态样式：
- `pending`：实心圆圈边框，可点击勾选
- `pending_confirmation`：虚线圆圈，不可点击（AI 创建待用户认领）
- `done`：蓝色填充 + SVG 勾，标题划线，整行 opacity 0.6

Todo 副标题颜色：
- 已逾期 → `var(--red)` 加粗
- 今天截止 → `var(--amber)` 加粗
- 其他 → `var(--text3)`

相对日期标签：今天截止 / 明天截止 / 后天截止 / 已逾期 · M/D / 截止 M/D

#### 2.1.5 FAB 底部胶囊

```
[📅] [🗂] | sep | [＋] [🎙] | sep | [✦ Agent]
```

| 按钮 | 说明 |
|---|---|
| 📅 / 🗂 | 切换时间流 / Workspace 视图 |
| ＋ | 打开 FlashModal（文字输入，不进时间流） |
| 🎙 | 打开 MicModal（语音输入，`is_voice=true`，进时间流） |
| ✦ Agent | 进入 AgentChatPage |

---

### 2.2 Flash Session 页（p-flash-sess）

聊天气泡界面。每条输入（语音或文字）对应一对 user + agent 气泡。

#### 2.2.1 Flash Session 生命周期

- **创建时机**：当天第一条闪念（硬件语音或 ＋ 文字 FAB）到达时由后端自动创建，用户不能手动创建
- **命名规则**：`"5月21日 闪念"`（按自然日，`M月D日 闪念` 格式）—— **不叫「今日闪念」**
- **边界**：自然日（00:00 UTC+8）；跨天自动新建；同一天只有一个 flash session
- **列表呈现**：无闪念的天不在列表中出现；有闪念的天按日期降序列出
- **生命周期（前端）**：方案 C —— 页面刷新后前端重置当前 session 指针；历史 session 永久存在于 DB

#### 2.2.2 Header

```
[‹]  ⚡ {日期标题}              [总资产 ›]  [≡]
```

例：`⚡ 5月21日 闪念`

- 点击 `≡` → 打开历史 Session 侧边面板
- 点击 `总资产 ›` → 跳转 Flash Overall 页

#### 2.2.3 消息气泡

**User 气泡（右对齐）**：渐变背景，白色文字，显示原始输入文本（语音闪念显示转录文本）

**Agent 气泡（左对齐）**：
- 头像：渐变圆圈 ✦
- 文本：summary 文字（自然语言确认，如"已记录：待办「…」"）
- 资产卡片 chips：每个派生资产一个 chip（qa 类型不展示，答案已在文本中）
- 耗时：气泡下方小字 `{X.X}s`（仅成功时显示）

#### 2.2.4 输入区

```
[{日期标题}]
[ 说点什么…              ] [✦]
```

**两种 turn 类型，路由不同：**

| 输入来源 | 路由 | 说明 |
|---|---|---|
| 硬件语音 / ＋ 文字 FAB | `POST /api/flash`（pipeline） | 产生派生资产，进时间流（语音）|
| Session 内追问文字 | `POST /api/agent`（MCP 直连） | 不走 pipeline，直接工具调用，全权限 |

- 追问调用 `/api/agent`（或现有 `/api/query`），带 `session_id` 上下文
- 追问不走 Flash Pipeline，不产生派生资产，返回自然语言回复
- 追问可操作资产（query / create / update），但不触发 Dispatcher

#### 2.2.5 历史 Session 侧边面板（≡）

结构分两区：

```
─── 闪念记录 ─────────────────
  📅 5月21日 闪念         ›    ← 点击跳转对应日期的 p-flash-sess
  📅 5月20日 闪念         ›
  📅 5月18日 闪念         ›    ← 无闪念的天不出现

─── 问答对话 ─────────────────
  ＋ 新建会话               ← 清空 currentAgentSessionId，跳转 p-agent-chat
  💬 对话 · 05-21 16:40   ›    ← 点击跳转对应 agent session
  💬 对话 · 05-21 15:58   ›
```

- 位置：右侧全高抽屉（width: 78%），backdrop blur 遮罩
- 触发：header 右侧 `≡` 按钮
- 当前 session 蓝色边框高亮 + 「当前」标签

#### 2.2.6 历史消息重建逻辑

加载 session 时，通过 `asset_type=flash` 的资产重建对话：
- 每个 flash card → user 气泡（`payload.content`）+ agent 气泡（`payload.agent_summary` + 派生资产 chips）
- 追问 turn → user 气泡（追问文本）+ agent 气泡（自然语言回复）
- 排序：按 `created_at` 升序（最早的在上）

---

### 2.3 输入来源与路由规则

所有输入按来源路由，**路由由输入元数据决定，不依赖 LLM 推断**。

| 来源 | 入口 | API 路径 | 处理路径 | 进时间流？ |
|---|---|---|---|---|
| 硬件语音（🎙） | 硬件按钮 / MicModal | `POST /api/flash` | Flash Pipeline | **✅（`is_voice=true`）** |
| 文字 FAB（＋） | FlashModal | `POST /api/flash` | Flash Pipeline | ❌（`is_voice=false`）|
| 闪念追问 | FlashSession 输入框 | `POST /api/agent` | MCP 直连（无 pipeline） | ❌ |
| Agent 对话 | AgentChatPage 输入框 | `POST /api/agent` | MCP 直连（无 pipeline） | ❌ |
| 语音上传（Whisper） | 未来 | `POST /api/flash/audio` | Flash Pipeline | ❌（待定）|

**两个入口不互通**：
- 硬件语音 / ＋ FAB → 只进 **Flash Session**
- Agent 对话框 → 只进 **Agent Session**
- 闪念追问 → 在 **Flash Session** 内，但走 MCP 直连

> **时间流过滤逻辑（StreamPage `buildTimeline`）**：
> ```typescript
> assets.filter(a =>
>   a.payload.asset_type === "flash" &&
>   !a.payload.is_followup &&
>   !!a.payload.is_voice
> )
> ```

---

### 2.4 Flash Overall 页（p-flash-overall）

```
[‹]  总资产                     [↺]
     {session 标题} · N 项
```

按资产类型分区展示，每区：
- Section 标题：`[图标] 类型名 · N 条`
- 资产行：`[图标] [标题] [副标题]` + `[Turn N ↗]` chip（待实现）+ 时间

---

### 2.5 Day View 页（p-day-view）

触发：点击时间流中的日期列

```
[‹]  周四 · 5月21日              [＋]
     N 条记录 · 今天
```

当前实现：基础版，展示当日所有资产。

---

### 2.6 Workspace 页（p-workspace）

通过 FABBar 的 🗂 按钮切换，与时间流同级。

- 按资产类型分区：待办 / 记账 / 想法 / 文件 / 联系人
- 每区展示最新 N 条，点击 `›` 进入资产详情页
- 待办支持 inline 勾选（同 StreamPage TodoCheckbox）

---

### 2.7 资产详情页（p-asset-detail）

触发：点击任意资产行 `›`

- 展示 payload 全部字段，可编辑
- 编辑逻辑：`PUT /api/assets/{id}`，同时同步 asset_fields（queryable fields）

---

### 2.8 AgentChatPage（p-agent-chat）

#### 2.8.1 Session 生命周期

- **创建时机**：用户在 Agent 页发出**第一条消息**时由前端触发创建（不是进入页面时）
- **命名规则**：`"对话 · 05-21 16:40"`（首条消息的时间）
- **续聊**：点击 `✦ Agent` FAB → 恢复 `currentAgentSessionId`（若存在）
- **前端持久化**：方案 C —— `currentAgentSessionId` 存于 React Context（刷新后重置为 null）
- **新建**：从 `≡` 侧栏点击 `＋ 新建会话` → 清空 `currentAgentSessionId`，进入空白欢迎页

#### 2.8.2 欢迎页（无 session）

```
✦（大图标）
你好，我是 Eureka Agent
我可以帮你检索记录、总结会议、追踪待办和联系人

[今天有什么待办事项？]  [帮我总结最近的会议]
[有哪些未跟进的联系人？]  [分析我的支出情况]
```

- 点击建议 chip → 填充输入框（不自动发送）
- 发送第一条消息 → 后端创建 session → 前端存 `currentAgentSessionId`

#### 2.8.3 对话页（有 session）

- 气泡样式与 FlashSessionPage 一致（user 右对齐，agent 左对齐）
- 支持全权限 MCP 工具：query / create_asset / update_asset / query_contact / create_contact 等
- 历史消息在 session 内持久，刷新后通过 `session_id` 重新加载

#### 2.8.4 Header

```
[‹]  ✦ Ask Agent              [≡]
     Eureka 3.0 · 智能问答
```

- `≡` 打开统一 Session 侧边面板（同 2.2.5）
- 无「总资产」按钮（Agent session 无 Flash Overall 概念）

---

## 三、数据模型规格（当前实现）

### 3.1 Asset payload 字段（各类型）

| 类型 | 必填字段 | 可选字段 |
|---|---|---|
| `flash` | `content`（转录/输入文本）, `is_flash: true`, `input_id` | `is_voice`, `is_followup`, `audio_url`, `agent_summary` |
| `todo` | `content`（任务内容）, `status`（pending/done/pending_confirmation） | `due_date`（YYYY-MM-DD 或含时间的 ISO 串） |
| `expense` | `amount`, `date`（YYYY-MM-DD） | `description`, `merchant`, `category`, `currency` |
| `idea` | `content` | `title` |
| `contact`（独立表） | `name` | `phone`, `company`, `title`, `email`, `notes[]` |

> **字段命名规范**：
> - todo 用 `content`（不是 `title`），`due_date`（不是 `due_at`）
> - todo 初始状态为 `status: "pending"`（不是 `"active"`）
> - `pending_confirmation` 表示 AI 创建但用户尚未认领的待办

### 3.2 Flash asset 生命周期

```
1. 用户提交（语音或文字）
2. /api/flash 立即创建 raw flash asset（asset_type=flash），含 input_id
3. Flash Pipeline 并行处理（Dispatcher → Sub-skills → Session Writer）
4. Sub-skills 创建派生 asset（todo/expense/contact 等），含相同 input_id
5. Session Writer 生成 summary + cards JSON
6. /api/flash 将 agent_summary 写回 flash asset（update_asset）
7. 返回 FlashResponse：{ok, session_id, summary, cards, has_pending, elapsed_ms}
```

`input_id` 是连接 flash 容器与其派生资产的纽带：
- Flash 容器：`payload.input_id = X`
- 派生资产（todo/expense 等）：`payload.input_id = X`（同一个 X）
- 前端通过 input_id 聚合派生资产，显示在对应 flash 行的摘要中

### 3.3 Flash Pipeline（三步）

```
Step 1 — Dispatcher（1 次 LLM）
  input: user_text + today_str
  output: [{type, source_text}, ...]

Step 2 — Sub-agents（并行 LLM × N）
  todo-skill   → create_asset(todo, {content, due_date, status})
  expense-skill → create_asset(expense, {amount, date, ...})
  contact-skill → query_contact → create/update_contact(payload)
  idea-skill    → create_asset(idea, {content})
  qa-skill      → 直接回答，不写 asset

Step 3 — Session Writer（1 次 LLM）
  input: user_text + all sub-skill results
  output: {summary, cards, has_pending}
```

Session Writer cards schema：
```json
{
  "card_type": "todo | expense | contact | idea | qa | pending_contact | error",
  "title": "...",
  "subtitle": "...",
  "asset_id": "uuid（有 asset 时必填）"
}
```

### 3.4 联系人（Contact）多候选处理

contact-skill 查询到 2+ 同名时：
- 不写入任何数据
- 返回 `status: "pending_confirmation"` + `candidates[]`
- Session Writer 将其包装为 `card_type: "pending_contact"`

---

## 四、组件规格

### 4.1 TodoCheckbox 组件

三种视觉状态（22×22 圆形）：

| status | 样式 |
|---|---|
| `pending_confirmation` | 虚线边框（`dashed var(--border)`），opacity 0.55，不可点击 |
| `pending` | 实线边框（`solid var(--text3)`），透明背景，可点击 |
| `done` | 蓝色填充（`var(--blue)`）+ SVG 白色勾，可点击反选 |

交互：乐观更新，API 失败时回滚。点击停止冒泡（不触发父级 goDetail）。

### 4.2 MicModal（语音输入）

- 技术：浏览器 Web Speech API（SpeechRecognition，`lang: "zh-CN"`）
- 保存时调用：`api.flash(text, undefined, false, true)` — 第 4 个参数 `is_voice=true`
- 支持模式：⚡闪念 / 📋会议记录（会议记录自动加「【会议记录】」前缀）
- 保存后 onSaved 回调触发时间流刷新

### 4.3 FlashModal（文字 FAB）

- 调用：`api.flash(text)` — `is_voice=false`（默认）
- 派生的 flash asset 不进时间流（仅在 FlashSessionPage 中可见）
- 有 55s 超时保护，后端先落库再处理，超时不影响数据

### 4.4 Session 侧边面板（FlashSessionPage & AgentChatPage）

统一样式（width: 78%，右侧全高，backdrop blur）：
- 当前 session：蓝色边框高亮 + 「当前」标签
- 其他 session：点击切换，`navTo("p-flash-sess", { session_id })`
- `›` 箭头在右侧

---

## 五、API 接口规格

### POST /api/flash

**Request：**
```json
{
  "text": "string",
  "session_id": "string（可选，空=自动创建今日 daily session）",
  "is_followup": false,
  "is_voice": false
}
```

**Response（FlashResponse）：**
```json
{
  "ok": true,
  "session_id": "uuid",
  "summary": "已记录：待办「…」。",
  "cards": [
    { "card_type": "todo", "title": "...", "subtitle": "...", "asset_id": "uuid" }
  ],
  "has_pending": false,
  "elapsed_ms": 3420
}
```

### GET /api/assets

参数：`type`, `session_id`, `contains`, `limit`（默认 50，最大 500）

返回：`{ ok, assets: [{ id, payload, session_id, created_at }] }`

### PUT /api/assets/{id}

**Request：** `{ "payload_patch": { ... } }`（merge 语义）

同时同步 asset_fields（queryable 字段索引）。

### POST /api/flash/audio

接受 multipart 上传（`audio` 文件 + 可选 `session_id`）：
1. 保存音频文件
2. Whisper ASR 转录
3. 创建 flash asset（含 `audio_url`，但**当前不设 `is_voice=true`**，不进时间流）
4. 运行 Flash Agent 处理
5. 返回 FlashAudioResponse（含 `transcript`, `audio_url`）

> 注：`/api/flash/audio` 当前 UI 未调用，保留供未来原生 App 使用。

---

## 六、优先级路线图

### 已完成（v1.3）
- [x] 时间流逆序 + 连续跨日滚动
- [x] 资产生效时间（effective_date，Method B）
- [x] 语音闪念 `is_voice` 标记 + 时间流过滤
- [x] FlashRow 显示转录内容（不显示"Turn N"）
- [x] Todo 圆形 Checkbox + 三态样式 + 乐观更新
- [x] Todo 相对截止日标签（今天/明天/已逾期/截止M/D）
- [x] Flash Pipeline 字段对齐（content/due_date/pending）
- [x] Contact tool 单 payload 参数（避免 Gemini FunctionCall 验证错误）
- [x] Session Writer cards 含 asset_id
- [x] FlashSessionPage → 聊天气泡界面
- [x] FlashSessionPage → 取消"?"路由，所有输入走 Pipeline
- [x] Session 侧边面板统一（FlashSessionPage + AgentChatPage）
- [x] Agent 气泡耗时展示（Xs）
- [x] QA 卡片不在 Agent 气泡中重复展示
- [x] AgentChatPage session 点击跳转 FlashSessionPage
- [x] Workspace 视图（按类型浏览资产）
- [x] 资产详情页（可编辑）

### P1（下一步）

**Session 管理（v1.4 新增）：**
- [ ] **Flash Session 命名**：Header 改为 `"5月21日 闪念"`，去掉 `"今日闪念"`
- [ ] **Flash Session 按天创建**：后端确保同一自然日复用同一 session_id（`GET /api/sessions?type=flash&date=YYYY-MM-DD`）
- [ ] **闪念追问路由分离**：FlashSession 输入框发出的追问走 `POST /api/agent`，不走 Flash Pipeline
- [ ] **≡ 侧栏重构**：分「闪念记录」和「问答对话」两区；Agent 区加「＋ 新建会话」按钮
- [ ] **Agent Session 续聊**：`currentAgentSessionId` 存 React Context；点 `✦ Agent` FAB 时恢复上次 session
- [ ] **Agent Session 懒创建**：进入 AgentChatPage 时不创建 session，发第一条消息时创建

**已有 P1：**
- [ ] **无时间项沉底**：日期区块内，无明确 HH:MM 的条目排在有时间戳的条目之后
- [ ] **Flash 追问上下文感知**：追问能引用当日资产（"把刚才那个待办改成后天"）
- [ ] **资产删除**：长按/滑动删除，调用 `DELETE /api/assets/{id}`
- [ ] **手动创建资产**：各类型列表的 `＋` 按钮

### P2（后续迭代）
- [ ] Flash Overall Turn N ↗ chip（资产 → session 溯源）
- [ ] Flash Session 滚动到指定 Turn（flash_id 参数）
- [ ] 会议卡片（时间流中的 meeting session 行）
- [ ] 待分析文件卡（`+ 分析` CTA）

### P3（长期）
- [ ] Meeting Session 页（音频 + 说话人 + 行动项）
- [ ] Speaker match sheet

---

*字段命名权威：`content`（不是 title）、`due_date`（不是 due_at）、`status: "pending"`（不是 "active"）。任何与上述不一致的 skill prompt 需同步修正。*
