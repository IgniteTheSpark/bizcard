# Ask Agent (App) 产品需求文档（APP PRD）

**版本**：v0.2  
**状态**：草案（按 UI 定稿与资产模型 Phase2 调整）  
**关联**：
- [DISPLAY_AND_CONTRACT.md](./DISPLAY_AND_CONTRACT.md)（展示与契约细节）
- [MCP_PRD.md](./MCP_PRD.md)（Agent MCP Tools 与逻辑架构说明）
- [LOCAL_OPENCLAW_AND_CLOUD_MODES.md](./LOCAL_OPENCLAW_AND_CLOUD_MODES.md)（本地 OpenClaw 与云端模型双模式）
- [PRD_ASSET_MODEL_PHASE2.md](../bizcard-3.0-phase2/PRD_ASSET_MODEL_PHASE2.md)（资产模型与关系约束）

---

## 一、概述与目标

### 1.1 产品背景

在 MeCard App 内提供 **Ask Agent** 能力：用户通过自然语言提问，Agent 基于用户资产数据与全局 memory 进行回答，并以**文本 + 资产卡片（Related Citations）**输出，支持继续追问与跳转到对应详情。

### 1.2 核心目标（本次修订口径）

- **入口与会话**：支持 General 与 Context-based 双入口，且 Chat history 按入口范围隔离（Global=当次进程；Context=该实体范围）。
- **交互样式对齐 UI**：汉堡菜单从**右侧抽屉**打开；新增统一报错提醒；对话中仅保留单一“思考中”状态。
- **资产卡片对齐 Phase2**：卡片能力以统一资产模型为准，展示层按 UI 采用 `Related Citations` 卡片区。

### 1.3 目标用户

- 使用 MeCard 管理联系人、会议/事件、提醒等信息的用户。
- 需要快速查询、深度分析、以及对现有数据做增删改的用户。

---

## 二、页面与入口口径

### 2.1 Ask Agent 主页面（UI 口径）

- 默认进入新对话态：顶部标题 + 主输入框 + 建议提问 hint。
- 顶部汉堡按钮点击后，**从右侧打开 Chat history 抽屉**（不是左侧）。
- 历史抽屉顶部提供 `New Conversation`，并按时间分组展示 threads。

### 2.2 聊天页信息结构

每条 Agent 回复由两层构成：
1. **正文层（text / markdown）**：回答用户问题的核心内容。
2. **引用层（Related Citations）**：下方卡片容器，展示相关资产卡片，支持跳转详情。

### 2.3 Chat history 范围规则（统一口径）

- **Global 入口**：展示当次 App 进程内的 global threads（v1 可不跨重启持久化）。
- **Context-based 入口**：仅展示该 context（meeting/contact/reminder）下的 threads。
- Thread 内多轮上下文独立；所有 thread 共享用户级全局 memory。

### 2.4 Context-based 统一入口（全局悬浮 Toolbar）

Context-based 不再按页面单独设计入口，统一使用底部悬浮三键 Toolbar：
- 左：`Add note`（开启录音）
- 中：`Ask Agent`
- 右：`+`（添加内容）

规则：
- 该 Toolbar 在需要 context 的详情页统一展示（meeting/contact/reminder 等）。
- 点击 `Ask Agent` 进入对应 context 会话，自动注入 `scope + scope_id`。
- `+` 的弹窗选项随 context 变化，统一在独立文档定义：`../bizcard-3.0/CONTEXT_PLUS_MENU_SPEC.md`。
- `+` 的规则按三类场景管理：`global / 详情类 / 列表类`。
- 「添加参会人」需区分语义：在 `note` 是绑定联系人；在 `event` 是补充 attendee 并触发联系人匹配。

---

## 三、功能需求

### 3.1 双入口与线程模型

| 入口 | 位置 | 默认状态 | Chat history 范围 |
|------|------|----------|-------------------|
| General | 顶部 Ask Agent 入口 | 新对话 + 通用 hint | 当次进程内 global threads |
| Context-based | 全局悬浮 Toolbar 中间键（Ask Agent） | 新对话或该 context 最近 thread | 当前 context threads |

- 线程标识建议：`ask_agent:{scope}:{scope_id}:{thread_id}`
- `scope` 可取：`global / meeting / contact / reminder`
- 与 `scope` 对应的 `+` 菜单动作见 `CONTEXT_PLUS_MENU_SPEC.md`，避免入口与新增行为脱节。

### 3.2 三类意图与呈现

| 场景 | 用户意图 | 呈现要点 |
|------|----------|----------|
| 查 | 基础信息查询 | `text` 直接给答案，必要时挂载相关 citations 卡片 |
| 深入沟通 | 分析、总结、建议 | `text` 为主（可含 Markdown 结构化内容），按需附卡片 |
| 增删改 | 修改联系人/提醒/事件信息 | `text` 先反馈动作结果，再展示变更后相关卡片 |

### 3.3 响应契约（Text + Citations）

根据 UI 定稿，前端最终渲染结构为：

```json
{
  "text": "Here is the contact information for Kevin that we found for you...",
  "citations": [
    {
      "asset_type": "contact",
      "asset_id": "c_123",
      "title": "Kevin Chen",
      "subtitle": "PM",
      "meta": "@ Acme Corp",
      "action": {
        "type": "open_detail",
        "target": "contact_detail"
      }
    },
    {
      "asset_type": "event",
      "asset_id": "e_456",
      "title": "Product Design Sync",
      "meta": "Jan 26 16:26"
    }
  ]
}
```

字段规范：
- `text`：主回答内容，支持 Markdown。
- `citations`：引用资产数组，用于渲染 `Related Citations` 卡片区。
- `asset_type`：对齐资产模型，使用 `contact / event / reminder / note / file`。
- UI 可继续沿用业务文案（如 meeting），但数据层统一映射到 `event`。

### 3.4 资产卡片规范（对齐 Phase2）

依据 `PRD_ASSET_MODEL_PHASE2.md`，Ask Agent 侧卡片遵循统一资产模型：

| 资产类型 | 对应实体 | v1 展示要求 |
|----------|----------|-------------|
| `contact` | Contact | 姓名、职位/公司、头像（可选） |
| `event` | Event（会议语义可映射为 event） | 标题、时间、参与信息摘要 |
| `reminder` | Reminder | 标题、日期时间、完成状态 |
| `note` | Note | 标题、摘要片段（按需） |
| `file` | File（本期主要 audio） | 文件名、类型、处理状态（按需） |

实现要求：
- 视觉样式以设计稿为准（卡片圆角、阴影、层级、间距、图标规范）。
- 当回复中有多卡片时，容器支持横向滑动。
- 上下文防冗余：若当前就在某实体详情页，默认不重复输出该实体卡片，只输出关联实体卡片。

### 3.5 思考态展示（简化版）

根据最新 UI，对话中仅保留单一思考态：

- 状态文案：`正在思考中...`
- 与状态同时可展示“思考小字”（简短推理过程摘要）。
- 思考小字默认可见，支持用户手动收起/展开。
- 最终答案返回后，思考态结束并渲染 `text + citations`。

### 3.6 报错与弱网提示（新增）

新增统一错误提示规范：

- **网络异常**：在消息区内联展示 `Please check your network and try again`（文案可多语言）。
- **展示位置**：保留用户原问题气泡，错误提示显示在其下方，不弹系统级打断弹窗。
- **可恢复**：用户可直接重试同一问题，或继续输入新问题。
- **错误卡片不出**：错误场景不展示 citations 区，避免误导。

---

## 四、阶段拆分

### 4.1 第一阶段：页面 + 对话展示 + 多入口

| 范围 | 说明 |
|------|------|
| Ask Agent 页面 | 新对话态、右侧 history 抽屉、线程切换、hint |
| 对话展示 | `text + citations`，优先支持 `contact/event/reminder` 卡片 |
| 状态与异常 | 单一“正在思考中”+ 可收起思考小字 + 弱网报错提示 |
| 多入口接入 | 顶部 Ask 入口 + context 统一悬浮 Toolbar 的 Ask 键 |

交付口径：用户从任一入口发起提问后，能看到标准化分析流程、得到结构化回复，并可通过 citations 跳转详情。

### 4.2 第二阶段：能力扩展

- 发邮件等需要对外通道与授权的能力（依赖邮箱配置）。
- 扩展 `note/file` 卡片在更多场景的自动挂载。
- 增加更多快捷 block（如 quick reply）与高阶操作流。

---

## 五、非功能需求

- **性能**：打开右侧 history 抽屉、切线程、加载历史消息保持可接受时延。
- **稳定性**：弱网/超时场景可恢复，不导致页面阻塞。
- **无障碍**：状态文案、错误提示、卡片操作均需可被读屏识别。

---

## 六、验收标准（第一阶段）

- [ ] Ask Agent 默认进入新对话态；汉堡菜单从**右侧**打开 Chat history 抽屉。
- [ ] Chat history 范围正确：Global 为当次进程；Context 为当前实体范围。
- [ ] 回复展示遵循 `text + citations`，且支持 `contact/event/reminder` 卡片跳转。
- [ ] 资产类型字段与 `PRD_ASSET_MODEL_PHASE2` 对齐（至少 `contact/event/reminder`）。
- [ ] 提问后展示单一 `正在思考中...` 状态，且思考小字可收起/展开。
- [ ] 网络异常时展示内联错误提示，不破坏当前消息流，支持重试。

---

## 七、参考

- 展示与契约细节见 [DISPLAY_AND_CONTRACT.md](./DISPLAY_AND_CONTRACT.md)。
- Agent 架构见 [AGENT_ARCHITECTURE.md](../AGENT_ARCHITECTURE.md)。
- 资产模型口径见 [PRD_ASSET_MODEL_PHASE2.md](../bizcard-3.0-phase2/PRD_ASSET_MODEL_PHASE2.md)。
- context 下 `+` 弹窗规则见 [CONTEXT_PLUS_MENU_SPEC.md](../bizcard-3.0/CONTEXT_PLUS_MENU_SPEC.md)。
