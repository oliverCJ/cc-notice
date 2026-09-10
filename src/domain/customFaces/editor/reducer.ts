import type { CustomFaceGroup } from '@/api/tauriApi';
import type { EditorAction, EditorProfile, EditorState } from './types';
import { isPointInsideSelection, rotateSelection } from './raster';
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
    selectionMoveBaseline: null,
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
    selectionMoveBaseline: null,
    selectionPivot: null,
    selectionRotationBaseline: null,
    selectionRotationDegrees: 0,
    selectionTransformKind: null,
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
      selectionOrigin: null,
      selectionMoveBaseline: null
    };
  }
  if (action.type === 'select-face') {
    const face = state.presentGroup.faces.find((item) => item.faceId === action.faceId);
    return face ? { ...state, selectedFaceId: face.faceId, selectedFrameIndex: 0, selection: null, selectionOrigin: null, selectionMoveBaseline: null } : state;
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
  if (action.type === 'set-selection') {
    return {
      ...state,
      selection: action.selection,
      selectionOrigin: null,
      selectionMoveBaseline: null,
      selectionPivot: action.selection ? selectionCenter(action.selection) : null,
      selectionRotationBaseline: null,
      selectionRotationDegrees: 0,
      selectionTransformKind: null,
    };
  }
  if (action.type === 'set-selection-pivot' && state.selection && !state.selectionRotationBaseline) {
    if (!inProfileBounds(state.profile, action.pivot.x, action.pivot.y)) return state;
    return { ...state, selectionPivot: action.pivot };
  }
  if ((action.type === 'cancel-selection-rotation' || action.type === 'cancel-selection-transform') && state.selectionRotationBaseline) {
    const baseline = state.selectionRotationBaseline;
    const group = clone(state.presentGroup);
    const frame = group.faces.find((item) => item.faceId === baseline.faceId)?.frames[baseline.frameIndex];
    if (!frame) return state;
    frame.packedPixels = [...baseline.packedPixels];
    return {
      ...state,
      mode: modeFor(group, state.selectedFaceId),
      presentGroup: group,
      selection: baseline.selection,
      selectionOrigin: null,
      selectionPivot: selectionCenter(baseline.selection),
      selectionRotationBaseline: null,
      selectionRotationDegrees: 0,
      selectionTransformKind: null,
    };
  }
  if ((action.type === 'confirm-selection-transform' || action.type === 'confirm-selection-move') && state.selectionMoveBaseline) {
    return {
      ...state,
      selection: null,
      selectionOrigin: null,
      selectionPivot: null,
      selectionMoveBaseline: null,
      selectionTransformKind: null,
    };
  }
  if ((action.type === 'confirm-selection-rotation' || action.type === 'confirm-selection-transform') && state.selectionRotationBaseline) {
    const baseline = state.selectionRotationBaseline;
    const previous = clone(state.presentGroup);
    const frame = previous.faces.find((item) => item.faceId === baseline.faceId)?.frames[baseline.frameIndex];
    if (!frame) return state;
    frame.packedPixels = [...baseline.packedPixels];
    return {
      ...state,
      past: [...state.past, previous],
      future: [],
      selection: null,
      selectionOrigin: null,
      selectionPivot: null,
      selectionMoveBaseline: null,
      selectionRotationBaseline: null,
      selectionRotationDegrees: 0,
      selectionTransformKind: null,
    };
  }
  if (action.type === 'rotate-selection' && state.selection) {
    if (!Number.isFinite(action.degrees) || state.selectionMoveBaseline) return state;
    const pivot = state.selectionPivot ?? selectionCenter(state.selection);
    if (!inProfileBounds(state.profile, pivot.x, pivot.y)) return state;
    const baseline = state.selectionRotationBaseline;
    const faceId = baseline?.faceId ?? state.selectedFaceId;
    const frameIndex = baseline?.frameIndex ?? state.selectedFrameIndex;
    if (!faceId) return state;
    const face = state.presentGroup.faces.find((item) => item.faceId === faceId);
    const frame = face?.frames[frameIndex];
    if (!frame) return state;
    const rotationBaseline = baseline ?? {
      faceId,
      frameIndex,
      selection: state.selection,
      packedPixels: [...frame.packedPixels],
      pastLength: state.past.length,
    };
    const normalizedDegrees = normalizeRotationDegrees(action.degrees);
    if (normalizedDegrees === 0) {
      if (!baseline) return state;
      const group = clone(state.presentGroup);
      const nextFrame = group.faces.find((item) => item.faceId === faceId)?.frames[frameIndex];
      if (!nextFrame) return state;
      nextFrame.packedPixels = [...baseline.packedPixels];
      return {
        ...state,
        mode: modeFor(group, state.selectedFaceId),
        presentGroup: group,
        selection: baseline.selection,
        selectionOrigin: null,
        selectionRotationBaseline: null,
        selectionRotationDegrees: 0,
        selectionTransformKind: null,
      };
    }
    const rotated = rotateSelection(
      new Uint8Array(rotationBaseline.packedPixels),
      state.profile,
      rotationBaseline.selection,
      pivot,
      normalizedDegrees,
    );
    const group = clone(state.presentGroup);
    const nextFrame = group.faces.find((item) => item.faceId === faceId)?.frames[frameIndex];
    if (!nextFrame) return state;
    nextFrame.packedPixels = Array.from(rotated.pixels);
    return {
      ...state,
      mode: modeFor(group, state.selectedFaceId),
      presentGroup: group,
      selection: rotated.selection,
      selectionOrigin: rotationBaseline.selection,
      selectionPivot: pivot,
      selectionRotationBaseline: rotationBaseline,
      selectionRotationDegrees: normalizedDegrees,
      selectionTransformKind: 'rotate',
    };
  }
  if ((action.type === 'cancel-selection-move' || action.type === 'cancel-selection-transform') && state.selection && state.selectionMoveBaseline) {
    const baseline = state.selectionMoveBaseline;
    const group = clone(state.presentGroup);
    const frame = group.faces.find((item) => item.faceId === baseline.faceId)?.frames[baseline.frameIndex];
    if (!frame) return state;
    frame.packedPixels = [...baseline.packedPixels];
    return {
      ...state,
      mode: modeFor(group, state.selectedFaceId),
      presentGroup: group,
      selection: baseline.selection,
      selectionOrigin: null,
      selectionMoveBaseline: null,
      selectionPivot: selectionCenter(baseline.selection),
      selectionRotationBaseline: null,
      selectionRotationDegrees: 0,
      selectionTransformKind: null,
      past: state.past.slice(0, baseline.pastLength),
      future: []
    };
  }
  if (action.type === 'move-selection' && state.selection) {
    if (state.selectionRotationBaseline || !Number.isFinite(action.dx) || !Number.isFinite(action.dy) || (action.dx === 0 && action.dy === 0)) return state;
    const baseline = state.selectionMoveBaseline;
    const faceId = baseline?.faceId ?? state.selectedFaceId;
    const frameIndex = baseline?.frameIndex ?? state.selectedFrameIndex;
    if (!faceId) return state;
    const face = state.presentGroup.faces.find((item) => item.faceId === faceId);
    const frame = face?.frames[frameIndex];
    if (!frame) return state;
    const origin = baseline?.selection ?? state.selection;
    const { x, y, width, height } = origin;
    const nextX = Math.max(0, Math.min(state.profile.width - width, state.selection.x + Math.trunc(action.dx)));
    const nextY = Math.max(0, Math.min(state.profile.height - height, state.selection.y + Math.trunc(action.dy)));
    if (nextX === state.selection.x && nextY === state.selection.y) return state;
    const moveBaseline = baseline ?? {
      faceId,
      frameIndex,
      selection: { x, y, width, height, shape: origin.shape },
      packedPixels: [...frame.packedPixels],
      pastLength: state.past.length
    };
    const group = clone(state.presentGroup);
    const nextFrame = group.faces.find((item) => item.faceId === faceId)?.frames[frameIndex];
    if (!nextFrame) return state;
    nextFrame.packedPixels = [...moveBaseline.packedPixels];
    clearActiveRegionOnFrame(nextFrame, state.profile.width, state.profile.height, origin, moveBaseline.packedPixels);
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const sourceX = x + column;
        const sourceY = y + row;
        if (!isPointInsideSelection(origin, sourceX, sourceY)) continue;
        const sourceIndex = sourceX + Math.floor(sourceY / 8) * state.profile.width;
        if ((moveBaseline.packedPixels[sourceIndex] & (1 << (sourceY & 7))) === 0) continue;
        const pixelX = nextX + column;
        const pixelY = nextY + row;
        if (pixelX < 0 || pixelY < 0 || pixelX >= state.profile.width || pixelY >= state.profile.height) continue;
        const byteIndex = pixelX + Math.floor(pixelY / 8) * state.profile.width;
        nextFrame.packedPixels[byteIndex] |= 1 << (pixelY & 7);
      }
    }
    const committed = commit(state, group);
    return {
      ...committed,
      selection: { x: nextX, y: nextY, width: state.selection.width, height: state.selection.height, shape: origin.shape },
      selectionOrigin: state.selectionOrigin ?? { x, y, width, height, shape: origin.shape },
      selectionMoveBaseline: moveBaseline,
      selectionTransformKind: 'move',
    };
  }
  if (action.type === 'copy-selection') {
    const face = state.presentGroup.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face?.frames[state.selectedFrameIndex] || !state.selection) return state;
    const { x, y, width, height } = state.selection;
    const pixels = face.frames[state.selectedFrameIndex].packedPixels;
    const copied: boolean[] = [];
    for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) {
      const pixelX = x + col;
      const pixelY = y + row;
      copied.push(isPointInsideSelection(state.selection, pixelX, pixelY) && (pixels[pixelX + Math.floor(pixelY / 8) * state.profile.width] & (1 << (pixelY & 7))) !== 0);
    }
    return { ...state, clipboard: { width, height, pixels: copied } };
  }
  if (action.type === 'clear-selection' && state.selection) {
    const group = clone(state.presentGroup); const face = group.faces.find((item) => item.faceId === state.selectedFaceId); const frame = face?.frames[state.selectedFrameIndex];
    if (!frame) return state;
    const { x, y, width, height } = state.selection;
    for (let row = 0; row < height; row += 1) for (let col = 0; col < width; col += 1) {
      const pixelX = x + col;
      const pixelY = y + row;
      if (!isPointInsideSelection(state.selection, pixelX, pixelY)) continue;
      const index = pixelX + Math.floor(pixelY / 8) * state.profile.width;
      frame.packedPixels[index] &= ~(1 << (pixelY & 7));
    }
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
        if (!isPointInsideSelection(state.selection, pixelX, pixelY)) continue;
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
    return { ...state, selectedFrameIndex: action.index, selection: null, selectionOrigin: null, selectionMoveBaseline: null };
  }
  if (action.type === 'add-frame' || action.type === 'add-blank-frame') {
    const group = clone(state.presentGroup);
    const face = group.faces.find((item) => item.faceId === state.selectedFaceId);
    if (!face || face.frames.length >= state.profile.maxFrames) return state;
    const source = action.type === 'add-frame'
      ? face.frames[state.selectedFrameIndex] ?? { durationMs: 200, packedPixels: new Array(state.profile.framebufferBytes).fill(0) }
      : { durationMs: 200, packedPixels: new Array(state.profile.framebufferBytes).fill(0) };
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

function selectionCenter(selection: { x: number; y: number; width: number; height: number }) {
  return {
    x: Math.round(selection.x + (selection.width - 1) / 2),
    y: Math.round(selection.y + (selection.height - 1) / 2),
  };
}

function inProfileBounds(profile: EditorProfile, x: number, y: number) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < profile.width && y < profile.height;
}

function normalizeRotationDegrees(degrees: number) {
  const normalized = ((Math.trunc(degrees) % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
}

function hasFaceName(group: CustomFaceGroup, name: string, exceptFaceId?: string) {
  const normalized = name.trim().toLocaleLowerCase();
  return group.faces.some((face) => face.faceId !== exceptFaceId && face.name.trim().toLocaleLowerCase() === normalized);
}

function clearActiveRegionOnFrame(frame: { packedPixels: number[] }, canvasWidth: number, canvasHeight: number, selection: { x: number; y: number; width: number; height: number; shape?: 'rectangle' | 'circle' }, sourcePixels: number[]) {
  for (let row = 0; row < selection.height; row += 1) for (let column = 0; column < selection.width; column += 1) {
    const pixelX = selection.x + column;
    const pixelY = selection.y + row;
    if (!isPointInsideSelection(selection, pixelX, pixelY) || pixelX < 0 || pixelY < 0 || pixelX >= canvasWidth || pixelY >= canvasHeight) continue;
    const index = pixelX + Math.floor(pixelY / 8) * canvasWidth;
    if ((sourcePixels[index] & (1 << (pixelY & 7))) !== 0) frame.packedPixels[index] &= ~(1 << (pixelY & 7));
  }
}
