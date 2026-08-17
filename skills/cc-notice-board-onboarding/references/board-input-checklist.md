# 板卡输入清单

实现前必须收集或验证以下事实。公开板卡优先使用官方资料；用户自制板或官方资料缺失时，必须让用户补齐规格。

## 来源证据

公开板卡需要记录：

- 官方产品页 URL
- 官方 pinout URL
- datasheet URL
- schematic URL，若官方提供
- bootloader、上传或烧录说明 URL
- Arduino FQBN、board package 或 package index URL，若适用

同时记录：

- 已由官方资料确认的事实
- 用户提供信息与官方资料的冲突
- 因官方资料不完整而产生的假设
- 仍需要用户确认的事实

## 板卡事实

必须确认：

- 板卡展示名称
- 稳定 `boardId`，使用 kebab-case
- 厂商和官方资料 URL
- MCU、chip、family
- USB、CDC、串口枚举和打开串口后的复位行为
- 默认波特率
- 烧录策略：`uf2_mount_copy`、`arduino_cli_upload` 或需要新增策略
- 固件 toolchain
- 设备身份策略：
  - `required`：硬件或固件可返回稳定唯一 ID
  - `limited`：软件可初始化持久 ID
  - `unsupported`：无法稳定识别，不能作为完整内置板卡接入
- 能力层级：
  - `standard-mcu`：资源较完整，可开放多类输出
  - `small-mcu`：资源中等，需要裁剪能力
  - `small-avr`：Arduino AVR 32U4 类板卡，能力有限
  - `tiny-avr`：Uno、Nano 这类资源紧张板卡
  - `extended-device`：Wio Terminal 这类有屏幕、按键、蜂鸣器等设备级能力的板卡
- 该板卡是当前内置目标，还是仅作为未来用户板卡包候选；候选只能记录，不能进入普通用户 UI、可见 manifest artifact 或完整设备接入闭环
- 是否为已有 MCU family 或同一物理板卡的能力变体；若是，必须确认可复用的共享固件层、独立 `board_id`、独立 artifact、独立 catalog 声明，以及只因外设占用或能力开关产生的裁剪项

## 针脚事实

每个候选输出针脚必须确认：

- 稳定针脚 ID，例如 `gp2`、`d3`、`a0`
- 用户可见标签
- 物理针脚编号，若可得
- MCU GPIO 或 Arduino pin 编号
- 板上丝印别名
- 模拟通道别名，若存在
- 能力：`digital-output`、`pwm-output`、`buzzer`、`addressable-led`
- 保留功能、危险用法或接线警告
- 是否本次暴露为输出通道
- 若针脚被屏幕、蜂鸣器、WS2812、总线或板载外设占用，是否已同时从普通输出候选和 GPIO 输入候选中移除
- 是否只保留为元数据，不能生成输出通道

## 输入与上行事件

必须确认：

- 是否存在固定按钮、五向键、GPIO 输入或其它上行控件
- 每个输入控件是否有稳定 `control` ID
- 输入通道是否能映射到设备通道 `channelId`
- 固定输入通道是否不可切换为输出
- GPIO 输入是否需要 `configure_input` 动态配置
- GPIO 双模式针脚是否默认添加为输出，且切换输入需要用户确认
- 同族能力变体是否继承 GPIO 双模式；未被外设占用的普通 GPIO 是否仍可切换输入，外设占用针脚是否不会出现在输入候选中
- 前端和执行链路是否基于 Board Catalog、通道元数据或板卡族系 helper 判断输入能力，而不是精确写死单个 `boardId`
- 已连接设备确认模式切换后是否通过 IO worker 后台同步 `configure_input`
- 未连接设备保存输入配置后，连接成功时是否会同步给固件
- 切回输出或移除输入通道时是否清理对应输入绑定
- 输出转输入时的输出规则引用检查范围和提示位置
- 输入模式的 debounce、active-low、pull-up/pull-down 策略
- 固件是否实现 `input_event`，并包含 `control`、`channel`、`action`、`seq`
- `input_event` 是否按异步上行事件处理，而不是命令 ACK
- ACK 读取层是否会分流 `input_event` 并继续等待当前命令响应
- 支持异步上行输入的串口路径是否避免发送命令前清空输入缓冲
- 上位机是否能收到 `input_event` 并触发设备级输入绑定
- 禁用绑定时，设备通道记录和输入测试区是否都明确显示禁用
- 快捷键配置是否允许任意单键，且组合键必须包含修饰键和一个主键
- 前端键盘面板、后端校验和平台按键模拟是否使用同一键位范围
- 设备页输入测试区是否只做可视化验证，不伪造真实上行或直接触发键盘模拟

## 通信监控

必须确认：

- 下行命令、ACK、timeout、`input_event`、worker stop 是否能进入监控窗口
- `device_info` 查询、固件检查、心跳异常和连接错误是否按事件模型进入监控窗口
- 未打开监控窗口时，监控记录入口是否保持快速 no-op
- 未打开监控窗口时是否不会构造详细 payload、格式化 JSON 或推送 Tauri 事件
- 监控窗口是否只能从已连接设备打开
- 同一设备是否只能打开一个监控窗口
- 设备断开后是否冻结窗口并停止会话
- 同一设备重连后再次打开监控是否聚焦原窗口并恢复会话
- 多设备监控是否有数量限制
- 事件列表是否按旧消息在上、新消息追加到底部展示
- 下行命令事件是否使用已发送语义，避免把常态下行显示为一直等待
- 跟随滚动是否只影响滚动和自动选中，不影响后端记录
- 监控、诊断或测试功能是否都没有直接打开同一串口

## 屏幕能力

声明 `deviceExtensions.display` 时必须确认：

- 屏幕物理尺寸、分辨率、总线类型和初始化依赖
- `sizeClass`：`compact`、`small`、`medium` 或 `large`
- `textEncoding`：例如 `ascii` 或未来明确支持的 Unicode 能力
- `titleMaxChars`、`messageMaxChars`、可显示行数和最终 JSON 行字节上限
- 是否支持 `display_status`、`display_lines`、`display_card`、`display_runtime`、`display_clear`
- `display_status` 和 `display_runtime` 的共存策略
- 上位机模板层是否维护业务内容，固件是否只实现显示原语
- 小屏是否使用专属短文案，禁止复用 Wio 长文案后暴力截断
- 普通规则配置是否避免暴露不受控自由文本；高级模板是否按 `textEncoding`、字段长度和最终 JSON 行字节上限裁剪
- 不支持的显示原语是否会返回稳定错误，而不是 timeout 或假成功
- 旧固件或能力声明滞后时，`display_card` / `display_lines` 是否能按设计降级到 `display_status`
- I2C/SPI 屏幕无 ACK 或初始化失败时是否返回稳定错误码

## 固件事实

必须确认：

- 固件版本
- 协议版本
- 支持的协议命令
- 默认通道表
- 固件行长度、输入缓冲和内存限制
- 串口打开后的复位或 bootloader 等待时间
- 上传参数，例如 FQBN、protocol、speed、CPU variant、board options
- `device_info` 返回的 `board_id`
- 稳定或初始化后的 `device_uid` 格式
- 因板卡能力限制而故意不支持的命令
- ACK 和错误 ACK 的格式是否与 CC Notice 协议一致
- 设备通信错误是否归一为稳定枚举码或字母码，禁止依赖错误描述字符串做业务判断
- 串口库、系统 I/O 和硬件原始错误是否只在边界层归一化，业务层是否只消费错误码
- 固件协议错误是否先解析 ACK 再转换为内部协议错误类型，禁止通过 JSON 原文 `contains` 判断

## 软件接入事实

必须确认：

- `board_id` 是否能映射到 Board Catalog
- Pin Catalog 是否覆盖所有候选针脚，并区分输出通道和元数据针脚
- 默认通道是否只包含固件已实现且接线风险可控的通道
- 可选通道是否不暴露固件未实现的动作
- 固件 manifest 是否包含对应 artifact、版本、协议、toolchain、烧录策略和 upload 参数
- 固件页是否需要同一 `boardId` 下多个 artifact/target，例如不同 bootloader
- 固件页是否按 `artifactId` 选择和烧录产物；推荐标记、板卡族和能力层级是否只是展示元数据，不反向影响 manifest 或烧录策略
- 注册后是否能通过稳定 UID 或初始化 UID 重连同一设备
- 串口路径、扫描资源和端口描述是否只作为运行态传输资源，不能写死为设备身份
- 手动连接和自动连接是否在连接成功前校验实际 `device_uid`，不能让错误端口污染持久配置
- 设备页、规则页、诊断、说明弹窗是否只消费 catalog 和运行态事实
- 配置方案导入导出若涉及该板卡设备输出规则，是否只保留板型、通道和能力要求，不导出设备 UID、串口路径、扫描资源、IO worker 或最近 ACK/error 等运行态事实

## 官方资料不可得时

向用户索取：

- pinout 图片或表格
- schematic 或 GPIO 映射
- 上传方法
- bootloader 行为
- 已测试的串口设置
- 已知危险针脚或保留针脚
- 接线和上传流程已实测的证明，若可提供
