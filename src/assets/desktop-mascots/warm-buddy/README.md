# Warm Buddy 桌面精灵资源包

## 状态

当前已提供第一版可运行 Lottie 矢量动画资源。资源遵循 v3 圆手小机器人方向，后续可以继续基于相同分层进行视觉精修。

## 视觉方向

- 方向：暖萌小机器人伙伴。
- 气质：亲和、轻量陪伴、适合 AI 交互。
- 轮廓：圆润，桌面小尺寸下仍能辨认。
- 表情：屏幕脸需要能表达开心、等待、思考、出错和完成。
- 手部：左右手都使用圆润小球手，不画手指。
- 动画：手掌必须跟随手臂分组，不能出现断开、漂浮或错位。
- 气泡：像角色自然说出的短提示，不像普通系统通知卡片。

## 必需动画

当前包含以下文件：

- `animations/idle.json`
- `animations/working.json`
- `animations/success.json`
- `animations/error.json`
- `animations/wave.json`

## 动作映射

- `task-received.wave` 使用 `wave`
- `working.loop` 使用 `working`
- `waiting-input.look-around` 使用 `idle`
- `thinking.loop` 使用 `working`
- `success.jump` 使用 `success`
- `warning.notice` 使用 `wave`
- `error.shake` 使用 `error`
- `idle.breathe` 使用 `idle`

## 验收标准

- 透明背景，无黑边、方形虚影或锯齿。
- 260x260 尺寸下角色轮廓和表情清晰。
- 空闲动画平稳，不干扰工作。
- 工作中动画有状态感，但不能过度活跃。
- 完成动画积极但短促。
- 出错动画温和，不制造强烈警报感。
- 收到任务和点击反馈动作自然，不是简单旋转或机械摆动。
- Lottie composition 使用 360x360 安全画布，角色内容必须完整落在画布内；默认 260x260 舞台中由 renderer 等比缩放显示，不能出现头顶、手臂或阴影被窗口裁切。

## 生成方式

第一版资源由 `app/scripts/generate-warm-buddy-lottie.mjs` 生成。修改角色分层或动作节奏时，优先修改生成脚本再重新生成 JSON，避免 5 个动画文件结构漂移。
