import { Translator } from '@/i18n';

export type TemplateVariable = {
  token: string;
  labelKey: string;
  descriptionKey: string;
  exampleKey?: string;
  common: boolean;
  source: 'context' | 'summary' | 'large-summary';
  requiresDebug: boolean;
};

export type TemplatePreviewValues = Record<string, string>;

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  {
    token: '{{internalEvent}}',
    labelKey: 'rules.variables.internalEvent.label',
    descriptionKey: 'rules.variables.internalEvent.description',
    common: true,
    source: 'context',
    requiresDebug: false
  },
  {
    token: '{{model}}',
    labelKey: 'rules.variables.model.label',
    descriptionKey: 'rules.variables.model.description',
    common: true,
    source: 'summary',
    requiresDebug: false
  },
  {
    token: '{{last_assistant_message}}',
    labelKey: 'rules.variables.lastAssistantMessage.label',
    descriptionKey: 'rules.variables.lastAssistantMessage.description',
    exampleKey: 'rules.variables.lastAssistantMessage.example',
    common: true,
    source: 'large-summary',
    requiresDebug: false
  },
  {
    token: '{{prompt}}',
    labelKey: 'rules.variables.prompt.label',
    descriptionKey: 'rules.variables.prompt.description',
    exampleKey: 'rules.variables.prompt.example',
    common: true,
    source: 'large-summary',
    requiresDebug: false
  },
  {
    token: '{{tool_response}}',
    labelKey: 'rules.variables.toolResponse.label',
    descriptionKey: 'rules.variables.toolResponse.description',
    exampleKey: 'rules.variables.toolResponse.example',
    common: true,
    source: 'large-summary',
    requiresDebug: false
  },
  {
    token: '{{pwd}}',
    labelKey: 'rules.variables.pwd.label',
    descriptionKey: 'rules.variables.pwd.description',
    common: true,
    source: 'summary',
    requiresDebug: false
  },
  {
    token: '{{sessionId}}',
    labelKey: 'rules.variables.sessionId.label',
    descriptionKey: 'rules.variables.sessionId.description',
    common: true,
    source: 'summary',
    requiresDebug: false
  },
  {
    token: '{{permissionMode}}',
    labelKey: 'rules.variables.permissionMode.label',
    descriptionKey: 'rules.variables.permissionMode.description',
    common: true,
    source: 'summary',
    requiresDebug: false
  },
  {
    token: '{{source}}',
    labelKey: 'rules.variables.source.label',
    descriptionKey: 'rules.variables.source.description',
    common: false,
    source: 'context',
    requiresDebug: false
  },
  {
    token: '{{event}}',
    labelKey: 'rules.variables.event.label',
    descriptionKey: 'rules.variables.event.description',
    common: false,
    source: 'context',
    requiresDebug: false
  },
  {
    token: '{{timestamp}}',
    labelKey: 'rules.variables.timestamp.label',
    descriptionKey: 'rules.variables.timestamp.description',
    common: false,
    source: 'context',
    requiresDebug: false
  },
  {
    token: '{{tool_name}}',
    labelKey: 'rules.variables.toolName.label',
    descriptionKey: 'rules.variables.toolName.description',
    common: false,
    source: 'summary',
    requiresDebug: false
  }
];

export const DEBUG_ONLY_PAYLOAD_FIELDS = [
  'tool_input',
  'compact_summary',
  'message',
  'error_details',
  'rawPayload'
] as const;

export function templateVariableSourceLabel(
  source: TemplateVariable['source'],
  t: Translator
): string {
  if (source === 'context') {
    return t('rules.variables.sources.context');
  }
  if (source === 'large-summary') {
    return t('rules.variables.sources.largeSummary');
  }
  return t('rules.variables.sources.summary');
}

export function createTemplatePreviewValues(t: Translator): TemplatePreviewValues {
  return {
    '{{source}}': 'codex',
    '{{event}}': 'Stop',
    '{{internalEvent}}': 'agent.completed',
    '{{timestamp}}': '2026-06-13T23:59:00+08:00',
    '{{tool_name}}': 'codex',
    '{{model}}': 'gpt-5.5',
    '{{last_assistant_message}}': t('rules.variables.lastAssistantMessage.example'),
    '{{prompt}}': t('rules.variables.prompt.example'),
    '{{tool_response}}': t('rules.variables.toolResponse.example'),
    '{{pwd}}': '/Users/oliver/working/project',
    '{{sessionId}}': 'session-20260616-001',
    '{{permissionMode}}': 'acceptEdits'
  };
}

export const TEMPLATE_PREVIEW_VALUES: TemplatePreviewValues = {
  '{{source}}': 'codex',
  '{{event}}': 'Stop',
  '{{internalEvent}}': 'agent.completed',
  '{{timestamp}}': '2026-06-13T23:59:00+08:00',
  '{{tool_name}}': 'codex',
  '{{model}}': 'gpt-5.5',
  '{{last_assistant_message}}': 'Task completed with validation.',
  '{{prompt}}': 'Review this change.',
  '{{tool_response}}': 'Command completed with exit code 0.',
  '{{pwd}}': '/Users/oliver/working/project',
  '{{sessionId}}': 'session-20260616-001',
  '{{permissionMode}}': 'acceptEdits'
};

export function insertTemplateToken(
  value: string,
  token: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined
) {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? start;
  const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;

  return {
    value: nextValue,
    cursorPosition: start + token.length
  };
}

export function renderTemplatePreview(template: string, values: TemplatePreviewValues): string {
  return Object.entries(values).reduce(
    (result, [token, value]) => result.split(token).join(value),
    template
  );
}
