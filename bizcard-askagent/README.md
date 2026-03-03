# BizCard Ask Agent

> 本目录包含了 BizCard 中关于 **Ask Agent** 的最新产品设计文档。Ask Agent 是基于 Nanobot 提供的一个 AI 驱动的对话式入口。

## 核心文档

- **[APP_PRD.md](./APP_PRD.md)**：Ask Agent 核心产品需求文档，涵盖入口、页面结构、三类使用场景（查、深入沟通、增改）及分阶段落地规划。
- **[MCP_PRD.md](./MCP_PRD.md)**：Ask Agent 的后台架构与 MCP Tools 逻辑文档，阐述 User -> Nanobot -> MCP Server 的调用链路及原子能力分布。
- **[DISPLAY_AND_CONTRACT.md](./DISPLAY_AND_CONTRACT.md)**：Ask Agent 的展示需求与 Nanobot 响应契约，重点定义了聊天框中“文本 + 资产卡片”的渲染逻辑和 Block 结构约定。

## 与主产品的关系
- **导航与入口**：Ask Agent 成为底部导航栏中心的核心入口，同时在会议/联系人/提醒详情页提供上下文入口 (Context-based)。
- **展示方式**：Agent 的输出不再仅仅是纯文本，而是结构化的 Payload (Block 模型)，前端根据这些 Block（如 `text`, `contact_card`, `meeting_card`, `reminder_card`）复用系统组件进行卡片式渲染，并提供跳转详情的交互。
- **数据流转**：BizCard 提供原子能力的接口供底层的 Nanobot Agent 调用。此部分逻辑解耦，前端只关心渲染后端的结构化输出。
