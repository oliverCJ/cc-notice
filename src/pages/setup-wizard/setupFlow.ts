export type SetupStepId =
  | 'hook-service'
  | 'hook-settings'
  | 'event-mapping'
  | 'device-firmware'
  | 'diagnostics-check';

export type SetupFlowStep = {
  id: SetupStepId;
  labelKey: string;
  titleKey: string;
  descriptionKey?: string;
};

export const setupFlowSteps: SetupFlowStep[] = [
  {
    id: 'hook-service',
    labelKey: 'setup.steps.hookService.label',
    titleKey: 'setup.steps.hookService.title',
    descriptionKey: 'setup.steps.hookService.description'
  },
  {
    id: 'hook-settings',
    labelKey: 'setup.steps.hookSettings.label',
    titleKey: 'setup.steps.hookSettings.title',
    descriptionKey: 'setup.steps.hookSettings.description'
  },
  {
    id: 'event-mapping',
    labelKey: 'setup.steps.eventMapping.label',
    titleKey: 'setup.steps.eventMapping.title',
    descriptionKey: 'setup.steps.eventMapping.description'
  },
  {
    id: 'device-firmware',
    labelKey: 'setup.steps.deviceFirmware.label',
    titleKey: 'setup.steps.deviceFirmware.title',
    descriptionKey: 'setup.steps.deviceFirmware.description'
  },
  {
    id: 'diagnostics-check',
    labelKey: 'setup.steps.diagnosticsCheck.label',
    titleKey: 'setup.steps.diagnosticsCheck.title',
    descriptionKey: 'setup.steps.diagnosticsCheck.description'
  }
];
