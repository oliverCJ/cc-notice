import { DISPLAY_FACE_CONTRACT } from './generated/displayFaceContract.generated';

export type DisplayFaceTemplateId = typeof DISPLAY_FACE_CONTRACT.templates[number]['id'];
export type DisplayFaceSemanticState = 'idle' | 'working' | 'waiting-input' | 'success' | 'warning' | 'error';
export type DisplayFaceMotionKind = typeof DISPLAY_FACE_CONTRACT.templates[number]['tracks'][number]['kind'];

export type DisplayFaceTemplateDefinition = {
  id: DisplayFaceTemplateId;
  state: DisplayFaceSemanticState;
  labelKey: string;
  descriptionKey: string;
  primitives: {
    eyes: string[];
    mouth: string;
    symbols: string[];
    motion: string[];
    brows: string[];
  };
  tracks: readonly {
    target: string;
    kind: string;
    cycleMs: number;
    frames: readonly { durationMs: number; value: number }[];
  }[];
};

export const defaultDisplayFaceTemplateId: DisplayFaceTemplateId = 'idle-sleep';
export const DISPLAY_FACE_TEMPLATE_IDS = DISPLAY_FACE_CONTRACT.templates.map(
  (template) => template.id
) as DisplayFaceTemplateId[];

const templates = new Map<DisplayFaceTemplateId, DisplayFaceTemplateDefinition>(
  DISPLAY_FACE_CONTRACT.templates.map((template) => {
    const suffix = template.id.replace(/-([a-z])/g, (_, value: string) => value.toUpperCase());
    const state = template.color === 'waiting' ? 'waiting-input' : template.color;
    return [template.id, {
      id: template.id,
      state: state as DisplayFaceSemanticState,
      labelKey: `rules.displayFace.templates.${suffix}`,
      descriptionKey: `rules.displayFace.templateDescriptions.${suffix}`,
      primitives: {
        eyes: [template.eyes],
        mouth: template.mouth,
        symbols: [...template.symbols],
        motion: template.tracks.map((track) => track.kind),
        brows: []
      },
      tracks: template.tracks
    }];
  })
);

export function displayFaceTemplateById(
  id: string | null | undefined
): DisplayFaceTemplateDefinition | null {
  return id ? templates.get(id as DisplayFaceTemplateId) ?? null : null;
}

export function displayFaceTemplateLabelKey(id: DisplayFaceTemplateId): string {
  return templates.get(id)?.labelKey ?? `rules.displayFace.templates.${id}`;
}
