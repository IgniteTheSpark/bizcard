# Ask Agent：API 调用结构 与 Claude Skill 定义/拆分

> **目的**：回答两个基础问题——（1）做 Ask Agent 或类似「和 Gemini/Claude 对话」时，每次用户输入对应几次 API 调用、请求里包含哪几部分；（2）若用 Claude 的 Skill 来做，应如何定义与拆分。

---

## 一、基础问题：每次输入 = 几次调用？请求里包含哪几部分？

### 1.1 是否「每次用户输入 = 一次模型 API 调用」？

**大致是，但有细节：**

- **通常**：用户发一条消息 → 你发**一次** Messages API 请求；模型返回一条回复（`stop_reason: "end_turn"`），则这一轮结束。
- **若开了 Tools**：模型可能返回 `stop_reason: "tool_use"`，表示它想调工具。这时你要执行工具、把结果以 `tool_result` 形式追加到 `messages`，再发**下一次**请求，由模型继续生成。所以**一轮用户输入**可能对应 **1 次或多次** API 调用（1 次用户消息 + 若干次 tool 往返），直到模型不再调 tool、给出最终回复为止。

因此：**「每次用户输入」= 一轮对话 turn；这一轮可能触发 1 次或多次 API 调用**，取决于是否使用 tools 以及模型是否多次连续调 tool。

### 1.2 单次 API 调用里包含的「四个重要部分」

以 Claude Messages API 为例（与 OpenAI/ Gemini 等在概念上一致），一次请求通常包含以下部分：

| 你提到的部分 | 在 API 中的对应 | 说明 |
|--------------|------------------|------|
| **① 用户当前输入** | `messages` 数组的**最后一条** | `role: "user"`, `content: "我和王总上次开会聊了什么"`。当前这轮的用户输入一定在 `messages` 的末尾。 |
| **② System message（约束 Agent 行为）** | 请求体中的 **`system`** 字段 | 与 `messages` **分开**，单独传。用来写角色、规则、知识库使用方式、追问与澄清规则等。**不包含**对话历史。 |
| **③ 前几轮对话的 context（聊天记录）** | **`messages` 数组中除最后一条以外的所有项** | 即历史的 `user` / `assistant`（以及若有 `tool_use` / `tool_result`）轮次。API 是**无状态**的，每次请求都要带上**完整**历史，模型才能「记得」之前说过什么。**这一部分不会揉在 system 里**——在标准用法里，system 只放静态指令，历史放在 `messages` 里。 |
| **④ 本请求可用的 tools 列表** | 请求体中的 **`tools`** 参数 | 例如 `search_my_knowledge`、`resolve_contact`、`search_meetings_by_topic`。模型在本轮中可选择性调用；若调用，你需把执行结果作为 `tool_result` 追加到 `messages` 再发下一次请求。 |

**小结：**

- **system**：只放「行为约束 + 规则」，不放历史。
- **messages**：= 历史对话 + **当前用户输入**（最后一条）。
- **tools**：本回合可用的工具列表；可选。

所以：**是的，你的理解对——一次调用里包含 (1) 当前 user input、(2) system、(3) 历史 context、(4) tools；其中 (3) 是放在 messages 里的前 N 条，不是揉在 (2) 里。**

---

## 二、用 Claude 的 Skill 来做 Ask Agent：如何定义与拆分？

### 2.1 Claude 官方的「Skill」是什么？

根据 [Anthropic 文档](https://docs.anthropic.com/en/api/skills-guide)：

- **Agent Skills** = 通过 **code execution** 在 **container** 里加载的「技能包」：一个 Skill 是一个**文件夹**（根目录有 `SKILL.md` + 脚本/资源），上传到 Anthropic 后，在发 Messages 时通过 **`container.skills`** 传入（如 `{"type": "custom", "skill_id": "xxx", "version": "latest"}`）。
- Skill 运行在**代码执行环境**里：**无网络、仅预装包**，适合「文档生成、表格/PPT 处理、本地计算」等，**不适合**直接调你自家后端的 HTTP API（检索知识库、查联系人、查会议）。

因此：**Ask Agent 里「查用户知识库」「联系人澄清」「按内容查会议」这类能力，本质都要和你后端/数据库/向量库交互，不能完全塞进 Claude 的 Skill 容器里跑。**

### 2.2 推荐做法：System + Tools，Skill 只做「可打包的辅助能力」

| 能力类型 | 更适合的实现方式 | 说明 |
|----------|------------------|------|
| **RAG、联系人解析、按内容查会议** | **你后端实现**，通过 **tools** 暴露给模型，或**先检索再注入 system/首条 user** | 检索、解析、查库都必须走你的服务；用 **system（规则 + 占位符）+ 预注入的检索结果**，或 **tools（如 search_my_knowledge, resolve_contact, search_meetings_by_topic）** 让模型按需调用。 |
| **行为与规则（如何用检索结果、何时追问、如何回答）** | 写在 **system** 里 | 即你在 [ASK_AGENT_PROMPT_SPEC.md](./ASK_AGENT_PROMPT_SPEC.md) 里写的那些：双源回答、联系人澄清、按内容查会议、注明来源等，全部放在 **system**。 |
| **可独立打包的「文档/模板/脚本」类能力** | 可选用 **Claude Skill** | 例如：按固定模板生成会议摘要、导出为某种格式等，若可写成无网络依赖的脚本，可做成一个 Skill 供同一会话复用。 |

所以：**Ask Agent 的主干 = system（约束与规则）+ messages（历史 + 当前输入）+ tools（检索/联系人/会议等）**；Claude Skill 只作为**可选**的、与 code execution 绑定的扩展，用于「可打包成代码/文档」的辅助能力，**不替代**上述主干。

### 2.3 若仍想用「Skill」概念来组织：逻辑上如何定义与拆分？

这里的「Skill」指**产品/逻辑上的能力模块**，便于分工和迭代；实现上对应 **system 片段 + 若干 tools**，不必全部塞进 Claude 官方的 Skill API。

可按「能力域」拆成几块，每块对应一套 **system 说明 + 可选 tools**，在**同一次**请求里一起传给模型（一个 system 可合并多块说明，一个 `tools` 数组可包含多个 tool）。

| 逻辑 Skill（能力块） | 说明 | 实现形态 |
|----------------------|------|----------|
| **Plaud 式通用 + 知识库问答** | 通用常识 + 会议/录音/笔记的 RAG；优先用检索结果、注明来源。 | **system**：双源规则、何时查库、输出格式。**tools** 或**预注入**：`search_my_knowledge`（或你在请求前先 RAG，把结果注入 system/首条 user）。 |
| **联系人维度（按人检索 + 澄清）** | 按人查会议/待办；「王总」等多候选时只追问、不猜。 | **system**：联系人澄清规则（见 ASK_AGENT_PROMPT_SPEC 第七章）。**tools**：`resolve_contact(nickname)` → 返回唯一 contact 或候选列表；`get_meetings_for_contact(contact_id)` 等（或后端先解析再注入）。 |
| **按内容/主题查会议** | 「上次聊的 RWA 是哪一次会议」→ 查总结/纪要内容。 | **system**：约定「按主题查会议」时用检索结果回答并注明会议日期/标题。**tools**：`search_meetings_by_topic(query)`（或请求前按 query 检索，结果注入 context）。 |
| **名片/Profile（只读）** | 我的名片写的是什么、根据会议更新简介建议等。 | **system**：Profile 相关规则。**tools** 或**预注入**：`get_my_profile`、或检索结果里带 Profile 片段。 |
| **名片/Profile（修改）** | 用户通过对话修改 Profile（如「把职位改成产品经理」）。 | **system**：仅当用户明确说出要改的字段与新值时才调用修改工具；否则追问。**tools**：`update_my_profile(changes)`；后端仅允许当前用户、白名单字段，可返回「待确认」由客户端二次确认后再落库。详见 [ASK_AGENT_PROMPT_SPEC 第八章](./ASK_AGENT_PROMPT_SPEC.md)。 |

**拆分原则：**

- **一个「逻辑 Skill」= 一类用户意图 + 对应规则 + 对应数据来源（你的后端/tools 或预注入）。**
- 实现时：**一个 system 字符串**里可分段写多个逻辑 Skill 的规则；**一个 tools 数组**里列出所有需要的 tools；同一轮请求一起发，模型根据当前问题和历史决定用哪条规则、是否调哪个 tool。
- 若某块能力可**完全用代码在隔离环境完成**（如某类报表生成），再考虑用 Claude 官方 Skill API 做成独立 Skill，与上述 system + tools 并存使用。

### 2.4 和「每次 API 调用」的对应关系

- **每次用户输入**：你组装 **system**（固定或按会话微调）+ **messages**（历史 + 当前用户输入）+ **tools**（Ask Agent 所需的一批工具）。
- 若模型本回合要查库/澄清联系人/查会议：会返回 **tool_use**；你执行对应 tool，把结果放进 **tool_result**，再发**下一次**请求（同一轮对话），直到模型给出最终文本回复。
- **前几轮对话的 context**：始终在 **messages** 里，**不**写进 system；system 只负责「约束与规则」。

这样既满足「每次输入对应一到多次 API 调用」的直觉，也把「四个部分」和「用 Claude Skill 如何定义与拆分」统一在同一套实现模型里。

---

## 三、Tool 定义与调用流程（参考 OpenRouter）

以下两点与 [OpenRouter Tool Calling](https://openrouter.ai/docs/guides/features/tool-calling) 一致，便于实现时对齐。

### 3.1 description 写给谁？需要定义「输出结构」吗？

- **description（以及 parameters）是写给 Agent（模型）看的**，用来让模型知道：
  - **何时调用**：在什么用户意图下该用这个 tool；
  - **如何传参**：需要传哪些参数（即 **parameters** 里的 `properties`、`required`）。
- **输出结构不在 tool 定义里**。API 的 tool 定义只包含 `name`、`description`、`parameters`（**输入** schema）；**没有**「返回值类型」或「输出 schema」。  
- 原因：tool 是由**你方后端/客户端**调用的，调完后把**函数真实返回值**（通常是 JSON 序列化后的字符串）塞进 `role: "tool"` 的 `content` 里，再发回给模型。模型看到的就是这段原始返回内容，用来组织回答。所以**不需要、也不在 API 里定义**「输出结构」给模型；输出是你后端实现决定的，只要返回的内容模型能理解即可（例如返回会议列表的 JSON）。  
- 若需要约定「后端返回什么字段」，那是**后端与前端/Agent 的契约**，可在接口文档或 [ASK_AGENT_PROMPT_SPEC 第十一章](./ASK_AGENT_PROMPT_SPEC.md) 里写，不必写进发给模型的 `tools[].function.parameters`。

### 3.2 每次 function call 后「喂回去」= 多一次 API 调用吗？

**是的。** 流程是：

1. **第一次请求**：`messages`（含用户输入）+ `tools` → 模型返回 `finish_reason: "tool_calls"` 和 `tool_calls`。
2. **你方执行**：根据 `tool_calls` 调后端 function，得到结果。
3. **第二次请求**：把 `messages` 追加「assistant 的 tool_calls」和「role: tool 的 tool_result」，再次带上 `tools`，发给模型 → 模型返回最终文本（或再次 tool_calls，则再一轮）。

所以**每多一轮「模型要调 tool → 你执行 → 把结果喂回去」就多一次 API 调用**。一轮用户输入可能对应 1 次（无 tool）或 2 次、3 次…（多次 tool 往返）API 调用。

---

## 四、小结

| 问题 | 结论 |
|------|------|
| Tool 的 description 写给谁？ | 写给 **Agent（模型）**，用于知道**何时调用**、**如何传参**（parameters）。 |
| 要在 tool 里定义「输出结构」吗？ | **不需要**。API 的 tool 只有输入（parameters）；输出是后端执行 function 后的真实返回值，你塞进 `role: "tool"` 的 content 给模型即可。 |
| 每次 function call 后喂回去 = 多一次 API 调用？ | **是**。每多一轮「模型返回 tool_calls → 你执行 → 把 tool result 发回」就多一次请求。 |
| 每次用户输入是否 = 一次 API 调用？ | **一轮用户输入** = 1 次或多次调用：无 tool 则 1 次；有 tool 则 1 次用户消息 + 若干次 tool 往返。 |
| 请求里哪四部分？ | **① 当前用户输入**：messages 最后一条；**② system**：约束行为，不含历史；**③ 历史 context**：messages 中除最后一条外的所有条；**④ tools**：本回合可用工具列表。 |
| 历史是否揉在 system 里？ | **一般不揉**；历史在 messages 里，system 只放静态规则。 |
| 用 Claude Skill 做 Ask Agent？ | **主干用 system + tools**（你后端做检索/联系人/会议）；Claude 官方 Skill 只适合「可打包进 code execution」的辅助能力（如文档模板）。 |
| 如何定义与拆分？ | **按能力域**拆成逻辑 Skill：通用+RAG、联系人+澄清、按内容查会议、名片/Profile；每块对应一段 system 规则 + 若干 tools，同一次请求一起传。 |

---

## 五、结构化返回与前端渲染（All-in-One 助手形态）

若采用「**一个 Ask 入口 → Agent 返回任意类型 → 前端按类型渲染**」的 All-in-One 助手形态（见 [BIZCARD_AI_ASSISTANT_VISION.md](./BIZCARD_AI_ASSISTANT_VISION.md)），Agent 的响应除自然语言外，需约定**结构化结果**，供前端选择展示组件：

- **response_type**：如 `todo_list` | `timeline` | `call_list` | `meeting_list` | `contact_list` | `profile` | `text` | `disambiguation` 等。
- **payload**：该类型对应的数据（列表、卡片数组、文本等）。

实现方式可二选一或并存：（1）**Tool 返回**：某次 tool 调用的结果直接带 `response_type` + 数据，由后端/Agent 在最后一轮组装成统一结构返回给客户端；（2）**模型输出**：在 System 中要求模型在最终回复中输出一段结构化块（如 JSON），客户端解析后根据 `response_type` 渲染。无论哪种，需与前端约定同一套 type 与 payload 契约。

---

## 六、Profile 修改能力（通过 Agent）

若需支持用户**通过对话修改/更新 Profile**，在 tools 中增加 **`update_my_profile`**，并在 system 中加入对应规则即可。具体 Tool 入参/出参、安全校验、以及「仅建议 vs Tool 直接发起」的产品选择，见 [ASK_AGENT_PROMPT_SPEC.md 第八章](./ASK_AGENT_PROMPT_SPEC.md)。

---

*文档版本：v1.3 | 本目录为 ask-agent-demo*
