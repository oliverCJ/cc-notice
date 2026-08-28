import type { CustomFaceGroup } from '@/api/tauriApi';
import type { EditorAction, EditorProfile, EditorState } from './types';
import { normalizeFrameDuration } from './playback';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function modeFor(group: CustomFaceGroup, selectedFaceId: string | null) {
  if (group.faces.length === 0) return 'empty-group' as const;
  const face = group.faces.find((item) => item.faceId === selectedFaceId) ?? group.faces[0];
  return face.frames.length === 0 ? 'empty-frame' as const : 'editing' as const;
}

function commit(state: EditorState, group: CustomFaceGroup, selectedFaceId = state.selectedFaceId, frameIndex = state.selectedFrameIndex): EditorState {
  const face = group.faces.find((item) => item.faceId === selectedFaceId) ?? group.faces[0];
  const safeFrameIndex = face?.frames.length ? Math.min(frameIndex, face.frames.length - 1) : 0;
  return {
    ...state,
    mode: modeFor(group, face?.faceId ?? null),
    presentGroup: group,
    selectedFaceId: face?.faceId ?? null,
    selectedFrameIndex: safeFrameIndex,
    past: [...state.past, clone(state.presentGroup)],
    future: []
  };
}

export function createEditorState(group: CustomFaceGroup, profile: EditorProfile): EditorState {
  const presentGroup = clone(group);
  const selectedFaceId = presentGroup.faces[0]?.faceId ?? null;
  return {
    mode: modeFor(presentGroup, selectedFaceId),
    profile,
    presentGroup,
    savedGroup: clone(group),
    selectedFaceId,
    selectedFrameIndex: 0,
    past: [],
    future: [],
    selection: null,
    clipboard: null
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'set-selection') return { ...state, selection: action.selection };
  if (action.type === 'copy-selection') {
    const face = state.presentGroup.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face?.frames[state.selectedFrameIndex] || !state.selection) return state;
    const { x, y, width, height } = state.selection;
    const pixels = face.frames[state.selectedFrameIndex].packedPixels;
    const copied: boolean[] = [];
    for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) copied.push((pixels[x + col + Math.floor((y + row) / 8) * state.profile.width] & (1 << ((y + row) & 7))) !== 0);
    return { ...state, clipboard: { width, height, pixels: copied } };
  }
  if (action.type === 'clear-selection' && state.selection) {
    const group = clone(state.presentGroup); const face = group.faces.find((item) => item.faceId === state.selectedFaceId); const frame = face?.frames[state.selectedFrameIndex];
    if (!frame) return state;
    const { x, y, width, height } = state.selection;
    for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) { const index = x + col + Math.floor((y + row) / 8) * state.profile.width; frame.packedPixels[index] &= ~(1 << ((y + row) & 7)); }
    return { ...commit(state, group), selection: null };
  }
  if (action.type === 'set-selection-active' && state.selection) {
    const group = clone(state.presentGroup);
    const face = group.faces.find((item) => item.faceId === state.selectedFaceId);
    const frame = face?.frames[state.selectedFrameIndex];
    if (!frame) return state;
    const { x, y, width, height } = state.selection;
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const pixelX = x + column;
        const pixelY = y + row;
        const index = pixelX + Math.floor(pixelY / 8) * state.profile.width;
        const mask = 1 << (pixelY & 7);
        frame.packedPixels[index] = action.active ? frame.packedPixels[index] | mask : frame.packedPixels[index] & ~mask;
      }
    }
    return { ...commit(state, group), selection: null };
  }
  if (action.type === 'paste-selection' && state.selection && state.clipboard) {
    const group = clone(state.presentGroup); const face = group.faces.find((item) => item.faceId === state.selectedFaceId); const frame = face?.frames[state.selectedFrameIndex];
    if (!frame) return state;
    const { x, y } = state.selection; const clip = state.clipboard;
    clip.pixels.forEach((active, index) => { if (!active) return; const col = index % clip.width; const row = Math.floor(index / clip.width); if (x + col >= 0 && y + row >= 0 && x + col < state.profile.width && y + row < state.profile.height) frame.packedPixels[x + col + Math.floor((y + row) / 8) * state.profile.width] |= 1 << ((y + row) & 7); });
    return { ...commit(state, group), selection: null };
  }
  if (action.type === 'select-frame') {
    const face = state.presentGroup.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face?.frames[action.index]) return state;
    return { ...state, selectedFrameIndex: action.index, selection: null };
  }
  if (action.type === 'add-frame') {
    const group = clone(state.presentGroup);
    const face = group.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face || face.frames.length >= state.profile.maxFrames) return state;
    const source = face.frames[state.selectedFrameIndex] ?? { durationMs: 200, packedPixels: new Array(state.profile.framebufferBytes).fill(0) };
    face.frames.splice(state.selectedFrameIndex + 1, 0, clone(source));
    return commit(state, group, face.faceId, state.selectedFrameIndex + 1);
  }
  if (action.type === 'set-frame-duration') {
    const group = clone(state.presentGroup);
    const face = group.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face?.frames[action.index]) return state;
    const durationMs = normalizeFrameDuration(action.durationMs);
    if (face.frames[action.index].durationMs === durationMs) return state;
    face.frames[action.index].durationMs = durationMs;
    return commit(state, group, face.faceId, action.index);
  }
  if (action.type === 'set-selected-frame-duration') {
    const group = clone(state.presentGroup); const face = group.faces.find((item) => item.faceId === state.selectedFaceId); const frame = face?.frames[state.selectedFrameIndex];
    if (!face || !frame) return state;
    const durationMs = normalizeFrameDuration(action.durationMs); if (frame.durationMs === durationMs) return state;
    face.frames.forEach((item) => { if (item === frame) item.durationMs = durationMs; });
    return commit(state, group);
  }
  if (action.type === 'move-frame') {
    const group = clone(state.presentGroup); const face = group.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face || !face.frames[action.from] || action.to < 0 || action.to >= face.frames.length || action.from === action.to) return state;
    const [moved] = face.frames.splice(action.from, 1); face.frames.splice(action.to, 0, moved);
    return commit(state, group, face.faceId, action.to);
  }
  if (action.type === 'undo') {
    const previous = state.past[state.past.length - 1];
    return previous ? { ...state, presentGroup: clone(previous), past: state.past.slice(0, -1), future: [clone(state.presentGroup), ...state.future], mode: modeFor(previous, state.selectedFaceId) } : state;
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    return next ? { ...state, presentGroup: clone(next), past: [...state.past, clone(state.presentGroup)], future: state.future.slice(1), mode: modeFor(next, state.selectedFaceId) } : state;
  }

  const group = clone(state.presentGroup);
  const face = group.faces.find((item) => item.faceId === state.selectedFaceId);
  if (action.type === 'apply-pixel-transaction' && face?.frames[state.selectedFrameIndex]) {
    const pixels = face.frames[state.selectedFrameIndex].packedPixels;
    action.pixels.forEach(({ x, y, active }) => {
      if (x < 0 || y < 0 || x >= state.profile.width || y >= state.profile.height) return;
      const index = x + Math.floor(y / 8) * state.profile.width;
      const mask = 1 << (y & 7);
      pixels[index] = active ? pixels[index] | mask : pixels[index] & ~mask;
    });
    if (action.pixels.some(({ x, y }) => x >= 0 && y >= 0 && x < state.profile.width && y < state.profile.height)) return commit(state, group);
    return state;
  }
  if (action.type === 'duplicate-frame' && face && face.frames.length < state.profile.maxFrames && face.frames[action.index]) {
    face.frames.splice(action.index + 1, 0, clone(face.frames[action.index]));
    return commit(state, group, face.faceId, action.index + 1);
  }
  if (action.type === 'delete-frame' && face && face.frames.length > 1 && face.frames[action.index]) {
    face.frames.splice(action.index, 1);
    return commit(state, group, face.faceId, Math.min(action.index, face.frames.length - 1));
  }
  if (action.type === 'delete-face' && group.faces.length > 1 && action.faceId !== group.defaultFaceId) {
    group.faces = group.faces.filter((item) => item.faceId !== action.faceId);
    return commit(state, group, group.faces[0]?.faceId ?? null, 0);
  }
  return state;
}
