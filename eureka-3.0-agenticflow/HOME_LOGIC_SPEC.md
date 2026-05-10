# PRD：首页逻辑与 Files / Agent Console 信息架构

| 属性 | 内容 |
|---|---|
| 状态 | 草案 |
| 版本 | v0.3 |
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

---

## 2. 首页结构

首页主滚动区 **自上而下** 建议顺序：

1. **顶栏**：个人中心、品牌区、设备连接、日历（全局导航，不占主列表篇幅）。
2. **Agent Console**：四类推送 + Flash / New Chat 入口。
3. **Workspace**：按资产类型 **横向滑动** 入口（Notes / Reminders / Ideas / Contacts 等），置于 Files **之上**，避免被长文件列表挤出首屏。
4. **Files**：文件夹与文件列表。

下面按「区域」归纳职责（与垂直顺序一致）：

| 区域 | 作用 | 展示对象 |
|---|---|---|
| 顶栏 | 账户与设备、时间与日程入口 | 个人中心、设备连接状态、Calendar |
| Agent Console | **四类推送**：到期 Todo、文件状态、Agent 主动推送、闪念处理；并提供 Flash / New Chat **入口**（后者不产生列表项） | agent events（限定范围） |
| Workspace | 结构化资产分类入口，**横向布局** 便于扫一眼进入各类列表 | Notes / Reminders / Ideas / Contacts 等 |
| Files | 展示硬件采集、file input 产生的 Session，以及系统文件夹 | meeting audio session、Markdown 文件、系统文件夹 |

普通 `conversation` Session 不默认展示在首页 Files 中。用户通过 Agent Console 的 `Start a new chat` 进入 Ask Agent；历史 conversation 可在 Ask Agent 内部 history 中管理。

---

## 3. Agent Console

Agent Console 是首页的 **轻量信号区**，只推送 **与事务进展、文件管线、闪念、Agent 主动摘要** 相关的条目；**不用于展示普通 Ask Agent 会话列表**（Ask 仅在入口进入，历史在 Ask Agent 内管理）。

回答的核心问题：

> 哪些事到期了？文件到哪一步了？闪念与 Agent 主动推送有什么新动态？

### 3.1 Console 推送范围（四类）

| 类别 | 内容 | 典型示例 | 点击后 |
|---|---|---|---|
| **① 到期 Todo** | 即将到期或今日到期的 Reminder / Todo | 「整理 demo · 今天 18:00」 | 进入 Calendar / Reminders 或对应 Todo 详情（与既有 Todo 主入口策略一致） |
| **② 文件状态** | 与 File 生命周期相关的状态节点 | 「已上传，待解析」「已解析，可查看摘要 / Transcript」 | 进入该 File 详情（状态与 Files 列表一致，Console 只是更快到达） |
| **③ Agent 主动推送** | 系统或 Agent 发起的非对话型通知 | 周期小结、解析完成汇总、「你有 N 条待认领 Todo」等 | 进入对应 Workspace 分类、汇总页或详情 |
| **④ 闪念处理** | 硬件 / Capture 进入的闪念流式处理结果 | 「闪念已处理：已写入 Todo / Idea / 联系人偏好」 | 进入闪念对话或对应产出（与 `flash` conversation 一致） |

以上四类以外的 **普通 Ask Agent 对话**（无上下文锚点的闲聊、追问）**不出现在 Console 列表**；用户通过 **Start New Chat / 悬浮 Ask** 进入，记录在 Ask Agent 历史内。

### 3.2 与旧版「Console item 类型」的关系

下列情形仍可归入上表某一类，而不单独作为一类「Console 专属类型」：

| 情形 | 归入 |
|---|---|
| 待确认联系人、待认领 Todo（由 Agent 推送） | ③ 主动推送，或 ① 到期/待办 |
| 解析失败、可重试 | ② 文件状态（异常态）或 ③ 主动推送 |
| 长任务完成通知 | ② 文件状态（已解析）或 ③ 主动推送 |

### 3.3 Start New Chat

Agent Console **区域上仍保留** `Start a new chat`（或与 Flash 并列的快捷按钮），仅作为 **入口**，不产生 Console 列表项。

规则：

1. 点击后创建新的 `conversation` Session（通用 Ask）。
2. 新 conversation **不进入 Console 推送列表**，也不进入 Files 列表。
3. conversation history 仅在 Ask Agent 内管理。

---

## 4. Files 区域

Files 不是纯文件系统，也不是完整 Session 列表。它展示：

1. `flash_note` 的用户级单例入口；
2. 由 file input 创建的 Session，例如 Meeting audio session；
3. 系统文件夹，例如 Generated Notes、Ideas、Expenses；
4. 未来扩展的普通文件类型，例如 PDF、Image、Video。

### 4.1 Files 顶部固定入口

| 入口 | 规则 |
|---|---|
| Flash Note | 用户级单例 Session，置顶展示。 |
| Generated Notes | 系统文件夹，内部是一条条 note `.md` 文件。 |
| Ideas | 系统文件夹，内部有一个 `idea.MD` 聚合文档。 |

Flash Note 入口可带红点或数量：

| 指标 | 说明 |
|---|---|
| unread_turn_count | 用户尚未查看的新闪念 turn 数量 |
| pending_count | 待确认 Contact、待认领 Todo、失败 item 等数量 |
| today_count | 今日新增闪念数量 |

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

1. Flash Note 入口固定置顶。
2. 系统文件夹可置于 Flash Note 后，或由 UIUX 决定放入文件夹筛选区。
3. Meeting audio session 按创建 / 上传时间倒序排列。

### 4.3 Attachments

Attachments 暂不在首页 Files 主列表展示。

规则：

1. attachment 归属于所属 File 或 Session 详情页。
2. 如果未来需要全局浏览，可在 Files 中增加 `Attachments` 分组。
3. 首期不把 attachments 与 Meeting audio、Flash Note audio 混在同一主列表。

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
| 类型筛选 | Meeting / Memo / Attachments / Notes / Ideas / Future Skill |
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
| Asset | 可通过系统文件夹中的系统生成 Markdown 展示；可以是一条 Asset 一个 `.md`，也可以是聚合 Markdown。 |
| Agent Event | 出现在 Agent Console（仅限 §3.1 四类推送）；**不包括**普通 Ask Agent 会话条目。 |
| Attachment | 默认只在所属 File / Session 详情中展示。 |

---

## 8. 验收标准

- [ ] 首页纵向顺序为：**顶栏 → Agent Console → Workspace（横向）→ Files**；Workspace 置于 Files 之上。
- [ ] 顶栏包含：**个人中心**、**设备连接**（含连接状态提示）、**日历**入口。
- [ ] Agent Console 提供 `Start a new chat`（入口即可，不要求出现在推送列表中）。
- [ ] Agent Console 推送覆盖四类：**到期 Todo**、**文件状态（已上传 / 已解析等）**、**Agent 主动推送**、**闪念处理**；**不**将普通 Ask Agent 会话作为 Console 列表项。
- [ ] 普通 conversation Session 不进入 Files 主列表。
- [ ] Flash Note 通过 Agent Console 或底部 `capture` 进入，不作为 Files item。
- [ ] Meeting audio session 按时间排列在 Files 中。
- [ ] Meeting 未解析时使用系统标题，解析后可使用 AI 标题，用户标题优先。
- [ ] Attachments 首期不进入首页 Files 主列表。
- [ ] Generated Notes / Ideas 可作为系统文件夹出现。
- [ ] `Ideas` 文件夹包含 `idea.MD` 聚合文档，打开后展示一则一则 idea 记录。
- [ ] `Generated Notes` 文件夹包含多个 note `.md` 文件。
- [ ] 系统生成 Markdown 不是普通用户上传 File。
- [ ] 系统生成 Markdown 中每个条目可跳回来源 Session / Turn。

---

## 9. 修订记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-05-07 | 初版，合并 Notes Folder 思路与 Agentic Flow 首页逻辑。 |
| v0.3 | 2026-05-09 | 首页纵向顺序：顶栏 → Console → Workspace（横向）→ Files；顶栏含个人中心 / 设备 / 日历。 |
| v0.2 | 2026-05-09 | 收紧 Agent Console：四类推送（到期 Todo、文件状态、Agent 主动、闪念）；明确普通 Ask 不出现在 Console 列表。 |

