# BizCard 3.0 首页方案2 PRD（Tab Workspace）

## 1. 方案定义

- 首页主区域通过一级 Tab 切换：
  - `Notes`
  - `Calendar`
- Notes 与 Calendar 在同一工作区内并列，减少跨页面跳转。
- 目标：在保持首页聚合能力的前提下，提高“记录/按日期回看”的切换效率。

## 2. 适用场景

- 用户已形成稳定使用习惯，需要高频在 Notes 与 Calendar 间切换。
- 希望在一个页面内完成内容浏览与日期回看，减少导航成本。
- 中高阶用户比例上升时更适配。

## 3. 信息架构

1. Top Bar：
   - 左侧：硬件状态胶囊（Connected/Disconnected）
   - 右侧：`Calendar` 圆按钮 + `Account(E)` 圆按钮（右下叠加齿轮角标，表示 Settings）
   - 点击 `Calendar` 圆按钮可直接切到 Calendar Tab
2. 主区域头部：
   - 一级 Tab：`Notes / Calendar`
   - `+` 新增按钮（全局唯一入口）
3. 主区域内容：
   - Notes Tab：
     - 文件夹/筛选入口：当前视图（全部/未分类/某文件夹/回收站）及排序（详见 `NOTES_FOLDERS_SPEC.md`）；形态可为下拉或侧边栏。
     - 二级筛选 `All / Meeting / Memo`
     - 分组 `这周 / 更早`
     - 文件夹创建/编辑/删除；左滑 Note 进入多选，支持批量移动到文件夹、删除等（详见 `NOTES_FOLDERS_SPEC.md`）。
   - Calendar Tab：
     - 顶部 `7日周导航`（按当前日期定位，支持横向滑动切周）
     - 右上支持 `Calendar / Timeline` 模式切换
     - 点击 `May 2026` 打开 datepicker（默认当月日期网格）
     - 点击 datepicker 年月下拉展开月份选择
     - 内容仅展示 `Reminders`（不展示 Notes）
     - Calendar 模式：每日列表底部 `Done (n)` 折叠区（当天 done）
     - Timeline 模式：右上 `Done (n)` 作为筛选开关
4. 底部高频动作：
   - `Add note`
   - `Ask me anything`

## 4. 关键交互

- Tab 切换：
  - Notes 激活时显示筛选条；
  - Calendar 激活时隐藏 Notes 二级筛选。
- `+` 点击弹出两选项：
  - `Add Reminder`
  - `Upload Audio`
- `+` 在 Notes/Calendar 间保持单一入口，不在 Calendar 内再提供额外 add 按钮。
- 底部按钮点击采用“一体式展开过渡”后跳转：
  - Add note -> `capture-demo.html`
  - Ask me anything -> `ask-agent-demo.html`
- Notes 文件夹与多选：与 Option1 一致，见 `NOTES_FOLDERS_SPEC.md`（文件夹 CRUD、左滑多选、批量操作、筛选/文件夹入口）。
- Calendar / Timeline 模式：
  - Calendar 模式：点击日期后展示该日期 reminders，底部 `Done (n)` 展开当天 done；
  - Timeline 模式：按日期分组，默认展示从未来到过去的未完成 reminders；
  - Timeline 开启 `Done` 后，将 done 合并到对应日期分组中展示；
  - 当某日无未完成且 `Done` 关闭时，该日期不展示。

## 5. 视觉与交互原则

- 层级分离：
  - 一级：Notes / Calendar（大标题级）
  - 二级：All / Meeting / Memo（筛选级）
- 保持空间连续：Tab 切换动效需轻量，避免页面抖动。
- 一致性：图标、阴影、圆角、交互动效统一在同一设计系统内。
- 触控友好：Tab 与筛选按钮最小点击区域 >= 44px。

## 6. 验收标准

- 主区域可在 Notes / Calendar Tab 间切换。
- Notes 筛选仅在 Notes Tab 显示。
- Calendar Tab 不出现 Notes 筛选条。
- `+` 弹层含 `Add Reminder` 与 `Upload Audio`。
- `+` 为单一新增入口，Calendar 内无重复 add 按钮。
- 底部按钮可触发展开过渡并跳转目标页面。
- Calendar Tab 默认进入月历视图且仅展示 reminders。
- Calendar Tab 支持：7日周导航横滑、两级 datepicker、`Calendar / Timeline` 切换、日期分组与 Done 交互。
- Notes 文件夹与多选：文件夹可创建/编辑/删除；左滑进入多选；首页提供文件夹/筛选入口（见 `NOTES_FOLDERS_SPEC.md`）。

## 7. 相关文档

- **Notes 文件夹与多选**：`NOTES_FOLDERS_SPEC.md`。
