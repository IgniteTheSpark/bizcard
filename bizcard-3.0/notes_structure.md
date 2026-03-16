# Notes 体系多态数据结构说明

在 BizCard 3.0 中，我们将原有的单一 `Meeting` 泛化为统一的 `Note` 体系。
**但由于不同来源的 Note（如深度会议 vs 手动随手记）所挂载的数据量级和类型差异巨大**（例如会议有长录音、复杂思维导图、多方人员；而随手记只有纯文本），如果强行把所有字段塞进一个扁平的结构里，会导致存在大量冗余的“空字段”（`null` 或 `undefined`）。

因此，我们在底层架构上采用了**“多态结构 (Polymorphic Structure) / 标签联合 (Tagged Union)”** 的设计模式。

## 核心设计思路：基础层 + 载荷层 (Base + Payload)

所有类型的 Note 都共享一个轻量级的 **Base Note** 结构，用于支撑“信息流 (Feed)”和“全局搜索”的展示；
而特定于某种 Note 的复杂数据（录音、逐字稿、结构化纪要等），则放在专门的 **Payload (载荷/扩展字段)** 中。

---

### 1. Base Note (通用基础结构)
无论是什么类型的 Note，都必须包含以下通用字段。列表页 (Timeline/Home) 仅拉取这部分数据即可完成渲染。

```typescript
interface BaseNote {
    id: string;               // 唯一标识 (e.g., 'note_001')
    type: NoteType;           // 核心枚举: 'MEETING' | 'VOICE_MEMO' | 'MANUAL' | 'IDEA'
    title: string;            // 标题 (AI生成或手动修改)
    date: string;             // 发生/创建日期 (YYYY-MM-DD)
    time: string;             // 发生/创建时间 (HH:MM)
    contactIds: string[];     // 参与或被提及的联系人 IDs
    actionIds: string[];      // 从该 Note 派生出的待办 IDs
    summary: string;          // 列表卡片上展示的短摘要 (1-2句话)
}
```

---

### 2. 差异化载荷 (Specific Payloads)

在进入 Note 的详情页时，系统会根据 `type` 字段解析额外的特定属性。

#### A. Meeting Payload (会议/交谈)
最重型的多模态资产。包含长音频、大模型深度处理结果、甚至衍生的文件。

```typescript
interface MeetingNote extends BaseNote {
    type: 'MEETING';
    
    // 媒体资源
    audioUrl: string;         // 原始录音文件的云端地址
    duration: number;         // 录音总时长(秒)
    
    // 文本资产
    transcript: string;       // ASR 完整逐字稿 (带 Speaker 角色分离)
    
    // AI 深度处理资产
    summaryData: {
        overview: string;     // 会议总体概述
        topics: Array<{       // 分议题记录
            title: string;
            detail: string;
        }>;
        highlights: string[]; // 金句提取
    };
    
    // 衍生资产 (可选)
    mindmapUrl?: string;      // AI 依据逻辑生成的思维导图/白板数据
    attachmentIds?: string[]; // 会议中提到并关联的文件/PPT
}
```

#### B. Voice Memo Payload (闪念/灵感)
偏个人的轻量级语音资产。

```typescript
interface VoiceMemoNote extends BaseNote {
    type: 'VOICE_MEMO';
    
    // 媒体资源
    audioUrl: string;         // 闪念短录音地址
    duration: number;         // 录音时长(秒)
    
    // 文本资产
    transcript: string;       // 闪念的原话
    
    // 注意：没有结构化的 summaryData 和 mindmap，
    // 因为闪念往往只是一两句话，直接复用 BaseNote 中的 `summary` 即可。
}
```

#### C. Manual Payload (手动记录)
没有录音，完全依赖用户手动输入的资产。

```typescript
interface ManualNote extends BaseNote {
    type: 'MANUAL';
    
    // 内容资产
    content: string;          // 用户手动打字输入的正文 (支持 Markdown/富文本)
    
    // 外部导入元数据 (如果是从其他系统同步过来的)
    sourceApp?: 'notion' | 'feishu' | 'dingtalk';
    externalLink?: string;    // 跳转回原文档的链接
}
```

#### D. Idea Payload (想法)
由用户主动发起、基于一条或多条 Note、经 AI 生成的衍生产出；归类为 Note 的一种类型，在列表与筛选中与会议/闪念/手输并列。

```typescript
interface IdeaNote extends BaseNote {
    type: 'IDEA';
    
    // 内容资产
    content: string;          // 富文本或 Markdown，AI 生成的主体内容
    ideaType?: 'plan' | 'report' | 'research' | 'other';  // 方案 / 报告 / 调研 等
    
    // 来源关联
    sourceNoteIds: string[];  // 来源 Notes 的 id 列表（≥1）
    
    // 可选
    status?: 'draft' | 'final';
}
```

---

## 数据管理优势总结

1. **列表渲染极速**：首页或 Timeline 拉取列表时，只需按 `BaseNote` 的结构加载。不需要下载庞大的 `transcript` 和 `summaryData`，大幅减少接口带宽和前端渲染压力。
2. **UI 拓展性高**：对于列表中的项，可以统一使用一种卡片组件，仅通过读取 `type` 属性更换图标（🎙️、💭、⌨️、💡）；而在进入详情页 (Detail View) 时，则根据类型分发给不同的组件进行深度渲染（如播放器组件仅对 Meeting/Memo 呈现，Idea 展示内容与来源 Note 关联）。
3. **数据一致性**：`contactIds` 和 `actionIds` 被强行约束在基类中，保证了无论是什么来源的记录，都能完美融合进“人脉视图”和“待办视图”中。