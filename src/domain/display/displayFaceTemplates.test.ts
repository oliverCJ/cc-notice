import {
  DISPLAY_FACE_TEMPLATE_IDS,
  defaultDisplayFaceTemplateId,
  displayFaceTemplateById,
  displayFaceTemplateLabelKey
} from './displayFaceTemplates';

describe('displayFaceTemplates', () => {
  test('keeps the first version as no-brow warm screen faces', () => {
    expect(defaultDisplayFaceTemplateId).toBe('idle-sleep');
    expect(DISPLAY_FACE_TEMPLATE_IDS).toEqual([
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
    ]);
    for (const id of DISPLAY_FACE_TEMPLATE_IDS) {
      expect(displayFaceTemplateById(id)?.primitives.brows).toEqual([]);
    }
  });

  test('returns null for unknown template id', () => {
    expect(displayFaceTemplateById('unknown')).toBeNull();
  });

  test('uses stable i18n label keys', () => {
    expect(displayFaceTemplateLabelKey('success-happy')).toBe(
      'rules.displayFace.templates.successHappy'
    );
  });

  test('derives explicit tracks from the generated renderer contract', () => {
    for (const id of DISPLAY_FACE_TEMPLATE_IDS) {
      const definition = displayFaceTemplateById(id);
      expect(definition?.tracks.length).toBeGreaterThan(0);
      expect(definition?.primitives.motion).toEqual(
        definition?.tracks.map((track) => track.kind)
      );
    }
  });
});
