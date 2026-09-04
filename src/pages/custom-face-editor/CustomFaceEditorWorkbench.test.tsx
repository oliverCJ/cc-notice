import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createEditorState } from '@/domain/customFaces/editor/reducer';
import { CustomFaceEditorWorkbench } from './CustomFaceEditorWorkbench';
import { CUSTOM_FACE_OPEN_SVG_PATH_EVENT } from './customFaceVectorizerEvents';

const saveCustomFaceGroupMock = vi.hoisted(() => vi.fn());
const saveCustomFaceRecoveryMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const clearCustomFaceRecoveryMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const getCustomFaceGroupMock = vi.hoisted(() => vi.fn());
const closeCustomFaceEditorMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const previewCustomFaceItemImportMock = vi.hoisted(() => vi.fn());
const exportCustomFaceItemMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const exportCustomFaceGifMock = vi.hoisted(() => vi.fn().mockResolvedValue({ frameDelaysMs: [210], totalDurationMs: 210 }));
const openDialogMock = vi.hoisted(() => vi.fn());
const saveDialogMock = vi.hoisted(() => vi.fn());
const openCustomFaceImagePixelizerMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const readCustomFaceSvgMock = vi.hoisted(() => vi.fn());
const takeLatestVectorizedSvgTempFilePathMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const rasterizeSvgMock = vi.hoisted(() => vi.fn());
const listenMock = vi.hoisted(() => vi.fn());
const windowApiMock = vi.hoisted(() => ({
  closeRequestedHandler: null as null | ((event: { preventDefault: () => void }) => void | Promise<void>),
  closeRequestedHandlers: [] as Array<(event: { preventDefault: () => void }) => void | Promise<void>>,
  unlisten: vi.fn(),
  onCloseRequested: vi.fn()
}));

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    saveCustomFaceGroup: saveCustomFaceGroupMock,
    saveCustomFaceRecovery: saveCustomFaceRecoveryMock,
    clearCustomFaceRecovery: clearCustomFaceRecoveryMock,
    getCustomFaceGroup: getCustomFaceGroupMock,
    closeCustomFaceEditor: closeCustomFaceEditorMock,
    previewCustomFaceItemImport: previewCustomFaceItemImportMock,
    exportCustomFaceItem: exportCustomFaceItemMock,
    exportCustomFaceGif: exportCustomFaceGifMock,
    openCustomFaceImagePixelizer: openCustomFaceImagePixelizerMock,
    readCustomFaceSvg: readCustomFaceSvgMock,
    takeLatestVectorizedSvgTempFilePath: takeLatestVectorizedSvgTempFilePathMock
  };
});

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onCloseRequested: windowApiMock.onCloseRequested })
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock
}));

vi.mock('@/domain/customFaces/svg/svgRasterizer', () => ({
  rasterizeSvg: rasterizeSvgMock
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openDialogMock,
  save: saveDialogMock
}));

beforeEach(() => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  saveCustomFaceGroupMock.mockReset();
  saveCustomFaceRecoveryMock.mockClear();
  clearCustomFaceRecoveryMock.mockClear();
  getCustomFaceGroupMock.mockReset();
  closeCustomFaceEditorMock.mockClear();
  previewCustomFaceItemImportMock.mockReset();
  exportCustomFaceItemMock.mockClear();
  exportCustomFaceGifMock.mockClear();
  openDialogMock.mockReset();
  saveDialogMock.mockReset();
  openCustomFaceImagePixelizerMock.mockClear();
  readCustomFaceSvgMock.mockReset();
  takeLatestVectorizedSvgTempFilePathMock.mockReset().mockResolvedValue(null);
  rasterizeSvgMock.mockReset().mockResolvedValue({
    pixels: new Uint8Array([1, ...Array(511).fill(0)]),
    activePixelCount: 1,
    clipped: false
  });
  listenMock.mockReset();
  windowApiMock.closeRequestedHandler = null;
  windowApiMock.closeRequestedHandlers = [];
  windowApiMock.unlisten.mockClear();
  windowApiMock.onCloseRequested.mockImplementation(async (handler) => {
    windowApiMock.closeRequestedHandler = handler;
    windowApiMock.closeRequestedHandlers.push(handler);
    return windowApiMock.unlisten;
  });
  listenMock.mockImplementation(async (_event, handler) => {
    windowApiMock.unlisten.mockImplementation(() => {
      void handler;
    });
    return windowApiMock.unlisten;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', lineWidth: 1 } as unknown as CanvasRenderingContext2D);
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

test('opens the toolbar by default and clears selection when another tool is chosen', () => {
  const state = createEditorState({ schemaVersion: 1, groupId: 'g', name: 'G', displayProfileId: 'custom-mono-128x32-v1', revision: 1, defaultFaceId: 'f', faces: [{ faceId: 'f', name: 'F', color: { red: 255, green: 255, blue: 255 }, frames: [{ durationMs: 200, packedPixels: Array(512).fill(0) }] }] }, { id: 'custom-mono-128x32-v1', width: 128, height: 32, maxFrames: 10, framebufferBytes: 512 });
  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByText('选区')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '框选' }));
  fireEvent.click(screen.getByRole('button', { name: '画笔' }));
  expect(screen.queryByText(/选区：/)).not.toBeInTheDocument();
});

test('rotates a selected region from the workbench controls', async () => {
  const state = createState();
  state.presentGroup.faces[0].frames[0].packedPixels[2] = 1 << 1;
  state.selection = { x: 1, y: 1, width: 2, height: 2 };
  state.selectionPivot = { x: 2, y: 2 };
  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: '设置旋转轴' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '顺时针旋转 90°' }));
  expect(screen.getByRole('button', { name: '确认旋转' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '确认移动' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '确认旋转' }));
  expect(screen.queryByRole('button', { name: '确认旋转' })).not.toBeInTheDocument();
});

test('separates move, rotation, and selection actions', async () => {
  const state = createState();
  state.selection = { x: 1, y: 1, width: 2, height: 2 };
  state.selectionPivot = { x: 2, y: 2 };
  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByRole('region', { name: '移动' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '旋转' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: '选区操作' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '向右移动选区' }));
  expect(screen.getByRole('button', { name: '确认移动' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '取消移动' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '顺时针旋转 90°' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '取消选择' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '取消移动' }));
  await waitFor(() => expect(screen.getByText('选区：1,1 · 2 × 2')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: '取消选择' })).toBeEnabled();
});

test('adds and manages faces inside the current group', () => {
  const state = createEditorState({ schemaVersion: 1, groupId: 'g', name: 'G', displayProfileId: 'custom-mono-128x32-v1', revision: 1, defaultFaceId: 'f', faces: [{ faceId: 'f', name: 'Face', color: { red: 255, green: 255, blue: 255 }, frames: [{ durationMs: 200, packedPixels: Array(512).fill(0) }] }] }, { id: 'custom-mono-128x32-v1', width: 128, height: 32, maxFrames: 10, framebufferBytes: 512 });
  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '新表情' }));
  expect(screen.getByText('新表情')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '表情名称' })).toHaveValue('新表情');
  expect(screen.getByRole('button', { name: '复制表情' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '设为默认表情' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '删除表情' })).toBeEnabled();
});

test('opens the image import window from the workbench toolbar', () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '导入图片' }));

  expect(openCustomFaceImagePixelizerMock).toHaveBeenCalledOnce();
  expect(openCustomFaceImagePixelizerMock).toHaveBeenCalledWith({ width: 128, height: 32 });
});

test('shows a prominent banner while the image import window is open', async () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let imagePixelizerStateListener: ((event: { payload: boolean }) => void) | undefined;
  await waitFor(() => {
    imagePixelizerStateListener = listenMock.mock.calls.find((call) => call[0] === 'cc-notice://custom-face-image-pixelizer-state-changed')?.[1] as ((event: { payload: boolean }) => void) | undefined;
    expect(imagePixelizerStateListener).toBeDefined();
  });

  await act(async () => {
    imagePixelizerStateListener?.({ payload: true });
  });

  expect(screen.getByText('图片导入窗口已打开，请先关闭它再退出编辑器。')).toBeInTheDocument();
});

test('allows closing the editor after the image import window reports closed', async () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let imagePixelizerStateListener: ((event: { payload: boolean }) => void) | undefined;
  await waitFor(() => {
    imagePixelizerStateListener = listenMock.mock.calls.find((call) => call[0] === 'cc-notice://custom-face-image-pixelizer-state-changed')?.[1] as ((event: { payload: boolean }) => void) | undefined;
    expect(imagePixelizerStateListener).toBeDefined();
  });

  await act(async () => {
    imagePixelizerStateListener?.({ payload: true });
  });
  await act(async () => {
    imagePixelizerStateListener?.({ payload: false });
  });
  windowApiMock.closeRequestedHandler?.({ preventDefault: vi.fn() });

  await waitFor(() => expect(closeCustomFaceEditorMock).toHaveBeenCalledOnce());
  expect(screen.queryByText('图片导入窗口已打开，请先关闭它再退出编辑器。')).not.toBeInTheDocument();
});

test('blocks editor close while the image vectorizer window is open', async () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let vectorizerStateListener: ((event: { payload: boolean }) => void) | undefined;
  await waitFor(() => {
    vectorizerStateListener = listenMock.mock.calls.find((call) => call[0] === 'cc-notice://custom-face-image-vectorizer-state-changed')?.[1] as ((event: { payload: boolean }) => void) | undefined;
    expect(vectorizerStateListener).toBeDefined();
  });

  await act(async () => {
    vectorizerStateListener?.({ payload: true });
  });
  await act(async () => {
    await windowApiMock.closeRequestedHandler?.({ preventDefault: vi.fn() });
  });

  expect(closeCustomFaceEditorMock).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getAllByText('图片转 SVG 窗口已打开，请先关闭它再退出编辑器。').length).toBeGreaterThan(0));
});

test('shows the image vectorizer close warning in the same top banner area as image import', async () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let vectorizerStateListener: ((event: { payload: boolean }) => void) | undefined;
  await waitFor(() => {
    vectorizerStateListener = listenMock.mock.calls.find((call) => call[0] === 'cc-notice://custom-face-image-vectorizer-state-changed')?.[1] as ((event: { payload: boolean }) => void) | undefined;
    expect(vectorizerStateListener).toBeDefined();
  });

  await act(async () => {
    vectorizerStateListener?.({ payload: true });
  });

  const banners = screen.getAllByRole('status');
  expect(banners[0]).toHaveTextContent('图片转 SVG 窗口已打开，请先关闭它再退出编辑器。');
  expect(banners[0]).toHaveClass('border-b');
});

test('opens the svg import dialog after receiving a vectorized svg path', async () => {
  readCustomFaceSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>');

  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let svgPathListener: ((event: { payload: string }) => void) | undefined;
  await waitFor(() => {
    svgPathListener = listenMock.mock.calls.find((call) => call[0] === CUSTOM_FACE_OPEN_SVG_PATH_EVENT)?.[1] as ((event: { payload: string }) => void) | undefined;
    expect(svgPathListener).toBeDefined();
  });

  await act(async () => {
    svgPathListener?.({ payload: '/tmp/vectorized.svg' });
  });

  await waitFor(() => expect(readCustomFaceSvgMock).toHaveBeenCalledWith('/tmp/vectorized.svg'));
  expect(screen.getByRole('dialog', { name: '导入 SVG' })).toBeInTheDocument();
});

test('pulls a pending vectorized svg path when the editor regains focus', async () => {
  takeLatestVectorizedSvgTempFilePathMock.mockResolvedValue('/tmp/vectorized.svg');
  readCustomFaceSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>');

  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  await waitFor(() => expect(takeLatestVectorizedSvgTempFilePathMock).toHaveBeenCalled());
  await waitFor(() => expect(readCustomFaceSvgMock).toHaveBeenCalledWith('/tmp/vectorized.svg'));
  expect(screen.getByRole('dialog', { name: '导入 SVG' })).toBeInTheDocument();
});

test('lets a vectorized svg become a movable pending canvas object after applying it', async () => {
  readCustomFaceSvgMock.mockResolvedValue('<svg viewBox="0 0 8 8"><rect width="8" height="8" /></svg>');

  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let svgPathListener: ((event: { payload: string }) => void) | undefined;
  await waitFor(() => {
    svgPathListener = listenMock.mock.calls.find((call) => call[0] === CUSTOM_FACE_OPEN_SVG_PATH_EVENT)?.[1] as ((event: { payload: string }) => void) | undefined;
    expect(svgPathListener).toBeDefined();
  });

  await act(async () => {
    svgPathListener?.({ payload: '/tmp/vectorized.svg' });
  });
  await waitFor(() => expect(screen.getByRole('button', { name: '应用到当前帧' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '应用到当前帧' }));

  const pendingImport = screen.getByLabelText('待确认导入对象');
  const pendingPreview = screen.getByTestId('custom-face-pending-import-preview');
  expect(pendingPreview).toHaveStyle({ width: '1px', height: '1px', transform: 'translate(0px, 0px)' });

  fireEvent.pointerDown(pendingImport, { clientX: 20, clientY: 20, pointerId: 1 });
  fireEvent.pointerMove(pendingImport, { clientX: 24, clientY: 23, pointerId: 1 });
  fireEvent.pointerUp(pendingImport, { clientX: 24, clientY: 23, pointerId: 1 });

  await waitFor(() => expect(pendingPreview).toHaveStyle({ transform: 'translate(4px, 3px)' }));
});

test('does not let a stale image import close handler block editor close', async () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let imagePixelizerStateListener: ((event: { payload: boolean }) => void) | undefined;
  await waitFor(() => {
    imagePixelizerStateListener = listenMock.mock.calls.find((call) => call[0] === 'cc-notice://custom-face-image-pixelizer-state-changed')?.[1] as ((event: { payload: boolean }) => void) | undefined;
    expect(imagePixelizerStateListener).toBeDefined();
  });

  await act(async () => {
    imagePixelizerStateListener?.({ payload: true });
  });
  const handlerRegisteredWhileOpen = windowApiMock.closeRequestedHandlers[windowApiMock.closeRequestedHandlers.length - 1];
  await act(async () => {
    imagePixelizerStateListener?.({ payload: false });
  });

  await act(async () => {
    await handlerRegisteredWhileOpen?.({ preventDefault: vi.fn() });
  });

  await waitFor(() => expect(closeCustomFaceEditorMock).toHaveBeenCalledOnce());
  expect(screen.queryByText('图片导入窗口已打开，请先关闭它再退出编辑器。')).not.toBeInTheDocument();
});

test('loads imported image pixels into the pending canvas workflow', async () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let imageImportListener: ((event: { payload: { packedPixels: number[]; sourceWidth: number; sourceHeight: number } }) => void) | undefined;
  await waitFor(() => {
    imageImportListener = listenMock.mock.calls.find((call) => call[0] === 'cc-notice://custom-face-image-import-ready')?.[1] as ((event: { payload: { packedPixels: number[]; sourceWidth: number; sourceHeight: number } }) => void) | undefined;
    expect(imageImportListener).toBeDefined();
  });

  await act(async () => {
    imageImportListener?.({
      payload: {
        packedPixels: [1, ...Array(511).fill(0)],
        sourceWidth: 128,
        sourceHeight: 32
      }
    });
  });

  expect(screen.getByText('素材待确认应用')).toBeInTheDocument();
});

test('rejects imported image pixels when payload size does not match the current profile', async () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  let imageImportListener: ((event: { payload: { packedPixels: number[]; sourceWidth: number; sourceHeight: number } }) => void) | undefined;
  await waitFor(() => {
    imageImportListener = listenMock.mock.calls.find((call) => call[0] === 'cc-notice://custom-face-image-import-ready')?.[1] as ((event: { payload: { packedPixels: number[]; sourceWidth: number; sourceHeight: number } }) => void) | undefined;
    expect(imageImportListener).toBeDefined();
  });

  await act(async () => {
    imageImportListener?.({
      payload: {
        packedPixels: [1, 0, 0, 0],
        sourceWidth: 8,
        sourceHeight: 8
      }
    });
  });

  expect(screen.queryByText('素材待确认应用')).not.toBeInTheDocument();
  expect(screen.getByText('图片导入结果尺寸与当前画布不一致，请重新导入。')).toBeInTheDocument();
});

test('imports a compatible face into the reducer draft without saving the group', async () => {
  previewCustomFaceItemImportMock.mockResolvedValue({
    face: { faceId: 'source', name: 'Imported', color: { red: 1, green: 2, blue: 3 }, frames: [{ durationMs: 200, packedPixels: Array(512).fill(0) }] },
    displayProfileId: 'custom-mono-128x32-v1', width: 128, height: 32, frameCount: 1,
    totalDurationMs: 200, contentHash: 'a'.repeat(64), sourceFaceId: 'source'
  });
  openDialogMock.mockResolvedValue('/tmp/face.ccfaceitem');
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '导入单个表情' }));
  expect(await screen.findByRole('dialog', { name: '导入单个表情' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '导入为新表情' }));

  expect(screen.getByRole('textbox', { name: '表情名称' })).toHaveValue('Imported');
  expect(screen.getByText('有未保存修改')).toBeInTheDocument();
  expect(saveCustomFaceGroupMock).not.toHaveBeenCalled();
});

test('blocks a mismatched face profile before opening import confirmation', async () => {
  previewCustomFaceItemImportMock.mockResolvedValue({
    face: { faceId: 'source', name: 'Imported', color: { red: 1, green: 2, blue: 3 }, frames: [{ durationMs: 200, packedPixels: Array(1024).fill(0) }] },
    displayProfileId: 'custom-mono-128x64-v1', width: 128, height: 64, frameCount: 1,
    totalDurationMs: 200, contentHash: 'a'.repeat(64), sourceFaceId: 'source'
  });
  openDialogMock.mockResolvedValue('/tmp/face.ccfaceitem');
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '导入单个表情' }));
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('导入失败：分辨率不一致');
  expect(alert).toHaveTextContent('128 × 64');
  expect(alert).toHaveTextContent('128 × 32');
  expect(alert).not.toHaveTextContent('不会缩放、裁切或转换');
  expect(screen.queryByRole('dialog', { name: '导入单个表情' })).not.toBeInTheDocument();
});

test('exports the current unsaved face snapshot without saving', async () => {
  saveDialogMock.mockResolvedValue('/tmp/face.gif');
  const state = createState();
  state.presentGroup.faces[0].frames[0].durationMs = 205;
  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: '导出 GIF' }));
  expect(screen.getByRole('dialog', { name: '导出 GIF' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: '导出倍率' }));
  fireEvent.click(screen.getByRole('option', { name: '2×' }));
  fireEvent.click(screen.getByRole('button', { name: '选择保存位置' }));
  await waitFor(() => expect(exportCustomFaceGifMock).toHaveBeenCalledOnce());
  expect(exportCustomFaceGifMock).toHaveBeenCalledWith(expect.objectContaining({ scale: 2, face: expect.objectContaining({ frames: [expect.objectContaining({ durationMs: 205 })] }) }));
  expect(saveCustomFaceGroupMock).not.toHaveBeenCalled();
  expect(screen.getByText(/GIF 使用 10ms 时间精度/)).toBeInTheDocument();
});

test('allows clearing frame duration input before committing a normalized value', () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  const input = screen.getByRole('spinbutton', { name: '帧时长' });
  expect(input).toHaveAttribute('min', '50');
  fireEvent.change(input, { target: { value: '' } });
  expect(input).toHaveValue(null);
  fireEvent.change(input, { target: { value: '49' } });
  fireEvent.blur(input);
  expect(input).toHaveValue(50);
  fireEvent.change(input, { target: { value: '450' } });
  expect(input).toHaveValue(450);
});

test('renames the group in the editor and stays clean after saving', async () => {
  const state = createEditorState({ schemaVersion: 1, groupId: 'g', name: '原组名', displayProfileId: 'custom-mono-128x32-v1', revision: 1, defaultFaceId: 'f', faces: [{ faceId: 'f', name: 'Face', color: { red: 255, green: 255, blue: 255 }, frames: [{ durationMs: 200, packedPixels: Array(512).fill(0) }] }] }, { id: 'custom-mono-128x32-v1', width: 128, height: 32, maxFrames: 10, framebufferBytes: 512 });
  const onBack = vi.fn();
  const onSaved = vi.fn();
  saveCustomFaceGroupMock.mockImplementation(async ({ group }) => ({
    group: { ...group, revision: 2 },
    libraryHash: 'next-hash'
  }));

  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="hash" onBack={onBack} onSaved={onSaved} />);
  fireEvent.change(screen.getByRole('textbox', { name: '组名称' }), { target: { value: '新的组名' } });
  fireEvent.click(screen.getByRole('button', { name: '应用组名称' }));

  expect(screen.getByText('有未保存修改')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '保存' }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
    group: expect.objectContaining({ name: '新的组名', revision: 2 }),
    libraryHash: 'next-hash'
  })));
  expect(onBack).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: '组名称' })).toHaveValue('新的组名');
  expect(screen.getByText('已保存')).toBeInTheDocument();
});

test('offers an explicit overwrite when the saved library hash conflicts', async () => {
  const state = createState();
  saveCustomFaceGroupMock
    .mockRejectedValueOnce(new Error('custom face group conflicts with current hash disk-hash'))
    .mockImplementationOnce(async ({ group }) => ({ group: { ...group, revision: 2 }, libraryHash: 'saved-hash', changed: true }));

  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="old-hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  renameGroup('本地修改');
  fireEvent.click(screen.getByRole('button', { name: '保存' }));

  expect(await screen.findByRole('alertdialog', { name: '检测到保存冲突' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '覆盖保存' }));

  await waitFor(() => expect(saveCustomFaceGroupMock).toHaveBeenCalledTimes(2));
  expect(saveCustomFaceGroupMock.mock.calls[1][0]).toEqual(expect.objectContaining({ expectedLibraryHash: 'disk-hash' }));
  expect(screen.getByText('已保存')).toBeInTheDocument();
});

test('reloads the disk group after a save conflict', async () => {
  const state = createState();
  const diskGroup = { ...state.presentGroup, name: '磁盘版本', revision: 4 };
  saveCustomFaceGroupMock.mockRejectedValue(new Error('custom face group conflicts with current hash disk-hash'));
  getCustomFaceGroupMock.mockResolvedValue(diskGroup);
  const onSaved = vi.fn();

  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="old-hash" onBack={vi.fn()} onSaved={onSaved} />);
  renameGroup('本地修改');
  fireEvent.click(screen.getByRole('button', { name: '保存' }));
  fireEvent.click(await screen.findByRole('button', { name: '重新加载磁盘版本' }));

  await waitFor(() => expect(screen.getByRole('textbox', { name: '组名称' })).toHaveValue('磁盘版本'));
  expect(onSaved).toHaveBeenCalledWith({ group: diskGroup, libraryHash: 'disk-hash', changed: false });
  expect(screen.getByText('已保存')).toBeInTheDocument();
});

test('prevents a dirty native window close and supports cancel or discard', async () => {
  render(<CustomFaceEditorWorkbench initialState={createState()} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  renameGroup('尚未保存');
  await waitFor(() => expect(windowApiMock.closeRequestedHandler).not.toBeNull());
  const preventDefault = vi.fn();

  await act(async () => { await windowApiMock.closeRequestedHandler?.({ preventDefault }); });
  expect(preventDefault).toHaveBeenCalled();
  expect(screen.getByRole('alertdialog', { name: '保存未完成的修改？' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(closeCustomFaceEditorMock).not.toHaveBeenCalled();

  await act(async () => { await windowApiMock.closeRequestedHandler?.({ preventDefault }); });
  fireEvent.click(screen.getByRole('button', { name: '丢弃修改' }));
  await waitFor(() => expect(closeCustomFaceEditorMock).toHaveBeenCalledOnce());
});

test('saves a dirty group before closing the native window', async () => {
  const state = createState();
  saveCustomFaceGroupMock.mockImplementation(async ({ group }) => ({ group: { ...group, revision: 2 }, libraryHash: 'saved-hash', changed: true }));

  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  renameGroup('保存后关闭');
  await waitFor(() => expect(windowApiMock.closeRequestedHandler).not.toBeNull());
  await act(async () => { await windowApiMock.closeRequestedHandler?.({ preventDefault: vi.fn() }); });
  fireEvent.click(screen.getByRole('button', { name: '保存并关闭' }));

  await waitFor(() => expect(saveCustomFaceGroupMock).toHaveBeenCalledOnce());
  expect(closeCustomFaceEditorMock).toHaveBeenCalledOnce();
});

function createState() {
  return createEditorState({ schemaVersion: 1, groupId: 'g', name: '原组名', displayProfileId: 'custom-mono-128x32-v1', revision: 1, defaultFaceId: 'f', faces: [{ faceId: 'f', name: 'Face', color: { red: 255, green: 255, blue: 255 }, frames: [{ durationMs: 200, packedPixels: Array(512).fill(0) }] }] }, { id: 'custom-mono-128x32-v1', width: 128, height: 32, maxFrames: 10, framebufferBytes: 512 });
}

function renameGroup(name: string) {
  fireEvent.change(screen.getByRole('textbox', { name: '组名称' }), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: '应用组名称' }));
}
