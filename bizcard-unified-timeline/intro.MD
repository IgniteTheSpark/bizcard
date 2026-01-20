这份文档基于我们所有深度的讨论，将 **BizCard 2.0** 从战略定位到 UI/UX 细节进行了系统化的梳理。

这是一份可以直接作为 **PRD（产品需求文档）核心框架** 或 **内部立项演示** 的方案书。

---

# BizCard 2.0 Product Solution Document

**Project Codename:** The AI Relationship Terminal
**Core Philosophy:** From "File Management" to "Action Management".

---

## 1. 战略定位与差异化 (Strategic Positioning)

我们不与 Plaud 卷“录音质量”或“思维导图”，我们卷“业务闭环”。

| 维度 | Plaud (Competitor) | **BizCard 2.0 (Us)** |
| --- | --- | --- |
| **核心隐喻** | **录音笔 (Recorder)** | **智能中枢 (Terminal)** |
| **数据单元** | **File (文件)**: 孤立的 MP3 | **Entity (实体)**: 挂载在人身上的资产 |
| **交互流向** | **Inward**: 发给自己存档 | **Outward**: 发给客户成交 |
| **UI 模式** | **List**: 文件夹列表 | **Stream**: 统一时间流 (Unified Timeline) |
| **杀手级场景** | 会议回顾、课程记录 | **现场反查、待办执行、客户跟进** |

---

## 2. APP 核心架构：The Unified Timeline (统一时间流)

App 摒弃底部的多 Tab 结构，采用 **“单页无限流”** 架构。
**设计隐喻：** 商务版的朋友圈 (Social Feed for Business)。

### 2.1 UI 布局层级 (The 4-Layer Layout)

界面从上到下分为四个层级：

#### **Layer 1: Global Control (全局控制层)**

* **位置:** 顶部常驻。
* **Left: Avatar (头像)**
* 带连接状态指示（绿色呼吸灯）。
* 点击展开 **左侧抽屉 (Settings Drawer)**。


* **Center: Search & Filter Bar (搜索/筛选栏)**
* **Search:** 输入关键词搜人、搜事。
* **Filter Trigger:** 点击图标展开筛选胶囊：`All` | `Meetings` | `Agent Calls` | `Date`。


* **Right: Share (分享)**
* 二维码图标，点击展示我的名片码（供他人扫描）。



#### **Layer 2: Context Header (语境头图 - 动态显示)**

* **定位:** 连接“流”与“资料”的桥梁。
* **逻辑:** 默认隐藏，仅当筛选生效时出现。
* **状态 A (筛选了某人 - e.g., Kevin):**
* 展示 Kevin 的 Mini Profile (头像 + Title)。
* 交互：点击展开 **全屏 Profile 详情页** (查看 Email, LinkedIn 等静态资料)。


* **状态 B (筛选了某类 - e.g., Meetings):**
* 展示类型图标 + "Viewing all meetings" + 清除按钮 `(x)`。



#### **Layer 3: Action Hub (行动中枢 - 吸顶)**

* **定位:** 核心任务板，随筛选条件动态变化。
* **交互:** 向下滑动 Timeline 时，此栏 **吸顶 (Sticky)**。
* **内容:**
* **Global Mode:** 显示所有人的待办 (`5 Pending Actions`).
* **Filtered Mode (e.g., Kevin):** 只显示与 Kevin 相关的待办 (`2 Actions with Kevin`).


* **形态:** 可折叠的通知条。展开后是 Checklist，勾选即完成。

#### **Layer 4: The Stream (垂直时间流)**

* **定位:** 内容消费区。
* **交互:** 纵向滚动 (Vertical Scroll)，懒加载。
* **卡片类型:**
* **Meeting Card:** 摘要 + 关键 Tag + 来源。
* **Call Card:** Agent 通话记录 + 留言。
* **Action Log:** 已完成任务的记录 (e.g., "Sent email to Kevin").



---

## 3. 关键功能模块设计 (Feature Specifications)

### 3.1 采集与输入 (The FAB - Right Bottom)

屏幕右下角的悬浮按钮，负责所有 **Input**。
采用 **Speed Dial (扇形展开)** 模式：

1. **Main Button:** 🎙️ **Voice (录音/语音笔记)** - *最顺手的位置，点击即录。*
2. **Sub Button 1:** 📷 **Scan (扫名片)** - *OCR 识别名片并存入流。*
3. **Sub Button 2:** 📝 **Note (记文本)** - *快速记录闪念。*

### 3.2 左侧抽屉 (Settings Drawer)

点击左上角头像滑出，管理低频配置。

* **My Identity:** 编辑个人名片信息 (Name, Bio, Social Links)。
* **My Hardware:**
* **Reverse Display:** 配置 E-ink 屏显内容（名片 or Slogan）。
* **NFC Action:** 配置碰一碰的跳转链接 (Profile or BP)。


* **My Agent:** 配置 AI 接听助理的音色和知识库。

### 3.3 详情页改造 (The "Action-First" Refactor)

#### **Contact Detail (通过 Layer 2 点击进入)**

* **Zone A (Top): Pending Actions**
* 置顶展示“我欠他什么”。
* UI: Checklist 列表。


* **Zone B (Bottom): History Timeline**
* 倒序展示所有交互记录。



#### **Meeting Detail (点击流中的卡片进入)**

* **Top Module:** **Extracted Actions**
* 从大段文字中抽离出的 Checkbox 列表。
* 支持设置 Due Date。


* **Bottom Module:** **Summary & Transcript**
* 默认折叠 Transcript，只展示 AI 总结。



---

## 4. 硬件协同逻辑 (Hardware Synergy)

硬件不仅仅是麦克风，它是 App 的 **"Second Display" (第二屏)**。

1. **Reverse Display (反向显示 - 杀手级功能):**
* **操作:** 按住硬件按钮问：“Kevin 上次说了什么？”
* **流程:** 语音上传 -> App 检索 Timeline -> **文字回传硬件**。
* **结果:** E-ink 屏显示：`[Result] 关注 RWA 合规性。`


2. **Live Copilot (现场辅助):**
* App 开启“会议模式”，硬件屏幕实时刷新 Key Points 或翻译字幕。



---

## 5. MVP 迭代路径 (Roadmap)

为了控制成本并快速验证，建议分两步走：

### Phase 1: The "Action Loop" (改造现有 App)

* **目标:** 不重写首页架构，先打通“录音-待办-人”的闭环。
* **P0 任务:**
1. **Meeting页:** 解析 AI 结果，把 Action Items 单独渲染成 Top Checklist。
2. **Contact页:** 引入 Top-Heavy 布局，置顶展示 Action Items。
3. **Link Flow:** 优化录音结束后的“关联联系人”弹窗，增加 AI 排序推荐。



### Phase 2: The "Unified Stream" (重构首页)

* **目标:** 上线“单页流”架构，替换掉旧的列表页。
* **P0 任务:**
1. 实现 **Layer 1-4** 的 UI 框架。
2. 实现 **Sticky Header (吸顶 Action Hub)**。
3. 实现 **Filter Logic (筛选联动)**。
4. 开发 **Left Drawer** 和 **FAB** 交互。



---

## 6. 交互视觉草图 (Wireframe Description)

```text
[🟢 Avatar] [ 🔍 Search / Jan 15 / Filter ] [🕸️ QR]
----------------------------------------------------
[ 🔴 3 Actions Pending (Global)        (Collapse ^)]
----------------------------------------------------
[ Today                                            ]
[  ---------------------------------------------   ]
[  | Meeting Summary                           |   ]
[  | "Product Design Sync"                     |   ]
[  | 关联: Kevin, Alice                        |   ]
[  | [ ] UI Design (Action)                    |   ]
[  ---------------------------------------------   ]
[                                                  ]
[  ---------------------------------------------   ]
[  | Agent Call                                |   ]
[  | "Incoming call from 138xxxx"              |   ]
[  | 留言: "Call me back asap."                |   ]
[  ---------------------------------------------   ]
[                                                  ]
[                                      ( 🎙️ FAB ) ]

```

这套方案不仅逻辑自洽，而且在工程实现上使用了成熟的组件（列表、吸顶、抽屉、FAB），是一个既有**“高级感”**又**“可落地”**的产品形态。

---

## 附：可落地交互 PRD（研发/设计对齐用）

- **Unified Timeline App 交互 PRD（可落地版）**：`bizcard-unified-timeline/UnifiedTimeline_AppInteraction_PRD.md`