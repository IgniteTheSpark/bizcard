# PRD：Eureka 3.0 Agentic Flow 可交互 Demo

| 属性 | 内容 |
|---|---|
| 状态 | 草案 |
| 版本 | v2.4 |
| 目标 | 用一个单手机窗口的可交互 Demo，演示 File 解析管线、Ask Agent 对话、Asset / Contact 管理的完整链路。 |
| 关联文档 | [ASSET_AND_SESSION_ARCHITECTURE.md](./ASSET_AND_SESSION_ARCHITECTURE.md)、[HOME_LOGIC_SPEC.md](./HOME_LOGIC_SPEC.md) |

---

## 1. 目标与非目标

### 1.1 目标

| 目标 | 说明 |
|---|---|
| 串起主链路 | File 上传 → AI 解析 → 生成 Note / Todo / Idea；Ask Agent 对话 → 用户选择类型后写入 Asset（含 **misc**）。 |
| 展示两条独立管线 | 文件解析管线不产生 Session；Ask Agent 对话才有 Session。两条管线互不依赖。 |
| 展示文件类型统一模板 | 音频 / 图片 / Markdown 三种文件，进入详情时共用 Hero + AI Analysis CTA + Tab 结构。 |
| 展示 Flash 闪念 | Flash 是单个持续对话（context_tag: flash），所有闪念输入在同一个对话流中累积。 |
| 展示 Ask Agent 对话 | 气泡对话形式；支持文字 / 语音输入；支持 Context 绑定；支持 **设为 Note / Idea / Misc**（或「设为 Asset」选类型）。 |
| 展示 Asset 管理 | Note / Todo / Idea / **Misc** 有列表与详情；Note 支持子 Tab 切换；可从详情页发起 Ask Agent。 |
| 展示对话历史 | 历史记录底部弹层；点击条目可恢复完整对话。 |

### 1.2 非目标

| 非目标 | 说明 |
|---|---|
| 不接真实后端 | 全部使用本地 mock 数据，不依赖接口 / 账号 / 硬件。 |
| 不做完整 CRUD | Asset / Contact 编辑只做展开态，不实现真实表单。 |
| 不覆盖所有异常 | 只覆盖文件解析、闪念处理、Ask Agent 核心分支。 |
| 不支持 PDF | 文件类型仅限：音频 / 图片 / Markdown。 |

---

## 2. 核心架构原则

### 2.1 两条独立管线

```
管线 A：文件解析
  File 上传 → 待解析状态 → 用户点击 AI Analysis CTA
  → 解析（ASR / OCR / 摘要）→ 生成 Note / Todo
  → 结果以 Tab 形式挂载在 File 详情页
  → 不产生 Session

管线 B：Ask Agent 对话
  用户发起对话（Flash / General / Context-anchored）
  → 创建 conversation Session
  → 对话气泡流（用户右 / Agent 左）
  → Agent 回复可生成卡片（Asset / Contact）
  → 分析类回复可「保存为 Note」
  → Session 写入对话历史
```

### 2.2 Session 定义

Demo 中只有一种 Session：**conversation**。Flash 闪念是 `context_tag: flash` 的特殊 conversation，每用户一个持续对话流。

| Session 标签 | 入口 | 特征 |
|---|---|---|
| `flash` | 首页 Flash 按钮 / 悬浮胶囊 Capture | 单个持续对话；预置 3 轮历史；新语音 / 文字追加到同一流 |
| `general` | New Chat / 悬浮 ✦ | 无 Context；每次新建 |
| `anchored` | 从 File / Asset / Contact 详情发起 | 顶部 Context Banner 常驻；回复带来源锚点 |

### 2.3 Asset 类型

| 类型 | 图标 | 典型来源 |
|---|---|---|
| note | 📝 | 文件解析（`file_analysis`）/ 对话生成（`session`）/ 手动 |
| todo | ✅ | 文件解析 / 对话生成 |
| idea | 💡 | 对话生成 |
| contact | 👤 | 独立实体（非 Asset），在 Contacts 列表管理 |

---

## 3. 页面结构

Demo 为单手机窗口，所有页面在同一壳层内以页面栈形式切换。

### 3.1 页面列表

| 页面 ID | 名称 | 入口 |
|---|---|---|
| `p-home` | 首页 | 初始页 |
| `p-file` | 音频文件详情 | Files 列表点击音频文件 |
| `p-img` | 图片文件详情 | Files 列表点击图片文件 |
| `p-md` | Markdown 文件详情 | Files 列表点击 MD 文件 |
| `p-ws-list` | Workspace 资产列表 | Workspace 横向条各类目 / 顶部「管理」 |
| `p-asset` | Asset 详情 | Workspace 列表 / Note Tab 卡片点击 |
| `p-contact` | Contact 详情 | Contacts 列表 / Agent 回复卡片 |
| `p-session` | Ask Agent / Flash 对话 | Flash 入口 / New Chat / 悬浮 ✦ |

### 3.2 全局浮动元素

| 元素 | 说明 |
|---|---|
| 悬浮胶囊 | 三个按钮：Capture（🎙）/ Ask（✦）/ Plus（＋，条件显示） |
| 底部弹层（Sheet） | 加号操作、说话人关联、关联文件、对话历史 |

**悬浮胶囊可见规则：**
- 在 `p-session`（对话页）时**隐藏**。
- 文件详情页（音频 / 图片 / MD）在文件**未解析时**，**不显示**胶囊。
- Plus（＋）按钮只在 `p-home`、`p-file`（已解析）、`p-ws-list` 等页面显示。

---

## 4. 首页（p-home）

### 4.1 顶部 Header

从左到右：

| 区域 | 内容 |
|---|---|
| 左 | 个人中心入口（圆形头像按钮）|
| 中 | 品牌字标「Eureka 3.0」|
| 右 | 设备连接（耳机图标 + 绿点表示已连接）/ 日历入口 |

### 4.2 Agent Console

首页固定区域，**不展示普通 Ask 对话记录**。产品长期仍保留 **四类** 定义（见 [HOME_LOGIC_SPEC.md](./HOME_LOGIC_SPEC.md) §3.1）；**本可交互 Demo** 与 **v0.6 §3.0** 对齐，**仅渲染三类列表行**：**① 到期**、**② 文件**（上传 + 解析完成两条里程碑）、**④ 闪念**（已收到 → 解析完成及产出摘要）。**③ 通用 Agent 主动推送** 不在本 Demo 的 Console 列表中出现。

| 标签 | 颜色 | 典型内容 | 点击后 |
|---|---|---|---|
| 到期 | 琥珀色 | 今日到期的 Todo | Reminders 列表 |
| 文件 | 蓝色 | 已上传 / 已解析（各一条里程碑） | 对应 File 详情 |
| 闪念 | 紫色 | 已收到闪念 / 闪念已解析及产出摘要 | Flash 对话 |

Console 右上角常驻两个入口按钮：**🎙 Flash**（进入闪念对话）、**New Chat**（创建通用 Ask 对话）。

### 4.3 Workspace 横向条

位于 Console **下方**、Files **上方**，横向可滑动，**至少五个**类目（可继续扩展）：

| 类目 | 图标 | 点击后 |
|---|---|---|
| Notes | 📝 | Notes 列表 |
| Reminders | ✅ | Reminders 列表 |
| Ideas | 💡 | Ideas 列表 |
| Contacts | 👤 | Contacts 列表 |
| Misc | 📎 或 🗂 | `misc` 类型 Asset 列表（杂项 / 闪念兜底等） |

### 4.4 Files 区域

文件列表，顶部标题可点击切换文件夹视图。

**系统视图（文件夹筛选）：**

| 视图 | 说明 |
|---|---|
| 全部文件 | 所有文件（默认） |
| 录音 | type = audio |
| 图片 | type = image |
| Markdown | type = md |
| 未分组 | 无所属文件夹的文件 |

**用户文件夹：** 工作、个人（可自定义创建）。

**文件卡片展示内容：** 类型图标、文件名、日期 / 时长 / 大小、关联文件数量、类型标签、**解析状态标签（当前以 Meeting 音频为主**，在卡片上区分已上传 / 待解析 / 已解析等；**图片、Markdown 等**与统一文件模板对齐后，再扩展同等粒度的解析态展示）、所属文件夹标签。

**与首页 Files 信息架构：** Files 列表**不包含** Flash Note 置顶入口；闪念从 Agent Console / Capture 进入，见 [HOME_LOGIC_SPEC.md](./HOME_LOGIC_SPEC.md) §4。

**Mock 文件数据：**

| 文件 | 类型 | 关联文件 |
|---|---|---|
| Product Design Sync | 音频（23:14） | 会议现场照片 1.jpg、白板拍照.jpg、V2.0 API 接口设计文档.md |
| 会议现场照片 1.jpg | 图片 | Product Design Sync |
| 白板拍照.jpg | 图片 | Product Design Sync |
| V2.0 API 接口设计文档.md | Markdown | Product Design Sync |
| 产品截图.png | 图片 | 无 |

---

## 5. 文件详情页

三种文件类型（音频 / 图片 / Markdown）共用**统一模板**，结构如下：

```
Nav 栏（返回 / 文件名 / FILE 徽章）
└─ File Hero 卡片
    ├─ 文件信息（名称 / 元数据 / 解析状态）
    ├─ 原始内容预览区（各类型不同）
    └─ AI Analysis CTA（待解析时显示）
└─ Tab 栏（解析完成后显示）
└─ Tab 内容区（可滚动）
```

### 5.1 音频文件详情（p-file）

**Hero 区：**
- 文件名、时长、解析状态（待解析 / 已解析）、格式
- 音频播放器（播放按钮 + 波形条 + 时长）
- AI Analysis CTA：「ASR 转写 + 说话人识别 + 生成摘要」→ 点击「分析」触发

**解析后 Tabs：**

| Tab | 内容 |
|---|---|
| Notes | 子 Tab 切换多条 Note（Asset），每条可「查看」进详情页 |
| Transcript | 分 Speaker 显示转录内容；每个 Speaker 可点击关联联系人 |
| Reminders | Todo 列表 |
| Contacts | 已关联联系人列表（从 Transcript 说话人匹配） |
| 关联文件 | 与该文件双向关联的其他文件，可叉号取消关联 |

**CTA 触发后逻辑（模拟）：**
1. 按钮变为「分析中…」loading 状态
2. 约 2 秒后：状态变「✓ 已解析」，CTA 隐藏，Tab 栏出现
3. Notes Tab 默认激活，展示 AI 生成的摘要 Note

### 5.2 图片文件详情（p-img）

**Hero 区：**
- 文件名、文件大小、解析状态
- 图片预览占位区（模拟）
- AI Analysis CTA：「OCR 文字识别 + 图像内容理解」

**解析后 Tabs：**

| Tab | 内容 |
|---|---|
| Notes | 子 Tab 切换（OCR 笔记等），每条 Note 是 Asset，可进详情 |
| 关联文件 | 双向关联文件列表 |

### 5.3 Markdown 文件详情（p-md）

**Hero 区：**
- 文件名、文件大小、解析状态
- Markdown 原文预览（底部渐隐遮罩）
- AI Analysis CTA：「生成摘要 Note · 提取 Action Items」

**解析后 Tabs：**

| Tab | 内容 |
|---|---|
| Notes | 子 Tab 切换多条 Note（摘要 / 关键点等） |
| Reminders | 提取的 Todo 列表 |
| 关联文件 | 双向关联文件列表 |

### 5.4 Notes Tab：子 Tab 机制

解析生成的每条 Note 都是 **Asset**（`type: note`，`noteType: file_analysis`）：

- Notes Tab 顶部横向子 Tab，每个 Tab 对应一条 Note
- 切换子 Tab，下方卡片更新
- Note 卡片包含：标题、正文（Markdown 渲染）、来源标注、「查看」按钮（进 Asset 详情）
- 音频：1 条摘要 Note；图片：1 条 OCR 笔记；Markdown：2 条（摘要 + 关键点）

---

## 6. Workspace 资产列表（p-ws-list）

列出某类 Asset（或 Contacts），每条显示图标、标题、来源。**Misc** 类目下列出 `asset_type: misc` 的条目（与架构文档 v0.9 一致）。

点击 Asset → 进入 **Asset 详情（p-asset）**。
点击 Contact → 进入 **Contact 详情（p-contact）**。

---

## 7. Asset 详情（p-asset）

```
Nav 栏（返回 / 标题）
└─ Hero 区
    ├─ 类型图标 + 类型标签（NOTE / TODO / IDEA / MISC）
    ├─ 标题
    └─ 来源标注（可回跳 File 详情或 Session）
└─ Body 区（按类型渲染）
```

**按类型渲染规则：**

| 类型 | Body 内容 |
|---|---|
| note | Markdown 渲染正文 |
| todo | 标题、截止时间、状态 |
| idea | 正文内容 |
| misc | 正文或转写片段（可读即可），支持删除 |

从 Asset 详情发起 Ask Agent：点击悬浮胶囊 ✦ → 进入 `anchored` 对话，Context Banner 显示该 Asset 信息。

---

## 8. Contact 详情（p-contact）

```
Nav 栏（返回 / 姓名）
└─ Hero 区（头像首字母、姓名、公司 + 职位）
└─ Body 区（电话、备注列表）
```

Mock 数据：Kevin Chen（Acme Corp）、Sarah Liu（Eureka HQ）。

---

## 9. Ask Agent / Flash 对话（p-session）

### 9.1 页面结构

```
Nav 栏（返回 / 标题 + 副标题 / ☰ 历史记录）
└─ Context Banner（anchored 时显示，点击回跳来源）
└─ 对话区（可滚动）
    ├─ 用户气泡（右对齐）：文字 / 语音（音频条 + 转录文字）
    └─ Agent 气泡（左对齐）：AGENT 标签 + 回复文本 + 卡片 + **沉淀操作**（见 §9.2）
└─ 输入栏（🎙 语音 / 文字输入框 / ↑ 发送）
```

### 9.2 气泡规则

**用户气泡（右侧）：**
- 文字输入 → 文字气泡
- 语音输入 → 语音气泡（播放按钮 + 波形 + 时长 + 「转录文字」标题 + 转录内容）；超过 60 字符可展开 / 收起

**Agent 气泡（左侧）：**
- 顶部显示「AGENT」标签
- 回复文本（支持 HTML，如 `<br>`、`<code>`、`<strong>`）
- 卡片区（若有 Asset / Contact 卡片）
- **沉淀操作（Ask / anchored，非 Flash 自动卡片）**：当 `_save: true`（分析类 / 观点类回复、无卡片）时，提供 **「设为 Note」「设为 Idea」「设为 Misc」** 之一组按钮，或单一 **「设为 Asset」** 再选类型（与 ASSET_AND_SESSION_ARCHITECTURE v0.9 §9.4 一致）；纯卡片回复或系统 intro 不显示

### 9.3 回复卡片类型

| 卡片类型 | 典型内容 | 动作 |
|---|---|---|
| todo | 标题 + 截止时间 | 「认领」按钮（点击变「✓ 已认领」） |
| note | 标题 + 元信息 | 「查看」按钮（进 Asset 详情） |
| idea | 标题 + 元信息 | 「查看」按钮 |
| misc | 标题 + 元信息 | 「查看」按钮（进 Asset 详情） |
| contact | 姓名 + 偏好摘要 | 「查看」按钮（进 Contact 详情） |

### 9.4 Flash 闪念规则

- 单个持续对话流（`sessionTag: 'flash'`），预置 3 轮历史：
  1. 语音「今晚 5 点开会，提醒我」→ 创建 Todo 卡片
  2. 语音「Kevin 喜欢喝拿铁，帮我记一下」→ 创建 Contact 偏好卡片
  3. 语音「B2B 客户打标签这个功能值得做，记个 Idea」→ 创建 Idea 卡片
- **产品语义（与架构 v0.9 对齐）**：每轮硬件语音由 Skill 判定产出类型（含 **`misc` 兜底**）；**不**跨轮默认合并多条输入为一条 Asset。
- 发送新消息（文字或语音）→ 追加到同一对话流末尾
- Flash 对话历史持久化（`D.flashTurns`），再次进入 Flash 时还原

### 9.5 Context Banner（anchored 对话）

从 File / Asset / Contact 详情发起 Ask 时显示：

- 显示来源图标、名称、类型
- 点击 Banner → 回跳来源详情页

### 9.6 getReply 回复逻辑（Mock）

| 关键词 / 场景 | Agent 回复形式 | 是否可保存 |
|---|---|---|
| 「核心结论 / 结论」（file ctx） | 长文分析（4点结论）| 是 |
| 「action items / todo / 遗漏」（file ctx） | Todo 卡片列表 | 否 |
| 「邮件 / 跟进」（file ctx） | 草稿长文 | 是 |
| 「摘要 / summary / 新版」（file ctx） | Note 卡片（生成并挂载到 File） | 否 |
| `flash_meeting`（预置） | Todo 卡片 | 否 |
| `flash_kevin`（预置） | Contact 卡片 | 否 |
| `flash_idea`（预置） | Idea 卡片 | 否 |
| 「名片 / 自动生成联系人」 | 产品想法分析长文 | 是 |
| 「离线 / 硬件 + ASR」 | 方向分析长文 | 是 |
| 其他 | 「收到，已记录」| 否 |

---

## 10. 对话历史

### 10.1 访问方式

Session 页右上角 ☰ 按钮 → 打开「对话历史」底部弹层。

### 10.2 历史列表

展示所有 Session（Flash + Ask），按时间倒序排列。每条显示：
- 标签（Flash / Ask）
- 标题（文件名 / Ask Agent 等）
- 摘要（首条用户输入前 20 字）
- 时间 + 对话轮数

### 10.3 历史写入规则

- 进入 `openAsk()` → 立即在 `SESSION_HISTORY` 头部插入一条 `_live: true` 记录
- 每次发送消息 → `syncLiveSession()` 实时同步 turns
- 返回（`goBack()`）时：
  - 若无实质对话（只有系统 intro）→ **删除该记录**
  - 若有实质对话 → 保存 turns，更新摘要，清除 `_live` 标记
- Flash 对话不写入历史（单例持久化）

### 10.4 预置历史（4 条）

| # | 标题 | 场景 | Ctx |
|---|---|---|---|
| sh1 | Flash 闪念 | 3 轮语音预置（todo + contact + idea） | 无 |
| sh2 | Product Design Sync | 结论 + action items + 生成摘要 | 音频文件 |
| sh3 | Ask Agent | 查今日待办 + 更新截止 | 无 |
| sh4 | Q1 Roadmap Review | 文档摘要 + Todos + 方向分析 | MD 文件 |

---

## 11. 底部弹层（Sheets）

| Sheet | 触发 | 内容 |
|---|---|---|
| Plus 操作 | 悬浮胶囊 ＋ | 按当前页面上下文显示添加选项（关联文件 / 上传 / 新建 Todo 等） |
| 说话人关联 | 音频 Transcript Tab 点击 Speaker | 联系人候选列表，选择后建立 Speaker ↔ Contact 关联 |
| 关联文件 | 文件详情关联文件 Tab 点击添加 | 已有文件列表，选择后建立双向关联 |
| 文件夹切换 | Files 区域标题按钮 | 系统视图 + 用户文件夹列表，可新建文件夹 |
| 对话历史 | Session 页 ☰ 按钮 | 历史 Session 列表，点击恢复对话 |

---

## 12. Mock 数据摘要

### Assets

| ID | 类型 | 标题 | 来源 |
|---|---|---|---|
| n001 | note | 产品设计会议摘要 | file_analysis / Product Design Sync |
| n002 | note | 架构精简摘要 | session / Product Design Sync 追问 |
| t001 | todo | 整理 demo spec 并发给技术团队 | file_analysis（待认领） |
| t002 | todo | 确认 Kevin 跟进接口文档 | file_analysis（待认领） |
| i001 | idea | B2B 偏好标签系统 | session / Flash 闪念 |

### Contacts

| ID | 姓名 | 公司 | 备注 |
|---|---|---|---|
| kevin | Kevin Chen | Acme Corp | 喜欢喝拿铁咖啡 |
| sarah | Sarah Liu | Eureka HQ | 无 |

---

## 13. 验收标准

**首页**
- [ ] 顶栏包含个人中心 / 品牌字标 / 设备连接（绿点）/ 日历三类入口
- [ ] Agent Console **本 Demo** 列表含：**到期**、**文件**（上传 + 解析完成两条）、**闪念**（已收到 + 解析完成）；**不含**普通 Ask 记录与 **③** 通用主动推送行（产品四类定义仍以 HOME_LOGIC_SPEC 为准）
- [ ] Console 内有 Flash 和 New Chat 两个快捷按钮
- [ ] Workspace 横向条位于 Console 与 Files 之间，含 **Notes / Reminders / Ideas / Contacts / Misc** 等入口，可点击进入列表
- [ ] Files 支持文件夹切换；文件卡片显示状态和关联文件数

**文件详情**
- [ ] 三种文件类型（音频 / 图片 / Markdown）进入时只显示 Hero 和「待解析」CTA
- [ ] 点击「分析」后模拟加载，完成后显示 Tab 栏并隐藏 CTA
- [ ] 解析状态变为「✓ 已解析」
- [ ] 音频解析后：Notes / Transcript / Reminders / Contacts / 关联文件 五个 Tab
- [ ] 图片解析后：Notes / 关联文件 两个 Tab
- [ ] Markdown 解析后：Notes / Reminders / 关联文件 三个 Tab
- [ ] Notes Tab 内有子 Tab，每条 Note 是独立 Asset，可进详情页
- [ ] 悬浮胶囊在**未解析**的文件详情页不显示

**Ask Agent**
- [ ] 用户气泡右对齐；Agent 气泡左对齐并标注「AGENT」
- [ ] 语音气泡展示音频条 + 转录文字；超 60 字可展开收起
- [ ] 分析类回复（`_save: true`）显示设为 Note / Idea / Misc（或「设为 Asset」选类型）；卡片回复不显示
- [ ] Context Banner 在 anchored 对话中常驻显示，点击可回跳来源
- [ ] 悬浮胶囊在对话页**不显示**

**Flash 闪念**
- [ ] 进入 Flash 时已有 3 轮预置对话（todo / contact / idea 各一条）
- [ ] 新发语音 / 文字追加到同一对话流末尾
- [ ] 再次进入 Flash 时历史保留

**对话历史**
- [ ] Session 页右上角 ☰ 按钮打开历史弹层
- [ ] 预置 4 条历史（sh1～sh4），点击可恢复完整对话
- [ ] 新建 Ask 对话有实质内容后，返回时自动写入历史
- [ ] 新建 Ask 对话无实质内容（只有 intro），返回时**不写入**历史

**Asset / Contact 详情**
- [ ] 来源标注可点击，回跳到对应 File 详情或 Session
- [ ] 从 Asset / Contact 详情发起 Ask 时显示 Context Banner

---

## 14. 修订记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-05-07 | 初版：三种 Session 类型 + anchor_input + Generated Results Block。 |
| v2.0 | 2026-05-09 | 完整重写，与当前 demo 实现对齐：两条独立管线、统一文件详情模板、气泡对话、Workspace 横向条、对话历史写入规则。 |
| v2.1 | 2026-05-10 | Workspace 增加 **Misc**；Ask 沉淀扩展为 Note / Idea / Misc；卡片表与验收与 ASSET_AND_SESSION_ARCHITECTURE v0.9 对齐；Flash 规则补充 Skill 分型与不合并。 |
| v2.2 | 2026-05-10 | §4.4：解析状态以**音频 Meeting 为主**、其余类型后续扩展；明确 Files **无** Flash Note 入口，与 HOME_LOGIC_SPEC v0.5 对齐。 |
| v2.3 | 2026-05-10 | §4.2 与 HOME_LOGIC_SPEC **v0.6** 对齐：本期里程碑侧重 **文件 / 闪念**；**③** 在 Demo 中可选占位。 |
| v2.4 | 2026-05-10 | §4.2：Demo Console **移除** ③ Agent 列表行，仅保留到期 / 文件 / 闪念。 |
