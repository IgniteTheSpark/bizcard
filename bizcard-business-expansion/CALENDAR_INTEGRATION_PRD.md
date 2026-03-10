# Calendar 聚合集成架构设计 (MCP 视角)

## 一、 背景与痛点

在商务与营销场景中，“时间”是与“人脉”同等重要的核心资产。
目前的痛点在于：
1. **日历碎片化**：职场人士往往同时使用多个日历（公司强制使用钉钉/飞书安排内部会议，个人使用 Apple Calendar/Google Calendar 安排私事或外部会面）。
2. **缺乏全局视角**：在安排新的商务会面时，经常需要在多个 App 之间来回切换检查冲突。
3. **Agent 缺乏时间感知**：当用户对 Ask Agent 提出“帮我约 Kevin 下周见”时，Agent 如果没有日历权限，就只能给出空洞的建议，无法闭环执行。

## 二、 解决方案与核心理念

基于 BizCard 的 Agent 架构，我们采用 **“基于 MCP 的插拔式集成 (Integration Hub)”** 策略。

- **不做自研日历底座**：BizCard 不从零开发复杂的日历系统，而是作为**“时间的聚合器与路由”**。
- **MCP 标准化接入**：将各类第三方日历（钉钉、飞书、苹果、谷歌）封装为独立的 MCP Server。Agent（Nanobot）只需要学会调用一组标准的 MCP Tools（如 `check_availability`, `create_event`），无需关心底层是哪个平台的日历。

---

## 三、 架构设计与数据流

### 3.1 授权与绑定 (Integration Hub)
在 BizCard App 中新增 `Connected Apps` (集成中心) 页面。
- 用户可在此授权绑定钉钉、飞书、Google Calendar、Outlook 等。
- 绑定完成后，BizCard 后台保存相应的 OAuth Token 或 OpenAPI 鉴权凭证。

### 3.2 MCP Server 矩阵
BizCard 后台部署（或对接）多个针对具体平台的 MCP Server 实例：
- `mcp-server-feishu`: 封装飞书日历 OpenAPI。
- `mcp-server-dingtalk`: 封装钉钉日历 OpenAPI。
- `mcp-server-gcal`: 封装 Google Calendar API。
- `mcp-server-apple`: 封装 Apple Calendar (通过特定通道同步)。

### 3.3 统一的日历原子能力 (MCP Tools)
为了屏蔽底层差异，向 Agent 暴露的工具必须是抽象和统一的。以下是 Ask Agent 会加载的统一日历 Tools：

1. **`get_unified_schedule(time_range)`**
   - **描述**：获取指定时间段内，用户在所有已绑定平台上的合并日程列表。
   - **参数**：`start_time`, `end_time`。
   - **Agent 用途**：当用户问“我下周一忙吗”，Agent 调用此工具，后台会并发请求所有绑定的 MCP Server，将结果聚合后返回给 Agent。

2. **`check_time_conflict(target_time, duration)`**
   - **描述**：检查特定时间段是否有任何日历冲突。
   - **参数**：`target_time`, `duration_minutes`。
   - **Agent 用途**：Agent 在尝试为用户排期前，先调此工具探路。

3. **`create_unified_event(payload)`**
   - **描述**：创建一个日程，并**同步推送到用户指定的首选日历**（或全部日历）。
   - **参数**：`title`, `start_time`, `end_time`, `attendees`, `target_platform` (可选，默认为用户设置的首选工作日历)。
   - **Agent 用途**：完成会议邀约的最终闭环。

---

## 四、 核心场景交互流 (Ask Agent 结合 Calendar)

### 场景一：智能避冲排期

**User**: “根据刚才和 Kevin 的会议记录，帮我约他下周找个时间喝咖啡再聊聊。”
**Agent 内部流转**:
1. Agent 提取意图：安排与 Kevin 的咖啡会面（预计 1 小时）。
2. Agent 调用 `get_unified_schedule(next_week)` 获取用户下周的全局日历空闲时间（综合了飞书和苹果日历）。
3. Agent 发现“下周三下午 3-4点”和“下周四上午 10-11点”双端皆空闲。
4. Agent 组合 `Cards` 和 `Text` 回复用户。
**Agent 回复**: “好的，根据您的全局日历，我建议安排在下周三下午 3:00 或下周四上午 10:00。您看哪个合适？确认后我将为您发送邀约并同步到飞书日程。”

### 场景二：与 2.0 硬件结合的 Morning Briefing

此流程为后台定时任务（Cron Job），不需要用户主动询问：
1. **凌晨 6:00**：BizCard 后台触发，调用 `get_unified_schedule(today)`，拿到飞书的 3 个会议和苹果日历的 1 个私人提醒。
2. **结合 Contacts**：后台发现其中一个会议是与 `Contact: Kevin` 开会，提取 Kevin 的近期高优动态（如昨天刚发过跟进邮件）。
3. **排版生成**：生成一张包含统一时间轴和 Kevin 核心要点的精美图片。
4. **推送到端**：通过低功耗蓝牙推送到 MeCard 硬件的 E-ink 屏幕上。用户起床一看硬件，今日战况一目了然。