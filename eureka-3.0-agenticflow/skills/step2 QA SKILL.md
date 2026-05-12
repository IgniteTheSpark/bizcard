---
name: flash-qa
description: 问答子 SKILL，处理用户“需要直接回答”的文本片段；支持调用web_search获取外部信息，最终输出结构化answer结果，默认不写卡、不落库，不自动生成note；适配v2端到端实现链路，遵循技能注册、编排调度规范。
metadata:
  flash_thought_v2:
    enabled: false
    intent_type: qa
    skill_name: flash_qa_default
    invoke_key: qa
---

# Flash QA 业务SOP（严格遵循此规范执行）

## 〇、流水线编排对接（Step 2）

- **触发条件**：编排层根据 Step 1（`step1 prompt.md`）结果 `S1.routing.invoke_qa_skill === true` 调用本子 SKILL。
- **输入契约**：优先仅处理 `S1.ai_direct_answer.items[]` 中每条 `source_text`（按 `seq` 升序）；可与完整 `S1.user_text` 一并传入供消歧。**禁止** 处理待办/联系人/idea 已拆出的片段。
- **输出契约**：若仅一条问答，可输出 **单个** JSON 对象；若多条，必须输出 **数组**，长度等于 `items.length`，且 **数组下标与 `seq` 顺序一致**，供 Step 3（`step3 rules.md`）拼接 `ai_answer`。
- **下游**：汇总阶段将映射为 `payload.has_ai_answer` / `ai_question` / `ai_answer`。

## 一、触发场景
### 匹配规则
仅响应 **用户需要直接获取回答** 的指令，严格过滤非问答类信息；支持单次触发指令中包含多个qa任务，仅触发一次Skill即可完成所有问答操作。
- 保留范围：明确要求“解释一下、查一下并告诉我、这个是什么意思、介绍一下、是什么、为什么、怎么样”等需要直接回答的文本片段
- 过滤范围：待办、联系人保存、纯灵感句、需要保存为note的检索需求

### 典型触发话术
- 基础问答：解释一下什么是AI芯片、介绍一下百度公司的核心业务
- 需搜索问答：查一下并告诉我2026年世界移动通信大会举办城市、搜一下最近AI芯片的最新进展并说明

## 二、可用工具列表
| 动作类型 | 工具名称 | 适用场景 |
|----------|----------|----------|
| 网络搜索 | web_search | 问答内容需要外部实时信息、现有知识无法覆盖时，调用此工具获取信息 |
| 无 | 无 | 问答内容可通过现有知识直接回答，无需调用任何工具 |

## 三、动作路由逻辑
1.  任务识别：接收router拆分的qa task，解析用户问答需求，判断是否需要外部信息支撑。
2.  工具调用判断：
    - 无需外部信息：直接基于现有知识生成结构化answer结果，不调用任何工具。
    - 需要外部信息：先调用web_search工具，传入贴合用户原意、补足必要关键词的query，获取搜索结果后，基于结果整理回答。
3.  多任务处理：单次触发中包含多个qa任务时，逐条解析、逐条处理（分别判断是否需要搜索），生成独立的answer结果，最终汇总为统一task result。
4.  失败处理：单个qa任务处理失败（如web_search调用异常、无搜索结果），不影响其他qa任务，失败任务单独标记状态、记录失败原因。

## 四、强制输出规范（核心，必须严格遵守）
### 最终输出JSON结构（单独明确qa skill结果结构，不与cards混淆）
```json
{
  "status": "completed|needs_confirmation|failed",
  "answer": "给用户的直接回复文本，简洁明了、贴合需求，基于现有知识或web_search结果整理，无需多余格式",
  "sources": [
    "string" // 可选，web_search获取信息时，填写关键来源链接；无需搜索时，留空数组
  ],
  "errors": [
    "string" // 状态为needs_confirmation/failed时填写，状态为completed时留空数组
  ]
}
```

### 多个qa任务输出（数组形式，适配多任务汇总）
```json
[
  {
    "status": "completed|needs_confirmation|failed",
    "answer": "第一个问答的直接回复文本",
    "sources": [
      "关键来源链接1（无则留空数组）"
    ],
    "errors": []
  },
  {
    "status": "completed|needs_confirmation|failed",
    "answer": "第二个问答的直接回复文本",
    "sources": [
      "关键来源链接2（无则留空数组）"
    ],
    "errors": []
  }
]
```

### 字段强制约束（不可突破）
1.  status：仅可取值“completed”“needs_confirmation”“failed”，与问答处理结果严格对应
2.  answer：核心字段，必须是给用户的直接回复文本，简洁、准确、贴合需求；基于web_search结果时，需整理为可直接阅读的内容，不堆砌原始搜索结果
3.  sources：可选字段，仅当调用web_search获取信息时，填写1-2个关键来源链接；无需搜索、无有效来源时，留空数组，禁止编造来源
4.  errors：状态为needs_confirmation时，填写需补充的信息（例：“请补充具体的问答主题，如‘解释一下什么是AI’”）；状态为failed时，填写具体失败原因（例：“web_search调用异常，无法获取问答所需信息”“无有效搜索结果，无法生成回答”）；状态为completed时，留空数组
5.  核心约束：默认不写卡、不落库，不自动生成note，不输出cards结构；仅输出上述qa专属结构化结果
6.  web_search约束：调用时query需保留用户原意，补足必要关键词（例：用户说“查一下大会举办城市”，query改为“2026年世界移动通信大会举办城市”）；web_search返回no_results或error时，不编造回答，标记status=failed并填写errors

## 五、内部自检中间响应格式（Agent自检用，不对外暴露）
```json
{
  "status": "completed|needs_confirmation|part_failed|all_failed",
  "items": [
    {
      "op": "answer",
      "needSearch": true|false, // 标记是否需要调用web_search
      "query": "string", // 需要搜索时，填写web_search的query；无需搜索时留空
      "answer": "string", // 初步生成的回答文本
      "sources": [
        "string"
      ]
    }
  ],
  "errors": [
    "整体错误/缺参提示文案（如：部分问答任务失败，请查看对应errors；请补充问答主题）"
  ]
}
```

### 状态分支规则
1.  status: completed
    - 触发条件：所有qa任务（单个/多个）处理完成，无需补充信息，回答生成成功（无论是否调用web_search）
    - 要求：errors数组为空，所有items.answer有效，sources（若有）真实可用
2.  status: needs_confirmation
    - 触发条件：部分/全部qa任务缺失明确问答主题（例：用户仅说“查一下”，未说明查什么）
    - 要求：禁止编造问答主题，errors[0]明确提示需补充的内容（例：“请补充具体的问答主题，明确需要查询或解释的内容”）；已明确主题的qa任务可正常执行，缺失主题的暂不执行
3.  status: part_failed
    - 触发条件：单次触发中，部分qa任务处理成功，部分失败（如：2个qa任务，1个成功生成回答，1个因web_search异常失败）
    - 要求：errors[0]提示整体状态（例：“部分问答任务处理失败，请查看对应errors”）；成功任务正常返回qa结果，失败任务标记status=failed并填写errors
4.  status: all_failed
    - 触发条件：所有qa任务均失败（如：所有问答主题缺失、web_search全部调用异常、无任何有效搜索结果）
    - 要求：errors[0]明确写明整体失败原因（例：“所有问答任务处理失败，未获取到有效问答主题”“web_search调用异常，无法获取问答所需信息”）；所有qa任务均返回对应失败状态及errors

## 六、辅助解析规则
1.  核心提取：从用户自然语言中，提取所有需要直接回答的问答片段，明确每个qa任务的核心需求，区分是否需要外部信息；严格过滤待办、联系人、灵感、需存note的检索需求。
2.  工具调用规范：
    - 无需搜索：用户问答可通过现有知识直接回答（如“解释一下什么是CPU”），不调用任何工具，直接生成answer。
    - 需要搜索：用户问答涉及外部实时信息、现有知识无法覆盖（如“查一下2026年GDP预测数据”），调用web_search，query需精准、完整，补足必要关键词。
3.  异常处理：
    - 缺失问答主题：不编造主题，标记为needs_confirmation，提示用户补充。
    - web_search调用异常：标记对应qa任务status=failed，errors填写“web_search调用异常，无法获取问答所需信息，请重试”。
    - web_search无结果：标记对应qa任务status=failed，errors填写“未搜索到与问答主题相关的有效信息，无法生成回答”。
    - 单个qa任务失败：不中断其他qa任务，独立记录失败状态。
4.  多任务处理：多个qa任务逐条拆解，每条独立判断是否需要搜索、生成answer，最终以数组形式返回qa结果。
5.  单次触发约束：同一用户指令无论包含多少个qa任务，仅触发一次qa skill，一次性完成所有qa任务处理并返回结果。

## 七、后置处理要求
1.  工具调用完成后，仅输出qa专属结构化JSON结果（单个/数组），禁止添加任何自然语言总结、说明；禁止生成note、禁止输出cards结构。
2.  所有输出必须严格对齐字段规范，不新增、不删减、不修改字段名、不篡改字段值；answer文本需简洁准确，贴合用户需求。
3.  调用web_search时，必须基于搜索结果整理answer，禁止编造信息；sources字段仅填写真实有效的来源链接，无来源时留空数组。
4.  失败任务必须明确填写errors，不得空白；成功任务errors必须留空数组，status统一为completed。
5.  多个qa任务时，必须以数组形式返回，每条qa任务对应一个结果对象，不得合并字段。
6.  适配orchestrator汇总要求：输出结果需满足“task result”规范，确保可被orchestrator统一收集、汇总。

## 八、示例（输入→输出）
### 示例1：无需搜索的单个qa任务
#### 用户输入
解释一下什么是AI芯片
#### 标准输出
```json
{
  "status": "completed",
  "answer": "AI芯片（人工智能芯片）是专门为加速人工智能算法（如深度学习、机器学习）运算而设计的集成电路，相比通用CPU，其在并行计算、数据处理效率上更具优势，广泛应用于AI模型训练、推理、智能设备等场景，常见类型包括GPU、TPU、NPU等。",
  "sources": [],
  "errors": []
}
```

### 示例2：需要搜索的单个qa任务
#### 用户输入
查一下并告诉我2026年世界移动通信大会举办城市
#### 标准输出
```json
{
  "status": "completed",
  "answer": "2026年世界移动通信大会（MWC）的举办城市为西班牙巴塞罗那，举办时间预计为2026年2月23日至2月27日，该大会是全球移动通信领域最具影响力的展会之一，聚焦5G、AI、物联网等前沿技术。",
  "sources": [
    "https://www.mwcbarcelona.com/"
  ],
  "errors": []
}
```

### 示例3：多个qa任务（含1个失败）
#### 用户输入
1. 介绍一下长白山；2. 查一下2026年长白山下雪时间（web_search无有效结果）
#### 标准输出
```json
[
  {
    "status": "completed",
    "answer": "长白山位于中国吉林省东南部，是中朝两国的界山，主峰白头山海拔2749米，以壮观的火山地貌、原始森林、天池等景观闻名，是知名旅游胜地，也是满族的发祥地之一。",
    "sources": [],
    "errors": []
  },
  {
    "status": "failed",
    "answer": "",
    "sources": [],
    "errors": [
      "未搜索到与“2026年长白山下雪时间”相关的有效信息，无法生成回答"
    ]
  }
]
```
