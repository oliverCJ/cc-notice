import { describe, expect, test } from 'vitest';
import {
  DISPLAY_TEMPLATE_IDS,
  buildDisplayTemplateModel,
  displayTemplateById
} from './displayTemplates';

describe('displayTemplates', () => {
  test('builds a compact task success model from template variables', () => {
    const model = buildDisplayTemplateModel('task-success', {
      source: 'Codex',
      internalEvent: 'agent.completed',
      lastAssistantMessage: '完成主要修改'
    });

    expect(model).toEqual({
      templateId: 'task-success',
      accent: 'success',
      icon: 'check',
      title: 'Task Done',
      lines: ['Codex', 'Finished']
    });
  });

  test('returns fallback template when id is unknown', () => {
    const model = buildDisplayTemplateModel('unknown-template', {
      source: 'Claude',
      internalEvent: 'agent.started',
      lastAssistantMessage: ''
    });

    expect(model.templateId).toBe('notice');
    expect(model.accent).toBe('notice');
    expect(model.title).toBe('Notice');
  });

  test('exports stable template ids for rule forms', () => {
    expect(DISPLAY_TEMPLATE_IDS).toEqual([
      'notice',
      'task-started',
      'task-running',
      'task-success',
      'task-warning',
      'task-error',
      'waiting-input'
    ]);
    expect(displayTemplateById('task-error')?.accent).toBe('error');
  });

  test('builds a running scene with working status copy', () => {
    const model = buildDisplayTemplateModel('task-running', {
      source: 'Codex',
      internalEvent: 'agent.working',
      lastAssistantMessage: ''
    });

    expect(model).toEqual({
      templateId: 'task-running',
      accent: 'working',
      icon: 'spinner',
      title: 'Working',
      lines: ['Codex', 'Running']
    });
  });
});
