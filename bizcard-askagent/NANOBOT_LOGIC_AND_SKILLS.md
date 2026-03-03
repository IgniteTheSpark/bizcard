# nanobot 逻辑与 Skills 机制

本文档概括 nanobot 的核心运行逻辑、消息总线、Agent 循环、上下文构建与 Skills 机制，便于扩展与集成（如商务名片 Demo）。

---

## 一、整体架构

- **MessageBus**：入站消息（InboundMessage）与出站消息（OutboundMessage）的队列；各 channel（Telegram、Slack、CLI 等）向 bus 投递用户消息，Agent 处理完后通过 bus 发布回复。
- **AgentLoop**：核心处理引擎。从 bus 消费入站消息，构建上下文、调用 LLM、执行 tool calls，将结果通过 bus 发回对应 channel。
- **ContextBuilder**：负责组装 system prompt：身份与 workspace 说明、bootstrap 文件（AGENTS.md、SOUL.md、USER.md、TOOLS.md 等）、Memory（MEMORY.md）、以及 **Skills**（workspace/skills 与 builtin skills）的摘要与按需加载。
- **Tools**：内置工具（read_file、edit_file、web_search、message、cron、exec 等）与 **MCP 工具**（连接外部 MCP Server 后，将其 tools 注册为 `mcp_{server_name}_{tool_name}`）。

用户在与 channel 对话时，消息进入 bus → AgentLoop 拉取 → 构建 context（含 Skills）→ LLM 决策 → 若需查后台数据则调用 MCP 工具（如 bizcard-demo 的 search_my_contacts、search_my_meetings）→ 将回复发布到 bus → channel 推送给用户。

---

## 二、AgentLoop 流程（简要）

1. **消费入站**：`bus.consume_inbound()` 等待用户消息（含 channel、chat_id、content）。
2. **会话**：按 `session_key`（默认 `channel:chat_id`）维护会话历史与 session 状态。
3. **构建上下文**：ContextBuilder 产出 system prompt（身份、workspace、memory、skills 摘要 + 可选 always_skills 正文）。
4. **调用 LLM**：带上历史消息与当前用户消息，请求 completion；若返回 tool_calls，则执行工具（含 MCP 工具）。
5. **迭代**：将工具结果加入消息历史，再次调用 LLM，直到无 tool_calls 或达到 max_iterations。
6. **发布出站**：将最终回复通过 `bus.publish_outbound(OutboundMessage(...))` 发给对应 channel。

特殊：`/stop` 会取消该 session 的进行中任务与 subagent。

---

## 三、ContextBuilder 与 Skills

- **Bootstrap 文件**：workspace 根目录下的 AGENTS.md、SOUL.md、USER.md、TOOLS.md、IDENTITY.md 等，若存在则拼进 system prompt。
- **Memory**：`workspace/memory/MEMORY.md` 作为长期记忆上下文。
- **Skills**：
  - **workspace/skills/{skill-name}/SKILL.md** 优先于 builtin（nanobot/skills/ 下同名）。
  - Skills 列表会生成摘要进 system prompt，引导 agent「用 read_file 读 SKILL.md 再执行」。
  - 可配置 **always_skills**：这些 skill 的正文会被直接注入 system prompt，无需先 read_file。
- 扩展「商务场景」时，可在 workspace 下增加 skills（如 business_read、business_write），或在 config 中配置 MCP Server（bizcard-demo），则 MCP 工具自动注册，agent 通过 **查后台 = 调用这些 MCP 工具** 获取联系人、会议、提醒等。

---

## 四、Skills 分类（产品视角）

从能力上可把 Skills 分为几类，便于设计和文档化（实现上仍是 SKILL.md + 可选 MCP 工具）。Demo（bizcard-demo）中 **contacts、reminders、meetings 均应具备 读 / 写 / 改**（会议若无「新建会议」则仅 读+改），对应 MCP 工具如下。

| 能力 | 联系人 contacts | 提醒 reminders | 会议 meetings |
|------|-----------------|----------------|---------------|
| **读** | search_my_contacts、get_contact_details | list_my_reminders | search_my_meetings、get_meeting_summary（完整 MD） |
| **写** | create_contact | create_reminder | （可选 create_meeting） |
| **改** | update_contact | update_reminder | update_meeting |

- **沟通**：发邮件、约会议（send_email_to_contact、meeting_request 相关、create_calendar_meeting 等）。
- **学**：基于会议总结做深入检索（如会议 + web_search）、沉淀到 memory 或待办。

上述在 bizcard-demo 的 MCP 中已实现，nanobot 连上对应 MCP 后即可在对话中使用；内置 skills **bizcard-search、bizcard-add、bizcard-edit、bizcard-delete** 分别对应 查、增、改、删。

---

## 五、配置要点

- **Workspace**：`config.agents.defaults.workspace`，ContextBuilder 与 Session、Memory、Skills 均基于该路径。
- **MCP**：`config.tools.mcp_servers` 为 `name -> MCPServerConfig`；每项可配 `command`+`args`（stdio）或 `url`（streamable HTTP）。Gateway 启动时 AgentLoop 会 `_connect_mcp()` 并注册各 MCP 的 tools。
- **Channels**：Telegram、Slack 等配置在 `config.channels`，gateway 将 channel 与 bus 桥接，实现「用户发消息 → bus → AgentLoop → bus → channel 回用户」。

以上为 nanobot 逻辑与 Skills 的总结，可与 [BUSINESS_CARD_APP_NANOBOT_INTEGRATION.md](./BUSINESS_CARD_APP_NANOBOT_INTEGRATION.md)、[MCP_SERVER_AND_DEPLOYMENT.md](./MCP_SERVER_AND_DEPLOYMENT.md) 对照使用。
