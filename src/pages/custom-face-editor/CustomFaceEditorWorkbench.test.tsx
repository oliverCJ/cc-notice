import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { createEditorState } from '@/domain/customFaces/editor/reducer';
import { CustomFaceEditorWorkbench } from './CustomFaceEditorWorkbench';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), imageSmoothingEnabled: false, fillStyle: '', strokeStyle: '', lineWidth: 1 } as unknown as CanvasRenderingContext2D);
});

test('opens the toolbar by default and clears selection when another tool is chosen', () => {
  const state = createEditorState({ schemaVersion: 1, groupId: 'g', name: 'G', displayProfileId: 'custom-mono-128x32-v1', revision: 1, defaultFaceId: 'f', faces: [{ faceId: 'f', name: 'F', color: { red: 255, green: 255, blue: 255 }, frames: [{ durationMs: 200, packedPixels: Array(512).fill(0) }] }] }, { id: 'custom-mono-128x32-v1', width: 128, height: 32, maxFrames: 10, framebufferBytes: 512 });
  render(<CustomFaceEditorWorkbench initialState={state} expectedLibraryHash="hash" onBack={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByText('选区')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '框选' }));
  fireEvent.click(screen.getByRole('button', { name: '画笔' }));
  expect(screen.queryByText(/选区：/)).not.toBeInTheDocument();
});
