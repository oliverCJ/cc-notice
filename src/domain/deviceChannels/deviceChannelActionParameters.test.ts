import { describe, expect, test } from 'vitest';
import {
  defaultParametersForDeviceChannelAction,
  validateDeviceChannelActionParameters
} from './deviceChannelActionParameters';

describe('deviceChannelActionParameters', () => {
  test('uses default display face parameters', () => {
    expect(defaultParametersForDeviceChannelAction('display-face')).toMatchObject({
      durationMs: 5000,
      displayFaceTemplateId: 'idle-sleep',
      displayFaceIntensity: 'standard'
    });
  });

  test('rejects empty display-face template', () => {
    expect(
      validateDeviceChannelActionParameters({
        channelAction: 'display-face',
        dutyPercent: null,
        frequencyHz: null,
        color: null,
        brightnessPercent: null,
        intervalMs: null,
        pattern: null,
        displayFaceTemplateId: null,
        displayStatus: null,
        displayTitleTemplate: null,
        displayMessageTemplate: null
      })
    ).toBe('rules.outputRules.validationDisplayFaceTemplateRequired');
  });

  test('rejects non ASCII display-status custom templates', () => {
    expect(
      validateDeviceChannelActionParameters({
        channelAction: 'display-status',
        dutyPercent: null,
        frequencyHz: null,
        color: null,
        brightnessPercent: null,
        intervalMs: null,
        pattern: null,
        displayStatus: 'notice',
        displayTitleTemplate: '任务完成',
        displayMessageTemplate: '{{display.lines}}'
      })
    ).toBe('rules.display.validationAsciiOnly');
  });

  test('rejects unknown display-status template variables', () => {
    expect(
      validateDeviceChannelActionParameters({
        channelAction: 'display-status',
        dutyPercent: null,
        frequencyHz: null,
        color: null,
        brightnessPercent: null,
        intervalMs: null,
        pattern: null,
        displayStatus: 'notice',
        displayTitleTemplate: '{{unknown_token}}',
        displayMessageTemplate: '{{display.lines}}'
      })
    ).toBe('rules.display.validationUnknownVariable');

    expect(
      validateDeviceChannelActionParameters({
        channelAction: 'display-status',
        dutyPercent: null,
        frequencyHz: null,
        color: null,
        brightnessPercent: null,
        intervalMs: null,
        pattern: null,
        displayStatus: 'notice',
        displayTitleTemplate: '{{unknown-token}}',
        displayMessageTemplate: '{{display.lines}}'
      })
    ).toBe('rules.display.validationUnknownVariable');
  });
});
