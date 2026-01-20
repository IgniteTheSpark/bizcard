# 会面 / Agent Call 详情页

## 1. 页面定义

该页面是所有互动的落地页。它承载"回顾与跟进"功能。

*   **适用场景:** 
    - **Offline Meeting:** 线下录音归档（通过 BizCard 硬件录音卡片捕获）
    - **Online Agent Call:** 线上接待归档（访客与 Digital Twin 的对话）
    
*   **数据策略:** **不保留录音源文件**。仅存储转录文本 (Transcript)、AI 摘要 (Summary) 及 现场照片 (Photos)。
    
*   **参与者差异:**
    - **Meeting:** 支持多参与人
    - **Agent Call:** 固定为单个 Visitor（Visitor #ID 或已注册用户姓名）

---

## 2. 详情页

### 原型图例

```plaintext
+--------------------------------------------------+
|  < Back                                     [📄] | <--- 右上角查看逐字稿
+--------------------------------------------------+
|                                                  |
|  **Q4 Strategy Review**                          | <--- AI 自动生成标题（可点击重命名）
|  Yesterday 2:30 PM @ Starbucks                   |
|                                                  |
|  **Participants:**                               |
|  [Kevin] [Nancy] [Smith] [+]                     | <--- Meeting: 多人
|                                                  |
|  --- 或 ---                                      |
|                                                  |
|  **Visitor:**                                    |
|  [Visitor #402]                                  | <--- Agent Call: 单人
|                                                  |
|  **Images:** (可选，最多 5 张)                    |
|  [ 🖼️ ] [ 🖼️ ] [ 🖼️ ] [+]                         | <--- 后续手动上传
|                                                  |
|  ----------------------------------------------  |
|                                                  |
|  **Key Points**                                  |
|  • Client confirmed budget for Q1.               |
|  • Interested in the Enterprise API.             |
|  • Need to evaluate competitor pricing.          |
|                                                  |
|  **Action Items**                                |
|  [ ] Send follow-up email                        |
|  [ ] Send API documentation                      |
|  [ ] Schedule demo next week                     |
|                                                  |
|           (User scrolls for more...)             |
|                                                  |
+==================================================+
|      [ 🔗 Share ]  [ ❐ Copy ]  [ ✨ Follow-up ]  | <--- 悬浮操作条
+--------------------------------------------------+
```

### 原型说明

#### 顶部导航

*   左侧: `< Back` (返回上一级)。
    
*   右侧: `[📄]` Transcript 图标。
    
    *   _逻辑:_ 点击跳转至逐字稿/聊天记录二级页。这是唯一的查阅原始对话的入口。
        
#### 头部信息区

*   **标题:** AI 自动生成（如 "Q4 Strategy Review"），支持点击重命名。
    
*   **元数据:** 时间 + 地点（Meeting）或 时间 + Online（Agent Call）。
    
*   **参与人:**
    
    *   **Meeting:** 横向排列的头像列表，支持多人。
        
    *   **Agent Call:** 单个 Visitor 标签。
        
    *   **交互:** 点击头像跳转 Profile；点击 `[+]` 关联新的联系人。
    
    > **说明：** Speaker A/B 的对应暂不支持自动识别，需要用户自行判断。
        
*   **照片墙 (可选):**
    
    *   **来源:** 用户后续从手机相册手动上传（硬件录音卡片不支持拍照）。
        
    *   **限制:** 最多 5 张。
        
    *   **交互:** 点击查看大图；点击 `[+]` 上传新照片。
        
#### 主体内容区

*   **Key Points (摘要):** AI 提炼的结构化要点。
    
*   **Action Items (待办):** AI 提取的后续任务，纯列表 + 复选框形式。
    
*   **可编辑性:** 所有内容均可编辑（本质是 Markdown 文档）。

> **注意:** 这里不显示大段的对话记录，只显示 AI 提炼的高价值结论。
    
#### 底部悬浮操作条

*   **样式:** 页面底部居中悬浮的胶囊形工具栏 (Pill Shape)。
    
*   **按钮:**
    
    1.  `[ 🔗 Share ]`: 生成长图或链接分享 Summary。
        
    2.  `[ ❐ Copy ]`: 复制全部摘要文本。
        
    3.  `[ ✨ Follow-up ]`: 核心功能，唤起跟进弹窗。

---

## 3. 交互逻辑

### 查看 Transcript (二级页)

*   **入口:** 导航栏右上角 `[📄]` 图标。
    
*   **展示形式:**
    
    *   **Meeting 来源:** 剧本模式 (Script Mode)，区分 Speaker A/B。
        
    *   **Agent 来源:** 气泡模式 (Chat Mode)。
        
*   **限制:** 纯文本阅读，不支持点击文字跳转音频（因为音频已删除）。
    
### Action Items 交互

*   **展示:** 纯列表 + 复选框，无单独 CTA。

*   **完成操作:** 用户手动勾选 mark as done。

*   **完成后视觉:**
    - 复选框变为 ✓
    - 文字加删除线 + 变灰

*   **统一 Follow-up:** 通过底部 `[ ✨ Follow-up ]` 按钮，针对整个 Meeting/Agent Call 生成跟进消息。

---

## 4. Quick Follow-up (跟进闭环)
    
### 原型图例

```plaintext
+--------------------------------------------------+
|  Quick Follow-up                          [ X ]  |
+--------------------------------------------------+
|                                                  |
|  [ AI Draft Box (Editable)                 ]     |
|  | Hi Kevin & Nancy,                       |     |
|  | Great meeting today. Here is the summary|     |
|  | and next steps we discussed...          |     |
|                                                  |
|  **To:** [x] Kevin  [x] Nancy  [ ] Smith         |
|                                                  |
|  **Via:** (•) Email   ( ) WhatsApp               |
|                                                  |
+--------------------------------------------------+
|                [  Send Now  ]                    |
+--------------------------------------------------+
```

### 原型说明

*   **触发:** 点击底部悬浮条 `[ ✨ Follow-up ]`。
    
*   **流程 (Bottom Sheet 弹窗):**
    
    1.  **Draft Preview:** AI 基于 Summary 和语气（Formal/Casual）自动生成邮件/消息草稿。用户可编辑。
        
    2.  **Select Recipients:** 复选框列出头部区域的所有 **Participants**。用户勾选发送对象。
        
    3.  **Select Channel:** 选择发送渠道 (Email / WhatsApp / LinkedIn)。
        - 大多数联系人有 Email
        - 如果缺少某渠道联系方式，发送时提示用户补充
        
    4.  **Action:** 点击发送，调起对应 App 并自动填入内容。

---

## 5. 删除功能

### 入口

详情页内提供删除按钮（可放在更多菜单 `[...]` 中）。

### 交互逻辑

1. 点击删除
2. 弹出二次确认弹窗：「删除后将同时移除所有关联的 Action Items，是否确认？」
3. 确认后：
   - 该记录从 Timeline 移除
   - 关联的 Action Items 一并删除
   - 返回 Timeline 页面
