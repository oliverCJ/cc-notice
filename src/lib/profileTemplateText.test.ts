import { describe, expect, test } from 'vitest';
import { createTranslator } from '@/i18n';
import { profileTemplateDescription, profileTemplateName } from './profileTemplateText';

const backendChineseTemplate = {
  id: 'basic' as const,
  name: '基础映射方案',
  description: '预设常用 AI Hook 到内部事件的映射和基础输出规则，不启用任何 Hook。',
  recommended: true
};

describe('profileTemplateText', () => {
  test('uses localized profile template text instead of backend metadata', () => {
    const t = createTranslator('en-US');

    expect(profileTemplateName(backendChineseTemplate, t)).toBe('Basic Mapping Profile');
    expect(profileTemplateDescription(backendChineseTemplate, t)).toBe(
      'Preset common AI Hook mappings and basic output rules without enabling any Hook event.'
    );
  });

  test('falls back to backend metadata for unknown template ids', () => {
    const t = createTranslator('en-US');
    const customTemplate = {
      id: 'custom-template',
      name: '自定义模板',
      description: '自定义说明',
      recommended: false
    };

    expect(profileTemplateName(customTemplate, t)).toBe('自定义模板');
    expect(profileTemplateDescription(customTemplate, t)).toBe('自定义说明');
  });
});
