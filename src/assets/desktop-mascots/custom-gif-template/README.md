# CC Notice 自定义 GIF 精灵模板

这是一套自定义桌面精灵资源包结构模板。模板包只包含 `manifest.json`、目录说明和动作命名示例，不内置默认 GIF 图片；你需要先把自己的 GIF 文件放入 `animations/` 并按 manifest 引用完整后，CC Notice 才能把它作为“本地自定义”精灵资源包加载。

## 放置目录

将整个目录复制到用户目录：

```text
~/.cc-notice/mascots/my-mascot/
```

软件在扫描自定义精灵时会尝试自动创建 `~/.cc-notice/mascots/` 根目录。如果因为系统权限、用户目录异常或其它原因没有创建成功，可以手动创建这个目录后再复制资源包。

最终结构应类似：

```text
~/.cc-notice/mascots/my-mascot/
  manifest.json
  animations/
    idle-sleep.gif
    idle-look-around.gif
    idle-thanks.gif
    task-wave.gif
    task-cheer.gif
    task-fly.gif
    working.gif
    working-call.gif
    waiting-input.gif
    thinking.gif
    success.gif
    success-hug.gif
    warning.gif
    error.gif
```

`my-mascot` 可以替换为你的资源包 ID。ID 建议只使用小写字母、数字、点号、下划线和短横线，例如 `my-cute-mascot`。

## 使用步骤

1. 复制模板目录到 `~/.cc-notice/mascots/<pack-id>/`。
2. 按 `manifest.json` 中的路径准备 GIF 文件，并放入 `animations/` 目录。
3. 修改 `manifest.json` 中的 `id`、`name`、`version`、`animations` 和 `actions`。
4. 打开 CC Notice 设置页，进入桌面提示实例库。
5. 编辑一个桌面精灵实例，在资源包选择区域点击“重新扫描”。
6. 如果资源包合法，会在资源包下拉中以“本地自定义”显示。

如果没有补齐 `manifest.json` 引用的 GIF 文件，扫描时会显示缺失文件诊断，这是正常的前置校验结果。

## manifest 字段说明

- `id`：资源包稳定 ID。保存实例配置时会记录这个 ID，后续不要随意修改。
- `name`：在软件界面中显示的资源包名称。
- `version`：资源包版本号，方便你自己维护。
- `renderer`：当前只能填写 `gif`。
- `animations`：动画 ID 到 GIF 文件路径的映射。路径必须是资源包目录内的相对路径。
- `actions`：动作列表。每个动作绑定一个语义状态和一个动画。
- `interactions`：精灵鼠标交互配置。
- `bubbleStyle`：气泡显示约束。当前模板保留默认值即可。

## animations 写法

`animations` 是一个对象。左侧 key 是动画 ID，右侧 value 是 GIF 文件路径。

```json
"animations": {
  "idle-sleep": "animations/idle-sleep.gif",
  "task-wave": "animations/task-wave.gif"
}
```

- 动画 ID 建议使用小写字母、数字和短横线，例如 `idle-sleep`。
- GIF 路径必须指向资源包目录内的本地 `.gif` 文件。
- 路径建议统一放在 `animations/` 目录下，便于管理。
- 修改 GIF 文件名后，需要同步修改这里的路径。

## actions 写法

`actions` 是动作数组。每一项都是一个可被规则或空闲态使用的动作。

```json
{
  "id": "idle.sleep",
  "label": "空闲：睡觉",
  "state": "idle",
  "animation": "idle-sleep",
  "loop": true,
  "interruptible": true,
  "playMode": "loop"
}
```

- `id`：动作稳定 ID。建议格式为 `<语义状态>.<动作名>`，例如 `idle.sleep`。
- `label`：界面显示名称。可以写中文，用来帮助你在规则配置里识别动作。
- `state`：动作所属语义状态，只能使用本文列出的 8 个语义状态。
- `animation`：引用 `animations` 里的动画 ID，不是 GIF 文件路径。
- `loop`：兼容字段。简单资源包可以用它表示是否循环播放。
- `interruptible`：动作是否允许被新的动作打断。空闲、工作中通常设为 `true`；完成、出错通常设为 `false`。
- `playMode`：推荐使用的播放策略。可选值见“播放策略”。

## interactions 写法

```json
"interactions": {
  "hoverActionId": "idle.sleep",
  "clickActionId": "task-received.wave"
}
```

- `hoverActionId`：鼠标悬停精灵时触发的动作 ID，必须引用 `actions` 中已经存在的动作。
- `clickActionId`：点击精灵时触发的动作 ID，必须引用 `actions` 中已经存在的动作。

## bubbleStyle 写法

```json
"bubbleStyle": {
  "maxLines": 2,
  "maxCharsPerLine": 18,
  "placements": ["top", "top-left", "top-right"]
}
```

- `maxLines`：气泡最多显示行数。建议保持 `2`。
- `maxCharsPerLine`：每行最多字符数。建议保持 `18`，避免气泡遮挡精灵。
- `placements`：气泡允许出现的位置。当前推荐保留模板默认值。

## 语义状态

CC Notice 当前内置 8 个语义状态。模板 manifest 已经全部列出，其中 5 个是必需状态，3 个是可选状态。模板包不内置图片文件，请按这些动作语义自行准备 GIF。

### 必需状态

- `idle`：空闲状态。没有规则触发时播放，适合睡觉、待机、轻微呼吸等动作。
- `task-received`：收到任务。适合打招呼、开始工作、收到指令等短动作。
- `working`：工作中。适合循环播放的工作、思考、忙碌动作。
- `success`：完成。适合任务成功结束后的反馈动作。
- `error`：出错。适合失败、异常、需要关注时的反馈动作。

### 可选状态

- `waiting-input`：等待用户输入。适合等待、看向用户、提示用户继续等动作。
- `thinking`：思考中。适合沉思、转圈、查找资料等动作。
- `warning`：警告或提醒。适合轻微异常、需要注意但不是失败的动作。

## 增加更多动作

新增动作需要同时修改 `animations` 和 `actions`。

例如给空闲状态增加一个“伸懒腰”动作：

```json
{
  "animations": {
    "idle-stretch": "animations/idle-stretch.gif"
  },
  "actions": [
    {
      "id": "idle.stretch",
      "label": "空闲：伸懒腰",
      "state": "idle",
      "animation": "idle-stretch",
      "loop": false,
      "interruptible": true,
      "playMode": "once-then-idle"
    }
  ]
}
```

实际 manifest 中不要只保留上面的片段，而是把 `idle-stretch` 合并进现有 `animations`，再把 action 合并进现有 `actions`。

同一个语义状态可以配置多个动作。例如 `idle.sleep`、`idle.look-around`、`idle.stretch` 都可以使用 `state: "idle"`。空闲状态有多个动作时，软件可以随机轮播，让精灵更自然；规则配置中也可以选择同一状态下的具体动作。

## 多张图片或多个表现

每个 action 对应一个 animation。一个动作如果需要多帧画面，请先把图片或帧序列合成为一个 GIF，再在 `animations` 中引用这个 GIF。

如果希望同一个语义状态有多种表现，请拆成多个 action，挂到同一个 `state` 下。例如 `idle.sleep`、`idle.look-around`、`idle.stretch` 都属于空闲状态，但可以引用不同 GIF。

## 播放策略

每个 action 可以配置 `playMode`：

- `loop`：持续循环，适合空闲、工作中、等待输入等常驻动作。
- `once-then-hold`：播放一次后停留，适合完成、出错等结果反馈。
- `once-then-idle`：播放一次后回到空闲态，适合打招呼、感谢、再见等短动作。

如果没有配置 `playMode`，软件会回退读取 `loop` 布尔字段。

## GIF 资源要求

- 建议使用透明背景 GIF，避免显示方形底色。
- 推荐画布大小为 `240x240` 到 `512x512`，尽量接近正方形。
- 推荐单个 GIF 尽量控制在 `2MB` 左右，避免高分辨率、长时长或高帧率 GIF 导致播放卡顿。
- 单个 GIF 硬上限为 `10MB`，整包 GIF 总大小硬上限为 `80MB`。这是扫描加载上限，不是推荐素材大小。
- 不同动作中的角色尺寸、脚底位置和中心锚点尽量一致，避免动作切换时跳动。
- 短动作如果循环起来很怪，建议使用 `once-then-idle` 或 `once-then-hold`。

## 限制和安全规则

- 只支持本地 GIF 和 `manifest.json`。
- 不支持远程 URL、脚本、HTML、SVG、可执行文件或运行时动态代码。
- GIF 路径必须留在资源包目录内，不能使用 `../` 跳出目录。
- 非法资源包不会阻止软件启动，但会在设置页显示诊断信息。

## 扫描时会检查什么

点击“重新扫描”时，软件会先做资源包完整性检查：

- 如果 `~/.cc-notice/mascots/` 根目录不存在，软件会先尝试自动创建。
- `manifest.json` 必须存在、可读取，并且是合法 JSON。
- `id` 只能使用小写字母、数字、点号、下划线和短横线。
- `renderer` 必须是 `gif`。
- `animations` 和 `actions` 数量不能超过软件限制。
- `animations` 中每个路径都必须是资源包内部的相对 `.gif` 文件路径。
- 每个 GIF 文件必须存在，路径解析后仍留在资源包目录内。
- 每个 GIF 文件大小不能超过 `10MB`，整包 GIF 总大小不能超过 `80MB`。
- 建议单个 GIF 尽量控制在 `2MB` 左右，过大的 GIF 可能增加扫描、加载和播放压力。
- 每个 GIF 文件必须有合法 GIF 文件头。
- 每个 action 的 `animation` 必须引用 `animations` 中已经声明的动画 ID。
- `hoverActionId` 和 `clickActionId` 必须引用 `actions` 中已经存在的动作 ID。
- 必须至少包含 `idle`、`task-received`、`working`、`success`、`error` 这 5 个语义状态的动作。

软件不会自动判断 GIF 画面内容是否真的符合动作含义，例如无法判断 `idle-sleep.gif` 里画的是不是睡觉动作。这类语义匹配需要你自己在替换素材时确认。

---

# CC Notice Custom GIF Mascot Template

This folder is a custom desktop mascot pack structure template. It includes `manifest.json`, documentation, and action naming examples, but it does not include default GIF images. Add your own GIF files under `animations/`, keep the manifest references complete, then CC Notice can load it as a Local Custom mascot pack.

## Where to put it

Copy this folder to:

```text
~/.cc-notice/mascots/my-mascot/
```

Then open CC Notice settings, edit a desktop mascot instance, and click Rescan beside the asset pack selector. Valid local GIF packs will appear as Local Custom asset packs.

## Notes

- `renderer` must be `gif`.
- GIF paths must be relative paths inside this pack folder.
- The downloaded template does not include GIF files. Add your own files before scanning.
- Required states are `idle`, `task-received`, `working`, `success`, and `error`.
- Optional states are `waiting-input`, `thinking`, and `warning`.
- One action references one GIF animation. To use multiple frames, merge them into one GIF. To provide multiple variants, define multiple actions under the same state.
- Use `playMode` to control short GIF behavior: `loop`, `once-then-hold`, or `once-then-idle`.
- Keep GIF files transparent and aligned to avoid visual jumps.
