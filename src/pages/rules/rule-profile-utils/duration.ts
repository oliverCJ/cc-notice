export const permanentDurationPreset = 'permanent';
export const customDurationPreset = 'custom';
export const durationPresets = [
  { value: permanentDurationPreset, labelKey: 'rules.duration.permanent', durationMs: null },
  { value: '1000', labelKey: 'rules.duration.presets.1000', durationMs: 1000 },
  { value: '2000', labelKey: 'rules.duration.presets.2000', durationMs: 2000 },
  { value: '5000', labelKey: 'rules.duration.presets.5000', durationMs: 5000 },
  { value: '10000', labelKey: 'rules.duration.presets.10000', durationMs: 10000 },
  { value: '20000', labelKey: 'rules.duration.presets.20000', durationMs: 20000 },
  { value: '30000', labelKey: 'rules.duration.presets.30000', durationMs: 30000 },
  { value: '60000', labelKey: 'rules.duration.presets.60000', durationMs: 60000 },
  { value: customDurationPreset, labelKey: 'rules.duration.custom', durationMs: null }
] as const;

export function durationPresetForMs(durationMs: number | null | undefined) {
  if (durationMs == null) {
    return permanentDurationPreset;
  }

  return durationPresets.some((preset) => preset.durationMs === durationMs)
    ? String(durationMs)
    : customDurationPreset;
}

export function durationMsFromPreset(presetValue: string) {
  if (presetValue === permanentDurationPreset || presetValue === customDurationPreset) {
    return null;
  }

  const preset = durationPresets.find((item) => item.value === presetValue);
  return preset?.durationMs ?? null;
}

export function durationMsFromCustomSeconds(value: string) {
  if (value.trim() === '') {
    return null;
  }

  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  return Math.round(seconds * 1000);
}
