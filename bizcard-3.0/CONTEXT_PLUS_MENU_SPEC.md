# Context 下「+」弹窗规范（统一版）

## 1. 文档目标

定义全局悬浮 Toolbar 中右侧 `+` 的行为规范，统一不同页面的新增动作入口，避免口径不一致。

---

## 2. 统一交互原则

- `+` 点击后默认弹出底部 `Action Sheet`（特殊场景可直达）。
- 每个场景建议 1-3 个主动作，优先展示高频动作。
- 新增动作完成后应自动回到当前页面，并刷新当前列表/详情。
- 若新增对象与当前上下文存在关联，系统应自动带入关联字段。
- 文案命名统一使用单数：`Add Note`、`Add Event`、`Add Reminder`（避免 `Notes/Events` 混用）。

### 2.1 「添加参会人」语义区分

- 在 `Note` 详情中，`添加参会人` 指给该 Note 绑定联系人关系（Note-Contact 聚合）。
- 在 `Event` 详情中，`添加参会人` 指给会议补充 attendee（Event-Attendees），并尝试匹配到 Contact。
- 两者是不同数据写入路径，不应复用同一提交逻辑。

---

## 3. 场景分类与弹窗项

## 3.1 Global（全局）

弹窗项：
1. `添加 Audio 文件`

说明：
- 触发上传本地音频流程，进入既有导入/转写链路。

---

## 3.2 详情类（Detail）

## 3.2.1 Note 详情

弹窗项：
1. `添加参会人`
2. `添加与该 Note 相关 Reminder`
3. `添加会议图片`

关联建议：
- Reminder：`source_note_id = current_note_id`
- 参会人：关联到当前 Note 的联系人聚合关系
- 会议图片：作为与当前 Note 关联的素材资产

## 3.2.2 Contact 详情

弹窗项：
1. `添加与该联系人相关 Reminder`
2. `添加与该联系人相关 Tag`（待定）

关联建议：
- Reminder：自动带入 `contact_id = current_contact_id`
- Tag：若上线，默认绑定当前联系人

## 3.2.3 Event 详情

弹窗项：
1. `添加与该会议相关 Reminder`
2. `添加 Note`
3. `添加参会人`

关联建议：
- Reminder：`related_event_id = current_event_id`
- Note：`event_id = current_event_id`
- 参会人：写入 Event 参与人列表，并触发 Contact 匹配流程（若可用）

## 3.2.4 Reminder 详情

弹窗项：
1. `添加新的 Reminder`

关联建议：
- 可继承当前 Reminder 的上下文（如关联 event/contact），具体按实现策略。

---

## 3.3 列表类（List）

## 3.3.1 Contact 列表

弹窗项：
1. `添加联系人`
2. `Scan to Add`
3. `添加 Reminder`

## 3.3.2 Calendar

弹窗项：
1. `添加 Reminder`
2. `添加 Events`

---

## 4. 与 Ask Agent 的衔接

- Context 页底部悬浮 Toolbar 统一三键：`Add note` / `Ask Agent` / `+`。
- `Ask Agent` 负责进入对话；`+` 负责新增动作。
- 通过 `+` 新建的对象应可被 Ask Agent 检索并在 `Related Citations` 中引用。

---

## 5. 验收标准

- Global、详情类、列表类场景的 `+` 弹窗项与本文一致。
- 详情类新增动作完成后，关联关系正确写入。
- 用户取消后无副作用。
- 新增对象在对应页面即时可见，并可被 Ask Agent 检索。
