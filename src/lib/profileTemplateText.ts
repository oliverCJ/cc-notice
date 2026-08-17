import { ProfileTemplateInfo } from '@/api/tauriApi';
import { Translator } from '@/i18n';

type ProfileTemplateTextSource = Pick<ProfileTemplateInfo, 'name' | 'description'> & {
  id: string;
};

const PROFILE_TEMPLATE_KEY_BY_ID: Record<string, string> = {
  basic: 'basic',
  advanced: 'advanced',
  blank: 'blank'
};

export function profileTemplateName(template: ProfileTemplateTextSource, t: Translator) {
  return profileTemplateText(template, t, 'name', template.name);
}

export function profileTemplateDescription(template: ProfileTemplateTextSource, t: Translator) {
  return profileTemplateText(template, t, 'description', template.description);
}

function profileTemplateText(
  template: ProfileTemplateTextSource,
  t: Translator,
  field: 'name' | 'description',
  fallback: string
) {
  const templateKey = PROFILE_TEMPLATE_KEY_BY_ID[template.id];
  if (!templateKey) {
    return fallback;
  }

  const translationKey = `rules.profileTemplates.${templateKey}.${field}`;
  const translated = t(translationKey);
  return translated === translationKey ? fallback : translated;
}
