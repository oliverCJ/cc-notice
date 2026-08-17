export type CustomInternalEventPrefixValidationReason =
  | 'empty'
  | 'tooShort'
  | 'tooLong'
  | 'invalidChars'
  | 'edgeDot'
  | 'doubleDot'
  | 'duplicateSuffix';

export type CustomInternalEventPrefixValidation =
  | { valid: true }
  | { valid: false; reason: CustomInternalEventPrefixValidationReason };

const CUSTOM_INTERNAL_EVENT_SUFFIX = '.userDefined';
const CUSTOM_INTERNAL_EVENT_PREFIX_MIN_LENGTH = 3;
const CUSTOM_INTERNAL_EVENT_PREFIX_MAX_LENGTH = 32;
const CUSTOM_INTERNAL_EVENT_PREFIX_PATTERN = /^[A-Za-z0-9.]+$/;

export function normalizeCustomInternalEventPrefix(value: string) {
  return value.trim();
}

export function buildCustomInternalEventId(prefix: string) {
  return `${normalizeCustomInternalEventPrefix(prefix)}${CUSTOM_INTERNAL_EVENT_SUFFIX}`;
}

export function validateCustomInternalEventPrefix(
  value: string
): CustomInternalEventPrefixValidation {
  const prefix = normalizeCustomInternalEventPrefix(value);
  if (!prefix) {
    return { valid: false, reason: 'empty' };
  }
  if (prefix.endsWith(CUSTOM_INTERNAL_EVENT_SUFFIX)) {
    return { valid: false, reason: 'duplicateSuffix' };
  }
  if (prefix.length < CUSTOM_INTERNAL_EVENT_PREFIX_MIN_LENGTH) {
    return { valid: false, reason: 'tooShort' };
  }
  if (prefix.length > CUSTOM_INTERNAL_EVENT_PREFIX_MAX_LENGTH) {
    return { valid: false, reason: 'tooLong' };
  }
  if (prefix.startsWith('.') || prefix.endsWith('.')) {
    return { valid: false, reason: 'edgeDot' };
  }
  if (prefix.includes('..')) {
    return { valid: false, reason: 'doubleDot' };
  }
  if (!CUSTOM_INTERNAL_EVENT_PREFIX_PATTERN.test(prefix)) {
    return { valid: false, reason: 'invalidChars' };
  }
  return { valid: true };
}
