# PRD（迭代）：会议/文件详情页 — 音频优先渐进版

| 属性 | 内容 |
|------|------|
| 状态 | 迭代草案 |
| 版本 | v0.2 |
| 定位 | 以**音频会议文件**为主叙事，先落地一版可评审、可开发的会议/文件详情页 |
| 设计参考 | 会议详情高保真稿（顶部会议卡 + 多级 Tab / 子 Tab + 底部操作条） |

---

## 1. 背景与原则

- 产品能力与业务尚未全覆盖时，若按「终极形态」一次性评审，容易在**未就绪能力**上产生大量边缘讨论、难以收敛。
- 本阶段优先绑定**当下主业务（会议录音 / 音频文件）**，迭代交付、口径写死；本 PRD **仅描述现阶段 meeting detail** 的页面结构与改动。

**原则**：先符合当下业务与数据现状，再逐步扩展；顶部区域聚焦「这场会议是什么、能否播放、来源」，**参会人、图片、附件**等从 Header 拆出，进入独立 Tab / 子 Tab，避免 Header 过载。

---

## 2. 改动要点（现阶段 Meeting Detail）

1. **Header 减负**：参会人与图片不再在 Header 展示，分别下沉为 **Contacts** 与 **Attachment（Image）**。  
2. **Note 展示方式调整**：在 Note 详情中**不再重复显示 “Note” 标题**，进入后直接展示**子 Tab（以总结 title 命名）**与正文。  
3. **File 更名为 Attachment**：统一承载会议相关的图片/文档等；Attachment 内子 Tab **仅展示有内容的分类**（无内容则隐藏）。  
4. **Source 去重**：来源信息只展示一次，避免重复信息块（见 3.1）。  
5. **Events 移除（现阶段）**：页面不展示 Events 入口与占位。  

---

## 3. 信息架构（现阶段）

以下为结构说明，具体 Tab 命名以设计稿与文案为准。

1. **顶部区域（会议/文件卡）**  
   标题、时长、日期时间、音频播放器、来源。**不再承载参会人列表与图片轮播/缩略图区。**

   ### 3.1 Source（来源）展示口径

   - 仅展示一处来源信息（例如 Header 卡内的 `Source` 行）。  
   - 避免同一页面同时出现「来源文案 + 来源标签」的重复块；若需要标签，建议合并为同一行展示。

2. **一级 Tab（示例）**  
   - **Transcription**：转写正文（说话人、时间戳等）。  
   - **Note**：会议纪要/总结区，进入后直接展示**子 Tab**（子 Tab 名称使用总结的 title）与正文。  
   - **Reminder** / **Contacts**：与会议关联的提醒、联系人。  
   - **Attachment**：附件与素材；内含子 Tab（如 Image、MD 文档等），且**只展示有内容的子 Tab**。

3. **底部操作条**  
   语音/录音入口、Agent 入口、「+」等；若能力未就绪，以当期约定为准（占位、跳转或禁用态需写死）。

---

## 4. 范围边界（简要）

- **本迭代聚焦**：会议/音频详情页 IA 调整（Header 减负、Contacts / Attachment / Note 子 Tab、悬浮窗约束）。  
- **可顺延**（除非单独立项）：Event 全链路、Agent 主动能力、删除级联全量规则等；当期以「能交付的 Tab」为准，避免评审无限展开。

---

## 5. 验收建议

1. Header **不再**展示参会人与图片主内容区；二者分别在 **Contacts**、**Attachment（Image）** 等路径可访问。  
2. Note 页面**不再出现额外的 “Note” 标题**；进入后直接看到**子 Tab + 内容**，且子 Tab 名称使用总结的 title。  
3. **Attachment** Tab 存在，且具备子 Tab 分类（至少 Image / MD），同时**隐藏无内容的子 Tab**；上传与列表行为符合当期实现。  
4. **Transcription** 为独立一级 Tab 时，结构与设稿一致。  
5. 页面不展示 **Events**。  
6. 底部 Agent / 「+」等入口状态在迭代内**单一口径**可测。

---

## 6. 底部悬浮窗（录音 / Ask Agent / “+”）关键约束

### 6.1 Ask Agent：单会议单 Session（meeting-context session）

- 在会议详情页点击 **Ask Agent**：进入该会议对应的会话。
- 规则：**每个 meeting/file 只对应一个 session**。  
  - 若该 meeting 第一次打开 Ask Agent：创建新 session。  
  - 若之前已创建：直接进入历史 session（继续同一上下文）。
- 该 session 的核心 context 为当前 meeting/file（可理解为“绑定该会议的对话线程”）。

### 6.2 “+” 菜单：会议场景的固定动作集

在 meeting 场景点击 **“+”**，仅提供与会议上下文强相关的动作（避免出现无关入口导致评审分歧）：

- **添加关联 Contact**（选择已有或创建后关联）  
- **Upload 关联文件**（把图片/MD 等作为会议附件/Attachment）  
- **添加 Reminder**（基于当前会议创建/关联提醒）

（其它场景的 “+” 菜单按各自 context 另行定义，不在本迭代展开。）

### 6.3 删除：伪删除表现 + Ask Agent Session 冻结

现阶段删除行为口径（以 meeting/file 为中心）：

1. **删除 file（会议）后**：note、transcript、图片等内容与其关系被断开，且**没有独立入口再进入**（对用户而言表现为“不可再访问”，更接近伪删除/去入口）。  
2. 需要新增 **session 处理**：当 meeting/file 被删除后，基于该 context 的 Ask Agent session **冻结为只读**：  
   - 允许查看历史记录；  
   - 禁止继续发送新消息或继续生成。

---

## 7. Contacts：参会人识别与联系人匹配规则（现阶段）

本节用于统一「参会人（占位人名）→ Contacts（实体联系人）」的产出与展示口径。现阶段链路为“先生成占位人名，再异步匹配名片夹”，避免在解析阶段引入名片夹匹配的不确定性。

### 7.1 现阶段处理链路（顺序）

1. **硬件音频上传** → 生成 meeting/file  
2. **ASR 转录**（得到 transcript）  
3. **AI 解析**：从 transcript 中解析出 Reminder/待办，并在 Reminder 上直接写入“参与人占位人名”（不做名片夹匹配）  
4. **异步匹配程序**：对占位人名（例如“冯总”）尝试匹配到用户名片夹中的具体 Contact；命中则替换为已关联 Contact，未命中则保留 `?` 引导用户手动关联

### 7.2 AI 解析阶段：占位人名写入规则

- AI 解析产出的 Reminder 允许包含多个参与人，参与人字段在解析阶段先写入**字符串人名**（占位）。  
- 占位人名可以来自 transcript 原文（例如“冯总”），以及“我”（当前用户）等系统可确定对象。  
- 解析阶段**不尝试**将“冯总”等占位名与名片夹 Contacts 做匹配。

示例：

- transcript：`冯总邀请明晚 6 点吃饭`  
- 解析生成 reminder：标题 `明晚 6 点吃饭`；参与人 `冯总`、`我`

### 7.3 异步匹配程序：匹配目标与结果写回

对解析阶段产出的“占位人名”，再运行匹配程序尝试命中用户名片夹 Contacts。

匹配结果写回口径：

- **唯一命中**：若占位人名可唯一匹配到某个已存在 Contact：  
  - 不新建 Contact；  
  - 在相关展示处（例如 Reminder 的参与人、Contacts Tab）将该占位人名替换为该 Contact 实体，并标记为“已关联”。  

- **无法命中或非唯一**：若无命中/多命中/置信度不足：  
  - 不自动新建正式 Contact；  
  - 在相关展示处保留占位人名，并展示为待确认状态（例如 Contacts Tab 中展示一张“待确认联系人卡片”并带 **`?`** 标识）。  

### 7.4 `?` 待确认卡片的处理

- **`?` 出现条件**：异步匹配程序未能将占位人名唯一命中到用户已有 Contacts（无命中 / 多命中 / 置信度不足）。  
- **`?` 消失条件（满足任一）**：  
  - 用户手动选择并绑定到已有 Contact；  
  - 用户新建 Contact 并完成绑定；  
  - 后续信息补全后系统可唯一确认并自动绑定（需可审计，是否做自动绑定可顺延）。  

### 7.5 关系范围（避免自动扩散）

- 本迭代中，“参会人/Contacts”关系**只在当前 meeting/file 范围内生效**。  
- 不因识别到参会人而自动对其它内容（如附件、笔记）建立额外关联；避免关系自动扩散引发混淆。

### 7.6 与 “+ 添加关联 Contact” 的衔接

- 用户通过 `+` → **添加关联 Contact**：  
  - 可选择已有联系人直接关联到本会议；  
  - 或新建联系人后再关联。  
- 若存在 `?` 待确认卡片，用户的绑定/新建行为应优先用于**消解该 `?`**，使其变为明确的 Contact 实体关联。

---

## 8. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-04-20 | 首版 |
| v0.2 | 2026-04-20 | Meeting detail 现阶段规格：Note 子 Tab、Attachment、Source 去重、移除 Events；补充悬浮窗约束、删除/Session 冻结、联系人匹配口径 |

---

## 附录：设计稿引用（工作区资产）

根目录：`C:\Users\yichuang.du\.cursor\projects\e-BIZCARD2-0\assets\`

| 说明 | 文件名 |
|------|--------|
| 会议详情：Transcription / Note / Reminder / Contacts + 顶部卡 + 底部条 | `c__Users_yichuang.du_AppData_Roaming_Cursor_User_workspaceStorage_e5b28601c3c05d2b173a66fdcff3c42d_images_image-5c0ad5c9-b9ab-4455-a2c3-2f0bc820e89c.png` |
| 会议详情（含 Back / Share、Source 标签） | `c__Users_yichuang.du_AppData_Roaming_Cursor_User_workspaceStorage_e5b28601c3c05d2b173a66fdcff3c42d_images_image-74f67e46-612d-4839-8882-ca889eccf43d.png` |
| Note 子 Tab（title 命名）+ Meeting Minutes | `c__Users_yichuang.du_AppData_Roaming_Cursor_User_workspaceStorage_e5b28601c3c05d2b173a66fdcff3c42d_images_image-44a19860-d725-4469-a121-2d191cd1f563.png` |
| Attachment Tab：Image / MD文档 子 Tab + Images 网格 | `c__Users_yichuang.du_AppData_Roaming_Cursor_User_workspaceStorage_e5b28601c3c05d2b173a66fdcff3c42d_images_image-a7a7d844-fbf8-42dd-91b0-46bf2dabb156.png` |
