export type DisplayTemplateId =
  | 'notice'
  | 'task-started'
  | 'task-running'
  | 'task-success'
  | 'task-warning'
  | 'task-error'
  | 'waiting-input';

export type DisplayAccent = 'notice' | 'working' | 'success' | 'warning' | 'error';
export type DisplayIcon = 'info' | 'spinner' | 'check' | 'warning' | 'error' | 'input';
export type DisplaySizeClass = 'compact' | 'small' | 'medium' | 'large';

export type DisplayTemplateContext = {
  source: string;
  internalEvent: string;
  lastAssistantMessage: string;
};

export type DisplayTemplateDefinition = {
  id: DisplayTemplateId;
  accent: DisplayAccent;
  icon: DisplayIcon;
  title: string;
  lines: Array<(context: DisplayTemplateContext) => string>;
};

export type DisplayTemplateModel = {
  templateId: DisplayTemplateId;
  accent: DisplayAccent;
  icon: DisplayIcon;
  title: string;
  lines: string[];
};

export const DISPLAY_TEMPLATE_IDS: DisplayTemplateId[] = [
  'notice',
  'task-started',
  'task-running',
  'task-success',
  'task-warning',
  'task-error',
  'waiting-input'
];

const templates: Record<DisplayTemplateId, DisplayTemplateDefinition> = {
  notice: {
    id: 'notice',
    accent: 'notice',
    icon: 'info',
    title: 'Notice',
    lines: [(context) => safeLine(context.source), () => 'Status updated']
  },
  'task-started': {
    id: 'task-started',
    accent: 'working',
    icon: 'spinner',
    title: 'Working',
    lines: [(context) => safeLine(context.source), () => 'Started']
  },
  'task-running': {
    id: 'task-running',
    accent: 'working',
    icon: 'spinner',
    title: 'Working',
    lines: [(context) => safeLine(context.source), () => 'Running']
  },
  'task-success': {
    id: 'task-success',
    accent: 'success',
    icon: 'check',
    title: 'Task Done',
    lines: [(context) => safeLine(context.source), () => 'Finished']
  },
  'task-warning': {
    id: 'task-warning',
    accent: 'warning',
    icon: 'warning',
    title: 'Attention',
    lines: [(context) => safeLine(context.source), () => 'Check status']
  },
  'task-error': {
    id: 'task-error',
    accent: 'error',
    icon: 'error',
    title: 'Task Failed',
    lines: [(context) => safeLine(context.source), () => 'Check details']
  },
  'waiting-input': {
    id: 'waiting-input',
    accent: 'warning',
    icon: 'input',
    title: 'Input Needed',
    lines: [(context) => safeLine(context.source), () => 'Waiting for you']
  }
};

export function displayStatusForTemplate(templateId: string): DisplayAccent {
  const template = displayTemplateById(templateId);
  return template?.accent ?? 'notice';
}

export function displayIconForTemplate(templateId: string): DisplayIcon {
  const template = displayTemplateById(templateId);
  return template?.icon ?? 'info';
}

export function defaultLinesForDisplayTemplate(
  templateId: string,
  sizeClass: DisplaySizeClass = 'small'
): string[] {
  if (sizeClass === 'compact') {
    return [compactLineForDisplayTemplate(templateId)];
  }
  const template = displayTemplateById(templateId) ?? templates.notice;
  return template.lines.map((line) =>
    line({
      source: '{{source}}',
      internalEvent: '{{internalEvent}}',
      lastAssistantMessage: '{{last_assistant_message}}'
    })
  );
}

function compactLineForDisplayTemplate(templateId: string): string {
  switch (templateId) {
    case 'task-started':
      return 'Started';
    case 'task-running':
      return 'Running';
    case 'task-success':
      return 'Done';
    case 'task-warning':
      return 'Check';
    case 'task-error':
      return 'Error';
    case 'waiting-input':
      return 'Input';
    default:
      return 'Updated';
  }
}

export function displayTemplateById(
  id: string | null | undefined
): DisplayTemplateDefinition | null {
  if (!id || !DISPLAY_TEMPLATE_IDS.includes(id as DisplayTemplateId)) {
    return null;
  }
  return templates[id as DisplayTemplateId];
}

export function buildDisplayTemplateModel(
  templateId: string | null | undefined,
  context: DisplayTemplateContext
): DisplayTemplateModel {
  const template = displayTemplateById(templateId) ?? templates.notice;
  return {
    templateId: template.id,
    accent: template.accent,
    icon: template.icon,
    title: template.title,
    lines: template.lines.map((line) => trimLine(line(context))).filter(Boolean).slice(0, 3)
  };
}

function safeLine(value: string): string {
  return trimLine(value) || 'CC Notice';
}

function trimLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 24);
}
