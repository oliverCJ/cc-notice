import { describe, expect, test } from 'vitest';
import { summarizeNoticeCommand } from './noticeCommand';

describe('summarizeNoticeCommand', () => {
  test('returns undefined when command is missing', () => {
    expect(summarizeNoticeCommand(undefined)).toBeUndefined();
  });

  test('joins command fields and skips empty nullable fields', () => {
    expect(
      summarizeNoticeCommand({
        commandType: 'ShowText',
        text: 'Device channel output queued'
      })
    ).toBe('ShowText Device channel output queued');
  });
});
