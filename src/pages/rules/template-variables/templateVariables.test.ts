import { describe, expect, test } from 'vitest';
import { createTranslator } from '@/i18n';
import {
  DEBUG_ONLY_PAYLOAD_FIELDS,
  insertTemplateToken,
  renderTemplatePreview,
  TEMPLATE_VARIABLES,
  TEMPLATE_PREVIEW_VALUES,
  templateVariableSourceLabel
} from './templateVariables';

describe('templateVariables', () => {
  test('inserts a token at cursor selection', () => {
    const result = insertTemplateToken('模型：', '{{model}}', 3, 3);

    expect(result).toEqual({
      value: '模型：{{model}}',
      cursorPosition: 12
    });
  });

  test('replaces known variables in preview and leaves unknown variables visible', () => {
    const preview = renderTemplatePreview(
      '{{source}} 使用 {{model}}：{{unknown}}',
      TEMPLATE_PREVIEW_VALUES
    );

    expect(preview).toBe('codex 使用 gpt-5.5：{{unknown}}');
  });

  test('exposes stable payload variables and excludes duplicate ai display name', () => {
    const tokens = TEMPLATE_VARIABLES.map((variable) => variable.token);

    expect(tokens).toEqual([
      '{{internalEvent}}',
      '{{model}}',
      '{{last_assistant_message}}',
      '{{prompt}}',
      '{{tool_response}}',
      '{{pwd}}',
      '{{sessionId}}',
      '{{permissionMode}}',
      '{{source}}',
      '{{event}}',
      '{{timestamp}}',
      '{{tool_name}}'
    ]);
    expect(tokens).toContain('{{prompt}}');
    expect(tokens).toContain('{{tool_response}}');
    expect(tokens).toContain('{{pwd}}');
    expect(tokens).toContain('{{sessionId}}');
    expect(tokens).toContain('{{permissionMode}}');
    expect(tokens).not.toContain('{{ai工具名称}}');
  });

  test('public variables do not require debug raw payload', () => {
    expect(TEMPLATE_VARIABLES.every((variable) => !variable.requiresDebug)).toBe(true);
    for (const debugOnlyField of DEBUG_ONLY_PAYLOAD_FIELDS) {
      expect(TEMPLATE_VARIABLES.map((variable) => variable.token)).not.toContain(
        `{{${debugOnlyField}}}`
      );
    }
  });

  test('labels variable source for helper display', () => {
    const t = createTranslator('zh-CN');

    expect(templateVariableSourceLabel('context', t)).toBe('上下文');
    expect(templateVariableSourceLabel('summary', t)).toBe('摘要');
    expect(templateVariableSourceLabel('large-summary', t)).toBe('摘要裁剪');
  });
});
