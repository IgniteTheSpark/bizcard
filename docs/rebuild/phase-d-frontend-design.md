# Phase D — Eureka 前端设计与实施 spec

> 版本:v1.0 | 2026-05-26
> 状态:定稿(brainstorm 完成,用户逐节确认)
> 配套:[phase-a 产品定义](phase-a-product-definition.md) · [phase-b 架构蓝图](phase-b-architecture-blueprint.md) · [runtime-flow 调用图谱](runtime-flow.md) · [design-system](design-system.md) · [design-tokens.css](design-tokens.css)

本文是 Phase D 前端实施的契约。Backend Phase C 已稳定运行(Flash / Chat / Task-skill / 4 个 MCP 接入 / render_spec-driven 卡片管线全部验证通过),Phase D 把前端从 `frontend-test/` 的单文件 QA 工具升级到生产级 SPA。

---

## 一、关键决策(brainstorm 锁定)

| # | 决策点 | 选择 | 备注 |
|---|---|---|---|
| 1 | MVP 切片形状 | 完整骨架 —— Shell + Chat + Library + Calendar + AssetDetail 同时起,每页先出最小可跳转的版本 | 不分批做单一页,要的是端到端可点 |
| 2 | 技术栈 | Vite 5 + React 18 + TypeScript strict + Tailwind 3 + SWR + React Router 6 | YAGNI:无 Redux / Zustand / Next.js / SSR |
| 3 | 代码位置 | 新建 `Eureka-BrandNew/frontend/`,保留 `frontend-test/` 作 backend 调试工具 | 两个面共存,各司其职 |
| 4 | 响应式 | Mobile-first,desktop 增强(`md:` 起 768px) | 跟硬件优先产品定位对齐 |
| 5 | 非一级实体「在 chat 里继续讨论」 | **回到创建它的那个 session**(用 `asset.session_id`) | 保持话题连续性 |
| 6 | Notification MVP 范围 | Toast(事件驱动)+ NotificationPage + 时间驱动提醒 | 文件相关随 file pipeline 后做 |
| 7 | AddSkillWizard MVP | 含 —— 端到端验证 design_agent backend | 这是 D2 核心愿景,必须跑通 |

---

## 二、技术栈与模块结构

### 栈选择

| 决策点 | 选择 | 理由 |
|---|---|---|
| Build / dev server | **Vite 5** | 启动毫秒级,HMR 干净 |
| 框架 | **React 18 + TypeScript strict** | 通用 |
| 样式 | **Tailwind 3** + `theme()` 桥接 design tokens | Tailwind config 把 `--eu-*` CSS vars 暴露为 `text-eu-purple` 等类 |
| 路由 | **React Router DOM 6** | 4 个顶层 page,移动 history 友好 |
| 服务端状态 | **SWR** | 轻量、hooks 原生 |
| 本地状态 | 组件 state + Context(只 3 个:PresentationMode / Toast / Drawer) | 无 Redux/Zustand |
| API 客户端 | `lib/api.ts` 手写 fetch 薄包装 | 后端 12 端点,生成 SDK 是过度工程 |
| SSE | 原生 EventSource + `lib/sse.ts` 重连封装 | chat / flash / notifications 三处用 |
| Icons | **lucide-react** | tree-shake 友好 |
| Lint / Format | ESLint + Prettier 默认 config | |
| 单测 | **Vitest + React Testing Library**,只测纯函数(render-spec / format) | 覆盖最有价值的部分 |
| E2E | **暂不做**,post-MVP | |

### 模块结构(`Eureka-BrandNew/frontend/src/`)

```
src/
├── main.tsx
├── App.tsx                       AppShell + 路由
├── styles/
│   ├── tokens.css                copy from docs/rebuild/design-tokens.css
│   └── globals.css               .theme-atmosphere class application
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   ├── TopBar.tsx            logo + 标题 + 3 icon (Device/Profile/Notification)
│   │   ├── TabBar.tsx            Chat / Calendar / Library 三 tab + 中间 FAB cutout
│   │   ├── DeviceMenu.tsx        MVP: 「未连接」placeholder
│   │   ├── ProfileMenu.tsx       含 PresentationMode 切换
│   │   ├── NotificationBell.tsx  红点 + popover 最近 5
│   │   ├── ModeSwitcher.tsx      Asset mode ⇄ Calendar mode
│   │   └── FlashFab.tsx          中间凸起 FAB → 全屏 sheet
│   ├── skill/
│   │   ├── SkillCard.tsx         render_spec 解释器
│   │   ├── GenericField.tsx
│   │   └── AddSkillWizard.tsx    4 步:描述 → 生成 → 预览 → 注册
│   ├── chat/
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── AssetCardInChat.tsx   用 SkillCard,点开 AssetDetailDrawer
│   │   ├── SessionSidebar.tsx    desktop 持久 240px / mobile 抽屉
│   │   └── PrecipitateButton.tsx 沉淀为资产菜单
│   ├── calendar/
│   │   ├── ScheduleView.tsx
│   │   ├── MonthGrid.tsx
│   │   ├── DayDetailSheet.tsx
│   │   └── EventEditor.tsx
│   ├── library/
│   │   ├── CategoryList.tsx      一级:8 行类型 + count + +号
│   │   ├── CategoryDetail.tsx    二级:某类型下所有 asset 列表
│   │   └── CreateAssetMenu.tsx   一级页面右上 + 按钮
│   ├── notification/
│   │   ├── NotificationPage.tsx
│   │   ├── NotificationItem.tsx
│   │   └── Toast.tsx
│   ├── asset/
│   │   └── AssetDetailDrawer.tsx mobile 底抽屉 / desktop 右抽屉
│   └── ui/                       Button, Input, Tag, Pill, Drawer, Sheet …
├── pages/
│   ├── ChatPage.tsx
│   ├── CalendarPage.tsx
│   ├── LibraryPage.tsx
│   └── NotificationPage.tsx
├── hooks/
│   ├── useChat.ts                SSE EventSource 封装
│   ├── useFlashCapture.ts        /api/flash
│   ├── useSkillRegistry.ts       /api/skills + SWR
│   ├── useAssets.ts              /api/assets + SWR
│   ├── useTasks.ts               /api/tasks + polling
│   ├── useNotifications.ts       拉历史 + SSE 订阅新增
│   ├── useSessionForEntity.ts    get-or-create session per file/contact/event
│   ├── useSessions.ts
│   └── usePresentationMode.ts    localStorage hook
├── lib/
│   ├── api.ts                    fetch 客户端 + 错误处理
│   ├── sse.ts                    EventSource 工具
│   ├── render-spec.ts            RenderSpec type + interpreter
│   ├── notification.ts           toast queue 管理
│   ├── format.ts                 _apply_format JS 镜像
│   └── types.ts                  API 响应类型
└── context/
    ├── PresentationModeContext.tsx
    ├── ToastContext.tsx
    └── DrawerContext.tsx
```

### 配套后端改动(在对应 milestone 一起做)

| 改动 | Milestone | 复杂度 |
|---|---|---|
| `sessions` 表加 `contact_id` / `file_id` 列 + alembic migration | M4 | 小 |
| `POST /api/sessions/for-entity { entity_type, entity_id }` | M4 | 小 |
| 验证 / 修复 `agents/design_agent.py` 端到端 | M5 | 不定 |
| `notifications` 表 + alembic migration | M6 | 中 |
| `api/notifications.py`(list / mark_read / dismiss / SSE stream) | M6 | 中 |
| Flash 完成 / Task 完成失败时 insert notification | M6 | 小 |
| `core/reminder_scheduler.py` (APScheduler 每分钟扫 todo/event) | M7 | 中 |

---

## 三、MVP scope by surface

### 0. AppShell

✅ TopBar(logo + 标题 + 3 icon:Device / Notification / Profile)
✅ ProfileMenu 内含 PresentationMode 切换(Asset mode ⇄ Calendar mode)
✅ **FloatingDock(悬浮 capsule,替代原 TabBar + FAB)**:
  - 今天(日历 icon 带当天日期)→ `/calendar`
  - 资产库(grid icon)→ `/library`
  - ── divider ──
  - 快创(+)→ CreateAssetMenu popover(M1 接入)
  - 闪念(mic)→ 全屏 sheet 输入 → /api/flash
  - ── divider ──
  - Agent(✨ 紫渐变 pill)→ `/chat`
  - **不带「当前页」高亮**(TopBar 已显示页名,dock 是纯快捷栏)
✅ React Router:`/chat` `/calendar` `/library` `/notifications`
❌ Settings 页(deferred,留 placeholder)
❌ DeviceMenu 真实连接逻辑(MVP 「未连接」placeholder)

> **v1.0 → v1.1 amendment(2026-05-26)**:原 spec 写的是「底部 TabBar(3 tab)+ 中间凸起 FAB」。M0 落地时发现 TabBar 形态视觉不够轻盈,且 grid 实现导致 tab 分布不均匀。用户决定改为**全局悬浮 dock**(5 元素 capsule),替换 TabBar + FAB,所有页面共享同一个 dock。Chat / Calendar / Library 不再是 tab,Chat 进入通过 Agent pill。

### 1. ChatPage

✅ SessionSidebar(Claude 风,desktop 持久 / mobile 滑出)
✅ Session 点击切换 + replay 历史(`/api/sessions/:id/messages`)
✅ "新建对话" 按钮
✅ SSE 流:token / tool_call / tool_result / done
✅ 历史 cards 内联渲染(SkillCard / EventCard / TaskCard)
✅ cards 全可点 → AssetDetailDrawer
✅ "沉淀为资产" 按钮 hover 出现
❌ Multi-session 标签页式(deferred)
❌ 语音输入(硬件做)
❌ Chat 内 inline EventEditor(创建 event 走 agent tool_call)

### 2. CalendarPage

✅ Schedule 视图(消费 `/api/timeline`)
✅ Month 视图(网格 + 当日点)
✅ DayDetail sheet(点天 → 半屏)
✅ EventEditor 表单 modal(从任何地方拉起 → POST `/api/events`)
❌ Year 视图(deferred)
❌ 拖拽改时间(deferred)
❌ recurrence_rule UI(数据库字段在,UI 后做)

### 3. LibraryPage

✅ CategoryList(一级:8 行类型 + count + icon + +号按钮)—— 类型: todo / event / idea / notes / contact / misc / expense / file
✅ + 按钮 → CreateAssetMenu(下拉选 skill type)
✅ 点类型 → CategoryDetail(二级:该类型所有 asset,SkillCard,按 created_at 倒序)
✅ 二级点 card → AssetDetailDrawer
✅ AddSkillWizard 入口(底部「+ 添加新技能」)
❌ 搜索 / 过滤 / 排序(deferred)
❌ 批量操作(deferred)

### 4. AssetDetailDrawer

✅ Mobile 底抽屉 / desktop 右抽屉
✅ payload 全字段(GenericField)
✅ SessionTurnCard(来源 session + input_turn)
✅ 编辑 / 删除
✅ 「在 chat 里继续讨论」按钮 → 路由分支:
  - file / contact / event(一级实体) → per-entity 持久 session(`useSessionForEntity`)
  - 其他 → 跳到 `asset.session_id`(创建它的那个 session)
❌ Revision history(deferred)

### 5. NotificationPage + Toast

✅ Toast(事件驱动):flash 完成 / task 完成 / task 失败
✅ NotificationPage 历史列表(`/notifications`)
✅ NotificationBell 红点 + popover
✅ 时间驱动提醒:todo 到期前 / event 开始前 1h/30m/15m
❌ 文件相关通知(随 file pipeline)
❌ Web Push API / 邮件 / 短信

### 横向

✅ Toast 队列(同时 3 条 FIFO)
✅ Task 卡片状态轮询(移植自 frontend-test)
✅ 错误降级:网络失败 toast / SSE 断线自动重连
❌ 离线缓存 / PWA
❌ 国际化(中文 only)

---

## 四、Milestones(M0–M7)

每个 milestone 结束 = 一次可演示 + 1 个 commit + tag `phase-d/mN`。

| M | 内容 | 估时 | 后端改动 | "能给你看什么" |
|---|---|---|---|---|
| **M0** Foundation | Vite 项目 + tokens 桥接 + 路由 + AppShell + TabBar + FAB + lib 骨架 | 1 d | 无 | 4 个 tab 能切,FAB 弹出 sheet,零真实数据 |
| **M1** SkillCard + Library | render-spec interpreter + SkillCard + CategoryList + CategoryDetail + AssetDetailDrawer 只读 + CreateAssetMenu UI | 1.5–2 d | 无 | 真实数据 8 类资产渲染,点开看详情 |
| **M2** Chat + Flash | useChat / useFlashCapture + MessageList + SessionSidebar + history replay + cards-in-chat + 沉淀 + FAB 联通 | 2–2.5 d | 无 | 聊天 / 闪念跑通,session 历史能切 |
| **M3** Calendar + EventEditor | ScheduleView + MonthGrid + DayDetailSheet + EventEditor + 联通 `/api/events` | 1.5 d | 无 | 日历 + 建 event 都能用 |
| **M4** AssetDetail 编辑 + per-entity session | migration `0003_session_entity_anchor.py` + `POST /api/sessions/for-entity` + useSessionForEntity + drawer 加 edit/delete + 跳 chat 按钮路由 | 1.5 d | sessions 表 + 1 端点 | 任何 asset 都能跳进对话 |
| **M5** AddSkillWizard | 验证 / 修 design_agent + Wizard 4 步 UI + 注册联通 | 1.5 d | design_agent 验证 | 用户说「记录每天跑步」→ 自动生成 skill |
| **M6** Notification toast + page | migration `0004_notifications` + notifications API + SSE push + ToastContext + NotificationBell + NotificationPage | 1 d | notifications 表 + API | toast 浮出,通知页有历史 |
| **M7** 时间驱动提醒 | core/reminder_scheduler.py(APScheduler) + 扫 todo/event 触发 | 1.5–2 d | scheduler | todo 到期前提醒触发 |

**总计**:11.5–13 天

---

## 五、Git / 交付规则

- branch:新建 `phase-d`(从 main)
- 每个 milestone = 1 个 commit(可含若干小 commit,milestone 边界打 tag `phase-d/m0` … `phase-d/m7`)
- 每个 milestone 结束:push + demo notes(跑通什么 / 已知遗留 / 下一个起手)+ 用户 OK 再起下一个
- M7 完成 → merge phase-d → main

---

## 六、显式 out-of-scope(Phase D 之后)

- 多用户鉴权 / Sign-in flow(目前 `get_current_user_id()` 返回常量 'default')
- 文件 pipeline(上传 + ASR + AI 分析)
- 实时协作 / multi-device 同步
- 离线模式 / PWA
- 国际化
- 暗 / 亮主题切换(MVP 只 .theme-atmosphere 一套)
- 移动端原生 wrapper(Capacitor / React Native)
- 性能埋点 / Analytics
- A/B framework
- Settings 全部页面

---

## 七、变更管理

- Phase D 实施中如发现 spec 错(后端 API 跟前端假设不符 / 设计漏洞 / 估时严重偏差),**立刻停 milestone,在 chat 沟通,更新本 spec,重启**
- 用户随时可以加 / 删 / 换 milestone,我会重新算 timeline
- M7 完成后这份 spec 进入 archived 状态,后续 Phase D Polish 另起新 spec
