import { describe, expect, test } from 'vitest';
import { getHardwareGuide, hardwareGuides } from './index';

describe('hardware guides', () => {
  test('covers all default hardware channel guide ids', () => {
    expect(Object.keys(hardwareGuides).sort()).toEqual([
      'addressable-led',
      'buzzer',
      'digital-output',
      'pwm-output'
    ]);
  });

  test('returns null for unknown guide id', () => {
    expect(getHardwareGuide('missing-guide')).toBeNull();
  });
});
