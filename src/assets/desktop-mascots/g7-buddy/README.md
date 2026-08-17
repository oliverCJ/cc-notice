# G7 Buddy 桌面精灵资源包

## 状态

当前资源包基于项目根目录 `精灵素材` 中的 G7 卡通形象 GIF 动作素材接入。第一版使用 `renderer: gif`，优先保证正式形象还原和动作可用性。

## 动作映射

- `idle.sleep` 使用 `睡觉.gif`
- `idle.hi` 使用 `HI.gif`
- `idle.laugh` 使用 `大笑.gif`
- `idle.thanks` 使用 `谢谢.gif`
- `idle.love` 使用 `爱你.gif`
- `idle.bye` 使用 `BYE.gif`
- `task-received.wave` 使用 `HI.gif`
- `task-received.working` 使用 `我爱工作.gif`
- `task-received.cheer` 使用 `加油.gif`
- `task-received.fly` 使用 `上天.gif`
- `working.loop` 使用 `我爱工作.gif`
- `working.cheer` 使用 `加油.gif`
- `working.call` 使用 `打call.gif`
- `thinking.loop` 使用 `我爱工作.gif`
- `waiting-input.surprised` 使用 `吃惊.gif`
- `warning.surprised` 使用 `吃惊.gif`
- `success.ok` 使用 `OK.gif`
- `success.hug` 使用 `抱抱.gif`
- `success.flowers` 使用 `送花.gif`
- `success.laugh` 使用 `大笑.gif`
- `success.red-packet` 使用 `红包.gif`
- `error.cry` 使用 `大哭.gif`

## 资源约束

- GIF 源资源为 240x240，渲染时必须使用 `object-contain` 保持完整角色和透明背景。
- 资源文件进入应用资产目录后统一使用英文文件名，避免打包和跨平台路径问题。
- GIF renderer 是资源包能力扩展，不改变桌面提示输出规则和硬件设备输出链路。
