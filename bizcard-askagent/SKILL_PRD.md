# Ask Agent (MCP Tools & Architecture) 产品需求文档（MCP PRD）

**版本**：v0.1  
**状态**：草案  
**关联**：
- [APP_PRD.md](./APP_PRD.md)（前端展示与页面结构）
- [DISPLAY_AND_CONTRACT.md](./DISPLAY_AND_CONTRACT.md)（结构化响应契约）

---

## 一、概述

本 PRD 聚焦于 Ask Agent 的 **后端逻辑架构** 以及 **Agent MCP Tools 与 System Prompt 的编排与定义**。
Ask Agent 的前端表现由 `APP_PRD` 定义，而支撑前端流畅交互的“大脑”，则是由 **Nanobot** 调度大模型，并通过 **MCP (Model Context Protocol) Server** 调用 BizCard 后台的原子能力来实现的。

### 1.1 架构角色定义
整个 Ask Agent 系统分为四个核心节点：
1. **User / App (前端)**：负责采集用户的自然语言输入，并根据后端返回的结构化 `Text + Cards` 契约进行 UI 渲染。
2. **Nanobot (Agent 大脑)**：核心调度器。负责理解用户意图，加载对应的 System Prompt 约束与策略，并自主决定调用哪些 MCP 工具。
3. **MCP Server (协议层/连接器)**：Model Context Protocol 的服务端。它将 BizCard 后台复杂的 CRUD 接口，封装成标准化的 Tools 暴露给 Nanobot。
4. **BizCard Backend (后台数据层)**：真实的业务数据中心，负责落库 Contacts, Meetings, Reminders 等实体。

---

## 二、整体逻辑架构图 (ASCII)

下图展示了从用户发起问询，到 Nanobot 思考、调用 MCP 工具、获取数据并最终返回结构化卡片的完整数据流转：

```text
                                        [ 系统架构全景图 ]

+-------------------------+             +-------------------------------------------------+
|     BizCard App         |             |              BizCard Backend (BFF)              |
|                         |             |  +-------------------------------------------+  |
|  [ 用户输入自然语言 ]      |   Query     |  | Ask Agent API Gateway (请求转发)             |  |
|  "Kevin 的电话是多少？"   | ----------->|  +-------------------------------------------+  |
|                         |             |                      |                          |
|                         |             |   JSON {text, cards} |                          |
|  [ 解析 Payload 渲染 ]    | <-----------|----------------------+                          |
|  1. 纯文本回答            | Reply Block |                                                 |
|  2. Contact Card        |             |                                                 |
|  (依据契约自动排版)       |             |                                                 |
+-------------------------+             +----------------------^--------------------------+
                                                               |
                                                               | 
                                        +----------------------v--------------------------+
                                        |                 Nanobot Core                    |
                                        |                                                 |
                                        |  +-------------------+    +------------------+  |
                                        |  | Context Builder   |    |    LLM Engine    |  |
                                        |  | (注入 Memory,     |--->| (意图理解与规划)  |  |
                                        |  |   加载 Skills)    |    |                  |  |
                                        |  +-------------------+    +--------+---------+  |
                                        |                                    |            |
                                        |                             [ Tool Calling ]    |
                                        |                                    |            |
                                        |                             +------v-----------+|
                                        |                             | Tools Registry   ||
                                        |                             | (注册的 MCP 工具) ||
                                        +------------------------------------+------------+
                                                                             |
                                                                             | JSON-RPC
                                                                             v
                                        +-------------------------------------------------+
                                        |              BizCard MCP Server                 |
                                        |  [search_contacts] [update_reminder] ...        |
                                        +------------------------------------+------------+
                                                                             |
                                                                             | REST/gRPC
                                                                             v
                                        +-------------------------------------------------+
                                        |              BizCard DB / Services              |
                                        |  - Contacts / Meetings / Reminders / Profile    |
                                        +-------------------------------------------------+
```

### 2.1 核心流转步骤解释：
1. **Query 发起**：App 将自然语言请求发送给 BizCard 后台的 API 网关。
2. **Context Building (上下文构建)**：网关将请求透传给 Nanobot 后，Nanobot 提取当前的 Session 上下文，并加载用户的全局记忆 (MEMORY) 以及预设的特定 `SKILL.md` (规定了 Agent 应该如何思考、输出什么格式以及遵循哪些上下文防冗余规则)。
3. **Tool Calling (工具调用)**：大模型基于 Skill 中的设定理解到用户需要查询 "Kevin"，于是触发调用 `search_my_contacts` 这个工具。
4. **MCP 桥接**：Nanobot 将调用请求通过标准协议发给 `BizCard MCP Server`，MCP Server 调用实际的后台 API 查询数据库，拿到 Kevin 的详情，并原路返回给大模型。
5. **Agent Response (大模型响应)**：大模型拿到数据后，严格根据特定 Skill 的约束进行推理，**直接生成符合 UI 契约的完整 JSON 数据（包含 `text` 和 `cards` 数组）** 返回给上游。
6. **前端渲染**：App 拿到标准化的 JSON 后，无脑完成文本展示与底部卡片挂载。

---

## 三、Agent Skills 规划与原子能力 (CRUD)

**架构洞察与回归**：虽然大模型具备原生的调用 Tool 的能力，但通过 **显式的 Agent Skill** 进行编排有以下不可替代的优势：
1. **强制的上下文规则防冗余 (Contextual Constraints)**：例如，当用户在某个 Meeting 详情页内唤起 Ask Agent 时，如果 Agent 在回答中再次输出该 Meeting 的卡片，会导致严重的视觉冗余。这种“情境感知”的硬规则，放在针对特定场景配置的 Skill 中约束最为有效。
2. **稳定的结构化输出 (Structured Blocks)**：通过 Skill 强制约束 Agent 吐出明确符合前端渲染契约的 JSON（`text` + `cards`）。大模型在调用 Tool 拿到详情后，直接将详情组装进 `cards` 结构中，省去了一层后端的 Reply Builder 转换，链路更短更轻。
3. **特定业务场景的深度编排**：如深度生成报表、投其所好的排版等。

因此，我们的架构依然是：**为各场景划分清晰的 Skills，同时明确每个 Skill 依赖的底层 MCP 原子能力。**

### 3.1 核心 MCP Tools 集合 (原子能力基建)

无论 Skill 如何编排，BizCard 后台都必须通过 MCP 协议暴露以下原子的数据操作工具。这些是我们必须开发出来的能力列表：

- **Contacts (联系人相关)**：
  - `search_my_contacts(query)`: 模糊搜索联系人，返回基础信息与 `contact_id`。
  - `get_contact_details(contact_id)`: 获取指定联系人的完整画像。
  - `create_contact(payload)` / `update_contact(id, payload)` / `delete_contact(id)`
- **Meetings (会议相关)**：
  - `search_my_meetings(time_range, contact_id, keyword)`: 检索会议列表。
  - `get_meeting_summary(meeting_id)`: 获取某场会议的 AI 摘要和结论。
  - `get_meeting_transcript(meeting_id)`: 获取会议的逐字稿。
  - `update_meeting(...)` / `delete_meeting(id)`

- **Reminders / Actions (待办相关)**：
  - `list_my_reminders(status, due_date)`: 检索待办事项。
  - `create_reminder(payload)` / `update_reminder(id, payload)` / `delete_reminder(id)`

### 3.2 基础查询技能 (bizcard-search)

- **场景**：用户试图寻找、列出或了解某个实体。
- **示例**：“明天有什么待办？”、“上次和 Alice 开会的要点”、“帮我找 Acme 公司的联系人”。
- **绑定的 MCP Tools**：`search_my_contacts`, `get_contact_details`, `list_my_reminders`, `search_my_meetings`, `get_meeting_summary`
- **Skill 行为约束 (Contextual & Structural)**：
  1. 检索到数据后，文本回复**只给直接答案**（如电话号码、会议某项结论）。严禁在文本中罗列表格或长列表。
  2. 必须在响应的 JSON 的 `cards` 数组中，将所查询实体的核心详情组装成对应的卡片对象（`contact_card`, `meeting_card`, `reminder_card`），供前端直接挂载。
  3. **上下文防冗余 (Context-Aware Suppression)**：如果用户的 Query 来源于某个特定实体的上下文（例如正在浏览会议 A），即使回复中涉及会议 A，也**绝对不要**在 `cards` 数组中输出会议 A 的卡片对象，防止前端重复渲染该卡片。

### 3.3 深度分析技能 (bizcard-meeting-deep-dive)

- **场景**：基于特定的某场会议，用户要求进行复杂的归纳、拆解。
- **示例**：“把这场会按产品和营销两个话题拆一下”、“结合会议内容给我写一份报告”。
- **绑定的 MCP Tools**：`get_meeting_transcript`
- **Skill 行为约束**：
  1. **读取记忆 (Memory)**：Agent 在分析前需读取用户的偏好（如“用户是销售，关注转化率”），在总结时**投其所好**。
  2. **高级排版输出**：使用复杂的 Markdown 生成表格、带有标题的结构化报告等。
  3. 同样严格遵守**上下文防冗余**规则。

### 3.4 数据创建技能 (bizcard-add)

- **场景**：用户希望新增资产数据。
- **示例**：“加一个联系人叫王五”、“提醒我下周二给 Kevin 发邮件”。
- **绑定的 MCP Tools**：`create_contact`, `create_reminder`
- **Skill 行为约束**：
  1. 文本回复仅作**状态确认**（“已为您添加联系人王五”）。
  2. 在响应的 JSON 的 `cards` 数组中附带刚刚创建成功的实体卡片数据，方便用户点击查看或立刻进行二次操作。

### 3.5 数据修改与删除技能 (bizcard-edit / bizcard-delete)

- **场景**：对已存在的资产进行信息订正、状态流转或物理删除。
- **示例**：“把上面那条待办标记完成”、“修改 Kevin 的邮箱为 xxx”、“删掉这条提醒”。
- **绑定的 MCP Tools**：各类 update / delete 工具。
- **Skill 行为约束**：
  1. 必须先获取到准确的 `entity_id` 再执行。
  2. 修改成功后：文本简短确认，并在 `cards` 数组中直接输出**修改后的实体卡片**。
  3. 删除成功后：文本确认即可，不输出实体 ID 信息，**不输出卡片**。

---

## 四、全局记忆 (Memory) 机制

在 `Context Builder` 阶段，除了加载核心的 General Skill 与 MCP Tools 外，Nanobot 还会持续维护并加载用户的**全局 Memory**（以 `MEMORY.md` 形式存在）。

### 4.1 Memory 的作用
- **身份认知 (Identity)**：Agent 知道用户是谁、在什么公司、什么职位（如“我服务于一位保险经纪总监”）。
- **沟通偏好 (Preferences)**：用户偏好的语言风格（精简/详尽）、排版习惯。
- **动态知识 (Facts)**：从过往对话中沉淀的长期事实（例如：“用户不喜欢在周末被提醒工作”）。

### 4.2 记忆的自动迭代
当用户在对话中透露出强烈的偏好（“以后帮我总结会议，都要附上一张行动表格”），Agent 可以在后台调用记忆管理相关的 Tool（如 `update_memory`），将这条规则写入 `MEMORY.md`，从而在未来的所有 Thread 中永久生效。这也是 Ask Agent “越用越聪明”的底层架构保障。

---

## 五、阶段规划与扩展能力

与 App 侧的演进计划相对应，Skill 架构也分为两步走：

### 第一阶段：核心 CRUD 与结构化卡片输出
- 跑通 `User -> Nanobot -> MCP -> Backend` 的调用链路。
- 部署 `bizcard-search`, `bizcard-add`, `bizcard-edit`, `bizcard-delete`, `bizcard-meeting-deep-dive` 核心技能。
- 确保大模型严格遵守 `Text + Cards` 契约，直接输出前端可解析的 JSON payload。

### 第二阶段：外部动作通道 (Outreach / Calendar)
- **发邮件技能 (outreach)**：Nanobot 接管用户的邮箱（通过 OAuth 或 IMAP/SMTP 配置）。用户在 Ask Agent 中说“给 Kevin 发一封跟进邮件”，Agent 拟稿并调用真实的发送 Tool，通过用户的邮箱将邮件发出。
- **日程/日历技能**：对接系统日历或三方 Calendar，允许 Agent 跨应用安排约会和查阅档期。

---

## 附录

- [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md)：可参考该文档了解底层单 Agent 架构与对内/对外网关部署的详细技术文档。
