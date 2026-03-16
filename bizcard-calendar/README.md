# BizCard Calendar 能力拓展

本目录用于 Calendar 能力提升相关的需求、设计与技术方案，与 `bizcard-3.0` 的日历展示（Reminders 为主）形成递进关系。

## 核心目标

- 通过手机端授权**多方日程 App**（如 Google Calendar），将用户日程同步到 BizCard。
- 在统一日历中呈现**日程（区间型 Event）**与**提醒（Reminder）**，供 **Agent** 读取并基于日程做提醒、管理与跟进。

## 三步规划

| 步骤 | 内容 | 文档 |
|------|------|------|
| 第一步 | 将日历拓展为可承载**日程（区间）**的容器，与现有 Reminder 共存 | [ROADMAP.md](./ROADMAP.md) § 第一步 |
| 第二步 | 接通多方日历：授权、同步、App 端设计 | [ROADMAP.md](./ROADMAP.md) § 第二步 |
| 第三步 | 根据用户日程安排提醒与跟进，Agent 使用日程上下文 | [ROADMAP.md](./ROADMAP.md) § 第三步 |

详见 **[ROADMAP.md](./ROADMAP.md)**。
