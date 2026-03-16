# BizCard 3.0 Calendar General Spec

## 1. 文档目的

本文件用于沉淀 BizCard 3.0 日历能力的通用规则，作为 Option1（独立日历页）与 Option2（首页 Tab 内日历）的统一基线。

目标是回答三件事：

- 日历模块展示什么内容
- 用户如何与日历进行交互
- 不同状态下系统如何反馈

## 2. 适用范围

- `Option1`：由首页 Top Bar 进入独立日历页
- `Option2`：首页主区域通过 `Notes / Calendar` Tab 切换

两者共享同一套日历交互与内容规则；仅入口位置不同。

## 3. 内容模型

### 3.1 内容边界

- 日历模块仅展示 `Reminders`
- 不在日历中展示 `Notes` 卡片

### 3.2 Reminder 字段（最小集）

- `id`
- `date`（`YYYY-MM-DD`）
- `time`（`HH:mm`）
- `title`
- `source`（来源会话/笔记）
- `done`（`true/false`）

### 3.3 排序规则

- **Calendar 模式（日视图列表）**
  - 未完成：按时间升序
  - 已完成：按时间升序，放入底部 `Done` 折叠区
- **Timeline 模式**
  - 未完成：按日期从未来到过去，日期内按时间升序
  - 已完成：独立折叠区展示

## 4. 信息架构

### 4.1 顶部工具区

- 左侧：当前月（如 `May 2026`），点击打开 datepicker
- 右侧：模式切换（Calendar / Timeline）+ 全局 `+`

### 4.4 首页 Top Bar（与日历入口相关）

为避免 onboarding 依赖头像/姓名，同时保持硬件叙事一致，首页 Top Bar 采用以下统一结构：

- 左侧：`Hardware` 状态胶囊（icon + 文案 + 状态点）
- 右侧：`Calendar` 圆按钮 + `Account(E)` 圆按钮
- `Account` 按钮右下叠加齿轮角标（强化 Settings 心智）

说明：

- 不在 Top Bar 中央放品牌 logo，避免与核心导航争夺注意力
- `Option1` 中点击 `Calendar` 进入独立日历页
- `Option2` 中点击 `Calendar` 切换到 Calendar Tab

### 4.2 Calendar 模式结构

- `7日周导航`（横向滑动）
- 当天未完成 reminders 列表
- 列表底部 `Done (n)` 折叠区（当天已完成）

### 4.3 Timeline 模式结构

- 顶部右侧：`Done (n)` 控制按钮（与长列表并行，避免难以触达）
- 主体：按日期分组的未完成 reminders（未来 -> 过去）
- 已完成 reminders：折叠区展开后查看

## 5. 核心交互

### 5.1 周导航（7日）

- 默认展示包含当前选中日期的一周
- 支持横向滑动切换周
- 点击某一天：
  - 更新选中态
  - 更新顶部月份（跨月时）
  - 刷新当日列表与当日 `Done` 计数

### 5.2 Date Picker（两级）

- 第 1 层（默认展开）：当前月日期网格（可直接选日）
- 第 2 层（按需展开）：月份选择（点击年月行展开）

交互规则：

- 点击顶部月份：打开 datepicker，并默认展示当月日期网格
- 点击月份下拉行：展开月份选择
- 选择月份：刷新为该月日期网格，不立即关闭弹层
- 选择具体日期：关闭弹层，更新周导航与列表

### 5.3 模式切换

- `Calendar -> Timeline`
  - 保留当前选中日期状态
  - 显示 timeline 数据结构（未完成分组 + Done 折叠）
- `Timeline -> Calendar`
  - 回到当前选中日期对应的日列表
  - 当日 `Done` 区默认收起

### 5.4 Add 入口

- 日历域内仅保留一个全局 `+` 入口
- `+` 打开统一 Add Sheet（`Add Reminder` / `Upload Audio`）
- 可根据上下文高亮推荐项，但不新增额外入口按钮

## 6. Done 交互规范

### 6.1 Calendar 模式（按天）

- 每天列表底部固定有 `Done (n)` 折叠入口
- 默认收起
- 展开后展示当天已完成 reminders

### 6.2 Timeline 模式（全局）

- `Done (n)` 放在右上操作区
- 不放在长列表底部，避免可达性问题
- 默认关闭 `Done` 筛选，仅展示未完成 reminders 的日期分组
- 打开 `Done` 后，将已完成 reminders 合并到对应日期分组中展示（非独立底部列表）
- 因此当某日无未完成且 `Done` 关闭时，该日期不展示；示例：`May7` 有、`May6` 无、`May5` 有，则展示 `May7 -> May5`

## 7. 状态与反馈

### 7.1 空状态

- 当天无未完成：显示 `No pending reminders for this date.`
- 当天无已完成：展开 `Done` 后显示 `No done reminders for this date.`
- Timeline 无未完成：显示 `No pending reminders.`

### 7.2 选中态

- 周导航选中日期必须具备明确高对比样式
- 有 reminder 的日期可显示提示点

### 7.3 动效与节奏

- 切换/展开时长建议：`180ms - 260ms`
- 优先使用 `opacity / transform` 实现过渡
- 折叠展开应保证列表滚动位置稳定

## 8. 一致性要求（Option1 / Option2）

- 内容边界一致：仅 Reminders
- 交互路径一致：周导航、datepicker、模式切换、Done 折叠
- 新增入口策略一致：单一 `+`
- 文案与空态一致，降低认知成本

## 9. 后续可扩展点（非当前必做）

- `Today` 快速回跳
- 日期拖拽快速切周
- Done 区支持按来源二级分组
- Add Sheet 支持最近动作记忆

aa