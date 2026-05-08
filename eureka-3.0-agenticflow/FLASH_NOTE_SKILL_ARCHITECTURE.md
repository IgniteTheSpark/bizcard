# 闪念 Skill 架构

**版本**：v0.3  
**状态**：草案（已按 Asset + Session 主模型收敛）  
**关联文档**：
- [ASSET_AND_SESSION_ARCHITECTURE.md](./ASSET_AND_SESSION_ARCHITECTURE.md)（资产与 Session 统一架构）
- [APP_PRD.md](./APP_PRD.md)（App 入口、Session 与展示边界）

---

## 一、文档定位

本文档只定义“闪念录音”进入 Agentic Flow 后，如何被拆解、路由、落库和追溯。

闪念不定义独立结果表，也不定义独立记录模型。内容类结果统一写入 `assets` 表；操作类结果、候选确认、失败信息统一写入 `Session.output.items[]`。

---

## 二、闪念的本质

闪念是一次短语音输入，通常来自硬件录音入口。它的特点是：

- 输入短；
- 意图可能离散；
- 一句话里可能同时包含任务、想法、联系人信息或其他业务记录；
- 结果需要能在 App 内追溯、确认和继续追问。

典型输入：

> “帮我创建一个今晚 5 点开会的代办，同时记录一下 Kevin 喜欢喝拿铁。”

这句话包含两个意图：

1. 创建一个 Todo；
2. 更新某个 Kevin 的 Contact 信息。

---

## 三、整体流程

```text
[闪念录音]
  ↓
[创建 File，写入音频 url]
  ↓
[ASR 转写，写入 File.parsed_content]
  ↓
[追加 input 到 flash_note Session]
  ↓
[flash-note-dispatcher 拆解意图]
  ├─ todo-sub-skill     → Todo Asset
  ├─ idea-sub-skill     → Idea Asset
  ├─ note-sub-skill     → Note Asset
  └─ contact-sub-skill  → Contact 操作结果 / 候选确认
  ↓
[写入 assets 与 Session.output.items[]]
  ↓
[App 展示 Session 详情，用户可认领、确认、追问]
```

关键原则：

- 每次录音都是 `Session.inputs[]` 中的一条 input。
- 每次录音都是一个 `turn_input`，不进入 Session sources。
- 每次录音都需要在对应 Turn 内展示原始音频信息和 ASR 转录文本；它不是 `anchor_input`，但仍然是该轮对话的完整输入上下文。
- 用户在该 Session 内继续文字追问时，也会生成新的 `turn_input` 和新的 turn。
- 每条 Asset 都携带 `source_session_id` 与 `source_input_id`。
- Contact 更新不产生 Asset，而是作为操作结果写入 `Session.output.items[]`。
- 多候选、低置信或需用户判断的操作，不直接写入最终实体，先进入确认流程。

---

## 四、flash-note-dispatcher

`flash-note-dispatcher` 是闪念流程的入口 Skill，负责把完整转写文本拆成多个可执行意图。

### 4.1 输入

```json
{
  "session_id": "session_flash",
  "input_id": "input_001",
  "input_role": "turn_input",
  "input_type": "audio",
  "file_id": "file_audio_001",
  "audio": {
    "duration_sec": 18,
    "recorded_at": "2026-05-06T09:30:00+08:00"
  },
  "transcript": "帮我创建一个今晚5点开会的代办，同时记录一下Kevin喜欢喝拿铁"
}
```

### 4.2 输出

```json
{
  "dispatch": [
    {
      "skill": "todo-sub-skill",
      "extracted_input": "今晚5点开会的代办"
    },
    {
      "skill": "contact-sub-skill",
      "extracted_input": "Kevin喜欢喝拿铁"
    }
  ]
}
```

### 4.3 路由规则

| 意图特征 | 路由 Skill |
|---|---|
| 包含任务、提醒、截止时间 | `todo-sub-skill` |
| 包含想法、灵感、观点、无明确动作 | `idea-sub-skill` 或 `note-sub-skill` |
| 包含联系人姓名 + 可沉淀信息 | `contact-sub-skill` |
| 包含新业务领域，例如财务、健康、词汇 | 对应领域 sub-skill |
| 无法判断 | 生成 `unknown` output item，保留原始转写 |

dispatcher 不需要硬编码所有业务规则。新增领域时，只需要在可注册 Skill 清单中补充触发条件和输出 schema。

---

## 五、子 Skill 输出契约

### 5.1 todo-sub-skill

将待办意图转成 Todo Asset。

```json
{
  "type": "asset_created",
  "asset": {
    "asset_type": "todo",
    "source_type": "flash_note",
    "source_session_id": "session_flash",
    "source_input_id": "input_001",
    "payload": {
      "title": "今晚5点开会",
      "due_at": "2026-05-06T17:00:00+08:00",
      "status": "pending_confirmation"
    }
  }
}
```

Todo 初始为 `pending_confirmation`，用户认领后进入正式 Todo 列表。

### 5.2 idea-sub-skill

将想法、灵感或无明确动作的信息转成 Idea Asset。

```json
{
  "type": "asset_created",
  "asset": {
    "asset_type": "idea",
    "source_type": "flash_note",
    "source_session_id": "session_flash",
    "source_input_id": "input_001",
    "payload": {
      "content": "可以考虑给销售团队做一个客户偏好标签系统",
      "tags": []
    }
  }
}
```

### 5.3 contact-sub-skill

识别输入中的联系人对象和待更新信息，查询候选 Contact，并在满足条件后更新 Contact 字段。

它不是只能更新 `notes[]`。只要用户语义明确，Contact 的任意可编辑字段都可以成为更新目标，例如：

- `name`
- `company`
- `title`
- `phone`
- `email`
- `avatar_url`
- `notes`
- 未来扩展的画像字段

#### 唯一高置信匹配

当候选唯一且字段意图明确时，可以直接生成更新结果：

```json
{
  "type": "contact_updated",
  "contact_id": "contact_kevin_001",
  "source_session_id": "session_flash",
  "source_input_id": "input_001",
  "update": {
    "field": "notes",
    "operation": "append",
    "value": "喜欢喝拿铁"
  },
  "message": "已更新 Kevin Chen 的联系人信息"
}
```

如果用户说的是“Kevin 的公司改成 Acme Corp”，则更新结果可以是：

```json
{
  "type": "contact_updated",
  "contact_id": "contact_kevin_001",
  "source_session_id": "session_flash",
  "source_input_id": "input_001",
  "update": {
    "field": "company",
    "operation": "set",
    "value": "Acme Corp"
  },
  "message": "已将 Kevin Chen 的公司更新为 Acme Corp"
}
```

#### 多候选或低置信匹配

当出现多个 Kevin、姓名不完整、字段意图不明确时，不直接写入 Contact，而是生成确认项：

```json
{
  "type": "contact_update_pending",
  "source_session_id": "session_flash",
  "source_input_id": "input_001",
  "extracted_update": {
    "field": "notes",
    "operation": "append",
    "value": "喜欢喝拿铁"
  },
  "candidates": [
    { "contact_id": "contact_kevin_001", "name": "Kevin Chen", "company": "Acme Corp" },
    { "contact_id": "contact_kevin_002", "name": "Kevin Wang", "company": "Beta Inc" }
  ],
  "message": "找到多个 Kevin，请确认要更新哪一位"
}
```

用户确认后，再执行实际 Contact 更新，并在该 Session 中追加结果。

---

## 六、Session 写入规则

闪念处理结果统一写入当前 `flash_note` Session：

```json
{
  "id": "session_flash",
  "session_type": "flash_note",
  "inputs": [
    {
      "input_id": "input_001",
      "turn_id": "turn_001",
      "input_role": "turn_input",
      "input_type": "audio",
      "file_id": "file_audio_001",
      "audio": {
        "duration_sec": 18
      },
      "transcript": "帮我创建一个今晚5点开会的代办，同时记录一下Kevin喜欢喝拿铁",
      "text": null,
      "created_at": "2026-05-06T09:30:00+08:00"
    }
  ],
  "turns": [
    {
      "turn_id": "turn_001",
      "input_ids": ["input_001"],
      "output": {
        "text": "我提取到了一个待认领 Todo，并发现一条可能属于 Kevin 的联系人信息。",
        "items": [
          { "type": "asset_created", "asset_id": "asset_todo_001" },
          { "type": "contact_update_pending", "candidates": ["contact_kevin_001", "contact_kevin_002"] }
        ]
      }
    }
  ],
  "output": {
    "items": [
      { "type": "asset_created", "asset_id": "asset_todo_001" },
      { "type": "contact_update_pending", "candidates": ["contact_kevin_001", "contact_kevin_002"] }
    ]
  },
  "messages": []
}
```

`output.items[]` 的 type 枚举以 [ASSET_AND_SESSION_ARCHITECTURE.md](./ASSET_AND_SESSION_ARCHITECTURE.md) 中的统一定义为准。闪念常用类型包括 `asset_created`、`contact_updated`、`contact_update_pending`、`unknown` 和 `error`。

---

## 七、App 展示边界

本阶段不在本文档中锁定具体 UIUX 形态。

App 只需要能消费以下结构化结果：

- 新创建的 Asset；
- 待认领的 Todo；
- 已更新的 Contact；
- 待确认的 Contact 候选；
- 无法分类的原始转写；
- 失败信息；
- 后续追问产生的新消息和新 output item。

具体展示是卡片、列表、气泡还是确认面板，应在 UIUX 阶段统一定义。

---

## 八、边界情况

| 场景 | 处理方式 |
|---|---|
| ASR 失败或文本为空 | 不触发业务 Skill，写入 `error` item 或提示用户重试 |
| 意图无法分类 | 写入 `unknown` item，保留原始转写 |
| 意图过多 | 优先处理高置信意图，其余合并为 Idea / Note |
| Contact 多候选 | 写入 `contact_update_pending`，由用户确认 |
| Contact 不存在 | 创建草稿 Contact，或降级为 Idea / Note |
| 字段更新不明确 | 生成确认项，不直接写入 |
| 用户离线 | 音频先本地暂存，联网后补处理并写入 Session |

---

## 九、扩展规范

新增一个闪念领域能力时，需要补充：

1. 触发条件：什么样的输入会路由到该 Skill；
2. 输出类型：生成 Asset，还是生成操作类 output item；
3. Asset payload schema 或 output item schema；
4. App 需要支持的最低展示信息；
5. 是否需要用户确认。

后端仍然使用统一 `assets` 与 `sessions` 结构，不新增闪念专属结果表。
