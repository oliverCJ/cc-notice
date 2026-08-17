import { describe, expect, test } from 'vitest';
import { createTranslator } from '@/i18n';
import { formatRuntimeOutputType, runtimeOutputLabelKey } from './runtimeOutputLabels';

describe('runtime output labels', () => {
  test('uses friendly labels for known output types', () => {
    const t = createTranslator('zh-CN');

    expect(runtimeOutputLabelKey('desktop-notice')).toBe('monitor.outputTypes.desktopNotice');
    expect(formatRuntimeOutputType('desktop-notice', t)).toBe('桌面提示');
    expect(formatRuntimeOutputType('system-notification', t)).toBe('系统通知');
  });

  test('keeps unknown output type readable', () => {
    const t = createTranslator('zh-CN');

    expect(runtimeOutputLabelKey('custom-output')).toBeUndefined();
    expect(formatRuntimeOutputType('custom-output', t)).toBe('custom-output');
  });
});
