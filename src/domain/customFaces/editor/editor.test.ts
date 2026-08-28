import { describe, expect, test } from 'vitest';
import type { CustomFaceGroup } from '@/api/tauriApi';
import { createEditorState, editorReducer } from './reducer';
import type { EditorProfile } from './types';

const profile: EditorProfile = {
  id: 'custom-mono-128x32-v1', width: 128, height: 32, maxFrames: 10, framebufferBytes: 512
};
const face = (id = 'face-1', frames = [{ durationMs: 200, packedPixels: Array(512).fill(0) }]) => ({
  faceId: id, name: id, color: { red: 255, green: 255, blue: 255 }, frames
});
const group = (faces = [face()]): CustomFaceGroup => ({
  schemaVersion: 1, groupId: 'group-1', name: 'Group', displayProfileId: profile.id,
  revision: 1, defaultFaceId: faces[0]?.faceId ?? 'missing', faces
});

describe('custom face editor reducer', () => {
  test('selects first face and first frame, and exposes empty states', () => {
    const state = createEditorState(group(), profile);
    expect(state.mode).toBe('editing');
    expect(state.selectedFaceId).toBe('face-1');
    expect(state.selectedFrameIndex).toBe(0);
    expect(createEditorState(group([]), profile).mode).toBe('empty-group');
    expect(createEditorState(group([face('face-empty', [])]), profile).mode).toBe('empty-frame');
  });

  test('applies one pixel transaction as one undo step', () => {
    const initial = createEditorState(group(), profile);
    const next = editorReducer(initial, {
      type: 'apply-pixel-transaction',
      pixels: [{ x: 4, y: 2, active: true }]
    });
    expect(next.presentGroup.faces[0].frames[0].packedPixels[4] & (1 << 2)).toBe(1 << 2);
    expect(next.past).toHaveLength(1);
    expect(editorReducer(next, { type: 'undo' }).presentGroup.faces[0].frames[0].packedPixels[4] & (1 << 2)).toBe(0);
  });

  test('manages frames and protects deleting the last frame and default face', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'duplicate-frame', index: 0 });
    expect(state.presentGroup.faces[0].frames).toHaveLength(2);
    state = editorReducer(state, { type: 'delete-frame', index: 1 });
    expect(state.presentGroup.faces[0].frames).toHaveLength(1);
    state = editorReducer(state, { type: 'delete-frame', index: 0 });
    expect(state.presentGroup.faces[0].frames).toHaveLength(1);
    state = editorReducer(state, { type: 'delete-face', faceId: 'face-1' });
    expect(state.presentGroup.faces).toHaveLength(1);
  });

  test('adds, selects and normalizes frame duration', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'add-frame' });
    expect(state.presentGroup.faces[0].frames).toHaveLength(2);
    expect(state.selectedFrameIndex).toBe(1);
    state = editorReducer(state, { type: 'set-frame-duration', index: 1, durationMs: 99 });
    expect(state.presentGroup.faces[0].frames[1].durationMs).toBe(120);
    state = editorReducer(state, { type: 'select-frame', index: 0 });
    expect(state.selectedFrameIndex).toBe(0);
  });

  test('copies and clears a selected region', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'apply-pixel-transaction', pixels: [{ x: 2, y: 2, active: true }] });
    state = editorReducer(state, { type: 'set-selection', selection: { x: 1, y: 1, width: 3, height: 3 } });
    state = editorReducer(state, { type: 'copy-selection' });
    expect(state.clipboard?.pixels.some(Boolean)).toBe(true);
    state = editorReducer(state, { type: 'clear-selection' });
    expect(state.presentGroup.faces[0].frames[0].packedPixels[2] & (1 << 2)).toBe(0);
  });

  test('moves frames and updates selected frame duration', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'add-frame' });
    state = editorReducer(state, { type: 'set-selected-frame-duration', durationMs: 500 });
    expect(state.presentGroup.faces[0].frames[1].durationMs).toBe(500);
    state = editorReducer(state, { type: 'move-frame', from: 1, to: 0 });
    expect(state.selectedFrameIndex).toBe(0);
    expect(state.presentGroup.faces[0].frames[0].durationMs).toBe(500);
  });
});
