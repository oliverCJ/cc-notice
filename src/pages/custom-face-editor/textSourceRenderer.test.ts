import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defaultTextPixelizerOptions } from './textPixelizerOptions';
import { renderTextPixelizerSource } from './textSourceRenderer';

describe('text source renderer', () => {
  beforeEach(() => {
    const context = {
      clearRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
      font: '',
      fillStyle: '',
      textAlign: 'left',
      textBaseline: 'top'
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLCanvasElement;
      if (tagName === 'canvas') {
        Object.defineProperty(element, 'getContext', { configurable: true, value: vi.fn(() => context) });
        Object.defineProperty(element, 'toBlob', {
          configurable: true,
          value: (callback: BlobCallback) => callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
        });
      }
      return element;
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:text-source'),
      revokeObjectURL: vi.fn()
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('does not render empty text', async () => {
    await expect(renderTextPixelizerSource({ width: 128, height: 32 }, defaultTextPixelizerOptions())).resolves.toBeNull();
  });

  test('renders explicit multi-line text into transparent png bytes', async () => {
    const result = await renderTextPixelizerSource(
      { width: 128, height: 32 },
      { ...defaultTextPixelizerOptions(), text: 'Hi\n通知', fontSize: 12, wrap: false }
    );

    expect(result).toEqual({
      bytes: [1, 2, 3],
      previewUrl: 'blob:text-source',
      width: expect.any(Number),
      height: expect.any(Number),
      lineCount: 2
    });
    expect(result?.width).toBeGreaterThan(0);
    expect(result?.height).toBeGreaterThan(0);
  });

  test('renders text source on a stable working canvas size for small fonts', async () => {
    const result = await renderTextPixelizerSource(
      { width: 128, height: 32 },
      { ...defaultTextPixelizerOptions(), text: '小字', fontSize: 8, wrap: false }
    );

    expect(result?.width).toBe(512);
    expect(result?.height).toBe(128);
  });

  test('wraps long text when wrapping is enabled', async () => {
    const result = await renderTextPixelizerSource(
      { width: 4, height: 32 },
      { ...defaultTextPixelizerOptions(), text: 'abcdefghij', fontSize: 12, wrap: true, padding: 0 }
    );

    expect(result?.lineCount).toBeGreaterThan(1);
  });

  test('draws text character by character when letter spacing is enabled', async () => {
    const fillText = vi.fn();
    const measureText = vi.fn((text: string) => ({ width: text.length * 10 }));
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLCanvasElement;
      if (tagName === 'canvas') {
        Object.defineProperty(element, 'getContext', {
          configurable: true,
          value: vi.fn(() => ({
            clearRect: vi.fn(),
            fillText,
            measureText,
            font: '',
            fillStyle: '',
            textAlign: 'left',
            textBaseline: 'top'
          }))
        });
        Object.defineProperty(element, 'toBlob', {
          configurable: true,
          value: (callback: BlobCallback) => callback(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }))
        });
      }
      return element;
    });

    await renderTextPixelizerSource(
      { width: 128, height: 32 },
      { ...defaultTextPixelizerOptions(), text: 'AB', fontSize: 10, letterSpacingEm: 0.5, wrap: false }
    );

    expect(fillText).toHaveBeenCalledTimes(2);
    expect(fillText.mock.calls[0][0]).toBe('A');
    expect(fillText.mock.calls[1][0]).toBe('B');
    expect(fillText.mock.calls[1][1] - fillText.mock.calls[0][1]).toBe(30);
  });
});
