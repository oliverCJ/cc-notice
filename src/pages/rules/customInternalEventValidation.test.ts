import { describe, expect, it } from 'vitest';
import {
  buildCustomInternalEventId,
  normalizeCustomInternalEventPrefix,
  validateCustomInternalEventPrefix
} from './customInternalEventValidation';

describe('customInternalEventValidation', () => {
  it('builds final id with userDefined suffix', () => {
    expect(normalizeCustomInternalEventPrefix(' review.started ')).toBe('review.started');
    expect(buildCustomInternalEventId('review.started')).toBe('review.started.userDefined');
  });

  it('rejects invalid prefixes with stable reasons', () => {
    expect(validateCustomInternalEventPrefix('ab')).toEqual({
      valid: false,
      reason: 'tooShort'
    });
    expect(validateCustomInternalEventPrefix('.review')).toEqual({
      valid: false,
      reason: 'edgeDot'
    });
    expect(validateCustomInternalEventPrefix('review..started')).toEqual({
      valid: false,
      reason: 'doubleDot'
    });
    expect(validateCustomInternalEventPrefix('review-started')).toEqual({
      valid: false,
      reason: 'invalidChars'
    });
    expect(validateCustomInternalEventPrefix('review.started.userDefined')).toEqual({
      valid: false,
      reason: 'duplicateSuffix'
    });
  });

  it('accepts agent started custom prefix', () => {
    expect(validateCustomInternalEventPrefix('agent.started')).toEqual({ valid: true });
  });
});
