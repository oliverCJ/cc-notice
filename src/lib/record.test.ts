import { describe, expect, test } from 'vitest';
import { withoutRecordKey } from './record';

describe('withoutRecordKey', () => {
  test('returns a new record without mutating source', () => {
    const source = { a: 'one', b: 'two' };
    const next = withoutRecordKey(source, 'a');

    expect(next).toEqual({ b: 'two' });
    expect(source).toEqual({ a: 'one', b: 'two' });
    expect(next).not.toBe(source);
  });

  test('returns a cloned record when key does not exist', () => {
    const source = { a: 1 };
    const next = withoutRecordKey(source, 'missing');

    expect(next).toEqual({ a: 1 });
    expect(next).not.toBe(source);
  });
});
