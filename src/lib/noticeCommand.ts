export type NoticeCommandSummaryInput =
  | {
      commandType?: string;
      text?: string | null;
    }
  | undefined;

export function summarizeNoticeCommand(command: NoticeCommandSummaryInput) {
  if (!command) {
    return undefined;
  }

  return [command.commandType, command.text].filter(Boolean).join(' ');
}
