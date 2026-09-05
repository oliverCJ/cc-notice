import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { CustomFaceImageVectorizerWindow } from './CustomFaceImageVectorizerWindow';

const prepareSourceMock = vi.hoisted(() => vi.fn());
const vectorizeSourceMock = vi.hoisted(() => vi.fn());
const releaseSourceMock = vi.hoisted(() => vi.fn());
const writeTempSvgMock = vi.hoisted(() => vi.fn());
const emitOpenSvgPathMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const closeVectorizerMock = vi.hoisted(() => vi.fn());
const focusEditorMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const emitMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const listenMock = vi.hoisted(() => vi.fn());
const windowApiMock = vi.hoisted(() => ({
  onCloseRequested: vi.fn(),
  unlisten: vi.fn(),
}));

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    prepareCustomFaceImageVectorizerSource: prepareSourceMock,
    vectorizeCustomFaceImageVectorizerSource: vectorizeSourceMock,
    releaseCustomFaceImageVectorizerSource: releaseSourceMock,
    writeCustomFaceVectorizedSvgTempFile: writeTempSvgMock,
    emitCustomFaceOpenSvgPathEvent: emitOpenSvgPathMock,
    closeCustomFaceImageVectorizer: closeVectorizerMock,
    focusCustomFaceEditor: focusEditorMock,
  };
});

vi.mock('@tauri-apps/api/event', () => ({
  emit: emitMock,
  listen: listenMock,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onCloseRequested: windowApiMock.onCloseRequested }),
}));

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  prepareSourceMock.mockReset();
  vectorizeSourceMock.mockReset();
  releaseSourceMock.mockReset().mockResolvedValue(undefined);
  writeTempSvgMock.mockReset();
  emitOpenSvgPathMock.mockReset().mockResolvedValue(true);
  closeVectorizerMock.mockReset();
  focusEditorMock.mockReset().mockResolvedValue(undefined);
  emitMock.mockReset().mockResolvedValue(undefined);
  listenMock.mockReset().mockImplementation(async () => windowApiMock.unlisten);
  windowApiMock.onCloseRequested.mockReset().mockImplementation(async (handler) => {
    void handler;
    return windowApiMock.unlisten;
  });
  windowApiMock.unlisten.mockReset();
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn(() => true),
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function () {
      const element = this as HTMLElement;
      if (element.dataset.testid === 'custom-face-vectorizer-source-thumb') {
        return {
          x: 12,
          y: 12,
          left: 12,
          top: 12,
          right: 108,
          bottom: 108,
          width: 96,
          height: 96,
          toJSON: () => undefined,
        } as DOMRect;
      }
      if (element.dataset.testid === 'custom-face-vectorizer-preview-object') {
        return {
          x: 156,
          y: 116,
          left: 156,
          top: 116,
          right: 164,
          bottom: 124,
          width: 8,
          height: 8,
          toJSON: () => undefined,
        } as DOMRect;
      }
      if (element.querySelector?.('[data-testid="custom-face-vectorizer-preview"]')) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 320,
          bottom: 240,
          width: 320,
          height: 240,
          toJSON: () => undefined,
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => undefined,
      } as DOMRect;
    },
  });
  window.history.replaceState({}, '', '/custom-face-image-vectorizer');
});

test('prepares a source image, vectorizes it and can send the svg back to the editor', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  vectorizeSourceMock.mockResolvedValue({
    svg: '<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>',
    width: 8,
    height: 8,
  });
  writeTempSvgMock.mockResolvedValue({ path: '/tmp/vectorized.svg' });

  render(<CustomFaceImageVectorizerWindow />);

  const input = screen.getByTestId('custom-face-vectorizer-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => expect(prepareSourceMock).toHaveBeenCalledOnce());
  await waitFor(() => expect(vectorizeSourceMock).toHaveBeenCalledOnce());
  expect(screen.getByTestId('custom-face-vectorizer-preview')).toHaveAttribute(
    'srcdoc',
    expect.stringContaining('<svg')
  );

  fireEvent.click(screen.getByRole('button', { name: '发送到 SVG 导入窗口' }));

  await waitFor(() => expect(writeTempSvgMock).toHaveBeenCalledOnce());
  expect(writeTempSvgMock).toHaveBeenCalledWith(
    '<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>'
  );
  expect(emitOpenSvgPathMock).toHaveBeenCalledWith('/tmp/vectorized.svg');
  expect(focusEditorMock).toHaveBeenCalledOnce();
});

test('keeps the preview dominant and exposes fine adjustment controls', () => {
  render(<CustomFaceImageVectorizerWindow />);

  expect(screen.getByTestId('custom-face-vectorizer-layout')).toHaveClass(
    'lg:grid-cols-[minmax(0,8fr)_minmax(360px,2fr)]'
  );
  expect(screen.getByRole('slider', { name: '噪点过滤' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '噪点过滤数值' })).toBeInTheDocument();
  expect(screen.getByRole('slider', { name: '路径精度' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '路径精度数值' })).toBeInTheDocument();
});

test('uses the same compact slider plus numeric input style as the image import window', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  vectorizeSourceMock.mockResolvedValue({
    svg: '<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>',
    width: 8,
    height: 8,
  });

  render(<CustomFaceImageVectorizerWindow />);

  expect(screen.getByLabelText('缩放')).toBeInTheDocument();
  expect(screen.getByLabelText('旋转')).toBeInTheDocument();
  expect(screen.getByLabelText('亮度')).toBeInTheDocument();
  expect(screen.getByLabelText('对比度')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '反色' })).toBeInTheDocument();
  expect(screen.queryByText('1.00x')).not.toBeInTheDocument();
  expect(screen.getByLabelText('减少缩放')).toBeInTheDocument();
  expect(screen.getByLabelText('增加缩放')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '缩放数值' })).toHaveValue('1.00x');
  expect(screen.getAllByRole('button', { name: '重置' }).length).toBeGreaterThan(0);
});

test('renders vector mode choices from the active language', () => {
  render(
    <I18nProvider language="en-US">
      <CustomFaceImageVectorizerWindow />
    </I18nProvider>
  );

  expect(screen.getByRole('button', { name: 'Binary' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Color' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '二值' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '多色' })).not.toBeInTheDocument();
});

test('shows a custom tooltip and lets the source thumbnail move inside the preview area', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  vectorizeSourceMock.mockResolvedValue({
    svg: '<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>',
    width: 8,
    height: 8,
  });

  render(<CustomFaceImageVectorizerWindow />);

  const input = screen.getByTestId('custom-face-vectorizer-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() =>
    expect(screen.getByTestId('custom-face-vectorizer-source-thumb')).toBeInTheDocument()
  );

  fireEvent.mouseEnter(
    screen.getByRole('button', { name: '在进入矢量化前放大或缩小源图。' })
  );
  expect(screen.getByRole('tooltip')).toHaveTextContent('在进入矢量化前放大或缩小源图。');

  const thumb = screen.getByTestId('custom-face-vectorizer-source-thumb');
  expect(thumb).toHaveStyle({ transform: 'translate(12px, 12px)' });
  fireEvent.pointerDown(thumb, { clientX: 20, clientY: 20, pointerId: 1 });
  fireEvent.pointerMove(thumb, { clientX: 60, clientY: 52, pointerId: 1 });
  fireEvent.pointerUp(thumb, { clientX: 60, clientY: 52, pointerId: 1 });
  expect(thumb).toHaveStyle({ transform: 'translate(52px, 44px)' });
});

test('expands the existing source thumbnail on hover instead of opening a second floating preview', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  vectorizeSourceMock.mockResolvedValue({
    svg: '<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>',
    width: 8,
    height: 8,
  });

  render(<CustomFaceImageVectorizerWindow />);

  const input = screen.getByTestId('custom-face-vectorizer-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() =>
    expect(screen.getByTestId('custom-face-vectorizer-source-thumb')).toBeInTheDocument()
  );

  fireEvent.mouseEnter(screen.getByTestId('custom-face-vectorizer-source-thumb'));

  expect(screen.queryByTestId('custom-face-vectorizer-source-hover')).not.toBeInTheDocument();
  expect(screen.getByTestId('custom-face-vectorizer-source-thumb')).toHaveStyle({
    width: '192px',
    height: '192px',
  });
});

test('lets the converted svg preview move locally without re-vectorizing', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  vectorizeSourceMock.mockResolvedValue({
    svg: '<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>',
    width: 8,
    height: 8,
  });

  render(<CustomFaceImageVectorizerWindow />);

  const input = screen.getByTestId('custom-face-vectorizer-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(vectorizeSourceMock).toHaveBeenCalledOnce());

  const dragLayer = screen.getByTestId('custom-face-vectorizer-output-drag-layer');
  const previewObject = screen.getByTestId('custom-face-vectorizer-preview-object');
  expect(previewObject).toHaveStyle({
    transform: 'translate(calc(-50% + 0px), calc(-50% + 0px))',
  });
  fireEvent.pointerDown(dragLayer, { clientX: 100, clientY: 80, pointerId: 1 });
  fireEvent.pointerMove(dragLayer, { clientX: 112, clientY: 65, pointerId: 1 });
  fireEvent.pointerUp(dragLayer, { clientX: 112, clientY: 65, pointerId: 1 });

  expect(previewObject).toHaveStyle({
    transform: 'translate(calc(-50% + 12px), calc(-50% + -15px))',
  });
  expect(screen.queryByRole('textbox', { name: '水平位移数值' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: '垂直位移数值' })).not.toBeInTheDocument();
  expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalled();
  expect(vectorizeSourceMock).toHaveBeenCalledOnce();

  fireEvent.pointerDown(dragLayer, { clientX: 100, clientY: 80, pointerId: 2 });
  fireEvent.pointerMove(dragLayer, { clientX: 900, clientY: 800, pointerId: 2 });
  fireEvent.pointerUp(dragLayer, { clientX: 900, clientY: 800, pointerId: 2 });

  expect(previewObject).toHaveStyle({
    transform: 'translate(calc(-50% + 156px), calc(-50% + 116px))',
  });
  expect(vectorizeSourceMock).toHaveBeenCalledOnce();
});

test('provides typed numeric inputs for slider parameters and clamps them only after blur', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  vectorizeSourceMock.mockResolvedValue({
    svg: '<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>',
    width: 8,
    height: 8,
  });

  render(<CustomFaceImageVectorizerWindow />);

  const input = screen.getByTestId('custom-face-vectorizer-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => expect(vectorizeSourceMock).toHaveBeenCalledOnce());

  const scaleInput = screen.getByRole('textbox', { name: '缩放数值' });
  fireEvent.change(scaleInput, { target: { value: '9' } });
  expect(scaleInput).toHaveValue('9');
  fireEvent.blur(scaleInput);
  expect(scaleInput).toHaveValue('4.00x');
});

test('passes preprocessing parameters through to the vectorizer request', async () => {
  prepareSourceMock.mockResolvedValue({
    sourceId: 'source-1',
    sourceWidth: 8,
    sourceHeight: 8,
    workingWidth: 8,
    workingHeight: 8,
  });
  vectorizeSourceMock.mockResolvedValue({
    svg: '<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>',
    width: 8,
    height: 8,
  });

  render(<CustomFaceImageVectorizerWindow />);

  const input = screen.getByTestId('custom-face-vectorizer-input') as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], 'sample.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });

  await waitFor(() => expect(vectorizeSourceMock).toHaveBeenCalledOnce());

  fireEvent.change(screen.getByRole('slider', { name: '缩放' }), { target: { value: '1.5' } });
  fireEvent.change(screen.getByRole('slider', { name: '旋转' }), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '反色' }));
  fireEvent.change(screen.getByRole('slider', { name: '亮度' }), { target: { value: '9' } });
  fireEvent.change(screen.getByRole('slider', { name: '对比度' }), { target: { value: '-11' } });

  await waitFor(() => expect(vectorizeSourceMock).toHaveBeenCalledTimes(2));
  expect(vectorizeSourceMock).toHaveBeenLastCalledWith({
    sourceId: 'source-1',
    options: expect.objectContaining({
      scale: 1.5,
      rotationDeg: 12,
      invert: true,
      brightness: 9,
      contrast: -11,
    }),
  });
});
