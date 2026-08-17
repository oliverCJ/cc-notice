import { DeviceChannelActionType, DeviceChannelRuleAction } from '@/api/tauriApi';
import {
  DisplayTemplateValidationKey,
  validateAsciiDisplayTemplate
} from '@/domain/display/displayTemplateValidation';
import {
  defaultLinesForDisplayTemplate,
  displayStatusForTemplate
} from '@/domain/display/displayTemplates';

export type NumericParameterConstraint = {
  min: number;
  max: number;
  defaultValue: number;
};

export const deviceChannelParameterConstraints = {
  durationMs: { min: 100, max: 600_000, defaultValue: 5000 },
  intervalMs: { min: 100, max: 10_000, defaultValue: 500 },
  breatheIntervalMs: { min: 200, max: 10_000, defaultValue: 1200 },
  dutyPercent: { min: 0, max: 100, defaultValue: 50 },
  frequencyHz: { min: 20, max: 20_000, defaultValue: 2000 },
  brightnessPercent: { min: 0, max: 100, defaultValue: 30 }
} satisfies Record<string, NumericParameterConstraint>;

export const defaultDeviceChannelColor = '#33ccff';
const defaultDisplayTemplateId = 'notice';

export function defaultParametersForDeviceChannelAction(
  action: DeviceChannelActionType | null | undefined
): Partial<DeviceChannelRuleAction> {
  return {
    durationMs: defaultDurationForAction(action),
    intervalMs:
      action === 'blink'
        ? deviceChannelParameterConstraints.intervalMs.defaultValue
        : action === 'breathe'
          ? deviceChannelParameterConstraints.breatheIntervalMs.defaultValue
          : null,
    dutyPercent:
      action === 'set-duty'
        ? deviceChannelParameterConstraints.dutyPercent.defaultValue
        : null,
    frequencyHz:
      action === 'beep' || action === 'tone'
        ? deviceChannelParameterConstraints.frequencyHz.defaultValue
        : null,
    color: action === 'set-color' ? defaultDeviceChannelColor : null,
    brightnessPercent:
      action === 'set-color'
        ? deviceChannelParameterConstraints.brightnessPercent.defaultValue
        : null,
    pattern: action === 'pattern' ? 'notice' : null,
    displayTemplateId: action === 'display-status' ? defaultDisplayTemplateId : null,
    displayAccent: action === 'display-status' ? displayStatusForTemplate(defaultDisplayTemplateId) : null,
    displayIcon: action === 'display-status' ? 'info' : null,
    displayLinesTemplate:
      action === 'display-status' ? defaultLinesForDisplayTemplate(defaultDisplayTemplateId) : null,
    displayStatus: action === 'display-status' ? displayStatusForTemplate(defaultDisplayTemplateId) : null,
    displayTitleTemplate: action === 'display-status' ? '{{display.title}}' : null,
    displayMessageTemplate: action === 'display-status' ? '{{display.lines}}' : null,
    displayTitleMaxChars: action === 'display-status' ? 39 : null,
    displayMessageMaxChars: action === 'display-status' ? 95 : null
  };
}

export type DeviceChannelActionParameterValidationKey =
  | 'rules.outputRules.validationDutyPercentRequired'
  | 'rules.outputRules.validationFrequencyRequired'
  | 'rules.outputRules.validationColorRequired'
  | 'rules.outputRules.validationBrightnessRequired'
  | 'rules.outputRules.validationIntervalRequired'
  | 'rules.outputRules.validationPatternRequired'
  | 'rules.outputRules.validationDisplayStatusRequired'
  | 'rules.outputRules.validationDisplayTitleRequired'
  | 'rules.outputRules.validationDisplayMessageRequired'
  | DisplayTemplateValidationKey;

export function validateDeviceChannelActionParameters(
  action: Pick<
    DeviceChannelRuleAction,
    | 'channelAction'
    | 'dutyPercent'
    | 'frequencyHz'
    | 'color'
    | 'brightnessPercent'
    | 'intervalMs'
    | 'pattern'
    | 'displayStatus'
    | 'displayTitleTemplate'
    | 'displayMessageTemplate'
  >
): DeviceChannelActionParameterValidationKey | null {
  switch (action.channelAction) {
    case 'set-duty':
      return action.dutyPercent === null || action.dutyPercent === undefined
        ? 'rules.outputRules.validationDutyPercentRequired'
        : null;
    case 'beep':
    case 'tone':
      return action.frequencyHz === null || action.frequencyHz === undefined
        ? 'rules.outputRules.validationFrequencyRequired'
        : null;
    case 'set-color':
      if (!action.color?.trim()) {
        return 'rules.outputRules.validationColorRequired';
      }
      return action.brightnessPercent === null || action.brightnessPercent === undefined
        ? 'rules.outputRules.validationBrightnessRequired'
        : null;
    case 'blink':
    case 'breathe':
      return action.intervalMs === null || action.intervalMs === undefined
        ? 'rules.outputRules.validationIntervalRequired'
        : null;
    case 'pattern':
      return action.pattern?.trim() ? null : 'rules.outputRules.validationPatternRequired';
    case 'display-status':
      if (!action.displayStatus?.trim()) {
        return 'rules.outputRules.validationDisplayStatusRequired';
      }
      if (!action.displayTitleTemplate?.trim()) {
        return 'rules.outputRules.validationDisplayTitleRequired';
      }
      if (!action.displayMessageTemplate?.trim()) {
        return 'rules.outputRules.validationDisplayMessageRequired';
      }
      return (
        validateAsciiDisplayTemplate(action.displayTitleTemplate) ??
        validateAsciiDisplayTemplate(action.displayMessageTemplate)
      );
    default:
      return null;
  }
}

export function clampOptionalNumber(
  value: string,
  constraint: NumericParameterConstraint
): number | null {
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(Math.min(constraint.max, Math.max(constraint.min, parsed)));
}

function defaultDurationForAction(
  action: DeviceChannelActionType | null | undefined
): number | null {
  if (['activate', 'blink', 'breathe', 'set-duty', 'set-color'].includes(action ?? '')) {
    return deviceChannelParameterConstraints.durationMs.defaultValue;
  }
  if (['pulse', 'beep', 'tone'].includes(action ?? '')) {
    return action === 'pulse' ? 1000 : 500;
  }
  return null;
}
