import { describe, expect, test } from 'vitest';
import { createTranslator } from '@/i18n';
import {
  hookEventDescription,
  hookEventScenario,
  hookEventSearchText,
  hookEventTitle
} from './hookEventText';

const backendChineseHookEvent = {
  source: 'codex' as const,
  event: 'UserPromptSubmit',
  title: '用户提交提示',
  description: '用户向 Codex 提交新提示时触发。',
  scenario: '用于提示新一轮 AI 工作即将开始。',
  defaultSelected: true,
  mappedNoticeEvent: 'agent.started'
};

describe('hookEventText', () => {
  test('uses localized hook event text instead of backend Chinese metadata', () => {
    const t = createTranslator('en-US');

    expect(hookEventTitle(backendChineseHookEvent, t)).toBe('User Prompt Submitted');
    expect(hookEventDescription(backendChineseHookEvent, t)).toBe(
      'Triggered when the user submits a new prompt to Codex.'
    );
    expect(hookEventScenario(backendChineseHookEvent, t)).toBe(
      'Use it to indicate that a new AI work cycle is about to begin.'
    );
  });

  test('builds localized search text while preserving event id search', () => {
    const t = createTranslator('en-US');

    expect(hookEventSearchText(backendChineseHookEvent, t)).toContain('user prompt submitted');
    expect(hookEventSearchText(backendChineseHookEvent, t)).toContain('userpromptsubmit');
    expect(hookEventSearchText(backendChineseHookEvent, t)).not.toContain('用户提交提示');
  });

  test('falls back to backend metadata for unknown extension events', () => {
    const t = createTranslator('en-US');
    const extensionEvent = {
      source: 'codex' as const,
      event: 'CustomHook',
      title: '自定义 Hook',
      description: '自定义说明',
      scenario: '自定义场景',
      defaultSelected: false,
      mappedNoticeEvent: 'agent.working'
    };

    expect(hookEventTitle(extensionEvent, t)).toBe('自定义 Hook');
    expect(hookEventDescription(extensionEvent, t)).toBe('自定义说明');
    expect(hookEventScenario(extensionEvent, t)).toBe('自定义场景');
  });
});
