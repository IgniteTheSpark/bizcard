# PRD：首页逻辑与 Files / Agent Console 信息架构

| 属性 | 内容 |
|---|---|
| 状态 | 草案 |
| 版本 | v0.6 |
| 目标 | 定义 App 首页中 Agent Console、Files、系统文件夹与内容入口之间的关系。 |
| 关联文档 | [ASSET_AND_SESSION_ARCHITECTURE.md](./ASSET_AND_SESSION_ARCHITECTURE.md)、[APP_PRD.md](./APP_PRD.md)、[DEMO_SPEC.md](./DEMO_SPEC.md)、[NOTES_FOLDERS_SPEC.md](../bizcard-3.0/NOTES_FOLDERS_SPEC.md) |

---

## 1. 目标与非目标

### 1.1 目标

| 目标 | 说明 |
|---|---|
| 明确首页主结构 | 首页由 Agent Console 与 Files 两个核心区域组成。 |
| 保留 Todo / Contact 既有入口 | Todo 继续由 Calendar / Reminders 承接；Contacts 继续由个人中心 / Contacts 承接。 |
| 定义 Files 的内容范围 | Files 展示硬件采集、file input 产生的 Session，以及可浏览的系统内容文件夹。 |
| 定义系统文件夹 | Notes、Ideas、Expenses 等 Skill 产物可通过系统文件夹聚合展示。 |
| 定义 Markdown 文件承接方式 | 不同系统文件夹可以采用聚合 Markdown 或单条 Markdown 文件承接内容。 |

### 1.2 非目标

| 非目标 | 说明 |
|---|---|
| 不重设 Calendar | Todo / Reminder 的主入口仍在 Calendar。 |
| 不重设 Contacts | Contact 的主入口仍在个人中心 / Contacts。 |
| 不定义最终 UI 样式 | 本文只定义信息架构和规则，不定义视觉稿。 |
| 不定义 Skill prompt | 新 Skill 如何生成内容不在本文范围。 |
| **本期不展开「通用 Agent 主动推送」** | §3.1 **③** 所描述的周期摘要、多 Skill 订阅编排、可配置投递策略等**暂不纳入本期交付**；本期仅收敛 **已有 File / Flash 管线与既有 Asset（含 Todo）** 的**通知与里程碑**（见 §3.0）。 |

---

## 2. 首页结构

首页主滚动区 **自上而下** 建议顺序：

1. **顶栏**：个人中心、品牌区、设备连接、日历（全局导航，不占主列表篇幅）。
2. **Agent Console**：四类推送 + Flash / New Chat 入口。
3. **Workspace**：按资产类型 **横向滑动** 入口（Notes / Reminders / Ideas / Contacts / **Misc** 等），置于 Files **之上**，避免被长文件列表挤出首屏。
4. **Files**：文件夹与文件列表。

下面按「区域」归纳职责（与垂直顺序一致）：

| 区域 | 作用 | 展示对象 |
|---|---|---|
| 顶栏 | 账户与设备、时间与日程入口 | 个人中心、设备连接状态、Calendar |
| Agent Console | **四类推送**：到期 Todo、文件状态、Agent 主动推送、闪念处理；并提供 Flash / New Chat **入口**（后者不产生列表项） | agent events（限定范围） |
| Workspace | 结构化资产分类入口，**横向布局** 便于扫一眼进入各类列表 | Notes / Reminders / Ideas / Contacts / **Misc** 等 |
| Files | 展示硬件采集、file input 产生的 Session，以及系统文件夹 | meeting audio session、Markdown 文件、系统文件夹 |

普通 `conversation` Session 不默认展示在首页 Files 中。用户通过 Agent Console 的 `Start a new chat` 进入 Ask Agent；历史 conversation 可在 Ask Agent 内部 history 中管理。

---

## 3. Agent Console

Agent Console 是首页的 **轻量信号区**，只推送 **与事务进展、文件管线、闪念** 相关的条目（**本期**见 §3.0；**③ 通用主动推送** 长期保留定义、本期不实现）；**不用于展示普通 Ask Agent 会话列表**（Ask 仅在入口进入，历史在 Ask Agent 内管理）。

回答的核心问题：

> 哪些事到期了？文件到哪一步了？闪念处理到哪一步了？（本期不回答「周期摘要等通用 Agent 主动推送」。）

### 3.0 本期范围：已有资产的流转与里程碑通知

本期 **优先落地** 与 **已有 File、解析产物 Asset、Flash 会话** 绑定的 **可点击里程碑**，便于用户从首页感知进度并跳转详情；**不**在本期实现泛化的「Agent 主动推送 / 多 Skill 订阅编排」（见 §1.2）。

| 管线 | 建议 Console 表现（**② 文件** 或 **④ 闪念**） | 点击后 |
|---|---|---|
| **File：上传入库** | 新增一条 **文件状态** 类条目（如「已上传，待解析」），与 Files 列表状态一致 | 进入该 **File 详情** |
| **File：AI 解析完成** | **再出现一条**新条目（或与上条明确区分的时间节点），如「已解析，可查看 Notes / Transcript」 | 进入同一 **File 详情**（默认 Tab 由实现约定） |
| **Flash：已收到输入** | **④ 闪念处理**：如「已收到闪念」 | 进入 **Flash**（`flash` conversation），可定位到最新 turn |
| **Flash：解析 / 结构化完成** | **④ 闪念处理**：如「闪念已解析，已产生 **2** 条 Notes、**1** 条 Todo」（数字为示例，实填以服务端计数为准） | 进入 **Flash** 或 **主要产出**（Notes / Reminders 等，默认路由由实现单写死） |

**原则：** 上述条目均为 **非对话** 信号；**不在 Console 内嵌多轮聊天**。追问仍走 **Ask**（或继续在 **Flash** 内追加 turn）。

**与 ③ 的边界：** 若未来「周报」类能力落地，其首条可见通知仍可归入 **③**；本期 **不要求** Console 出现此类条目。

### 3.1 Console 推送范围（四类）

| 类别 | 内容 | 典型示例 | 点击后 |
|---|---|---|---|
| **① 到期 Todo** | 即将到期或今日到期的 Reminder / Todo | 「整理 demo · 今天 18:00」 | 进入 Calendar / Reminders 或对应 Todo 详情（与既有 Todo 主入口策略一致） |
| **② 文件状态** | 与 File 生命周期相关的状态节点 | 「已上传，待解析」「已解析，可查看摘要 / Transcript」 | 进入该 File 详情（状态与 Files 列表一致，Console 只是更快到达） |
| **③ Agent 主动推送** | 系统或 Agent 发起的**通用**非对话型通知（**本期不实现**） | 周期小结、跨 Skill 订阅摘要、「你有 N 条待认领 Todo」汇总等 | 进入对应 Workspace 分类、汇总页或详情 |
| **④ 闪念处理** | 硬件 / Capture 进入的闪念 **管线里程碑** | 「已收到闪念」→「闪念已解析，已产生 2 条 Notes、1 条 Todo」 | 进入 Flash 或对应产出（与 `flash` conversation / Workspace 一致） |

以上四类以外的 **普通 Ask Agent 对话**（无上下文锚点的闲聊、追问）**不出现在 Console 列表**；用户通过 **Start New Chat / 悬浮 Ask** 进入，记录在 Ask Agent 历史内。

### 3.2 与旧版「Console item 类型」的关系

下列情形仍可归入上表某一类，而不单独作为一类「Console 专属类型」：

| 情形 | 归入 |
|---|---|
| 待确认联系人、待认领 Todo（由解析 / 闪念产生） | **①** 到期/待办，或 **④** 与闪念/文件结果联动（**本期**不强制归入 **③**） |
| 解析失败、可重试 | **②** 文件状态（异常态） |
| **单文件**解析完成、结构化产物已写入 | **②** 文件状态（已解析） |

### 3.3 Start New Chat

Agent Console **区域上仍保留** `Start a new chat`（或与 Flash 并列的快捷按钮），仅作为 **入口**，不产生 Console 列表项。

规则：

1. 点击后创建新的 `conversation` Session（通用 Ask）。
2. 新 conversation **不进入 Console 推送列表**，也不进入 Files 列表。
3. conversation history 仅在 Ask Agent 内管理。

---

## 4. Files 区域

Files 不是纯文件系统，也不是完整 Session 列表。它展示：

1. 由 file input 创建的 Session，例如 Meeting audio session；
2. 系统文件夹，例如 Generated Notes、Ideas、Expenses；
3. 未来扩展的普通文件类型，例如 PDF、Image、Video。

**Flash / 闪念与 Files 的边界（首期与 Eureka Agentic Flow Demo 对齐）：** 不在 Files 主列表提供 **Flash Note** 置顶条目。用户通过 **Agent Console**（闪念类推送、**Flash** 快捷按钮）或 **Capture / 悬浮胶囊** 进入 `flash` conversation；未读闪念、待认领等计数若需展示，优先挂在 **Console / 闪念入口**，而非 Files 重复占位。

### 4.1 Files 顶部固定入口（可选能力）

以下系统文件夹为产品后续可落地的「Files 内置顶/分组」叙述；**当前不要求**与 Flash 同列。若首期仅做 Meeting + 用户文件夹，可暂不实现本表全部入口。

| 入口 | 规则 |
|---|---|
| Generated Notes | 系统文件夹，内部是一条条 note `.md` 文件。 |
| Ideas | 系统文件夹，内部有一个 `idea.MD` 聚合文档。 |

### 4.2 File-input Sessions

现阶段主要是 Meeting audio：

| 状态 | 标题规则 | 示例 |
|---|---|---|
| 已上传未解析 | `system_generated_title` | 新会议 2026-05-06 14:25 |
| 已解析 | `ai_title` | 产品设计同步会 |
| 用户改名 | `user_title` 优先 | Kevin 产品方案评审 |

标题优先级：

```text
display_title = user_title || ai_title || system_generated_title
```

排序规则：

1. Meeting audio session 按创建 / 上传时间倒序排列。
2. 若实现 §4.1 系统文件夹置顶：系统文件夹与 Meeting 的相对顺序由 UIUX 决定（或放入文件夹筛选区，不占主列表首条）。

### 4.3 Attachments

Attachments 暂不在首页 Files 主列表展示。

规则：

1. attachment 归属于所属 File 或 Session 详情页。
2. 如果未来需要全局浏览，可在 Files 中增加 `Attachments` 分组。
3. 首期不把 attachments 与 Meeting audio 混在同一主列表。

---

## 5. 文件夹与 Markdown 承接方式

文件夹用于组织可浏览内容。它可以承接原始 File，也可以承接生成的 Asset。

### 5.1 文件夹类型

| 类型 | 是否可删除 | 说明 |
|---|---|---|
| 系统文件夹 | 否 | 由系统或 Skill 自动创建，例如 Generated Notes、Ideas、Expenses。 |
| 用户文件夹 | 是 | 用户手动创建，用于整理文件或生成内容。 |
| All | 否 | 固定视图，不是文件夹。 |

### 5.2 系统文件夹示例

| 文件夹 | 内容来源 | 文件夹内展示 |
|---|---|---|
| Generated Notes | `asset_type = note` | 多个 note `.md` 文件，每条 Note 一个文件 |
| Ideas | `asset_type = idea` | 一个 `idea.MD` 聚合文档，内部是一则一则 idea 记录 |
| Expenses | `asset_type = expense` | `expense.md` |
| Vocabulary | `asset_type = vocabulary` | `vocabulary.md` |

新 Skill 启用后，可以默认创建一个系统文件夹，并按该 Skill 的内容形态决定是使用聚合 Markdown，还是一条 Asset 对应一个 Markdown 文件。

### 5.3 Markdown 文件规则

系统生成的 Markdown 不是用户上传的普通 File，而是 Asset 的阅读入口。

规则：

1. `Ideas` 适合使用一个 `idea.MD` 聚合文档，用户打开后能一目了然看到全部 idea。
2. `Generated Notes` 适合展示为多个 note `.md` 文件，因为每条 note 本身就是独立文档。
3. `Expenses` 这类流水型 Skill 可以使用一个 `expense.md` 聚合文档，按时间一则一则展示。
4. 底层真实数据仍然是一条条 Asset。
5. 每个条目都应保留 source link，跳回来源 Session / Turn / Asset。
6. 用户编辑单条内容时，实际编辑对应 Asset，而不是直接改整篇聚合文档。
7. 普通用户上传的 `.md` 文件仍属于 File，不与系统生成 Markdown 混淆。

示例：

```md
# Ideas

## B2B 市场扩展想法
可以考虑从企业销售团队切入，先做客户偏好标签系统。

来源：[闪念 2026-05-07 09:30](session://session_flash?turn=turn_003)

---

## 销售周报自动化
每周自动总结客户跟进情况，生成销售行动建议。

来源：[产品同步会](session://session_meeting_001?turn=turn_001)
```

---

## 6. 文件夹筛选与类型筛选

沿用既有 Notes Folder Spec 的思路，但对象从 Note 扩展为 File + Asset。

| 维度 | 说明 |
|---|---|
| 当前视图 | All / 某系统文件夹 / 某用户文件夹 |
| 类型筛选 | Meeting / Memo / Attachments / Notes / Ideas / Misc / Future Skill |
| 排序 | 修改时间 / 创建时间 |

规则：

1. 文件夹是归属维度。
2. 类型筛选是内容类型维度。
3. 两者可以叠加：例如在 Ideas 文件夹中按创建时间排序。
4. All 是固定视图，不可编辑或删除。

---

## 7. 与 Asset / File / Session 的关系

| 对象 | 在首页中的表现 |
|---|---|
| File | 可出现在 Files 中，例如 Meeting audio。 |
| Session | 由 file input 产生的 Session 可作为 Files item 进入；普通 conversation 不进入 Files。 |
| Asset | 可通过系统文件夹中的系统生成 Markdown 展示；可以是一条 Asset 一个 `.md`，也可以是聚合 Markdown。`asset_type = misc` 的杂项捕获经 **Workspace → Misc** 列表管理，不进 Files 系统文件夹（与 [ASSET_AND_SESSION_ARCHITECTURE.md](./ASSET_AND_SESSION_ARCHITECTURE.md) v0.9 一致）。 |
| Agent Event | 出现在 Agent Console（§3.1 四类定义；**本期**以 §3.0 **文件 / 闪念里程碑**为主）；**不包括**普通 Ask Agent 会话条目。 |
| Attachment | 默认只在所属 File / Session 详情中展示。 |

---

## 8. 验收标准

- [ ] 首页纵向顺序为：**顶栏 → Agent Console → Workspace（横向）→ Files**；Workspace 置于 Files 之上。
- [ ] 顶栏包含：**个人中心**、**设备连接**（含连接状态提示）、**日历**入口。
- [ ] Agent Console 提供 `Start a new chat`（入口即可，不要求出现在推送列表中）。
- [ ] Agent Console **本期**落地 **① 到期 Todo**、**② 文件状态（上传 / 解析完成等里程碑）**、**④ 闪念处理（已收到 / 解析完成及产出计数）**；**不**将普通 Ask Agent 会话作为 Console 列表项。
- [ ] **③ 通用 Agent 主动推送** 保留长期定义，**本期可不实现**（无周期摘要、无跨 Skill 订阅编排亦可验收本期）。
- [ ] 普通 conversation Session 不进入 Files 主列表。
- [ ] Flash / 闪念通过 Agent Console（推送或 Flash 按钮）或 Capture / 悬浮入口进入；**Files 主列表不提供 Flash Note 置顶条目**。
- [ ] Meeting audio session 按时间排列在 Files 中。
- [ ] Meeting 未解析时使用系统标题，解析后可使用 AI 标题，用户标题优先。
- [ ] Attachments 首期不进入首页 Files 主列表。
- [ ] Generated Notes / Ideas 可作为系统文件夹出现。
- [ ] `Ideas` 文件夹包含 `idea.MD` 聚合文档，打开后展示一则一则 idea 记录。
- [ ] `Generated Notes` 文件夹包含多个 note `.md` 文件。
- [ ] 系统生成 Markdown 不是普通用户上传 File。
- [ ] 系统生成 Markdown 中每个条目可跳回来源 Session / Turn。
- [ ] Workspace 横向入口包含 **Misc**，可进入 `misc` 类型 Asset 二级列表（与架构文档 v0.9 中 `misc` / 硬件闪念兜底一致）。

---

## 9. 修订记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-05-07 | 初版，合并 Notes Folder 思路与 Agentic Flow 首页逻辑。 |
| v0.3 | 2026-05-09 | 首页纵向顺序：顶栏 → Console → Workspace（横向）→ Files；顶栏含个人中心 / 设备 / 日历。 |
| v0.2 | 2026-05-09 | 收紧 Agent Console：四类推送（到期 Todo、文件状态、Agent 主动、闪念）；明确普通 Ask 不出现在 Console 列表。 |
| v0.4 | 2026-05-10 | Workspace 与类型筛选补充 **Misc**；与 ASSET_AND_SESSION_ARCHITECTURE v0.9 对齐。 |
| v0.5 | 2026-05-10 | Files 区取消 Flash Note 入口约定；闪念改由 Console / Capture 承接；排序规则与 §4.1 同步调整。 |
| v0.6 | 2026-05-10 | §3.0 本期范围：文件 / 闪念里程碑通知与流转；**③** 通用主动推送标为**本期不展开**；§3.1～§3.2 与验收对齐。 |

