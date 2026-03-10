# Ask Agent Demo

BizCard「问 BizCard」/ Ask Agent 的规范与 Demo 集中目录。用于实现与迭代「会议总结 + 联系人关联」的 Phase 1 Ask Agent。

## 文档索引

| 文档 | 说明 |
|------|------|
| [ASK_AGENT_PROMPT_SPEC.md](./ASK_AGENT_PROMPT_SPEC.md) | Prompt 与能力设计：为何要定制 Prompt、能力架构、Contacts/Profile 改造点、追问与澄清、Profile 修改、迭代节奏（Phase 1 = 会议+联系人）、五类问题类型、知识库 Tools 输入/输出。 |
| [ASK_AGENT_API_AND_CLAUDE_SKILLS.md](./ASK_AGENT_API_AND_CLAUDE_SKILLS.md) | API 调用结构、Tool 定义与 OpenRouter 对齐、结构化返回与前端渲染、Profile 修改能力。 |
| [BIZCARD_AI_ASSISTANT_VISION.md](./BIZCARD_AI_ASSISTANT_VISION.md) | All-in-One AI 助手愿景：一个 Ask 入口 + 按类型渲染、极简导航（日历/Contacts/我的）。 |

## Phase 1 范围（当前 Demo 目标）

- **会议总结 + 联系人关联**：按内容查会议、按人查会议、联系人澄清（模糊昵称→追问）、按会议查参会人。
- **必备 Tools**：`search_meetings_by_content`、`resolve_contact`、`get_meetings_by_contact`、`get_contacts_by_meeting`。
- 详见 [ASK_AGENT_PROMPT_SPEC.md 第九、十、十一章](./ASK_AGENT_PROMPT_SPEC.md)。

## 上层目录

- 产品定位与功能总览：`../BIZCARD_POSITIONING_AND_FEATURES.md`
- 会议 Reminder 提取规范：`../bizcard-progressive/phase1-lite/AI_EXTRACT_REMINDERS_SPEC.md`
