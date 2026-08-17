import { describe, expect, test } from 'vitest';
import { navItems } from './appStore';

describe('navItems', () => {
  test('keeps the established main navigation order', () => {
    expect(navItems.map((item) => item.id)).toEqual([
      'setup',
      'hook-settings',
      'rules',
      'monitor',
      'diagnostics',
      'devices',
      'firmware',
      'settings',
      'debug'
    ]);
  });
});
