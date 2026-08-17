export const enMessages = {
  nav: {
    ariaLabel: 'Primary navigation',
    setup: 'Setup',
    hookSettings: 'Hook Settings',
    rules: 'AI Event Mapping',
    monitor: 'Runtime Monitor',
    diagnostics: 'Diagnostics Center',
    devices: 'Devices',
    firmware: 'Firmware',
    settings: 'Settings',
    debug: 'Debug'
  },
  appInfo: {
    ariaLabel: 'App information',
    version: 'v{{version}}',
    developer: 'Developer'
  },
  common: {
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    delete: 'Delete',
    duplicate: 'Duplicate',
    activate: 'Activate',
    enabled: 'Enabled',
    disabled: 'Disabled',
    save: 'Save',
    saving: 'Saving...',
    send: 'Send',
    reset: 'Reset',
    preview: 'Preview',
    loading: 'Loading...',
    select: 'Select',
    details: 'Details',
    previous: 'Previous',
    next: 'Next',
    notConfigured: 'Not configured',
    loadingRuntimeMonitor: 'Loading runtime monitor...'
  },
  colorEditor: {
      currentColor: 'Current color {{color}}',
      visualColorPicker: 'Visual color picker',
      pickScreenColor: 'Pick color from screen',
      nativeColorInput: 'Native color input',
    hexColor: 'HEX color',
    applyColor: 'Apply Color',
    close: 'Close',
    presetColors: 'Preset Colors',
    presetHint: 'Quickly replace the current editing color',
    saturationValue: 'Color brightness and saturation',
    hue: 'Hue',
    eyedropperUnsupported: 'Screen color picking is not supported in this environment'
  },
  desktopNotice: {
    instance: {
      title: 'Desktop Notice',
      description: 'Manage local desktop notice instances. Open previews, drag to adjust position, and save to local settings.',
      empty: 'No desktop notice instances yet. Create one to reference it from output rules.',
      create: 'New Desktop Notice',
      name: 'Name',
      variant: 'Instance Type',
      variants: {
        customLightbar: 'Custom Lightbar',
        edgeLightbar: 'Fixed Screen Edge Lightbar',
        mascot: 'Desktop Mascot'
      },
      typeSwitchWarning: 'Changing the instance type resets settings that belong to the current type.',
      confirmTypeSwitch: 'Confirm Switch',
      cancelTypeSwitch: 'Cancel',
      presetPosition: 'Preset Position',
      width: 'Width',
      height: 'Height',
      cornerRadius: 'Corner radius',
      opacity: 'Opacity',
      enabled: 'Enable Instance',
      showOnStartup: 'Show on Startup',
      alwaysOnTop: 'Always on Top',
      showPreview: 'Show Preview',
      hidePreview: 'Hide Preview',
      save: 'Save Instance',
      saveSuccessTitle: 'Saved',
      saveSuccessDescription: 'Desktop notice instance "{{name}}" was saved.',
      delete: 'Delete Instance',
      deleteSuccessTitle: 'Deleted',
      deleteSuccessDescription: 'Desktop notice instance "{{name}}" was deleted.',
      edgeSelection: 'Visible Edges',
      edgeThickness: 'Lightbar Thickness',
      edgeInset: 'Edge Inset',
      edges: {
        top: 'Top',
        bottom: 'Bottom',
        left: 'Left',
        right: 'Right'
      },
      brightness: 'Brightness',
      breathingPeriod: 'Breathing period',
      idleBehavior: 'Idle Behavior',
      idleBehaviorHidden: 'Hidden',
      idleBehaviorDimPlaceholder: 'Dim Placeholder',
      idleBehaviorKeepLast: 'Keep Last State',
      mascotIdleBehaviorResident: 'Resident',
      idleBehaviorHint: 'Idle behavior is the base state when no output rule is active.',
      resetVisualSettings: 'Reset visual settings',
      resetSuccessTitle: 'Reset to defaults',
      resetSuccessDescription: 'The current visual settings were reset. Click Save to persist them.'
    },
    mascot: {
      packs: {
        g7Buddy: 'G7 Buddy',
        warmBuddy: 'Warm Buddy'
      },
      fields: {
        assetPack: 'Asset Pack',
        resourceSection: 'Asset Pack & Scanning',
        displaySection: 'Display Settings',
        stageWidth: 'Stage Width',
        stageHeight: 'Stage Height',
        bubble: 'Bubble',
        interaction: 'Interaction Feedback',
        bubblePlacement: 'Bubble Placement',
        bubbleFontSize: 'Bubble Font Size',
        bubbleFont: 'Bubble Font',
        idleState: 'Idle State'
      },
      customGuide: {
        open: 'Custom mascot resource guide',
        button: 'Custom Guide',
        rescan: 'Rescan',
        localPack: 'Local Custom',
        scanRoot: 'Put custom packs here: {{path}}',
        scanFailed: 'Scan failed: {{error}}',
        loadedSummary: '{{count}} asset packs loaded',
        issueSummary: '{{count}} issues found',
        loadedPacksTitle: 'Loaded asset packs',
        diagnosticsTitle: 'These local packs were not loaded',
        diagnosticCode: 'Diagnostic code: {{code}}',
        diagnosticPath: 'Path: {{path}}',
        diagnosticRaw: 'Raw message: {{message}}',
        title: 'Custom GIF Mascot Pack',
        description:
          'Prepare a local GIF mascot pack with this structure. Copy it into the user directory and rescan to add it to the asset pack selector.',
        directoryTitle: 'Directory',
        directoryDescription:
          'Each mascot is a standalone folder. The app reads valid packs from the local user directory.',
        requiredTitle: 'Required semantic actions',
        requiredIdle: 'Idle: resident action when no rule is active',
        requiredTask: 'Task received: task start or startup greeting',
        requiredWorking: 'Working: AI is executing a task',
        requiredSuccess: 'Success: task finished successfully',
        requiredError: 'Error: task failed or needs attention',
        gifTitle: 'GIF requirements',
        gifTransparent: 'Use a transparent background to avoid a square backdrop',
        gifSize: 'Use a near-square canvas from 240x240 to 512x512',
        gifLimit: 'Prefer GIFs around 2MB; hard limits are 10MB per GIF and 80MB per pack',
        gifAnchor: 'Keep character size and anchor consistent across actions',
        playModeTitle: 'Short GIF playback',
        playModeDescription:
          'Short actions can feel repetitive when looped for a long duration. Custom packs can use playMode to describe what happens after the action finishes.',
        playModes: {
          loop: {
            name: 'loop',
            description: 'Loop continuously for sleeping, working, or waiting states'
          },
          onceThenHold: {
            name: 'once-then-hold',
            description: 'Play once and hold, useful for success and error feedback'
          },
          onceThenIdle: {
            name: 'once-then-idle',
            description: 'Play once and return to idle, useful for greetings or thanks'
          }
        },
        manifestTitle: 'Minimal manifest example',
        notAvailableYet:
          'Note: only local GIF files and manifest are supported. Remote URLs, scripts, HTML, SVG, and executables are not allowed.',
        downloadTemplate: 'Download Template',
        downloadStartedTitle: 'Template download started',
        downloadStartedDescription:
          'Check your browser or system downloads for cc-notice-custom-mascot-template.zip.',
        downloadFailedTitle: 'Template download failed',
        downloadFailedDescription: 'The template download could not be started. Try again later.'
      },
      diagnostics: {
        codes: {
          MANIFEST_READ_FAILED: {
            title: 'Cannot read manifest',
            impact: 'This asset pack will not appear in the selector.',
            suggestion:
              'Make sure manifest.json exists in the pack folder and can be read by the current user.'
          },
          MANIFEST_INVALID_JSON: {
            title: 'Invalid manifest JSON',
            impact: 'The app cannot parse this asset pack.',
            suggestion: 'Check manifest.json for commas, quotes, and brackets with a JSON validator.'
          },
          MANIFEST_TOO_LARGE: {
            title: 'Manifest file is too large',
            impact: 'This asset pack is skipped to avoid slow scans from abnormal files.',
            suggestion: 'Keep manifest.json within 256KB.'
          },
          INVALID_ID: {
            title: 'Invalid asset pack ID',
            impact: 'The app cannot save or match this asset pack reliably.',
            suggestion: 'Use lowercase letters, digits, hyphens, underscores, or dots.'
          },
          INVALID_RENDERER: {
            title: 'Unsupported renderer',
            impact: 'This asset pack will not be loaded.',
            suggestion: 'The renderer field must be gif.'
          },
          INVALID_ANIMATION_PATH: {
            title: 'Invalid animation path',
            impact: 'This asset pack is skipped to prevent reading outside the pack folder.',
            suggestion: 'Use relative paths inside the asset pack folder and do not include ../.'
          },
          MISSING_ANIMATION_FILE: {
            title: 'Missing GIF file',
            impact: 'The referenced action animation cannot be played.',
            suggestion: 'Check that animations paths match the actual GIF file names.'
          },
          INVALID_GIF_FILE: {
            title: 'Invalid GIF file',
            impact: 'This animation cannot be used as a desktop mascot resource.',
            suggestion: 'Replace it with a valid GIF file.'
          },
          ANIMATION_FILE_TOO_LARGE: {
            title: 'GIF file is too large',
            impact: 'This asset pack is skipped to avoid loading and playback pressure.',
            suggestion: 'Each GIF must be under 10MB. Around 2MB is recommended.'
          },
          PACK_TOO_LARGE: {
            title: 'Asset pack is too large',
            impact: 'This asset pack is skipped to avoid scan and loading pressure.',
            suggestion: 'The total GIF size in one pack must be under 80MB.'
          },
          TOO_MANY_PACKS: {
            title: 'Too many asset packs',
            impact: 'Packs after the limit will not be scanned.',
            suggestion: 'Reduce the number of folders in the mascots directory.'
          },
          TOO_MANY_ANIMATIONS: {
            title: 'Too many animations',
            impact: 'This asset pack is skipped.',
            suggestion: 'Keep animations within 128 entries.'
          },
          TOO_MANY_ACTIONS: {
            title: 'Too many actions',
            impact: 'This asset pack is skipped.',
            suggestion: 'Keep actions within 64 entries.'
          },
          MISSING_REQUIRED_ACTION: {
            title: 'Missing required action',
            impact: 'The app cannot guarantee the basic states are available.',
            suggestion:
              'Provide at least one action for idle, task-received, working, success, and error.'
          },
          UNKNOWN_ACTION_ANIMATION: {
            title: 'Action references an unknown animation',
            impact: 'This action cannot be played.',
            suggestion: 'Make sure action.animation exists in the animations map.'
          },
          INVALID_INTERACTION_ACTION: {
            title: 'Invalid interaction action reference',
            impact: 'This asset pack did not pass completeness checks.',
            suggestion: 'Make sure interactions references existing action IDs.'
          },
          UNKNOWN: {
            title: 'Unknown asset pack issue',
            impact: 'This asset pack was not loaded.',
            suggestion: 'Check the diagnostic code and raw message against the pack configuration.'
          }
        }
      },
      bubblePlacements: {
        top: 'Top',
        topLeft: 'Top Left',
        topRight: 'Top Right'
      },
      bubbleFonts: {
        softHandwriting: 'Soft Handwriting',
        roundCute: 'Rounded Cute',
        comic: 'Comic Handwriting',
        cleanSans: 'Clean Sans',
        systemDefault: 'System Default'
      },
      states: {
        'task-received': 'Task Received',
        working: 'Working',
        'waiting-input': 'Waiting for Input',
        thinking: 'Thinking',
        success: 'Done',
        warning: 'Warning',
        error: 'Error',
        idle: 'Idle'
      },
      actions: {
        taskReceivedWave: 'Task Received: Wave',
        taskReceivedWorking: 'Task Received: Start Working',
        taskReceivedCheer: 'Task Received: Cheer',
        taskReceivedFly: 'Task Received: Take Off',
        workingLoop: 'Working: Loop',
        workingCheer: 'Working: Cheer',
        workingCall: 'Working: Call',
        waitingInputLookAround: 'Waiting: Look Around',
        waitingInputSurprised: 'Waiting: Surprised',
        thinkingLoop: 'Thinking: Loop',
        successJump: 'Done: Jump',
        successOk: 'Done: OK',
        successHug: 'Done: Hug',
        successFlowers: 'Done: Flowers',
        successLaugh: 'Done: Laugh',
        successRedPacket: 'Done: Red Packet',
        warningNotice: 'Warning: Notice',
        warningSurprised: 'Warning: Surprised',
        errorShake: 'Error: Shake',
        errorCry: 'Error: Cry',
        idleHi: 'Idle: Hi',
        idleSleep: 'Idle: Sleep',
        idleLaugh: 'Idle: Laugh',
        idleThanks: 'Idle: Thanks',
        idleLove: 'Idle: Love',
        idleBye: 'Idle: Bye',
        idleBreathe: 'Idle: Breathe'
      }
    }
  },
  profileRepair: {
    title: 'Configuration Repaired',
    description:
      'Profile "{{profile}}" contained entries that could not be parsed or no longer match the current rules. CC Notice kept usable configuration and removed the invalid parts.',
    action:
      'Reconfigure the removed parts in Hook Settings, AI Event Mapping, or Devices.',
    items: {
      unrecoverableProfile:
        'Profile "{{profile}}" could not be parsed, so it was isolated as a backup and CC Notice switched to an available profile',
      identity: 'Repaired profile identity fields',
      hookEvents: 'Removed {{count}} invalid Hook event selections',
      aiMappings: 'Removed {{count}} invalid AI event mappings',
      hardwareRules: 'Removed {{count}} invalid output rules',
      device: 'Restored the device configuration to the default device'
    }
  },
  settings: {
    title: 'Settings',
    description: 'Manage log directories, app preferences, and diagnostic export.',
    localHookServer: 'Local Hook Server',
    localHookServerDescription: 'Configure the local Hook event receiver.',
    receivePort: 'Receive Port',
    savePort: 'Save Port',
    portHelp:
      'Restart CC Notice after changing the port. AI tool hooks usually do not need reconfiguration. Refreshing the token updates both the local service and relay auth file immediately.',
    refreshToken: 'Refresh Token',
    refreshingToken: 'Refreshing...',
    saveSuccessTitle: 'Saved',
    saveFailedTitle: 'Save Failed',
    portSavedDescription: 'Hook service port was updated to {{port}}.',
    tokenRotatedTitle: 'Token Refreshed',
    tokenRotatedDescription:
      'A new Hook token was written locally and synced to the running local service.',
    tokenRotateFailedTitle: 'Token Refresh Failed',
    language: 'Interface Language',
    saveLanguage: 'Save Language',
    languageSavedDescription: 'Interface language was updated.',
    languageTitle: 'Interface Language',
    languageDescription: 'Choose the interface display language.',
    languageZhCn: '中文',
    languageEnUs: 'English',
    appearanceTitle: 'Appearance',
    appearanceDescription: 'Choose the CC Notice interface color mode.',
    themeMode: 'Appearance Mode',
    themeModeSystem: 'Follow System',
    themeModeLight: 'Light',
    themeModeDark: 'Dark',
    themeModeHelp: 'When following the system, CC Notice matches the current operating system appearance.',
    saveThemeMode: 'Save Appearance',
    themeModeSavedDescription: 'Appearance settings were updated.',
    windowBehaviorTitle: 'Window Behavior',
    windowBehaviorDescription: 'Configure close-window and system tray behavior.',
    closeToTray: 'Hide to system tray when closing the window',
    closeToTrayDescription:
      'When enabled, the close button hides the main window and keeps background services running. When disabled, the close button exits CC Notice after disconnecting connected devices.',
    windowCloseBehaviorSavedDescription: 'Window close behavior was updated.',
    startupLightweightMode: 'Start in Lightweight Mode',
    startupLightweightModeDescription:
      'When enabled, the next launch shows only the system tray and hides the app icon from the macOS Dock. The tray menu can still switch to normal mode temporarily.',
    windowStartupModeSavedDescription: 'Startup mode was updated. Restart CC Notice to apply it.',
    launchAtLogin: 'Launch CC Notice at system startup',
    launchAtLoginDescription:
      'Start CC Notice after system login so tray, Hook service, and device automation are ready.',
    launchAtLoginSavedDescription: 'System startup setting was updated.',
    hideWindowOnLoginLaunch: 'Hide main window on startup launch',
    hideWindowOnLoginLaunchDescription:
      'Only affects system login startup. When tray is available, CC Notice starts in the background.',
    hideWindowOnLoginLaunchSavedDescription: 'Startup window behavior was updated.',
    arduinoCliTitle: 'Arduino CLI',
    arduinoCliDescription: 'Configure the arduino-cli executable used to flash Arduino boards.',
    arduinoCliPath: 'arduino-cli Path',
    arduinoCliPathPlaceholder: 'Enter the full arduino-cli executable path',
    arduinoCliHelp:
      'If CC Notice cannot detect arduino-cli automatically, enter the full executable path here.',
    saveArduinoCliPath: 'Save Path',
    arduinoCliPathRequired: 'Enter the full arduino-cli path before saving.',
    arduinoCliPathSavedDescription: 'Arduino CLI path was updated.',
    detectArduinoCli: 'Detect Arduino CLI',
    detectingArduinoCli: 'Detecting...',
    arduinoCliAvailable: 'Arduino CLI is available',
    arduinoCliUnavailable: 'Arduino CLI is unavailable',
    arduinoCliResolvedPath: 'Path: {{path}}',
    arduinoCliVersion: 'Version: {{version}}',
    arduinoCliNotFound:
      'arduino-cli was not detected. Make sure it is installed and available in PATH, or enter the full path.',
    reset: {
      title: 'Reset Configuration',
      description:
        'Restore defaults by configuration area. Each action asks for confirmation and does not delete logs, Hook tokens, relay tools, or external AI tool Hook files.',
      confirm: 'Confirm Reset',
      resetting: 'Resetting...',
      successTitle: 'Reset Complete',
      failedTitle: 'Reset Failed',
      scopes: {
        'app-settings': {
          button: 'Reset App Settings',
          title: 'Reset App Settings',
          description: 'Restore the port and interface language to their defaults.',
          warning: 'After changing the port, restart CC Notice before the local Hook service uses the new port.',
          success: 'App settings were restored to defaults.'
        },
        'hook-settings': {
          button: 'Reset Hook Settings',
          title: 'Reset Hook Settings',
          description:
            'Restore Hook targets and global Hook event selections to defaults.',
          warning:
            'This does not modify or delete Hook config files under Codex, Claude Code, or other AI tool directories.',
          success: 'Hook settings were restored to defaults.'
        },
        'profile-mappings': {
          button: 'Reset Mappings',
          title: 'Reset Mappings',
          description:
            'Restore AI event mappings and output rules in the current profile to defaults.',
          warning:
            'Manual mapping changes, output rules, webhooks, sounds, and device channel bindings in the current profile will be overwritten.',
          success: 'The current profile mappings were restored to defaults.'
        },
        devices: {
          button: 'Reset Devices',
          title: 'Reset Devices',
          description:
            'Restore the device list and device channels to the default RP2040 Pico configuration.',
          warning:
            'Connected devices return to disconnected runtime state, and manually added or removed channels are replaced by default channels.',
          success: 'Device configuration was restored to the default RP2040 Pico setup.'
        },
        all: {
          button: 'Reset All',
          title: 'Reset All Configuration',
          description:
            'Restore app settings, Hook settings, profiles, and device configuration to defaults.',
          warning:
            'This deletes custom profiles and restores the default profile, but does not delete logs, Hook tokens, relay tools, or external AI tool Hook files.',
          success: 'All configuration was restored to defaults.'
        }
      }
    },
    logTitle: 'Logs',
    logDescription:
      'Logs are written to $HOME/.cc-notice/logs by default for troubleshooting.'
  },
  debug: {
    title: 'Debug',
    description: 'Inspect AI tool relay input, parsing, rule mapping, and errors.',
    localHookServer: 'Local Hook Server',
    localHookServerDescription: 'Runtime status of the local Hook event receiver.',
    running: 'Running',
    failed: 'Failed to start',
    eventUrl: 'Event URL',
    healthUrl: 'Health URL',
    sendTestEvent: 'Send Test Event',
    refreshLog: 'Refresh Log',
    clearLog: 'Clear Log',
    emptyLog: 'No Debug logs',
    debugLogTitle: 'Debug Log',
    debugLogDescription: '{{total}} records, {{matched}} matched{{range}}',
    debugLogRange: ', showing {{start}}-{{end}}',
    sourceFilter: 'AI Tool',
    allSources: 'All Tools',
    eventFilter: 'Event Type',
    allEvents: 'All Events',
    resultFilter: 'Result',
    allResults: 'All Results',
    stageFilter: 'Stage',
    allStages: 'All Stages',
    keyword: 'Keyword',
    keywordPlaceholder: 'Search events, errors, payload',
    previousPage: 'Previous',
    nextPage: 'Next',
    noMatchedLog: 'No Debug logs match the current filters.',
    resetFilters: 'Reset Filters',
    internalEvent: 'Internal Event:',
    mappingStage: 'Stage:',
    viewDetails: 'View Details',
    testDialogTitle: 'Send Test Event',
    testDialogDescription: 'Use a real AI Hook event to test the current Profile mapping and outputs.',
    aiTool: 'AI Tool',
    hookEvent: 'Hook Event',
    hookEventPlaceholder: 'Select Hook Event',
    payload: 'Payload',
    detailTitle: 'Event Details',
    detailDescription: 'Full record for inspecting mapping stages, payload, and output commands.',
    detailSource: 'Source',
    detailEvent: 'Event',
    detailInternalEvent: 'Internal Event',
    detailMappingStage: 'Mapping Stage',
    detailResult: 'Result',
    detailCommand: 'Command',
    detailProcessingMode: 'Processing Mode',
    detailHttpRead: 'HTTP Read',
    detailPrepareTime: 'Prepare Time',
    detailRelayResponse: 'Relay Response',
    detailQueueDelay: 'Queue Delay',
    detailProcessingTime: 'Processing Time',
    detailDeviceProcessingTime: 'Device Output Time',
    detailWebhookProcessingTime: 'Webhook Output Time',
    detailLocalProcessingTime: 'Local Output Time',
    detailOutputs: 'Outputs',
    detailTime: 'Time',
    detailReceivedAt: 'Received At',
    detailCompletedAt: 'Completed At',
    detailError: 'Error',
    deviceResults: 'Device Dispatch Results',
    deviceResultAck: 'Device Response',
    deviceResultErrorCode: 'Error Code',
    deviceResultError: 'Error',
    deviceResultEmptyAck: 'No response content',
    summaryPayload: 'Summary Payload',
    rawPayload: 'Raw Payload',
    lifecycle: {
      summaryTitle: 'Lifecycle Summary',
      result: 'Final Result',
      sourceEvent: 'Source Event',
      internalEvent: 'Internal Event',
      internalEventMissing: 'Not Mapped',
      mappingStage: 'Mapping Stage',
      processingMode: 'Processing Mode',
      elapsed: 'Total Time',
      outputs: 'Output Plan',
      deviceResults: 'Device Results',
      failedDeviceResults: '{{count}} failed',
      notRecorded: 'Not recorded',
      nodes: {
        inbound: {
          title: 'Inbound Event',
          description: 'The app received the Hook event forwarded by the AI tool.'
        },
        validation: {
          title: 'Validation and Response',
          description: 'Request reading, basic validation, and relay response were completed.'
        },
        mapping: {
          title: 'Event Mapping',
          description: 'The AI Hook event was mapped to an internal notice event.'
        },
        rules: {
          title: 'Rule Matching',
          description: 'The internal event was matched against output rules in the active profile.'
        },
        outputs: {
          title: 'Output Execution',
          description: 'Local, Webhook, and device output plans were executed.'
        },
        completion: {
          title: 'Completion',
          description: 'Background processing finished and final timing was recorded.'
        }
      },
      status: {
        success: 'Success',
        warning: 'Warning',
        error: 'Error',
        pending: 'Pending',
        skipped: 'Skipped'
      },
      facts: {
        source: 'Source',
        event: 'Event',
        occurredAt: 'Event Time',
        receivedAt: 'Received At',
        httpRead: 'HTTP Read',
        prepare: 'Prepare Time',
        response: 'Relay Response',
        mode: 'Processing Mode',
        internalEvent: 'Internal Event',
        mappingStage: 'Mapping Stage',
        outputCount: 'Output Count',
        deviceFailureCount: 'Device Failures',
        completedAt: 'Completed At',
        processing: 'Processing Time',
        deviceProcessing: 'Device Output Time',
        webhookProcessing: 'Webhook Output Time',
        localProcessing: 'Local Output Time',
        error: 'Error'
      },
      messages: {
        noInternalEvent: 'No internal event was mapped, so output rules will not run.',
        noOutputs: 'No output rule matched or matched rules are disabled.',
        asyncPending: 'Async processing has not reported a completion time yet.'
      },
      outputGroups: {
        local: 'Local Outputs',
        webhook: 'Webhook Outputs',
        'desktop-notice': 'Desktop Notice Outputs',
        device: 'Device Outputs',
        plan: 'Output Plan',
        desktopNoticeTarget: 'Target Instance',
        desktopNoticeNoTargets: 'No desktop notice target instance was recorded',
        desktopNoticeEffect: 'Effect',
        desktopNoticeColorMode: 'Color',
        desktopNoticeDuration: 'Duration',
        desktopNoticeAnimationPeriod: 'Animation Period',
        desktopNoticeEdge: 'Glow Edge',
        desktopNoticeMascotState: 'Mascot State',
        desktopNoticeMascotAction: 'Mascot Action',
        desktopNoticeMascotPlaybackWindow: 'One-Shot Window',
        desktopNoticeMascotBubble: 'Bubble Text',
        deviceAck: 'Device Response',
        deviceErrorCode: 'Error Code',
        deviceError: 'Error',
        emptyAck: 'No response content'
      }
    }
  },
  diagnostics: {
    title: 'Diagnostics Center',
    description: 'Inspect AI Hook, mapping, output, and device runtime health in one place.',
    refresh: 'Refresh Diagnostics',
    refreshing: 'Refreshing...',
    loading: 'Loading diagnostics snapshot...',
    empty: 'No diagnostics snapshot',
    overallStatus: 'Overall Status',
    checkedAt: 'Checked at: {{time}}',
    status: {
      ok: 'OK',
      warning: 'Warning',
      error: 'Error',
      notConfigured: 'Not Configured',
      unknown: 'Unknown'
    },
    severity: {
      error: 'Error',
      warning: 'Warning',
      info: 'Info'
    },
    sections: {
      hookService: { title: 'Hook Service' },
      relay: { title: 'Relay Tool' },
      hookConfig: { title: 'Hook Configuration' },
      profile: { title: 'Active Profile' },
      devices: { title: 'Device Output' }
    },
    flow: {
      title: 'Link Topology',
      description: 'Key node status from AI Hook to output device.'
    },
    issues: {
      title: 'Issues to Handle',
      description: 'Current risks sorted by impact and severity.',
      empty: 'No issues found',
      items: {
        hookServiceNotRunning: {
          title: 'Local Hook service is not running',
          description: 'AI tools cannot send Hook events to the app.',
          suggestion: 'Check whether the app is running correctly, or restart it.'
        },
        relayNotInstalled: {
          title: 'Relay tool is not installed',
          description: 'AI tool Hook commands need the local relay tool to forward events.',
          suggestion: 'Open Hook Settings and write the Hook configuration again.'
        },
        relayOutdated: {
          title: 'Relay tool needs update',
          description: 'The installed relay tool differs from the bundled version.',
          suggestion: 'Restart the app or write Hook configuration again to sync the relay tool.'
        },
        hookConfigTargetNotSynced: {
          title: 'Hook configuration is not synced',
          description: 'An enabled Hook target does not match the events selected in Hook Settings.',
          suggestion: 'Open Hook Settings, preview the target, and update it.'
        },
        profileMappingWithoutOutput: {
          title: 'Internal event has no output rule',
          description: 'AI Hooks can map to the internal event, but the internal event has no enabled output.',
          suggestion: 'Open AI Event Mapping and add output rules for the internal event.'
        },
        deviceNoneRegistered: {
          title: 'No device registered',
          description: 'No registered device is available for hardware output.',
          suggestion: 'Open Devices, scan resources, and register a device.'
        },
        deviceReferencedOffline: {
          title: 'A referenced device is offline',
          description: 'An output rule references a device that is not connected.',
          suggestion: 'Connect the device, or auto-connect registered devices from the Devices page.'
        },
        deviceHeartbeatIssue: {
          title: 'Device heartbeat issue',
          description: 'The device is connected, but protocol heartbeat responses are abnormal.',
          suggestion: 'Check the cable and firmware version, then reconnect the device if needed.'
        },
        deviceFirmwareIssue: {
          title: 'Device firmware status issue',
          description: 'The device firmware or protocol version may not match this app.',
          suggestion: 'Open Firmware and flash the bundled firmware.'
        },
        deviceRuntimeIssue: {
          title: 'Device runtime issue',
          description: 'The device runtime state needs attention.',
          suggestion: 'Open Devices and inspect the device state.'
        },
        runtimeRecentFailure: {
          title: 'Recent runtime failure detected',
          description: 'A recent Hook event or output execution failed.',
          suggestion: 'Open Debug and inspect the detailed log.'
        }
      }
    },
    devices: {
      title: 'Devices and Firmware',
      description: 'Aggregated multi-device status and prioritized device issues.',
      issueList: 'Device Issues',
      emptyIssues: 'No device needs attention',
      issueReasons: {
        referencedOffline: 'An output rule references this device, but it is not connected.',
        heartbeatIssue: 'The device is connected, but protocol heartbeat responses are abnormal.',
        firmwareIssue: 'The device firmware or protocol version may not match this app.',
        connectionError: 'The device connection or runtime state is abnormal.',
        deviceNotConnected: 'The device is not connected, so the output cannot be sent.',
        deviceChannelNotConfigured: 'The output rule references a device channel that is not configured.',
        deviceActionUnsupported: 'The selected channel does not support the configured action.',
        deviceCommandUnsupported: 'The current firmware does not support this command.',
        deviceTransportError: 'Device transport failed. Check the cable, port usage, or reconnect the device.',
        deviceIdentityLimited: 'This board cannot provide a strongly stable device ID. Watch connection order when using multiple identical boards.',
        boardCatalogMissing: 'The board catalog entry for this device is missing. Check whether the firmware and app versions match.',
        runtimeIssue: 'The device runtime state needs attention.'
      },
      metrics: {
        registered: 'Registered Devices',
        connected: 'Connected Devices',
        offline: 'Offline Devices',
        heartbeatIssues: 'Heartbeat Issues',
        firmwareIssues: 'Firmware Issues',
        referencedUnavailable: 'Referenced but Unavailable'
      }
    },
    deviceHealth: {
      title: 'Device Health',
      description: 'Checks device connection, identity, firmware, heartbeat, input configuration, and rule references.',
      summary: {
        ok: 'Healthy',
        warning: 'Needs Attention',
        error: 'Error'
      },
      checks: {
        connection: 'Connection',
        identity: 'Device Identity',
        firmware: 'Firmware',
        heartbeat: 'Heartbeat',
        ruleReference: 'Rule Reference',
        inputConfig: 'Input Configuration'
      },
      issues: {
        none: 'No issue found',
        connectionError: 'Device connection or runtime state is abnormal',
        deviceConnecting: 'Device is connecting',
        deviceActionTimeout: 'Device action response timed out',
        deviceChannelNotConfigured: 'Device channel is not configured',
        deviceCommandUnsupported: 'The current firmware does not support this command',
        deviceConnectionChanged: 'Device connection changed during the operation',
        deviceInfoTimeout: 'Device info response timed out',
        deviceIoWorkerStopped: 'Device communication worker has stopped',
        deviceNotConnected: 'Device is not connected',
        deviceNotRegistered: 'Device is not registered',
        deviceOperationCancelled: 'Device operation was cancelled',
        deviceProtocolInvalidResponse: 'Device protocol response is invalid',
        deviceRuntimeUnavailable: 'Device runtime is unavailable',
        deviceTransportBusy: 'Device port is busy',
        deviceTransportDisconnected: 'Device transport is disconnected',
        deviceTransportError: 'Device transport failed',
        deviceTransportPermissionDenied: 'Device port permission was denied',
        deviceUidMissing: 'Device stable identity is missing',
        firmwareIssue: 'Firmware needs attention',
        firmwareUnknown: 'Firmware status is unknown',
        heartbeatIssue: 'Heartbeat is abnormal',
        heartbeatUnknown: 'Heartbeat status is unknown',
        inputPendingSync: 'Input configuration will sync after the device connects',
        referencedOffline: 'The rule references a disconnected device',
        boardCatalogMissing: 'Board catalog entry is missing',
        deviceIdentityLimited: 'Device identity is still temporary'
      },
      empty: 'No registered device.'
    },
    quickActions: {
      title: 'Quick Actions',
      description: 'Safe actions only. Configuration writes still require confirmation on the owning page.'
    },
    actions: {
      refreshDiagnostics: 'Refresh All',
      openHookSettings: 'Open Hook Settings',
      openAiEventMapping: 'Open AI Event Mapping',
      openDevices: 'Open Device Management',
      openFirmware: 'Open Firmware',
      openDebug: 'Open Debug',
      autoConnectRegisteredDevices: 'Auto-connect Registered Devices',
      sendTestEvent: 'Send Test Event'
    }
  },
  setup: {
    title: 'Setup',
    description: 'Configure the Hook service, AI tools, and hardware device step by step.',
    progressAria: 'Progress',
    stepLabel: 'Step {{index}} {{label}}',
    previous: 'Previous',
    next: 'Next',
    steps: {
      hookService: {
        label: 'Local Hook Service',
        title: 'Hook Service',
        description: 'Check local service status'
      },
      hookSettings: {
        label: 'Hook Settings',
        title: 'Hook Configuration',
        description: 'Configure AI tool hooks'
      },
      eventMapping: {
        label: 'Event Mapping',
        title: 'AI Event Mapping',
        description: 'Configure event mapping rules'
      },
      deviceFirmware: {
        label: 'Device and Firmware',
        title: 'Device Configuration',
        description: 'Connect hardware device'
      },
      diagnosticsCheck: {
        label: 'Diagnostics Check',
        title: 'Diagnostics Check',
        description: 'Review link summary'
      }
    },
    hookService: {
      runningMessage: 'Local Hook service is running.',
      stoppedMessage: 'Local Hook service is not running. Check the app status.',
      title: 'Local Hook Service',
      running: 'Running',
      stopped: 'Stopped',
      description: 'Receives Hook events sent by AI tools.',
      eventUrl: 'Event URL:',
      healthUrl: 'Health URL:',
      openDebug: 'Open Debug Page'
    },
    hookSetup: {
      selectToolTitle: 'Select AI Tool',
      selectToolDescription: 'Choose the AI coding tool you use.',
      currentTool: 'Current tool:',
      configureEventsTitle: 'Configure Hook Events',
      configureEventsDescription: 'Select events to listen for and write the config file.',
      openHookSettings: 'Open Hook Settings',
      openHookSettingsHint: 'Select events, add config targets, and write config on the Hook Settings page.'
    },
    eventMapping: {
      configured: '{{count}} event mapping rules configured.',
      missing: 'Event mappings are not configured. AI events will not trigger outputs.',
      title: 'Configure AI Event Mapping',
      description: 'Map AI tool Hook events to unified internal events, then bind outputs.',
      flowTitle: 'Mapping flow:',
      flowStep1: 'AI tool triggers a Hook event, such as PreToolUse.',
      flowStep2: 'The event maps to an internal event, such as agent.started.',
      flowStep3: 'The internal event triggers outputs, such as device channels or system notifications.',
      currentRules: 'Current mapping rules:',
      moreRules: '{{count}} more mapping rules...',
      viewRules: 'View and Edit Mapping Rules',
      startRules: 'Configure Event Mapping',
      hint: 'This opens the AI Event Mapping page for configuration.'
    },
    deviceFirmware: {
      deviceTitle: 'Device Connection and Firmware',
      deviceDescription:
        'Choose and flash the matching board firmware on the Firmware page, then identify, register, and connect the device on the Device Management page.',
      openDevices: 'Open Device Management',
      openFirmware: 'Open Firmware Management'
    },
    diagnostics: {
      title: 'Link Summary',
      description:
        'Lightly check Hook, mapping, output rules, and device status. Use Diagnostics Center for full troubleshooting.',
      loading: 'Loading setup diagnostics...',
      empty: 'No diagnostics data. Refresh diagnostics.',
      openDiagnosticsCenter: 'Open Diagnostics Center'
    }
  },
  hookSettings: {
    title: 'Hook Settings',
    description: 'Manage AI tool Hook events, global configuration, and project targets.',
    errors: {
      invalidProjectDirectory: 'Select a valid project directory.'
    },
    events: {
      title: 'Hook Events',
      description: 'Select {{toolName}} Hook events to listen for.',
      applyRecommended: 'Apply Recommended',
      selectedCount: '{{selected}} / {{total}} selected',
      searchPlaceholder: 'Search event name or description...',
      loading: 'Loading Hook events...',
      empty: 'No matching events',
      recommended: 'Recommended',
      requireOne: 'Select at least one Hook event.'
    },
    targets: {
      title: 'Configuration Targets',
      description: 'Manage global and project-level Hook configuration files.',
      addProject: 'Add Project Directory',
      empty: 'No configuration targets for the current tool.',
      global: 'Global Config',
      project: 'Project Config',
      enabled: 'Enabled',
      disabled: 'Disabled',
      enableHint: 'Enabling a global config disables project configs for the same tool. Enabling a project config disables the global config for that tool. The same project directory cannot be added twice.',
      outdated: 'Outdated',
      exists: '✓ Config file exists',
      missing: '○ Config file does not exist and can be created automatically',
      previewing: 'Previewing...',
      writing: 'Enabling...',
      write: 'Write',
      enable: 'Enable',
      eventMismatch: 'Current config does not match the selected Hook events. Preview and update the config file.',
      debugMismatch: 'Debug mode setting changed. Preview and update the config file.',
      debugEnabled: 'Debug mode writes --debug, so relay submits the original payload as well{{suffix}}',
      debugDisabled: 'Debug is off: relay only submits default summary fields. Payload fields outside the summary cannot be used by output variables{{suffix}}',
      notUpdatedSuffix: '; current config has not been updated',
      writeDone: '✓ Written',
      enableDone: '✓ Enabled',
      backup: 'Backup: {{path}}',
      restoring: 'Restoring...',
      removeTarget: 'Remove Target'
    },
    previewDialog: {
      title: '{{mode}}: {{targetLabel}}',
      writeMode: 'Config Preview',
      restoreMode: 'Restore Preview',
      writeDescription: '{{existsMessage}}, {{count}} events total',
      restoreDescription: 'Confirming removes Hook entries managed by this app and keeps your own configuration.',
      globalEnableWarning: 'Enabling a global config modifies the global Hook file and automatically disables project configs for the same tool to avoid duplicate reports.',
      exists: 'Config file exists',
      missing: 'Config file does not exist and will be created automatically',
      diff: 'Diff',
      oldConfig: 'Original Config',
      newConfig: 'New Config',
      configToWrite: 'Config to Write',
      restoredConfig: 'Restored Config',
      deletedLegend: 'Red means removed content',
      addedLegend: 'Green means added content',
      contextLegend: 'Only context around changed lines is shown',
      writing: 'Writing...',
      restoring: 'Restoring...',
      write: 'Write Config',
      confirmRestore: 'Confirm Restore'
    }
  },
  monitor: {
    title: 'Runtime Monitor',
    description: 'Monitor real Hook events, output trends, and current runtime health.',
    refresh: 'Refresh',
    refreshing: 'Refreshing...',
    status: {
      hookService: 'Hook Service',
      running: 'Running',
      abnormal: 'Abnormal',
      receivedEvents: 'Received Events',
      outputAttempts: 'Output Attempts',
      failures: 'Failures',
      uptime: 'Uptime',
      lastEvent: 'Last Event',
      lastOutput: 'Last Output'
    },
    charts: {
      eventTitle: 'Received Event Trend',
      eventDescription: 'Grouped by AI tool, counting real Hook events.',
      outputTitle: 'Output Trigger Trend',
      outputDescription: 'Grouped by output type, counting outputs triggered by real Hooks.',
      empty: 'No statistics yet',
      successFailure: 'Success {{success}} / Failure {{failure}}'
    },
    outputTypes: {
      systemNotification: 'System Notification',
      webhook: 'Webhook',
      sound: 'Sound',
      deviceChannel: 'Device Channel',
      display: 'Device Display',
      buzzer: 'Buzzer',
      desktopNotice: 'Desktop Notice'
    },
    outputs: {
      title: 'Output Type Overview',
      description: 'Shows attempts, failures, and success rate by output type in this runtime.',
      empty: 'No output statistics yet',
      attempts: 'Attempts {{count}}',
      failures: 'Failures {{count}}',
      successRate: 'Success {{rate}}%'
    },
    recent: {
      title: 'Recent Events',
      description: 'Shows the latest 20 event summaries. Open details to inspect payload.',
      empty: 'No events',
      internalEvent: 'Internal event {{event}}',
      details: 'Details'
    },
    health: {
      snapshotFailed: 'Failed to read runtime monitor snapshot: {{error}}',
      hookStopped: 'Local Hook service is not running.',
      runtimeErrors: '{{count}} error records exist in the current runtime cycle.',
      notificationFocus: 'System notifications may be blocked by Focus or Do Not Disturb. Check notification permissions in system settings.'
    }
  },
  devices: {
    title: 'Device Management',
    description: 'Manage hardware devices, transport connections, device channels, and test actions.',
    unknownDevice: 'Unknown Device',
    unknownBoard: 'Unknown Board',
    status: {
      disconnected: 'Disconnected',
      connecting: 'Connecting',
      connected: 'Connected',
      error: 'Error'
    },
    list: {
      title: 'Device Instances',
      description: 'View devices registered in the current runtime.',
      loading: 'Loading device runtime states...',
      empty: 'No device instances. Scan and register a device.',
      removeDevice: 'Remove device {{device}}',
      removeDialogTitle: 'Remove Device?',
      removeDialogDescription:
        'Remove "{{device}}" from registered devices. If an output rule still references it, CC Notice will block removal and ask you to adjust the rule first.',
      confirmRemove: 'Confirm Remove',
      removeBlockedTitle: 'Device is used by an output rule and cannot be removed.',
      removeBlockedDescription:
        'Remove or rebind the related device channel action in AI Event Mapping before removing this device.',
      referencedRule: 'Referenced rule: {{rule}}',
      openRules: 'Open AI Event Mapping'
    },
    discovery: {
      title: 'Device Discovery',
      description: 'Scan candidate resources manually. A handshake is sent only when you identify a device.',
      scan: 'Scan Device Resources',
      scanning: 'Scanning...',
      identify: 'Identify Device',
      identifying: 'Identifying...',
      register: 'Register Device',
      registering: 'Registering...',
      matchedDevice: 'Matched device: {{device}}',
      portHint:
        'On Windows, prefer ports that show a USB vendor, product, VID/PID, or serial number. If identification times out, make sure Arduino IDE, serial monitor, or another app is not using the device.',
      identityFallback:
        'This device identity is not stored in firmware yet. If the serial port changes, identify it again. Flash the latest firmware and identify again for a stable ID.',
      autoConnectErrorTitle: 'Auto Connect Failed',
      empty: 'No candidate device resources yet. Scan device resources first.',
      statuses: {
        unidentified: 'Unidentified',
        identifying: 'Identifying',
        identified: 'Identified',
        matched: 'Matched',
        failed: 'Failed'
      }
    },
    connection: {
      title: 'Connection Management',
      description: 'Connect or disconnect the selected registered device.',
      scan: 'Scan Transports',
      scanning: 'Scanning...',
      autoConnect: 'Auto Connect Registered Devices',
      autoConnecting: 'Auto Connecting...',
      connect: 'Connect Current Device',
      connecting: 'Connecting...',
      errorTitle: 'Connection Operation Failed',
      disconnect: 'Disconnect Device',
      disconnectAll: 'Disconnect All',
      openTransportMonitor: 'Open Transport Monitor',
      selectPort: 'Select Transport',
      portPlaceholder: 'Scan transports first',
      selectedTransport: 'Current Transport',
      availablePorts: 'Available Transports',
      matchedPort: 'Matched',
      emptyPorts: 'No scan results yet. Scan transport resources.'
    },
    transportMonitor: {
      title: 'Device Transport Monitor',
      subtitle: 'Current device: {{device}}',
      stoppedBanner:
        'The device disconnected or monitoring stopped. The window keeps the last communication records.',
      jumpTop: 'Top',
      jumpLatest: 'Latest',
      followScroll: 'Follow Scroll',
      stopFollow: 'Stop Follow',
      clear: 'Clear',
      allDirections: 'All directions',
      errorsOnly: 'Errors only',
      empty: 'No communication events yet. Continue operating this device in the main window.',
      noSelection: 'Select an event to inspect details.',
      payload: 'Payload',
      metadata: 'Metadata',
      detail: {
        id: 'ID',
        time: 'Time',
        device: 'Device',
        board: 'Board',
        transport: 'Transport',
        command: 'Command',
        channel: 'Channel',
        control: 'Control',
        error: 'Error Code'
      },
      direction: {
        outbound: 'Down',
        inbound: 'Up',
        system: 'System'
      },
      category: {
        command: 'Command',
        ack: 'ACK',
        'input-event': 'Input Event',
        heartbeat: 'Heartbeat',
        connection: 'Connection',
        error: 'Error'
      },
      status: {
        pending: 'Pending',
        sent: 'Sent',
        ok: 'OK',
        timeout: 'Timeout',
        error: 'Error',
        skipped: 'Skipped',
        stopped: 'Stopped'
      }
    },
    operation: {
      connectingTitle: 'Connecting device',
      autoConnectingTitle: 'Auto connecting device',
      connectingDescription:
        'The app is opening the device transport and verifying device identity. Unstable USB connections may take a few seconds.',
      deviceLabel: 'Device',
      portLabel: 'Transport',
      cancelConnection: 'Cancel connection',
      cancelling: 'Cancelling...',
      blockedHint: 'This connection attempt was cancelled. Auto connect will pause briefly for this device.'
    },
    identity: {
      title: 'Device Identity',
      description: 'Manage the persistent device ID written to the current board firmware.',
      currentUid: 'Current Device ID',
      reset: 'Reset Device ID',
      resetting: 'Resetting...',
      errorTitle: 'Device Identity Operation Failed',
      confirmTitle: 'Reset Device ID?',
      confirmDescription: 'The app will generate a new random device ID and write it to the connected device EEPROM.',
      confirmWarning: 'After reset, this board will identify with a new device ID. Make sure the connected device is the one you want to reset.',
      confirmReset: 'Reset ID'
    },
    channels: {
      title: 'Device Channels',
      description:
        'Shows channels available for the current device. Channel type, pin, and level semantics are maintained by the board capability catalog.',
      channel: 'Channel',
      mode: 'Mode',
      kind: 'Kind',
      pin: 'Pin',
      activeLevel: 'Active Level',
      defaultLevel: 'Default Level',
      actions: 'Actions',
      newChannel: 'New Channel',
      addChannel: 'Add Channel',
      refreshCapabilities: 'Refresh Capabilities',
      addChannelPlaceholder: 'Select an available channel',
      removeChannel: 'Remove {{channel}}',
      switchToInput: 'Use as Input',
      switchToOutput: 'Use as Output',
      confirmModeSwitch: 'Confirm',
      configureInput: 'Configure {{channel}} input action',
      configureInputShort: 'Configure',
      modeSwitchBlockedTitle: 'Channel is used by an output rule and cannot switch to input.',
      modeSwitchBlockedDescription: 'Remove or update the output rule that uses this channel, then switch the channel mode.',
      referencedChannel: 'Channel: {{channel}}',
      referencedRule: 'Referenced rule: {{rule}}',
      modeFixedInput: 'Fixed Input',
      modeValue: {
        output: 'Output',
        input: 'Input'
      },
      emptyAvailable: 'No available channel remains for the current board.',
      guide: 'Guide'
    },
    channelKind: {
      'digital-output': 'Digital Output',
      'pwm-output': 'PWM Output',
      'addressable-led': 'Addressable LED',
      display: 'Display',
      buzzer: 'Buzzer',
      relay: 'Relay',
      'button-input': 'Button Input'
    },
    inputBinding: {
      title: 'Input Action',
      description: 'Configure the keyboard action triggered by a device input.',
      descriptionForChannel: 'Configure the keyboard action triggered when {{channel}} is pressed.',
      enabled: 'Enabled',
      enabledDescription: 'Keep this off to save the binding without triggering shortcuts.',
      modifiers: 'Modifiers',
      primaryKey: 'Primary Key',
      keyboardHint: 'Click a key on the keyboard, or capture a real key press for quick input.',
      captureShortcut: 'Capture Key',
      stopCapture: 'Stop Capture',
      captureHint: 'Press the key or combo to trigger. Default shortcuts are blocked while capturing.',
      unsupportedKey: 'This key is not supported yet. Use letters, numbers, function keys, arrow keys, or common control keys.',
      unconfigured: 'Not configured',
      disabled: 'Disabled',
      disabledShortcut: '{{shortcut}} (disabled)',
      focusScopeHint: 'The shortcut is sent to the currently focused app. Background apps may not receive it.',
      key: {
        space: 'Space'
      },
      validation: {
        primaryRequired: 'Choose one primary key.',
        comboNeedsOnePrimary: 'A combo can contain only one non-modifier primary key.',
        comboNeedsModifier: 'A combo must include at least one modifier key.'
      }
    },
    inputTest: {
      title: 'Button Input Test',
      description: 'Review shortcuts bound to device input channels and compare highlighted keys when pressing the real device button.',
      recentEvent: 'Recently received',
      disabledHint: 'This button action is disabled. The device may still report input events, but it will not trigger the shortcut: {{shortcut}}.',
      unconfiguredHint: 'This input channel has no shortcut yet. Configure its input action from the device channel table first.'
    },
    channelAction: {
      activate: 'Activate',
      deactivate: 'Deactivate',
      blink: 'Blink',
      breathe: 'Breathe',
      pulse: 'Pulse',
      clear: 'Clear',
      'set-duty': 'Set Duty',
      beep: 'Beep',
      tone: 'Tone',
      pattern: 'Pattern',
      'set-color': 'Set Color'
    },
    testAction: {
      title: 'Test Action',
      description: 'Send one test action to a channel on the selected device.',
      channel: 'Channel',
      action: 'Action',
      duration: 'Duration',
      interval: 'Interval',
      dutyPercent: 'Duty',
      frequency: 'Frequency',
      color: 'Color',
      brightness: 'Brightness',
      forever: 'Forever',
      ms: '{{ms}} ms',
      percent: '{{value}}%',
      hz: '{{value}} Hz',
      send: 'Send Test Action',
      sending: 'Sending...',
      ready: 'Ready to send a test action.',
      skipped: 'Device is not connected. Test action skipped.',
      sent: 'Test action sent.',
      failed: 'Failed to send test action.'
    },
    deviceExtension: {
      title: 'Device Extensions',
      description: 'Send device-level test commands for extension capabilities declared by the current device.',
      display: 'Display Test',
      buzzerPatterns: 'Buzzer Patterns',
      testRuntime: 'Test Runtime',
      clearDisplay: 'Clear Display',
      mute: 'Mute',
      unmute: 'Unmute',
      customDisplay: {
        title: 'Test Title',
        message: 'Test Message',
        send: 'Test Event Overlay',
        defaultTitle: 'CC Notice Test',
        defaultMessage: 'Test message',
        asciiNote: 'This entry only verifies the screen event overlay and serial command path. Use English, numbers, and common symbols.',
        asciiValidation: 'This screen does not support non-ASCII text yet. Use English, numbers, or common symbols.'
      },
      status: {
        notice: 'Notice',
        success: 'Success',
        working: 'Working',
        warning: 'Warning',
        error: 'Error'
      },
      pattern: {
        notice: 'Notice',
        success: 'Success',
        warning: 'Warning',
        error: 'Error',
        working: 'Working'
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
      title: 'Runtime Status',
      description: 'Inspect the latest send, ACK, and error for the selected device.',
      errorTitle: 'Device Operation Failed',
      deviceFirmwareVersion: 'Device Firmware',
      bundledFirmwareVersion: 'Bundled Firmware',
      firmwareStatus: 'Firmware Status',
      checkFirmware: 'Check Firmware Version',
      openDiagnostics: 'View Diagnostics',
      firmwareCheckErrorTitle: 'Firmware Check Notice',
      firmwareStatuses: {
        unknown: 'Unknown',
        'up-to-date': 'Up to Date',
        'update-available': 'Update Available',
        incompatible: 'Protocol Incompatible',
        unsupported: 'Firmware Version Not Recognized'
      },
      lastAck: 'Last ACK',
      lastError: 'Last Error',
      lastSentAt: 'Last Sent At'
    },
    heartbeat: {
      title: 'Heartbeat Status',
      description: 'Inspect the latest heartbeat and loss detection status for the current device.',
      status: 'Status',
      lastHeartbeatAt: 'Last Heartbeat At',
      failureCount: 'Failure Count',
      statuses: {
        unknown: 'Unknown',
        healthy: 'Healthy',
        stale: 'Stale',
        lost: 'Lost',
        unsupported: 'Current firmware does not support heartbeat'
      }
    }
  },
  hardwareGuides: {
    open: 'Guide',
    openForChannel: 'View {{channel}} wiring guide',
    fallback: {
      title: 'Hardware Wiring Guide',
      summary: 'The current channel does not have a dedicated wiring guide.',
      detail:
        'Check the board pinout, voltage and current limits, and peripheral module documentation before sending a test action.'
    },
    sections: {
      suitableHardware: 'Suitable Hardware',
      recommendedScenarios: 'Recommended Scenarios',
      wiring: 'Wiring',
      electricalSpecs: 'Electrical Specs and Resistor Guidance',
      electricalNotices: 'Electrical Notes',
      actions: 'Supported Actions',
      testSteps: 'Test Steps',
      faq: 'FAQ'
    },
    pinout: {
      title: 'RP2040 Pico Pinout',
      arduinoUnoTitle: 'Arduino Uno Pinout',
      arduinoNanoTitle: 'Arduino Nano Pinout',
      stm32BluePillTitle: 'STM32F103C8T6/C6T6 Blue Pill Pinout',
      arduinoSchematicSubtitle: 'Interactive pin schematic',
      boardImageAlt: '{{board}} board body',
      references: {
        pinout: 'Official Pinout',
        datasheet: 'Datasheet',
        chipDatasheet: 'Chip Datasheet',
        stm32duinoDocs: 'STM32duino Docs',
        picoDatasheet: 'Pico Datasheet',
        rp2040Datasheet: 'RP2040 Datasheet'
      },
      legend: {
        gpio: 'GPIO',
        pwm: 'PWM',
        serial: 'Serial',
        ground: 'Ground',
        power: 'Power',
        system: 'System Control',
        analog: 'Analog Reference',
        reference: 'Reference/Reserved'
      }
    },
    electrical: {
      gpioVoltage: 'GPIO output logic level: 3.3V.',
      arduinoGpioVoltage: 'GPIO output logic level: 5V.',
      gpioCurrentConservative:
        'Use each GPIO as a low-current signal output and avoid directly driving high-current loads.',
      ledResistor:
        'For a bare LED, use a 330Ω - 1kΩ series resistor; prefer 470Ω or 1kΩ by default.',
      sharedGround: 'Peripherals, external supplies, and the board must share ground.',
      driverRequired:
        'Relay modules, buzzers, high-power LEDs, and LED strips should use a driver module or external power.',
      ws2812DataResistor:
        'For WS2812/SK6812 data, add a 330Ω - 470Ω series resistor near the DIN input.',
      ws2812Power:
        'Power WS2812/SK6812 LEDs from an external supply sized for the LED count; never power them from GPIO.',
      ws2812Level:
        'For 5V addressable strips, use 3.3V-to-5V level shifting for long wires or unstable setups.'
    },
    arduinoTinyAvr: {
      notices: {
        outputRange:
          'Current output channels support D2-D10. D0/D1 are serial RX/TX pins and are not used as outputs.',
        pwmPins:
          'D3/D5/D6/D9/D10 support breathe and PWM-style actions. Other digital output pins only support normal on/off, blink, or pulse actions.',
        reservedPins:
          'D11-D13, A0-A5, and Nano A6/A7 are currently shown only as board pin information and do not create output channels.'
      }
    },
    stm32BluePill: {
      notices: {
        smallMcuScope:
          'Scoped to the STM32F103C6T6 minimum resource profile, exposing stable digital output with onboard USB CDC for app communication.',
        swdPins: 'PA13/PA14 are SWD debug and flashing pins, so they are not used as output channels.'
      }
    },
    digitalOutput: {
      title: 'Digital Output Wiring Guide',
      summary: 'Suitable for simple LEDs, relay inputs, and low-voltage digital trigger modules.',
      hardware: {
        led: 'Single-color LEDs or LED indicator modules with current limiting.',
        relay: 'Low-voltage relay modules, optocoupler input modules, or other digital trigger inputs.'
      },
      scenarios: {
        status: 'Represent running, completed, failed, and other binary or blinking states.',
        trigger: 'Trigger an external low-voltage module switch input.'
      },
      wiring: {
        pin: 'Connect the GPIO output to the module signal input. Bare LEDs need a suitable series resistor.',
        ground: 'The peripheral GND must share ground with the board GND.'
      },
      notices: {
        resistor: 'Bare LEDs must use a current-limiting resistor to avoid GPIO over-current.',
        current: 'Do not drive high-current loads directly. Relay coils and LED strips need driver modules.'
      },
      tests: {
        connect: 'Power off before wiring, then connect the board and open the device page.',
        activate: 'Send activate or blink and confirm the level semantics match the peripheral response.'
      },
      faq: {
        inverted: 'If output is inverted, check the channel active level or whether the peripheral is low-level triggered.'
      }
    },
    pwmOutput: {
      title: 'PWM Output Wiring Guide',
      summary: 'Suitable for outputs needing brightness, duty cycle, or simple fade control.',
      hardware: {
        led: 'Dimmable LED modules or current-limited LEDs.',
        driver: 'MOSFET/transistor driver modules for higher-current loads.'
      },
      scenarios: {
        brightness: 'Show different state intensity by brightness.',
        fade: 'Use pulse or fade-like effects for softer notifications.'
      },
      wiring: {
        pin: 'Connect the PWM GPIO to the module signal input. Power the load according to module documentation.',
        ground: 'The driver module and board must share ground.'
      },
      notices: {
        driver: 'High-current LEDs or strips must use an external driver, not direct GPIO drive.',
        frequency: 'If visible flicker appears, tune PWM frequency or use a different driver.'
      },
      tests: {
        duty: 'Start with a low duty cycle and increase gradually to confirm brightness changes.',
        clear: 'Send clear and confirm output returns to the default duty cycle.'
      },
      faq: {
        flicker: 'Visible flicker is usually related to frequency, power, or the driver module.'
      }
    },
    buzzer: {
      title: 'Buzzer Wiring Guide',
      summary: 'Suitable for failures, permission prompts, and long-task completion audio alerts.',
      hardware: {
        active: 'Active buzzer modules, usually controlled by a digital level.',
        passive: 'Passive buzzer modules that can use tone actions for frequency output.'
      },
      scenarios: {
        failure: 'Signal errors, failures, or situations requiring manual attention.',
        permission: 'Short prompts for permission requests or task completion.'
      },
      wiring: {
        pin: 'Connect the GPIO output to the buzzer module signal input.',
        ground: 'Connect buzzer module GND to board GND.'
      },
      notices: {
        current: 'Use a driver module when buzzer current is high; do not power it directly from GPIO.',
        volume: 'Use short test durations first to avoid continuous beeping.'
      },
      tests: {
        beep: 'Send beep and confirm the module emits a short sound.',
        tone: 'For passive buzzers, send tone and confirm frequency changes.'
      },
      faq: {
        silent:
          'If silent, check buzzer type, active/passive action matching, power, and shared ground.'
      }
    },
    addressableLed: {
      title: 'Addressable LED Wiring Guide',
      summary: 'Suitable for WS2812, SK6812, and similar single-wire addressable LED strips or rings.',
      hardware: {
        strip: 'WS2812/SK6812 LED strips, pixel boards, or matrix panels.',
        ring: 'NeoPixel-compatible LED rings or compact status arrays.'
      },
      scenarios: {
        richStatus: 'Show richer color, brightness, and multi-state notifications.',
        multiDevice: 'For multi-device or display-like hardware status output.'
      },
      wiring: {
        data: 'Connect GPIO data to DIN. A small series resistor near the LED input is recommended.',
        power: 'Use a suitable external power supply for the LED count; never power strips from GPIO.',
        ground: 'External power GND, LED GND, and board GND must be common.'
      },
      notices: {
        power: 'Full brightness can draw high current; start with low brightness and few LEDs.',
        level: 'Some 5V strips may need level shifting because 3.3V data is not always stable.'
      },
      tests: {
        color: 'Start with a low-brightness single-color test to confirm color and pixel order.',
        brightness: 'Increase brightness gradually and watch for power instability.'
      },
      faq: {
        colorOrder: 'Wrong colors usually mean RGB/GRB order differs; adjust it in channel settings.'
      }
    }
  },
  firmware: {
    title: 'Firmware Management',
    description: 'View and update hardware device firmware.',
    catalogTitle: 'Firmware Catalog',
    catalogDescription: 'Review firmware artifacts bundled with this app.',
    catalogLoading: 'Loading firmware catalog...',
    catalogEmpty: 'No firmware artifacts available.',
    artifactCount: '{{count}}',
    recommendedBadge: 'Recommended',
    notRecommendedBadge: 'Optional',
    boardFamily: 'Board Family',
    capabilityTier: 'Capability Tier',
    capabilityDescription: 'Capability Notes',
    recommendationStatus: 'Recommendation',
    recommendationReasonTitle: 'Why Recommended',
    boardFamilies: {
      rp2040: 'RP2040',
      arduinoAvr: 'Arduino AVR',
      stm32: 'STM32',
      seeedSamd: 'Seeed SAMD',
      unknown: 'Other Boards'
    },
    capabilityTiers: {
      full: {
        label: 'Full capability',
        description:
          'Suitable for Pico-class boards with broader output support for common notification scenarios.'
      },
      lightweight: {
        label: 'Lightweight capability',
        description:
          'Suitable for 32U4 Arduino boards with common output support. Arduino CLI is required before flashing.'
      },
      minimal: {
        label: 'Minimal capability',
        description:
          'Suitable for entry-level AVR boards such as Uno / Nano, with a smaller set of stable output channels.'
      },
      extended: {
        label: 'Extended device capability',
        description:
          'Suitable for integrated devices with a screen, buttons, onboard buzzer, and sensors, with output channels modeled separately from device-level features.'
      },
      oled096: {
        description:
          'For Raspberry Pi Pico with a 0.96-inch 128x64 I2C OLED, keeping common output channels while adding device-level display status output.'
      },
      oled091: {
        description:
          'For Raspberry Pi Pico with a 0.91-inch 128x32 I2C OLED, using GP20/GP21 for the display while keeping GP22 as a normal output channel.'
      },
      stm32SmallMcu: {
        description:
          'Scoped to the STM32F103C6T6 minimum resource profile, with stable digital output, onboard USB CDC serial, and memory-heavy features disabled.'
      },
      unknown: {
        label: 'Unknown capability',
        description: 'This board does not have an explicit capability tier note yet.'
      }
    },
    recommendationReason: {
      pico: 'Pico uses UF2 volume copy flashing, making flashing and recovery simpler. It is recommended as the first option.'
    },
    wiring: {
      pin: 'Pin',
      function: 'Expected Function',
      connection: 'Wiring',
      reservedPins: 'Used / Reserved Notes',
      noticeTitle: 'Wiring Notes',
      functions: {
        digitalOutput: 'Digital output',
        pwmOutput: 'PWM / breathing output',
        ws2812: 'WS2812 data output',
        buzzer: 'Buzzer output',
        onboardBuzzer: 'Onboard buzzer',
        builtInDisplay: 'Built-in display',
        oledSda: 'OLED I2C SDA',
        oledScl: 'OLED I2C SCL',
        oledReset: 'OLED reset',
        oledPower: 'OLED power'
      },
      wires: {
        digitalOutput: 'Connect the output pin to an LED, relay module, or driver input. Share GND with the board.',
        pwmOutput: 'Connect to a PWM-capable LED or driver input for brightness, breathing, or pulse effects.',
        ws2812: 'Connect to strip DIN. Power the strip for its LED count and share GND with the board.',
        buzzer: 'Connect to an active or passive buzzer signal pin. Use a driver module for higher current buzzers.',
        onboardBuzzer: 'No external wiring is required; firmware drives the Wio Terminal onboard buzzer.',
        builtInDisplay: 'No external wiring is required; firmware uses the Wio Terminal built-in LCD.',
        oled096Sda: 'Connect to OLED D1 / SDA.',
        oled096Scl: 'Connect to OLED D0 / SCL.',
        oled091Sda: 'Connect to OLED SDA.',
        oled091Scl: 'Connect to OLED SCL.',
        oledReset: 'Connect to OLED RES / RST. Firmware sends one reset pulse after power-up.',
        oledPower: 'Connect OLED VCC to 3V3 and GND to board GND.'
      },
      noticeItems: {
        rp2040Voltage: 'RP2040 GPIO logic level is 3.3V. Do not feed 5V signals directly into GPIO.',
        arduinoVoltage: 'Uno / Nano GPIO logic level is 5V. Confirm compatibility before connecting 3.3V peripherals.',
        proMicroVoltage: 'This Pro Micro firmware targets the 5V/16MHz variant. GPIO logic level is 5V; confirm compatibility before connecting 3.3V peripherals.',
        sharedGround: 'External modules must share GND with the board, otherwise signal levels are unreliable.',
        driverForLoad: 'Relays, motors, and high-power LED strips should use a driver module or separate power supply instead of GPIO power.',
        oledI2cAddress: 'OLED I2C address depends on the module hardware. Firmware probes 0x3C and 0x3D.',
        stm32Voltage: 'STM32F103 Blue Pill GPIO logic level is 3.3V. Do not feed 5V signals directly into GPIO.'
      },
      guides: {
        rp2040Pico: {
          title: 'Raspberry Pi Pico Wiring',
          summary: 'The standard Pico software experience exposes digital output and buzzer channels. GP0, GP1, and GP2 are enabled by default.',
          reserved: {
            usb: 'USB serial is used for app communication and does not require extra GPIO wiring.',
            system: 'RUN, 3V3_EN, ADC_VREF, and similar system/reference pins are shown only as board information.'
          }
        },
        rp2040PicoOled096: {
          title: 'Pico + OLED 0.96-inch 128x64 Wiring',
          summary: 'This firmware uses GP20/GP21 for the I2C OLED and GP22 for display reset.',
          reserved: {
            i2c: 'GP20 and GP21 are reserved for OLED I2C and are not normal digital output channels.',
            reset: 'GP22 is reserved for OLED RES/RST and is not a normal digital output channel.'
          }
        },
        rp2040PicoOled091: {
          title: 'Pico + OLED 0.91-inch 128x32 Wiring',
          summary: 'This firmware uses GP20/GP21 for the I2C OLED. The software exposes normal digital output, buzzer, and display output entries.',
          reserved: {
            i2c: 'GP20 and GP21 are reserved for OLED I2C and are not normal digital output channels.'
          }
        },
        arduinoUno: {
          title: 'Arduino Uno Wiring',
          summary: 'The Uno software experience exposes D2-D10 as stable digital output channels.',
          reserved: {
            serial: 'D0/D1 are hardware serial RX/TX pins and are not output channels.'
          }
        },
        arduinoNano: {
          title: 'Arduino Nano Wiring',
          summary: 'The Nano software experience exposes D2-D10 as stable digital output channels. New and old bootloader targets only change flashing parameters.',
          reserved: {
            serialAnalog: 'D0/D1 are hardware serial RX/TX pins. D11-D13 and A0-A7 are currently board information only.'
          }
        },
        sparkfunProMicro32u4: {
          title: 'SparkFun Pro Micro 32U4 Wiring',
          summary: 'This firmware targets the 5V/16MHz Pro Micro and exposes common header digital outputs, breathing on D3/D5/D6/D9/D10, and a D9 buzzer channel.',
          reserved: {
            usb: 'The onboard USB port is used for both app communication and flashing. No extra USB-TTL wiring is needed at runtime.',
            unrouted: 'D13, D22, and D23 are not on common Pro Micro headers. D17/RX_LED is an onboard LED pad. These pins are not normal external output channels.',
            sharedD9: 'D9 can be used as digital output/PWM breathing or as the buzzer channel. Wire only one peripheral type to it at a time.'
          }
        },
        wioTerminal: {
          title: 'Wio Terminal Wiring',
          summary: 'The Wio Terminal firmware supports Grove/header digital outputs, onboard buzzer, built-in display, and button inputs.',
          reserved: {
            onboard: 'Built-in LCD, buzzer, and buttons need no external wiring. External modules still need shared GND through Grove or header pins.'
          }
        },
        stm32BluePill: {
          title: 'STM32F103C8T6/C6T6 Blue Pill Wiring',
          summary: 'The Blue Pill firmware exposes PA0-PA7, PB0/PB1, and PB10/PB11 as digital output channels.',
          reserved: {
            swd: 'PA13/PA14 are SWD debug and flashing pins. They are shown as board information only and are not output channels.'
          }
        }
      }
    },
    flashGuides: {
      stm32BluePill: {
        title: 'STM32 Serial Flashing Setup',
        summary:
          'This firmware is flashed through USB-TTL serial. It is not flashed by drag-and-drop or SWD.',
        wiringTitle: 'USB-TTL Wiring',
        wiringTx: 'USB-TTL TXD -> PA10 / USART1_RX',
        wiringRx: 'USB-TTL RXD -> PA9 / USART1_TX',
        wiringGnd: 'USB-TTL GND -> Blue Pill GND',
        wiringVoltage:
          'Use 3.3V TTL logic. If the board is already powered by USB, do not connect USB-TTL 3V3.',
        bootTitle: 'Enter Flashing Mode',
        bootEnter: 'Set BOOT0 to 1, keep BOOT1 at 0, then press RESET.',
        bootExit: 'After flashing, set BOOT0 back to 0, then press RESET to run the firmware.',
        runtimeTitle: 'After Flashing',
        runtimeUsb:
          'After flashing, set BOOT0 back to 0, press RESET, then connect the app through the onboard USB port.',
        runtimeTtl:
          'USB-TTL is mainly for serial flashing. Daily identification and connection do not need TXD/RXD wiring.',
        dependencyTitle: 'Software Dependencies',
        dependencyTools: 'Arduino CLI, STM32CubeProgrammer, and GNU getopt are required.',
        dependencyGetopt:
          'On macOS, install GNU getopt with brew install gnu-getopt if getopt reports an option error.',
        dependencyProgrammer:
          'If STM32_Programmer_CLI is not found, install STM32CubeProgrammer and make sure the app process can read that command path.',
        portTitle: 'Port Selection',
        portHint: 'Select the /dev/cu.usbserial-* or equivalent serial port for the USB-TTL adapter.'
      }
    },
    currentFirmware: 'Current Firmware',
    firmwareDescription: 'Device firmware information.',
    deviceName: 'Device Name',
    boardName: 'Board Name',
    boardId: 'Board ID',
    artifactId: 'Firmware Artifact ID',
    bundledFirmwareVersion: 'Bundled Firmware Version',
    firmwareSource: 'Firmware Source',
    artifactType: 'Artifact Type',
    targetId: 'Build Target',
    toolchain: 'Toolchain',
    flashStrategy: 'Flash Strategy',
    flashVolumeName: 'Target Volume',
    uploadFqbn: 'Arduino FQBN',
    uploadProtocol: 'Upload Protocol',
    uploadSpeed: 'Upload Speed',
    uploadReset: 'Reset Mode',
    uploadResetRequired: 'Requires 1200bps reset',
    uploadResetNotRequired: 'Automatic reset is not required',
    bootloaderWait: 'Bootloader Wait Time',
    boardOptions: 'Board Options',
    relativePath: 'Relative Path',
    noSelectedFirmware: 'Select a firmware artifact.',
    firmwareFile: 'Firmware File',
    protocolVersion: 'Protocol Version',
    updateTitle: 'Firmware Update',
    updateDescription: 'Flash the bundled firmware to the device.',
    dropHint: 'Drop the firmware file here, or click to choose a file.',
    chooseFile: 'Choose Firmware File',
    bootselStatus: 'BOOTSEL Volume Status',
    flashSupportStatus: 'Flash Support Status',
    arduinoCliStatus: 'Arduino CLI Status',
    arduinoCliAvailable: 'Arduino CLI detected: {{version}}',
    arduinoCliUnavailable: 'Arduino CLI was not detected',
    arduinoCliHintTitle: 'Arduino Flashing',
    arduinoCliHintReady: 'Select a target serial port to flash this firmware through Arduino CLI.',
    arduinoCliHintConfigure:
      'Configure the arduino-cli path in Settings, or make sure arduino-cli is available in system PATH.',
    arduinoCliNotFound:
      'Arduino CLI was not detected. Configure the arduino-cli path in Settings, or make sure it is available in system PATH.',
    flashTargetPort: 'Target Port',
    flashTargetPortDescription: 'Select the device serial port to use for the flashing flow.',
    noFlashTargetPort: 'No serial port available',
    refreshFlashTargets: 'Refresh Ports',
    detecting: 'Detecting RPI-RP2 flash volume...',
    bootselMissing: 'RPI-RP2 flash volume not detected',
    directFlashUnsupported: 'This firmware does not use the current flashing method.',
    directFlashUnsupportedTitle: 'Select a matching flashing method',
    directFlashUnsupportedDescription: 'Choose the matching device and flashing target for this firmware type.',
    refreshStatus: 'Refresh Status',
    flashBuiltIn: 'Flash Bundled Firmware',
    flashSelected: 'Flash selected firmware',
    flashSuccess: 'Firmware copied to RPI-RP2. The device will reboot automatically.',
    copiedBytes: 'Copied {{bytes}} bytes.',
    arduinoCliFlashSuccess: 'Arduino CLI upload completed.',
    arduinoCliFlashTarget: 'Target port: {{target}}',
    noteFormat: '• Firmware file format: .uf2',
    noteConnected: '• Make sure the device is connected before updating',
    noteBootsel: '• Hold BOOTSEL while plugging in the RP2040 Pico until the RPI-RP2 disk appears',
    noteKeepConnected: '• Do not disconnect the device during flashing'
  },
  hookEvents: {
    codex: {
      sessionStart: {
        title: 'Session Started',
        description: 'Triggered when a Codex session starts or resumes.',
        scenario: 'Use it to indicate that the AI has entered a working state.'
      },
      subagentStart: {
        title: 'Subagent Started',
        description: 'Triggered when Codex starts a subagent to process a task.',
        scenario: 'Use it to observe subagent activity in complex tasks.'
      },
      preToolUse: {
        title: 'Before Tool Use',
        description: 'Triggered before Codex calls a command, file, or other tool.',
        scenario: 'Use it to indicate that the AI is executing a concrete action.'
      },
      permissionRequest: {
        title: 'Permission Request',
        description: 'Triggered when Codex needs user approval for a tool call.',
        scenario: 'Use it to prompt the user to handle authorization or confirmation.'
      },
      postToolUse: {
        title: 'After Tool Use',
        description: 'Triggered after a Codex tool call completes.',
        scenario: 'Use it to indicate that a command or tool operation has ended.'
      },
      preCompact: {
        title: 'Before Compact',
        description: 'Triggered before Codex compacts context.',
        scenario: 'Use it to observe state changes before context organization.'
      },
      postCompact: {
        title: 'After Compact',
        description: 'Triggered after Codex completes context compaction.',
        scenario: 'Use it to observe context organization completion.'
      },
      userPromptSubmit: {
        title: 'User Prompt Submitted',
        description: 'Triggered when the user submits a new prompt to Codex.',
        scenario: 'Use it to indicate that a new AI work cycle is about to begin.'
      },
      subagentStop: {
        title: 'Subagent Stopped',
        description: 'Triggered when a Codex subagent completes its work.',
        scenario: 'Use it to observe subagent completion in complex tasks.'
      },
      stop: {
        title: 'Session Turn Ended',
        description: 'Triggered when the current Codex response or task turn ends.',
        scenario: 'Use it to indicate that the current AI work has completed.'
      }
    },
    claudeCode: {
      sessionStart: {
        title: 'Session Started',
        description: 'Triggered when a Claude Code session starts.',
        scenario: 'Use it to indicate that the AI has entered a working state.'
      },
      userPromptSubmit: {
        title: 'User Prompt Submitted',
        description: 'Triggered when the user submits a new prompt.',
        scenario: 'Use it to indicate that a new AI work cycle is about to begin.'
      },
      userPromptExpansion: {
        title: 'Prompt Expanded',
        description: 'Triggered when Claude Code expands the user prompt.',
        scenario: 'Use it to observe prompt expansion or rewriting.'
      },
      preToolUse: {
        title: 'Before Tool Use',
        description: 'Triggered before a tool call.',
        scenario: 'Use it to indicate that the AI is executing a concrete action.'
      },
      postToolUse: {
        title: 'After Tool Use',
        description: 'Triggered after a tool call completes.',
        scenario: 'Use it to indicate that a tool operation has ended.'
      },
      postToolUseFailure: {
        title: 'Tool Use Failed',
        description: 'Triggered after a tool call fails.',
        scenario: 'Use it to indicate that an AI operation failed.'
      },
      postToolBatch: {
        title: 'Tool Batch Completed',
        description: 'Triggered after a batch of tool calls completes.',
        scenario: 'Use it to reduce notification frequency from per-tool events.'
      },
      notification: {
        title: 'Notification',
        description: 'Triggered when Claude Code emits a notification.',
        scenario: 'Use it to prompt the user to notice a state change.'
      },
      permissionRequest: {
        title: 'Permission Request',
        description: 'Triggered when user authorization is required.',
        scenario: 'Use it to prompt the user to handle authorization.'
      },
      stop: {
        title: 'Stopped',
        description: 'Triggered when the current response or task ends.',
        scenario: 'Use it to indicate that the current AI work has completed.'
      },
      stopFailure: {
        title: 'Stop Failed',
        description: 'Triggered when the stop flow fails.',
        scenario: 'Use it to indicate an error during task completion.'
      },
      subagentStart: {
        title: 'Subagent Started',
        description: 'Triggered when a subagent starts processing a task.',
        scenario: 'Use it to observe subagent activity in complex tasks.'
      },
      subagentStop: {
        title: 'Subagent Stopped',
        description: 'Triggered when a subagent completes its work.',
        scenario: 'Use it to observe subagent completion in complex tasks.'
      },
      taskCreated: {
        title: 'Task Created',
        description: 'Triggered when Claude Code creates a task.',
        scenario: 'Use it to observe task splitting and queueing.'
      },
      taskCompleted: {
        title: 'Task Completed',
        description: 'Triggered when a Claude Code task completes.',
        scenario: 'Use it to observe task completion.'
      },
      preCompact: {
        title: 'Before Compact',
        description: 'Triggered before context compaction.',
        scenario: 'Use it to observe state before context organization.'
      },
      postCompact: {
        title: 'After Compact',
        description: 'Triggered after context compaction.',
        scenario: 'Use it to observe context organization completion.'
      },
      sessionEnd: {
        title: 'Session Ended',
        description: 'Triggered when a session ends.',
        scenario: 'Use it to indicate that the AI session has ended.'
      },
      configChange: {
        title: 'Config Changed',
        description: 'Triggered when configuration changes.',
        scenario: 'Use it to observe Claude Code configuration adjustments.'
      },
      cwdChanged: {
        title: 'Directory Changed',
        description: 'Triggered when the working directory changes.',
        scenario: 'Use it to observe working context switches.'
      },
      fileChanged: {
        title: 'File Changed',
        description: 'Triggered when a file changes.',
        scenario: 'Use it to observe file editing activity.'
      },
      permissionDenied: {
        title: 'Permission Denied',
        description: 'Triggered when a permission request is denied.',
        scenario: 'Use it to indicate that limited permission prevents continued work.'
      },
      teammateIdle: {
        title: 'Teammate Idle',
        description: 'Triggered when a teammate becomes idle.',
        scenario: 'Use it for collaborative status indication.'
      },
      worktreeCreate: {
        title: 'Worktree Created',
        description: 'Triggered when a worktree is created.',
        scenario: 'Use it to observe parallel workspace creation.'
      },
      worktreeRemove: {
        title: 'Worktree Removed',
        description: 'Triggered when a worktree is removed.',
        scenario: 'Use it to observe parallel workspace cleanup.'
      },
      messageDisplay: {
        title: 'Message Displayed',
        description: 'Triggered when a message is displayed.',
        scenario: 'Use it to observe important message presentation.'
      },
      elicitation: {
        title: 'Elicitation',
        description: 'Triggered when Claude Code asks for additional information.',
        scenario: 'Use it to indicate that the user may need to provide more information.'
      },
      elicitationResult: {
        title: 'Elicitation Result',
        description: 'Triggered when elicitation produces a result.',
        scenario: 'Use it to observe completion of the information request flow.'
      }
    }
  },
  rules: {
    title: 'AI Event Mapping',
    loadingProfile: 'Loading profile...',
    description: 'Map raw AI Hook events to internal events, then bind internal events to outputs.',
    toast: {
      createTitle: 'Created',
      createDescription: 'Profile "{{name}}" was created.',
      duplicateTitle: 'Duplicated',
      activateTitle: 'Activated',
      activateDescription: 'Profile "{{name}}" was activated.',
      deleteTitle: 'Deleted',
      deleteDescription: 'Profile "{{name}}" was deleted.'
    },
    profile: {
      title: 'Profiles',
      description: 'Manage event mappings, output rules, and device policy.',
      create: 'New',
      import: 'Import',
      export: 'Export',
      duplicateCurrent: 'Duplicate Current',
      empty: 'No profiles',
      createFirst: 'Create First Profile',
      active: 'Active',
      openMenu: 'Open menu',
      activate: 'Activate',
      duplicate: 'Duplicate',
      delete: 'Delete',
      activateThis: 'Activate This Profile',
      createDialogTitle: 'New Profile',
      duplicateDialogTitle: 'Duplicate Profile',
      createDialogDescription: 'Create a new profile. The profile ID will be generated automatically.',
      duplicateDialogDescription: 'Duplicate configuration from "{{name}}". The profile ID will be generated automatically.',
      nameRequired: 'Profile name is required.',
      nameTooShort: 'Profile name must be at least 2 characters.',
      nameTooLong: 'Profile name cannot exceed 50 characters.',
      nameLabel: 'Profile Name',
      namePlaceholder: 'For example: Focus Mode, Fast Coding',
      idHint: 'Profile ID is generated from the name, such as focus-mode-a1b2c3d4.',
      templateLabel: 'Select Template',
      deleteDialogTitle: 'Delete profile?',
      deleteDialogDescription: 'Profile "{{name}}" will be deleted. This action cannot be undone.'
    },
    profilePackage: {
      import: 'Import Profile',
      importing: 'Importing...',
      importDialogTitle: 'Import Profile Package',
      importDialogDescription:
        'This will create a new profile named "{{name}}" without overwriting existing profiles.',
      sourceProfile: 'Source Profile',
      importedProfile: 'Imported Name',
      hookEventCount: 'Hook Events',
      aiMappingCount: 'AI Mappings',
      outputRuleCount: 'Output Rules',
      deviceRuleCount: 'Device Rules',
      desktopNoticeInstanceCount: 'Desktop Notice Instances',
      hookConfigWarning:
        'Import restores CC Notice internal Hook selections only. It does not write Codex, Claude, or other tool Hook config files. After importing, open Hook Settings to review and write them manually.',
      customMascotWarning:
        'This package references local custom mascot asset packs, but profile packages do not include GIF assets. Make sure matching packs exist in the mascot directory on this machine, or related desktop mascot instances may not render.',
      deviceBindingTitle: 'Device Output Binding',
      deviceBindingDescription:
        'The package does not carry device instances from the old machine. Bind source device groups to currently connected devices when possible. Unbound or incompatible device rules are preserved but disabled.',
      requirementCount: '{{count}} capability requirements',
      noBinding: 'No binding, disable after import',
      noDeviceRules: 'This profile contains no device output rules and can be imported directly.',
      activateAfterImport: 'Activate the new profile after import',
      activateAfterImportDescription:
        'Activation only switches the current CC Notice profile. Hook config files still need confirmation in Hook Settings.',
      exportSuccessTitle: 'Exported',
      exportSuccessDescription: 'The profile package was written to the selected file.',
      exportFailedTitle: 'Export Failed',
      previewFailedTitle: 'Cannot Preview Package',
      importSuccessTitle: 'Imported',
      importSuccessDescription:
        'Profile "{{name}}" was imported. Open Hook Settings to write Hook configuration if needed.',
      importFailedTitle: 'Import Failed',
      status: {
        'full-match': 'Full Match',
        'partial-match': 'Partial Match',
        'board-mismatch': 'Board Mismatch',
        unbound: 'Unbound'
      },
      statusHelp: {
        'full-match':
          'The target board and channel capabilities match. Imported device rules can keep their enabled state.',
        'partial-match':
          'The target board matches but lacks some channels or actions. Related device rules will be disabled.',
        'board-mismatch':
          'The target board is different. The binding intent is preserved, but related device rules will be disabled.',
        unbound:
          'No target device is selected. Related device rules will be disabled and can be adjusted later in output rules.'
      }
    },
    profileTemplates: {
      basic: {
        name: 'Basic Mapping Profile',
        description: 'Preset common AI Hook mappings and basic output rules without enabling any Hook event.'
      },
      advanced: {
        name: 'Advanced Mapping Profile',
        description: 'Preset extended AI Hook mappings and output rules without enabling any Hook event.'
      },
      blank: {
        name: 'Blank Profile',
        description: 'Start from an empty custom profile.'
      }
    },
    tabs: {
      visualWorkflow: 'Visual Setup',
      aiMapping: 'AI Event Mapping',
      outputRules: 'Output Rules'
    },
    linkWorkflow: {
      title: 'Visual Setup',
      description: 'Configure Hook events, internal events, and outputs through a fixed flow.',
      noEnabledHookEvents: 'No Hook event is enabled in Hook Settings',
      noEnabledHookEventsHint: 'Select the Hook events to receive in Hook Settings, then return here to configure the mapping chain.',
      openHookSettings: 'Open Hook Settings',
      status: {
        blocked: 'Blocked',
        empty: 'Empty',
        ready: 'Ready',
        configured: 'Configured',
        warning: 'Check'
      },
      canvas: {
        internalOverviewTitle: 'Internal Event Overview',
        internalOverviewDescription: 'Review internal events currently in use.',
        outputOverviewTitle: 'Output Rules',
        outputOverviewDescription: 'Review outputs that can be triggered.'
      },
      toolNode: {
        enabledCount: '{{count}} Hooks enabled',
        mappedCount: '{{mapped}}/{{total}}'
      },
      inspector: {
        hookMapping: 'Hook Mapping',
        mapped: 'Mapped',
        unmapped: 'No Mapping',
        disabledMapping: 'Mapping Disabled',
        internalReferences: 'Internal Event References',
        editAiMapping: 'Edit AI Mapping',
        openOutputRules: 'Open Output Rules',
        toolDialogDescription:
          'Review mapping status for enabled Hook events from this AI tool.',
        internalDialogDescription:
          'Review internal events currently used by AI Hooks.',
        outputDialogDescription: 'Review output configuration for internal events.',
        noInternalReferences: 'No internal event is referenced by Hook mappings yet.',
        noOutputInternalEvents:
          'Finish Hook-to-internal-event mapping before configuring outputs.',
        referenceCount: '{{count}} Hook mapping references',
        hookReferences: 'Referenced Hooks',
        viewHookReferences: 'View Hook references for {{event}}',
        enableHookMapping: 'Enable {{event}} mapping',
        disableHookMapping: 'Disable {{event}} mapping',
        configureMapping: 'Configure',
        editMapping: 'Edit Mapping',
        configureHookMappingFor: 'Configure mapping for {{event}}',
        editHookMappingFor: 'Edit mapping for {{event}}',
        configureHookMappingTitle: 'Configure Hook Mapping',
        editHookMappingTitle: 'Edit Hook Mapping',
        hookMappingDetailDescription:
          'Choose an internal event for the current Hook event. After saving, it can trigger output rules.',
        currentAiTool: 'AI Tool',
        currentHookEvent: 'Current Hook Event',
        internalEventSelectionHint: '{{title}}: {{scenario}}',
        enableOutput: 'Enable {{type}} output',
        disableOutput: 'Disable {{type}} output',
        outputRulesDescription:
          'Select an internal event to review the outputs it can trigger.',
        internalEvent: 'Internal Event',
        outputStats: {
          total: 'Output Types',
          enabled: 'Enabled',
          needsConfig: 'Needs Config'
        },
        outputItems: 'Output Types',
        edit: 'Edit',
        add: 'Add',
        addAndConfigure: 'Add and Configure',
        editOutput: 'Edit {{type}}',
        addOutputType: 'Add {{type}}',
        addAndConfigureOutput: 'Add and configure {{type}}',
        addOutput: 'Add Output Type'
      },
      outputStatus: {
        enabled: 'Enabled',
        disabled: 'Disabled',
        'needs-config': 'Needs Config',
        'not-added': 'Not Added'
      },
      summary: {
        deviceActions: '{{count}} actions · {{channels}}',
        deviceActionCount: '{{count}} actions',
        missingWebhookUrl: 'Missing Webhook URL',
        missingSoundFile: 'Missing audio file',
        systemNotification: 'System notification',
        display: 'Display output'
      }
    },
    aiMapping: {
      title: 'AI Hook to Internal Event',
      description: 'Configure mappings from raw AI tool events to system internal events.',
      add: 'Add Mapping',
      warning: '{{count}} mapped Hook events are not enabled in Hook Settings:',
      warningHint: 'Enable these events on the Hook Settings page, or they will not trigger outputs.',
      empty: 'No AI mappings for the current tool.',
      createFirst: 'Create First Mapping',
      hookEvent: 'Hook Event',
      notEnabled: 'Not Enabled',
      internalEvent: 'Internal Event',
      enabled: 'Enabled',
      createTitle: 'Add {{toolName}} Mapping',
      createDescription: 'Select a configured Hook event and bind it to an internal event.',
      allConfigured:
        'There are no configured Hook events available to add for the current tool. Enable events in Hook Settings first, or check whether all configured events are already mapped.',
      enabledHookSourceHint: 'Available Hook events come from events enabled in Hook Settings.',
      hookEventPlaceholder: 'Select Hook Event',
      internalEventPlaceholder: 'Select Internal Event',
      scenario: 'Scenario: {{scenario}}'
    },
    internalCatalog: {
      title: 'Internal Event Catalog',
      description: 'Built-in and locally customized unified event definitions.',
      addCustom: 'Add Custom Event',
      editCustom: 'Edit Custom Event',
      deleteCustom: 'Delete Custom Event',
      builtIn: 'Built-in',
      custom: 'Custom',
      createDialogTitle: 'Add Custom Internal Event',
      editDialogTitle: 'Edit Custom Internal Event',
      dialogDescription: 'Custom internal events are available to all profiles on this device.',
      idPrefix: 'Event ID Prefix',
      finalId: 'Final ID: {{id}}',
      eventId: 'Event ID',
      eventTitle: 'Display Name',
      eventDescription: 'Description',
      eventScenario: 'Scenario',
      deleteDialogTitle: 'Delete Custom Internal Event',
      deleteDialogDescription:
        'Delete "{{id}}"? Deletion is rejected if any profile still references this event.',
      prefixErrors: {
        empty: 'Enter an event ID prefix.',
        tooShort: 'The event ID prefix must be 3 to 32 characters.',
        tooLong: 'The event ID prefix must be 3 to 32 characters.',
        invalidChars: 'The event ID prefix only allows English letters, digits, and dots.',
        edgeDot: 'The event ID prefix cannot start or end with a dot.',
        doubleDot: 'The event ID prefix cannot contain consecutive dots.',
        duplicateSuffix: 'Enter only the prefix. The app appends .userDefined automatically.'
      }
    },
    internalEvents: {
      agentStarted: {
        title: 'AI Started',
        description:
          'The AI has started thinking and processing after the user submitted a prompt.',
        scenario: 'Session start or user prompt submission'
      },
      agentWorking: {
        title: 'AI Working',
        description: 'The AI is actively processing a task.',
        scenario: 'Subtask running, prompt expansion, or continued work after a tool call'
      },
      agentWaitingInput: {
        title: 'Waiting for Input',
        description: 'The AI is waiting for user input or permission.',
        scenario: 'Permission request or manual confirmation'
      },
      toolExecuting: {
        title: 'Tool Executing',
        description: 'The AI is calling a tool, such as reading files or running commands.',
        scenario: 'PreToolUse event'
      },
      agentCompleted: {
        title: 'Task Completed',
        description: 'The AI task ended normally.',
        scenario: 'Stop event or session end'
      },
      agentFailed: {
        title: 'Task Failed',
        description: 'The AI task failed or ended unexpectedly.',
        scenario: 'Failure event or parsing error'
      },
      notification: {
        title: 'System Notification',
        description: 'A system notification or message emitted by the AI tool.',
        scenario: 'Claude Code Notification event'
      },
      contextCompacting: {
        title: 'Context Compacting',
        description: 'The AI is compacting context to save memory.',
        scenario: 'PreCompact event'
      }
    },
    outputTypes: {
      deviceChannel: 'Device Channel',
      deviceChannelDescription: 'Send an action to a specific device channel',
      buzzer: 'Buzzer',
      buzzerDescription: 'Sound indicator',
      display: 'Display',
      displayDescription: 'Show status, title, and message on a device display',
      systemNotification: 'System Notification',
      systemNotificationDescription: 'Push to the operating system notification center',
      webhook: 'Webhook',
      webhookDescription: 'HTTP callback to the specified URL',
      sound: 'Sound',
      soundDescription: 'Play a system alert sound or custom audio',
      desktopNotice: 'Desktop Notice',
      desktopNoticeDescription: 'Show a local always-on-top visual notice on the desktop',
      custom: 'Custom',
      customDescription: 'Custom output configuration'
    },
    outputRules: {
      title: 'Output Rules',
      description: 'Configure multiple output types for each internal event, such as device channels, buzzer, display, and notifications.',
      empty: 'No configurable internal events.',
      emptyHint: 'Configure AI Hook to internal event mappings in AI Event Mapping first.',
      generating: 'Generating rules...',
      outputTypeCount: '{{count}} output types',
      addOutputType: 'Add Output Type',
      limitEnableMessage: 'This internal event can enable at most {{limit}} outputs. Disable another output first.',
      limitAddMessage: 'This internal event already has {{limit}} enabled outputs. The new output was added disabled.',
      enabled: 'Enabled',
      disabled: 'Disabled',
      pendingConfig: 'Needs Config',
      detailSettings: 'Details',
      enable: 'Enable',
      summaryDeviceChannel: 'Device {{device}} · Channel {{channel}} · Action {{action}} · {{duration}}',
      summaryDeviceChannelActions: '{{count}} device channel actions · {{channels}}',
      summaryNotification: 'Notification {{level}} · Title {{title}} · Throttle {{seconds}}s',
      summaryWebhook: '{{method}} · {{url}}',
      summarySound: '{{file}} · Volume {{volume}}%',
      summaryDisplay: '{{device}} · {{status}} · {{title}}',
      summaryDesktopNotice: 'Desktop notice {{targets}} · {{effect}} · {{seconds}}s · {{restoreBehavior}}',
      summaryDesktopNoticeTargets: 'Desktop notice {{count}} targets · {{targetTypes}} · {{highlight}} · {{seconds}}s · {{restoreBehavior}}',
      summaryDesktopMascot: 'Desktop notice {{targets}} · Mascot · {{state}} · {{action}} · {{playbackWindow}} · Bubble {{bubble}} · {{seconds}}s · {{restoreBehavior}}',
      desktopNoticeLightbarCount: 'Lightbars {{count}}',
      desktopNoticeMascotCount: 'Mascots {{count}}',
      multipleTargets: 'Multiple targets',
      permanent: 'Permanent',
      noSummary: 'No summary',
      unsetUrl: 'URL not set',
      unsetSound: 'Audio file not set',
      addDialogTitle: 'Add Output Type',
      addDialogDescription: 'Add a new output type for internal event {{internalEvent}}.',
      allTypesConfigured: 'All available output types are already configured for this internal event.',
      outputType: 'Output Type',
      outputTypePlaceholder: 'Select Output Type',
      alreadyConfigured: ' (configured)',
      notImplemented: ' (unavailable)',
      addHint: 'Configure details in the output rule card after adding.',
      notImplementedHint: 'This output type is currently unavailable. Select another output type.',
      add: 'Add',
      detailTitle: '{{type}} Output Settings',
      detailDescription: 'Configure output parameters for internal event {{internalEvent}}.',
      unsupported: 'This output type only supports common settings.',
      saveSettings: 'Save Settings',
      validationWebhookUrlRequired: 'Webhook URL is required.',
      validationWebhookUrlInvalid: 'Webhook URL must start with http:// or https://.',
      validationHeadersJson: 'Headers must be valid JSON.',
      validationBodyJson: 'Body must be valid JSON.',
      validationSoundRequired: 'Audio file is required.',
      validationDeviceRequired: 'Device is required.',
      validationChannelRequired: 'Channel is required.',
      validationChannelActionRequired: 'Channel action is required.',
      validationChannelActionsRequired: 'Device channel output requires at least one action group.',
      validationChannelActionsLimit: 'Each device channel output rule supports up to 10 action groups.',
      validationDuplicateChannelAction: 'The same channel on the same device cannot be configured twice.',
      validationDutyPercentRequired: 'Set Duty action requires duty.',
      validationFrequencyRequired: 'Beep or tone action requires frequency.',
      validationColorRequired: 'Set Color action requires color.',
      validationBrightnessRequired: 'Set Color action requires brightness.',
      validationIntervalRequired: 'Blink or breathe action requires interval.',
      validationPatternRequired: 'Pattern action requires a pattern.',
      validationDisplayDeviceRequired: 'Select a device that supports display output.',
      validationDisplayStatusRequired: 'Select a display status.',
      validationDisplayTitleRequired: 'Enter a display title template.',
      validationDisplayMessageRequired: 'Enter a display message template.',
      validationDesktopNoticeTargetRequired: 'Choose at least one enabled desktop notice instance.',
      validationDesktopNoticeDurationInvalid: 'Duration must be between 100 and 60000 ms.',
      validationDesktopNoticeBreathingPeriodInvalid: 'Breathing period must be between 500 and 5000 ms.',
      validationDesktopNoticeColorInvalid: 'Color must use #RRGGBB format.',
      validationDesktopNoticeColorStopsInvalid: 'The color stop count does not match the color mode.'
    },
    desktopNotice: {
      addDialogTitle: 'Desktop notice instance',
      addDialogReady: 'The first enabled instance will be selected by default. You can adjust it in details.',
      targets: 'Target Instances',
      noEnabledInstances: 'Create and enable a desktop notice instance in Settings first.',
      effect: 'Effect',
      durationMs: 'Duration (ms)',
      animationPeriodMs: 'Animation Period (ms)',
      animationPeriodHint: 'Allowed range {{min}}-{{max}} ms. Default {{defaultValue}} ms.',
      breathingPeriodMs: 'Breathing Period (ms)',
      opacityPercent: 'Opacity (%)',
      brightnessPercent: 'Brightness (%)',
      restoreBehavior: 'End Behavior',
      edge: 'Glow Edge',
      mascotState: 'Semantic State',
      mascotAction: 'Action',
      mascotPlayMode: 'Playback Mode',
      mascotPlayModeHint:
        'Controls how this rule plays the mascot action. Use action default when unset.',
      mascotPlayModes: {
        default: 'Use Action Default',
        loop: 'Loop',
        onceThenHold: 'Play Once Then Hold',
        onceThenIdle: 'Play Once Then Idle'
      },
      mascotPlaybackWindowMs: 'One-Shot Playback Window (ms)',
      mascotPlaybackWindowHint:
        'Only applies to play-once hold or idle modes. Allowed range {{min}}-{{max}} ms. Default {{defaultValue}} ms.',
      mascotPlaybackWindowInvalid: 'One-shot playback window must be between 500 and 8000 ms.',
      mascotPlaybackWindowSummary: 'Play once for {{seconds}}s',
      mascotBubbleTemplate: 'Bubble Text',
      mascotBubbleHint: 'Up to {{lines}} lines, {{chars}} characters per line.',
      mascotBubbleInvalid: 'Up to 2 lines, 18 characters per line.',
      colorMode: 'Color Mode',
      colors: 'Colors',
      addColorStop: 'Add Gradient Stop',
      preview: 'Preview',
      actualPreview: 'Actual Preview',
      actualPreviewRunning: 'Previewing...',
      actualPreviewDisabledHint: 'Select an enabled desktop notice instance before previewing the actual effect.',
      actualPreviewFailed: 'Failed to preview the actual effect. Check the desktop notice instance settings.',
      previewHint: 'Preview the current color and effect. Position and size are configured in the instance library.',
      presetColors: 'Preset Colors',
      presetColorsSolidHint: 'Click to replace the current color',
      presetColorsGradientHint: 'Click to replace stop {{index}}',
      solidEditHint: 'Click to open the color editor',
      editSolidColor: 'Edit solid color {{color}}',
      gradientPreview: 'Gradient Preview',
      gradientPreviewHint: 'Click a stop to choose which color to edit.',
      currentColorStop: 'Current: Stop {{index}}',
      selectGradientPreviewStop: 'Select gradient preview stop {{index}}',
      selectColorStop: 'Select stop {{index}}',
      editColorStop: 'Edit stop {{index}} {{color}}',
      colorStopLabel: 'Stop {{index}}',
      colorStopPositionLabel: 'Stop {{index}} position',
      removeColorStop: 'Remove stop {{index}}',
      currentEditingColorStop: 'Editing stop {{index}}: {{color}} · {{position}}%',
      colorEditorSolidTitle: 'Edit Solid Color',
      colorEditorStopTitle: 'Edit Stop {{index}}',
      currentColor: 'Current color {{color}}',
      visualColorPicker: 'Visual color picker',
      pickScreenColor: 'Pick color from screen',
      hexColor: 'HEX color',
      applyColor: 'Apply Color',
      closeColorEditor: 'Close',
      eyedropperUnsupported: 'Screen color picking is not supported in this environment',
      colorEditorPresetHint: 'Quickly replace the current editing color',
      restoreBehaviors: {
        useInstanceIdle: 'Use Instance Idle Behavior',
        hide: 'Hide When Expired',
        keepLast: 'Keep Last State',
        dimPlaceholder: 'Restore Dim Placeholder'
      },
      effects: {
        solid: 'Solid',
        breathing: 'Breathing',
        blink: 'Blink',
        scan: 'Scan',
        fade: 'Fade',
        edgeBreathing: 'Edge Breathing'
      },
      edges: {
        auto: 'Auto',
        top: 'Top',
        bottom: 'Bottom',
        left: 'Left',
        right: 'Right'
      },
      colorModes: {
        solid: 'Solid',
        gradient: 'Gradient'
      }
    },
    display: {
      device: 'Display Device',
      devicePlaceholder: 'Select a device with display output',
      template: 'Display Scene',
      templateDescription: 'Select a display scene. The app renders matching status, title, and short content for the target device.',
      templateAdvanced: 'Advanced Text Template',
      templateOptions: {
        notice: 'Notice',
        taskStarted: 'Started',
        taskRunning: 'Running',
        taskSuccess: 'Task Done',
        taskWarning: 'Attention Needed',
        taskError: 'Task Failed',
        waitingInput: 'Waiting for Input'
      },
      status: 'Display Status',
      titleTemplate: 'Title Template',
      messageTemplate: 'Message Template',
      variableHelp: 'Insert variables into the title or message; they are rendered from the event before display.',
      advancedCustom: 'Advanced custom display content',
      asciiOnlyHint: 'The current Wio screen only guarantees readable English, numbers, symbols, and variables. Non-ASCII text will be replaced or omitted.',
      validationAsciiOnly: 'This screen does not support non-ASCII text yet. Use English, numbers, symbols, or variables.',
      validationUnknownVariable: 'This screen template contains an unsupported variable. Use the variable helper to insert available variables.',
      duration: 'Display Duration',
      duration5s: '5 sec',
      duration15s: '15 sec',
      duration30s: '30 sec',
      durationUntilNext: 'Until next display content',
      titleMaxChars: 'Max Title Chars',
      messageMaxChars: 'Max Message Chars'
    },
    deviceChannel: {
      defaultRp2040: 'Default RP2040 Pico',
      device: 'Device',
      channelType: 'Channel Type',
      channel: 'Channel',
      noConfiguredChannels: 'No enabled channels are available for this device. Add channels on the Devices page first.',
      action: 'Action',
      actionGroups: 'Action Groups',
      actionGroupTitle: 'Action Group {{index}}',
      addChannelAction: 'Add action group',
      channelActionCount: '{{count}} / {{max}} action groups',
      durationMs: 'Duration (ms)',
      durationPlaceholder: 'Default 5000',
      intervalMs: 'Blink Interval (ms)',
      intervalPlaceholder: 'Default 500',
      dutyPercent: 'Duty (%)',
      dutyPercentPlaceholder: 'Default 50',
      frequencyHz: 'Frequency (Hz)',
      frequencyPlaceholder: 'Default 2000',
      color: 'Color',
      colorPlaceholder: 'For example #33ccff',
      brightnessPercent: 'Brightness (%)',
      brightnessPlaceholder: 'Default 30',
      pattern: 'Pattern',
      permanentPlaceholder: 'Blank means permanent',
      defaultIntervalPlaceholder: 'Blank uses default interval',
      rangeHint: 'Allowed range: {{min}} - {{max}}',
      pinReuseWarning:
        'This pin is already configured by {{channels}}. Reusing it will let later triggers override earlier hardware actions. Confirm this is the intended reuse behavior.',
      actions: {
        activate: 'Activate',
        deactivate: 'Deactivate',
        blink: 'Blink',
        breathe: 'Breathe',
        pulse: 'Pulse',
        clear: 'Clear',
        'set-duty': 'Set Duty',
        beep: 'Beep',
        tone: 'Tone',
        pattern: 'Pattern',
        'display-status': 'Display Status',
        'set-color': 'Set Color'
      }
    },
    duration: {
      customDurationSeconds: 'Custom Duration (seconds)',
      permanent: 'Permanent',
      custom: 'Custom',
      presets: {
        1000: '1 sec',
        2000: '2 sec',
        5000: '5 sec',
        10000: '10 sec',
        20000: '20 sec',
        30000: '30 sec',
        60000: '60 sec'
      }
    },
    notification: {
      copiedVariable: 'Variable Copied',
      variableHelp: 'Insert variables into the title and body. They are replaced with event content before sending.',
      focusWarning: 'System notifications may not appear because of notification permission, Focus, or Do Not Disturb settings.',
      level: 'Notification Level',
      levels: {
        info: 'Info',
        warning: 'Warning',
        error: 'Error',
        success: 'Success'
      },
      sound: 'Notification Sound',
      sounds: {
        default: 'System Default'
      },
      macosSoundHint: 'Notification sound is controlled by the OS notification center. Use Sound output for custom audio.',
      title: 'Notification Title',
      titlePlaceholder: 'For example: AI tool status update',
      titleMaxChars: 'Title Max Characters',
      body: 'Notification Body',
      bodyPlaceholder: 'For example: Agent started working',
      preview: 'Notification Preview',
      unsetTitle: 'Notification title not set',
      unsetBody: 'Notification body not set',
      previewCount: 'Title {{titleLength}} / {{titleMax}} · Body {{bodyLength}} / {{bodyMax}}',
      bodyMaxChars: 'Body Max Characters',
      throttleSeconds: 'Notification Throttle Seconds'
    },
    webhook: {
      copiedVariable: 'Variable Copied',
      variableHelp: 'The request body supports variable replacement and is rendered to final JSON before sending.',
      sensitiveDataWarning:
        'Webhook sends configured headers and body to an external URL. Confirm the target service is trusted before inserting variables such as prompt, tool response, or working directory.',
      method: 'HTTP Method',
      headers: 'Headers (JSON, optional)',
      body: 'Body (JSON, optional)',
      bodyMaxChars: 'Body Max Characters',
      currentTemplate: 'Current template {{length}} / {{max}}'
    },
    sound: {
      loadFailed: 'Failed to Load Audio List',
      previewUnavailable: 'Cannot Preview',
      chooseFirst: 'Select an audio file first.',
      previewStarted: 'Preview Started',
      previewFailed: 'Audio Preview Failed',
      source: 'Audio Source',
      sources: {
        builtIn: 'Built-in Audio',
        user: 'User Directory',
        custom: 'Custom Path'
      },
      builtIn: 'Built-in Audio',
      chooseBuiltIn: 'Select Built-in Audio',
      emptyBuiltIn: 'No built-in audio resources.',
      user: 'User Directory Audio',
      chooseUser: 'Select User Directory Audio',
      emptyUser: 'No audio files found in ~/.cc-notice/sounds.',
      file: 'Audio File',
      current: 'Current Audio',
      emptyFile: 'No audio file selected',
      preview: 'Preview',
      volumePercent: 'Volume Percent',
      maxDurationMs: 'Max Playback Milliseconds',
      throttleSeconds: 'Sound Throttle Seconds'
    },
    variables: {
      helper: 'Variable Helper',
      openHelper: 'Open variable helper',
      button: 'Variables',
      description: 'Public variables come from context or safe summaries and do not require debug. Large fields are trimmed automatically.',
      expandAll: 'Show all variables',
      insertAria: 'Insert {{label}} variable',
      copyAria: 'Copy {{label}} variable',
      sources: {
        context: 'Context',
        summary: 'Summary',
        largeSummary: 'Trimmed Summary'
      },
      internalEvent: {
        label: 'Internal Event',
        description: 'Unified event name after software-side conversion.'
      },
      model: {
        label: 'Model',
        description: 'Model name parsed from the Hook payload.'
      },
      lastAssistantMessage: {
        label: 'Task Summary',
        description: 'Assistant summary at task completion. Output keeps at most 10240 characters.',
        example: 'Code changes and validation are complete.'
      },
      prompt: {
        label: 'User Prompt',
        description: 'The prompt field from UserPromptSubmit events.',
        example: 'Please review this change.'
      },
      toolResponse: {
        label: 'Tool Response',
        description: 'The tool_response field from PostToolUse events. This is often large.',
        example: 'Command completed with exit code 0.'
      },
      pwd: {
        label: 'Working Directory',
        description: 'Current working directory cwd parsed from the Hook payload.'
      },
      sessionId: {
        label: 'Session ID',
        description: 'Session identifier parsed from the Hook payload.'
      },
      permissionMode: {
        label: 'Permission Mode',
        description: 'Permission mode parsed from the Hook payload.'
      },
      source: {
        label: 'Source',
        description: 'AI tool source identifier.'
      },
      event: {
        label: 'Hook Event',
        description: 'Raw AI tool Hook event name.'
      },
      timestamp: {
        label: 'Event Time',
        description: 'Time when relay submitted the event.'
      },
      toolName: {
        label: 'Tool Name',
        description: 'Tool name or identifier parsed from the Hook payload.'
      }
    }
  }
};
