# 板卡接入执行流程

改代码前必须确认用户已批准接入设计。设计中应包含官方来源、`boardId`、身份策略、能力层级、通道集合、固件命令、manifest 策略、待改文件和验证命令。

## 1. 软件 Catalog

先更新板卡和针脚事实。

常见文件：

- `app/src-tauri/templates/boards.yaml`
- `app/src/domain/boards/boardCatalog.ts`
- `app/src/domain/boards/*PinCatalog.ts`
- `app/src/domain/boards/*PinoutOverlay.ts`，仅当需要板卡专属针脚图 overlay
- `app/src-tauri/src/core/` 和 `app/src/domain/boards/` 下的 catalog 测试

必须定义：

- board entry
- pin catalog
- 默认 channel template IDs
- 默认或推荐通道集合
- 可选通道集合
- identity policy
- flash strategy
- 只能保留为元数据、不能成为输出通道的针脚
- 设备级扩展能力，例如屏幕、蜂鸣器模式、按钮输入规划
- 设备 I/O 通道方向：输出、输入、固定输入、是否支持 GPIO 双模式
- 同族或同一物理板卡能力变体的独立 `board_id`、独立 artifact、共享固件层、保留针脚和能力裁剪关系
- 输入绑定能力、默认启用状态、可配置快捷键范围
- 屏幕能力的 `sizeClass`、`textEncoding`、title/message 字符限制和 runtime 支持状态

要求：

- `board_id` 必须能从固件 `device_info` 映射到 Board Catalog。
- Board Catalog 暴露的每个通道必须有固件实现支撑。
- 能力变体必须继承共享层实际支持的能力，并显式裁剪外设占用针脚；未占用的普通 GPIO 不得因为 `boardId` 变成 OLED、屏幕或其它变体而丢失输入/输出切换。
- 未知 `board_id` 不能作为完整支持板卡注册；至少不能生成默认通道、规则选项或板卡专属说明。
- 设备扩展能力必须按 catalog 建模，页面和执行链路不得按板卡 ID 写死。
- 支持屏幕输出的板卡必须声明 `deviceExtensions.display`，并按实际尺寸裁剪 payload，不能复用 Wio 长文案后暴力截断。
- 固件页推荐、板卡族分组和能力层级只能作为前端展示元数据；烧录事实仍以 manifest artifact 为准，烧录入口必须按 `artifactId` 选择产物。
- 仅作为未来用户板卡包候选的板卡只能记录方案，不能进入普通用户 UI、可见 manifest artifact、设备注册闭环或规则页能力入口。

## 2. 固件

在 `firmware/boards/<board-id>/` 下实现或扩展固件。

必须实现的协议能力：

- `device_info`
- `ping`
- 支持的输出命令
- 标准成功 ACK 和错误 ACK
- `set_device_uid`，仅用于 `stableUid: limited` 板卡
- `input_event`，仅用于支持按钮、五向键、GPIO 输入或其它上行控件的板卡
- `configure_input`，仅用于需要上位机动态切换 GPIO 输入模式的板卡
- `display_status`，仅用于声明 `deviceExtensions.display.status` 的板卡；支持屏幕输出的固件不能 timeout 或假成功
- `display_lines` 和 `display_clear`，仅用于声明对应显示原语的板卡
- `display_runtime`，仅用于声明运行态屏幕能力的板卡；不得降级伪装成输出规则覆盖页

Arduino 系列优先复用 `firmware/shared/notice_protocol`，不要为每块板复制完整协议解析器。

要求：

- 固件 `board_id` 必须与软件 `boardId` 完全一致。
- `device_uid` 格式必须符合身份策略。
- 受限板卡要显式裁剪不支持的协议分支，不要在 UI 暴露固件无法处理的通道或动作。
- 串口协议要能处理启动噪声、空行、旧 ACK、复位重试和超长命令场景。
- 支持异步输入上行的固件必须保证 `input_event` 不阻塞命令 ACK；软件 ACK 读取层必须能分流事件并继续等待当前响应。
- 支持异步上行输入的传输路径不得在发送命令前清空输入缓冲导致事件丢失；若板卡没有异步输入且确需清理启动噪声，必须在实现和验证中说明。
- 固件协议错误必须返回稳定 `type` 或错误码，软件不能通过 JSON 原文或错误文案做业务判断。
- 屏幕固件必须按 `textEncoding` 和行字节上限处理 payload；不支持中文或 Unicode 的设备必须有确定降级策略，不能让用户误判为未下发。
- 屏幕模板和业务内容由上位机维护；固件不得写死 `task_success`、`build_failed`、`permission_required` 等业务模板 ID。
- 上位机发送 display 原语前必须按目标设备能力渲染和裁剪模板；普通规则配置不应暴露不受控自由长文本，高级自定义也必须受编码、白名单变量和最终 JSON 行字节上限约束。
- 修改 Wio Terminal 等 USB CDC 敏感固件时，必须复测 `device_info`、`ping` 和修改过的设备级命令。

## 3. 构建、打包和 Manifest

更新：

- `firmware/boards/<board-id>/board.toml`
- 固件源码目录
- 构建脚本，仅当新增 toolchain、产物类型或策略时修改
- 通过打包流程生成的 `app/src-tauri/assets/firmware/manifest.json`

要求：

- 固件页按 artifact/target 选择产物，不要只按 `boardId` 假设单一固件。
- Arduino 目标的 FQBN、上传 protocol、speed、1200bps reset、bootloader wait、board options 必须来自 `board.toml` 和 manifest。
- UI、命令层和烧录策略不得按板型猜测上传参数。
- `uf2_mount_copy` 等挂载卷策略与 `arduino_cli_upload` 等串口上传策略必须分别验证。

## 4. 设备识别、注册和运行态

验证：

- 扫描不会打开或占用不必要的未知资源。
- 主动识别会发送 `device_info` 并解析 `board_id`、`device_uid`、固件版本和协议版本。
- `board_id` 存在于 catalog；未知板卡不能被误认为完整支持。
- 注册保存正确 `boardId`、`device_uid` 和默认通道。
- 默认通道来自 catalog，并与固件支持一致。
- 重连使用稳定 UID 或初始化持久 UID，不把动态串口路径当成设备身份。
- 手动连接和自动连接可以用最新扫描资源更新运行态传输通道，但必须在连接成功前校验实际 `device_uid`；失败或 UID 不一致时不得污染 settings 中的持久配置。
- 固件检查能比对 manifest 中的版本、协议和 board。
- 不支持的通道或动作会被拒绝，并给出可诊断错误。
- 断开、重连、自动连接和固件烧录目标选择不会抢占已连接设备端口。
- 已连接设备所有串口读写必须通过设备级 IO worker；监控、诊断、测试和输入监听只能订阅旁路事件，不能打开第二个串口句柄。
- 设备命令必须使用 prepare/execute/complete 或等价两阶段模型，等待硬件 ACK 时不得长时间持有运行态全局锁。
- 连接成功后必须同步当前输入通道配置；在线 GPIO 模式切换必须通过 IO worker 后台下发 `configure_input`，离线只保存待同步配置。
- 心跳、连接、自动连接和诊断必须消费稳定错误码；错误 message 只用于展示和日志。

## 5. 前端 UI

更新：

- 固件页板卡族、能力层级、推荐状态和 artifact 展示
- 设备页可用通道、默认通道和测试动作
- 设备页输入通道、GPIO 模式待确认、输入绑定启用/禁用和快捷键配置
- 设备页输入测试区，仅做可视化高亮和绑定状态展示
- 已连接设备的通信监控入口
- 规则页通道选择、动作参数和设备级扩展能力入口
- 诊断中心设备与固件状态文案
- 硬件说明弹窗、针脚图和连接说明
- i18n 中文和英文文案

要求：

- 前端只能消费 catalog、manifest 和运行态结果，不要按板卡 ID 硬编码功能开关。
- 如果必须按板卡族系区分展示，例如 RP2040 `GPx` 引脚格式或 GPIO 双模式能力，必须封装为 catalog/helper 层的族系判断，并同时覆盖该族系能力变体测试，禁止页面组件只比较精确 `boardId`。
- 设备输入独立于输出规则和 Profile；固定按钮、五向键和 GPIO 输入绑定不得混入输出规则。
- 输出规则新增屏幕入口必须放在 `device-channel` 设备输出规则内，由 `deviceExtensions.display.status` 动态补充虚拟 display 通道；独立 `display` 输出类型只保留旧规则兼容。
- 输入快捷键配置和测试高亮必须复用同一键盘面板组件；前端不得允许保存后端无法执行的符号键。
- 输入绑定禁用后，通道记录和测试区都必须明确展示禁用状态。
- 监控窗口只能从已连接设备打开，不在窗口内切换设备；断开后窗口保留冻结记录。
- 监控窗口列表按旧消息在上、新消息追加到底部；跟随滚动只影响滚动和自动选中，不能暂停后端记录。
- 没有适配针脚图的板卡不要展示错误针脚图；可以展示通用连接和电气说明。
- 用户板卡包能力落地前，不要添加普通用户可见的“自定义固件”入口。

## 6. 测试和验证

新增或更新测试：

- Board Catalog / Pin Catalog 加载和校验
- catalog 通道与固件 `board_channels` 一致性
- 默认通道生成
- firmware manifest 查找和多 artifact 选择
- 设备识别、注册、UID 初始化、固件检查和重连
- 固件页渲染和烧录参数展示
- 设备页与规则页通道可见性
- 设备输入绑定、禁用状态和快捷键校验，若支持输入上行
- GPIO 输入/输出模式切换确认、引用保护、在线 `configure_input` 同步和离线待同步，若支持 GPIO 输入
- 同族能力变体的 GPIO 输入/输出切换和外设占用针脚排除，例如 Pico OLED 仍允许未占用普通 GPIO 切输入，OLED 占用针脚不进入输出或输入候选
- 串口上下行监控窗口，若修改设备通信或新增板卡通信能力
- 设备错误码归一、心跳 timeout、transport disconnected、busy 自动连接跳过和诊断 reason，若修改设备通信或连接链路
- 硬件说明弹窗，若接入了板卡专属说明
- i18n key 一致性和硬编码文案检查，若修改 UI 文案

验证顺序：

1. 先跑最小相关测试。
2. 烧录固件。
3. 手动识别并注册设备。
4. 连接设备。
5. 打开该设备通信监控窗口。
6. 下发数字输出、蜂鸣器、屏幕或其它支持动作，确认监控窗口出现 outbound 和 ack。
7. 触发按钮或 GPIO 输入，确认监控窗口出现 inbound input-event。
8. 拔出设备，确认监控窗口冻结且主窗口不 hang。
9. 再跑涉及的固件构建或打包命令。
10. 最后跑必要的前端构建、后端检查或整体验证。

如果缺少 PICO SDK、Arduino core、真实板卡、串口权限或 PyYAML 等前置条件，记录准确缺失项和未执行的验证。完成后更新进度文档和 `CLAUDE.md`。
