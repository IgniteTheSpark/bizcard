# BizCard Progressive Improvement
# 渐进式改进项目

> **从"Profile展示"到"行动中枢"的演进之路**

---

## 📋 项目概述

本项目定义了 BizCard App 从当前版本演进到 Unified Timeline 的**渐进式改进计划**。

### 核心问题

当前 BizCard 最大的问题是：**用户进入 App 后不知道应该做什么**。

- 首页以个人 Profile 为中心，而非用户的待办事项
- Meeting、Contact、Action 分散在不同页面，无法形成业务闭环
- Activity 中的 meeting summary 只是标题，缺乏上下文

### 解决方向

按照 Unified Timeline 的核心理念：
1. **事件驱动**：用户发生的所有事件（Meeting、Call、名片交换）是核心
2. **行动优先**：这些事件背后的 To-do 和 Action 是用户需要关注的

---

## 📂 文档索引

| 文档 | 说明 |
|------|------|
| [PROGRESSIVE_PLAN.md](./PROGRESSIVE_PLAN.md) | 整体渐进式改进计划（3阶段路线图） |
| [PHASE1_ACTION_LOOP_PRD.md](./PHASE1_ACTION_LOOP_PRD.md) | Phase 1 详细 PRD（行动闭环） |
| [VISUAL_COMPARISON.md](./VISUAL_COMPARISON.md) | 视觉对比图（当前 → 各阶段 → 目标） |

---

## 🗺️ 演进路线

```
Phase 0          Phase 1              Phase 2              Phase 3
"当前"     →     "Action Loop"   →    "Event Stream"   →   "Unified Timeline"
                  (4-6周)              (6-8周)              (8-12周)

重点：            重点：                重点：               重点：
识别问题          打通闭环              重构首页             完整体验
                  不改架构              渐进替换             单页架构
```

---

## 🎯 Phase 1 核心改动

### 1. 首页增加 Action Hub
让用户一进入 App 就能看到待办事项

```
┌──────────────────────────────────────┐
│  🔴 3 Pending Actions             ▼  │
│     Next: Follow up with Kevin       │
└──────────────────────────────────────┘
```

### 2. Meeting 详情增加 Action Items
从会议中自动提取/手动添加可执行项

```
┌──────────────────────────────────────┐
│  📋 Actions                    🔴 2  │
│  □ Follow up with Kevin on RWA       │
│  □ Send updated proposal by Fri      │
│  [+ Add Action]                      │
└──────────────────────────────────────┘
```

### 3. Contact Activity 增加上下文
不只是标题，要有摘要和 Actions

```
┌──────────────────────────────────────┐
│ 📝 Product Design Sync      13:43    │
│                                      │
│ Discussed RWA compliance and         │
│ upcoming demo schedule...            │
│                                      │
│ 🔴 2 Actions                         │
│ • Follow up on compliance docs       │
│ • Schedule demo for next week        │
└──────────────────────────────────────┘
```

---

## ✅ 成功标准

### Phase 1 验收

- [ ] 用户进入首页能看到待办事项
- [ ] 用户能在 Meeting 详情中看到和管理 Actions
- [ ] Contact Activity 提供足够的上下文
- [ ] 形成"录音 → 会议 → Actions → 完成"的闭环

### 最终目标

让 BizCard 从 **"名片管理工具"** 转变为 **"商务关系行动中枢"**

---

## 📚 相关文档

- [Unified Timeline 完整 PRD](../bizcard-unified-timeline/UnifiedTimeline_AppInteraction_PRD.md)
- [Unified Timeline 产品方案](../bizcard-unified-timeline/intro.MD)
- [Demo 原型](../bizcard-unified-timeline/index.html)

---

## 📅 时间线

| 阶段 | 周期 | 状态 |
|------|------|------|
| Phase 1: Action Loop | 4-6 周 | 🟡 规划中 |
| Phase 2: Event Stream | 6-8 周 | ⚪ 待启动 |
| Phase 3: Unified Timeline | 8-12 周 | ⚪ 待启动 |

---

*创建日期：2026-01-19*  
*最后更新：2026-01-19*
