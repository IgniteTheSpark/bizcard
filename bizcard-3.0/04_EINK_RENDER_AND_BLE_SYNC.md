# 04 E-ink 位图渲染与蓝牙同步 (E-ink Render & BLE Sync)

## 设计背景
BizCard 2.0 的 E-ink 硬件定位为“低功耗的外设显示屏”，为了解决端侧算力不足、发热、以及对极致长续航的要求，我们确立了**“大脑在手机，排版在手机，呈现交由硬件”**的核心软硬件协同架构。

这意味着，硬件本身不负责解析 JSON 或进行字体排版，App 端需要直接把 UI 渲染成黑白图片（Bitmap）再传给硬件刷屏。

## 核心实现一：App 侧位图离屏渲染引擎 (EinkRenderer)
在接收到 AI 处理结果（如闪念的摘要结果、指令查询出的名片数据、Agent 捕捉到的客户异议应对策略）后，App 端会静默启动渲染引擎。

### 技术链路
1. **离屏画布**：利用 `OffscreenCanvas`（或底层的 Native Canvas 绘图 API）创建一个符合墨水屏分辨率（如 250x122）的不可见画布。
2. **绘制规则**：使用预设的绘制模版（如 `renderNotification`, `renderContact`），通过 `fillText`、`fillRect` 完成纯黑白的文字排版、边距控制与简单线条绘制。
3. **图像抖动处理 (Dithering)**：内置像素级处理方法，将图像通道强行转换为纯 1-bit 黑白两色。
4. **生成产物**：输出最终的黑白位图二进制 Buffer。

## 核心实现二：蓝牙图片传输下发协议 (BleSyncManager)
将上一步生成的纯黑白图像，通过低功耗蓝牙 (BLE) 推送给 E-ink 屏幕。

### 通信流转
1. **唤醒机制**：由于硬件平时处于深度休眠，下发前首先发送 `CMD_WAKE_UP` 指令唤醒硬件。
2. **全刷/局刷控制**：下发 `CMD_PUSH_FULL_FRAME` (全屏慢刷) 或 `CMD_PUSH_PARTIAL_BLOCK` (指定坐标局部快刷) 头部指令。
3. **分片传输 (Chunking)**：受限于 BLE 协议的 MTU（最大传输单元），将图片二进制流按例如 240 字节的大小进行切片轮询写入 Characteristic，实现稳定可靠的流式传输。

## 关联文件
- `bizcard-business-expansion/eink_renderer.js`
- `bizcard-business-expansion/ble_sync.js`
