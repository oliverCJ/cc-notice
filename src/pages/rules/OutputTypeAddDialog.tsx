import { useState } from 'react';
import {
  HardwareOutput,
  HardwareOutputType,
  HardwareRule
} from '../../api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import {
  defaultChannelOptions,
  defaultDeviceOptions,
  DeviceSelectOption
} from './deviceChannelOptions';
import {
  createDefaultOutputForType,
  deviceChannelParameterConstraints,
  hasOutputTypeForEvent,
  supportedOutputTypes,
  validateDeviceChannelActionParameters
} from './ruleProfileUtils';
import { DeviceChannelOutputFields } from './DeviceChannelOutputFields';
import { createDefaultDeviceChannelRuleAction } from './DeviceChannelActionGroupFields';
import { useI18n } from '@/i18n';

type OutputTypeAddDialogProps = {
  internalEvent: string;
  existingRules: HardwareRule[];
  deviceOptions?: DeviceSelectOption[];
  desktopNoticeInstances?: DesktopNoticeInstance[];
  onCancel: () => void;
  onAdd: (internalEvent: string, outputType: HardwareOutputType, output: HardwareOutput) => void;
};

export function OutputTypeAddDialog({
  internalEvent,
  existingRules,
  deviceOptions: providedDeviceOptions,
  desktopNoticeInstances = [],
  onCancel,
  onAdd
}: OutputTypeAddDialogProps) {
  const t = useI18n();
  const deviceOptions = providedDeviceOptions ?? defaultDeviceOptions;
  const allowBoardCapabilityFallback = providedDeviceOptions === undefined;
  const addableOutputTypes = supportedOutputTypes.filter((type) => type.value !== 'display');
  const availableTypes = addableOutputTypes.filter(
    (type) => !hasOutputTypeForEvent(existingRules, internalEvent, type.value)
  );
  const defaultOutputType =
    availableTypes.find((type) => type.implemented)?.value ??
    availableTypes[0]?.value ??
    'device-channel';
  const [outputType, setOutputType] = useState<HardwareOutputType>(
    defaultOutputType
  );
  const [draftOutput, setDraftOutput] = useState<HardwareOutput>(
    createAddDialogDefaultOutput(
      defaultOutputType,
      internalEvent,
      deviceOptions,
      allowBoardCapabilityFallback,
      desktopNoticeInstances
    )
  );
  const selectedTypeInfo = supportedOutputTypes.find((t) => t.value === outputType);
  const canSave =
    availableTypes.length > 0 &&
    Boolean(selectedTypeInfo?.implemented) &&
    outputReadyToAdd(draftOutput);

  function changeOutputType(nextType: HardwareOutputType) {
    setOutputType(nextType);
    setDraftOutput(createAddDialogDefaultOutput(
      nextType,
      internalEvent,
      deviceOptions,
      allowBoardCapabilityFallback,
      desktopNoticeInstances
    ));
  }

  function addSelectedOutputType() {
    onAdd(internalEvent, outputType, draftOutput);
  }

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t('rules.outputRules.addDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('rules.outputRules.addDialogDescription', { internalEvent })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {availableTypes.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('rules.outputRules.allTypesConfigured')}</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="output-type">{t('rules.outputRules.outputType')}</Label>
                <Select value={outputType} onValueChange={(val) => changeOutputType(val as HardwareOutputType)}>
                  <SelectTrigger id="output-type">
                    <SelectValue placeholder={t('rules.outputRules.outputTypePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {addableOutputTypes.map((type) => {
                      const alreadyUsed = hasOutputTypeForEvent(existingRules, internalEvent, type.value);
                      const disabled = alreadyUsed || !type.implemented;
                      return (
                        <SelectItem
                          key={type.value}
                          value={type.value}
                          disabled={disabled}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {t(type.labelKey)}
                              {alreadyUsed
                                ? t('rules.outputRules.alreadyConfigured')
                                : !type.implemented
                                  ? t('rules.outputRules.notImplemented')
                                  : ''}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {t(type.descriptionKey)}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {outputType === 'device-channel' && (
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
                  <DeviceChannelOutputFields
                    internalEvent={`${internalEvent}-add`}
                    output={draftOutput}
                    deviceOptions={allowBoardCapabilityFallback ? undefined : deviceOptions}
                    onChange={setDraftOutput}
                  />
                </div>
              )}

              {outputType === 'desktop-notice' && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-sm font-medium">
                    {t('rules.desktopNotice.addDialogTitle')}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {desktopNoticeInstances.some((instance) => instance.enabled)
                      ? t('rules.desktopNotice.addDialogReady')
                      : t('rules.desktopNotice.noEnabledInstances')}
                  </p>
                </div>
              )}

              {selectedTypeInfo?.implemented ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('rules.outputRules.addHint')}
                  </AlertDescription>
                </Alert>
              ) : !selectedTypeInfo?.implemented ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{t('rules.outputRules.notImplementedHint')}</AlertDescription>
                </Alert>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!canSave}
            onClick={addSelectedOutputType}
          >
            {t('rules.outputRules.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createAddDialogDefaultOutput(
  outputType: HardwareOutputType,
  internalEvent: string,
  deviceOptions: DeviceSelectOption[],
  allowBoardCapabilityFallback: boolean,
  desktopNoticeInstances: DesktopNoticeInstance[] = []
): HardwareOutput {
  const output = createDefaultOutputForType(outputType, internalEvent);
  if (outputType === 'desktop-notice') {
    const firstEnabled = desktopNoticeInstances.find((instance) => instance.enabled);
    return {
      ...output,
      desktopNoticeTargets: firstEnabled
        ? [
            {
              targetId: firstEnabled.id,
              effect: 'solid',
              colorMode: 'solid',
              colors: [{ color: '#22C55E', position: 0 }],
              durationMs: 3000,
              opacityPercent: 100,
              brightnessPercent: 100,
              restoreBehavior: 'use-instance-idle',
              edge: 'auto'
            }
          ]
        : []
    };
  }
  if (outputType !== 'device-channel') {
    return output;
  }

  return {
    ...output,
    channelActions: [
      createDefaultDeviceChannelRuleAction(
        [],
        allowBoardCapabilityFallback ? undefined : deviceOptions,
        defaultChannelOptions
      )
    ]
  };
}

function outputReadyToAdd(output: HardwareOutput) {
  if (output.type !== 'device-channel') {
    if (output.type === 'desktop-notice') {
      return (output.desktopNoticeTargets ?? []).some((target) => target.targetId.trim());
    }
    return true;
  }
  const actions = output.channelActions ?? [];
  return (
    actions.length > 0 &&
    actions.every(
      (action) =>
        action.deviceId.trim() &&
        action.channelId.trim() &&
        action.channelAction &&
        validateDeviceChannelActionNumericParameters(action) &&
        !validateDeviceChannelActionParameters(action)
    )
  );
}

function validateDeviceChannelActionNumericParameters(
  action: NonNullable<HardwareOutput['channelActions']>[number]
) {
  if (
    ['activate', 'blink', 'breathe', 'pulse', 'set-duty', 'beep', 'tone', 'set-color'].includes(
      action.channelAction ?? ''
    ) &&
    !numberInRange(action.durationMs, deviceChannelParameterConstraints.durationMs)
  ) {
    return false;
  }
  if (
    action.channelAction === 'blink' &&
    !numberInRange(action.intervalMs, deviceChannelParameterConstraints.intervalMs)
  ) {
    return false;
  }
  if (
    action.channelAction === 'breathe' &&
    !numberInRange(action.intervalMs, deviceChannelParameterConstraints.breatheIntervalMs)
  ) {
    return false;
  }
  if (
    action.channelAction === 'set-duty' &&
    !numberInRange(action.dutyPercent, deviceChannelParameterConstraints.dutyPercent)
  ) {
    return false;
  }
  if (
    (action.channelAction === 'beep' || action.channelAction === 'tone') &&
    !numberInRange(action.frequencyHz, deviceChannelParameterConstraints.frequencyHz)
  ) {
    return false;
  }
  if (
    action.channelAction === 'set-color' &&
    !numberInRange(action.brightnessPercent, deviceChannelParameterConstraints.brightnessPercent)
  ) {
    return false;
  }
  return true;
}

function numberInRange(
  value: number | null | undefined,
  constraint: { min: number; max: number }
) {
  return typeof value === 'number' && value >= constraint.min && value <= constraint.max;
}
