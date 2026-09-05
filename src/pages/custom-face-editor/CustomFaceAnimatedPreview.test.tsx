import { act, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { CustomFaceAnimatedPreview } from './CustomFaceAnimatedPreview';

vi.mock('@/i18n', () => ({
  useI18n: () => (key: string) => key,
}));

vi.mock('./CustomFacePixelPreview', () => ({
  CustomFacePixelPreview: ({
    packedPixels,
  }: {
    packedPixels: ArrayLike<number>;
  }) => <div data-testid="preview-frame">{Array.from(packedPixels).join(',')}</div>,
}));

describe('CustomFaceAnimatedPreview', () => {
  test('cycles through frames instead of staying on the first frame', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 16) as unknown as number
      )
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn((handle: number) => clearTimeout(handle)));
    const frames = [
      { durationMs: 100, packedPixels: [1, 0, 0, 0] },
      { durationMs: 100, packedPixels: [2, 0, 0, 0] },
    ];

    render(
      <CustomFaceAnimatedPreview
        width={2}
        height={2}
        frames={frames}
        ariaLabel="自定义表情预览"
      />
    );

    expect(screen.getByTestId('preview-frame')).toHaveTextContent('1,0,0,0');

    await act(async () => {
      vi.advanceTimersByTime(140);
    });

    expect(screen.getByTestId('preview-frame')).toHaveTextContent('2,0,0,0');
    vi.useRealTimers();
  });
});
