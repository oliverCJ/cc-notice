import type { CustomFace, CustomFaceGroup } from '@/api/tauriApi';

export type EditorProfile = {
  id: string;
  width: number;
  height: number;
  maxFrames: number;
  framebufferBytes: number;
};

export type ToolId = 'brush' | 'eraser' | 'select' | 'line' | 'rectangle' | 'circle' | 'triangle' | 'pen';

export type EditorMode = 'editing' | 'empty-group' | 'empty-frame';

export type SelectionShape = 'rectangle' | 'circle';
export type SelectionRect = { x: number; y: number; width: number; height: number; shape?: SelectionShape };
export type SelectionPivot = { x: number; y: number };

export type SelectionMoveBaseline = {
  faceId: string;
  frameIndex: number;
  selection: SelectionRect;
  packedPixels: number[];
  pastLength: number;
};

export type SelectionRotationBaseline = {
  faceId: string;
  frameIndex: number;
  selection: SelectionRect;
  packedPixels: number[];
  pastLength: number;
};

export type SelectionTransformKind = 'move' | 'rotate';

export type EditorState = {
  mode: EditorMode;
  profile: EditorProfile;
  presentGroup: CustomFaceGroup;
  savedGroup: CustomFaceGroup;
  selectedFaceId: string | null;
  selectedFrameIndex: number;
  past: CustomFaceGroup[];
  future: CustomFaceGroup[];
  selection: SelectionRect | null;
  selectionOrigin: SelectionRect | null;
  selectionMoveBaseline: SelectionMoveBaseline | null;
  selectionPivot: SelectionPivot | null;
  selectionRotationBaseline: SelectionRotationBaseline | null;
  selectionRotationDegrees: number;
  selectionTransformKind: SelectionTransformKind | null;
  clipboard: { width: number; height: number; pixels: boolean[] } | null;
};

export type EditorAction =
  | { type: 'rename-group'; name: string }
  | { type: 'mark-saved'; group: CustomFaceGroup }
  | { type: 'select-face'; faceId: string }
  | { type: 'add-face'; face: CustomFace }
  | { type: 'duplicate-face'; sourceFaceId: string; faceId: string; name: string }
  | { type: 'rename-face'; faceId: string; name: string }
  | { type: 'set-default-face'; faceId: string }
  | { type: 'select-frame'; index: number }
  | { type: 'set-selection'; selection: SelectionRect | null }
  | { type: 'set-selection-pivot'; pivot: SelectionPivot }
  | { type: 'move-selection'; dx: number; dy: number }
  | { type: 'confirm-selection-move' }
  | { type: 'cancel-selection-move' }
  | { type: 'rotate-selection'; degrees: number }
  | { type: 'confirm-selection-transform' }
  | { type: 'cancel-selection-transform' }
  | { type: 'confirm-selection-rotation' }
  | { type: 'cancel-selection-rotation' }
  | { type: 'copy-selection' }
  | { type: 'paste-selection' }
  | { type: 'clear-selection' }
  | { type: 'set-selection-active'; active: boolean }
  | { type: 'add-frame' }
  | { type: 'add-blank-frame' }
  | { type: 'set-frame-duration'; index: number; durationMs: number }
  | { type: 'move-frame'; from: number; to: number }
  | { type: 'set-selected-frame-duration'; durationMs: number }
  | { type: 'apply-pixel-transaction'; pixels: Array<{ x: number; y: number; active: boolean }> }
  | { type: 'duplicate-frame'; index: number }
  | { type: 'delete-frame'; index: number }
  | { type: 'delete-face'; faceId: string; replacementDefaultFaceId?: string }
  | { type: 'undo' }
  | { type: 'redo' };
