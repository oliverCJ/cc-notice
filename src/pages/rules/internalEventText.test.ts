import { describe, expect, test } from 'vitest';
import { createTranslator } from '@/i18n';
import {
  internalEventDescription,
  internalEventScenario,
  internalEventTitle
} from './internalEventText';

const backendChineseEvent = {
  id: 'agent.started',
  title: 'AI 开始工作',
  description: '用户提交 prompt 后，AI 开始处理任务。',
  scenario: '用户提交提示',
  builtIn: true
};

describe('internalEventText', () => {
  test('uses localized catalog text instead of backend Chinese metadata', () => {
    const t = createTranslator('en-US');

    expect(internalEventTitle(backendChineseEvent, t)).toBe('AI Started');
    expect(internalEventDescription(backendChineseEvent, t)).toBe(
      'The AI has started thinking and processing after the user submitted a prompt.'
    );
    expect(internalEventScenario(backendChineseEvent, t)).toBe(
      'Session start or user prompt submission'
    );
  });

  test('falls back to backend metadata for unknown extension events', () => {
    const t = createTranslator('en-US');
    const extensionEvent = {
      id: 'extension.custom',
      title: '自定义事件',
      description: '自定义说明',
      scenario: '自定义场景',
      builtIn: false
    };

    expect(internalEventTitle(extensionEvent, t)).toBe('自定义事件');
    expect(internalEventDescription(extensionEvent, t)).toBe('自定义说明');
    expect(internalEventScenario(extensionEvent, t)).toBe('自定义场景');
  });

  test('uses custom user-defined event metadata directly', () => {
    const t = createTranslator('en-US');
    const customEvent = {
      id: 'review.started.userDefined',
      title: '评审开始',
      description: '代码评审流程开始',
      scenario: '用户提交 review 请求',
      builtIn: false
    };

    expect(internalEventTitle(customEvent, t)).toBe('评审开始');
    expect(internalEventDescription(customEvent, t)).toBe('代码评审流程开始');
    expect(internalEventScenario(customEvent, t)).toBe('用户提交 review 请求');
  });
});
