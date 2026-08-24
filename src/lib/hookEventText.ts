import { Translator } from '@/i18n';

type HookEventTextSource = {
  source: string;
  event: string;
  title: string;
  description: string;
  scenario: string;
};

const HOOK_EVENT_KEY_BY_SOURCE_EVENT: Record<string, string> = {
  'codex/SessionStart': 'codex.sessionStart',
  'codex/SubagentStart': 'codex.subagentStart',
  'codex/PreToolUse': 'codex.preToolUse',
  'codex/PermissionRequest': 'codex.permissionRequest',
  'codex/PostToolUse': 'codex.postToolUse',
  'codex/PreCompact': 'codex.preCompact',
  'codex/PostCompact': 'codex.postCompact',
  'codex/UserPromptSubmit': 'codex.userPromptSubmit',
  'codex/SubagentStop': 'codex.subagentStop',
  'codex/Stop': 'codex.stop',
  'claude-code/SessionStart': 'claudeCode.sessionStart',
  'claude-code/UserPromptSubmit': 'claudeCode.userPromptSubmit',
  'claude-code/UserPromptExpansion': 'claudeCode.userPromptExpansion',
  'claude-code/PreToolUse': 'claudeCode.preToolUse',
  'claude-code/PostToolUse': 'claudeCode.postToolUse',
  'claude-code/PostToolUseFailure': 'claudeCode.postToolUseFailure',
  'claude-code/PostToolBatch': 'claudeCode.postToolBatch',
  'claude-code/Notification': 'claudeCode.notification',
  'claude-code/PermissionRequest': 'claudeCode.permissionRequest',
  'claude-code/Stop': 'claudeCode.stop',
  'claude-code/StopFailure': 'claudeCode.stopFailure',
  'claude-code/SubagentStart': 'claudeCode.subagentStart',
  'claude-code/SubagentStop': 'claudeCode.subagentStop',
  'claude-code/TaskCreated': 'claudeCode.taskCreated',
  'claude-code/TaskCompleted': 'claudeCode.taskCompleted',
  'claude-code/PreCompact': 'claudeCode.preCompact',
  'claude-code/PostCompact': 'claudeCode.postCompact',
  'claude-code/SessionEnd': 'claudeCode.sessionEnd',
  'claude-code/ConfigChange': 'claudeCode.configChange',
  'claude-code/CwdChanged': 'claudeCode.cwdChanged',
  'claude-code/FileChanged': 'claudeCode.fileChanged',
  'claude-code/PermissionDenied': 'claudeCode.permissionDenied',
  'claude-code/TeammateIdle': 'claudeCode.teammateIdle',
  'claude-code/WorktreeCreate': 'claudeCode.worktreeCreate',
  'claude-code/WorktreeRemove': 'claudeCode.worktreeRemove',
  'claude-code/MessageDisplay': 'claudeCode.messageDisplay',
  'claude-code/Elicitation': 'claudeCode.elicitation',
  'claude-code/ElicitationResult': 'claudeCode.elicitationResult'
};

export function hookEventTitle(event: HookEventTextSource, t: Translator) {
  return hookEventText(event, t, 'title', event.title);
}

export function hookEventDescription(event: HookEventTextSource, t: Translator) {
  return hookEventText(event, t, 'description', event.description);
}

export function hookEventScenario(event: HookEventTextSource, t: Translator) {
  return hookEventText(event, t, 'scenario', event.scenario);
}

export function hookEventSearchText(event: HookEventTextSource, t: Translator) {
  return [
    event.event,
    hookEventTitle(event, t),
    hookEventDescription(event, t),
    hookEventScenario(event, t)
  ]
    .join(' ')
    .toLowerCase();
}

function hookEventText(
  event: HookEventTextSource,
  t: Translator,
  field: 'title' | 'description' | 'scenario',
  fallback: string
) {
  const eventKey = HOOK_EVENT_KEY_BY_SOURCE_EVENT[`${event.source}/${event.event}`];
  if (!eventKey) {
    return fallback;
  }

  const translationKey = `hookEvents.${eventKey}.${field}`;
  const translated = t(translationKey);
  return translated === translationKey ? fallback : translated;
}
