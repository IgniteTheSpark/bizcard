---
name: flash-todo
description: 待办子SKILL，处理待办/日程提醒，支持新增、修改、查询，多条并存；严格对齐前端待办Card固定JSON结构输出，确保字段无错位、格式标准；支持多待办同时创建、创建失败异常处理，兼容单次触发下新增/更新/查询多动作并行场景。
metadata:
  flash_thought_v2:
    enabled: true
    intent_type: todo
    skill_name: flash_todo_default
    invoke_key: todo
---

# Flash Todo 业务SOP（严格遵循此规范执行）

## 〇、流水线编排对接（Step 2）

- **触发条件**：`S1.routing.invoke_todo_skill === true`。
- **输入契约**：一次调用处理 **全部** `S1.todo.items`；第 `k` 条 Card 对应 `items[k-1].source_text`，只解析该子句，不要混入其它意图片段。
- **输出契约**：最终对外必须为 **数组**，且 **长度等于 `S1.todo.items.length`**（一条时也建议用单元素数组，与子 SKILL 历史兼容时可保留单对象——编排层需统一成数组再进 Step 3）。顺序与 `seq` 一致。
- **fail_reason 对齐**：校验失败或无法落库时，`error_msg` 尽量采用便于汇总展示的短语（示例：`缺失字段: dueAt`、`工具调用异常，请重试`），Step 3 会写入 `supported_command_results[].fail_reason`。
- **下游**：`payload.has_todo`、`todo_raw_content` 来自 `S1`；每条执行结果进入 `supported_command_results`（`command_type: "todo"`），`saved_content.reminder` 见 `step3 rules.md` 第七节。

## 一、触发场景
### 匹配规则
仅响应 **待办、提醒、截止时间、任务跟进、日程事项** 类指令，过滤非待办类内容（联系人、联网搜索、纯灵感随笔等均不纳入）；支持单次触发指令中包含多个待办操作（新增/更新/查询并行），仅触发一次Skill即可完成所有操作。

### 典型触发话术
- 新增：明天下午三点前提交季度总结待办、周五下班前完成项目复盘（多条同时新增）
- 查询：查一下标题含周报的所有待办、我的待办有哪些
- 修改：把上周开会的待办截止时间改成周六18点、修改待办标题为“提交月度报表”
- 多动作并行：新增一条待办（明天提交方案）、修改标题为“周报”的待办截止时间到周五、查询所有未完成待办

## 二、可用工具列表
| 动作类型 | 工具名称 | 适用场景 |
|----------|----------|----------|
| 新增 | eureka_mind_create_reminder | 单个待办新增 |
| 批量新增 | eureka_mind_batch_create_reminders | 多条待办同时新增（优先使用，提升效率） |
| 修改/更新 | eureka_mind_update_reminder | 调整已有待办的标题、截止时间、状态 |
| 查询 | eureka_mind_query_reminder | 搜索待办、查询待办详情；修改前无entity_id时，先调用此工具获取id；单次触发多动作时，同步执行查询操作 |

meetingId 强约束：
- 当前请求里的 `data_id` 就是所有待办 MCP tool 入参里的 `meetingId`。
- 只要工具 schema 存在 `meetingId` 字段，每一次调用都必须显式传 `meetingId=<data_id>`，不能省略，不能改名，不能写成别的 id。
- 单条新增：`eureka_mind_create_reminder` 必须显式传 `meetingId=<data_id>`。
- 批量新增：`eureka_mind_batch_create_reminders.records[i].meetingId` 必须全部等于当前 `data_id`。
- 查询和更新：如果工具 schema 接受 `meetingId`，也必须显式传相同的 `meetingId`。

## 三、动作路由逻辑
1.  新增（create）：用户明确新增待办（单个/多个）→ 单个待办调用eureka_mind_create_reminder，多个待办优先调用eureka_mind_batch_create_reminders，每条待办生成独立标准Card结构，最终以数组形式返回。
2.  查询（query）：用户查询待办相关信息 → 调用查询工具，返回结果套入标准Card结构；若与新增/更新动作并行，同步执行查询操作，分别返回对应结果。
3.  更新（update）：用户修改已有待办 → 无entity_id时，先调用查询工具获取id，再调用更新工具；若单次触发中存在多个更新操作，逐条执行查询+更新流程。
4.  多动作并行（单次Skill触发）：同一用户指令中包含新增、更新、查询任意组合动作时，无需多次触发Skill，按“查询→更新→新增”的顺序依次执行，分别生成对应操作的Card结构，最终汇总为数组返回。
5.  失败处理：新增/更新/查询过程中，单个动作失败不影响其他动作执行，失败动作单独标记状态、记录失败原因，成功动作正常返回Card结构。

## 四、强制输出规范（核心，必须严格遵守）
### 最终输出JSON结构（对齐前端待办Card，禁止修改字段名、增减字段）
#### 单个待办操作输出
```json
{
  "entity_type": "reminder",
  "entity_id": "优先取items.dataId，无则生成标准UUID",
  "action": "create|query|update",
  "status": "success|failed", // 新增字段，标记当前待办操作状态
  "error_msg": "", // 新增字段，操作失败时填写失败原因，成功时留空
  "display": {
    "title": "从items.title取值，原样保留，不篡改、不缩写",
    "due_at": "从items.dueAt取值，必须为ISO8601格式（例：2026-05-10T18:00:00.000+00:00）",
    "status": "从items.status取值，无状态则留空字符串",
    "is_completed": false,
    "meeting_id": "",
    "meeting_title": "",
    "include_self": 0,
    "contactIds": [],
    "created_at": "生成待办时的当前ISO8601时间戳"
  }
}
```

#### 多个待办/多动作并行输出（数组形式）
```json
[
  {
    "entity_type": "reminder",
    "entity_id": "优先取items.dataId，无则生成标准UUID",
    "action": "create|query|update",
    "status": "success|failed",
    "error_msg": "",
    "display": {
      "title": "待办标题1",
      "due_at": "ISO8601时间格式",
      "status": "",
      "is_completed": false,
      "meeting_id": "",
      "meeting_title": "",
      "include_self": 0,
      "contactIds": [],
      "created_at": "当前ISO8601时间戳"
    }
  },
  {
    "entity_type": "reminder",
    "entity_id": "优先取items.dataId，无则生成标准UUID",
    "action": "create|query|update",
    "status": "success|failed",
    "error_msg": "",
    "display": {
      "title": "待办标题2",
      "due_at": "ISO8601时间格式",
      "status": "",
      "is_completed": false,
      "meeting_id": "",
      "meeting_title": "",
      "include_self": 0,
      "contactIds": [],
      "created_at": "当前ISO8601时间戳"
    }
  }
]
```

### 字段强制约束（不可突破）
1.  entity_type：固定为“reminder”，禁止修改
2.  action：仅可取值“create”“query”“update”，与当前动作严格对应
3.  entity_id：优先使用工具返回的dataId；无dataId时，自动生成标准UUID（如：34ce0b24-f830-4592-8e52-43a1b58f5810）
4.  status（新增字段）：仅可取值“success”（操作成功）、“failed”（操作失败），与实际操作结果严格对应
5.  error_msg（新增字段）：操作失败时，填写具体失败原因（例：“待办创建失败，工具调用异常”）；操作成功时，留空字符串
6.  display.title：严格提取用户指令中的待办标题，不得随意修改、缩写
7.  display.due_at：必须为UTC ISO8601带时区格式，缺失截止时间时，不编造时间，按“needs_confirmation”处理
8.  display.is_completed：新建待办默认固定为false，不修改
9.  display.meeting_id、display.meeting_title：无会议关联时，固定为空字符串
10. display.include_self：固定为数值0，禁止修改
11. display.contactIds：无关联联系人时，固定为空数组[]
12. display.created_at：生成待办时，填充当前标准ISO8601时间戳（例：2026-05-09T15:30:00.000+00:00）

## 五、内部自检中间响应格式（Agent自检用，不对外暴露）
```json
{
  "status": "completed|needs_confirmation|part_failed|all_failed", // 新增part_failed（部分失败）、all_failed（全部失败）状态
  "items": [
    {
      "op": "create|query|update",
      "dataId": "string",
      "title": "string",
      "dueAt": "ISO8601时间字符串",
      "status": "string",
      "op_status": "success|failed", // 新增，标记单个操作状态
      "op_error": "" // 新增，单个操作失败原因
    }
  ],
  "errors": [
    "整体错误/缺参提示文案（如：部分待办操作失败，请查看对应error_msg）"
  ]
}
```

### 状态分支规则
1.  status: completed
    - 触发条件：所有待办操作（单个/多个）信息完整、成功解析，所有动作执行成功，生成符合规范的Card结构
    - 要求：errors数组为空，所有items.op_status为success，所有字段填写规范
2.  status: needs_confirmation
    - 触发条件：部分/全部待办缺失标题、截止时间等关键必填信息
    - 要求：禁止编造缺失信息，errors[0]明确提示需补充的内容（例：“请补充2条待办的截止时间”）；已获取完整信息的待办可正常执行，缺失信息的待办暂不执行
3.  status: part_failed
    - 触发条件：单次触发中，部分待办操作（新增/更新/查询）成功，部分失败（如：2条待办新增，1条成功1条失败）
    - 要求：errors[0]提示整体状态（例：“部分待办操作失败，请查看对应error_msg”）；成功操作正常返回Card，失败操作标记status=failed并填写error_msg
4.  status: all_failed
    - 触发条件：所有待办操作均失败（如：工具调用异常、所有待办信息无效）
    - 要求：errors[0]明确写明整体失败原因（例：“所有待办操作失败，工具调用异常，请重试”）；所有待办Card标记status=failed并填写对应error_msg

## 六、辅助解析规则
1.  核心提取：从用户自然语言中，提取所有待办相关的“待办标题、截止时间、操作类型（新增/更新/查询）”，区分每条待办及对应动作，不遗漏、不混淆
2.  时间格式化：所有截止时间必须转为ISO8601格式（yyyy-MM-ddTHH:mm:ss.000+00:00），避免格式错乱
3.  异常处理：
    - 缺失关键信息时，不编造内容，对应待办标记为needs_confirmation，不影响其他完整待办执行
    - 单个待办操作失败（如创建失败、更新失败），不中断其他待办操作，失败待办单独记录状态和原因
    - 工具调用异常时，对应待办操作标记为failed，error_msg填写“工具调用异常，请重试”
    - 若工具 schema 存在 `meetingId` 但入参未显式传入 `meetingId=<data_id>`，本次调用视为错误，不要省略该字段
4.  多条处理/多动作并行：
    - 多条待办：逐条拆解，每条生成独立Card对象，优先使用批量新增工具提升效率；若使用批量新增，每条 records 都必须带 `meetingId=<data_id>`
    - 多动作并行：按“查询→更新→新增”顺序执行（查询为更新提供entity_id，避免冲突），分别生成对应操作的Card，汇总为数组返回
5.  单次触发约束：同一用户指令无论包含多少条待办、多少种操作（新增/更新/查询），仅触发一次Skill，一次性完成所有操作并返回汇总结果

## 七、后置处理要求
1.  工具调用完成后，仅输出标准待办Card JSON结构（单个/数组），禁止添加任何自然语言总结、说明
2.  所有输出必须严格对齐字段规范，不新增、不删减、不修改字段名、不篡改字段值；新增的status和error_msg字段必须按要求填写，不得遗漏
3.  查询动作的返回结果，需套入上述标准Card结构，仅将action改为“query”即可
4.  失败操作必须明确填写error_msg，不得空白；成功操作error_msg必须留空，status统一为success
5.  多条待办/多动作并行时，必须以数组形式返回，每条待办对应一条Card，不得合并字段

## 八、示例（输入→输出）
### 示例1：多条待办同时创建（含1条创建失败）
#### 用户输入
新增两条待办：1. 明天10点提交方案；2. 周五18点完成复盘（第二条待办创建失败，工具异常）
#### 标准输出（可直接对接前端）
```json
[
  {
    "entity_type": "reminder",
    "entity_id": "34ce0b24-f830-4592-8e52-43a1b58f5810",
    "action": "create",
    "status": "success",
    "error_msg": "",
    "display": {
      "title": "明天10点提交方案",
      "due_at": "2026-05-10T10:00:00.000+00:00",
      "status": "",
      "is_completed": false,
      "meeting_id": "",
      "meeting_title": "",
      "include_self": 0,
      "contactIds": [],
      "created_at": "2026-05-09T16:00:00.000+00:00"
    }
  },
  {
    "entity_type": "reminder",
    "entity_id": "a7d8f9e0-1234-5678-90ab-cdef12345678",
    "action": "create",
    "status": "failed",
    "error_msg": "待办创建失败，工具调用异常，请重试",
    "display": {
      "title": "周五18点完成复盘",
      "due_at": "2026-05-12T18:00:00.000+00:00",
      "status": "",
      "is_completed": false,
      "meeting_id": "",
      "meeting_title": "",
      "include_self": 0,
      "contactIds": [],
      "created_at": "2026-05-09T16:00:00.000+00:00"
    }
  }
]
```

### 示例2：单次触发多动作并行（查询+更新+新增）
#### 用户输入
查询标题含“周报”的待办，把该待办截止时间改成周五18点，再新增一条待办“下周一提交月度报表”
#### 标准输出（可直接对接前端）
```json
[
  {
    "entity_type": "reminder",
    "entity_id": "b8c9d0e1-2345-6789-0abc-def12345678",
    "action": "query",
    "status": "success",
    "error_msg": "",
    "display": {
      "title": "每周五提交周报",
      "due_at": "2026-05-09T17:00:00.000+00:00",
      "status": "",
      "is_completed": false,
      "meeting_id": "",
      "meeting_title": "",
      "include_self": 0,
      "contactIds": [],
      "created_at": "2026-05-08T14:00:00.000+00:00"
    }
  },
  {
    "entity_type": "reminder",
    "entity_id": "b8c9d0e1-2345-6789-0abc-def12345678",
    "action": "update",
    "status": "success",
    "error_msg": "",
    "display": {
      "title": "每周五提交周报",
      "due_at": "2026-05-12T18:00:00.000+00:00",
      "status": "",
      "is_completed": false,
      "meeting_id": "",
      "meeting_title": "",
      "include_self": 0,
      "contactIds": [],
      "created_at": "2026-05-08T14:00:00.000+00:00"
    }
  },
  {
    "entity_type": "reminder",
    "entity_id": "c9d0e1f2-3456-7890-abcd-ef1234567890",
    "action": "create",
    "status": "success",
    "error_msg": "",
    "display": {
      "title": "下周一提交月度报表",
      "due_at": "2026-05-12T09:00:00.000+00:00",
      "status": "",
      "is_completed": false,
      "meeting_id": "",
      "meeting_title": "",
      "include_self": 0,
      "contactIds": [],
      "created_at": "2026-05-09T16:30:00.000+00:00"
    }
  }
]
```
