# Meeting Processor 核心逻辑：智能待办提取与实体关联

本文档聚焦于 BizCard 会议处理流程中的“后置 AI 处理”环节，特指在 ASR (自动语音识别) 和 Speaker Diarization (声纹分离) 完成后，如何利用大模型准确提取用户的待办事项 (Reminders)，并支持与联系人系统的深度关联。

## 一、核心痛点与解决思路

在传统的 AI 会议总结中，系统往往会粗放地提取所有参会人的承诺事项，并笼统地塞给当前用户，导致出现大量“不属于我的代办”（例如客户答应发送的资料）。

**核心解决思路：以“我 (User)”为中心的提取 + 统一的 Transcript Assignment (关联) 机制**

1. **前提**：系统通过前置的声纹注册，在 ASR 阶段即可标记出 `Speaker X = 当前用户 (User)`。
2. **提取**：通过专属 Prompt，让大模型只提取执行人是“我”，或者需要“我”去跟进的待办。
3. **占位与关联**：大模型提取时，遇到提及的其他人（在场的其他 Speaker 或不在场的第三方，如“冯总”），仅输出文本占位符。前端渲染时，这些占位符变成可点击的高亮标签，引导用户进入统一的 **Transcript Assignment 页面** 完成与 CRM 通讯录的真实绑定。

---

## 二、处理流程 (Pipeline)

### Step 1: 录音上传与 ASR
- 用户录音完毕上传，系统触发 ASR。
- ASR 产出带有 Speaker 标签的逐字稿 (Transcript)。例如：`[User]`, `[Speaker 2]`, `[Speaker 3]`。

### Step 2: 触发大模型提取 (Prompt 处理)
- 在 ASR 结束后，后台触发一个针对当前逐字稿的单一长文本 Prompt 请求（不属于 Ask Agent 的对话流，而是单次的任务处理）。
- **Prompt 核心约束**：
  - “你是一个专业的助理，请阅读以下会议逐字稿。”
  - “已知 `[User]` 是你的老板。请**仅提取**老板自己承诺要去做的事，以及老板需要跟进他人去做的事。”
  - “如果待办涉及到其他人，请在 `related_mentions` 字段中输出原话中提及的称呼或 Speaker 编号。”

**大模型输出的 JSON 结构示例**：
```json
{
  "actions": [
    {
      "title": "下午给 Speaker 2 发送产品报价单",
      "assignee": "User",
      "related_mentions": ["Speaker 2"]
    },
    {
      "title": "跟进 冯总 关于尽调进度的安排",
      "assignee": "User",
      "related_mentions": ["冯总"]
    }
  ]
}
```

### Step 3: 前端展示与交互
- 提取出的待办事项展示在会议的“AI Suggested Actions”列表中。
- 前端解析 `related_mentions`，将“Speaker 2”和“冯总”渲染为**带有问号的特殊高亮 UI 标签**（例如：`[❓ Speaker 2]`, `[❓ 冯总]`）。

### Step 4: 统一的 Transcript Assignment 关联 (The General Page)
当用户点击上述的高亮标签时，进入一个全屏/半屏的统一关联页面。该页面不仅解决 Speaker 认领，也解决文本提及（Mention）的消歧。

**页面的核心能力与体验**：
1. **回到案发现场**：系统基于点击的标签（如“冯总”），在整篇 Transcript 中进行过滤，将提到“冯总”的所有上下文段落高亮展示出来，并允许用户点击播放对应的极短录音片段。
2. **搜索与绑定**：页面顶部提供一个搜索框，默认填入“冯总”。
   - 用户可以从搜索结果中选择已有的联系人“冯建国 (contact_id: 123)”。
   - 或者点击“新建联系人”。
3. **全局/局部生效**：
   - **绑定 Speaker**：如果绑定的是 `Speaker 2 = Kevin`，那么整篇逐字稿中的 `Speaker 2` 都会替换为 `Kevin`，且所有提及 `Speaker 2` 的待办都会关联到 Kevin。
   - **绑定 Mention**：如果绑定的是提到的 `冯总 = 冯建国`，则当前待办正式挂载到冯建国的 CRM 动态下。

---

## 三、为什么从 Ask Agent 剥离？

这个逻辑被定义为一个独立的 **Meeting Processor (会议后处理器)**，而不是 Ask Agent 的 Skill，原因如下：

1. **触发时机不同**：它是随着录音上传和 ASR 完成**自动触发的批处理任务 (Batch Task)**，而 Ask Agent 是基于用户主动发起自然语言询问的**交互式会话 (Interactive Chat)**。
2. **处理范式不同**：这里不需要调用 MCP Tools，不需要意图路由。它的本质就是一个非常经典且结构化的 **“长文本输入 -> Prompt 约束 -> JSON 提取”** 的单一任务。
3. **前端承载不同**：提取的代办最终落点是会议详情页的 Suggested Actions 列表，而不是在聊天气泡 (Chatbox) 中回复给用户。

通过剥离，Ask Agent 的逻辑更加纯粹（专注于解决用户的临时问询），而会议处理流水线也能独立演进。