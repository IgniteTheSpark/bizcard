# Eureka 3.0 Agentic Flow 架构 Review

**Review 时间**：2026-05-07  
**Review 范围**：
- `ASSET_AND_SESSION_ARCHITECTURE.md`
- `FLASH_NOTE_SKILL_ARCHITECTURE.md`
- 相关 Ask Agent / Skill / App 展示契约文档

---

## 一、总体判断

当前方案的大方向成立：

1. 以 `Skill` 作为产品功能扩展单元，适合长期演进。
2. `files / contacts / assets / sessions` 的边界基本清晰。
3. `Asset + payload` 的统一模型可以支撑后端低感知业务语义。
4. 通过 `source_session_id + source_input_id` 做两级溯源，是比较稳的设计。

需要补强的不是推翻统一 Asset 模型，而是补上三层约束：

1. **后端投影 / 索引层**：为提醒、状态流转、列表查询等平台能力抽取必要字段。
2. **更开放的 Session output 契约**：不要只绑定 `asset_ids`。
3. **确认与审计机制**：尤其是 Contact 写入、联系人候选、多版本 Asset、AI 误写回滚。

---

## 二、关键 Review 结论

### 1. Todo 的 `due_at` 可以由后端抽离，不必破坏统一 Asset 结构

Todo 后续会涉及消息推送，因此后端确实需要识别 `due_at`、`status` 等字段。

但这不意味着要把所有 Todo 字段提升到 Asset 顶层。推荐保持：

```json
{
  "asset_type": "todo",
  "payload": {
    "title": "下周一给 Kevin 发报价",
    "due_at": "2026-05-11T10:00:00+08:00",
    "status": "pending_confirmation"
  }
}
```

后端可以在写入时或异步任务中，根据 `asset_type = "todo"` 的 schema 抽取平台索引：

```json
{
  "asset_id": "asset_001",
  "asset_type": "todo",
  "index_fields": {
    "due_at": "2026-05-11T10:00:00+08:00",
    "status": "pending_confirmation"
  }
}
```

实现上可以是：

- 数据库 generated column
- materialized index table
- scheduler queue
- search index
- 后端内部不可见的投影字段

原则是：**Asset 统一结构不变，后端只为平台能力抽取必要字段。**

---

### 2. Session 的 `output` 不应只约束为 `asset_ids`

原方案中 `Session.output.asset_ids[]` 适合表达 Asset 创建结果，但不足以表达：

- Contact 更新
- 候选联系人确认
- 操作失败
- Agent 回复
- 用户确认状态
- 删除 / 修改 / 重新生成
- 多步骤执行过程

建议将 `output` 改成更开放的事件 / item 列表：

```json
{
  "output": {
    "items": [
      {
        "type": "asset_created",
        "asset_id": "asset_001"
      },
      {
        "type": "contact_update_pending",
        "candidates": ["contact_kevin_001", "contact_kevin_002"],
        "message": "找到多个 Kevin，请确认要更新哪一位"
      },
      {
        "type": "assistant_message",
        "message_id": "msg_001"
      }
    ]
  }
}
```

也可以更进一步：`output` 是由顶层 Skill 定义的自由 JSON，只要求前端 Session 详情页能消费。

关键点是：**Session 记录的是一次 Agent 运行的完整结果，不应该被限制为只记录 Asset ID。**

---

### 3. Contact 写入应进入候选确认流程

联系人相关操作的核心风险不是“能不能自动查到 Kevin”，而是：

- 同名联系人
- 昵称 / 英文名 / 中文名不一致
- ASR 识别错误
- 用户语义不完整
- AI 误判要更新的人

推荐 Contact 写入策略：

| 匹配情况 | 处理方式 |
|---|---|
| 精确唯一匹配 | 可以直接更新，但 Session 中必须留下操作记录 |
| 多个候选 | Agent 在 Session 对话框列出候选，让用户 double check |
| 没有候选 | 创建草稿 Contact，或降级为 Note / Idea |
| 低置信度 | 不直接写入，进入确认流程 |

这样仍然符合“用户主动建立关联”的原则：Agent 负责提出候选，最终绑定由用户确认。

---

### 4. 两份文档的数据模型需要收敛

`ASSET_AND_SESSION_ARCHITECTURE.md` 已经定义了统一模型：

```json
{
  "asset_type": "todo",
  "source_session_id": "session_xyz",
  "source_input_id": "input_001",
  "payload": {}
}
```

但 `FLASH_NOTE_SKILL_ARCHITECTURE.md` 里仍然出现：

- `FlashNoteRecord`
- `flash_note_records`
- `type`
- `source`
- `raw_input`
- `created_at` 放在业务 JSON 内

建议将闪念文档完全改为统一模型：

- `type` 改为 `asset_type`
- 业务字段进入 `payload`
- 来源统一使用 `source_session_id / source_input_id`
- 不再定义独立 `flash_note_records` 表
- Contact 写入结果进入 `Session.output.items[]`

---

### 5. Todo 状态需要统一

目前文档中 Todo 初始状态存在不一致：

- 统一架构中是 `pending_confirmation`
- 闪念 Skill 示例中部分是 `pending`

建议统一状态流：

```text
AI 生成：pending_confirmation
用户认领：pending
用户忽略：dismissed
用户完成：done
```

这样前端可以清晰区分：

- Session 详情页里的待认领 Todo
- 正式 Todo 列表里的用户任务
- 被忽略的 AI 提取结果

---

### 6. 重新生成 / 修改类追问需要版本关系

当用户在 Session 内说：

> 帮我重新生成一个更简洁的 summary

系统会产生新 Asset，但旧 Asset 的状态目前不明确。

建议 Asset 支持可选版本关系：

```json
{
  "asset_type": "note",
  "payload": {},
  "replaces_asset_id": "asset_old_001",
  "status": "active"
}
```

旧 Asset 可以标记为：

```json
{
  "status": "superseded",
  "superseded_by_asset_id": "asset_new_001"
}
```

这能避免 Session 使用一段时间后出现多个互相冲突的 summary / todo / note。

---

## 三、建议修改方向

### `ASSET_AND_SESSION_ARCHITECTURE.md`

建议补充：

1. `assets` 保持统一结构，但允许后端基于 `asset_type` 做平台字段投影。
2. `Session.output` 从 `asset_ids[]` 扩展为 `items[]` 或自由 JSON。
3. Contact 写操作进入 `output.items[]` 记录，不只依赖 `Contact.update_log[]`。
4. 补充 Todo 状态机。
5. 补充 Asset 版本 / 替换关系。

### `FLASH_NOTE_SKILL_ARCHITECTURE.md`

建议调整：

1. 移除 `FlashNoteRecord` 和 `flash_note_records` 表述。
2. 所有闪念产物统一表达为 `Asset`。
3. `flash-todo` 输出改成 `asset_type + payload`。
4. `flash-contact` 输出改成 `Session.output.items[]` 中的操作结果。
5. 多 Kevin / 低置信度场景改为 Agent 在 Session 对话框中请求用户确认。

---

## 四、收敛后的核心原则

1. **Asset 是内容结果，不是所有操作结果。**
2. **Session 是 Agent 过程记录，可以包含 Asset、Contact 操作、候选确认、失败信息和回复消息。**
3. **后端不理解所有 payload，但可以为平台能力抽取必要索引。**
4. **Skill 定义业务 schema，后端根据 schema 做有限投影。**
5. **联系人关联和敏感写入由 Agent 提议、用户确认。**
6. **Todo / Reminder 这类平台能力需要明确状态机和调度字段。**
7. **重新生成类操作需要版本关系，不能只让多个 Asset 无序共存。**

---

## 五、第二轮补充 Review：架构级遗漏

在第一轮 Review 基础上，继续通读 `APP_PRD.md`、`ASSET_AND_SESSION_ARCHITECTURE.md` 与 `FLASH_NOTE_SKILL_ARCHITECTURE.md` 后，发现当前方案还有一些需要提前定义的系统级约束。以下建议不推翻现有 Asset + Session 主模型，重点是补齐长期落地时会影响权限、扩展、恢复和一致性的边界。

### 1. 顶层实体缺少用户 / 租户维度

当前 `File`、`Contact`、`Asset`、`Session` 示例里都没有 `user_id` / `owner_id` / `tenant_id`。这使整套模型隐含为单用户系统。

风险：

- 后端查询无法做最基础的数据隔离。
- `flash_note` 的“全局共享 Session”语义不清，是系统全局还是用户全局。
- `Contact.update_log[]` 只能记录哪个 Session/Input 改动过联系人，不能记录由哪个用户或 actor 触发。

建议：

- 所有顶层实体增加 `owner_user_id`。
- `Contact.update_log[]` 增加 `actor_user_id`。
- 明确“全局 flash_note Session”是 **per-user global session**。
- 如果未来有团队或企业空间，再引入 `workspace_id` / `tenant_id`，不要让当前模型默认系统级全局。

### 2. 删除、归档与生命周期策略缺失

当前文档没有定义 File / Contact / Asset / Session 的删除语义。

需要提前明确的问题：

- 用户删除 Asset 后，`Session.output.items[]` 中已经存在的 `asset_created.asset_id` 如何处理。
- 删除 File 后，由该 File 衍生的 Asset 是否继续保留。
- 删除 Contact 后，`File.speakers[].contact_id` 是否置空，还是保留已删除引用。
- 删除 Session 后，`Asset.source_session_id` 是否允许变成悬空指针。

建议：

- 默认使用软删：`deleted_at` / `archived_at` / `status = deleted`。
- Session output 中的历史事件不物理移除，只在读取时识别目标实体状态。
- 对悬空引用制定统一展示策略，例如显示“来源已删除”或“联系人已删除”。
- 原始音频 File 可以单独定义 retention 策略，避免存储成本无限增长。

### 3. 并发、幂等与重试模型缺失

当前流程默认所有输入和 Skill 运行顺序成功，但真实场景会遇到硬件重传、弱网补传、App 多端同时追问、Skill 部分失败等问题。

风险：

- 同一段录音被重复上传，产生重复 input 和重复 Asset。
- `flash_note` 全局 Session 是高频 append 目标，并发追加容易产生顺序和覆盖问题。
- 同一个 Contact 被多个 input 同时更新时，`update_log[]` 与实体字段可能竞争。

建议：

- 每个客户端输入增加 `client_input_id` 或 `idempotency_key`。
- 服务端基于幂等 key 去重后再分配 `input_id`。
- `Session.inputs[]` 定义为 append-only 时间线，只能追加，不能重排或中间插入。
- `Asset`、`Contact` 这类可更新实体增加 `version` 字段，用乐观锁处理并发写入。
- Skill 对同一 input 的执行应可重入，多次执行不应产生重复业务结果。

### 4. 全局 flash_note Session 的扩展性需要收口

`ASSET_AND_SESSION_ARCHITECTURE.md` 当前定义所有闪念录音追加到同一个 `flash_note` Session。这个方向有利于共享上下文，但如果无限增长，会带来查询、展示和 LLM 上下文构造问题。

风险：

- `inputs[]` 和 `output.items[]` 无限增长，前端详情页无法一次性加载。
- “共享上下文”没有定义，容易被实现为把全部历史输入传给 LLM。
- 老闪念和新闪念混在一个 Session 中，后续检索、归档、分页都会变复杂。

建议：

- 明确 `flash_note` 是逻辑上的全局 Session，物理存储可按时间或 input 数量分段。
- 为 `inputs[]` 和 `output.items[]` 定义分页 API。
- Skill 调用时的上下文构造应采用“最近 N 条 + 检索召回相关历史 + 历史摘要”，而不是全量输入。
- 增加归档策略：旧 input 进入 archive，但仍可被语义检索召回。

### 5. Skill schema 缺少版本演进策略

当前设计允许 PM 定义新的 Skill、`asset_type` 和 payload schema，但没有说明已有 Skill schema 修改时如何兼容历史数据。

风险：

- 历史 Asset payload 按旧 schema 存储，新前端模板按新 schema 渲染时可能失败。
- 后端按 `asset_type` 抽取平台字段时，字段路径随 schema 变化而失效。
- 同一个 `asset_type` 下不同版本 payload 混用，后续迁移成本高。

建议：

- Asset 增加 `schema_version` 或 `skill_version`。
- Skill 注册表声明当前 schema version 与兼容策略。
- 前端渲染模板按 `(asset_type, schema_version)` 路由。
- 破坏性 schema 变更优先使用新版本或新 `asset_type`，不要静默覆盖旧定义。

### 6. dispatcher 的决策契约需要更明确

`flash-note-dispatcher` 当前只定义了路由规则和输出 skill 列表，但没有定义多 Skill 命中、低置信、部分失败和审计方式。

建议：

- 每条 dispatch 决策增加 `confidence`、`reason`、`span` 或 `source_text`。
- 当多个 Skill 命中同一片段时，明确是否允许并行执行，或由 dispatcher 做去重。
- 低置信结果进入 `unknown`、`idea` 还是确认流程，需要统一规则。
- 部分成功、部分失败时，`Session.output.items[]` 应同时记录成功项和失败项。
- 可选增加 `dispatch_decision` output item，用于调试、审计和重跑。

### 7. Ask Agent scope 只定义入口，没有定义检索边界

`APP_PRD.md` 定义了 `scope` 和 `scope_id`，但没有说明不同 scope 对应的默认检索范围和能力边界。

需要明确：

- `scope = contact` 时，Agent 是只看该 Contact，还是可以检索该 Contact 相关 Session / File / Asset。
- `scope = session` 时，是否允许跨 Session 检索。
- `scope = global` 时，默认召回哪些数据源：contacts、assets、files.parsed_content、sessions messages。
- Agent 跨 scope 访问数据时，前端是否需要显式提示用户。

建议在 App PRD 中补一张 scope 行为表，定义每种 scope 的默认数据源、可选扩展范围和前端提示要求。

### 8. “Asset 无横向关联”应升级为显式产品取舍

统一架构中明确 `assets` 表内部没有横向关联，Todo 也不关联 Contact。这能保持模型简单，但会牺牲一些产品能力。

会放弃或延后的能力：

- Contact 详情页聚合与该人相关的 Todo。
- Note 与从它提取出的 Todo 之间的直接关系。
- 跨 Asset 的关系图谱。
- “Kevin 相关所有事项”的精确结构化查询。

建议：

- 在设计原则中明确这是一个有意取舍，而不是遗漏。
- 文档中列出它牺牲的能力，方便 PM 做产品判断。
- 预留轻量 escape hatch，例如 `payload.references[]` 软引用，只作为辅助展示和检索信号，不作为强一致外键。

### 9. 时间与时区契约缺失

Todo 示例中出现了 `due_at`，但没有定义自然语言时间如何归一化。

需要明确：

- “今晚 5 点”由哪个组件解析，是 dispatcher、todo-sub-skill 还是后端。
- 解析时使用用户当前时区、设备时区还是服务端时区。
- `created_at`、`input.created_at`、`payload.due_at` 分别代表设备时间、服务端时间还是用户语义时间。

建议：

- 所有持久化时间使用 ISO 8601 并带 timezone offset。
- 自然语言时间解析需要传入用户当前时区。
- 保留服务端写入时间作为排序基准，用户语义时间作为业务字段。
- 对硬件设备时间漂移制定策略，例如同时保留 `device_created_at` 与 `server_received_at`。

### 10. 错误恢复、撤销与用户可见性需要落地

边界情况章节已经提到 ASR 失败、无法分类、离线等情况，但大多停留在“写入 error item”。还需要定义用户如何恢复。

建议：

- `error` item 区分 `retryable` 与 `non_retryable`。
- ASR 失败后允许用户补充或编辑 transcript，然后重新触发 Skill。
- Skill 失败支持基于同一 `input_id` 重跑，重跑结果应幂等。
- 对 AI 错误写入提供撤销路径：撤销可以表现为 `asset_updated`、`contact_update_reverted` 或新增 correction item。
- 前端需要能展示“处理中 / 成功 / 部分失败 / 可重试 / 已撤销”等状态。

---

## 六、第二轮建议的文档修改顺序

建议按以下顺序吸收第二轮 Review：

1. 在 `ASSET_AND_SESSION_ARCHITECTURE.md` 前置补充“全局系统约束”：owner、删除、并发、版本、时间。
2. 在 Session 章节补充 `flash_note` 全局 Session 的分页、归档和上下文构造规则。
3. 将 `Session.output.items[].type` 的枚举表集中维护在统一架构文档中，其他文档只引用。
4. 在 `FLASH_NOTE_SKILL_ARCHITECTURE.md` 的 dispatcher 章节补充置信度、去重、部分失败和重跑策略。
5. 在 `APP_PRD.md` 的入口章节后补充 `scope` 与检索边界表。
6. 在设计原则中明确“Asset 无横向关联”是产品取舍，并列出当前阶段放弃的能力。

---

## 七、第二轮发现的文档一致性问题

1. `ASSET_AND_SESSION_ARCHITECTURE.md` 关联文档中引用了 `SKILL_PRD.md`，但当前目录下未看到该文件。
2. `Session.output.items[]` 的 type 取值散落在多份文档中，建议集中为统一枚举。
3. `APP_PRD.md` 中提到 Contact 操作结果，但 type 命名需要和 `FLASH_NOTE_SKILL_ARCHITECTURE.md` 的 `contact_updated` / `contact_update_pending` 保持一致。
4. `ASSET_AND_SESSION_ARCHITECTURE.md` 说明手动创建 Asset 使用 `source_type = "manual"`，但 5.1 通用结构示例中没有展示 `source_type` 字段，需要补齐。

