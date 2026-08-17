import { describe, expect, test } from 'vitest';
import { createTranslator } from './index';
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';

describe('i18n dictionaries', () => {
  test('keeps zh-CN and en-US dictionary keys aligned', () => {
    expect(flattenKeys(enUS)).toEqual(flattenKeys(zhCN));
  });

  test('translates navigation labels by language', () => {
    expect(createTranslator('zh-CN')('nav.setup')).toBe('接入配置');
    expect(createTranslator('en-US')('nav.setup')).toBe('Setup');
  });

  test('translates output type labels instead of exposing keys', () => {
    expect(createTranslator('zh-CN')('rules.outputTypes.webhook')).toBe('Webhook');
    expect(createTranslator('en-US')('rules.outputTypes.webhook')).toBe('Webhook');
  });

  test('translates device health diagnostics labels', () => {
    expect(createTranslator('zh-CN')('diagnostics.deviceHealth.title')).toBe('设备健康检查');
    expect(createTranslator('en-US')('diagnostics.deviceHealth.title')).toBe('Device Health');
    expect(createTranslator('zh-CN')('diagnostics.deviceHealth.checks.connection')).toBe(
      '连接状态'
    );
    expect(createTranslator('zh-CN')('diagnostics.deviceHealth.issues.deviceConnecting')).toBe(
      '设备正在连接'
    );
  });
});

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key))
    .sort();
}
