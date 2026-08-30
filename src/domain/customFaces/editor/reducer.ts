import type { CustomFaceGroup } from '@/api/tauriApi';
import type { EditorAction, EditorProfile, EditorState } from './types';
import { normalizeFrameDuration } from './playback';

const MAX_FACES_PER_GROUP = 15;

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
    selectionOrigin: null,
    clipboard: null
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'rename-group') {
    const name = action.name.trim();
    if (!name || name === state.presentGroup.name) return state;
    const group = clone(state.presentGroup);
    group.name = name;
    return commit(state, group, state.selectedFaceId, state.selectedFrameIndex);
  }
  if (action.type === 'mark-saved') {
    const group = clone(action.group);
    const selectedFace = group.faces.find((face) => face.faceId === state.selectedFaceId) ?? group.faces[0];
    return {
      ...state,
      mode: modeFor(group, selectedFace?.faceId ?? null),
      presentGroup: group,
      savedGroup: clone(group),
      selectedFaceId: selectedFace?.faceId ?? null,
      selectedFrameIndex: selectedFace?.frames.length ? Math.min(state.selectedFrameIndex, selectedFace.frames.length - 1) : 0,
      past: [],
      future: [],
      selection: null,
      selectionOrigin: null
    };
  }
  if (action.type === 'select-face') {
    const face = state.presentGroup.faces.find((item) => item.faceId === action.faceId);
    return face ? { ...state, selectedFaceId: face.faceId, selectedFrameIndex: 0, selection: null, selectionOrigin: null } : state;
  }
  if (action.type === 'add-face') {
    if (state.presentGroup.faces.length >= MAX_FACES_PER_GROUP
      || state.presentGroup.faces.some((face) => face.faceId === action.face.faceId)
      || hasFaceName(state.presentGroup, action.face.name)) return state;
    const group = clone(state.presentGroup);
    group.faces.push(clone(action.face));
    return commit(state, group, action.face.faceId, 0);
  }
  if (action.type === 'duplicate-face') {
    const source = state.presentGroup.faces.find((face) => face.faceId === action.sourceFaceId);
    if (!source || state.presentGroup.faces.length >= MAX_FACES_PER_GROUP
      || state.presentGroup.faces.some((face) => face.faceId === action.faceId)
      || hasFaceName(state.presentGroup, action.name)) return state;
    const group = clone(state.presentGroup);
    group.faces.push({ ...clone(source), faceId: action.faceId, name: action.name.trim() });
    return commit(state, group, action.faceId, 0);
  }
  if (action.type === 'rename-face') {
    const name = action.name.trim();
    if (!name || hasFaceName(state.presentGroup, name, action.faceId)) return state;
    const group = clone(state.presentGroup);
    const face = group.faces.find((item) => item.faceId === action.faceId);
    if (!face || face.name === name) return state;
    face.name = name;
    return commit(state, group, face.faceId, state.selectedFrameIndex);
  }
  if (action.type === 'set-default-face') {
    if (state.presentGroup.defaultFaceId === action.faceId
      || !state.presentGroup.faces.some((face) => face.faceId === action.faceId)) return state;
    const group = clone(state.presentGroup);
    group.defaultFaceId = action.faceId;
    return commit(state, group, state.selectedFaceId, state.selectedFrameIndex);
  }
  if (action.type === 'set-selection') return { ...state, selection: action.selection, selectionOrigin: null };
  if (action.type === 'cancel-selection-move' && state.selection && state.selectionOrigin) {
    const restored = editorReducer(state, { type: 'move-selection', dx: state.selectionOrigin.x - state.selection.x, dy: state.selectionOrigin.y - state.selection.y });
    return { ...restored, selection: null, selectionOrigin: null };
  }
  if (action.type === 'move-selection' && state.selection) {
    if (!Number.isFinite(action.dx) || !Number.isFinite(action.dy) || (action.dx === 0 && action.dy === 0)) return state;
    const face = state.presentGroup.faces.find((item) => item.faceId === state.selectedFaceId);
    const frame = face?.frames[state.selectedFrameIndex];
    if (!frame) return state;
    const { x, y, width, height } = state.selection;
    const snapshot: boolean[] = [];
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const pixelX = x + column;
        const pixelY = y + row;
        const index = pixelX + Math.floor(pixelY / 8) * state.profile.width;
        snapshot.push((frame.packedPixels[index] & (1 << (pixelY & 7))) !== 0);
      }
    }
    const nextX = Math.max(0, Math.min(state.profile.width - width, x + Math.trunc(action.dx)));
    const nextY = Math.max(0, Math.min(state.profile.height - height, y + Math.trunc(action.dy)));
    if (nextX === x && nextY === y) return state;
    const group = clone(state.presentGroup);
    const nextFrame = group.faces.find((item) => item.faceId === state.selectedFaceId)?.frames[state.selectedFrameIndex];
    if (!nextFrame) return state;
    clearRegionOnFrame(nextFrame, state.profile.width, state.profile.height, x, y, width, height);
    clearRegionOnFrame(nextFrame, state.profile.width, state.profile.height, nextX, nextY, width, height);
    snapshot.forEach((active, index) => {
      if (!active) return;
      const pixelX = nextX + (index % width);
      const pixelY = nextY + Math.floor(index / width);
      if (pixelX < 0 || pixelY < 0 || pixelX >= state.profile.width || pixelY >= state.profile.height) return;
      const byteIndex = pixelX + Math.floor(pixelY / 8) * state.profile.width;
      nextFrame.packedPixels[byteIndex] |= 1 << (pixelY & 7);
    });
    return { ...commit(state, group), selection: { x: nextX, y: nextY, width, height }, selectionOrigin: state.selectionOrigin ?? { x, y, width, height } };
  }
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
    return { ...commit(state, group), selection: null, selectionOrigin: null };
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
    return { ...commit(state, group), selection: null, selectionOrigin: null };
  }
  if (action.type === 'paste-selection' && state.selection && state.clipboard) {
    const group = clone(state.presentGroup); const face = group.faces.find((item) => item.faceId === state.selectedFaceId); const frame = face?.frames[state.selectedFrameIndex];
    if (!frame) return state;
    const { x, y } = state.selection; const clip = state.clipboard;
    clip.pixels.forEach((active, index) => { if (!active) return; const col = index % clip.width; const row = Math.floor(index / clip.width); if (x + col >= 0 && y + row >= 0 && x + col < state.profile.width && y + row < state.profile.height) frame.packedPixels[x + col + Math.floor((y + row) / 8) * state.profile.width] |= 1 << ((y + row) & 7); });
    return { ...commit(state, group), selection: null, selectionOrigin: null };
  }
  if (action.type === 'select-frame') {
    const face = state.presentGroup.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face?.frames[action.index]) return state;
    return { ...state, selectedFrameIndex: action.index, selection: null, selectionOrigin: null };
  }
  if (action.type === 'add-frame') {
    const group = clone(state.presentGroup);
    const face = group.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face || face.frames.length >= state.profile.maxFrames) return state;
    const source = face.frames[state.selectedFrameIndex] ?? { durationMs: 200, packedPixels: new Array(state.profile.framebufferBytes).fill(0) };
    face.frames.push(clone(source));
    return commit(state, group, face.faceId, face.frames.length - 1);
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
  if (action.type === 'delete-face' && group.faces.length > 1) {
    if (!group.faces.some((item) => item.faceId === action.faceId)) return state;
    if (action.faceId === group.defaultFaceId) {
      const replacement = action.replacementDefaultFaceId;
      if (!replacement || replacement === action.faceId || !group.faces.some((item) => item.faceId === replacement)) return state;
      group.defaultFaceId = replacement;
    }
    group.faces = group.faces.filter((item) => item.faceId !== action.faceId);
    return commit(state, group, group.faces[0]?.faceId ?? null, 0);
  }
  return state;
}

function hasFaceName(group: CustomFaceGroup, name: string, exceptFaceId?: string) {
  const normalized = name.trim().toLocaleLowerCase();
  return group.faces.some((face) => face.faceId !== exceptFaceId && face.name.trim().toLocaleLowerCase() === normalized);
}

function clearRegionOnFrame(frame: { packedPixels: number[] }, canvasWidth: number, canvasHeight: number, originX: number, originY: number, width: number, height: number) {
  for (let row = 0; row < height; row += 1) for (let column = 0; column < width; column += 1) {
    const pixelX = originX + column;
    const pixelY = originY + row;
    if (pixelX < 0 || pixelY < 0 || pixelX >= canvasWidth || pixelY >= canvasHeight) continue;
    const index = pixelX + Math.floor(pixelY / 8) * canvasWidth;
    frame.packedPixels[index] &= ~(1 << (pixelY & 7));
  }
}
