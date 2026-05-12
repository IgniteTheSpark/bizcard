---
name: flash-idea
description: Idea 子 SKILL，处理纯灵感或与任务并存的附加灵感，单独记录；严格对齐前端灵感Card固定JSON结构输出，确保字段无错位、格式标准；支持多灵感同时创建、创建失败异常处理，兼容单次触发下新增/查询多动作并行场景。
metadata:
  flash_thought_v2:
    enabled: true
    intent_type: idea
    skill_name: flash_idea_default
    invoke_key: idea
---

# Flash Idea 业务SOP（严格遵循此规范执行）

## 〇、流水线编排对接（Step 2）

- **触发条件**：`S1.routing.invoke_idea_skill === true`。
- **输入契约**：处理 `S1.idea.items[]` 中每条 `source_text`（按 `seq`）；勿处理待办/联系人/问答片段。
- **输出契约**：多条时为 Card **数组**，与同序 `items` 对齐；单条可为单对象（建议编排层统一为数组便于 Step 3）。
- **下游**：Step 3 填充 `payload.has_idea`、`idea_content`、`idea_save_success`、`idea_saved_content`；落库对象优先取 MCP 响应，Card 兜底规则见 `step3 rules.md` 第七节。

## 一、触发场景
### 匹配规则
仅响应 **自由灵感、想法、感受、读书启发、长期计划、随手记录** 类内容，严格过滤非灵感类信息；支持单次触发指令中包含多个灵感操作（新增/查询并行），仅触发一次Skill即可完成所有操作。
- 保留范围：纯灵感、感想、愿望、读书启发、长期计划、随手记录
- 过滤范围：待办、联系人、网络搜索指令（禁止重复写入灵感）

### 典型触发话术
- 新增：下半年想做一个习惯打卡小程序、最近读书很有启发、秋天想去长白山看雪
- 查询：查一下我之前记录的灵感、查询所有读书启发类灵感
- 多灵感并行：记录两个灵感：1. 做一个睡眠记录工具；2. 读《人类简史》的启发；查询所有未分类灵感

## 二、可用工具列表
| 动作类型 | 工具名称 | 适用场景 |
|----------|----------|----------|
| 新增 | eureka_mind_batch_create_ai_assets | 单个/多个灵感创建（优先使用，支持批量处理） |
| 查询 | eureka_mind_query_ai_assets | 搜索已保存灵感、查询灵感详情；单次触发多动作并行时，同步执行查询操作 |

## 三、动作路由逻辑
1.  新增（create）：用户明确记录灵感（单个/多个）→ 调用eureka_mind_batch_create_ai_assets，每条灵感生成独立标准Card结构，最终以数组形式返回；创建时meetingId必须严格等于当前请求里的data_id，不猜测、不篡改。
2.  查询（query）：用户查询已保存灵感 → 调用eureka_mind_query_ai_assets，返回结果套入标准Card结构；若与新增动作并行，同步执行查询操作，分别返回对应结果。
3.  多动作并行（单次Skill触发）：同一用户指令中包含新增、查询任意组合动作时，无需多次触发Skill，按“查询→新增”的顺序依次执行，分别生成对应操作的Card结构，最终汇总为数组返回。
4.  失败处理：新增/查询过程中，单个动作失败不影响其他动作执行，失败动作单独标记状态、记录失败原因，成功动作正常返回Card结构。
5.  批量处理要求：若存在batch_items，records必须覆盖batch_items里的每一条，不能漏掉任何一条，也不能只保留最后一条；且records[i].meetingId必须全部等于当前data_id。

## 四、强制输出规范（核心，必须严格遵守）
### 最终输出JSON结构（对齐前端灵感Card，禁止修改字段名、增减字段）
#### 单个灵感操作输出
```json
{
  "entity_type": "idea",
  "entity_id": "优先取items.dataId，无则生成标准UUID",
  "action": "create|query",
  "status": "success|failed", // 新增字段，标记当前灵感操作状态
  "error_msg": "", // 新增字段，操作失败时填写失败原因，成功时留空
  "display": {
    "type": "idea", // 固定取值为idea，禁止修改
    "title": "从items.title取值，原样保留，不篡改、不缩写",
    "content": "从items.content取值，必须为markdown格式，至少保留标题和正文",
    "json_content": "必须为JSON字符串，至少保留type、title、content字段"
  }
}
```

#### 多个灵感/多动作并行输出（数组形式）
```json
[
  {
    "entity_type": "idea",
    "entity_id": "优先取items.dataId，无则生成标准UUID",
    "action": "create|query",
    "status": "success|failed",
    "error_msg": "",
    "display": {
      "type": "idea",
      "title": "灵感标题1",
      "content": "markdown格式内容，至少包含标题和正文",
      "json_content": "{\"type\":\"idea\",\"title\":\"灵感标题1\",\"content\":\"markdown格式内容，至少包含标题和正文\"}"
    }
  },
  {
    "entity_type": "idea",
    "entity_id": "优先取items.dataId，无则生成标准UUID",
    "action": "create|query",
    "status": "success|failed",
    "error_msg": "",
    "display": {
      "type": "idea",
      "title": "灵感标题2",
      "content": "markdown格式内容，至少包含标题和正文",
      "json_content": "{\"type\":\"idea\",\"title\":\"灵感标题2\",\"content\":\"markdown格式内容，至少包含标题和正文\"}"
    }
  }
]
```

### 字段强制约束（不可突破）
1.  entity_type：固定为“idea”，禁止修改
2.  action：仅可取值“create”“query”，与当前动作严格对应
3.  entity_id：优先使用工具返回的dataId；无dataId时，自动生成标准UUID
4.  status（新增字段）：仅可取值“success”（操作成功）、“failed”（操作失败），与实际操作结果严格对应
5.  error_msg（新增字段）：操作失败时，填写具体失败原因（例：“灵感创建失败，工具调用异常”“meetingId与当前data_id不匹配”）；操作成功时，留空字符串
6.  display.type：固定为“idea”，禁止修改
7.  display.title：严格提取用户指令中的灵感标题，不得随意修改、缩写
8.  display.content：必须为markdown格式，至少包含标题和正文，原样保留用户灵感内容，不篡改
9.  display.json_content：必须为JSON字符串，至少保留type、title、content三个核心字段，不得遗漏；格式需符合JSON规范，避免语法错误
10. 新增时特殊要求：meetingId必须严格等于当前请求里的data_id，禁止猜测、禁止改写成时间或其他字段

## 五、内部自检中间响应格式（Agent自检用，不对外暴露）
保留中间自检格式，便于Agent快速校验操作结果、定位异常，简化冗余字段，降低维护成本，格式如下：
```json
{
  "status": "completed|needs_confirmation|part_failed|all_failed",
  "items": [
    {
      "op": "create|query",
      "dataId": "string",
      "title": "string",
      "content": "string",
      "type": "string"
    }
  ],
  "errors": [
    "整体错误/缺参提示文案（如：部分灵感操作失败，请查看对应error_msg；请补充灵感标题/内容）"
  ]
}
```

### 状态分支规则
1.  status: completed
    - 触发条件：所有灵感操作（单个/多个）信息完整、成功解析，所有动作执行成功，生成符合规范的Card结构
    - 要求：errors数组为空，所有items信息完整，符合字段规范
2.  status: needs_confirmation
    - 触发条件：部分/全部灵感缺失标题、内容等关键必填信息
    - 要求：禁止编造缺失信息，errors[0]明确提示需补充的内容（例：“请补充2条灵感的内容，需为markdown格式”）；已获取完整信息的灵感可正常执行，缺失信息的灵感暂不执行
3.  status: part_failed
    - 触发条件：单次触发中，部分灵感操作（新增/查询）成功，部分失败（如：2条灵感新增，1条成功1条失败）
    - 要求：errors[0]提示整体状态（例：“部分灵感操作失败，请查看对应error_msg”）；成功操作正常返回Card，失败操作标记status=failed并填写error_msg
4.  status: all_failed
    - 触发条件：所有灵感操作均失败（如：工具调用异常、所有灵感信息无效、meetingId与data_id不匹配）
    - 要求：errors[0]明确写明整体失败原因（例：“所有灵感操作失败，工具调用异常，请重试”）；所有灵感Card标记status=failed并填写对应error_msg

## 六、辅助解析规则
1.  核心提取：从用户自然语言中，提取所有灵感相关的“标题、内容、操作类型（新增/查询）”，区分每条灵感及对应动作，不遗漏、不混淆；严格过滤待办、联系人、网络搜索等非灵感内容。
2.  内容格式约束：display.content必须为markdown格式，至少保留标题和正文；display.json_content必须为JSON字符串，至少包含type、title、content字段，确保格式正确。
3.  异常处理：
    - 缺失关键信息（标题/内容）时，不编造内容，对应灵感标记为needs_confirmation，不影响其他完整灵感执行
    - 单个灵感操作失败（如创建失败、查询失败），不中断其他灵感操作，失败灵感单独记录状态和原因
    - 工具调用异常时，对应灵感操作标记为failed，error_msg填写“工具调用异常，请重试”
    - meetingId与当前data_id不匹配时，灵感创建失败，error_msg填写“meetingId与当前请求data_id不匹配，创建失败”
4.  多条处理/多动作并行：
    - 多条灵感：逐条拆解，每条生成独立Card对象，调用批量创建工具提升效率；若存在batch_items，records必须覆盖所有batch_items，不遗漏任何一条，且所有records[i].meetingId等于当前data_id
    - 多动作并行：按“查询→新增”顺序执行（查询为新增提供数据校验，避免冲突），分别生成对应操作的Card，汇总为数组返回
5.  单次触发约束：同一用户指令无论包含多少条灵感、多少种操作（新增/查询），仅触发一次Skill，一次性完成所有操作并返回汇总结果

## 七、后置处理要求
1.  工具调用完成后，仅输出标准灵感Card JSON结构（单个/数组），禁止添加任何自然语言总结、说明
2.  所有输出必须严格对齐字段规范，不新增、不删减、不修改字段名、不篡改字段值；新增的status和error_msg字段必须按要求填写，不得遗漏
3.  查询动作的返回结果，需套入上述标准Card结构，仅将action改为“query”即可
4.  失败操作必须明确填写error_msg，不得空白；成功操作error_msg必须留空，status统一为success
5.  多条灵感/多动作并行时，必须以数组形式返回，每条灵感对应一条Card，不得合并字段
6.  严格遵守新增灵感的特殊要求：meetingId必须等于当前请求的data_id，不得随意修改

## 八、示例（输入→输出）
### 示例1：多条灵感同时创建（含1条创建失败）
#### 用户输入
记录两条灵感：1. 下半年想做一个习惯打卡小程序，顺便记录最近在读一本关于睡眠的书很有启发；2. 秋天想去长白山看雪（第二条灵感创建失败，工具异常）
#### 标准输出（可直接对接前端）
```json
[
  {
    "entity_type": "idea",
    "entity_id": "34ce0b24-f830-4592-8e52-43a1b58f5810",
    "action": "create",
    "status": "success",
    "error_msg": "",
    "display": {
      "type": "idea",
      "title": "下半年计划与阅读启发",
      "content": "# 下半年计划与阅读启发\n下半年想做一个习惯打卡小程序，顺便记录最近在读一本关于睡眠的书很有启发。",
      "json_content": "{\"type\":\"idea\",\"title\":\"下半年计划与阅读启发\",\"content\":\"# 下半年计划与阅读启发\\n下半年想做一个习惯打卡小程序，顺便记录最近在读一本关于睡眠的书很有启发。\"}"
    }
  },
  {
    "entity_type": "idea",
    "entity_id": "a7d8f9e0-1234-5678-90ab-cdef12345678",
    "action": "create",
    "status": "failed",
    "error_msg": "灵感创建失败，工具调用异常，请重试",
    "display": {
      "type": "idea",
      "title": "秋天出行计划",
      "content": "# 秋天出行计划\n秋天想去长白山看雪。",
      "json_content": "{\"type\":\"idea\",\"title\":\"秋天出行计划\",\"content\":\"# 秋天出行计划\\n秋天想去长白山看雪。\"}"
    }
  }
]
```

### 示例2：单次触发多动作并行（查询+新增）
#### 用户输入
查询所有读书启发类灵感，再新增一条灵感“做一个睡眠记录工具，记录每日睡眠时长”
#### 标准输出（可直接对接前端）
```json
[
  {
    "entity_type": "idea",
    "entity_id": "b8c9d0e1-2345-6789-0abc-def12345678",
    "action": "query",
    "status": "success",
    "error_msg": "",
    "display": {
      "type": "idea",
      "title": "阅读启发：睡眠相关书籍",
      "content": "# 阅读启发：睡眠相关书籍\n最近在读一本关于睡眠的书很有启发，了解到规律作息对睡眠质量的重要性。",
      "json_content": "{\"type\":\"idea\",\"title\":\"阅读启发：睡眠相关书籍\",\"content\":\"# 阅读启发：睡眠相关书籍\\n最近在读一本关于睡眠的书很有启发，了解到规律作息对睡眠质量的重要性。\"}"
    }
  },
  {
    "entity_type": "idea",
    "entity_id": "c9d0e1f2-3456-7890-abcd-ef1234567890",
    "action": "create",
    "status": "success",
    "error_msg": "",
    "display": {
      "type": "idea",
      "title": "睡眠记录工具计划",
      "content": "# 睡眠记录工具计划\n做一个睡眠记录工具，记录每日睡眠时长，方便追踪睡眠规律。",
      "json_content": "{\"type\":\"idea\",\"title\":\"睡眠记录工具计划\",\"content\":\"# 睡眠记录工具计划\\n做一个睡眠记录工具，记录每日睡眠时长，方便追踪睡眠规律。\"}"
    }
  }
]
```