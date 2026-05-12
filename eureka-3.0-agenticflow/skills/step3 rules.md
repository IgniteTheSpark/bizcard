---
name: flash-final-aggregate
description: Step 3——合并 S1 与各子 SKILL 结果为 schema_version 4.4 对外 JSON；定义 payload 全字段、summary（按用户语言）与 Card→API 映射。
metadata:
  flash_thought_v2:
    enabled: true
    intent_type: aggregate
    skill_name: flash_final_aggregate
    invoke_key: aggregate
---

# Step 3：结果汇总（对外 Payload）

## 〇、目标与数据流

**目标**：产出后端可直接持久化/下发的统一响应，**字段名与嵌套结构**与业务约定（参考示例）一致。

**输入符号**

| 符号 | 含义 |
|------|------|
| `S1` | Step 1 意图拆分 JSON（`step1 prompt.md`） |
| `R_idea` | Idea 子 SKILL 输出（Card 数组或单卡） |
| `R_qa` | QA 子 SKILL 输出（单对象或与 `S1.ai_direct_answer.items` 等长的数组） |
| `R_todo` | Reminder 子 SKILL 输出：与 `S1.todo.items` **同序、等长** 的数组 |
| `R_contact` | Contact 子 SKILL 输出：与 `S1.contact.items` **同序、等长** 的数组 |

未路由的子 SKILL：对应 `R_*` 视为 **未执行**，下列字段按规则填 `false` / `null` / `[]`。

**同步规则**：`supported_command_results` 中每条 `source_text` **必须以 `S1` 对应序号为准**，禁止用模型改写句替换。

**用户语言（汇总文案）**：面向用户阅读的 **`summary`**（及汇总阶段 **新生成/改写** 的说明性字符串，如拼接失败提示模板）须与 **用户所用语言一致**，具体要求见 **第四节**；不得固定为某一种语言（例如默认全程中文）而忽略用户输入语言。

## 一、顶层对象

```json
{
  "schema_version": "4.4",
  "model": "<运行时注入，如 openrouter/...>",
  "request_id": "<UUID>",
  "record_id": "<UUID>",
  "summary": "<简短总结，语言见第四节>",
  "payload": {}
}
```

## 二、`payload` 全量键（与参考示例对齐）

下列键 **均需存在**；无内容时用 `null`、`false` 或 `[]`，勿省略键。

```json
{
  "user_text": "<= S1.user_text",
  "has_ai_answer": "boolean",
  "ai_question": "string | null",
  "ai_answer": "string | null",
  "has_idea": "boolean",
  "idea_content": "string | null",
  "idea_save_success": "boolean | null",
  "idea_saved_content": "object | null",
  "has_unsupported": "boolean",
  "unsupported_list": ["string"],
  "has_todo": "boolean",
  "todo_raw_content": "string | null",
  "has_contact": "boolean",
  "contact_raw_content": "string | null",
  "supported_command_results": []
}
```

## 三、字段填充规则

### 3.1 原文与主 SKILL 层标记

| 字段 | 规则 |
|------|------|
| `user_text` | `S1.user_text` |
| `has_todo` / `todo_raw_content` | `S1.todo.has` / `S1.todo.raw_bundle_text` |
| `has_contact` / `contact_raw_content` | `S1.contact.has` / `S1.contact.raw_bundle_text` |
| `has_unsupported` / `unsupported_list` | `S1.unsupported.has`；列表为 `items` 按 `seq` 取 `source_text` |

### 3.2 AI 直接回答

| 字段 | 规则 |
|------|------|
| `has_ai_answer` | 与 `S1.ai_direct_answer.has` **一致**（表示用户是否包含「需 AI 直接回答」类片段） |
| `ai_question` | 当 `has_ai_answer` 为 `false` → `null`。为 `true`：单段取 `items[0].source_text`；多段用全角 `；` 连接各 `source_text` |
| `ai_answer` | 当 `has_ai_answer` 为 `false` → `null`。为 `true`：`R_qa` 单对象取 `answer`；`R_qa` 为数组时与 `items` **同序**，多条 `answer` 用 `\n` 拼接。`needs_confirmation` / `failed` 时仍输出可读说明（`answer` 或合并 `errors`），**勿丢失败信息** |

编排层在 `has_ai_answer === true` 时应 **始终调用** QA 子 SKILL；若极端情况下无 `R_qa`，`ai_answer` 可置 `null` 并由服务端告警。

### 3.3 Idea

| 字段 | 规则 |
|------|------|
| `has_idea` | `S1.idea.has` |
| `idea_content` | 无 Idea → `null`；有 → 各 `items[].source_text` 按 `seq` 用 `；` 连接 |
| `idea_save_success` | 无 Idea → `null`；有 → `R_idea` 内 **全部为 success** 则为 true，否则 false |
| `idea_saved_content` | 无 Idea → `null`；有 → **优先** MCP/工具返回体（如含 `note`、`create_time`、`timezone`）；否则按 **第七节** 从 Card 兜底映射 |

### 3.4 `supported_command_results[]`

每项结构：

```json
{
  "command_type": "todo",
  "command_count": 0,
  "command_seq": 0,
  "operate_type": "增 | 改 | 查",
  "source_text": "",
  "execute_success": true,
  "saved_content": {},
  "fail_reason": null
}
```

**生成算法**

1. **Todo**：遍历 `k = 1..len(S1.todo.items)`，`command_type`: `"todo"`，`command_count`: `len(items)`，`command_seq`: `k`，`source_text`: `S1.todo.items[k-1].source_text`，结果取自 `R_todo[k-1]`。
2. **Contact**：同理，`command_type`: `"contact"`，数据源 `S1.contact.items` / `R_contact`。
3. **`operate_type`**：Card `action` → `create`→`增`，`update`→`改`，`query`→`查`。
4. **`execute_success`**：`status === "success"`。
5. **`fail_reason`**：成功 `null`；失败优先 `error_msg`，缺参类可与业务统一为 `缺失字段: xxx`。
6. **`saved_content`**：**第七节**；优先业务/API 形态 `{ reminder: {...} }` / `{ contact: {...} }`。
7. **数组顺序**：默认 **全部 todo（按 seq）在前**，**全部 contact（按 seq）在后**。

## 四、`summary` 与用户语言

### 4.1 语言判定（优先顺序）

1. **编排层显式传入**：若请求上下文中提供 `user_locale` / `language` / `Accept-Language` 等（如 `zh-CN`、`en-US`、`ja-JP`），生成 `summary` 时 **优先** 使用该语言。
2. **否则从用户文本推断**：依据 `payload.user_text`（即 `S1.user_text`）所使用的主要书写语言（中文、英文、日文等）生成 **`summary` 全文**。
3. **混合语言**：以 **占比更高** 的语种为准；难以区分时，采用 **产品默认语言**（由业务配置，未配置时默认 **简体中文**）。

**硬性要求**

- **`summary` 内须语种统一**：同一段 `summary` 中避免中英日韩等混杂（品牌名、专有名词、用户原文引用除外）。
- **话术模板随语言切换**：第四节下列「模块分段」中的 **句式需翻译/改写为目标语言**，不得始终使用中文固定句（除非用户语言为中文）。
- **用户原文**：引用 `unsupported_list` 片段、`source_text` 短语时 **保持原样**，不因语言切换而翻译用户原句。
- **结构化字段**：`payload` 内键名、`command_type` 枚举值、布尔等 **以接口契约为准**；若业务约定 `operate_type` 仅输出「增/改/查」，则不受用户语言影响；若未来改为本地化枚举，另见产品说明。

### 4.2 分段与内容（顺序不变）

用 `\n` 分段（顺序建议：待办成功统计 → 联系人成功统计 → Idea → 不支持 → 失败摘要）。

1. **待办**：按 `operate_type` 汇总成功条数（创建/修改/查询的不同话术，**目标语言**）。
2. **联系人**：同上。
3. **Idea**：落库成功时的记录类提示（**目标语言**，等价于中文场景下的「已为你记录了 n 个 idea」类句式）。
4. **不支持**：「暂不支持」类提示包裹用户片段（片段本身不翻译）。
5. **失败**：`execute_success=false` 时，简短列出 **原文短语 + 原因关键词**（说明性文字用 **目标语言**）。

语气简短，避免复述整句用户输入。

### 4.3 `fail_reason` 与说明性字段

- 若 **直接透传** 子 SKILL 的 `error_msg`，且与子 SKILL 提示词语言一致，可保持不变。
- 若 Step 3 **重新概括、改写或拼接** 失败原因（含 `缺失字段: xxx` 模板），须与 **`summary` 所用语言一致**。

## 五、边界情况

- **四种子 SKILL 均未调用**：各 `has_*` 为 false，`supported_command_results`：`[]`，`summary` 写 **用户语言** 下的「无可执行指令」类提示（中文场景示例：「未识别到可执行指令」）。
- **仅 unsupported**：`has_unsupported=true`，`supported_command_results`：`[]`。

## 六、发布前校验

1. `payload` 是否包含第二节所列 **全部键**？
2. 每条 `supported_command_results` 的 `command_count` 是否等于 **该类型** 本条请求条数？`command_seq` 是否 1…n？
3. `todo_raw_content` / `contact_raw_content` 是否等于 `S1.todo.raw_bundle_text` / `S1.contact.raw_bundle_text`？
4. `source_text` 是否与 `S1` 对应条 **完全一致**？
5. **`summary`（及 Step 3 改写后的说明性文案）是否与用户语言 / `user_locale` 一致**，且同一段内无多余语种混杂？

## 七、子 SKILL 输出 → `saved_content` / `idea_saved_content`

Step 2 默认产出 **Card**；参考示例为 **API 嵌套**（`reminder` / `contact`）。映射规则：

### 7.1 通用

| 汇总字段 | 来源 |
|----------|------|
| `fail_reason` | `error_msg`；缺参建议 `缺失字段: dueAt` / `缺失字段: firstName` 等与端上约定一致 |

### 7.2 Todo Card → `saved_content.reminder`

| API 字段 | 来源 |
|----------|------|
| `title` | `display.title` |
| `dueAt` | `display.due_at`（空串表示缺失） |
| `contactIds` / `includeSelf` / `meetingId` / `done` | 工具返回或默认见参考示例 |

若 MCP 已返回标准 `reminder` 对象，**直接嵌入** `saved_content.reminder`，无需再套 Card。

### 7.3 Contact Card → `saved_content.contact`

参考示例含 `firstName` / `lastName` / `phones[]`。Card 仅有 `display.name`、`display.phone` 时：`phones` 由非空 `phone` 生成单元素数组；姓名 **拆分规则由产品与后端约定**，汇总层不得臆造。

### 7.4 Idea → `idea_saved_content`

优先工具返回 `{ note, create_time, timezone }`；仅 Card 时：`note` 可由 `display.title` 或正文摘要推导，`create_time`/`timezone` 由服务端补全。

### 7.5 QA → `ai_answer`

见 3.2；多段问答 **顺序必须与 `S1.ai_direct_answer.items` 一致**。

---

**文档版本**：与 `schema_version: "4.4"` 对齐。
