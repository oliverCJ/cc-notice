export type DisplayFaceTemplateId =
  | 'idle-sleep'
  | 'idle-bored'
  | 'working-focus'
  | 'working-busy'
  | 'waiting-call'
  | 'waiting-wait'
  | 'success-happy'
  | 'success-surprise'
  | 'warning-shock'
  | 'warning-sweat'
  | 'error-awkward'
  | 'error-panic';

export type DisplayFaceSemanticState =
  | 'idle'
  | 'working'
  | 'waiting-input'
  | 'success'
  | 'warning'
  | 'error';

export type DisplayFacePrimitiveSet = {
  eyes: string[];
  mouth: string;
  symbols: string[];
  motion: string[];
  brows: string[];
};

export type DisplayFaceTemplateDefinition = {
  id: DisplayFaceTemplateId;
  state: DisplayFaceSemanticState;
  labelKey: string;
  descriptionKey: string;
  primitives: DisplayFacePrimitiveSet;
};

export const defaultDisplayFaceTemplateId: DisplayFaceTemplateId = 'idle-sleep';

export const DISPLAY_FACE_TEMPLATE_IDS: DisplayFaceTemplateId[] = [
  'idle-sleep',
  'idle-bored',
  'working-focus',
  'working-busy',
  'waiting-call',
  'waiting-wait',
  'success-happy',
  'success-surprise',
  'warning-shock',
  'warning-sweat',
  'error-awkward',
  'error-panic'
];

const templates: Record<DisplayFaceTemplateId, DisplayFaceTemplateDefinition> = {
  'idle-sleep': template('idle-sleep', 'idle', ['closed'], 'smile', ['zzz'], ['breath']),
  'idle-bored': template('idle-bored', 'idle', ['focus'], 'flat', ['ellipsis'], ['look-around']),
  'working-focus': template('working-focus', 'working', ['soft-open'], 'flat', [], ['pulse']),
  'working-busy': template('working-busy', 'working', ['round'], 'flat', ['busy'], ['shake-light']),
  'waiting-call': template('waiting-call', 'waiting-input', ['round'], 'call', ['call-wave'], ['pulse']),
  'waiting-wait': template(
    'waiting-wait',
    'waiting-input',
    ['soft-open'],
    'o',
    ['ellipsis'],
    ['look-around']
  ),
  'success-happy': template('success-happy', 'success', ['happy-arc'], 'smile-arc', ['heart'], ['bounce']),
  'success-surprise': template('success-surprise', 'success', ['round'], 'o', ['spark'], ['pop']),
  'warning-shock': template('warning-shock', 'warning', ['shock-outline'], 'o', ['bang'], ['shake-light']),
  'warning-sweat': template('warning-sweat', 'warning', ['focus'], 'sad', ['sweat-dots'], ['pulse']),
  'error-awkward': template('error-awkward', 'error', ['closed'], 'sad', ['awkward-lines'], ['shake-light']),
  'error-panic': template('error-panic', 'error', ['shock-outline'], 'sad', ['sweat-dots', 'bang'], ['shake'])
};

export function displayFaceTemplateById(
  id: string | null | undefined
): DisplayFaceTemplateDefinition | null {
  if (!id || !DISPLAY_FACE_TEMPLATE_IDS.includes(id as DisplayFaceTemplateId)) {
    return null;
  }
  return templates[id as DisplayFaceTemplateId];
}

export function displayFaceTemplateLabelKey(id: DisplayFaceTemplateId): string {
  return templates[id].labelKey;
}

function template(
  id: DisplayFaceTemplateId,
  state: DisplayFaceSemanticState,
  eyes: string[],
  mouth: string,
  symbols: string[],
  motion: string[]
): DisplayFaceTemplateDefinition {
  const suffix = id.replace(/-([a-z])/g, (_, value: string) => value.toUpperCase());
  return {
    id,
    state,
    labelKey: `rules.displayFace.templates.${suffix}`,
    descriptionKey: `rules.displayFace.templateDescriptions.${suffix}`,
    primitives: {
      eyes,
      mouth,
      symbols,
      motion,
      brows: []
    }
  };
}
