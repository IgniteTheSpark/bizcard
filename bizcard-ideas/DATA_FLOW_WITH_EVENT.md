# 加入 Event 后的数据流（后端视角）

本文档在「现有录音 → Note」流程基础上，说明引入 Event 后**后端数据流**的调整思路，便于与结构化资产（Note、Event、Reminder 等）一致。

---

## 1. 当前流程（无 Event）

- **硬件录音** → **录音上传** → **生成一条 Note**
- Note 内包含：summary、会议原录音、transcript、会议人（Contact）、Reminders 等。
- 无「日程」实体；日历侧若展示会议，实质是「Note 的列表/按日分组」，没有独立的 Event 模型。

---

## 2. 加入 Event 后的目标语义

- 一次会议在日历上应对应**一个 Event**（已发生的会议也是一个「事件」）；**Note** 是该会议的内容（录音、总结、 transcript 等），挂在这个 Event 下或与之关联。
- 因此：**一次录音上传，应最终既有「可展示在日历上的 Event」，也有「承载内容的 Note」，且两者关联。**

---

## 3. 推荐流程：先 Event，再 Note

**结论：录音上传后，先确定/创建 Event，再创建 Note 并关联到该 Event，是合理且推荐的后端顺序。**

### 3.1 顺序与原因

| 步骤 | 动作 | 说明 |
|------|------|------|
| 1 | 录音上传 | 与现有一致。 |
| 2 | **先处理 Event** | 用本次录音的**元数据**（时间、可选：从 transcript/ASR 抽的标题、参会人）确定「这次会议」对应的 Event。 |
| 3 | 再创建 Note | 异步生成 summary、transcript 等，创建 Note，并**关联到步骤 2 的 Event**（如 `note.eventId` 或 Event 侧存 `noteId`）。 |

**这样做的原因：**

- **Event 是「日程上的一个槽」**：按时间维度看，应先有「这一天发生了这场会」（Event），再有「这场会的内容」（Note）。
- **避免孤立的 Note**：所有会议类 Note 都挂在一个 Event 下，日历展示「某日有哪些 Event」时，每个 Event 可带出关联的 Note、Reminders、Briefing 等，数据结构清晰。
- **与「会议 Note = 历史 Event」一致**：结构化资产里约定会议 Note 用 Event 卡片展示；若底层先有 Event 再挂 Note，展示层直接读 Event + 关联 Note 即可。

### 3.2 Event 的来源：新建 vs 匹配

- **匹配已有 Event**：若用户已把该会议同步到 BizCard 日历（如 Google 同步），则上传的录音应**关联到已有 Event**，而不是再建一个。匹配规则需约定（例如：同一天、时间段重叠或标题/参会人相似）；若匹配到则 **不新建 Event**，只创建 Note 并 `note.eventId = 匹配到的 Event`。
- **新建 Event**：若未匹配到已有 Event，则用**录音时间**（及可选：从内容抽取的标题、参会人）**新建一条 Event**（视为「历史会议」），再创建 Note 并关联到该新 Event。

因此「先 Event」在实现上 = **先解析/匹配或创建 Event，得到 eventId，再写 Note 时带上 eventId**。

### 3.3 简要流程图（文字）

```
录音上传
   ↓
解析元数据（时间、可选：标题/参会人抽取）
   ↓
查找是否已有匹配的 Event（同时间/同标题等）
   ├─ 有 → 得到 eventId
   └─ 无 → 新建 Event（历史会议）→ 得到 eventId
   ↓
异步生成 summary、transcript 等
   ↓
创建 Note，关联 eventId；写入 Reminders、Contact 等
   ↓
（可选）若 Event 为新建，可回写 Briefing 等属性
```

---

## 4. 后端需要调整的点（小结）

- **写顺序**：在现有「上传 → 生成 Note」之间插入「解析/匹配或创建 Event，得到 eventId」；Note 写入时必带 `eventId`（或等价关联）。
- **匹配逻辑**：与日历/同步层配合，定义「同一会议」的匹配规则（时间窗口、标题、参会人等），避免重复 Event。
- **Event 模型**：支持「由录音产生的历史会议」类型（如 `source=recording` 或 `origin=local`），与同步来的 Event 区分即可。
- **Briefing**：若在创建/更新 Event 时写入会前/会后 Briefing，可在本流程的「创建/更新 Event」步骤中一并写入。
- **Reminder、Contact**：仍可挂在 Note 上；若需要也在 Event 层展示，可通过 Note 关联到 Event 做聚合查询，无需改变「Reminder/Contact 主要关联 Note」的现状。

这样加入 Event 后，整体数据流变为：**录音上传 → 先 Event（匹配或新建）→ 再 Note（关联 Event）**，与「Event 承载日程、Note 承载内容」的资产模型一致。
