# Ask Agent App 产品口径

**版本**：v0.3  
**状态**：草案（收敛为产品边界文档，UIUX 回复方式待定）  
**关联文档**：
- [ASSET_AND_SESSION_ARCHITECTURE.md](./ASSET_AND_SESSION_ARCHITECTURE.md)（资产与 Session 统一架构）
- [FLASH_NOTE_SKILL_ARCHITECTURE.md](./FLASH_NOTE_SKILL_ARCHITECTURE.md)（闪念 Skill 处理流程）
- [HOME_LOGIC_SPEC.md](./HOME_LOGIC_SPEC.md)（首页 Agent Console 与 Files 信息架构）

---

## 一、文档定位

本文档只定义 Ask Agent 在 App 内的产品边界、入口关系、会话范围和与资产体系的关系。

现阶段**不锁定最终 UIUX 形态**，也不预设 Agent 回复必须采用某一种固定结构（例如 `text + citations`、cards、blocks 或 markdown）。具体回复展示方式应在 UIUX 方案确定后，再单独补充展示契约。

---

## 二、Ask Agent 的产品目标

Ask Agent 是用户与个人数据、AI 生成内容、硬件输入记录之间的自然语言入口。

它需要支持三类核心能力：

| 能力 | 说明 |
|---|---|
| 查询 | 查询联系人、会议、提醒、文件、闪念记录等已有内容 |
| 追问 | 基于某个 Session、某条 Asset、某个 Contact 或某个 File 继续追问 |
| 操作 | 创建、修改、删除或确认某些数据，例如创建 Todo、更新 Contact、确认候选联系人 |

Ask Agent 不直接替代资产详情页，而是作为跨资产、跨 Session 的解释与操作入口。

---

## 三、入口类型

### 3.0 首页入口关系

首页入口由 [HOME_LOGIC_SPEC.md](./HOME_LOGIC_SPEC.md) 统一定义：

| 区域 | 入口 |
|---|---|
| Agent Console | Agent 动态、待处理事项、主动消息、`Start a new chat` |
| Files | Meeting audio session、系统生成 Markdown、用户文件和系统文件夹 |

普通 `conversation` Session 不进入 Files 主列表。用户通过 Agent Console 的 `Start a new chat` 创建 conversation，并在 Ask Agent 内部管理 history。

### 3.1 General Ask Agent

General 入口用于用户发起开放问题。

典型问题：
- “我今天有什么要跟进的？”
- “Kevin 最近提到过什么需求？”
- “帮我找一下上次关于预算的会议。”

General 入口不绑定具体实体，但可以通过用户提问和历史上下文检索相关资产。

### 3.2 Context-based Ask Agent

Context-based 入口从某个具体对象进入，例如：

- Contact 详情页
- Meeting / Event 详情页
- Todo / Reminder 详情页
- File 详情页
- Flash Note / Meeting Session 详情页

进入时 App 应明确区分两类动作：

| 入口类型 | 处理方式 |
|---|---|
| Existing Session Workspace | 不创建新 Session，只向当前 Session 追加新的 `turn_input`。 |
| Object Detail Page | 创建新的 `conversation` Session，并把当前对象作为 `anchor_input`。 |

Object Detail Page 包括 Asset、Contact、File、系统生成 Markdown 等具体内容详情页。它们不是继续原来的 source Session；即使该对象本身来自某次 Meeting 或 Flash Note，用户在对象详情页发问时，也应以当前对象作为新 conversation 的上下文锚点。

对象详情页自身不等同于 Ask Agent 页面。用户打开 `note.md`、`idea.MD`、Contact 或 File 时，应先看到该对象的详情内容；详情页提供 `Ask Agent` 入口。只有点击该入口后，才进入新的 `conversation` Session，并展示基于当前 anchor 的建议问题。

对于系统生成的聚合 Markdown，例如 `idea.MD`，`anchor_input` 不是单个 Markdown 字符串，而是一个组合型上下文锚点。UI 上应像 File source 一样展示为可点击 block；点击后展示该 anchor 包含的所有 `idea` Asset。

进入 Agent 时 App 应向 Agent 注入当前 context：

```json
{
  "scope": "session",
  "scope_id": "session_001"
}
```

`scope` 可按产品对象扩展，例如：

| scope | 说明 |
|---|---|
| `global` | 全局 Ask Agent |
| `contact` | 某个联系人 |
| `asset` | 某条 Asset，例如 Todo / Idea / Note |
| `file` | 某个原始文件 |
| `session` | 某次内容生产过程，例如闪念 / 会议 |

---

## 四、Scope 与检索边界

不同入口的 `scope` 不只影响初始提示，也影响 Agent 默认能优先检索哪些数据。

| scope | 默认上下文 | 可扩展检索范围 | 前端提示 |
|---|---|---|---|
| `global` | 用户全局 contacts / assets / files / sessions 的可检索摘要 | 按用户提问召回相关 Session、File.parsed_content、Asset payload、Contact 字段 | 无需特别提示 |
| `contact` | 当前 Contact 的完整字段与 update_log | 与该 Contact 相关的 Session、File speaker 关联、语义相关 Asset | 若跨出当前 Contact，应在回复中说明“同时参考了相关记录” |
| `asset` | 当前 Asset 的 payload、状态与来源 | 该 Asset 的 source Session、相关 File、同类型 Asset | 若修改或替换 Asset，需要明确展示目标对象 |
| `file` | 当前 File 的元数据、parsed_content 与文件类型扩展字段 | 使用该 File 作为 input 的 Session、由该 File 生成的 Asset | 需要区分“原始文件内容”和“AI 生成结果” |
| `session` | 当前 Session 的 inputs、messages、output.items | 该 Session 关联的 File / Asset / Contact 操作结果；必要时可语义召回历史 Session | 若跨 Session 召回，应提示引用了其他历史记录 |

默认原则：

1. Context-based 入口优先围绕当前 `scope_id` 回答。
2. Agent 可以跨范围检索，但应避免让用户误以为答案只来自当前页面。
3. 涉及写操作时，必须明确目标实体；多候选时进入确认流程。

---

## 五、会话与 Session 的关系

Ask Agent 的对话本身可以形成 conversation Session。

统一架构中，Session 有三类：

| session_type | 入口 | 说明 |
|---|---|---|
| `flash_note` | 硬件闪念录音 | 记录闪念输入、Skill 拆解结果和后续追问 |
| `meeting` | 硬件会议录音 | 记录会议音频、转写、总结、Todo 提取和后续追问 |
| `conversation` | App 内 Ask Agent | 记录用户与 Agent 的自然语言对话和操作结果 |

Ask Agent 可以：

1. 创建新的 `conversation` Session；
2. 在某个已有 `flash_note` 或 `meeting` Session 内继续追问；
3. 基于某条 Asset / Contact / File / 系统生成 Markdown 发起新的 `conversation` Session，并把该对象写入 `anchor_input`。

### 5.1 Session 工作台的展示语义

App 展示 Session 时，应遵循同一套信息语义，但不在本阶段锁定具体 UIUX 形态。

| 区域语义 | 数据来源 | 规则 |
|---|---|---|
| Current Turn | `turns[current]` | 主内容聚焦当前轮 input 与 output |
| Session Sources | `inputs[]` 中的 `anchor_input` | 只展示 Session 级上下文锚点及其派生资料 |
| Generated Results | `output.items[]` | 展示当前 Session 到目前为止累计生成的 Asset 和操作结果 |
| Continue Input | 新增 `turn_input` | 用户继续追问时生成下一轮 turn |

规则：

1. 轮次切换按垂直时间流理解：上一轮 / 当前轮 / 下一轮。
2. 单轮 Agent 回复可以较长，允许在当前 turn 内滚动查看。
3. Source 不等于所有历史输入；普通 text / audio 追问只属于对应 turn。
4. Meeting 的会议音频是 `anchor_input`，因此它的 audio / transcript / speakers / attachments 是 Session sources。
5. Flash Note 通常没有 `anchor_input`；每次硬件短录音或用户文字追问都是 `turn_input`。
6. Flash Note 的硬件短录音是 `audio turn_input`。App 应在对应 Turn 内展示原始音频信息（播放入口、时长、录入时间等）和 ASR 转录文本；这些内容不进入 Session Sources。
7. Generated Results 是 Session 级累计结果，后续 turn 中仍应可查看前面生成的 Note / Todo / Idea / Contact 操作。
8. 从对象详情页进入 Ask Agent 时，当前对象成为新 `conversation` 的 `anchor_input`；用户选择建议问题或手动输入后，才生成第一轮 `turn_input`。
9. 从 existing Session 继续追问时，不新增 anchor，也不创建新 conversation，只追加新的 `turn_input`。
10. Object Detail Ask 进入 Ask Agent 后，`Generated Results` 初始为空；只有 Agent 在该 conversation 中产生新结构化结果时才展示。
11. Object Detail Ask 的首屏可以展示建议问题，帮助用户理解当前 anchor 可以如何被追问。
12. 聚合 Markdown 作为 `anchor_input` 时，应保留其组成 Asset 列表，例如 `idea.MD` 对应 N 个 `idea` Asset；用户可从 anchor source block 展开查看全部组成项。

---

## 六、App 需要展示的结果类型

在 UIUX 方案未定前，App 只需要在产品层面支持以下结果类型，不绑定具体 UI 组件：

| 结果类型 | 来源 | App 需要表达的信息 |
|---|---|---|
| Agent 回复 | `messages[]` 或运行结果 | Agent 对用户问题的自然语言回答 |
| Asset 创建 | `Session.output.items[]` | 新创建了哪些 Todo / Idea / Note 等 |
| Asset 更新 | `Session.output.items[]` | 哪些 Asset 被修改、替换、完成或忽略 |
| Contact 操作 | `Session.output.items[]` | 已更新联系人，或需要用户确认候选联系人 |
| 候选确认 | `Session.output.items[]` | 多个 Kevin、多条可能匹配结果等，需要用户 double check |
| 错误 / 失败 | `Session.output.items[]` 或消息 | ASR 失败、执行失败、权限不足、网络异常等 |

具体展示可以是卡片、列表、气泡、确认面板或详情页模块，后续由 UIUX 决定。

---

## 七、与 Asset / Session 架构的关系

App 不直接根据 Agent 的自然语言猜测应该展示什么，而是消费后端和 Agent 产生的结构化结果。

当前主线结构为：

```json
{
  "session_id": "session_001",
  "messages": [],
  "output": {
    "items": [
      { "type": "asset_created", "asset_id": "asset_001" },
      { "type": "contact_update_pending", "candidates": ["contact_001", "contact_002"] }
    ]
  }
}
```

App 的职责：

1. 展示用户输入、Agent 回复和 Session 历史；
2. 展示 `output.items[]` 中的结构化结果；
3. 对候选确认类 item 提供用户选择入口；
4. 对 Asset / Contact / File 提供跳转详情能力；
5. 将用户后续追问继续追加到对应 Session 或新建 conversation Session。

---

## 八、暂不锁定的内容

以下内容本阶段不做强约束：

- Agent 回复最终采用 markdown、cards、blocks、citations 还是混合结构；
- 聊天气泡的具体布局；
- 卡片横向滚动还是纵向排列；
- 是否展示“思考过程”；
- Chat history 的抽屉方向、导航位置和视觉样式；
- 错误提示的视觉形态；
- 快捷回复、按钮、表单等交互控件。

这些都应在 UIUX 方案明确后，另开展示契约文档统一定义。

---

## 九、第一阶段验收口径

- [ ] App 可以从 General 入口发起 Ask Agent 对话。
- [ ] App 可以从 Contact / Asset / File / Session 等 context 入口发起追问。
- [ ] Agent 对话可以写入 `conversation` Session。
- [ ] 闪念和会议 Session 可以继续追问，并保留原始输入与后续输出。
- [ ] App 可以展示 `Session.output.items[]` 中的 Asset 创建、Contact 候选确认和错误结果。
- [ ] 多候选 Contact 场景下，用户可以在 App 中 double check 后再确认写入。

