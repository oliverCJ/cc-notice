import { describe, expect, test } from 'vitest';
import { validateAsciiDisplayTemplate } from './displayTemplateValidation';

describe('displayTemplateValidation', () => {
  test('allows printable ASCII and template variable tokens', () => {
    expect(validateAsciiDisplayTemplate('{{source}} / Finished')).toBeNull();
    expect(validateAsciiDisplayTemplate('{{display.title}} / {{display.lines}}')).toBeNull();
    expect(validateAsciiDisplayTemplate('Task Done')).toBeNull();
  });

  test('rejects non ASCII text', () => {
    expect(validateAsciiDisplayTemplate('任务完成')).toBe('rules.display.validationAsciiOnly');
  });

  test('rejects unknown template variables', () => {
    expect(validateAsciiDisplayTemplate('{{unknown_token}}')).toBe('rules.display.validationUnknownVariable');
    expect(validateAsciiDisplayTemplate('{{display.unknown}}')).toBe('rules.display.validationUnknownVariable');
    expect(validateAsciiDisplayTemplate('{{unknown-token}}')).toBe('rules.display.validationUnknownVariable');
    expect(validateAsciiDisplayTemplate('{{ source }}')).toBe('rules.display.validationUnknownVariable');
    expect(validateAsciiDisplayTemplate('{{source')).toBe('rules.display.validationUnknownVariable');
  });
});
