import type { CustomFaceGroup } from '@/api/tauriApi';

export type EditorProfile = {
  id: string;
  width: number;
  height: number;
  maxFrames: number;
  framebufferBytes: number;
};

export type ToolId = 'brush' | 'eraser' | 'select' | 'line' | 'rectangle' | 'circle' | 'triangle' | 'pen';

export type EditorMode = 'editing' | 'empty-group' | 'empty-frame';

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
  clipboard: { width: number; height: number; pixels: boolean[] } | null;
};

export type EditorAction =
  | { type: 'select-frame'; index: number }
  | { type: 'set-selection'; selection: { x: number; y: number; width: number; height: number } | null }
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
  | { type: 'delete-face'; faceId: string }
  | { type: 'undo' }
  | { type: 'redo' };
