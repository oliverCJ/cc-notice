import { describe, expect, test } from 'vitest';
import { formatJsonText } from './debugPayloadFormat';

describe('debugPayloadFormat', () => {
  test('formats valid JSON with stable indentation', () => {
    expect(formatJsonText('{"captured":false,"meta":{"source":"debug-page"}}')).toBe(
      [
        '{',
        '  "captured": false,',
        '  "meta": {',
        '    "source": "debug-page"',
        '  }',
        '}'
      ].join('\n')
    );
  });

  test('keeps non JSON text unchanged', () => {
    expect(formatJsonText('not a json payload')).toBe('not a json payload');
  });
});
