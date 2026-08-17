import { afterEach, describe, expect, test } from 'vitest';
import { installDefaultContextMenuGuard } from './contextMenuGuard';

describe('contextMenuGuard', () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    document.body.innerHTML = '';
  });

  test('prevents the default browser context menu by default', () => {
    cleanup = installDefaultContextMenuGuard();
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    });

    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  test('allows native context menu inside an explicit escape hatch', () => {
    cleanup = installDefaultContextMenuGuard();
    const target = document.createElement('div');
    target.dataset.allowNativeContextMenu = 'true';
    document.body.appendChild(target);
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    });

    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
