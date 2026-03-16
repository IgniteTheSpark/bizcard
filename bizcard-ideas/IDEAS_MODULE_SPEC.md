# BizCard Ideas 产品说明（归入 Notes 体系）

## 1. 背景与动机

- **当前 Notes**：会议录音与闪念被统一归纳为 Notes。
  - **会议详情**：总结、关联的 Reminders、关联的人物、Transcript、录音原音频。
  - **闪念详情**：Transcript、录音原音频、关联的 Reminder、关联的人物。
- **产品决策**：**Ideas 归类为 Notes 的一种类型**（即 `Note.type = 'IDEA'`），不再作为独立模块/独立资产。用户基于会议/闪念生成的「想法型产出」以一条 **Idea Note** 的形式存在于同一 Notes 列表与文件夹中，类型筛选为「全部 / 会议 / 闪念 / 想法」。

## 2. 定位（作为 Note 类型）

- **Idea** = 一条 **type 为 `IDEA` 的 Note**，由用户主动创建、基于一条或多条 Note（会议 or 闪念）、经 AI 生成的衍生产出。
- 形态可能是：方案、报告、调研、清单、决策摘要等（可枚举或由用户选择类型）；在列表与筛选中与会议/闪念/手输并列，UI 标识为 💡（想法）。
- 与其它 Note 的关系：Idea Note 通过 `sourceNoteIds` 关联来源 Note；在 Note 详情中可展示「关联的 Ideas」（即关联的 type=IDEA 的 Note）。

## 3. 核心流程

### 3.1 创建 Idea

1. 用户**选择创建**（入口可放在 Ideas 模块内「新建」或 Notes 详情/列表的「生成 Idea」等）。
2. 用户**选择一条或若干条 Notes**（Meeting 或 闪念均可，可多选）。
3. 用户可选**产出类型**（如：方案 / 报告 / 调研 / 其他），或由产品默认一种。
4. **AI 基于所选 Notes 的内容**（总结、Transcript、关联人物与 Reminders 等）**生成一份 Idea**。
5. 生成完成后：
   - 创建一条 **type 为 `IDEA` 的 Note**，进入同一 Notes 列表与文件夹；用户可在首页/列表中通过类型筛选「想法」查看，或点进详情再编辑、删除。
   - 该 Idea Note **与所选 Notes 建立关联**（`sourceNoteIds`）；在来源 Note 详情中可展示「关联的 Ideas」，便于从会议/闪念回溯到衍生产出。

### 3.2 查看与管理

- **列表与筛选**：Ideas 作为 Note 的一种类型，在首页 Notes 列表中与会议/闪念并列展示；类型筛选用「全部 / 会议 / 闪念 / 想法」即可只看 Idea Note。
- **Note 详情**：在会议/闪念详情中增加「关联的 Ideas」区块，展示基于该 Note（或含该 Note 的组合）生成的 Idea Note，可点击跳转至 Idea 详情。

## 4. 内容模型（Idea 作为 Note 类型）

- **Idea Note** 复用 Notes 体系的 BaseNote，`type = 'IDEA'`；载荷层（Idea Payload）建议字段：
  - 基类：`id`、`title`、`date`、`time`、`contactIds`、`actionIds`、`summary` 等（见 bizcard-3.0 的 `notes_structure.md`）。
  - 扩展：`content`（富文本/Markdown）、`ideaType`（方案/报告/调研等，可选）、`sourceNoteIds`（来源 Note 的 id 列表，≥1）、`status`（草稿/已定稿，可选）。

- **Note 侧**：需能查询「哪些 Idea Note 引用了该 Note」并在详情中展示（通过 `sourceNoteIds` 反查）。

## 5. 入口与信息架构

- **查看入口**：Ideas 不再单独设模块入口；在 Notes 首页通过类型筛选「想法」即可查看全部 Idea Note，与会议/闪念同一列表与文件夹。
- **创建入口**：
  - Notes 多选/详情：「生成 Idea」→ 选一条或若干条 Note → 选产出类型 → AI 生成 → 创建一条 type=IDEA 的 Note 并关联来源。
  - 可选：在「+」或列表操作中提供「生成想法」快捷入口，选 Note 后生成。
- 具体交互与 3.0 首页结构一致，见 `NOTES_FOLDERS_SPEC.md` 与 `PRD_OPTION_1_NOTES_FIRST.md`。

## 6. 与现有能力的关系

| 能力       | 与 Ideas 的关系 |
|------------|------------------|
| Notes      | Ideas 的来源；创建后 Idea 关联回 Note，Note 详情展示「关联的 Ideas」。 |
| Reminders  | 仍以 Note/会议为上下文；若 Idea 中衍生出待办，可考虑后续支持「从 Idea 创建 Reminder」（可选）。 |
| Calendar   | Ideas 不直接占日历格；若某 Idea 与某日会议强相关，可通过 Note 关联在会议详情中看到该 Idea。 |
| Agent      | AI 生成 Idea 可走 Agent 或独立接口；后续可支持「基于 Idea 的追问、改写、扩展」等。 |

## 7. 后续可展开点

- Idea 类型枚举与模板（方案/报告/调研的默认结构或提示词）。
- 多选 Notes 时的排序与权重（是否支持「主 Note + 辅助 Note」）。
- 编辑与版本：生成后是否允许用户编辑、是否做简单版本记录。
- 权限与分享：Ideas 是否仅本人可见、是否支持分享或导出。
- 与 Reminder 的联动：从 Idea 中抽取待办并创建 Reminder。

---

本文档作为 Ideas 模块的讨论与产品说明基线，后续可拆为 PRD、交互稿或技术方案。
