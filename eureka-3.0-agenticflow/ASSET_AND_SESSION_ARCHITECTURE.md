# 资产与 Session 架构

**版本**：v0.8  
**状态**：草案

**v0.8 相对 v0.7 的核心变更**：
1. 首页 Assets 区重命名为 **Workspace**，按 asset_type 分类进入二级管理页。
2. 首页交互：移除底部 Tab bar，改为悬浮胶囊（Capture + 上传文件）。
3. File 详情页：Tab 从 Summary 改为 **Notes**，解析产出与追问产出的 Note 混排在同一 Tab，子 Tab 按 Note 标题切换。
4. Asset 挂载规则明确化：来源是 File/Contact 的追问产出可挂到对应详情页；来源是 Asset 的追问产出只进 Workspace。
5. Ask Agent 输入气泡统一：语音和文字输入均放**右侧气泡**，语音气泡展示播放器 + 转录文字（过长可展开）。
6. Asset 详情页：支持编辑，展示来源并支持回跳（定位到具体 Session 对话位置）。
7. Agent 回复末尾新增"保存为 Note"功能。
8. Context Banner：所有带 context 的 Ask Agent Session 顶部常驻背景信息，可跳转。

---

## 一、设计哲学：Skill 即产品功能

系统的核心目标是构建一个**以 Skill 为扩展单元的内容生产平台**，让产品、技术、前端三方解耦：

- **PM** 定义 Skill：触发条件 + 输出结构 + asset_type 标签
- **Agent** 运行时：用户输入 → dispatcher 匹配 Skill → 执行 → 输出结构化内容
- **后端**：统一存储所有 Skill 产出，默认不理解业务语义
- **前端**：新 asset_type → 新渲染模板 + 新入口，按类型从后端取数展示

新增一个产品功能，只需要：定义 Skill → 注册触发条件 → 前端加模板。后端不变。

---

## 二、两条内容生产管线

系统有两条性质完全不同的内容生产路径：

```
管线一：文件解析（File Analysis）
─────────────────────────────────
File 上传 → AI 解析 → 产物直接归属 File
全程无 Session，File 是主体


管线二：对话（Conversation）
─────────────────────────────────
用户输入 → Agent 对话 → 产物归属 Session
用户是驱动者，Session 是主体
```

两条管线产出的 Asset 通过 `source_type` 区分：

| source_type | 含义 |
|---|---|
| `file_analysis` | 文件解析管线产出，溯源到具体 File |
| `session` | 对话管线产出，溯源到具体 Session + 具体一轮输入（input_id） |
| `manual` | 用户手动创建，无 AI 来源 |

---

## 三、三张核心数据表

```
files      原始文件 + 解析状态 + 解析产物引用 + 文件专属内容（speakers / attachments）
contacts   联系人，独立生命周期，支持增删改查
assets     所有结构化内容产物，来源可以是文件解析、对话或手动创建
```

这三张表互相独立，不混用。关联关系极少且全部由用户主动建立：

- 音频文件的说话人 → 用户手动关联到 Contact
- 音频文件的现场附件（照片等）→ 用户手动关联到其他 File
- Contact 的变更记录 → 记录哪个 Session / 哪轮输入改动过

---

## 四、文件（File）

File 是文件解析管线的主体。

**核心状态**：上传后 `analysis_status` 为待解析，触发解析后流转到解析中 → 完成/失败。

**解析完成后**：产出的 Asset（Note / Todo 等）ID 列表挂在 File 下，`source_type = "file_analysis"`。

**用户追问**：用户对已解析文件点击「Ask Agent」，创建一个以该 File 为 context 的新 conversation Session。File 记录这个 Session 的 ID（用于跳转）。

**音频文件的专属内容**：
- `speakers[]`：ASR 自动识别说话人，用户可手动将每位说话人关联到联系人
- `related_files[]`：与此文件建立了关联的其他 File ID 列表（双向关联）

**关联文件规则**：
- 关联关系由用户主动建立，系统不自动推断
- 建立方式：在 File 详情页通过 ＋ → 关联文件，选择已有文件或上传新文件
- 关联是双向的：音频关联了图片，图片的"关联文件"里也会显示该音频
- 取消关联：任意一侧点击叉号即可解除（不删除文件本体）
- 删除文件：只能在各自的文件详情页操作，删除后自动解除所有关联

**文件夹**：
- File 可归属一个或多个用户自建文件夹（`folder_ids[]`）
- 系统默认文件夹按文件类型自动归类（录音 / 图片 / 文档），无需 folder_ids
- "全部文件"和"未分组"是系统视图，不是实体文件夹

其他文件类型（PDF / 图片）按需定义自己的扩展字段，互不干扰。图片和 PDF 也是独立 File 实体，有自己的详情页（预览 + 关联文件 Tab + Ask Agent 入口）。

---

## 五、联系人（Contact）

Contact 是独立的业务实体，不从属于任何 File 或 Session。

**创建来源**：NFC 名片交换（硬件）、App 内手动填表、Ask Agent 对话指令。

**核心字段**：姓名、公司、职位、电话、邮箱、备注（`notes[]`）。所有字段支持增删改查。

**关联 Assets**：Contact 详情页展示一个 `related_assets` 区，汇聚所有以该 Contact 为 context 的追问 Session 所产出的 Asset。

**变更记录**：Contact 维护一份极简 `update_log[]`，只记录「哪个 Session 的哪轮输入改动过我」，不记录字段 diff。具体改动内容去对应 Session 查看。

**Agent 写入原则**：
- 唯一高置信匹配 → 直接更新，Session 留记录
- 多个候选 → 列出候选，用户确认后再写
- 无匹配 → 创建草稿或降级为 Note，等用户整理

---

## 六、资产（Asset）

Asset 是所有内容产物的统一容器，`asset_type` 是开放可扩展的类型标签。

**内置 asset_type**：

| asset_type | 说明 | 典型来源 |
|---|---|---|
| `todo` | 待办事项，含认领状态、due_at 等 | 文件解析 / 对话 / 手动 |
| `idea` | 想法记录 | 对话 / 手动 |
| `note` | 笔记或摘要，`note_type` 区分子类型 | 文件解析 / 对话 / 手动 |

`note_type` 子类型示例：`meeting_summary`（音频解析）/ `pdf_summary`（PDF 解析）/ `manual`（手动）/ `conversation_note`（对话生成）。

**扩展 asset_type 示例**：`expense`（记账，含金额/地点）、`vocabulary`（单词）、`health_log`（健康记录）。新增时后端不变，只需定义 Skill + 前端模板。

**Todo 认领机制**：AI 生成的 Todo 初始为 `pending_confirmation`（待认领），不直接进入 Todo 列表。用户认领后变为 `pending`，忽略后变为 `dismissed`。Todo 不关联 Contact，「给 Kevin 发报价」的语义只存在于标题文字中。

---

## 七、Session：仅用于对话

Session 只在用户主动发起对话时创建，不承载文件解析过程。

### 7.1 Session 的统一类型：conversation

只有一种 `session_type: "conversation"`，通过 `context_tag` 区分入口和场景：

| context_tag | 场景 |
|---|---|
| `flash` | 全局闪念对话，per-user 唯一且持续，硬件语音为主要输入方式 |
| `general` | 普通 Ask Agent，无上下文锚点 |
| `anchored` | 以某个已有对象（File / Asset / Contact）为背景发起的对话 |

### 7.2 Context（上下文锚点）

当用户从某个对象详情页发起 Ask Agent 时，Session 持有一个可选的 `context`，表示「这个对话在哪个对象的背景下展开」。

```
context
  ├── context_type: "file" / "asset" / "contact"
  └── context_id: 对象 ID（指向系统中已有的对象）
```

**重要语义**：context 不是用户"传入"的内容，而是 Agent 在处理每轮输入时自动通过 MCP 获取的背景信息。用户不需要做任何操作，Agent 会自动感知这个背景。

`flash` 和 `general` 类型的 Session 没有 context，`anchored` 类型必须有 context。

### 7.3 Session 的构成

```
Session
  ├── context（可选）：对话背景锚点，Agent 自动获取，用户无感知
  ├── turns[]：对话轮次，每轮包含用户输入和 Agent 回复
  │     └── turn_input：用户当轮的真实输入（文字 / 语音），带 input_id
  └── output.items[]：本 Session 累计产出的结构化结果
```

`output.items[]` 类型：

| type | 说明 |
|---|---|
| `asset_created` | 创建了 Asset |
| `asset_updated` | 修改或认领了 Asset |
| `contact_updated` | 更新了 Contact |
| `contact_update_pending` | 需要用户确认候选 Contact |
| `error` | 处理失败 |

---

## 八、处理管线

### 8.1 文件解析管线

```
File 上传
  ↓
AI 解析（ASR 转写 / OCR / 结构化提取）
  ↓
Analysis Skill 产出 Asset（note / todo / ...）
  source_type = "file_analysis"
  ↓
产物 ID 列表写入 File，解析状态变为完成
```

全程无 Session。解析策略由文件类型对应的 Analysis Skill 决定：
- 音频 → 先生成 summary Note，再提取 Todo
- PDF → 生成摘要 Note
- 图片 → OCR / 内容描述

### 8.2 对话管线

```
用户输入（文字 / 语音）
  ↓
创建或复用 conversation Session
  ↓
若有 context → Agent 通过 MCP 获取背景对象内容
  ↓
conversation-skill 理解意图
  ├── 查询 → 返回结果
  ├── 创建 → 调用子 Skill，产出 Asset（source_type = "session"，记录 source_input_id）
  ├── 修改 → MCP 写入
  └── 删除 → MCP 删除
  ↓
结果写入 Session output.items[]
```

**Flash 对话**：per-user 全局 Session（`context_tag: "flash"`），复用同一个 Session，每条语音/文字作为新的 turn_input 追加。闪念本质是 Ask Agent，只是输入方式是硬件语音。

**子 Skill**（两条管线共享，无状态可复用）：

| 子 Skill | 职责 |
|---|---|
| `todo-sub-skill` | 意图文字 → Todo Asset |
| `idea-sub-skill` | 意图文字 → Idea Asset |
| `note-sub-skill` | 文字段落 → Note Asset |
| `contact-sub-skill` | 人物信息 → Contact 增删改查指令 |

### 8.3 手动创建

用户直接在 App 内创建 Asset，`source_type = "manual"`，不触发任何 Skill，不创建 Session。

---

## 九、展示层

### 9.1 首页结构

```
首页
├── Agent Console
│     闪念处理结果通知、文件解析完成通知、待认领 Todo 提醒
│     快捷入口：Flash / New Chat
│
├── Files 区（文件夹模式）
│     标题行显示当前文件夹名称，点击展开文件夹 Sheet
│     Sheet 内：
│       - 全部文件（系统默认）
│       - 录音 / 图片 / 文档（系统默认，按文件类型自动归类）
│       - 未分组（无文件夹的文件）
│       - 用户自建文件夹（支持新建、重命名、删除）
│     当前文件夹下的文件列表，显示解析状态，点击进入文件详情页
│     注：音频下挂载的关联图片/文档，在首页 Files 中也独立可见，归入对应分类文件夹
│
└── Workspace 区
      按 asset_type 分类入口（Notes / Ideas / Todos / Expenses…）
      点击分类进入二级列表，支持增改删
      手动创建入口在二级列表页

悬浮胶囊（无底部 Tab bar）
  🎙 Capture：触发硬件录音（全局，不受当前页面影响）
  ✦ Ask Agent：按当前页面 context 进入对应 Session
  ＋ 添加：按页面动态变化
    - 首页：上传文件 Sheet
    - File 详情：添加内容 Sheet（Todo / 关联联系人 / 关联文件）
    - Workspace 列表：新建对应类型 Asset
    - Asset / Contact 详情：隐藏
```

### 9.2 File 详情页

#### 状态 A：未解析
```
[ 文件名 + 播放器 ]

AI 解析说明文字
[ 开始 AI 解析 ]     ← CTA 按钮
```

#### 状态 B：已解析（音频文件完整示例）
```
[ 文件名 + 播放器 ]

[ Notes ] [ Transcript ] [ Reminders ] [ Contacts ] [ 关联文件 ]

Notes Tab：
  子 Tab 切换（标题节选自 Note 标题，非 Note_1/2/3）
  ─ 来源：file_analysis 和 context=该File 的 Session 产出，混排
  ─ 每个 Note 以卡片展示，可跳转详情

Transcript Tab：
  按说话人分块，每个说话人可关联联系人

Reminders Tab：
  所有解析产出的 Todo，可认领

Contacts Tab：
  已关联联系人名片 + 未关联说话人（待确认）

关联文件 Tab：
  与此 File 建立了双向关联的其他 File（图片 / 文档等）
  每条显示：文件图标 + 文件名 + 类型 + 叉号（取消关联）
  不提供删除（删除在该关联文件的详情页处理）

─────────────────────────────
[ Ask Agent about this file ]     ← 创建 anchored conversation
```

### 9.3 Asset 详情页

每种 asset_type 有独立详情模板，均支持编辑：

```
类型图标 · asset_type
标题（可编辑）

来源：
  file_analysis → 点击跳转 File 详情页
  session       → 点击跳转 Session，并滚动定位到 source_input_id 对应的对话位置
  manual        → 不展示来源

内容正文（可编辑）
Todo 专属：due_at / status / 认领操作
Expense 专属：金额 / 地点 / 类别

[ Ask Agent about this ]          ← 创建 anchored conversation（产出只进 Workspace）
```

### 9.4 Ask Agent 对话页

#### 输入气泡（右侧）
- 文字输入 → 普通右侧气泡
- 语音输入 → 右侧气泡，内含：音频播放器条 + 转录文字（过长时截断，展示"展开全部"）

#### Agent 回复气泡（左侧）
- 文字回复 + 内嵌结果卡片（Todo / Note / Idea / Contact）
- 结果卡片直接跟在文字下方，不在底部积累
- 每条文字回复末尾有 **"保存为 Note"** 按钮，点击后该回复被创建为 `conversation_note`

#### Context Banner（带 context 时常驻顶部）
- 展示背景对象的摘要信息（File：文件名+时长；Note：标题+摘要；Contact：姓名+公司）
- 可点击跳转到对应详情页

#### Asset 挂载规则
| context 类型 | 追问产出的 Asset 落点 |
|---|---|
| File | 挂到 File 详情页 Notes Tab（与解析产出混排） |
| Contact | 挂到 Contact 详情页 related_assets |
| Asset | 只进 Workspace，不回挂到原 Asset |
| 无 context（general/flash） | 只进 Workspace |

### 9.5 Flash 对话
- per-user 全局唯一 Session，持续同一对话流
- 输入方式：硬件语音 / App 内录音 / 文字，统一遵循右侧气泡规则
- 产出 Asset 只进 Workspace（`context_tag: "flash"`，无 context）

---

## 十、设计原则

1. **两条管线分离**：文件解析无 Session，对话有 Session，产物通过 `source_type` 区分。
2. **File 是文件解析的主体**：解析产物归属 File，追问 Session 是 File 的可选附属。
3. **Session 只服务对话**：职责收窄，只有 `conversation` 一种类型。
4. **context 是背景，不是输入**：Ask Agent 时的上下文锚点由 Agent 自动获取，用户无感知，不作为 input 传入。
5. **三张表各司其职**：files / contacts / assets，不混用。
6. **所有关联由用户主动建立**：说话人关联、附件关联、联系人变更记录，系统不自动推断。
7. **首页双区**：Files（原始文件）和 Workspace（生成内容分类管理）分离展示，用户心智清晰。
8. **Flash = 全局 conversation**：闪念不是独立产品概念，是全局对话 Session 的一个入口标签，持续同一对话流。
9. **Skill 即产品功能**：新功能只需新 Skill + 新前端模板，后端不变。
10. **Todo 只归属自己**：不关联 Contact，语义只在标题文字中。
11. **Asset 挂载就近原则**：context 是 File/Contact 则挂到对应详情页；context 是 Asset 或无 context 则只进 Workspace。
12. **来源可追溯且可定位**：session 来源的 Asset 回跳时定位到 Session 中具体的对话轮次（input_id）。
