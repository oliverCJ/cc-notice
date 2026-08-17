import { DeviceChannelRuleAction, HardwareOutput } from '../../api/tauriApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { AlertCircle, Plus } from 'lucide-react';
import {
  ChannelSelectOption,
  DeviceSelectOption,
  defaultChannelOptions,
  defaultDeviceOptions,
  enrichDeviceChannelsForRule
} from './deviceChannelOptions';
import { defaultParametersForDeviceChannelAction } from './ruleProfileUtils';
import { DeviceChannelActionFields } from './DeviceChannelActionFields';

export const MAX_DEVICE_CHANNEL_ACTION_GROUPS = 10;

type DeviceChannelActionGroupFieldsProps = {
  internalEvent: string;
  output: HardwareOutput;
  deviceOptions?: DeviceSelectOption[];
  channelOptions?: ChannelSelectOption[];
  lockIdentityFields?: boolean;
  onChange: (output: HardwareOutput) => void;
};

export function DeviceChannelActionGroupFields({
  internalEvent,
  output,
  deviceOptions,
  channelOptions = defaultChannelOptions,
  lockIdentityFields = false,
  onChange
}: DeviceChannelActionGroupFieldsProps) {
  const t = useI18n();
  const actions = normalizeActions(output, deviceOptions, channelOptions);
  const duplicateKeys = findDuplicateActionTargets(actions);
  const canAdd = actions.length < MAX_DEVICE_CHANNEL_ACTION_GROUPS;

  function updateActions(nextActions: DeviceChannelRuleAction[]) {
    onChange({
      ...output,
      type: 'device-channel',
      durationMs: output.durationMs ?? null,
      text: output.text ?? null,
      channelActions: nextActions
    });
  }

  function addAction() {
    if (!canAdd) {
      return;
    }
    updateActions([
      ...actions,
      createDefaultDeviceChannelRuleAction(actions, deviceOptions, channelOptions)
    ]);
  }

  function updateAction(index: number, nextAction: DeviceChannelRuleAction) {
    updateActions(actions.map((item, itemIndex) => (itemIndex === index ? nextAction : item)));
  }

  function removeAction(index: number) {
    if (actions.length <= 1) {
      return;
    }
    updateActions(actions.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-3 md:col-span-2 xl:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('rules.deviceChannel.actionGroups')}</p>
          <p className="text-xs text-muted-foreground">
            {t('rules.deviceChannel.channelActionCount', {
              count: actions.length,
              max: MAX_DEVICE_CHANNEL_ACTION_GROUPS
            })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={addAction} disabled={!canAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t('rules.deviceChannel.addChannelAction')}
        </Button>
      </div>

      {!canAdd ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('rules.outputRules.validationChannelActionsLimit')}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3">
        {actions.map((action, index) => (
          <DeviceChannelActionFields
            key={action.id}
            internalEvent={internalEvent}
            action={action}
            index={index}
            duplicate={duplicateKeys.has(actionTargetKey(action))}
            canRemove={actions.length > 1}
            deviceOptions={deviceOptions}
            channelOptions={channelOptions}
            lockIdentityFields={lockIdentityFields}
            onChange={(nextAction) => updateAction(index, nextAction)}
            onRemove={() => removeAction(index)}
          />
        ))}
      </div>
    </div>
  );
}

export function createDefaultDeviceChannelRuleAction(
  existingActions: DeviceChannelRuleAction[] = [],
  deviceOptions?: DeviceSelectOption[],
  channelOptions: ChannelSelectOption[] = defaultChannelOptions
): DeviceChannelRuleAction {
  const effectiveDeviceOptions = deviceOptions ?? defaultDeviceOptions;
  const allowBoardCapabilityFallback = deviceOptions === undefined;
  const device = effectiveDeviceOptions[0];
  const deviceRuleChannels = device ? enrichDeviceChannelsForRule(device) : [];
  const channels = deviceRuleChannels.length
    ? deviceRuleChannels
    : allowBoardCapabilityFallback
      ? channelOptions
      : [];
  const channel = channels.find((item) => item.value === 'pin.gp2') ?? channels[0];
  const action = channel?.supportedActions[0] ?? 'activate';

  return {
    id: nextActionId(existingActions),
    deviceId: device?.value ?? '',
    channelId: channel?.value ?? '',
    channelAction: action,
    ...defaultParametersForDeviceChannelAction(action)
  };
}

export function findDuplicateActionTargets(actions: DeviceChannelRuleAction[]): Set<string> {
  const counts = new Map<string, number>();
  actions.forEach((action) => {
    const key = actionTargetKey(action);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
  );
}

export function actionTargetKey(action: DeviceChannelRuleAction): string {
  return `${action.deviceId}::${action.channelId}`;
}

function normalizeActions(
  output: HardwareOutput,
  deviceOptions?: DeviceSelectOption[],
  channelOptions: ChannelSelectOption[] = defaultChannelOptions
): DeviceChannelRuleAction[] {
  if (output.channelActions?.length) {
    return output.channelActions;
  }
  return [createDefaultDeviceChannelRuleAction([], deviceOptions, channelOptions)];
}

function nextActionId(actions: DeviceChannelRuleAction[]): string {
  let index = actions.length + 1;
  const ids = new Set(actions.map((action) => action.id));
  while (ids.has(`action-${index}`)) {
    index += 1;
  }
  return `action-${index}`;
}
