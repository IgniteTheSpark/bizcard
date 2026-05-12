---
name: flash-contact
description: 联系人子 SKILL，处理联系人新增、修改、查询，多条并存；严格对齐前端联系人Card固定JSON结构输出，确保字段无错位、格式标准；支持多联系人同时操作、操作失败异常处理，兼容单次触发下新增/修改/查询多动作并行场景。
metadata:
  flash_thought_v2:
    enabled: true
    intent_type: contact
    skill_name: flash_contact_default
    invoke_key: contact
---

# Flash Contact 业务SOP（严格遵循此规范执行）

## 〇、流水线编排对接（Step 2）

- **触发条件**：`S1.routing.invoke_contact_skill === true`。
- **输入契约**：一次调用覆盖 **全部** `S1.contact.items`；第 `k` 条 Card 对齐 `items[k-1].source_text`。
- **输出契约**：**数组** 长度等于 `items.length`，顺序与 `seq` 一致。
- **fail_reason 对齐**：`error_msg` 可与汇总约定（示例：`缺失字段: firstName`、`未查询到目标联系人，无法执行更新操作`）。
- **下游**：`payload.has_contact`、`contact_raw_content` 来自 `S1`；每条结果写入 `supported_command_results`（`command_type: "contact"`），`saved_content.contact` 映射见 `step3 rules.md` 第七节。

## 一、触发场景
### 匹配规则
仅响应 **联系人新增、修改、查询** 类指令，严格过滤非联系人类信息；支持单次触发指令中包含多个联系人操作（新增/修改/查询并行），仅触发一次Skill即可完成所有操作。
- 保留范围：联系人姓名、电话、邮箱、公司、职位等相关信息及对应操作
- 过滤范围：待办、灵感、网络搜索指令（禁止重复写入联系人）

### 典型触发话术
- 新增：保存联系人刘洋手机13900002222、新增联系人张三，公司XX科技，职位产品经理
- 修改：把联系人刘洋的电话改成13900003333、更新Kevin的公司为XX集团
- 查询：查一下Kevin的联系方式、查询所有XX公司的联系人
- 多动作并行：新增联系人李四（电话13800004444）、修改刘洋的职位为市场经理、查询张三的联系方式

## 二、可用工具列表
| 动作类型 | 工具名称 | 适用场景 |
|----------|----------|----------|
| 新增（单条） | eureka_mind_save_contact | 单个联系人新增 |
| 新增（多条） | eureka_mind_batch_save_contacts | 多个联系人同时新增（优先使用，提升效率） |
| 修改/更新 | eureka_mind_update_contact | 调整已有联系人的姓名、电话、公司、职位等信息 |
| 查询 | eureka_mind_query_contact | 搜索联系人、查询联系人详情；修改前缺目标contactId时，先调用此工具获取id |

meetingId 强约束：
- 当前请求里的 `data_id` 就是所有联系人 MCP tool 入参里的 `meetingId`。
- 只要工具 schema 存在 `meetingId` 字段，每一次调用都必须显式传 `meetingId=<data_id>`，不能省略，不能改名，不能写成别的 id。
- 单条新增：`eureka_mind_save_contact` 必须显式传 `meetingId=<data_id>`。
- 批量新增：`eureka_mind_batch_save_contacts.records[i].meetingId` 必须全部等于当前 `data_id`。
- 查询和更新：如果工具 schema 接受 `meetingId`，也必须显式传相同的 `meetingId`。

## 三、动作路由逻辑
1.  新增（create）：用户明确新增联系人（单条/多条）→ 单条调用eureka_mind_save_contact，多条调用eureka_mind_batch_save_contacts，每条联系人生成独立标准Card结构，最终以数组形式返回；若工具支持meetingId，必须严格等于当前请求里的data_id。
2.  查询（query）：用户查询联系人相关信息 → 调用eureka_mind_query_contact，返回结果套入标准Card结构；若与新增/修改动作并行，同步执行查询操作，分别返回对应结果。
3.  更新（update）：用户修改已有联系人 → 无contactId（entity_id）时，先调用eureka_mind_query_contact获取id，再调用eureka_mind_update_contact；若单次触发中存在多个更新操作，逐条执行查询+更新流程。
4.  多动作并行（单次Skill触发）：同一用户指令中包含新增、修改、查询任意组合动作时，无需多次触发Skill，按“查询→更新→新增”的顺序依次执行，分别生成对应操作的Card结构，最终汇总为数组返回。
5.  失败处理：新增/修改/查询过程中，单个动作失败不影响其他动作执行，失败动作单独标记状态、记录失败原因，成功动作正常返回Card结构。
6.  批量处理要求：若存在batch_items，records必须覆盖batch_items里的每一条联系人，不能漏掉任何一条，也不能只保留最后一条。

## 四、强制输出规范（核心，必须严格遵守）
### 最终输出JSON结构（对齐前端联系人Card，禁止修改字段名、增减字段）
#### 单个联系人操作输出
```json
{
  "entity_type": "contact",
  "entity_id": "优先取items.contactId，无则生成标准UUID",
  "action": "create|query|update",
  "status": "success|failed", // 新增字段，标记当前联系人操作状态
  "error_msg": "", // 新增字段，操作失败时填写失败原因，成功时留空
  "display": {
    "name": "从items.firstName取值，原样保留，不篡改、不缩写",
    "title": "从items.title取值，无则留空字符串",
    "company": "从items.company取值，无则留空字符串",
    "avatar": "", // 固定留空字符串，禁止填写内容
    "phone": "从items.phone取值，无则留空字符串"
  }
}
```

#### 多个联系人/多动作并行输出（数组形式）
```json
[
  {
    "entity_type": "contact",
    "entity_id": "优先取items.contactId，无则生成标准UUID",
    "action": "create|query|update",
    "status": "success|failed",
    "error_msg": "",
    "display": {
      "name": "联系人姓名1",
      "title": "联系人职位1（无则留空）",
      "company": "联系人公司1（无则留空）",
      "avatar": "",
      "phone": "联系人电话1（无则留空）"
    }
  },
  {
    "entity_type": "contact",
    "entity_id": "优先取items.contactId，无则生成标准UUID",
    "action": "create|query|update",
    "status": "success|failed",
    "error_msg": "",
    "display": {
      "name": "联系人姓名2",
      "title": "联系人职位2（无则留空）",
      "company": "联系人公司2（无则留空）",
      "avatar": "",
      "phone": "联系人电话2（无则留空）"
    }
  }
]
```

### 字段强制约束（不可突破）
1.  entity_type：固定为“contact”，禁止修改
2.  action：仅可取值“create”“query”“update”，与当前动作严格对应
3.  entity_id：优先使用工具返回的contactId；无contactId时，自动生成标准UUID（如：5cb67479-87f4-41cc-b96a-7d6bac1e73be）
4.  status（新增字段）：仅可取值“success”（操作成功）、“failed”（操作失败），与实际操作结果严格对应
5.  error_msg（新增字段）：操作失败时，填写具体失败原因（例：“联系人创建失败，工具调用异常”“未查询到目标联系人，无法更新”）；操作成功时，留空字符串
6.  display.name：严格从items.firstName取值，原样保留联系人姓名，不得随意修改、缩写；无姓名时留空，禁止编造
7.  display.title：从items.title取值，无职位信息时留空字符串，禁止编造
8.  display.company：从items.company取值，无公司信息时留空字符串，禁止编造
9.  display.avatar：固定留空字符串，禁止填写任何内容
10. display.phone：从items.phone取值，无电话信息时留空字符串，禁止编造；电话格式无需额外格式化，原样保留用户输入
11. 特殊要求：若工具支持meetingId，必须严格等于当前请求里的data_id，禁止猜测、禁止改写成其他字段

## 五、内部自检中间响应格式（Agent自检用，不对外暴露）
保留中间自检格式，便于Agent快速校验操作结果、定位异常，简化冗余字段，降低维护成本，格式如下：
```json
{
  "status": "completed|needs_confirmation|part_failed|all_failed",
  "items": [
    {
      "op": "create|query|update",
      "contactId": "string",
      "firstName": "string",
      "title": "string",
      "company": "string",
      "phone": "string"
    }
  ],
  "errors": [
    "整体错误/缺参提示文案（如：部分联系人操作失败，请查看对应error_msg；请补充联系人姓名/电话）"
  ]
}
```

### 状态分支规则
1.  status: completed
    - 触发条件：所有联系人操作（单个/多个）信息完整、成功解析，所有动作执行成功，生成符合规范的Card结构
    - 要求：errors数组为空，所有items信息完整，符合字段规范；无编造信息
2.  status: needs_confirmation
    - 触发条件：部分/全部联系人缺失姓名等关键必填信息（姓名为核心必填项，无姓名则无法完成操作）
    - 要求：禁止编造缺失信息，errors[0]明确提示需补充的内容（例：“请补充2条联系人的姓名”“请补充联系人刘洋的电话”）；已获取完整信息的联系人可正常执行，缺失信息的联系人暂不执行
3.  status: part_failed
    - 触发条件：单次触发中，部分联系人操作（新增/修改/查询）成功，部分失败（如：2条联系人新增，1条成功1条失败）
    - 要求：errors[0]提示整体状态（例：“部分联系人操作失败，请查看对应error_msg”）；成功操作正常返回Card，失败操作标记status=failed并填写error_msg
4.  status: all_failed
    - 触发条件：所有联系人操作均失败（如：工具调用异常、所有联系人信息无效、无核心必填信息）
    - 要求：errors[0]明确写明整体失败原因（例：“所有联系人操作失败，工具调用异常，请重试”“所有联系人缺失姓名，无法执行操作”）；所有联系人Card标记status=failed并填写对应error_msg

## 六、辅助解析规则
1.  核心提取：从用户自然语言中，提取所有联系人相关的“姓名、电话、公司、职位、操作类型（新增/修改/查询）”，区分每条联系人及对应动作，不遗漏、不混淆；严格过滤待办、灵感、网络搜索等非联系人内容。
2.  信息处理：所有联系人信息原样保留，禁止编造姓名、电话、邮箱、公司等任何信息；缺失的字段留空，不随意补充。
3.  异常处理：
    - 缺失关键信息（核心为姓名）时，不编造内容，对应联系人标记为needs_confirmation，不影响其他完整联系人执行
    - 单个联系人操作失败（如创建失败、修改失败、查询失败），不中断其他联系人操作，失败联系人单独记录状态和原因
    - 工具调用异常时，对应联系人操作标记为failed，error_msg填写“工具调用异常，请重试”
    - 若工具 schema 存在 `meetingId` 但入参未显式传入 `meetingId=<data_id>`，本次调用视为错误，不要省略该字段
    - 修改时无contactId（entity_id）且查询不到目标联系人，操作失败，error_msg填写“未查询到目标联系人，无法执行更新操作”
    - 若工具支持meetingId但与当前请求data_id不匹配，操作失败，error_msg填写“meetingId与当前请求data_id不匹配，操作失败”
4.  多条处理/多动作并行：
    - 多条联系人：逐条拆解，每条生成独立Card对象，单条新增用对应工具，多条新增优先用批量保存工具；若存在batch_items，records必须覆盖所有batch_items，不遗漏任何一条
    - 多动作并行：按“查询→更新→新增”顺序执行（查询为更新提供contactId，避免冲突），分别生成对应操作的Card，汇总为数组返回
5.  单次触发约束：同一用户指令无论包含多少条联系人、多少种操作（新增/修改/查询），仅触发一次Skill，一次性完成所有操作并返回汇总结果

## 七、后置处理要求
1.  工具调用完成后，仅输出标准联系人Card JSON结构（单个/数组），禁止添加任何自然语言总结、说明
2.  所有输出必须严格对齐字段规范，不新增、不删减、不修改字段名、不篡改字段值；新增的status和error_msg字段必须按要求填写，不得遗漏
3.  查询动作的返回结果，需套入上述标准Card结构，仅将action改为“query”即可
4.  失败操作必须明确填写error_msg，不得空白；成功操作error_msg必须留空，status统一为success
5.  多条联系人/多动作并行时，必须以数组形式返回，每条联系人对应一条Card，不得合并字段
6.  严格遵守特殊要求：若工具支持meetingId，必须等于当前请求的data_id，不得随意修改；禁止编造任何联系人相关信息

## 八、示例（输入→输出）
### 示例1：多条联系人同时创建（含1条创建失败）
#### 用户输入
新增两条联系人：1. 刘洋，电话13900002222；2. 张三，公司XX科技（第二条缺失电话，创建失败）
#### 标准输出（可直接对接前端）
```json
[
  {
    "entity_type": "contact",
    "entity_id": "5cb67479-87f4-41cc-b96a-7d6bac1e73be",
    "action": "create",
    "status": "success",
    "error_msg": "",
    "display": {
      "name": "刘洋",
      "title": "",
      "company": "",
      "avatar": "",
      "phone": "13900002222"
    }
  },
  {
    "entity_type": "contact",
    "entity_id": "a7d8f9e0-1234-5678-90ab-cdef12345678",
    "action": "create",
    "status": "failed",
    "error_msg": "联系人创建失败，核心信息缺失（可补充电话后重试）",
    "display": {
      "name": "张三",
      "title": "",
      "company": "XX科技",
      "avatar": "",
      "phone": ""
    }
  }
]
```

### 示例2：单次触发多动作并行（查询+更新+新增）
#### 用户输入
查询联系人刘洋的联系方式，把他的公司改成XX集团、职位改成市场经理，再新增联系人李四（电话13800004444）
#### 标准输出（可直接对接前端）
```json
[
  {
    "entity_type": "contact",
    "entity_id": "5cb67479-87f4-41cc-b96a-7d6bac1e73be",
    "action": "query",
    "status": "success",
    "error_msg": "",
    "display": {
      "name": "刘洋",
      "title": "",
      "company": "",
      "avatar": "",
      "phone": "13900002222"
    }
  },
  {
    "entity_type": "contact",
    "entity_id": "5cb67479-87f4-41cc-b96a-7d6bac1e73be",
    "action": "update",
    "status": "success",
    "error_msg": "",
    "display": {
      "name": "刘洋",
      "title": "市场经理",
      "company": "XX集团",
      "avatar": "",
      "phone": "13900002222"
    }
  },
  {
    "entity_type": "contact",
    "entity_id": "c9d0e1f2-3456-7890-abcd-ef1234567890",
    "action": "create",
    "status": "success",
    "error_msg": "",
    "display": {
      "name": "李四",
      "title": "",
      "company": "",
      "avatar": "",
      "phone": "13800004444"
    }
  }
]
```
