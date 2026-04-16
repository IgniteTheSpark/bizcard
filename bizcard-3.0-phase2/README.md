# BizCard 3.0 — Phase 2 文档

本目录为 **用户资产结构、Note、`tag`、挂载与多模态摘要** 的说明。

| 文档 | 内容 |
|------|------|
| [ASSET_MODEL_AND_RELATIONS.md](./ASSET_MODEL_AND_RELATIONS.md) | 实体与关联图；**软关联** 原则；**Event ↔ File（n..m）**；**第一阶段** **一 Note 一主文件**（多选则多条 Note）；Agent 生成（含 briefing）沿用同一挂载规则；**§5** 为后续单 Note 多挂载融合 |
| [PRD_ASSET_MODEL_PHASE2.md](./PRD_ASSET_MODEL_PHASE2.md) | 结构化 PRD：资产模型、Event 字段、同步策略、联系人兜底与范围定义 |
| [PRD_CALENDAR_EVENT_DETAIL_AND_CREATE.md](./PRD_CALENDAR_EVENT_DETAIL_AND_CREATE.md) | 交互 PRD：**Event**（新建/详情/四 Tab/`+`/Agent）→ **日历主视图**（单日/日程）→ **侧边栏**；统一 `+` 与附件同源 |
| [PRD_CALENDAR_INTEGRATION_ENTRY_AND_MANAGEMENT.md](./PRD_CALENDAR_INTEGRATION_ENTRY_AND_MANAGEMENT.md) | 独立 PRD：第三方日历 **侧边栏订阅管理**（添加页、重新同步/取消订阅）；**Onboarding 另迭代** |
| [PRD_CALENDAR_NOTIFICATION_AND_RECORDING_TRIGGER.md](./PRD_CALENDAR_NOTIFICATION_AND_RECORDING_TRIGGER.md) | 独立 PRD：Calendar 通知触发与录音联动（来源无差别、点击通知快捷录音、失败报错、超时确认） |
| [PRD_CONTEXT_CONTAINER_DETAIL_PAGE.md](./PRD_CONTEXT_CONTAINER_DETAIL_PAGE.md) | 独立 PRD：`work_id` 归档模型与 5 类详情页（work/reminder/event/contact/note），含 source 展示与关联隔离规则 |
| [APP_INTERACTIVE_DEMO_PHASE2.html](./APP_INTERACTIVE_DEMO_PHASE2.html) | 可交互演示：Calendar 最终交互（右上单入口、冲突横向切分、周级收敛、未来无限滚动）与 Event 详情流程 |
| [context-container-demo.html](./context-container-demo.html) | 可交互演示：Work Detail 与资产详情（work/reminder/event/contact/note，统一 主体/来源/关联） |
