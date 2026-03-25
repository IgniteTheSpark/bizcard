# Ask Agent：本地 OpenClaw 与云端模型双模式

**版本**：v0.1  
**状态**：草案  
**关联**：[APP_PRD.md](./APP_PRD.md)、[HYBRID_AGENT_ARCHITECTURE.md](../bizcard-business-expansion/HYBRID_AGENT_ARCHITECTURE.md)

---

## 一、能力概述

Ask Agent 作为**统一对话入口**，支持用户在两套推理能力之间选择或切换：

| 模式 | 说明 | 典型场景 |
|------|------|----------|
| **云端模型** | 使用 BizCard 提供的云端 Agent/大模型进行问答与执行。 | 默认体验；依赖我们云端 MCP + OpenClaw 沙箱（若已接入）。 |
| **本地 OpenClaw** | 用户**自行配置**本机或局域网内的 OpenClaw 模型/服务，Ask Agent 作为**对话前端**，将请求转发至该本地端点。 | 数据不出本机、自托管、或使用自有模型。 |

**核心约束**：无论使用云端还是本地，用户都应能通过 Ask Agent **查询与操作其在 BizCard 内的资产**（Notes、Reminders、Contacts 等）。即：连接本地时，**同样允许 agent 查询 BizCard 里的内容和资产**。

---

## 二、用户可配置的「本地 OpenClaw」

### 2.1 配置项（建议）

用户可在「设置 → Ask Agent → 模型/后端」中选择「云端」或「本地 OpenClaw」，并在选择本地时填写：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **端点地址** | 本地或局域网 OpenClaw 服务 URL（如兼容 OpenAI API 或自定义 Chat 接口）。 | `http://192.168.1.10:8080/v1/chat/completions` 或 `https://my-openclaw.local/ask` |
| **鉴权方式** | API Key、Bearer Token 或其它约定方式（若本地服务需要）。 | 可选填写，存于本地/密钥链。 |
| **模型标识** | 若端点支持多模型，可填模型名或留空用默认。 | 可选 |

具体字段以实际本地 OpenClaw 暴露的接口为准；上述为最小可用的配置集合。

### 2.2 连接与健康检查

- **连接本地时**：App 在发送首条消息前（或设置保存时）可对端点做一次**健康检查**（如 HEAD/GET 或轻量 Chat 请求），失败时在界面提示「无法连接本地服务，请检查地址与网络」。
- **切换模式**：用户可随时在「云端」与「本地 OpenClaw」之间切换；当前选择持久化在本地，下次进入 Ask Agent 时沿用。

---

## 三、本地模式下仍可查询 BizCard 资产

当用户选择**本地 OpenClaw** 时，Ask Agent 仍须能够基于用户在 BizCard 内的** Notes、Reminders、Contacts** 等内容回答问题（如「我明天有什么待办」「和 Kevin 的会议摘要」）。有两种实现思路，可择一或组合使用。

### 3.1 方式 A：请求时注入 BizCard 上下文（推荐）

- **机制**：App 或后端在**每次向本地 OpenClaw 发起请求前**，先根据当前对话与权限，从 BizCard 拉取**与本轮问句相关的上下文**（如：最近 N 条 Notes 摘要、今日/明日 Reminders、相关 Contacts 列表等），组装成 **system / context 文本** 或 **多轮消息**，再与用户本条消息一起发给本地端点。
- **优点**：本地模型无需主动调我们接口，零改造即可获得「能答 BizCard 内容」的能力；数据由我们侧按需、按权限组装，可控。
- **注意**：上下文需做长度与脱敏控制，避免把大量原始数据塞进单次请求。

### 3.2 方式 B：为本地 OpenClaw 暴露 BizCard 查询能力（MCP 或本地 API）

- **机制**：BizCard 提供**只读的 MCP Server 或本地 HTTP API**，暴露「查 Notes / Reminders / Contacts」等能力；用户配置本地 OpenClaw 时，同时配置该 OpenClaw 实例**可访问**的 BizCard MCP/API 地址与鉴权（若需要）。本地模型在推理时**主动调用**这些工具获取数据后再回答。
- **优点**：本地模型可以按需、多轮调用，适合复杂多步查询。
- **注意**：需要本地 OpenClaw 支持 MCP 或 HTTP 工具调用；且需约定鉴权与网络安全（如仅本机或内网可访问）。

### 3.3 建议落地顺序

- **Phase 1**：优先实现 **方式 A**（请求前注入 BizCard 上下文），使「选本地 OpenClaw + 问 BizCard 内容」在无本地侧改造下即可生效。
- **Phase 2**：若需更强多步推理与工具调用，再为本地 OpenClaw 提供 **BizCard MCP 或本地 API**（方式 B），并在配置项中增加「BizCard 数据源」地址与开关。

---

## 四、与现有混合架构的关系

- **云端模式**：继续沿用 [HYBRID_AGENT_ARCHITECTURE.md](../bizcard-business-expansion/HYBRID_AGENT_ARCHITECTURE.md) 中的 Nanobot 路由 + MCP（快车道）+ 云端 OpenClaw 沙箱（慢车道）；Ask Agent 仅作为前端，请求发往我们云端。
- **本地模式**：Ask Agent 将请求发往**用户配置的本地 OpenClaw**；BizCard 侧只负责「组装上下文（方式 A）」或「暴露 MCP/API（方式 B）」，**不**经过我们云端的大模型或 OpenClaw 沙箱。

两套模式在 Ask Agent 内通过**同一对话入口**切换，仅后端/端点不同；产品文案上可区分为「使用云端助手」与「使用我的本地 OpenClaw」。

---

## 五、产品与 UI 要点

- **入口**：在 Ask Agent 设置或「模型/后端」中提供**模式切换**：「云端」/「本地 OpenClaw」；选本地时展开上述配置项。
- **对话态**：在对话界面可轻量展示当前所用模式（如小字「云端」或「本地」），避免用户混淆。
- **能力说明**：在配置页或帮助中说明：无论选哪种模式，都可以在对话中**查询你在 BizCard 里的笔记、待办和联系人**；选本地时由我们为你注入或提供这些数据供本地模型使用。

---

*本文档描述 Ask Agent 作为统一对话入口，支持用户配置本地 OpenClaw 并与云端模型二选一使用；且在连接本地时，仍能通过注入上下文或 MCP/API 使用 BizCard 内 Notes、Reminders、Contacts 等资产。*
