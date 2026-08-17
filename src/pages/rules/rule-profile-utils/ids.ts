import { HardwareOutputType } from '../../../api/tauriApi';

export function buildAiMappingId(source: string, event: string, internalEvent: string) {
  return `${slug(source)}-${slug(event)}-${slug(internalEvent)}`;
}

export function buildHardwareRuleId(
  internalEvent: string,
  outputType: HardwareOutputType = 'system-notification'
) {
  return `${slug(internalEvent)}-${slug(outputType)}-output`;
}

export function dedupeRuleId(existingIds: string[], baseId: string) {
  if (!existingIds.includes(baseId)) {
    return baseId;
  }
  let index = 2;
  while (existingIds.includes(`${baseId}-${index}`)) {
    index += 1;
  }
  return `${baseId}-${index}`;
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
