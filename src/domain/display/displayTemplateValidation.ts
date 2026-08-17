const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7E\r\n\t]*$/;
const TEMPLATE_TOKEN_PATTERN = /\{\{[^{}]+\}\}/g;

const ALLOWED_DISPLAY_TEMPLATE_TOKENS = new Set([
  '{{source}}',
  '{{event}}',
  '{{internalEvent}}',
  '{{timestamp}}',
  '{{tool_name}}',
  '{{model}}',
  '{{last_assistant_message}}',
  '{{prompt}}',
  '{{tool_response}}',
  '{{pwd}}',
  '{{sessionId}}',
  '{{permissionMode}}',
  '{{display.title}}',
  '{{display.lines}}'
]);

export type DisplayTemplateValidationKey =
  | 'rules.display.validationAsciiOnly'
  | 'rules.display.validationUnknownVariable';

export function validateAsciiDisplayTemplate(value: string): DisplayTemplateValidationKey | null {
  if (!PRINTABLE_ASCII_PATTERN.test(value)) {
    return 'rules.display.validationAsciiOnly';
  }

  const tokens = value.match(TEMPLATE_TOKEN_PATTERN) ?? [];
  const textWithoutTokens = value.replace(TEMPLATE_TOKEN_PATTERN, '');
  const hasMalformedTemplateToken =
    textWithoutTokens.includes('{{') || textWithoutTokens.includes('}}');
  return !hasMalformedTemplateToken && tokens.every((token) => ALLOWED_DISPLAY_TEMPLATE_TOKENS.has(token))
    ? null
    : 'rules.display.validationUnknownVariable';
}

export function isAsciiDisplayText(value: string): boolean {
  return PRINTABLE_ASCII_PATTERN.test(value);
}
