import { describe, expect, test } from 'vitest';
import type { CustomFaceGroup } from '@/api/tauriApi';
import { createEditorState, editorReducer } from './reducer';
import type { EditorProfile } from './types';
import { getPixel } from './raster';

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
    state = editorReducer(state, { type: 'set-frame-duration', index: 1, durationMs: 49 });
    expect(state.presentGroup.faces[0].frames[1].durationMs).toBe(50);
    state = editorReducer(state, { type: 'set-frame-duration', index: 1, durationMs: 50 });
    expect(state.presentGroup.faces[0].frames[1].durationMs).toBe(50);
    state = editorReducer(state, { type: 'select-frame', index: 0 });
    expect(state.selectedFrameIndex).toBe(0);
  });

  test('appends a copy of the selected frame to the end', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'add-frame' });
    state = editorReducer(state, { type: 'select-frame', index: 0 });
    state = editorReducer(state, { type: 'add-frame' });
    expect(state.presentGroup.faces[0].frames).toHaveLength(3);
    expect(state.selectedFrameIndex).toBe(2);
  });

  test('appends a blank frame with default duration and empty pixels', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'apply-pixel-transaction', pixels: [{ x: 4, y: 2, active: true }] });
    const sourcePixels = [...state.presentGroup.faces[0].frames[0].packedPixels];
    state = editorReducer(state, { type: 'add-blank-frame' });
    const frames = state.presentGroup.faces[0].frames;
    expect(frames).toHaveLength(2);
    expect(frames[1]).toEqual({ durationMs: 200, packedPixels: Array(profile.framebufferBytes).fill(0) });
    expect(frames[0].packedPixels).toEqual(sourcePixels);
    expect(state.selectedFrameIndex).toBe(1);
    const undone = editorReducer(state, { type: 'undo' });
    expect(undone.presentGroup.faces[0].frames).toHaveLength(1);
    expect(editorReducer(undone, { type: 'redo' }).presentGroup.faces[0].frames).toHaveLength(2);
  });

  test('does not add a blank frame beyond the profile frame limit', () => {
    const limitedProfile = { ...profile, maxFrames: 1 };
    const state = createEditorState(group(), limitedProfile);
    const next = editorReducer(state, { type: 'add-blank-frame' });
    expect(next).toBe(state);
    expect(next.past).toHaveLength(0);
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

  test('moves a selected region by a step using a source snapshot', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'set-selection', selection: { x: 1, y: 1, width: 2, height: 2 } });
    state = editorReducer(state, { type: 'apply-pixel-transaction', pixels: [{ x: 1, y: 1, active: true }, { x: 2, y: 2, active: true }] });
    const moved = editorReducer(state, { type: 'move-selection', dx: 1, dy: 0 });
    const movedPixels = new Uint8Array(moved.presentGroup.faces[0].frames[0].packedPixels);
    expect(getPixel(movedPixels, profile, 1, 1)).toBe(false);
    expect(getPixel(movedPixels, profile, 2, 1)).toBe(true);
    expect(getPixel(movedPixels, profile, 3, 2)).toBe(true);
    expect(moved.selection).toEqual({ x: 2, y: 1, width: 2, height: 2 });
    expect(moved.selectionOrigin).toEqual({ x: 1, y: 1, width: 2, height: 2 });
    expect(moved.past).toHaveLength(state.past.length + 1);
  });

  test('moves only active pixels and preserves existing target pixels', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'apply-pixel-transaction', pixels: [
      { x: 1, y: 1, active: true },
      { x: 3, y: 1, active: true }
    ] });
    state = editorReducer(state, { type: 'set-selection', selection: { x: 1, y: 1, width: 2, height: 2 } });
    const moved = editorReducer(state, { type: 'move-selection', dx: 2, dy: 0 });
    const pixels = new Uint8Array(moved.presentGroup.faces[0].frames[0].packedPixels);
    expect(getPixel(pixels, profile, 1, 1)).toBe(false);
    expect(getPixel(pixels, profile, 3, 1)).toBe(true);
    expect(getPixel(pixels, profile, 4, 1)).toBe(false);
    expect(getPixel(pixels, profile, 2, 2)).toBe(false);
  });

  test('rebuilds repeated selection moves from the original active-pixel baseline', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'apply-pixel-transaction', pixels: [
      { x: 1, y: 1, active: true },
      { x: 4, y: 1, active: true }
    ] });
    state = editorReducer(state, { type: 'set-selection', selection: { x: 1, y: 1, width: 2, height: 2 } });
    state = editorReducer(state, { type: 'move-selection', dx: 1, dy: 0 });
    state = editorReducer(state, { type: 'move-selection', dx: 1, dy: 0 });
    const pixels = new Uint8Array(state.presentGroup.faces[0].frames[0].packedPixels);
    expect(getPixel(pixels, profile, 1, 1)).toBe(false);
    expect(getPixel(pixels, profile, 3, 1)).toBe(true);
    expect(getPixel(pixels, profile, 4, 1)).toBe(true);
  });

  test('cancel restores the original frame including pre-existing target pixels', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'apply-pixel-transaction', pixels: [
      { x: 1, y: 1, active: true },
      { x: 3, y: 1, active: true }
    ] });
    state = editorReducer(state, { type: 'set-selection', selection: { x: 1, y: 1, width: 2, height: 2 } });
    state = editorReducer(state, { type: 'move-selection', dx: 2, dy: 0 });
    const canceled = editorReducer(state, { type: 'cancel-selection-move' });
    const pixels = new Uint8Array(canceled.presentGroup.faces[0].frames[0].packedPixels);
    expect(getPixel(pixels, profile, 1, 1)).toBe(true);
    expect(getPixel(pixels, profile, 3, 1)).toBe(true);
    expect(getPixel(pixels, profile, 4, 1)).toBe(false);
    expect(canceled.selectionMoveBaseline).toBeNull();

  });

  test('does not create history when a selection is already at the requested boundary', () => {
    const state = editorReducer(editorReducer(createEditorState(group(), profile), { type: 'set-selection', selection: { x: 0, y: 0, width: 2, height: 2 } }), { type: 'move-selection', dx: -1, dy: 0 });
    expect(state.past).toHaveLength(0);
    expect(state.selection).toEqual({ x: 0, y: 0, width: 2, height: 2 });
  });

  test('cancels a selection move by returning pixels to the origin', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'set-selection', selection: { x: 1, y: 1, width: 2, height: 2 } });
    state = editorReducer(state, { type: 'apply-pixel-transaction', pixels: [{ x: 1, y: 1, active: true }] });
    state = editorReducer(state, { type: 'move-selection', dx: 2, dy: 0 });
    const canceled = editorReducer(state, { type: 'cancel-selection-move' });
    const pixels = new Uint8Array(canceled.presentGroup.faces[0].frames[0].packedPixels);
    expect(getPixel(pixels, profile, 1, 1)).toBe(true);
    expect(getPixel(pixels, profile, 3, 1)).toBe(false);
    expect(canceled.selection).toBeNull();
    expect(canceled.selectionOrigin).toBeNull();
  });

  test('adds, selects, renames, duplicates and changes the default face', () => {
    let state = createEditorState(group(), profile);
    const blankFace = face('face-2');
    state = editorReducer(state, { type: 'add-face', face: blankFace });
    expect(state.selectedFaceId).toBe('face-2');
    state = editorReducer(state, { type: 'rename-face', faceId: 'face-2', name: 'Thinking' });
    expect(state.presentGroup.faces[1].name).toBe('Thinking');
    state = editorReducer(state, { type: 'set-default-face', faceId: 'face-2' });
    expect(state.presentGroup.defaultFaceId).toBe('face-2');
    state = editorReducer(state, { type: 'duplicate-face', sourceFaceId: 'face-2', faceId: 'face-3', name: 'Thinking copy' });
    expect(state.presentGroup.faces).toHaveLength(3);
    state = editorReducer(state, { type: 'delete-face', faceId: 'face-2', replacementDefaultFaceId: 'face-1' });
    expect(state.presentGroup.defaultFaceId).toBe('face-1');
    expect(state.presentGroup.faces.map((item) => item.faceId)).not.toContain('face-2');
  });

  test('renames the group and marks a successful save as the new clean baseline', () => {
    let state = createEditorState(group(), profile);
    state = editorReducer(state, { type: 'rename-group', name: 'Renamed group' });
    expect(state.presentGroup.name).toBe('Renamed group');
    expect(state.past).toHaveLength(1);
    state = editorReducer(state, { type: 'mark-saved', group: { ...state.presentGroup, revision: 2 } });
    expect(state.savedGroup.name).toBe('Renamed group');
    expect(state.presentGroup.revision).toBe(2);
    expect(state.past).toHaveLength(0);
    expect(state.future).toHaveLength(0);
  });
});
