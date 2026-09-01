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

export type SelectionMoveBaseline = {
  faceId: string;
  frameIndex: number;
  selection: { x: number; y: number; width: number; height: number };
  packedPixels: number[];
  pastLength: number;
};

export type EditorState = {
  mode: EditorMode;
  profile: EditorProfile;
  presentGroup: CustomFaceGroup;
  savedGroup: CustomFaceGroup;
  selectedFaceId: string | null;
  selectedFrameIndex: number;
  past: CustomFaceGroup[];
  future: CustomFaceGroup[];
  selection: { x: number; y: number; width: number; height: number } | null;
  selectionOrigin: { x: number; y: number; width: number; height: number } | null;
  selectionMoveBaseline: SelectionMoveBaseline | null;
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
  | { type: 'set-selection'; selection: { x: number; y: number; width: number; height: number } | null }
  | { type: 'move-selection'; dx: number; dy: number }
  | { type: 'cancel-selection-move' }
  | { type: 'copy-selection' }
  | { type: 'paste-selection' }
  | { type: 'clear-selection' }
  | { type: 'set-selection-active'; active: boolean }
  | { type: 'add-frame' }
  | { type: 'set-frame-duration'; index: number; durationMs: number }
  | { type: 'move-frame'; from: number; to: number }
  | { type: 'set-selected-frame-duration'; durationMs: number }
  | { type: 'apply-pixel-transaction'; pixels: Array<{ x: number; y: number; active: boolean }> }
  | { type: 'duplicate-frame'; index: number }
  | { type: 'delete-frame'; index: number }
  | { type: 'delete-face'; faceId: string; replacementDefaultFaceId?: string }
  | { type: 'undo' }
  | { type: 'redo' };
