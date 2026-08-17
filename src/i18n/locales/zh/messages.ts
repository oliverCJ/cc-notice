export const zhMessages = {
  nav: {
    ariaLabel: '主导航',
    setup: '接入配置',
    hookSettings: 'Hook 设置',
    rules: 'AI事件映射',
    monitor: '运行监控',
    diagnostics: '诊断中心',
    devices: '设备',
    firmware: '固件',
    settings: '设置',
    debug: 'Debug'
  },
  appInfo: {
    ariaLabel: '软件信息',
    version: 'v{{version}}',
    developer: '开发者'
  },
  common: {
    cancel: '取消',
    close: '关闭',
    confirm: '确认',
    delete: '删除',
    duplicate: '复制',
    activate: '激活',
    enabled: '启用',
    disabled: '禁用',
    save: '保存',
    saving: '保存中...',
    send: '发送',
    reset: '重置',
    preview: '预览',
    loading: '加载中...',
    select: '选择',
    details: '详情',
    previous: '上一步',
    next: '下一步',
    notConfigured: '未设置',
    loadingRuntimeMonitor: '加载运行监控...'
  },
  colorEditor: {
      currentColor: '当前颜色 {{color}}',
      visualColorPicker: '可视化选色',
      pickScreenColor: '从屏幕吸取颜色',
      nativeColorInput: '原生颜色选择',
    hexColor: 'HEX 色号',
    applyColor: '应用颜色',
    close: '关闭',
    presetColors: '预设颜色',
    presetHint: '快速替换当前编辑颜色',
    saturationValue: '颜色明度和饱和度',
    hue: '色相',
    eyedropperUnsupported: '当前运行环境不支持屏幕吸色'
  },
  desktopNotice: {
    instance: {
      title: '桌面提示',
      description: '管理本机桌面提示实例。可打开预览、拖动调整位置并保存到本机配置。',
      empty: '暂无桌面提示实例。创建后可在后续输出规则中引用。',
      create: '新建桌面提示',
      name: '名称',
      variant: '实例类型',
      variants: {
        customLightbar: '自定义灯条',
        edgeLightbar: '固定屏幕边缘灯条',
        mascot: '桌面精灵'
      },
      typeSwitchWarning: '切换实例类型会重置当前类型专属设置。',
      confirmTypeSwitch: '确认切换',
      cancelTypeSwitch: '取消',
      presetPosition: '预设位置',
      width: '宽度',
      height: '高度',
      cornerRadius: '圆角',
      opacity: '透明度',
      enabled: '启用实例',
      showOnStartup: '启动后显示',
      alwaysOnTop: '窗口置顶',
      showPreview: '显示预览',
      hidePreview: '隐藏预览',
      save: '保存当前实例',
      saveSuccessTitle: '保存成功',
      saveSuccessDescription: '桌面提示实例「{{name}}」已保存。',
      delete: '删除当前实例',
      deleteSuccessTitle: '删除成功',
      deleteSuccessDescription: '桌面提示实例「{{name}}」已删除。',
      edgeSelection: '显示边',
      edgeThickness: '灯条宽度',
      edgeInset: '边缘内缩',
      edges: {
        top: '上边',
        bottom: '下边',
        left: '左边',
        right: '右边'
      },
      brightness: '亮度',
      breathingPeriod: '呼吸周期',
      idleBehavior: '空闲态',
      idleBehaviorHidden: '隐藏',
      idleBehaviorDimPlaceholder: '低亮占位',
      idleBehaviorKeepLast: '保留最后状态',
      mascotIdleBehaviorResident: '常驻',
      idleBehaviorHint: '空闲态表示没有输出规则激活时实例的基础状态，不表达事件含义。',
      resetVisualSettings: '还原默认设置',
      resetSuccessTitle: '已还原默认设置',
      resetSuccessDescription: '当前实例视觉设置已还原，点击保存后生效。'
    },
    mascot: {
      packs: {
        g7Buddy: 'G7 精灵',
        warmBuddy: '暖萌机器人'
      },
      fields: {
        assetPack: '资源包',
        resourceSection: '资源包与扫描',
        displaySection: '显示设置',
        stageWidth: '舞台宽度',
        stageHeight: '舞台高度',
        bubble: '气泡',
        interaction: '交互反馈',
        bubblePlacement: '气泡位置',
        bubbleFontSize: '气泡字号',
        bubbleFont: '气泡字体',
        idleState: '空闲状态'
      },
      customGuide: {
        open: '自定义精灵资源说明',
        button: '自定义说明',
        rescan: '重新扫描',
        localPack: '本地自定义',
        scanRoot: '资源包放置目录：{{path}}',
        scanFailed: '扫描失败：{{error}}',
        loadedSummary: '已加载 {{count}} 个资源包',
        issueSummary: '发现 {{count}} 个问题',
        loadedPacksTitle: '已加载资源包',
        diagnosticsTitle: '以下本地资源包未加载',
        diagnosticCode: '诊断码：{{code}}',
        diagnosticPath: '路径：{{path}}',
        diagnosticRaw: '原始信息：{{message}}',
        title: '自定义 GIF 精灵资源包',
        description:
          '按规范准备一套本地 GIF 精灵资源包。复制到用户目录后，点击重新扫描即可加入资源包下拉。',
        directoryTitle: '放置目录',
        directoryDescription:
          '每套精灵是一个独立目录，软件会从本机用户目录读取合法资源包。',
        requiredTitle: '必要动作语义',
        requiredIdle: '空闲：没有规则触发时的常驻动作',
        requiredTask: '收到任务：任务开始或启动打招呼',
        requiredWorking: '工作中：AI 正在执行任务',
        requiredSuccess: '完成：任务成功结束',
        requiredError: '出错：任务失败或需要关注',
        gifTitle: 'GIF 要求',
        gifTransparent: '使用透明背景，避免出现方形底色',
        gifSize: '推荐 240x240 到 512x512 的近正方形画布',
        gifLimit: '建议单个 GIF 尽量控制在 2MB 左右；硬上限为单个 10MB、整包 80MB',
        gifAnchor: '不同动作保持角色尺寸和锚点一致，避免切换时跳动',
        playModeTitle: '短 GIF 播放策略',
        playModeDescription:
          '短动作长时间循环会显得重复。自定义资源可以用 playMode 表达动作完成后的行为。',
        playModes: {
          loop: {
            name: 'loop',
            description: '持续循环，适合睡觉、工作中、等待输入'
          },
          onceThenHold: {
            name: 'once-then-hold',
            description: '播放一次后停留，适合完成、出错等结果反馈'
          },
          onceThenIdle: {
            name: 'once-then-idle',
            description: '播放一次后回到空闲态，适合打招呼、感谢、再见'
          }
        },
        manifestTitle: 'manifest 最小示例',
        notAvailableYet:
          '注意：只支持本地 GIF 和 manifest，不支持远程 URL、脚本、HTML、SVG 或可执行文件。',
        downloadTemplate: '下载模板包',
        downloadStartedTitle: '模板包下载已开始',
        downloadStartedDescription:
          '请在浏览器或系统下载记录中查看 cc-notice-custom-mascot-template.zip。',
        downloadFailedTitle: '模板包下载失败',
        downloadFailedDescription: '未能启动模板包下载，请稍后重试。'
      },
      diagnostics: {
        codes: {
          MANIFEST_READ_FAILED: {
            title: '无法读取 manifest',
            impact: '该资源包不会出现在资源包下拉中。',
            suggestion: '请确认资源包目录中存在 manifest.json，并且当前用户有读取权限。'
          },
          MANIFEST_INVALID_JSON: {
            title: 'manifest JSON 格式错误',
            impact: '软件无法解析该资源包配置。',
            suggestion: '请用 JSON 校验工具检查 manifest.json 的逗号、引号和括号。'
          },
          MANIFEST_TOO_LARGE: {
            title: 'manifest 文件过大',
            impact: '该资源包被跳过，避免扫描异常文件拖慢软件。',
            suggestion: '请将 manifest.json 控制在 256KB 以内。'
          },
          INVALID_ID: {
            title: '资源包 ID 非法',
            impact: '软件无法稳定保存或匹配该资源包。',
            suggestion: '请使用小写字母、数字、短横线、下划线或点号。'
          },
          INVALID_RENDERER: {
            title: '不支持的渲染类型',
            impact: '该资源包不会被加载。',
            suggestion: '当前 renderer 只能填写 gif。'
          },
          INVALID_ANIMATION_PATH: {
            title: '动画路径非法',
            impact: '该资源包被跳过，避免路径越界读取。',
            suggestion: '请使用资源包目录内的相对路径，不能包含 ../。'
          },
          MISSING_ANIMATION_FILE: {
            title: '缺少 GIF 文件',
            impact: '动作引用的动画无法播放。',
            suggestion: '请检查 animations 路径是否和实际 GIF 文件名一致。'
          },
          INVALID_GIF_FILE: {
            title: 'GIF 文件无效',
            impact: '该动画不能作为桌面精灵资源播放。',
            suggestion: '请替换为合法 GIF 文件。'
          },
          ANIMATION_FILE_TOO_LARGE: {
            title: '单个 GIF 过大',
            impact: '该资源包被跳过，避免加载和播放造成性能压力。',
            suggestion: '单个 GIF 必须小于 10MB，建议控制在 2MB 左右。'
          },
          PACK_TOO_LARGE: {
            title: '资源包总体过大',
            impact: '该资源包被跳过，避免扫描和加载造成性能压力。',
            suggestion: '整包 GIF 总大小必须小于 80MB。'
          },
          TOO_MANY_PACKS: {
            title: '资源包数量过多',
            impact: '超出上限后的资源包不会继续扫描。',
            suggestion: '请减少 mascots 目录下的资源包数量。'
          },
          TOO_MANY_ANIMATIONS: {
            title: '动画定义过多',
            impact: '该资源包被跳过。',
            suggestion: '请将 animations 数量控制在 128 个以内。'
          },
          TOO_MANY_ACTIONS: {
            title: '动作定义过多',
            impact: '该资源包被跳过。',
            suggestion: '请将 actions 数量控制在 64 个以内。'
          },
          MISSING_REQUIRED_ACTION: {
            title: '缺少必需动作',
            impact: '软件无法保证基础状态可用。',
            suggestion: '请至少提供 idle、task-received、working、success 和 error 状态动作。'
          },
          UNKNOWN_ACTION_ANIMATION: {
            title: '动作引用了不存在的动画',
            impact: '该动作无法播放。',
            suggestion: '请确认 action.animation 的值存在于 animations 配置中。'
          },
          INVALID_INTERACTION_ACTION: {
            title: '交互动作引用非法',
            impact: '该资源包未通过完整性检查。',
            suggestion: '请确认 interactions 中引用的动作 ID 存在。'
          },
          UNKNOWN: {
            title: '未知资源包问题',
            impact: '该资源包未加载。',
            suggestion: '请根据诊断码和原始信息检查资源包配置。'
          }
        }
      },
      bubblePlacements: {
        top: '顶部',
        topLeft: '左上',
        topRight: '右上'
      },
      bubbleFonts: {
        softHandwriting: '柔和手写',
        roundCute: '圆润可爱',
        comic: '漫画手写',
        cleanSans: '清爽无衬线',
        systemDefault: '系统默认'
      },
      states: {
        'task-received': '收到任务',
        working: '工作中',
        'waiting-input': '等待输入',
        thinking: '思考中',
        success: '完成',
        warning: '警告',
        error: '出错',
        idle: '空闲'
      },
      actions: {
        taskReceivedWave: '收到任务：挥手',
        taskReceivedWorking: '收到任务：开始工作',
        taskReceivedCheer: '收到任务：加油',
        taskReceivedFly: '收到任务：起飞',
        workingLoop: '工作中：循环',
        workingCheer: '工作中：加油',
        workingCall: '工作中：打 Call',
        waitingInputLookAround: '等待输入：观察',
        waitingInputSurprised: '等待输入：吃惊',
        thinkingLoop: '思考中：循环',
        successJump: '完成：跳跃',
        successOk: '完成：OK',
        successHug: '完成：抱抱',
        successFlowers: '完成：送花',
        successLaugh: '完成：大笑',
        successRedPacket: '完成：红包',
        warningNotice: '警告：提醒',
        warningSurprised: '警告：吃惊',
        errorShake: '出错：摇头',
        errorCry: '出错：大哭',
        idleHi: '空闲：打招呼',
        idleSleep: '空闲：睡觉',
        idleLaugh: '空闲：大笑',
        idleThanks: '空闲：谢谢',
        idleLove: '空闲：爱你',
        idleBye: '空闲：再见',
        idleBreathe: '空闲：呼吸'
      }
    }
  },
  profileRepair: {
    title: '配置已自动修复',
    description:
      '配置方案“{{profile}}”中存在无法解析或不符合当前规则的内容，软件已保留可用配置并移除失效部分。',
    action: '请进入 Hook 设置、AI事件映射或设备页面重新配置被移除的部分。',
    items: {
      unrecoverableProfile: '配置方案“{{profile}}”无法解析，已隔离为备份文件并切换到可用方案',
      identity: '已修复配置方案基础信息',
      hookEvents: '已移除 {{count}} 个无效 Hook 事件选择',
      aiMappings: '已移除 {{count}} 条无效 AI 事件映射',
      hardwareRules: '已移除 {{count}} 条无效输出规则',
      device: '已将设备配置恢复为默认设备'
    }
  },
  settings: {
    title: '设置',
    description: '管理日志目录、应用偏好和诊断导出。',
    localHookServer: '本地 Hook 接收服务',
    localHookServerDescription: '配置本地 Hook 事件接收服务',
    receivePort: '接收端口',
    savePort: '保存端口',
    portHelp: '修改端口后需要重启 CC Notice，默认不需要重新配置 AI 工具 hook。刷新 Token 会立即更新本地服务和 relay 鉴权文件。',
    refreshToken: '刷新 Token',
    refreshingToken: '刷新中...',
    saveSuccessTitle: '保存成功',
    saveFailedTitle: '保存失败',
    portSavedDescription: 'Hook 服务端口已更新为 {{port}}',
    tokenRotatedTitle: 'Token 已刷新',
    tokenRotatedDescription: '新的 Hook Token 已写入本地文件，并已同步到运行中的本地服务。',
    tokenRotateFailedTitle: 'Token 刷新失败',
    language: '界面语言',
    saveLanguage: '保存语言',
    languageSavedDescription: '界面语言已更新',
    languageTitle: '界面语言',
    languageDescription: '选择界面显示语言',
    languageZhCn: '中文',
    languageEnUs: 'English',
    appearanceTitle: '外观',
    appearanceDescription: '选择 CC Notice 的界面明暗模式。',
    themeMode: '外观模式',
    themeModeSystem: '跟随系统',
    themeModeLight: '浅色',
    themeModeDark: '深色',
    themeModeHelp: '跟随系统时，CC Notice 会自动匹配操作系统当前的明暗主题。',
    saveThemeMode: '保存外观',
    themeModeSavedDescription: '外观设置已更新。',
    windowBehaviorTitle: '窗口行为',
    windowBehaviorDescription: '配置关闭窗口和系统托盘行为。',
    closeToTray: '关闭窗口时隐藏到系统托盘',
    closeToTrayDescription:
      '开启后点击关闭按钮会隐藏主窗口并保持后台服务运行；关闭后点击关闭按钮会退出 CC Notice，退出前会先断开已连接设备。',
    windowCloseBehaviorSavedDescription: '窗口关闭行为已更新',
    startupLightweightMode: '以轻量模式启动',
    startupLightweightModeDescription:
      '开启后下次启动默认只显示系统托盘，并在 macOS Dock 中隐藏应用图标；托盘菜单仍可临时切换普通模式。',
    windowStartupModeSavedDescription: '启动模式已更新，重启 CC Notice 后生效。',
    launchAtLogin: '随系统启动 CC Notice',
    launchAtLoginDescription:
      '系统登录后自动启动 CC Notice，用于保留托盘、Hook 服务和设备自动连接能力。',
    launchAtLoginSavedDescription: '随系统启动设置已更新。',
    hideWindowOnLoginLaunch: '开机后隐藏主窗口',
    hideWindowOnLoginLaunchDescription:
      '仅影响系统登录自动启动。托盘可用时后台启动，不影响手动打开应用。',
    hideWindowOnLoginLaunchSavedDescription: '开机启动窗口行为已更新。',
    arduinoCliTitle: 'Arduino CLI',
    arduinoCliDescription: '配置 Arduino 系列板卡烧录时使用的 arduino-cli。',
    arduinoCliPath: 'arduino-cli 路径',
    arduinoCliPathPlaceholder: '请输入 arduino-cli 的完整路径',
    arduinoCliHelp:
      '如果 CC Notice 无法自动检测到 arduino-cli，可以在这里填写完整可执行文件路径。',
    saveArduinoCliPath: '保存路径',
    arduinoCliPathRequired: '请填写 arduino-cli 的完整路径后再保存。',
    arduinoCliPathSavedDescription: 'Arduino CLI 路径已更新。',
    detectArduinoCli: '检测 Arduino CLI',
    detectingArduinoCli: '检测中...',
    arduinoCliAvailable: 'Arduino CLI 可用',
    arduinoCliUnavailable: 'Arduino CLI 不可用',
    arduinoCliResolvedPath: '路径：{{path}}',
    arduinoCliVersion: '版本：{{version}}',
    arduinoCliNotFound: '未检测到 arduino-cli，请确认已安装并加入 PATH，或填写完整路径。',
    reset: {
      title: '重置配置',
      description: '按配置域恢复默认值。操作前会二次确认，不会删除日志、Hook Token、relay 工具或外部 AI 工具 Hook 文件。',
      confirm: '确认重置',
      resetting: '重置中...',
      successTitle: '重置完成',
      failedTitle: '重置失败',
      scopes: {
        'app-settings': {
          button: '重置应用设置',
          title: '重置应用设置',
          description: '将端口和界面语言恢复为默认值。',
          warning: '修改端口后仍需要重启 CC Notice 才能让本地 Hook 服务使用新端口。',
          success: '应用设置已恢复为默认值。'
        },
        'hook-settings': {
          button: '重置 Hook 设置',
          title: '重置 Hook 设置',
          description: '将 Hook 配置目标和当前方案的 Hook 事件选择恢复为默认值。',
          warning: '此操作不会修改或删除 Codex、Claude Code 等 AI 工具目录下的 Hook 配置文件。',
          success: 'Hook 设置已恢复为默认值。'
        },
        'profile-mappings': {
          button: '重置映射配置',
          title: '重置映射配置',
          description: '将当前方案的 AI 事件映射和输出规则恢复为默认值。',
          warning: '当前方案中手动调整的映射关系、输出规则、Webhook、声音和设备通道绑定会被覆盖。',
          success: '当前方案的映射配置已恢复为默认值。'
        },
        devices: {
          button: '重置设备配置',
          title: '重置设备配置',
          description: '将设备列表和设备通道恢复为默认 RP2040 Pico 配置。',
          warning: '已连接设备会回到未连接运行态，手动添加或删除的设备通道会被默认通道替换。',
          success: '设备配置已恢复为默认 RP2040 Pico 配置。'
        },
        all: {
          button: '重置所有配置',
          title: '重置所有配置',
          description: '将应用设置、Hook 设置、配置方案和设备配置恢复为默认值。',
          warning: '此操作会删除自定义配置方案并恢复默认方案，但不会删除日志、Hook Token、relay 工具或外部 AI 工具 Hook 文件。',
          success: '所有配置已恢复为默认值。'
        }
      }
    },
    logTitle: '日志',
    logDescription: '日志默认写入 $HOME/.cc-notice/logs，便于排查运行问题。'
  },
  debug: {
    title: 'Debug',
    description: '观察 AI 工具 relay 入站参数、解析结果、规则映射和错误。',
    localHookServer: '本地 Hook 接收服务',
    localHookServerDescription: '本地 Hook 事件接收服务运行状态',
    running: '运行中',
    failed: '启动失败',
    eventUrl: '事件接收地址',
    healthUrl: '健康检查地址',
    sendTestEvent: '发送测试事件',
    refreshLog: '刷新日志',
    clearLog: '清空日志',
    emptyLog: '暂无 Debug 日志',
    debugLogTitle: '调试日志',
    debugLogDescription: '共 {{total}} 条记录，匹配 {{matched}} 条{{range}}',
    debugLogRange: '，显示第 {{start}}-{{end}} 条',
    sourceFilter: 'AI 工具',
    allSources: '全部工具',
    eventFilter: '事件类型',
    allEvents: '全部事件',
    resultFilter: '结果',
    allResults: '全部结果',
    stageFilter: '阶段',
    allStages: '全部阶段',
    keyword: '关键字',
    keywordPlaceholder: '搜索事件、错误、payload',
    previousPage: '上一页',
    nextPage: '下一页',
    noMatchedLog: '没有匹配当前筛选条件的 Debug 日志',
    resetFilters: '重置筛选',
    internalEvent: '内部事件：',
    mappingStage: '阶段：',
    viewDetails: '查看详情',
    testDialogTitle: '发送测试事件',
    testDialogDescription: '使用真实 AI Hook 事件测试当前 Profile 的映射和输出规则。',
    aiTool: 'AI 工具',
    hookEvent: 'Hook 事件',
    hookEventPlaceholder: '选择 Hook 事件',
    payload: 'Payload',
    detailTitle: '事件详情',
    detailDescription: '完整记录用于排查映射阶段、payload 和输出命令。',
    detailSource: '来源',
    detailEvent: '事件',
    detailInternalEvent: '内部事件',
    detailMappingStage: '映射阶段',
    detailResult: '结果',
    detailCommand: '命令',
    detailProcessingMode: '处理模式',
    detailHttpRead: 'HTTP 读取',
    detailPrepareTime: '响应准备',
    detailRelayResponse: 'Relay 响应',
    detailQueueDelay: '队列等待',
    detailProcessingTime: '后台处理',
    detailDeviceProcessingTime: '设备输出处理',
    detailWebhookProcessingTime: 'Webhook 输出处理',
    detailLocalProcessingTime: '本地输出处理',
    detailOutputs: '输出',
    detailTime: '事件时间',
    detailReceivedAt: '接收时间',
    detailCompletedAt: '完成时间',
    detailError: '错误',
    deviceResults: '设备下发结果',
    deviceResultAck: '设备响应',
    deviceResultErrorCode: '错误编码',
    deviceResultError: '错误原因',
    deviceResultEmptyAck: '无响应内容',
    summaryPayload: '摘要 Payload',
    rawPayload: '原始 Payload',
    lifecycle: {
      summaryTitle: '生命周期摘要',
      result: '最终结果',
      sourceEvent: '来源事件',
      internalEvent: '内部事件',
      internalEventMissing: '未命中',
      mappingStage: '映射阶段',
      processingMode: '处理模式',
      elapsed: '总耗时',
      outputs: '输出计划',
      deviceResults: '设备结果',
      failedDeviceResults: '{{count}} 个失败',
      notRecorded: '未记录',
      nodes: {
        inbound: {
          title: '接收入站事件',
          description: '软件收到 AI 工具转发的 Hook 事件。'
        },
        validation: {
          title: '校验与响应',
          description: '完成请求读取、基础校验和 relay 响应。'
        },
        mapping: {
          title: '事件映射',
          description: '把 AI Hook 事件映射为内部通知事件。'
        },
        rules: {
          title: '规则匹配',
          description: '根据内部事件匹配当前配置方案中的输出规则。'
        },
        outputs: {
          title: '输出执行',
          description: '执行本地、Webhook 和设备输出计划。'
        },
        completion: {
          title: '完成',
          description: '后台处理结束并记录最终耗时。'
        }
      },
      status: {
        success: '成功',
        warning: '注意',
        error: '异常',
        pending: '处理中',
        skipped: '跳过'
      },
      facts: {
        source: '来源',
        event: '事件',
        occurredAt: '事件时间',
        receivedAt: '接收时间',
        httpRead: 'HTTP 读取',
        prepare: '响应准备',
        response: 'Relay 响应',
        mode: '处理模式',
        internalEvent: '内部事件',
        mappingStage: '映射阶段',
        outputCount: '输出数量',
        deviceFailureCount: '设备失败',
        completedAt: '完成时间',
        processing: '后台处理',
        deviceProcessing: '设备输出处理',
        webhookProcessing: 'Webhook 输出处理',
        localProcessing: '本地输出处理',
        error: '错误'
      },
      messages: {
        noInternalEvent: '没有映射到内部事件，后续规则不会执行。',
        noOutputs: '没有命中输出规则或输出规则未启用。',
        asyncPending: '异步处理尚未回填完成时间。'
      },
      outputGroups: {
        local: '本地输出',
        webhook: 'Webhook 输出',
        'desktop-notice': '桌面提示输出',
        device: '设备输出',
        plan: '输出计划',
        desktopNoticeTarget: '目标实例',
        desktopNoticeNoTargets: '未记录桌面提示目标实例',
        desktopNoticeEffect: '效果',
        desktopNoticeColorMode: '颜色',
        desktopNoticeDuration: '时长',
        desktopNoticeAnimationPeriod: '动画周期',
        desktopNoticeEdge: '发光边',
        desktopNoticeMascotState: '精灵状态',
        desktopNoticeMascotAction: '精灵动作',
        desktopNoticeMascotPlaybackWindow: '单次播放窗口',
        desktopNoticeMascotBubble: '气泡文本',
        deviceAck: '设备响应',
        deviceErrorCode: '错误编码',
        deviceError: '错误原因',
        emptyAck: '无响应内容'
      }
    }
  },
  diagnostics: {
    title: '诊断中心',
    description: '集中检查 AI Hook、规则映射、输出和设备运行状态。',
    refresh: '重新检测',
    refreshing: '检测中...',
    loading: '正在加载诊断快照...',
    empty: '暂无诊断快照',
    overallStatus: '总体状态',
    checkedAt: '检测时间：{{time}}',
    status: {
      ok: '正常',
      warning: '警告',
      error: '异常',
      notConfigured: '未配置',
      unknown: '未知'
    },
    severity: {
      error: '异常',
      warning: '警告',
      info: '提示'
    },
    sections: {
      hookService: { title: 'Hook 服务' },
      relay: { title: 'Relay 工具' },
      hookConfig: { title: 'Hook 配置' },
      profile: { title: '当前方案' },
      devices: { title: '设备输出' }
    },
    flow: {
      title: '链路拓扑',
      description: '从 AI Hook 到输出设备的关键节点状态。'
    },
    issues: {
      title: '需要处理的问题',
      description: '按影响范围和严重程度列出当前链路风险。',
      empty: '未发现需要处理的问题',
      items: {
        hookServiceNotRunning: {
          title: '本地 Hook 服务未运行',
          description: 'AI 工具无法把 Hook 事件发送到软件。',
          suggestion: '请检查软件是否正常启动，必要时重启应用。'
        },
        relayNotInstalled: {
          title: 'Relay 工具未安装',
          description: 'AI 工具 Hook 命令需要调用本地 relay 工具转发事件。',
          suggestion: '请进入 Hook 设置页重新写入 Hook 配置。'
        },
        relayOutdated: {
          title: 'Relay 工具需要更新',
          description: '当前安装的 relay 工具和软件内置版本不一致。',
          suggestion: '请重启软件或重新写入 Hook 配置以同步 relay 工具。'
        },
        hookConfigTargetNotSynced: {
          title: 'Hook 配置未同步',
          description: '已启用的 Hook 配置和 Hook 设置中选择的事件不一致。',
          suggestion: '请进入 Hook 设置页预览并更新对应配置目标。'
        },
        profileMappingWithoutOutput: {
          title: '内部事件没有输出规则',
          description: '这些内部事件已经被映射使用，但没有配置任何输出方式。',
          suggestion: '请进入 AI事件映射页，为对应内部事件添加输出规则。'
        },
        deviceNoneRegistered: {
          title: '尚未注册设备',
          description: '当前没有可用于硬件输出的已注册设备。',
          suggestion: '请进入设备页面扫描并注册设备。'
        },
        deviceReferencedOffline: {
          title: '规则引用的设备离线',
          description: '输出规则引用了设备，但该设备当前没有连接。',
          suggestion: '请连接设备，或在设备页面执行自动连接已注册设备。'
        },
        deviceHeartbeatIssue: {
          title: '设备心跳异常',
          description: '设备连接存在，但心跳检测显示协议响应异常。',
          suggestion: '请检查连接线、固件版本，必要时重新连接设备。'
        },
        deviceFirmwareIssue: {
          title: '设备固件状态异常',
          description: '设备固件版本或协议版本可能和当前软件不匹配。',
          suggestion: '请进入固件页面检查并烧录当前内置固件。'
        },
        deviceRuntimeIssue: {
          title: '设备运行状态异常',
          description: '设备运行态存在需要关注的问题。',
          suggestion: '请进入设备页面查看具体设备状态。'
        },
        runtimeRecentFailure: {
          title: '最近运行链路存在失败',
          description: '最近 Hook 事件或输出执行过程中出现失败记录。',
          suggestion: '请进入 Debug 页面查看详细日志。'
        }
      }
    },
    devices: {
      title: '设备与固件',
      description: '多设备聚合状态和需要优先处理的设备。',
      issueList: '异常设备',
      emptyIssues: '暂无需要关注的设备',
      issueReasons: {
        referencedOffline: '输出规则引用了设备，但该设备当前没有连接。',
        heartbeatIssue: '设备连接存在，但心跳检测显示协议响应异常。',
        firmwareIssue: '设备固件版本或协议版本可能和当前软件不匹配。',
        connectionError: '设备连接或运行状态异常。',
        deviceNotConnected: '设备未连接，当前输出无法下发。',
        deviceChannelNotConfigured: '输出规则引用的设备通道未配置。',
        deviceActionUnsupported: '当前通道不支持输出规则中的动作。',
        deviceCommandUnsupported: '当前固件不支持本次下发命令。',
        deviceTransportError: '设备传输失败，请检查线缆、端口占用或重新插入设备。',
        deviceIdentityLimited: '该板卡无法提供强稳定设备 ID，同型号多设备同时使用时需要留意连接顺序。',
        boardCatalogMissing: '该设备对应的板卡目录缺失，请确认设备固件和软件版本是否匹配。',
        runtimeIssue: '设备运行态存在需要关注的问题。'
      },
      metrics: {
        registered: '已注册设备',
        connected: '已连接设备',
        offline: '离线设备',
        heartbeatIssues: '心跳异常',
        firmwareIssues: '固件异常',
        referencedUnavailable: '被规则引用但不可达'
      }
    },
    deviceHealth: {
      title: '设备健康检查',
      description: '检查设备连接、身份、固件、心跳、输入配置和规则引用。',
      summary: {
        ok: '健康',
        warning: '需关注',
        error: '异常'
      },
      checks: {
        connection: '连接状态',
        identity: '设备身份',
        firmware: '固件状态',
        heartbeat: '心跳状态',
        ruleReference: '规则引用',
        inputConfig: '输入配置'
      },
      issues: {
        none: '未发现问题',
        connectionError: '设备连接或运行状态异常',
        deviceConnecting: '设备正在连接',
        deviceActionTimeout: '设备动作响应超时',
        deviceChannelNotConfigured: '设备通道未配置',
        deviceCommandUnsupported: '当前固件不支持该命令',
        deviceConnectionChanged: '设备连接在操作期间发生变化',
        deviceInfoTimeout: '固件信息响应超时',
        deviceIoWorkerStopped: '设备通信 worker 已停止',
        deviceNotConnected: '设备未连接',
        deviceNotRegistered: '设备未注册',
        deviceOperationCancelled: '设备操作已取消',
        deviceProtocolInvalidResponse: '设备协议响应无效',
        deviceRuntimeUnavailable: '设备运行态不可用',
        deviceTransportBusy: '设备端口被占用',
        deviceTransportDisconnected: '设备传输已断开',
        deviceTransportError: '设备传输失败',
        deviceTransportPermissionDenied: '设备端口权限不足',
        deviceUidMissing: '设备缺少稳定身份',
        firmwareIssue: '固件需要检查',
        firmwareUnknown: '固件状态未知',
        heartbeatIssue: '心跳异常',
        heartbeatUnknown: '心跳状态未知',
        inputPendingSync: '输入配置需要连接后同步',
        referencedOffline: '规则引用的设备未连接',
        boardCatalogMissing: '板卡目录缺失',
        deviceIdentityLimited: '设备身份仍是临时状态'
      },
      empty: '暂无已注册设备。'
    },
    quickActions: {
      title: '快速动作',
      description: '只提供安全动作，配置写入仍回到对应页面确认。'
    },
    actions: {
      refreshDiagnostics: '重新检测全部',
      openHookSettings: '打开 Hook 设置',
      openAiEventMapping: '打开 AI事件映射',
      openDevices: '打开设备管理',
      openFirmware: '打开固件',
      openDebug: '打开 Debug',
      autoConnectRegisteredDevices: '自动连接已注册设备',
      sendTestEvent: '发送测试事件'
    }
  },
  setup: {
    title: '接入配置',
    description: '按步骤配置 Hook 服务、AI 工具和硬件设备',
    progressAria: '进度',
    stepLabel: '步骤 {{index}} {{label}}',
    previous: '上一步',
    next: '下一步',
    steps: {
      hookService: {
        label: '本地 Hook 服务',
        title: 'Hook 服务',
        description: '检查本地服务状态'
      },
      hookSettings: {
        label: 'Hook 设置',
        title: 'Hook 配置',
        description: '配置 AI 工具 Hook'
      },
      eventMapping: {
        label: '事件映射',
        title: 'AI 事件映射',
        description: '配置事件映射规则'
      },
      deviceFirmware: {
        label: '设备与固件',
        title: '设备配置',
        description: '连接硬件设备'
      },
      diagnosticsCheck: {
        label: '接入检查',
        title: '接入检查',
        description: '查看链路总览'
      }
    },
    hookService: {
      runningMessage: '本地 Hook 服务运行正常',
      stoppedMessage: '本地 Hook 服务未运行，请检查应用状态',
      title: '本地 Hook 服务',
      running: '运行中',
      stopped: '未运行',
      description: '接收 AI 工具发送的 Hook 事件',
      eventUrl: '事件接收地址：',
      healthUrl: '健康检查地址：',
      openDebug: '打开 Debug 页面测试'
    },
    hookSetup: {
      selectToolTitle: '选择 AI 工具',
      selectToolDescription: '选择你使用的 AI 编码工具',
      currentTool: '当前工具：',
      configureEventsTitle: '配置 Hook 事件',
      configureEventsDescription: '选择要监听的事件并写入配置文件',
      openHookSettings: '打开 Hook 设置页面',
      openHookSettingsHint: '在 Hook 设置页面中勾选事件、添加配置目标并写入配置'
    },
    eventMapping: {
      configured: '已配置 {{count}} 条事件映射规则',
      missing: '尚未配置事件映射，AI 事件将无法触发输出',
      title: '配置 AI 事件映射',
      description: '将 AI 工具的 Hook 事件映射到内部统一事件，再绑定各类输出',
      flowTitle: '映射流程：',
      flowStep1: 'AI 工具触发 Hook 事件（如 PreToolUse）',
      flowStep2: '映射到内部事件（如 agent.started）',
      flowStep3: '内部事件触发输出（如设备通道、系统通知等）',
      currentRules: '当前映射规则：',
      moreRules: '还有 {{count}} 条映射规则...',
      viewRules: '查看和修改映射规则',
      startRules: '开始配置事件映射',
      hint: '点击后将跳转到「AI事件映射」页面进行配置'
    },
    deviceFirmware: {
      deviceTitle: '设备连接与固件',
      deviceDescription:
        '在固件页按板卡选择并烧录对应固件，然后到设备管理页识别、注册和连接设备。',
      openDevices: '打开设备管理页面',
      openFirmware: '打开固件管理页面'
    },
    diagnostics: {
      title: '链路总览',
      description: '轻量检查 Hook、映射、输出规则和设备状态，完整排障请进入诊断中心。',
      loading: '正在加载接入检查...',
      empty: '暂无诊断数据，请重新检测。',
      openDiagnosticsCenter: '打开诊断中心'
    }
  },
  hookSettings: {
    title: 'Hook 设置',
    description: '维护 AI 工具 Hook 事件、全局配置和项目配置目标',
    errors: {
      invalidProjectDirectory: '请选择有效项目目录'
    },
    events: {
      title: 'Hook 事件',
      description: '选择要监听的 {{toolName}} Hook 事件',
      applyRecommended: '应用推荐配置',
      selectedCount: '已选 {{selected}} / {{total}}',
      searchPlaceholder: '搜索事件名称、描述...',
      loading: 'Hook 事件加载中...',
      empty: '没有匹配的事件',
      recommended: '推荐',
      requireOne: '至少选择一个 Hook 事件'
    },
    targets: {
      title: '配置目标',
      description: '管理全局配置和项目级 Hook 配置文件',
      addProject: '添加项目目录',
      empty: '暂无当前工具的配置目标',
      global: '全局配置',
      project: '项目配置',
      enabled: '已启用',
      disabled: '已禁用',
      enableHint: '启用全局配置会停用同源项目配置；启用项目配置会停用同源全局配置。同一目录的项目目标不可重复添加。',
      outdated: '配置过期',
      exists: '✓ 配置文件已存在',
      missing: '○ 配置文件不存在，可自动新建',
      previewing: '预览中...',
      writing: '启用中...',
      write: '写入',
      enable: '启用',
      eventMismatch: '当前配置与已选 Hook 事件不匹配，请预览并更新配置文件',
      debugMismatch: 'Debug 模式设置已变化，请预览并更新配置文件',
      debugEnabled: 'Debug 模式会写入 --debug，relay 将额外提交原始 payload{{suffix}}',
      debugDisabled: 'Debug 已关闭：relay 只提交默认摘要字段，未纳入摘要的 payload 字段不会参与输出变量渲染{{suffix}}',
      notUpdatedSuffix: '；当前配置尚未更新',
      writeDone: '✓ 写入完成',
      enableDone: '✓ 已启用',
      backup: '备份: {{path}}',
      restoring: '恢复中...',
      removeTarget: '移除此目标'
    },
    previewDialog: {
      title: '{{mode}}：{{targetLabel}}',
      writeMode: '配置预览',
      restoreMode: '还原预览',
      writeDescription: '{{existsMessage}}，共 {{count}} 个事件',
      restoreDescription: '确认后将移除当前软件写入的 Hook 项，保留用户自己的配置。',
      globalEnableWarning: '启用全局配置会修改全局 Hook 文件，并自动禁用同源项目配置，避免重复上报。',
      exists: '配置文件已存在',
      missing: '配置文件不存在，将自动新建',
      diff: '差异对比',
      oldConfig: '原配置',
      newConfig: '新配置',
      configToWrite: '将写入的配置',
      restoredConfig: '还原后配置',
      deletedLegend: '红色 表示已删除的内容',
      addedLegend: '绿色 表示新增的内容',
      contextLegend: '仅显示有差异的行周围的上下文',
      writing: '写入中...',
      restoring: '还原中...',
      write: '写入配置',
      confirmRestore: '确认还原'
    }
  },
  monitor: {
    title: '运行监控',
    description: '监控真实 Hook 事件、输出触发走势和当前运行健康状态。',
    refresh: '刷新',
    refreshing: '刷新中...',
    status: {
      hookService: 'Hook 服务',
      running: '运行中',
      abnormal: '异常',
      receivedEvents: '收到事件',
      outputAttempts: '输出触发',
      failures: '失败数',
      uptime: '运行时长',
      lastEvent: '最近事件',
      lastOutput: '最近输出'
    },
    charts: {
      eventTitle: '收到事件走势',
      eventDescription: '按 AI 工具区分，统计真实 Hook 事件。',
      outputTitle: '输出触发走势',
      outputDescription: '按输出方式区分，统计真实 Hook 触发的输出。',
      empty: '暂无统计数据',
      successFailure: '成功 {{success}} / 失败 {{failure}}'
    },
    outputTypes: {
      systemNotification: '系统通知',
      webhook: 'Webhook',
      sound: '声音提示',
      deviceChannel: '设备通道',
      display: '设备屏幕',
      buzzer: '蜂鸣器',
      desktopNotice: '桌面提示'
    },
    outputs: {
      title: '输出类型概览',
      description: '按输出方式统计当前运行周期内的触发次数、失败次数和成功率。',
      empty: '暂无输出触发统计',
      attempts: '触发 {{count}}',
      failures: '失败 {{count}}',
      successRate: '成功率 {{rate}}%'
    },
    recent: {
      title: '最近事件',
      description: '显示最近 20 条事件摘要，详细 payload 请打开详情查看。',
      empty: '暂无事件',
      internalEvent: '内部事件 {{event}}',
      details: '详情'
    },
    health: {
      snapshotFailed: '运行监控快照读取失败：{{error}}',
      hookStopped: '本地 Hook 服务未运行。',
      runtimeErrors: '当前运行周期内存在 {{count}} 条错误记录。',
      notificationFocus: '系统通知可能被系统专注模式拦截，请在系统设置中确认通知权限。'
    }
  },
  devices: {
    title: '设备管理',
    description: '管理多个硬件设备、传输连接、设备通道和测试动作。',
    unknownDevice: '未知设备',
    unknownBoard: '未知板卡',
    status: {
      disconnected: '未连接',
      connecting: '连接中',
      connected: '已连接',
      error: '异常'
    },
    list: {
      title: '设备实例',
      description: '查看当前运行时已注册的设备。',
      loading: '正在加载设备运行态...',
      empty: '暂无设备实例，请扫描并注册设备。',
      removeDevice: '移除设备 {{device}}',
      removeDialogTitle: '确认移除设备',
      removeDialogDescription:
        '将从已注册设备列表中移除“{{device}}”。如果该设备仍被输出规则引用，软件会阻止移除并提示你先调整规则。',
      confirmRemove: '确认移除',
      removeBlockedTitle: '设备正在被输出规则引用，不能移除。',
      removeBlockedDescription:
        '请先到 AI 事件映射中移除或改绑相关设备通道动作，然后再移除该设备。',
      referencedRule: '引用规则：{{rule}}',
      openRules: '前往 AI 事件映射'
    },
    discovery: {
      title: '设备发现',
      description: '手动扫描候选资源，只有点击识别时才会向设备发送握手命令。',
      scan: '扫描设备资源',
      scanning: '扫描中...',
      identify: '识别设备',
      identifying: '识别中...',
      register: '注册设备',
      registering: '注册中...',
      matchedDevice: '已匹配设备：{{device}}',
      portHint: 'Windows 下优先选择带有 USB 厂商、产品、VID/PID 或序列号的端口；如果识别超时，请确认设备未被 Arduino IDE、串口监视器或其他软件占用。',
      identityFallback: '当前设备身份尚未写入固件，串口地址变化后可能需要重新识别。建议烧录最新固件后再次识别。',
      autoConnectErrorTitle: '自动连接失败',
      empty: '暂无候选设备资源，请点击扫描设备资源。',
      statuses: {
        unidentified: '未识别',
        identifying: '识别中',
        identified: '已识别',
        matched: '已匹配',
        failed: '失败'
      }
    },
    connection: {
      title: '连接管理',
      description: '连接或断开当前选中的已注册设备。',
      scan: '扫描传输资源',
      scanning: '扫描中...',
      autoConnect: '自动连接已注册设备',
      autoConnecting: '自动连接中...',
      connect: '连接当前设备',
      connecting: '连接中...',
      errorTitle: '连接操作失败',
      disconnect: '断开设备',
      disconnectAll: '断开全部',
      openTransportMonitor: '打开通信监控',
      selectPort: '选择传输资源',
      portPlaceholder: '请先扫描传输资源',
      selectedTransport: '当前传输配置',
      availablePorts: '可用传输资源',
      matchedPort: '已匹配',
      emptyPorts: '暂无扫描结果，点击扫描传输资源。'
    },
    transportMonitor: {
      title: '设备通信监控',
      subtitle: '当前设备：{{device}}',
      stoppedBanner: '设备已断开或监控会话已停止。窗口保留最后收到的通信记录。',
      jumpTop: '跳转顶部',
      jumpLatest: '跳转最新',
      followScroll: '跟随滚动',
      stopFollow: '停止跟随',
      clear: '清空',
      allDirections: '全部方向',
      errorsOnly: '只看错误',
      empty: '暂无通信事件。请在主窗口继续操作当前设备。',
      noSelection: '选择一条事件查看详情。',
      payload: 'Payload',
      metadata: '元数据',
      detail: {
        id: 'ID',
        time: '时间',
        device: '设备',
        board: '板卡',
        transport: '传输通道',
        command: '命令',
        channel: '通道',
        control: '控件',
        error: '错误码'
      },
      direction: {
        outbound: '下行',
        inbound: '上行',
        system: '系统'
      },
      category: {
        command: '命令',
        ack: 'ACK',
        'input-event': '输入事件',
        heartbeat: '心跳',
        connection: '连接',
        error: '错误'
      },
      status: {
        pending: '等待',
        sent: '已发送',
        ok: '成功',
        timeout: '超时',
        error: '错误',
        skipped: '跳过',
        stopped: '已停止'
      }
    },
    operation: {
      connectingTitle: '正在连接设备',
      autoConnectingTitle: '正在自动连接设备',
      connectingDescription: '软件正在尝试打开设备通道并确认设备身份。设备连接不稳定时可能需要几秒。',
      deviceLabel: '设备',
      portLabel: '通道',
      cancelConnection: '取消连接',
      cancelling: '正在取消...',
      blockedHint: '已取消本次连接，短时间内不会自动重连该设备。'
    },
    identity: {
      title: '设备身份',
      description: '管理当前板卡写入固件的持久设备 ID。',
      currentUid: '当前设备 ID',
      reset: '重置设备 ID',
      resetting: '重置中...',
      errorTitle: '设备身份操作失败',
      confirmTitle: '确认重置设备 ID',
      confirmDescription: '软件会生成新的随机设备 ID，并写入当前连接设备的 EEPROM。',
      confirmWarning: '重置后，同一块板会以新的设备 ID 参与识别。请确认当前连接的是要重置的设备。',
      confirmReset: '确认重置'
    },
    channels: {
      title: '设备通道',
      description: '按当前设备能力展示可用通道。通道类型、针脚和电平语义由板卡能力配置维护。',
      channel: '通道',
      mode: '模式',
      kind: '类型',
      pin: '针脚',
      activeLevel: '有效电平',
      defaultLevel: '默认电平',
      actions: '操作',
      newChannel: '新增通道',
      addChannel: '添加通道',
      refreshCapabilities: '刷新通道能力',
      addChannelPlaceholder: '选择可用通道',
      removeChannel: '删除 {{channel}}',
      switchToInput: '切为输入',
      switchToOutput: '切为输出',
      confirmModeSwitch: '确认切换',
      configureInput: '配置 {{channel}} 输入动作',
      configureInputShort: '配置',
      modeSwitchBlockedTitle: '通道正在被输出规则引用，不能切换为输入。',
      modeSwitchBlockedDescription: '请先移除或修改引用该通道的输出规则，再切换通道模式。',
      referencedChannel: '通道：{{channel}}',
      referencedRule: '引用规则：{{rule}}',
      modeFixedInput: '固定输入',
      modeValue: {
        output: '输出',
        input: '输入'
      },
      emptyAvailable: '当前板型没有可添加的空闲通道。',
      guide: '说明'
    },
    channelKind: {
      'digital-output': '数字输出',
      'pwm-output': 'PWM 输出',
      'addressable-led': '可寻址 LED',
      display: '显示屏',
      buzzer: '蜂鸣器',
      relay: '继电器',
      'button-input': '按钮输入'
    },
    inputBinding: {
      title: '输入动作',
      description: '配置设备输入触发的键盘动作。',
      descriptionForChannel: '配置 {{channel}} 按下时触发的键盘动作。',
      enabled: '启用',
      enabledDescription: '关闭后保留配置，但不会触发快捷键。',
      modifiers: '修饰键',
      primaryKey: '主键',
      keyboardHint: '点击键盘上的按键，或使用监听按键快速录入。',
      captureShortcut: '监听按键',
      stopCapture: '停止监听',
      captureHint: '请按下要触发的键位或组合键。监听期间会阻止默认快捷键，避免误触发当前应用。',
      unsupportedKey: '当前按键暂不支持，请选择字母、数字、功能键、方向键或常用控制键。',
      unconfigured: '未配置',
      disabled: '已禁用',
      disabledShortcut: '{{shortcut}}（已禁用）',
      focusScopeHint: '快捷键会发送到当前焦点应用，后台应用不保证接收。',
      key: {
        space: '空格'
      },
      validation: {
        primaryRequired: '请选择一个主键。',
        comboNeedsOnePrimary: '组合键只能包含一个非修饰主键。',
        comboNeedsModifier: '组合键必须包含至少一个修饰键。'
      }
    },
    inputTest: {
      title: '按钮上行测试',
      description: '查看设备输入通道已绑定的快捷键，按下真实设备按钮时可对照高亮键位确认配置。',
      recentEvent: '最近收到',
      disabledHint: '当前按钮功能已禁用。设备仍可能上报按钮事件，但不会触发快捷键：{{shortcut}}。',
      unconfiguredHint: '当前输入通道还没有配置快捷键，请先在设备通道中配置输入动作。'
    },
    channelAction: {
      activate: '激活',
      deactivate: '关闭',
      blink: '闪烁',
      breathe: '呼吸',
      pulse: '脉冲',
      clear: '清除',
      'set-duty': '设置占空比',
      beep: '蜂鸣',
      tone: '播放音调',
      pattern: '提示音模式',
      'set-color': '设置颜色'
    },
    testAction: {
      title: '测试动作',
      description: '向选中设备的指定通道发送一次测试动作。',
      channel: '通道',
      action: '动作',
      duration: '持续时间',
      interval: '间隔',
      dutyPercent: '占空比',
      frequency: '频率',
      color: '颜色',
      brightness: '亮度',
      forever: '永久',
      ms: '{{ms}} ms',
      percent: '{{value}}%',
      hz: '{{value}} Hz',
      send: '发送测试动作',
      sending: '发送中...',
      ready: '已准备，可发送测试动作。',
      skipped: '设备未连接，测试动作已跳过。',
      sent: '测试动作已发送。',
      failed: '测试动作发送失败。'
    },
    deviceExtension: {
      title: '设备扩展能力',
      description: '向当前设备声明支持的屏幕、提示音等扩展能力发送设备级测试命令。',
      display: '屏幕测试',
      buzzerPatterns: '提示音模式',
      testRuntime: '测试运行态',
      clearDisplay: '清屏',
      mute: '静音',
      unmute: '取消静音',
      customDisplay: {
        title: '测试标题',
        message: '测试内容',
        send: '测试事件覆盖页',
        defaultTitle: 'CC Notice Test',
        defaultMessage: 'Test message',
        asciiNote: '该入口只用于验证屏幕事件覆盖页和串口下发链路，请使用英文、数字和常用符号。',
        asciiValidation: '当前屏幕暂不支持中文，请使用英文、数字或常用符号。'
      },
      status: {
        notice: '通知',
        success: '成功',
        working: '工作中',
        warning: '警告',
        error: '错误'
      },
      pattern: {
        notice: '通知音',
        success: '成功音',
        warning: '警告音',
        error: '错误音',
        working: '工作音'
      },
      statusPayload: {
        successTitle: 'Task Done',
        successMessage: 'CC Notice received a success state',
        workingTitle: 'Working',
        workingMessage: 'The current task is still running',
        warningTitle: 'Attention Needed',
        warningMessage: 'Check the current task state',
        errorTitle: 'Task Failed',
        errorMessage: 'Check the desktop app error details'
      },
      statusPayloadCompact: {
        successTitle: 'Done',
        successMessage: 'OK',
        workingTitle: 'Working',
        workingMessage: 'Running',
        warningTitle: 'Warning',
        warningMessage: 'Check',
        errorTitle: 'Failed',
        errorMessage: 'Error'
      },
      runtimePayload: {
        title: 'Working',
        message: 'E/O 12/34',
        line1: 'Last codex hook',
        line2: 'OK 33 / Err 1'
      }
    },
    runtime: {
      title: '运行状态',
      description: '查看选中设备最近一次下发、确认和错误信息。',
      errorTitle: '设备操作失败',
      deviceFirmwareVersion: '板子固件版本',
      bundledFirmwareVersion: '内置固件版本',
      firmwareStatus: '固件状态',
      checkFirmware: '检查固件版本',
      openDiagnostics: '查看诊断',
      firmwareCheckErrorTitle: '固件版本检查提示',
      firmwareStatuses: {
        unknown: '未知',
        'up-to-date': '已是最新',
        'update-available': '需要更新固件',
        incompatible: '协议不兼容',
        unsupported: '无法识别固件版本'
      },
      lastAck: '最近 ACK',
      lastError: '最近错误',
      lastSentAt: '最近下发时间'
    },
    heartbeat: {
      title: '心跳状态',
      description: '查看当前设备最近一次心跳和丢失判断状态。',
      status: '状态',
      lastHeartbeatAt: '最近心跳时间',
      failureCount: '失败次数',
      statuses: {
        unknown: '未知',
        healthy: '正常',
        stale: '异常',
        lost: '已丢失',
        unsupported: '当前固件不支持心跳'
      }
    }
  },
  hardwareGuides: {
    open: '说明',
    openForChannel: '查看 {{channel}} 连接说明',
    fallback: {
      title: '硬件连接助手',
      summary: '当前通道没有专用连接说明。',
      detail: '请先查看板卡针脚、电压、电流限制和外设模块说明，确认接线正确后再发送测试动作。'
    },
    sections: {
      suitableHardware: '适用硬件',
      recommendedScenarios: '推荐场景',
      wiring: '接线说明',
      electricalSpecs: '电气参数与电阻建议',
      electricalNotices: '电气注意事项',
      actions: '支持动作',
      testSteps: '测试步骤',
      faq: '常见问题'
    },
    pinout: {
      title: 'RP2040 Pico 引脚图',
      arduinoUnoTitle: 'Arduino Uno 引脚图',
      arduinoNanoTitle: 'Arduino Nano 引脚图',
      stm32BluePillTitle: 'STM32F103C8T6/C6T6 Blue Pill 引脚图',
      arduinoSchematicSubtitle: '交互式引脚示意图',
      boardImageAlt: '{{board}} 板卡主体图',
      references: {
        pinout: '官方引脚图',
        datasheet: '数据手册',
        chipDatasheet: '芯片数据手册',
        stm32duinoDocs: 'STM32duino 文档',
        picoDatasheet: 'Pico 数据手册',
        rp2040Datasheet: 'RP2040 数据手册'
      },
      legend: {
        gpio: 'GPIO',
        pwm: 'PWM',
        serial: '串口',
        ground: '接地',
        power: '电源',
        system: '系统控制',
        analog: '模拟参考',
        reference: '参考/保留'
      }
    },
    electrical: {
      gpioVoltage: 'GPIO 输出逻辑电平：3.3V。',
      arduinoGpioVoltage: 'GPIO 输出逻辑电平：5V。',
      gpioCurrentConservative: '单个 GPIO 建议按小电流信号使用，避免直接驱动大电流负载。',
      ledResistor: '普通 LED 推荐串联 330Ω - 1kΩ；默认优先选 470Ω 或 1kΩ。',
      sharedGround: '外设、外部电源和开发板必须共地。',
      driverRequired: '继电器、蜂鸣器、大功率 LED 和灯带建议使用驱动模块或外部供电。',
      ws2812DataResistor: 'WS2812/SK6812 数据线建议在靠近 DIN 端串联 330Ω - 470Ω 小电阻。',
      ws2812Power: 'WS2812/SK6812 应按灯珠数量使用外部电源，不要从 GPIO 取电。',
      ws2812Level: '5V 可寻址灯带在长线或不稳定场景下建议使用 3.3V 到 5V 电平转换。'
    },
    arduinoTinyAvr: {
      notices: {
        outputRange: '当前输出通道支持 D2-D10，D0/D1 为串口 RX/TX，不作为输出使用。',
        pwmPins: 'D3/D5/D6/D9/D10 支持呼吸和 PWM 类动作，其他数字输出脚只支持普通开关、闪烁或脉冲动作。',
        reservedPins: 'D11-D13、A0-A5 以及 Nano 的 A6/A7 当前只作为板卡引脚信息展示，不生成输出通道。'
      }
    },
    stm32BluePill: {
      notices: {
        smallMcuScope: '按 STM32F103C6T6 最小资源约束，只开放稳妥数字输出；运行态使用板载 USB CDC 串口。',
        swdPins: 'PA13/PA14 为 SWD 调试和烧录引脚，不作为输出通道使用。'
      }
    },
    digitalOutput: {
      title: '数字输出连接助手',
      summary: '适合普通 LED、继电器输入和低压数字触发模块。',
      hardware: {
        led: '普通单色 LED 或带限流模块的 LED 指示灯。',
        relay: '低压继电器模块、光耦输入模块或其他数字触发输入。'
      },
      scenarios: {
        status: '用于表达运行、完成、失败等二值或闪烁状态。',
        trigger: '用于触发外部低压模块的开关输入。'
      },
      wiring: {
        pin: 'GPIO 输出脚连接到模块信号脚；普通 LED 需要串联合适限流电阻。',
        ground: '外设 GND 必须与开发板 GND 共地。'
      },
      notices: {
        resistor: '裸 LED 必须串联限流电阻，避免 GPIO 过流。',
        current: '不要直接驱动大电流负载，继电器线圈和灯带需要驱动模块。'
      },
      tests: {
        connect: '先断电完成接线，再连接开发板并进入设备页。',
        activate: '发送激活或闪烁测试动作，确认电平语义与外设响应一致。'
      },
      faq: {
        inverted: '如果输出逻辑相反，请检查通道有效电平配置或外设输入是否为低电平触发。'
      }
    },
    pwmOutput: {
      title: 'PWM 输出连接助手',
      summary: '适合需要亮度、占空比或简单渐变控制的输出模块。',
      hardware: {
        led: '可调亮度 LED 模块或经限流后的 LED。',
        driver: 'MOSFET/三极管驱动模块，用于更高电流负载。'
      },
      scenarios: {
        brightness: '用于按状态展示不同亮度或强弱提示。',
        fade: '用于脉冲、渐亮渐暗等柔和提示。'
      },
      wiring: {
        pin: 'PWM GPIO 连接模块信号输入，负载电源按模块说明单独供电。',
        ground: '驱动模块和开发板必须共地。'
      },
      notices: {
        driver: '大电流 LED 或灯带必须使用外部驱动，不能直接接 GPIO。',
        frequency: '如出现闪烁，可调整 PWM 频率或更换驱动模块。'
      },
      tests: {
        duty: '先发送较低占空比测试，再逐步调高，确认亮度变化正常。',
        clear: '发送清除动作，确认输出恢复到默认占空比。'
      },
      faq: {
        flicker: '肉眼可见闪烁通常与频率、供电或驱动模块有关。'
      }
    },
    buzzer: {
      title: '蜂鸣器连接助手',
      summary: '适合失败、权限确认、长任务结束等需要声音提示的场景。',
      hardware: {
        active: '有源蜂鸣器模块，通常只需要高低电平控制。',
        passive: '无源蜂鸣器模块，可通过 tone 动作输出指定频率。'
      },
      scenarios: {
        failure: '用于错误、失败或需要人工介入的提醒。',
        permission: '用于权限请求、任务完成等短促提示。'
      },
      wiring: {
        pin: 'GPIO 输出脚连接蜂鸣器模块信号脚。',
        ground: '蜂鸣器模块 GND 与开发板 GND 共地。'
      },
      notices: {
        current: '蜂鸣器电流较大时需要驱动模块，不要直接由 GPIO 供电。',
        volume: '测试时先使用短时长动作，避免持续蜂鸣影响使用。'
      },
      tests: {
        beep: '发送蜂鸣动作，确认模块能发出短提示音。',
        tone: '如使用无源蜂鸣器，发送 tone 动作确认频率变化。'
      },
      faq: {
        silent: '无声音时先确认蜂鸣器类型、有源/无源动作是否匹配，以及供电和共地是否正确。'
      }
    },
    addressableLed: {
      title: '可寻址 LED 连接助手',
      summary: '适合 WS2812、SK6812 等单线可寻址灯带或灯环。',
      hardware: {
        strip: 'WS2812/SK6812 灯带、灯珠板或矩阵屏。',
        ring: 'NeoPixel 兼容灯环或小型状态灯阵列。'
      },
      scenarios: {
        richStatus: '用于显示更丰富的颜色、亮度和多状态提示。',
        multiDevice: '用于多设备或显示型硬件的扩展状态表达。'
      },
      wiring: {
        data: 'GPIO 数据脚连接灯带 DIN，建议靠近灯带输入端串联小电阻。',
        power: '灯带按实际数量使用合适外部电源，不要从 GPIO 取电。',
        ground: '外部电源 GND、灯带 GND 和开发板 GND 必须共地。'
      },
      notices: {
        power: '多颗灯珠全亮电流很高，测试时先限制亮度和灯珠数量。',
        level: '部分 5V 灯带可能需要电平转换，3.3V 数据线不一定稳定。'
      },
      tests: {
        color: '先发送低亮度单色测试，确认颜色和灯珠顺序正确。',
        brightness: '逐步调整亮度，观察供电是否稳定。'
      },
      faq: {
        colorOrder: '颜色不对通常是 RGB/GRB 顺序不同，可在通道配置中调整。'
      }
    }
  },
  firmware: {
    title: '固件管理',
    description: '查看和更新硬件设备固件',
    catalogTitle: '固件目录',
    catalogDescription: '查看软件当前内置的可烧录固件',
    catalogLoading: '正在加载固件目录...',
    catalogEmpty: '暂无可用固件',
    artifactCount: '{{count}} 个',
    recommendedBadge: '推荐',
    notRecommendedBadge: '可选',
    boardFamily: '板卡族',
    capabilityTier: '能力层级',
    capabilityDescription: '能力说明',
    recommendationStatus: '推荐状态',
    recommendationReasonTitle: '推荐理由',
    boardFamilies: {
      rp2040: 'RP2040',
      arduinoAvr: 'Arduino AVR',
      stm32: 'STM32',
      seeedSamd: 'Seeed SAMD',
      unknown: '其他板卡'
    },
    capabilityTiers: {
      full: {
        label: '完整能力',
        description: '适合 Pico 这类能力更完整的板卡，可覆盖常用提示输出场景。'
      },
      lightweight: {
        label: '轻量能力',
        description: '适合 32U4 类 Arduino 板卡，保留常用输出能力，烧录前需要准备 Arduino CLI。'
      },
      minimal: {
        label: '精简能力',
        description: '适合 Uno / Nano 这类入门 AVR 板卡，只开放更稳妥的少量输出通道。'
      },
      extended: {
        label: '扩展设备能力',
        description: '适合带屏幕、按键、板载蜂鸣器和传感器的综合设备，输出通道与设备级扩展能力分开建模。'
      },
      oled096: {
        description:
          '适合 Raspberry Pi Pico 外接 0.96 寸 128x64 I2C OLED，保留常用输出通道，并额外支持设备级屏幕状态输出。'
      },
      oled091: {
        description:
          '适合 Raspberry Pi Pico 外接 0.91 寸 128x32 I2C OLED，使用 GP20/GP21 连接屏幕并保留 GP22 作为普通输出通道。'
      },
      stm32SmallMcu: {
        description: '按 STM32F103C6T6 最小资源约束开放稳妥数字输出，启用板载 USB CDC 串口，不启用高占用能力。'
      },
      unknown: {
        label: '未知能力',
        description: '该板卡暂未配置明确的能力层级说明。'
      }
    },
    recommendationReason: {
      pico: 'Pico 使用 UF2 烧录盘复制固件，烧录和日常恢复都更简单，建议优先尝试。'
    },
    wiring: {
      pin: '针脚',
      function: '预期功能',
      connection: '接线方式',
      reservedPins: '占用与保留',
      noticeTitle: '接线注意',
      functions: {
        digitalOutput: '数字输出',
        pwmOutput: 'PWM / 呼吸输出',
        ws2812: 'WS2812 数据输出',
        buzzer: '蜂鸣器输出',
        onboardBuzzer: '板载蜂鸣器',
        builtInDisplay: '板载屏幕',
        oledSda: 'OLED I2C SDA',
        oledScl: 'OLED I2C SCL',
        oledReset: 'OLED 复位',
        oledPower: 'OLED 供电'
      },
      wires: {
        digitalOutput: '输出脚连接 LED、继电器模块或驱动模块输入端，外设 GND 与板卡 GND 共地。',
        pwmOutput: '连接支持 PWM 的 LED 或驱动模块输入端，用于亮度、呼吸或脉冲效果。',
        ws2812: '连接灯带 DIN，灯带电源按灯珠数量独立供电，并与板卡 GND 共地。',
        buzzer: '连接有源或无源蜂鸣器信号端，大电流蜂鸣器需通过驱动模块连接。',
        onboardBuzzer: '无需外接，固件直接驱动 Wio Terminal 板载蜂鸣器。',
        builtInDisplay: '无需外接，固件直接使用 Wio Terminal 板载 LCD。',
        oled096Sda: '连接 OLED D1 / SDA。',
        oled096Scl: '连接 OLED D0 / SCL。',
        oled091Sda: '连接 OLED SDA。',
        oled091Scl: '连接 OLED SCL。',
        oledReset: '连接 OLED RES / RST，固件上电后会执行一次复位脉冲。',
        oledPower: 'OLED VCC 接 3V3，GND 接板卡 GND。'
      },
      noticeItems: {
        rp2040Voltage: 'RP2040 GPIO 逻辑电平为 3.3V，不能直接接 5V 信号输入。',
        arduinoVoltage: 'Uno / Nano GPIO 逻辑电平为 5V，连接 3.3V 外设前需要确认兼容性。',
        proMicroVoltage: '当前 Pro Micro 固件面向 5V/16MHz 变体，GPIO 逻辑电平为 5V，连接 3.3V 外设前需要确认兼容性。',
        sharedGround: '外接模块必须与板卡 GND 共地，否则信号电平不可靠。',
        driverForLoad: '继电器、电机、大功率灯带等负载不要直接由 GPIO 供电，应使用驱动模块或独立电源。',
        oledI2cAddress: 'OLED I2C 地址由屏幕硬件决定，固件会探测 0x3C 和 0x3D。',
        stm32Voltage: 'STM32F103 Blue Pill GPIO 逻辑电平为 3.3V，不能直接接 5V 信号输入。'
      },
      guides: {
        rp2040Pico: {
          title: 'Raspberry Pi Pico 接线说明',
          summary: '普通 Pico 软件侧开放数字输出和蜂鸣器通道，默认只启用 GP0、GP1、GP2。',
          reserved: {
            usb: 'USB 串口用于软件通信，不需要额外占用 GPIO。',
            system: 'RUN、3V3_EN、ADC_VREF 等系统和参考针脚只作为板卡信息展示。'
          }
        },
        rp2040PicoOled096: {
          title: 'Pico + OLED 0.96 寸 128x64 接线说明',
          summary: '该固件使用 GP20/GP21 连接 I2C OLED，并使用 GP22 控制屏幕复位。',
          reserved: {
            i2c: 'GP20 和 GP21 被 OLED I2C 占用，不再作为普通数字输出通道。',
            reset: 'GP22 被 OLED RES/RST 占用，不再作为普通数字输出通道。'
          }
        },
        rp2040PicoOled091: {
          title: 'Pico + OLED 0.91 寸 128x32 接线说明',
          summary: '该固件使用 GP20/GP21 连接 I2C OLED，软件侧开放普通数字输出、蜂鸣器和屏幕输出入口。',
          reserved: {
            i2c: 'GP20 和 GP21 被 OLED I2C 占用，不再作为普通数字输出通道。'
          }
        },
        arduinoUno: {
          title: 'Arduino Uno 接线说明',
          summary: 'Uno 软件侧开放 D2-D10 作为稳妥数字输出通道。',
          reserved: {
            serial: 'D0/D1 是硬串口 RX/TX，不作为输出通道使用。'
          }
        },
        arduinoNano: {
          title: 'Arduino Nano 接线说明',
          summary: 'Nano 软件侧开放 D2-D10 作为稳妥数字输出通道，新版和旧版 bootloader 只影响烧录参数。',
          reserved: {
            serialAnalog: 'D0/D1 是硬串口 RX/TX；D11-D13、A0-A7 当前只作为引脚信息展示。'
          }
        },
        sparkfunProMicro32u4: {
          title: 'SparkFun Pro Micro 32U4 接线说明',
          summary: '该固件面向 5V/16MHz Pro Micro，软件侧开放常见排针数字输出、D3/D5/D6/D9/D10 呼吸动作和 D9 蜂鸣器。',
          reserved: {
            usb: '板载 USB 同时用于软件通信和烧录；运行时不需要额外 USB-TTL 接线。',
            unrouted: 'D13、D22、D23 不在常见 Pro Micro 排针上；D17/RX_LED 是板载 LED 焊盘。这些脚不作为普通外接输出通道使用。',
            sharedD9: 'D9 同时可作为数字输出/PWM 呼吸和蜂鸣器通道，接线时同一时间只接一种外设。'
          }
        },
        wioTerminal: {
          title: 'Wio Terminal 接线说明',
          summary: 'Wio Terminal 固件同时支持 Grove/排针数字输出、板载蜂鸣器、板载屏幕和按钮输入。',
          reserved: {
            onboard: '板载 LCD、蜂鸣器和按键无需额外接线；外接模块仍需按 Grove 或排针引脚共地连接。'
          }
        },
        stm32BluePill: {
          title: 'STM32F103C8T6/C6T6 Blue Pill 接线说明',
          summary: 'Blue Pill 固件开放 PA0-PA7、PB0/PB1、PB10/PB11 作为数字输出通道。',
          reserved: {
            swd: 'PA13/PA14 是 SWD 调试和烧录引脚，只作为板卡信息展示，不作为输出通道使用。'
          }
        }
      }
    },
    flashGuides: {
      stm32BluePill: {
        title: 'STM32 串口烧录准备',
        summary: '该固件通过 USB-TTL 串口烧录，不是拖拽文件，也不是 SWD 烧录。',
        wiringTitle: 'USB-TTL 接线',
        wiringTx: 'USB-TTL TXD -> PA10 / USART1_RX',
        wiringRx: 'USB-TTL RXD -> PA9 / USART1_TX',
        wiringGnd: 'USB-TTL GND -> Blue Pill GND',
        wiringVoltage: '使用 3.3V TTL 电平；板子已通过 USB 供电时，不要再接 USB-TTL 的 3V3。',
        bootTitle: '进入烧录模式',
        bootEnter: 'BOOT0 置 1，BOOT1 保持 0，然后按 RESET。',
        bootExit: '烧录完成后将 BOOT0 改回 0，再按 RESET 运行固件。',
        runtimeTitle: '烧录后连接',
        runtimeUsb: '烧录完成后，将 BOOT0 改回 0 并按 RESET，然后用板载 USB 连接软件。',
        runtimeTtl: 'USB-TTL 主要用于串口烧录，日常识别和连接不需要继续接 TXD/RXD。',
        dependencyTitle: '软件依赖',
        dependencyTools: '需要 Arduino CLI、STM32CubeProgrammer 和 GNU getopt。',
        dependencyGetopt: 'macOS 如遇 getopt 参数错误，可安装 GNU getopt：brew install gnu-getopt。',
        dependencyProgrammer:
          '如提示找不到 STM32_Programmer_CLI，请安装 STM32CubeProgrammer，并确保软件进程能读取该命令路径。',
        portTitle: '端口选择',
        portHint: '选择 USB-TTL 对应的 /dev/cu.usbserial-* 或同类串口。'
      }
    },
    currentFirmware: '当前固件',
    firmwareDescription: '设备固件信息',
    deviceName: '设备名称',
    boardName: '板卡名称',
    boardId: '板卡 ID',
    artifactId: '固件产物 ID',
    bundledFirmwareVersion: '内置固件版本',
    firmwareSource: '固件来源',
    artifactType: '产物类型',
    targetId: '构建目标',
    toolchain: '构建工具链',
    flashStrategy: '烧录方式',
    flashVolumeName: '目标卷名',
    uploadFqbn: 'Arduino FQBN',
    uploadProtocol: '上传协议',
    uploadSpeed: '上传速率',
    uploadReset: '复位方式',
    uploadResetRequired: '需要 1200bps 复位',
    uploadResetNotRequired: '不需要自动复位',
    bootloaderWait: 'Bootloader 等待时间',
    boardOptions: '板卡选项',
    relativePath: '相对路径',
    noSelectedFirmware: '请选择一个固件',
    firmwareFile: '固件文件',
    protocolVersion: '协议版本',
    updateTitle: '固件更新',
    updateDescription: '将软件内置固件烧录到设备',
    dropHint: '将固件文件拖拽到此处，或点击选择文件',
    chooseFile: '选择固件文件',
    bootselStatus: '烧录盘状态',
    flashSupportStatus: '烧录支持状态',
    arduinoCliStatus: 'Arduino CLI 状态',
    arduinoCliAvailable: '已检测到 Arduino CLI：{{version}}',
    arduinoCliUnavailable: '未检测到 Arduino CLI',
    arduinoCliHintTitle: 'Arduino 烧录说明',
    arduinoCliHintReady: '选择目标串口后即可通过 Arduino CLI 烧录所选固件。',
    arduinoCliHintConfigure:
      '请先在设置页配置 arduino-cli 路径，或确认 arduino-cli 已加入系统 PATH。',
    arduinoCliNotFound: '未检测到 Arduino CLI。请在设置中配置 arduino-cli 路径，或确认它已经加入系统 PATH。',
    flashTargetPort: '目标端口',
    flashTargetPortDescription: '选择准备进入烧录流程的设备串口。',
    noFlashTargetPort: '暂无可用串口',
    refreshFlashTargets: '刷新端口',
    detecting: '正在检测 RPI-RP2 烧录盘...',
    bootselMissing: '未检测到 RPI-RP2 烧录盘',
    directFlashUnsupported: '该固件不使用当前烧录方式',
    directFlashUnsupportedTitle: '请选择匹配的烧录方式',
    directFlashUnsupportedDescription: '请根据固件类型选择对应设备和烧录目标。',
    refreshStatus: '刷新状态',
    flashBuiltIn: '烧录内置固件',
    flashSelected: '烧录所选固件',
    flashSuccess: '固件已复制到 RPI-RP2，设备将自动重启。',
    copiedBytes: '已复制 {{bytes}} 字节。',
    arduinoCliFlashSuccess: 'Arduino CLI 烧录完成。',
    arduinoCliFlashTarget: '目标端口：{{target}}',
    noteFormat: '• 固件文件格式：.uf2',
    noteConnected: '• 更新前请确保设备已连接',
    noteBootsel: '• 按住 BOOTSEL 插入 RP2040 Pico，直到系统出现 RPI-RP2 磁盘',
    noteKeepConnected: '• 烧录过程中请勿断开设备'
  },
  hookEvents: {
    codex: {
      sessionStart: {
        title: '会话开始',
        description: 'Codex 会话或恢复会话开始时触发。',
        scenario: '用于提示 AI 已进入工作状态。'
      },
      subagentStart: {
        title: '子代理开始',
        description: 'Codex 启动子代理处理任务时触发。',
        scenario: '用于观察复杂任务中的子代理活动。'
      },
      preToolUse: {
        title: '工具调用前',
        description: 'Codex 即将调用命令、文件或其他工具前触发。',
        scenario: '用于提示 AI 正在执行具体操作。'
      },
      permissionRequest: {
        title: '权限请求',
        description: 'Codex 需要用户授权某个工具调用时触发。',
        scenario: '用于提示用户需要处理授权或确认。'
      },
      postToolUse: {
        title: '工具调用后',
        description: 'Codex 工具调用完成后触发。',
        scenario: '用于提示一次命令或工具操作已结束。'
      },
      preCompact: {
        title: '压缩前',
        description: 'Codex 即将压缩上下文前触发。',
        scenario: '用于观察上下文整理前的状态变化。'
      },
      postCompact: {
        title: '压缩后',
        description: 'Codex 完成上下文压缩后触发。',
        scenario: '用于观察上下文整理完成。'
      },
      userPromptSubmit: {
        title: '用户提交提示',
        description: '用户向 Codex 提交新提示时触发。',
        scenario: '用于提示新一轮 AI 工作即将开始。'
      },
      subagentStop: {
        title: '子代理结束',
        description: 'Codex 子代理完成工作时触发。',
        scenario: '用于观察复杂任务中的子代理结束。'
      },
      stop: {
        title: '会话轮次结束',
        description: 'Codex 当前响应或任务轮次结束时触发。',
        scenario: '用于提示 AI 当前工作已完成。'
      }
    },
    claudeCode: {
      sessionStart: {
        title: '会话开始',
        description: 'Claude Code 会话开始时触发。',
        scenario: '用于提示 AI 已进入工作状态。'
      },
      userPromptSubmit: {
        title: '用户提交提示',
        description: '用户提交新提示时触发。',
        scenario: '用于提示新一轮 AI 工作即将开始。'
      },
      userPromptExpansion: {
        title: '提示扩展',
        description: 'Claude Code 扩展用户提示时触发。',
        scenario: '用于观察提示被扩展或改写的过程。'
      },
      preToolUse: {
        title: '工具调用前',
        description: '工具调用前触发。',
        scenario: '用于提示 AI 正在执行具体操作。'
      },
      postToolUse: {
        title: '工具调用后',
        description: '工具调用完成后触发。',
        scenario: '用于提示一次工具操作已结束。'
      },
      postToolUseFailure: {
        title: '工具调用失败',
        description: '工具调用失败后触发。',
        scenario: '用于提示 AI 操作失败。'
      },
      postToolBatch: {
        title: '工具批次完成',
        description: '一批工具调用完成后触发。',
        scenario: '用于减少逐条工具事件带来的提示频率。'
      },
      notification: {
        title: '通知',
        description: 'Claude Code 发出通知时触发。',
        scenario: '用于提示用户需要关注状态变化。'
      },
      permissionRequest: {
        title: '权限请求',
        description: '需要用户授权时触发。',
        scenario: '用于提示用户处理授权。'
      },
      stop: {
        title: '停止',
        description: '当前响应或任务结束时触发。',
        scenario: '用于提示 AI 当前工作已完成。'
      },
      stopFailure: {
        title: '停止失败',
        description: '停止流程失败时触发。',
        scenario: '用于提示任务结束阶段发生异常。'
      },
      subagentStart: {
        title: '子代理开始',
        description: '子代理开始处理任务时触发。',
        scenario: '用于观察复杂任务中的子代理活动。'
      },
      subagentStop: {
        title: '子代理结束',
        description: '子代理完成工作时触发。',
        scenario: '用于观察复杂任务中的子代理结束。'
      },
      taskCreated: {
        title: '任务创建',
        description: 'Claude Code 创建任务时触发。',
        scenario: '用于观察任务拆分和排队。'
      },
      taskCompleted: {
        title: '任务完成',
        description: 'Claude Code 任务完成时触发。',
        scenario: '用于观察任务完成。'
      },
      preCompact: {
        title: '压缩前',
        description: '上下文压缩前触发。',
        scenario: '用于观察上下文整理前状态。'
      },
      postCompact: {
        title: '压缩后',
        description: '上下文压缩后触发。',
        scenario: '用于观察上下文整理完成。'
      },
      sessionEnd: {
        title: '会话结束',
        description: '会话结束时触发。',
        scenario: '用于提示 AI 会话已结束。'
      },
      configChange: {
        title: '配置变化',
        description: '配置变化时触发。',
        scenario: '用于观察 Claude Code 配置调整。'
      },
      cwdChanged: {
        title: '目录变化',
        description: '工作目录变化时触发。',
        scenario: '用于观察工作上下文切换。'
      },
      fileChanged: {
        title: '文件变化',
        description: '文件变化时触发。',
        scenario: '用于观察文件编辑活动。'
      },
      permissionDenied: {
        title: '权限拒绝',
        description: '权限请求被拒绝时触发。',
        scenario: '用于提示权限受限导致操作无法继续。'
      },
      teammateIdle: {
        title: '协作者空闲',
        description: '协作者空闲时触发。',
        scenario: '用于协作场景的状态提示。'
      },
      worktreeCreate: {
        title: '工作树创建',
        description: '创建工作树时触发。',
        scenario: '用于观察并行工作区创建。'
      },
      worktreeRemove: {
        title: '工作树移除',
        description: '移除工作树时触发。',
        scenario: '用于观察并行工作区清理。'
      },
      messageDisplay: {
        title: '消息显示',
        description: '显示消息时触发。',
        scenario: '用于观察重要消息展示。'
      },
      elicitation: {
        title: '信息征询',
        description: 'Claude Code 征询额外信息时触发。',
        scenario: '用于提示用户可能需要补充信息。'
      },
      elicitationResult: {
        title: '信息征询结果',
        description: '信息征询得到结果时触发。',
        scenario: '用于观察补充信息流程完成。'
      }
    }
  },
  rules: {
    title: 'AI事件映射',
    loadingProfile: '配置方案加载中...',
    description: '配置 AI 原始 Hook 事件到内部事件，再将内部事件绑定到各类输出',
    toast: {
      createTitle: '创建成功',
      createDescription: '配置方案「{{name}}」已创建',
      duplicateTitle: '复制成功',
      activateTitle: '激活成功',
      activateDescription: '配置方案「{{name}}」已激活',
      deleteTitle: '删除成功',
      deleteDescription: '配置方案「{{name}}」已删除'
    },
    profile: {
      title: '配置方案',
      description: '管理事件映射、输出规则和设备策略',
      create: '新建',
      import: '导入',
      export: '导出',
      duplicateCurrent: '复制当前',
      empty: '暂无配置方案',
      createFirst: '创建第一个方案',
      active: '已激活',
      openMenu: '打开菜单',
      activate: '激活',
      duplicate: '复制',
      delete: '删除',
      activateThis: '激活此配置',
      createDialogTitle: '新建配置方案',
      duplicateDialogTitle: '复制配置方案',
      createDialogDescription: '创建一个新的配置方案。方案 ID 将自动生成。',
      duplicateDialogDescription: '从「{{name}}」复制配置。方案 ID 将自动生成。',
      nameRequired: '方案名称不能为空',
      nameTooShort: '方案名称至少需要 2 个字符',
      nameTooLong: '方案名称不能超过 50 个字符',
      nameLabel: '方案名称',
      namePlaceholder: '例如：专注模式、快速编码',
      idHint: '方案 ID 将根据名称自动生成（如：focus-mode-a1b2c3d4）',
      templateLabel: '选择模板',
      deleteDialogTitle: '确认删除配置方案？',
      deleteDialogDescription: '即将删除配置方案「{{name}}」。此操作无法撤销。'
    },
    profilePackage: {
      import: '导入方案',
      importing: '导入中...',
      importDialogTitle: '导入配置方案',
      importDialogDescription: '将导入为新配置方案「{{name}}」，不会覆盖现有方案。',
      sourceProfile: '来源方案',
      importedProfile: '导入后名称',
      hookEventCount: 'Hook 事件',
      aiMappingCount: 'AI 映射',
      outputRuleCount: '输出规则',
      deviceRuleCount: '设备规则',
      desktopNoticeInstanceCount: '桌面提示实例',
      hookConfigWarning:
        '导入只恢复 CC Notice 内部 Hook 事件选择，不会写入 Codex、Claude 等工具的 Hook 配置文件。导入后请到 Hook 设置页确认并手动写入。',
      customMascotWarning:
        '导入包引用了本地自定义精灵资源包，但配置包不包含 GIF 素材。请确保当前机器的资源包放置目录中已有同名资源包，否则相关桌面精灵实例可能无法正常显示。',
      deviceBindingTitle: '设备输出规则绑定',
      deviceBindingDescription:
        '导入包不携带旧机器设备实例。可以把来源设备分组绑定到当前已连接设备；未绑定或能力不匹配的设备规则会保留但禁用。',
      requirementCount: '{{count}} 条能力需求',
      noBinding: '不绑定，导入后禁用',
      noDeviceRules: '该方案不包含设备输出规则，可直接导入。',
      activateAfterImport: '导入后立即激活新方案',
      activateAfterImportDescription:
        '激活只切换 CC Notice 当前方案，Hook 配置文件仍需要到 Hook 设置页确认。',
      exportSuccessTitle: '导出成功',
      exportSuccessDescription: '配置方案包已写入所选文件。',
      exportFailedTitle: '导出失败',
      previewFailedTitle: '无法预览导入包',
      importSuccessTitle: '导入成功',
      importSuccessDescription: '配置方案「{{name}}」已导入。请按需到 Hook 设置页写入 Hook 配置。',
      importFailedTitle: '导入失败',
      status: {
        'full-match': '完全匹配',
        'partial-match': '部分匹配',
        'board-mismatch': '板型不匹配',
        unbound: '未绑定'
      },
      statusHelp: {
        'full-match': '目标设备板型和通道能力都匹配，导入后可保持原规则启用状态。',
        'partial-match': '目标设备板型一致但缺少部分通道或动作，相关设备规则会被禁用。',
        'board-mismatch': '目标设备板型不同，允许保留绑定意图，但相关设备规则会被禁用。',
        unbound: '未选择目标设备，相关设备规则会被禁用，后续可在输出规则中手动调整。'
      }
    },
    profileTemplates: {
      basic: {
        name: '基础映射方案',
        description: '预设常用 AI Hook 到内部事件的映射和基础输出规则，不启用任何 Hook。'
      },
      advanced: {
        name: '完整映射方案',
        description: '预设当前支持 AI 工具的完整 Hook 映射和输出规则，不启用任何 Hook。'
      },
      blank: {
        name: '空白方案',
        description: '从零开始自定义配置'
      }
    },
    tabs: {
      visualWorkflow: '可视化配置',
      aiMapping: 'AI事件映射',
      outputRules: '输出规则设置'
    },
    linkWorkflow: {
      title: '可视化配置',
      description: '按固定流程配置 Hook 事件、内部事件和输出规则。',
      noEnabledHookEvents: 'Hook 设置中还没有启用事件',
      noEnabledHookEventsHint: '请先到 Hook 设置中选择需要监听的事件，再回到这里配置映射链路。',
      openHookSettings: '前往 Hook 设置',
      status: {
        blocked: '需先处理',
        empty: '未配置',
        ready: '可配置',
        configured: '已配置',
        warning: '待完善'
      },
      canvas: {
        internalOverviewTitle: '内部事件总览',
        internalOverviewDescription: '查看已被使用的内部事件。',
        outputOverviewTitle: '输出规则',
        outputOverviewDescription: '查看会触发的输出方式。'
      },
      toolNode: {
        enabledCount: '启用 {{count}} 个 Hook',
        mappedCount: '{{mapped}}/{{total}}'
      },
      inspector: {
        hookMapping: 'Hook 映射',
        mapped: '已映射',
        unmapped: '未配置映射',
        disabledMapping: '映射已停用',
        internalReferences: '内部事件引用',
        editAiMapping: '编辑 AI 映射',
        openOutputRules: '进入输出规则',
        toolDialogDescription: '查看该 AI 工具已启用 Hook 事件的映射状态。',
        internalDialogDescription: '查看已被 AI Hook 使用的内部事件。',
        outputDialogDescription: '查看内部事件对应的输出配置。',
        noInternalReferences: '还没有内部事件被 Hook 映射引用。',
        noOutputInternalEvents: '请先完成 Hook 到内部事件的映射，再配置输出方式。',
        referenceCount: '{{count}} 个 Hook 映射引用',
        hookReferences: '引用 Hook',
        viewHookReferences: '查看 {{event}} 的 Hook 引用',
        enableHookMapping: '启用 {{event}} 映射',
        disableHookMapping: '停用 {{event}} 映射',
        configureMapping: '配置映射',
        editMapping: '编辑映射',
        configureHookMappingFor: '配置映射 {{event}}',
        editHookMappingFor: '编辑映射 {{event}}',
        configureHookMappingTitle: '配置 Hook 映射',
        editHookMappingTitle: '编辑 Hook 映射',
        hookMappingDetailDescription: '为当前 Hook 事件选择一个内部事件，保存后该事件会进入输出规则链路。',
        currentAiTool: 'AI 工具',
        currentHookEvent: '当前 Hook 事件',
        internalEventSelectionHint: '{{title}}：{{scenario}}',
        enableOutput: '启用 {{type}} 输出',
        disableOutput: '停用 {{type}} 输出',
        outputRulesDescription: '选择内部事件，查看它会触发哪些输出方式。',
        internalEvent: '内部事件',
        outputStats: {
          total: '输出方式',
          enabled: '已启用',
          needsConfig: '需配置'
        },
        outputItems: '输出方式',
        edit: '编辑',
        add: '添加',
        addAndConfigure: '添加并配置',
        editOutput: '编辑 {{type}}',
        addOutputType: '添加 {{type}}',
        addAndConfigureOutput: '添加并配置 {{type}}',
        addOutput: '添加输出方式'
      },
      outputStatus: {
        enabled: '已启用',
        disabled: '已停用',
        'needs-config': '需配置',
        'not-added': '未添加'
      },
      summary: {
        deviceActions: '{{count}} 个动作 · {{channels}}',
        deviceActionCount: '{{count}} 个动作',
        missingWebhookUrl: '缺少 Webhook URL',
        missingSoundFile: '缺少音频文件',
        systemNotification: '系统通知',
        display: '屏幕输出'
      }
    },
    aiMapping: {
      title: 'AI Hook 到内部事件',
      description: '配置 AI 工具原始事件到系统内部事件的映射',
      add: '新增映射',
      warning: '存在 {{count}} 个映射的 Hook 事件未在「Hook 设置」中启用：',
      warningHint: '请前往「Hook 设置」页面启用这些事件，否则它们不会触发硬件提示。',
      empty: '当前工具暂无 AI 映射',
      createFirst: '创建第一个映射',
      hookEvent: 'Hook 事件',
      notEnabled: '未启用',
      internalEvent: '内部事件',
      enabled: '启用',
      createTitle: '新增 {{toolName}} 映射',
      createDescription: '从已配置的 Hook 事件中选择一个事件，并绑定到内部统一事件',
      allConfigured: '当前工具没有可新增的已配置 Hook 事件，请先到「Hook 设置」启用事件，或检查是否已全部映射。',
      enabledHookSourceHint: '可选 Hook 事件来源于「Hook 设置」中已启用的事件。',
      hookEventPlaceholder: '选择 Hook 事件',
      internalEventPlaceholder: '选择内部事件',
      scenario: '场景：{{scenario}}'
    },
    internalCatalog: {
      title: '内部事件目录',
      description: '系统内置和本机自定义的统一事件定义',
      addCustom: '新增自定义事件',
      editCustom: '编辑自定义事件',
      deleteCustom: '删除自定义事件',
      builtIn: '内置',
      custom: '自定义',
      createDialogTitle: '新增自定义内部事件',
      editDialogTitle: '编辑自定义内部事件',
      dialogDescription: '自定义内部事件会在本机所有配置方案中可用。',
      idPrefix: '事件标识前缀',
      finalId: '最终标识：{{id}}',
      eventId: '事件标识',
      eventTitle: '备注名称',
      eventDescription: '描述',
      eventScenario: '使用场景',
      deleteDialogTitle: '删除自定义内部事件',
      deleteDialogDescription: '确认删除“{{id}}”？如果该事件被配置方案引用，删除会被拒绝。',
      prefixErrors: {
        empty: '请输入事件标识前缀。',
        tooShort: '事件标识前缀长度必须为 3 到 32 个字符。',
        tooLong: '事件标识前缀长度必须为 3 到 32 个字符。',
        invalidChars: '事件标识前缀只允许英文字母、数字和英文句号。',
        edgeDot: '事件标识前缀不能以英文句号开头或结尾。',
        doubleDot: '事件标识前缀不能包含连续英文句号。',
        duplicateSuffix: '只需要填写前缀，系统会自动追加 .userDefined。'
      }
    },
    internalEvents: {
      agentStarted: {
        title: 'AI 开始工作',
        description: '用户提交 prompt 后，AI 开始思考和处理任务。',
        scenario: '会话启动、用户提交提示'
      },
      agentWorking: {
        title: 'AI 工作中',
        description: 'AI 正在处理任务的通用状态。',
        scenario: '子任务运行、提示扩展、工具完成后继续工作'
      },
      agentWaitingInput: {
        title: '等待输入',
        description: 'AI 等待用户输入或授权。',
        scenario: '权限请求或人工确认'
      },
      toolExecuting: {
        title: '工具执行中',
        description: 'AI 正在调用工具（读写文件、运行命令等）。',
        scenario: 'PreToolUse 事件'
      },
      agentCompleted: {
        title: '任务完成',
        description: 'AI 任务正常结束。',
        scenario: 'Stop 事件、会话结束'
      },
      agentFailed: {
        title: '任务失败',
        description: 'AI 任务失败或异常结束。',
        scenario: '失败事件或解析异常'
      },
      notification: {
        title: '系统通知',
        description: 'AI 工具发出的系统通知或提示。',
        scenario: 'Claude Code Notification 事件'
      },
      contextCompacting: {
        title: '上下文压缩',
        description: 'AI 正在压缩上下文以节省内存。',
        scenario: 'PreCompact 事件'
      }
    },
    outputTypes: {
      deviceChannel: '设备通道',
      deviceChannelDescription: '向指定设备通道下发动作',
      buzzer: '蜂鸣器',
      buzzerDescription: '声音提示',
      display: '屏幕输出',
      displayDescription: '在支持屏幕的设备上显示状态、标题和内容',
      systemNotification: '系统通知',
      systemNotificationDescription: '操作系统通知中心推送',
      webhook: 'Webhook',
      webhookDescription: 'HTTP 回调推送到指定 URL',
      sound: '提示音',
      soundDescription: '播放系统提示音或自定义音频',
      desktopNotice: '桌面提示',
      desktopNoticeDescription: '在电脑桌面显示置顶的本地视觉提示',
      custom: '自定义',
      customDescription: '自定义输出配置'
    },
    outputRules: {
      title: '输出规则设置',
      description: '每个内部事件可配置多种输出类型（设备通道、蜂鸣器、显示屏、通知推送等）',
      empty: '暂无可配置的内部事件',
      emptyHint: '请先在「AI事件映射」中配置 AI Hook 到内部事件的映射',
      generating: '规则生成中...',
      outputTypeCount: '{{count}} 种输出类型',
      addOutputType: '添加输出类型',
      limitEnableMessage: '当前内部事件最多同时启用 {{limit}} 个输出方式，请先禁用其它输出。',
      limitAddMessage: '当前内部事件已启用 {{limit}} 个输出方式，新添加的输出已默认禁用。',
      enabled: '已启用',
      disabled: '已禁用',
      pendingConfig: '待配置',
      detailSettings: '详细设置',
      enable: '启用',
      summaryDeviceChannel: '设备 {{device}} · 通道 {{channel}} · 动作 {{action}} · {{duration}}',
      summaryDeviceChannelActions: '{{count}} 组设备通道动作 · {{channels}}',
      summaryNotification: '通知 {{level}} · 标题 {{title}} · 限流 {{seconds}}s',
      summaryWebhook: '{{method}} · {{url}}',
      summarySound: '{{file}} · 音量 {{volume}}%',
      summaryDisplay: '{{device}} · {{status}} · {{title}}',
      summaryDesktopNotice: '桌面提示 {{targets}} · {{effect}} · {{seconds}} 秒 · {{restoreBehavior}}',
      summaryDesktopNoticeTargets: '桌面提示 {{count}} 个目标 · {{targetTypes}} · {{highlight}} · {{seconds}} 秒 · {{restoreBehavior}}',
      summaryDesktopMascot: '桌面提示 {{targets}} · 桌面精灵 · {{state}} · {{action}} · {{playbackWindow}} · 气泡 {{bubble}} · {{seconds}} 秒 · {{restoreBehavior}}',
      desktopNoticeLightbarCount: '灯条 {{count}}',
      desktopNoticeMascotCount: '精灵 {{count}}',
      multipleTargets: '多目标',
      permanent: '永久',
      noSummary: '暂无摘要',
      unsetUrl: '未设置 URL',
      unsetSound: '未设置音频文件',
      addDialogTitle: '添加输出类型',
      addDialogDescription: '为内部事件 {{internalEvent}} 添加新的输出类型',
      allTypesConfigured: '该内部事件已配置所有可用的输出类型',
      outputType: '输出类型',
      outputTypePlaceholder: '选择输出类型',
      alreadyConfigured: '（已配置）',
      notImplemented: '（不可用）',
      addHint: '添加后在输出规则卡片中配置详细参数。',
      notImplementedHint: '该输出类型当前不可用，请选择其它输出类型。',
      add: '添加',
      detailTitle: '{{type}} 输出设置',
      detailDescription: '配置内部事件 {{internalEvent}} 的输出参数。',
      unsupported: '当前输出类型仅支持通用配置项。',
      saveSettings: '保存设置',
      validationWebhookUrlRequired: 'Webhook URL 必填',
      validationWebhookUrlInvalid: 'Webhook URL 必须以 http:// 或 https:// 开头',
      validationHeadersJson: '请求头必须是合法 JSON',
      validationBodyJson: '请求体必须是合法 JSON',
      validationSoundRequired: '音频文件必填',
      validationDeviceRequired: '设备必填',
      validationChannelRequired: '通道必填',
      validationChannelActionRequired: '通道动作必填',
      validationChannelActionsRequired: '设备通道输出至少需要 1 组动作。',
      validationChannelActionsLimit: '每条设备通道输出规则最多支持 10 组动作。',
      validationDuplicateChannelAction: '同一设备的同一通道不能重复配置。',
      validationDutyPercentRequired: '设置占空比动作需要填写占空比。',
      validationFrequencyRequired: '蜂鸣或音调动作需要填写频率。',
      validationColorRequired: '设置颜色动作需要填写颜色。',
      validationBrightnessRequired: '设置颜色动作需要填写亮度。',
      validationIntervalRequired: '闪烁或呼吸动作需要填写间隔时间。',
      validationPatternRequired: '提示音模式动作需要选择提示音。',
      validationDisplayDeviceRequired: '请选择支持屏幕输出的设备。',
      validationDisplayStatusRequired: '请选择屏幕显示状态。',
      validationDisplayTitleRequired: '请输入屏幕标题模板。',
      validationDisplayMessageRequired: '请输入屏幕内容模板。',
      validationDesktopNoticeTargetRequired: '请选择至少一个已启用的桌面提示实例。',
      validationDesktopNoticeDurationInvalid: '显示时长必须在 100 到 60000 毫秒之间。',
      validationDesktopNoticeBreathingPeriodInvalid: '呼吸周期必须在 500 到 5000 毫秒之间。',
      validationDesktopNoticeColorInvalid: '颜色必须使用 #RRGGBB 格式。',
      validationDesktopNoticeColorStopsInvalid: '当前颜色模式的色标数量不正确。'
    },
    desktopNotice: {
      addDialogTitle: '桌面提示实例',
      addDialogReady: '将默认绑定第一个已启用实例，添加后可在详细设置中调整。',
      targets: '目标实例',
      noEnabledInstances: '请先到设置页创建并启用桌面提示实例。',
      effect: '提示效果',
      durationMs: '显示时长（毫秒）',
      animationPeriodMs: '动画周期（毫秒）',
      animationPeriodHint: '允许范围 {{min}}-{{max}} 毫秒，默认 {{defaultValue}} 毫秒。',
      breathingPeriodMs: '呼吸周期（毫秒）',
      opacityPercent: '透明度（%）',
      brightnessPercent: '亮度（%）',
      restoreBehavior: '结束行为',
      edge: '发光边',
      mascotState: '语义状态',
      mascotAction: '动作',
      mascotPlayMode: '播放方式',
      mascotPlayModeHint: '控制本次规则触发时动作如何播放；未覆盖时使用精灵资源包的动作默认设置。',
      mascotPlayModes: {
        default: '按动作默认',
        loop: '循环播放',
        onceThenHold: '播放一次后停留',
        onceThenIdle: '播放一次后回到空闲态'
      },
      mascotPlaybackWindowMs: '单次播放窗口（毫秒）',
      mascotPlaybackWindowHint: '只影响播放一次后停留或回到空闲态，允许范围 {{min}}-{{max}} 毫秒，默认 {{defaultValue}} 毫秒。',
      mascotPlaybackWindowInvalid: '单次播放窗口必须在 500 到 8000 毫秒之间。',
      mascotPlaybackWindowSummary: '播放一次 {{seconds}} 秒',
      mascotBubbleTemplate: '气泡文本',
      mascotBubbleHint: '最多 {{lines}} 行，每行最多 {{chars}} 个字符。',
      mascotBubbleInvalid: '最多 2 行，每行最多 18 个字符。',
      colorMode: '颜色模式',
      colors: '颜色',
      addColorStop: '添加渐变色标',
      preview: '效果预览',
      actualPreview: '实际效果预览',
      actualPreviewRunning: '预览中...',
      actualPreviewDisabledHint: '请选择一个已启用的桌面提示实例后再预览真实效果。',
      actualPreviewFailed: '实际效果预览失败，请检查桌面提示实例配置。',
      previewHint: '预览当前颜色和提示效果，实际显示位置和尺寸由实例库配置决定。',
      presetColors: '预设颜色',
      presetColorsSolidHint: '点击后替换当前颜色',
      presetColorsGradientHint: '点击后替换色标 {{index}}',
      solidEditHint: '点击打开颜色编辑器',
      editSolidColor: '编辑纯色 {{color}}',
      gradientPreview: '渐变预览',
      gradientPreviewHint: '点击色标点选择要编辑的颜色。',
      currentColorStop: '当前：色标 {{index}}',
      selectGradientPreviewStop: '选择渐变预览色标 {{index}}',
      selectColorStop: '选择色标 {{index}}',
      editColorStop: '编辑色标 {{index}} {{color}}',
      colorStopLabel: '色标 {{index}}',
      colorStopPositionLabel: '色标 {{index}} 位置',
      removeColorStop: '删除色标 {{index}}',
      currentEditingColorStop: '当前编辑色标 {{index}}：{{color}} · {{position}}%',
      colorEditorSolidTitle: '编辑纯色',
      colorEditorStopTitle: '编辑色标 {{index}}',
      currentColor: '当前颜色 {{color}}',
      visualColorPicker: '可视化选色',
      pickScreenColor: '从屏幕吸取颜色',
      hexColor: 'HEX 色号',
      applyColor: '应用颜色',
      closeColorEditor: '关闭',
      eyedropperUnsupported: '当前运行环境不支持屏幕吸色',
      colorEditorPresetHint: '快速替换当前编辑颜色',
      restoreBehaviors: {
        useInstanceIdle: '使用实例空闲态',
        hide: '到期隐藏',
        keepLast: '保留最后状态',
        dimPlaceholder: '恢复低亮占位'
      },
      effects: {
        solid: '常亮',
        breathing: '呼吸',
        blink: '闪烁',
        scan: '扫描',
        fade: '渐隐',
        edgeBreathing: '边缘呼吸'
      },
      edges: {
        auto: '自动',
        top: '上边',
        bottom: '下边',
        left: '左边',
        right: '右边'
      },
      colorModes: {
        solid: '纯色',
        gradient: '渐变'
      }
    },
    display: {
      device: '屏幕设备',
      devicePlaceholder: '选择支持屏幕输出的设备',
      template: '显示场景',
      templateDescription: '选择显示场景，软件会根据设备屏幕能力生成对应状态、短标题和短内容。',
      templateAdvanced: '高级文本模板',
      templateOptions: {
        notice: '通知',
        taskStarted: '开始处理',
        taskRunning: '处理中',
        taskSuccess: '任务完成',
        taskWarning: '需要注意',
        taskError: '任务失败',
        waitingInput: '等待输入'
      },
      status: '显示状态',
      titleTemplate: '标题模板',
      messageTemplate: '内容模板',
      variableHelp: '可在标题和内容中插入变量，屏幕显示前会按事件内容替换。',
      advancedCustom: '高级自定义显示内容',
      asciiOnlyHint: '当前 Wio 屏幕仅保证英文、数字、符号和变量可读。中文会被替换或省略。',
      validationAsciiOnly: '当前屏幕暂不支持中文，请使用英文、数字、符号或变量。',
      validationUnknownVariable: '当前屏幕模板包含不支持的变量，请使用变量助手插入可用变量。',
      duration: '显示时长',
      duration5s: '5 秒',
      duration15s: '15 秒',
      duration30s: '30 秒',
      durationUntilNext: '持续到下一条屏幕内容',
      titleMaxChars: '标题最大字符数',
      messageMaxChars: '内容最大字符数'
    },
    deviceChannel: {
      defaultRp2040: 'RP2040 Pico 默认设备',
      device: '设备',
      channelType: '通道类型',
      channel: '通道',
      noConfiguredChannels: '当前设备尚未启用可用通道，请先到设备页添加通道。',
      action: '动作',
      actionGroups: '动作组',
      actionGroupTitle: '动作组 {{index}}',
      addChannelAction: '添加动作组',
      channelActionCount: '{{count}} / {{max}} 组动作',
      durationMs: '持续时间（毫秒）',
      durationPlaceholder: '默认 5000',
      intervalMs: '闪烁间隔（毫秒）',
      intervalPlaceholder: '默认 500',
      dutyPercent: '占空比（%）',
      dutyPercentPlaceholder: '默认 50',
      frequencyHz: '频率（Hz）',
      frequencyPlaceholder: '默认 2000',
      color: '颜色',
      colorPlaceholder: '例如 #33ccff',
      brightnessPercent: '亮度（%）',
      brightnessPlaceholder: '默认 30',
      pattern: '提示音',
      permanentPlaceholder: '留空表示永久',
      defaultIntervalPlaceholder: '留空使用默认间隔',
      rangeHint: '允许范围：{{min}} - {{max}}',
      pinReuseWarning:
        '当前引脚已在 {{channels}} 中配置。重复配置会按触发顺序相互覆盖硬件动作，请确认这是你期望的复用方式。',
      actions: {
        activate: '激活',
        deactivate: '停用',
        blink: '闪烁',
        breathe: '呼吸',
        pulse: '脉冲',
        clear: '清除',
        'set-duty': '设置占空比',
        beep: '蜂鸣',
        tone: '播放音调',
        pattern: '提示音模式',
        'display-status': '显示状态',
        'set-color': '设置颜色'
      }
    },
    duration: {
      customDurationSeconds: '自定义持续时间（秒）',
      permanent: '永久',
      custom: '自定义',
      presets: {
        1000: '1 秒',
        2000: '2 秒',
        5000: '5 秒',
        10000: '10 秒',
        20000: '20 秒',
        30000: '30 秒',
        60000: '60 秒'
      }
    },
    notification: {
      copiedVariable: '已复制变量',
      variableHelp: '可在标题和内容中插入变量，通知发送前会按事件内容替换。',
      focusWarning: '系统通知可能受通知权限、专注模式或勿扰模式影响而不显示。',
      level: '通知级别',
      levels: {
        info: '信息',
        warning: '警告',
        error: '错误',
        success: '成功'
      },
      sound: '通知声音',
      sounds: {
        default: '系统默认'
      },
      macosSoundHint: '系统通知声音由操作系统通知中心决定；自定义音频请使用独立声音输出。',
      title: '通知标题',
      titlePlaceholder: '例如：AI 工具状态更新',
      titleMaxChars: '标题最大字符数',
      body: '通知内容',
      bodyPlaceholder: '例如：Agent 已开始执行任务',
      preview: '通知预览',
      unsetTitle: '未设置通知标题',
      unsetBody: '未设置通知内容',
      previewCount: '标题 {{titleLength}} / {{titleMax}} · 内容 {{bodyLength}} / {{bodyMax}}',
      bodyMaxChars: '内容最大字符数',
      throttleSeconds: '通知限流秒数'
    },
    webhook: {
      copiedVariable: '已复制变量',
      variableHelp: '请求体支持变量替换，发送前会按当前 Hook 事件内容生成最终 JSON 文本。',
      sensitiveDataWarning:
        'Webhook 会把配置的请求头和请求体发送到外部地址。插入 prompt、工具响应、工作目录等变量前，请确认目标服务可信。',
      method: 'HTTP 方法',
      headers: '请求头（JSON 格式，可选）',
      body: '请求体（JSON 格式，可选）',
      bodyMaxChars: '请求体最大字符数',
      currentTemplate: '当前模板 {{length}} / {{max}}'
    },
    sound: {
      loadFailed: '音频列表加载失败',
      previewUnavailable: '无法预览',
      chooseFirst: '请先选择音频文件。',
      previewStarted: '已开始预览',
      previewFailed: '音频预览失败',
      source: '音频来源',
      sources: {
        builtIn: '内置音频',
        user: '用户目录',
        custom: '自定义路径'
      },
      builtIn: '内置音频',
      chooseBuiltIn: '选择内置音频',
      emptyBuiltIn: '暂无内置音频资源。',
      user: '用户目录音频',
      chooseUser: '选择用户目录音频',
      emptyUser: '未在 ~/.cc-notice/sounds 中找到音频文件。',
      file: '音频文件',
      current: '当前音频',
      emptyFile: '尚未选择音频文件',
      preview: '预览',
      volumePercent: '音量百分比',
      maxDurationMs: '最长播放毫秒',
      throttleSeconds: '提示音限流秒数'
    },
    variables: {
      helper: '变量助手',
      openHelper: '打开变量助手',
      button: '变量',
      description: '公开变量来自上下文或安全摘要，不需要开启 debug；大字段会自动裁剪。',
      expandAll: '展开全部变量',
      insertAria: '插入 {{label}} 变量',
      copyAria: '复制 {{label}} 变量',
      sources: {
        context: '上下文',
        summary: '摘要',
        largeSummary: '摘要裁剪'
      },
      internalEvent: {
        label: '内部事件',
        description: '软件侧转换后的统一事件名。'
      },
      model: {
        label: '模型',
        description: 'Hook payload 中解析到的模型名称。'
      },
      lastAssistantMessage: {
        label: '任务总结',
        description: '任务结束时的助手总结，输出时最多保留 10240 个字符。',
        example: '已完成代码修改和验证。'
      },
      prompt: {
        label: '用户提示',
        description: 'UserPromptSubmit 事件中的 prompt 字段。',
        example: '请帮我检查这次修改。'
      },
      toolResponse: {
        label: '工具返回',
        description: 'PostToolUse 事件中的 tool_response 字段，内容通常较长。',
        example: '命令执行完成，退出码 0。'
      },
      pwd: {
        label: '工作目录',
        description: 'Hook payload 中解析到的当前工作目录 cwd。'
      },
      sessionId: {
        label: '会话ID',
        description: 'Hook payload 中解析到的会话标识。'
      },
      permissionMode: {
        label: '权限模式',
        description: 'Hook payload 中解析到的权限模式。'
      },
      source: {
        label: '来源',
        description: 'AI 工具来源标识。'
      },
      event: {
        label: 'Hook事件',
        description: 'AI 工具原始 Hook 事件名。'
      },
      timestamp: {
        label: '事件时间',
        description: 'Relay 上报事件时的时间。'
      },
      toolName: {
        label: '工具标识',
        description: 'Hook payload 中解析到的工具名称或标识。'
      }
    }
  }
};
