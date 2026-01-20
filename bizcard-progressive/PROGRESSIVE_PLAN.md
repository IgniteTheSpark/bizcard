# BizCard Progressive Improvement Plan
# 渐进式改进计划

> **目标**：从当前版本逐步演进到 Unified Timeline，控制每个迭代周期，降低风险，持续交付价值。  
> **核心原则**：Action-First（行动优先）、Event-Centric（事件中心）、Progressive Enhancement（渐进增强）

---

## 0. 当前状态诊断

### 0.1 核心问题：缺乏明确的 App 主定义

| 问题 | 表现 | 影响 |
|------|------|------|
| **功能优先级混乱** | 首页以"个人 Profile"为核心，而非用户需要做的事 | 用户进入后不知道该做什么 |
| **信息架构割裂** | Meeting、Contact、Action 分散在不同页面 | 无法形成业务闭环 |
| **行动与事件断连** | Activity 中的 meeting summary 只是标题 | 用户无法快速回顾和执行 |
| **被动展示 vs 主动引导** | 数据统计占据核心位置 | 用户是"看数据"而不是"做事情" |

### 0.2 当前首页元素分析

```
┌─────────────────────────────────────────────────────────┐
│  ● 85%        Connected    >                            │  ← 硬件状态（保留✓）
├─────────────────────────────────────────────────────────┤
│  [头像]  Ethan Carter Ethn                              │
│          Product Designer                               │  ← 个人Profile（需重新定位）
│          evelyntpp.reed@bizcard.com...                  │
│          [UI Design] [UX Research] [Prototyping]        │
│                                                         │
│  [✏ Edit]  [✨ Agent]  [👁 Preview]                     │  ← 编辑功能（移到抽屉）
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │  Bitflux Insurance Agent Training Program       │    │  ← Banner运营位（可保留/弱化）
│  │  Submit your meeting notes for rewards !        │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│   287        36          2           3                  │
│  Visits   Cards Added  Meetings   Agent Call            │  ← 数据统计（可保留/下移）
├─────────────────────────────────────────────────────────┤
│  Today's Meeting                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 💬 Exchange with John Mitchell    11:30 AM   >  │    │  ← 会议列表（核心✓，需强化）
│  │ 🎙 Exchange with John Mitchell    11:30 AM   >  │    │
│  │ ⭐ Visitor #402 - Pricing Inquiry 10:30 AM   >  │    │
│  └─────────────────────────────────────────────────┘    │
│  [View All History >]                                   │
├─────────────────────────────────────────────────────────┤
│  [🔄 Scan to Add]        [🎙 Start Capture]             │  ← Sticky Bar（保留✓）
├─────────────────────────────────────────────────────────┤
│  [BizCard]  [Contacts]  [Notifications]  [Me]           │  ← 底部Tab（Phase 2调整）
└─────────────────────────────────────────────────────────┘
```

---

## 1. 改进策略：三阶段演进

```
Phase 0        Phase 1           Phase 2           Phase 3
"诊断"    →    "Action Loop"  →  "Event Stream"  → "Unified Timeline"
(当前)          (4-6周)           (6-8周)           (8-12周)

重点：          重点：             重点：            重点：
识别问题        打通闭环           重构首页          完整体验
               不改架构           渐进替换          
```

---

## 2. Phase 1: Action Loop（行动闭环）

> **核心目标**：在不重写首页架构的前提下，打通"事件-待办-人"的闭环。  
> **预期周期**：4-6 周  
> **改动范围**：有限，主要是功能增强而非架构重构

### 2.1 改动点总览

| 优先级 | 改动点 | 目的 | 复杂度 |
|--------|--------|------|--------|
| P0 | **首页增加 Action Hub** | 让用户进入App就知道"要做什么" | 中 |
| P0 | **Meeting 详情增加 Action Items** | 从会议中提取可执行项 | 中 |
| P0 | **Contact Activity 增加上下文** | 不只是标题，要有摘要和Actions | 中 |
| P1 | **首页 Profile 区域精简** | 减少干扰，突出核心功能 | 低 |
| P1 | **会议卡片增加 Action 预览** | 在列表层面就能看到待办 | 低 |
| P2 | **录音结束关联优化** | AI 推荐关联联系人 | 中 |

### 2.2 P0-1: 首页增加 Action Hub

**位置选择**：在"Today's Meeting"上方，作为首屏最显眼的元素

```
BEFORE                              AFTER
┌──────────────────────┐            ┌──────────────────────┐
│  [Profile区域]       │            │  [硬件状态 - 精简]   │
│                      │            ├──────────────────────┤
│  [Banner运营位]      │            │  [Profile - 极简化]  │
│                      │            ├──────────────────────┤
│  [数据统计]          │            │  🔴 3 Actions Pending│  ← NEW!
│                      │            │  ┌──────────────────┐│
│  [Today's Meeting]   │            │  │□ Follow up Kevin ││
│                      │            │  │□ Send proposal   ││
├──────────────────────┤            │  │□ Schedule demo   ││
│  [Sticky Bar]        │            │  └──────────────────┘│
└──────────────────────┘            ├──────────────────────┤
                                    │  [Today's Meeting]   │
                                    ├──────────────────────┤
                                    │  [Sticky Bar]        │
                                    └──────────────────────┘
```

**交互细节**：
- 默认折叠态显示 "🔴 3 Actions Pending"
- 点击展开显示待办列表
- 每条待办显示：勾选框 + 标题 + 关联人 + 来源会议
- 点击待办可跳转到来源会议详情
- 勾选完成后自动折叠，显示成功 Toast

**数据来源**：
- 从 Meeting 详情页的 Action Items 聚合
- 从手动添加的 Action Note 聚合

### 2.3 P0-2: Meeting 详情增加 Action Items

**改动说明**：在会议详情页顶部增加 Action Items 区域

```
┌────────────────────────────────────────┐
│  < Back          Meeting Detail   Edit │
├────────────────────────────────────────┤
│  📍 Actions from this meeting     🔴 2 │  ← NEW!
│  ┌──────────────────────────────────┐  │
│  │ □ Follow up with Kevin on RWA   │  │
│  │ □ Send updated proposal by Fri  │  │
│  │ [+ Add Action]                  │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  📝 Summary                            │
│  Discussed product roadmap...          │
├────────────────────────────────────────┤
│  🎙 Full Transcript                 ▼  │
│  (折叠状态)                            │
└────────────────────────────────────────┘
```

**实现要点**：
- AI 自动从 Transcript 中提取 Action Items
- 用户可手动编辑/添加/删除
- 支持设置 Due Date（可选）
- Actions 关联到对应的 Contact

### 2.4 P0-3: Contact Activity 增加上下文

**当前问题**（参考截图3）：

```
BEFORE - 只有标题
┌────────────────────────────────────────┐
│  Jan 15, 2026                          │
│  📝 Meeting summary           13:43    │  ← 无上下文，不知道聊了什么
├────────────────────────────────────────┤
│  Jan 14, 2026                          │
│  👤 Became My Contact   Yesterday 16:01│
│     Meeting                            │
└────────────────────────────────────────┘
```

**改进后**：

```
AFTER - 有摘要 + Actions
┌────────────────────────────────────────┐
│  Jan 15, 2026                          │
│  📝 Meeting: Product Design Sync 13:43 │
│  ┌──────────────────────────────────┐  │
│  │ Discussed RWA compliance and     │  │
│  │ upcoming demo schedule...        │  │
│  │                                  │  │
│  │ 🔴 2 Actions                     │  │
│  │ • Follow up on compliance docs   │  │
│  │ • Schedule demo for next week    │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  Jan 14, 2026                          │
│  👤 Became My Contact   Yesterday 16:01│
│     Source: Exchange at CES            │
└────────────────────────────────────────┘
```

**改动要点**：
- Meeting 卡片显示 2-3 行摘要
- 显示 Actions 数量和预览
- 点击可展开完整详情
- 保持时间线结构

### 2.5 P1-1: 首页 Profile 区域精简

**目的**：减少首屏信息负载，让用户聚焦于"要做什么"

```
BEFORE                              AFTER
┌──────────────────────┐            ┌──────────────────────┐
│  [大头像]            │            │  [小头像] Ethan Carter│
│  Ethan Carter Ethn   │            │          Product Designer
│  Product Designer    │            │          [Preview >]  │
│  email@bizcard.com   │            └──────────────────────┘
│  [UI] [UX] [Proto]   │
│                      │            精简幅度：高度减少 60%
│  [Edit][Agent][Preview]           Edit/Agent 移到 Settings
└──────────────────────┘
```

### 2.6 P1-2: 会议卡片增加 Action 预览

**在首页会议列表中预览 Pending Actions**：

```
┌────────────────────────────────────────┐
│  Today's Meeting                       │
│  ┌──────────────────────────────────┐  │
│  │ 💬 Product Design Sync           │  │
│  │    with Kevin, Alice    11:30 AM │  │
│  │    🔴 2 Actions pending          │  │  ← 新增
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 🎙 Sales Call - Acme Corp        │  │
│  │    with Bob            10:00 AM  │  │
│  │    ✅ All actions done           │  │  ← 新增
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## 3. Phase 2: Event Stream（事件流化）

> **核心目标**：首页从"展示型"转变为"事件流型"  
> **预期周期**：6-8 周  
> **改动范围**：中等，开始触及首页架构

### 3.1 改动点总览

| 优先级 | 改动点 | 目的 | 复杂度 |
|--------|--------|------|--------|
| P0 | **首页重构为事件流** | Timeline 成为首页核心 | 高 |
| P0 | **引入卡片系统** | Meeting/Call/Note 统一卡片化 | 中 |
| P1 | **Sticky Action Hub** | 向下滚动时 Action Hub 吸顶 | 中 |
| P1 | **Profile 移至左侧抽屉** | 彻底从首页移除个人展示 | 中 |
| P2 | **底部 Tab 精简** | 从 4 Tab 减为 3 Tab | 低 |

### 3.2 首页事件流重构

```
┌────────────────────────────────────────┐
│  [👤]  ●Connected 85%     [🔍] [📤]   │  ← 精简的全局控制
├────────────────────────────────────────┤
│  🔴 3 Actions Pending              ▼   │  ← Action Hub (吸顶)
├────────────────────────────────────────┤
│  Today                                 │
│  ┌──────────────────────────────────┐  │
│  │ 📝 Meeting: Product Sync         │  │
│  │    Kevin, Alice · 11:30 AM       │  │
│  │    🔴 2 Actions                  │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 📞 Agent Call: 138xxxx           │  │
│  │    "Call me back asap"           │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ 🃏 New Contact: Alex Turner      │  │
│  │    VP of Sales, Acme Corp        │  │
│  │    📍 CES Main Hall    [SCANNED] │  │
│  └──────────────────────────────────┘  │
├────────────────────────────────────────┤
│  Yesterday                             │
│  ...                                   │
├────────────────────────────────────────┤
│          [🎙]  FAB (录音/扫描/笔记)    │
├────────────────────────────────────────┤
│  [Timeline]  [Contacts]  [Me]          │  ← 精简为3 Tab
└────────────────────────────────────────┘
```

### 3.3 左侧抽屉（Settings Drawer）

**点击左上角头像打开**：

```
┌─────────────────────────────────┐
│  Settings                     ✕ │
├─────────────────────────────────┤
│  MY PROFILE                     │
│  ┌─────────────────────────────┐│
│  │ [头像] Ethan Carter         ││
│  │        Product Designer     ││
│  │ [Edit Profile]              ││
│  └─────────────────────────────┘│
│                                 │
│  MY HARDWARE                    │
│  ┌─────────────────────────────┐│
│  │  ● Connected 🔋85%          ││
│  │  [Configure Display]        ││
│  │  [Configure NFC]            ││
│  └─────────────────────────────┘│
│                                 │
│  MY AGENT                       │
│  [🎭 Voice & Knowledge  >]      │
│                                 │
│  ─────────────────────────────  │
│  [Settings]  [About]  [Logout]  │
└─────────────────────────────────┘
```

---

## 4. Phase 3: Unified Timeline（统一时间流）

> **核心目标**：完整实现 Unified Timeline 架构  
> **预期周期**：8-12 周  
> **改动范围**：大，完整重构

### 4.1 最终形态

参见 `bizcard-unified-timeline/UnifiedTimeline_AppInteraction_PRD.md`

关键特性：
- **Layer 1-4 完整实现**
- **Scope 模型**：Q/T/P/D 组合筛选
- **单页架构**：取消多 Tab，所有内容在一个流中
- **FAB Speed Dial**：录音/扫描/笔记三合一
- **完整的 Action 闭环**

---

## 5. 实施建议

### 5.1 Phase 1 详细排期（建议）

| 周 | 任务 | 产出 |
|----|------|------|
| W1-2 | Action Items 数据结构设计 + AI 提取逻辑 | 后端 API |
| W2-3 | Meeting 详情页改造 | 可测试版本 |
| W3-4 | Contact Activity 改造 | 可测试版本 |
| W4-5 | 首页 Action Hub 开发 | 可测试版本 |
| W5-6 | 首页 Profile 精简 + 集成测试 | Phase 1 发布 |

### 5.2 成功指标

**Phase 1 成功标准**：
- [ ] 用户进入首页能看到待办事项
- [ ] 用户能在 Meeting 详情中看到和管理 Actions
- [ ] Contact Activity 提供足够的上下文
- [ ] Action 完成率提升 20%

**整体目标**：
- 让 BizCard 从"名片管理工具"转变为"商务关系行动中枢"

---

## 6. 设计资源

以下是需要准备的设计资源：

### Phase 1 设计需求

1. **Action Hub 组件**
   - 折叠态样式
   - 展开态样式
   - 勾选交互动效
   - 空状态

2. **Meeting 详情页改造**
   - Action Items 区域样式
   - 添加 Action 交互
   - AI 提取 vs 手动添加的区分

3. **Contact Activity 改造**
   - 带摘要的 Meeting 卡片
   - Actions 预览样式

4. **首页 Profile 精简版**
   - 单行紧凑布局

---

## 7. 技术依赖

### 7.1 后端需求

- **Action Items API**
  - 创建/更新/删除 Action
  - Action 与 Meeting/Contact 的关联
  - Action 状态管理

- **AI 提取服务**
  - 从 Transcript 提取 Action Items
  - 支持用户纠错

### 7.2 前端需求

- **Action Hub 组件开发**
- **Meeting 详情页改造**
- **Contact 页面改造**

---

## 8. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| AI 提取 Actions 准确率不够 | 用户体验差 | 提供手动编辑入口，支持纠错 |
| Action Hub 位置影响首屏展示 | 用户不适应 | A/B 测试，渐进式上线 |
| 改动范围蔓延 | 周期拉长 | 严格控制 Phase 1 范围 |

---

## 附录：相关文档

- [Unified Timeline 完整 PRD](../bizcard-unified-timeline/UnifiedTimeline_AppInteraction_PRD.md)
- [Unified Timeline 产品方案](../bizcard-unified-timeline/intro.MD)
- [Demo 原型](../bizcard-unified-timeline/index.html)

---

*文档版本：v1.0*  
*创建日期：2026-01-19*  
*更新日期：2026-01-19*
