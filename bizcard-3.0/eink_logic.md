# 硬件 E-ink 内容管理与渲染逻辑图 (E-ink Logic)

在 BizCard 2.0/3.0 架构中，E-ink 墨水屏是一个**“轻量级的外设”**。为了避免在硬件端进行复杂的排版计算和字库存储，我们采用了**“手机端离屏渲染 (Offscreen Rendering) + 蓝牙下发位图 (Bitmap Sync)”**的策略。

此外，为了让用户掌握对这块“第二屏幕”的控制权，我们在 App 内提供了对应的 **E-ink Display Manager (硬件内容管理页)**，用户可以查看看当前推送到屏幕的图像，并对历史沉淀的静态图（如二维码、提词卡片、名片页）进行选择下发或删除。

## 软硬协同核心逻辑流转图

下面是 App 侧与硬件侧的交互与渲染逻辑。

```mermaid
sequenceDiagram
    autonumber
    
    actor User as 用户 / AI (触发源)
    participant AppState as App: 业务状态层<br>(Agent/Notes)
    participant Renderer as App: EinkRenderer<br>(离屏渲染引擎)
    participant Gallery as App: 硬件管理画廊<br>(Gallery Cache)
    participant BLE as App: BLE 通信模块
    participant Hardware as E-ink 硬件

    %% 场景 1：自动推送 (如 AI 提词)
    Note over User, Hardware: 场景 A：AI 动态下发 (如 Copilot 提词)
    User->>AppState: 会议中触发 Agent 提词
    AppState->>Renderer: 请求渲染提词文本: "推荐平安001..."
    
    activate Renderer
    Renderer->>Renderer: 1. 创建 OffscreenCanvas (250x122)
    Renderer->>Renderer: 2. 绘制黑底白字 Header
    Renderer->>Renderer: 3. 文字换行测算 (measureText)
    Renderer->>Renderer: 4. Dithering 降噪转纯 1-bit 黑白
    Renderer-->>AppState: 返回 Bitmap (Buffer)
    deactivate Renderer

    AppState->>Gallery: 自动存入历史图库 (缓存)
    
    AppState->>BLE: 发起自动推送任务
    activate BLE
    BLE->>Hardware: 发送 CMD_WAKE_UP (唤醒硬件)
    BLE->>Hardware: 发送 CMD_PUSH_FULL_FRAME (全刷指令)
    loop 分片传输
        BLE->>Hardware: 切片传输 Bitmap 数据 (e.g. 240bytes/包)
    end
    Hardware-->>BLE: ACK 传输完成
    deactivate BLE
    Hardware->>Hardware: 触发 E-ink 物理刷屏

    %% 场景 2：用户手动管理
    Note over User, Hardware: 场景 B：用户手动管理设备屏幕 (App 硬件管理页)
    User->>Gallery: 打开 App 硬件管理页
    Gallery-->>User: 展示当前的静态图像流 (我的名片/二维码/旧提词)
    User->>Gallery: 选中“我的名片”点击推屏
    Gallery->>BLE: 提取缓存的 Bitmap
    BLE->>Hardware: 发起分片下发更新屏幕...
    
    User->>Gallery: 删除过期的“旧提词”图
    Gallery->>Gallery: 从 App 本地存储中清除，释放空间
```

## 说明
1. **Renderer (离屏渲染)**：极大地降低了硬件 BROM 的压力。我们只需要在 App 内升级渲染器，就能支持更复杂的 UI 布局（如饼图、特殊的品牌字体），硬件只需负责“无脑展示像素”。
2. **Gallery (硬件管理画廊)**：相当于一个中间层缓存。因为某些画面（如个人名片、微信二维码）是高频展示的，将它们缓存在 App 里，用户可以在“E-ink Display Manager”页面（参考 `hardware-manager-demo.html`）实现一键秒切，无需重新调用 Canvas 渲染。