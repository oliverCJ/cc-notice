import type { Translator } from '@/i18n';

const runtimeOutputLabelKeys: Record<string, string> = {
  'system-notification': 'monitor.outputTypes.systemNotification',
  webhook: 'monitor.outputTypes.webhook',
  sound: 'monitor.outputTypes.sound',
  'device-channel': 'monitor.outputTypes.deviceChannel',
  display: 'monitor.outputTypes.display',
  buzzer: 'monitor.outputTypes.buzzer',
  'desktop-notice': 'monitor.outputTypes.desktopNotice'
};

export function runtimeOutputLabelKey(outputType: string): string | undefined {
  return runtimeOutputLabelKeys[outputType];
}

export function formatRuntimeOutputType(outputType: string, t: Translator): string {
  const labelKey = runtimeOutputLabelKey(outputType);

  return labelKey ? t(labelKey) : outputType;
}
