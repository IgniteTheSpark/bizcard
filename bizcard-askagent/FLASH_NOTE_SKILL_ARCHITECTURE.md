# 闪念 Skill 解耦架构设计

**版本**：v0.2  
**状态**：草案  
**关联文档**：
- [ASSET_AND_SESSION_ARCHITECTURE.md](./ASSET_AND_SESSION_ARCHITECTURE.md)（资产与 Session 统一架构，上层模型）
- [SKILL_PRD.md](./SKILL_PRD.md)（Ask Agent Skill 总体规划）
- [NANOBOT_LOGIC_AND_SKILLS.md](./NANOBOT_LOGIC_AND_SKILLS.md)（Nanobot 运行机制）
- [07_EINK_SECOND_SCREEN_FUNCTION_LOGIC.md](../Eureka-3.0-HARDWARE/07_EINK_SECOND_SCREEN_FUNCTION_LOGIC.md)（E-ink 硬件端闪念入口定义）

---

## 一、核心设计目标

闪念功能的 Skill 架构需要满足两个关键约束：

1. **技术与产品解耦**：后端不感知业务语义，只负责存储结构化 JSON；业务含义由 Skill 层定义，前端根据 JSON 类型字段渲染。
2. **可扩展性**：Skill 体系支持未来新增业务领域（如 Finance、Health 等），无需改动后端存储和通信协议。

---

## 二、闪念的本质

闪念入口是通过**录音卡片**触发的短语音输入。用户说出的内容可能包含：

- **随机想法**（适合沉淀为 Idea/Note）
- **任务安排**（适合创建 Todo/Reminder）
- **人物信息**（适合更新 Contact 画像）
- **以上多者的混合**

典型例子：

> 用户说：「帮我创建一个今晚 5 点开会的代办，同时也帮我记录一下 Kevin 喜欢喝拿铁」

这句话包含两个独立意图，需要分别执行，分别落库。

---

## 三、整体架构：语义拆解 + 并行 Skill 执行

```
[ 闪念录音 ]
     |
     v
[ ASR 转文本 ]
     |
     v
[ Skill: flash-note-dispatcher（语义拆解调度器） ]
     |
     |—— 意图 1 → [ Skill: flash-todo       ] → TodoJSON
     |—— 意图 2 → [ Skill: flash-contact    ] → ContactJSON
     |—— 意图 3 → [ Skill: flash-idea       ] → IdeaJSON
     |—— 意图 N → [ Skill: flash-xxx        ] → XxxJSON
     |
     v
[ 后端: 统一存储多条 FlashNoteRecord ]
     |
     v
[ 前端: 根据 type 字段渲染对应卡片 ]
```

每一条 FlashNoteRecord 都是一个独立的 JSON 对象，后端只做存储，不做业务判断。

---

## 四、核心 Skill 定义

### 4.1 flash-note-dispatcher（语义拆解调度器）

这是闪念流程的**入口 Skill**，也是唯一感知完整用户输入的 Skill。

**职责**：
- 理解用户完整输入的语义全貌
- 将输入拆分成 N 个独立意图单元
- 为每个意图单元判断应调用哪个 Skill
- 并行或串行触发对应 Skill 的执行

**输出契约**（给下游 Skill 的调度指令列表）：

```json
{
  "dispatch": [
    {
      "skill": "flash-todo",
      "extracted_input": "今晚5点开会的代办"
    },
    {
      "skill": "flash-contact",
      "extracted_input": "Kevin 喜欢喝拿铁"
    }
  ]
}
```

**Skill 路由规则（供 dispatcher 判断）**：

| 意图特征 | 路由 Skill |
|----------|-----------|
| 包含时间 + 任务描述 | `flash-todo` |
| 包含提醒、不要忘记等 | `flash-todo` |
| 包含人名 + 偏好/信息/特征描述 | `flash-contact` |
| 纯想法、没有明确动作 | `flash-idea` |
| 未来扩展：包含财务、健康等关键词 | `flash-xxx` |

**扩展能力**：dispatcher 本身不硬编码路由规则，而是通过 prompt 中声明「当前已注册的 Skill 清单及其触发条件」来驱动判断。未来新增 Skill 时，只需在 dispatcher 的 prompt 中补充该 Skill 的触发描述，无需修改其他代码。

---

### 4.2 flash-todo（待办 Skill）

**职责**：将一个待办意图转化为标准 TodoJSON

**输入**：dispatcher 提取的意图片段文本

**输出 JSON**：

```json
{
  "type": "todo",
  "title": "今晚5点开会",
  "due_at": "2026-05-06T17:00:00+08:00",
  "status": "pending",
  "source": "flash_note",
  "raw_input": "今晚5点开会的代办",
  "created_at": "2026-05-06T09:30:00+08:00"
}
```

**MCP Tool 依赖**：`create_reminder(payload)`

---

### 4.3 flash-contact（联系人信息 Skill）

**职责**：识别人名及其关联信息，将信息追加到对应 Contact 的 `notes[]` 字段

**输入**：dispatcher 提取的意图片段文本

**输出（MCP 写操作，不产生独立 Asset）**：

```json
{
  "action": "append_contact_note",
  "contact_name": "Kevin",
  "note_content": "喜欢喝拿铁",
  "source_session_id": "session_xyz"
}
```

**MCP Tool 依赖**：`search_my_contacts(query)` + `update_contact(id, payload)`

> `contact_note` **不是独立资产**。它是附属在 Contact 实体上的 `notes[]` 字段内容。Skill 执行的是「找到 Kevin → 往他的 notes 里追加一条」，不产生新的 Asset 记录。
>
> 如果 Kevin 在联系人中不存在，有两种处理策略：
> - 创建一个草稿 Contact（`status: draft`），等待用户在 App 内补充完善；
> - 降级为 `flash-idea`，保存为一条 Idea，内容为「Kevin 喜欢喝拿铁」，提示用户手动关联。

---

### 4.4 flash-idea（想法沉淀 Skill）

**职责**：将无明确动作的想法或随机灵感记录为 Idea

**输入**：dispatcher 提取的意图片段文本（或 dispatcher 判断为「纯想法」的整段输入）

**输出 JSON**：

```json
{
  "type": "idea",
  "content": "可以考虑给销售团队做一个客户偏好标签系统",
  "tags": [],
  "source": "flash_note",
  "raw_input": "可以考虑给销售团队做一个客户偏好标签系统",
  "created_at": "2026-05-06T09:30:00+08:00"
}
```

**MCP Tool 依赖**：`create_note(payload)`（或直接存储为 JSON，无需 MCP）

---

## 五、存储模型与 Session 关系

闪念的存储模型遵循统一的 Asset + Session 架构，详见 [ASSET_AND_SESSION_ARCHITECTURE.md](./ASSET_AND_SESSION_ARCHITECTURE.md)。

闪念 Session 的特点：

| 字段 | 值 |
|------|-----|
| `source_type` | `"flash_note"` |
| `input.audio_id` | 录音文件 ID |
| `input.transcript` | ASR 转写文字 |
| `output.asset_ids[]` | 本次生成的 Todo / Idea / Note Asset ID 列表 |

**Contact 信息不产生 Asset**：`flash-contact` 的产出是对 Contact 实体的写操作（`contact.notes[]` append），不会出现在 `output.asset_ids[]` 中，但 Session 详情页会展示「已更新哪些 Contact 的备注」作为操作记录。

**Todo 认领机制**：闪念生成的 Todo 初始状态为 `pending_confirmation`，用户在 Session 详情页确认认领后状态变为 `pending`，正式进入 Todo 列表。

---

## 六、前端渲染契约

前端接收到闪念处理结果后，根据每条 `FlashNoteRecord` 的 `type` 字段选择渲染模板：

```
type = "todo"     → TodoCard（显示任务标题、截止时间、认领/忽略操作）
type = "idea"     → IdeaCard（显示想法内容、标签、收藏操作）
type = "note"     → NoteCard（显示笔记内容摘要）
type = "unknown"  → RawTranscriptCard（显示原始转写文本，供用户手动归类）
```

Contact 信息追加（`flash-contact` Skill 的产出）不在 Session 结果页以独立 Card 渲染，而是显示为「已更新 Kevin 的备注」的操作反馈，点击跳转到 Kevin 的 Contact 详情页。

每个 Card 还应显示来源标记（`来自闪念`）和时间戳，支持用户查看原始录音。

---

## 七、完整处理流程示例

**用户说**：「帮我创建一个今晚 5 点开会的代办，同时也帮我记录一下 Kevin 喜欢喝拿铁」

```
1. ASR 转文本
   → "帮我创建一个今晚5点开会的代办，同时也帮我记录一下Kevin喜欢喝拿铁"

2. flash-note-dispatcher 语义拆解
   → 意图1: "今晚5点开会的代办"  → 路由到 flash-todo
   → 意图2: "Kevin喜欢喝拿铁"    → 路由到 flash-contact

3. 并行执行两个 Skill

   flash-todo 输出:
   {
     "type": "todo",
     "title": "今晚5点开会",
     "due_at": "2026-05-06T17:00:00+08:00",
     "status": "pending",
     "source": "flash_note"
   }

   flash-contact 执行:
   {
     "action": "append_contact_note",
     "contact_name": "Kevin",
     "note_content": "喜欢喝拿铁"
   }
   → 调用 MCP: search_my_contacts("Kevin") → update_contact(kevin_id, {notes: append})
   → 不产生独立 Asset，只更新 Kevin 的 Contact 记录

4. 后端：
   - 存储一条 Todo Asset（source_session_id 关联本次 Session）
   - 更新 Kevin.notes[]（追加一条，记录 source_session_id）

5. E-ink 反馈
   → "已记录：待办「今晚5点开会」+ 已更新 Kevin 的备注"

6. App 渲染（Session 详情页）
   → TodoCard（待认领状态）
   → 「已更新 Kevin 的备注：喜欢喝拿铁」操作反馈（点击跳转 Kevin 详情）
```

---

## 八、Skill 扩展规范

未来新增 Skill 时，只需完成以下三步，无需改动后端和 dispatcher 核心代码：

1. **定义 Skill**：创建 `flash-{domain}/SKILL.md`，描述触发条件、输入格式、输出 JSON Schema。
2. **注册到 dispatcher**：在 `flash-note-dispatcher` 的 prompt 中补充该 Skill 的触发条件描述（一行自然语言即可）。
3. **前端补充渲染模板**：根据新 `type` 值添加对应的 Card 渲染组件。

后端的 `flash_note_records` 表无需任何变更，因为 `payload` 字段是 schemaless 的 JSON 存储。

---

## 九、边界说明

| 问题 | 处理方式 |
|------|----------|
| 意图模糊，dispatcher 无法判断路由 | 输出 `type: "unknown"`，保存原始转写文本，App 提示用户手动分类 |
| 人名在 Contacts 中不存在 | flash-contact 创建草稿记录，`contact_id` 为 null，App 侧提示关联 |
| 同一段输入意图数量超过 5 个 | dispatcher 按语义权重取前 5 个，其余合并入 flash-idea |
| ASR 识别失败或文本为空 | 不触发任何 Skill，E-ink 显示「未听清，请重试」 |
| 用户离线时触发闪念 | 音频本地暂存，联网后重新走完整流程，参见 E-ink 离线同步规则 |

---

## 十、与现有 Ask Agent 架构的关系

闪念 Skill 体系是 Ask Agent 的**专项子通道**，与通用的 `bizcard-search`、`bizcard-add` 等 Skill 并存，区别在于：

| 维度 | Ask Agent 通用 Skill | 闪念 Skill |
|------|---------------------|-----------|
| 入口 | 用户主动文字/语音对话 | 专属录音硬件按钮 |
| 交互模式 | 单轮对话，即时回复 | 单次录音，批量意图处理 |
| 意图数量 | 通常 1 个 | 可能 1-N 个，需拆解 |
| 输出目标 | `Text + Cards` 前端渲染 | `FlashNoteRecord JSON` 存储 + 前端渲染 |
| 会话关联 | 写入 Ask Agent Thread | 写入独立 Flash Note Thread，可从 Ask Agent 追溯 |

所有闪念产生的记录应能从 Ask Agent Thread 中追溯，用户在 App 里可以追问：「我刚才的闪念说了什么？」并得到完整的处理记录。
