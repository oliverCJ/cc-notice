import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('desktop notice css animations', () => {
  test('keeps scan overlay visible at animation loop boundaries', () => {
    const css = readFileSync(join(process.cwd(), 'src/app.css'), 'utf8');

    expect(keyframeBlock(css, 'desktop-notice-scan-overlay')).not.toContain('opacity: 0;');
    expect(keyframeBlock(css, 'desktop-notice-scan-overlay-vertical')).not.toContain('opacity: 0;');
  });

  test('keeps desktop notice rule preview animations active under reduced motion settings', () => {
    const css = readFileSync(join(process.cwd(), 'src/app.css'), 'utf8');
    const reducedMotionBlock = mediaBlock(css, '@media (prefers-reduced-motion: reduce)');

    expect(reducedMotionBlock).not.toContain('desktop-notice-rule-preview-edge-breathing');
    expect(reducedMotionBlock).not.toContain('desktop-notice-rule-preview-breathing');
    expect(reducedMotionBlock).not.toContain('desktop-notice-rule-preview-scan');
  });

  test('keeps edge breathing endpoints fixed during the breathing loop', () => {
    const css = readFileSync(join(process.cwd(), 'src/app.css'), 'utf8');

    expect(keyframeBlock(css, 'desktop-notice-edge-breathing-horizontal')).not.toMatch(
      /scale[XY]\(/
    );
    expect(keyframeBlock(css, 'desktop-notice-edge-breathing-vertical')).not.toMatch(
      /scale[XY]\(/
    );
  });
});

function keyframeBlock(css: string, name: string) {
  const start = css.indexOf(`@keyframes ${name}`);
  if (start < 0) {
    throw new Error(`missing keyframes: ${name}`);
  }
  const next = css.indexOf('@keyframes ', start + 1);
  return css.slice(start, next < 0 ? undefined : next);
}

function mediaBlock(css: string, name: string) {
  const start = css.indexOf(name);
  if (start < 0) {
    return '';
  }
  const next = css.indexOf('@keyframes ', start + 1);
  return css.slice(start, next < 0 ? undefined : next);
}
