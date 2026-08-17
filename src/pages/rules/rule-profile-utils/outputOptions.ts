import { HardwareOutput, HardwareOutputType } from '../../../api/tauriApi';
import {
  DisplayTemplateId,
  defaultLinesForDisplayTemplate,
  displayIconForTemplate,
  displayStatusForTemplate
} from '@/domain/display/displayTemplates';
import { defaultParametersForDeviceChannelAction } from './deviceChannelParameters';

export const supportedOutputTypes: Array<{
  value: HardwareOutputType;
  labelKey: string;
  descriptionKey: string;
  category: 'hardware' | 'notification' | 'custom';
  implemented: boolean;
}> = [
  {
    value: 'device-channel',
    labelKey: 'rules.outputTypes.deviceChannel',
    descriptionKey: 'rules.outputTypes.deviceChannelDescription',
    category: 'hardware',
    implemented: true
  },
  {
    value: 'display',
    labelKey: 'rules.outputTypes.display',
    descriptionKey: 'rules.outputTypes.displayDescription',
    category: 'hardware',
    implemented: true
  },
  {
    value: 'system-notification',
    labelKey: 'rules.outputTypes.systemNotification',
    descriptionKey: 'rules.outputTypes.systemNotificationDescription',
    category: 'notification',
    implemented: true
  },
  {
    value: 'webhook',
    labelKey: 'rules.outputTypes.webhook',
    descriptionKey: 'rules.outputTypes.webhookDescription',
    category: 'notification',
    implemented: true
  },
  {
    value: 'sound',
    labelKey: 'rules.outputTypes.sound',
    descriptionKey: 'rules.outputTypes.soundDescription',
    category: 'notification',
    implemented: true
  },
  {
    value: 'desktop-notice',
    labelKey: 'rules.outputTypes.desktopNotice',
    descriptionKey: 'rules.outputTypes.desktopNoticeDescription',
    category: 'notification',
    implemented: true
  },
  {
    value: 'custom',
    labelKey: 'rules.outputTypes.custom',
    descriptionKey: 'rules.outputTypes.customDescription',
    category: 'custom',
    implemented: false
  }
];

type SystemNotificationTemplate = {
  title: string;
  body: string;
};

const fallbackSystemNotificationTemplate: SystemNotificationTemplate = {
  title: '{{source}} · {{internalEvent}}',
  body: '模型：{{model}}，事件：{{event}}'
};

const systemNotificationTemplates: Record<string, SystemNotificationTemplate> = {
  'agent.started': {
    title: '{{source}} 开始处理任务',
    body: '模型：{{model}}，事件：{{event}}'
  },
  'agent.completed': {
    title: '{{source}} 已完成任务',
    body: '{{last_assistant_message}}'
  },
  'agent.failed': {
    title: '{{source}} 任务异常',
    body: '事件：{{event}}，模型：{{model}}'
  },
  'agent.waiting_input': {
    title: '{{source}} 等待输入',
    body: '当前事件：{{internalEvent}}'
  }
};

function systemNotificationTemplateForInternalEvent(
  internalEvent?: string
): SystemNotificationTemplate {
  if (!internalEvent) {
    return fallbackSystemNotificationTemplate;
  }
  return systemNotificationTemplates[internalEvent] ?? fallbackSystemNotificationTemplate;
}

export function createDefaultOutputForType(
  type: HardwareOutputType,
  internalEvent?: string
): HardwareOutput {
  if (type === 'device-channel') {
    return {
      type: 'device-channel',
      durationMs: null,
      channelActions: [
        {
          id: 'action-1',
          deviceId: 'rp2040-pico-default',
          channelId: 'pin.gp2',
          channelAction: 'activate',
          ...defaultParametersForDeviceChannelAction('activate')
        }
      ],
      text: null,
      notificationLevel: null,
      notificationTitle: null,
      notificationBody: null,
      notificationTitleMaxChars: null,
      notificationBodyMaxChars: null,
      notificationThrottleSeconds: null,
      notificationSound: null,
      webhookMethod: null,
      webhookUrl: null,
      webhookHeaders: null,
      webhookBody: null,
      webhookBodyMaxChars: null,
      soundFilePath: null,
      soundVolumePercent: null,
      soundMaxDurationMs: null,
      soundThrottleSeconds: null,
      displayDeviceId: '',
      displayTemplateId: null,
      displayAccent: null,
      displayIcon: null,
      displayLinesTemplate: null,
      displayStatus: null,
      displayTitleTemplate: null,
      displayMessageTemplate: null,
      displayTitleMaxChars: null,
      displayMessageMaxChars: null,
      displayExpireBehavior: null
    };
  }

  if (type === 'display') {
    const displayTemplateId = displayTemplateForInternalEvent(internalEvent);
    return {
      type: 'display',
      durationMs: null,
      channelActions: [],
      text: null,
      notificationLevel: null,
      notificationTitle: null,
      notificationBody: null,
      notificationTitleMaxChars: null,
      notificationBodyMaxChars: null,
      notificationThrottleSeconds: null,
      notificationSound: null,
      webhookMethod: null,
      webhookUrl: null,
      webhookHeaders: null,
      webhookBody: null,
      webhookBodyMaxChars: null,
      soundFilePath: null,
      soundVolumePercent: null,
      soundMaxDurationMs: null,
      soundThrottleSeconds: null,
      displayDeviceId: '',
      displayTemplateId,
      displayAccent: displayStatusForTemplate(displayTemplateId),
      displayIcon: displayIconForTemplate(displayTemplateId),
      displayLinesTemplate: defaultLinesForDisplayTemplate(displayTemplateId),
      displayStatus: displayStatusForTemplate(displayTemplateId),
      displayTitleTemplate: '{{display.title}}',
      displayMessageTemplate: '{{display.lines}}',
      displayTitleMaxChars: 39,
      displayMessageMaxChars: 95,
      displayExpireBehavior: 'restore-status'
    };
  }

  if (type === 'system-notification') {
    const template = systemNotificationTemplateForInternalEvent(internalEvent);

    return {
      type: 'system-notification',
      durationMs: null,
      channelActions: [],
      text: null,
      notificationLevel: 'info',
      notificationTitle: template.title,
      notificationBody: template.body,
      notificationTitleMaxChars: 80,
      notificationBodyMaxChars: 300,
      notificationThrottleSeconds: 30,
      notificationSound: 'default',
      webhookMethod: null,
      webhookUrl: null,
      webhookHeaders: null,
      webhookBody: null,
      webhookBodyMaxChars: null,
      soundFilePath: null,
      soundVolumePercent: null,
      soundMaxDurationMs: null,
      soundThrottleSeconds: null,
      displayDeviceId: null,
      displayTemplateId: null,
      displayAccent: null,
      displayIcon: null,
      displayLinesTemplate: null,
      displayStatus: null,
      displayTitleTemplate: null,
      displayMessageTemplate: null,
      displayTitleMaxChars: null,
      displayMessageMaxChars: null,
      displayExpireBehavior: null
    };
  }

  if (type === 'webhook') {
    return {
      type: 'webhook',
      durationMs: null,
      channelActions: [],
      text: null,
      notificationLevel: null,
      notificationTitle: null,
      notificationBody: null,
      notificationTitleMaxChars: null,
      notificationBodyMaxChars: null,
      notificationThrottleSeconds: null,
      notificationSound: null,
      webhookMethod: 'POST',
      webhookUrl: '',
      webhookHeaders: '{\n  "Content-Type": "application/json"\n}',
      webhookBody:
        '{\n  "source": {{source}},\n  "event": {{event}},\n  "internalEvent": {{internalEvent}},\n  "timestamp": {{timestamp}},\n  "model": {{model}},\n  "summary": {{last_assistant_message}},\n  "prompt": {{prompt}},\n  "toolResponse": {{tool_response}}\n}',
      webhookBodyMaxChars: 8000,
      soundFilePath: null,
      soundVolumePercent: null,
      soundMaxDurationMs: null,
      soundThrottleSeconds: null,
      displayDeviceId: null,
      displayTemplateId: null,
      displayAccent: null,
      displayIcon: null,
      displayLinesTemplate: null,
      displayStatus: null,
      displayTitleTemplate: null,
      displayMessageTemplate: null,
      displayTitleMaxChars: null,
      displayMessageMaxChars: null,
      displayExpireBehavior: null
    };
  }

  if (type === 'sound') {
    return {
      type: 'sound',
      durationMs: null,
      channelActions: [],
      text: null,
      notificationLevel: null,
      notificationTitle: null,
      notificationBody: null,
      notificationTitleMaxChars: null,
      notificationBodyMaxChars: null,
      notificationThrottleSeconds: null,
      notificationSound: null,
      webhookMethod: null,
      webhookUrl: null,
      webhookHeaders: null,
      webhookBody: null,
      webhookBodyMaxChars: null,
      soundFilePath: '',
      soundVolumePercent: 80,
      soundMaxDurationMs: 3000,
      soundThrottleSeconds: 30,
      displayDeviceId: null,
      displayTemplateId: null,
      displayAccent: null,
      displayIcon: null,
      displayLinesTemplate: null,
      displayStatus: null,
      displayTitleTemplate: null,
      displayMessageTemplate: null,
      displayTitleMaxChars: null,
      displayMessageMaxChars: null,
      displayExpireBehavior: null
    };
  }

  if (type === 'desktop-notice') {
    return {
      type: 'desktop-notice',
      durationMs: null,
      channelActions: [],
      text: null,
      notificationLevel: null,
      notificationTitle: null,
      notificationBody: null,
      notificationTitleMaxChars: null,
      notificationBodyMaxChars: null,
      notificationThrottleSeconds: null,
      notificationSound: null,
      webhookMethod: null,
      webhookUrl: null,
      webhookHeaders: null,
      webhookBody: null,
      webhookBodyMaxChars: null,
      soundFilePath: null,
      soundVolumePercent: null,
      soundMaxDurationMs: null,
      soundThrottleSeconds: null,
      displayDeviceId: null,
      displayTemplateId: null,
      displayAccent: null,
      displayIcon: null,
      displayLinesTemplate: null,
      displayStatus: null,
      displayTitleTemplate: null,
      displayMessageTemplate: null,
      displayTitleMaxChars: null,
      displayMessageMaxChars: null,
      displayExpireBehavior: null,
      desktopNoticeTargets: []
    };
  }

  return {
    type,
    durationMs: null,
    channelActions: [],
    text: null,
    notificationLevel: null,
    notificationTitle: null,
    notificationBody: null,
    notificationTitleMaxChars: null,
    notificationBodyMaxChars: null,
    notificationThrottleSeconds: null,
    notificationSound: null,
    webhookMethod: null,
    webhookUrl: null,
    webhookHeaders: null,
    webhookBody: null,
    webhookBodyMaxChars: null,
    soundFilePath: null,
    soundVolumePercent: null,
    soundMaxDurationMs: null,
    soundThrottleSeconds: null,
    displayDeviceId: null,
    displayTemplateId: null,
    displayAccent: null,
    displayIcon: null,
    displayLinesTemplate: null,
    displayStatus: null,
    displayTitleTemplate: null,
    displayMessageTemplate: null,
    displayTitleMaxChars: null,
    displayMessageMaxChars: null,
    displayExpireBehavior: null
  };
}

function displayTemplateForInternalEvent(internalEvent?: string): DisplayTemplateId {
  switch (internalEvent) {
    case 'agent.started':
      return 'task-started';
    case 'agent.running':
      return 'task-running';
    case 'agent.completed':
      return 'task-success';
    case 'agent.failed':
      return 'task-error';
    case 'agent.waiting_input':
      return 'waiting-input';
    default:
      return 'notice';
  }
}
