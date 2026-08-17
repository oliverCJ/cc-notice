import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { DeviceActionStatus } from '@/hooks/useDeviceRuntimeRegistry';
import {
  DeviceBuzzerPattern,
  DeviceChannel,
  DeviceChannelAction,
  DeviceChannelActionType,
  DeviceRuntimeState
} from '@/api/tauriApi';
import {
  defaultParametersForDeviceChannelAction,
  deviceChannelParameterConstraints
} from '@/domain/deviceChannels/deviceChannelActionParameters';
import { useI18n } from '@/i18n';

const durationOptions = ['1000', '2000', '5000', '10000', '0'];
const intervalOptions = ['250', '500', '1000', '1200'];
const buzzerPatternOptions: DeviceBuzzerPattern[] = ['notice', 'success', 'warning', 'error', 'working'];

type DeviceTestActionPanelProps = {
  selectedState: DeviceRuntimeState | null;
  channels: DeviceChannel[];
  actionStatus: DeviceActionStatus;
  onSend: (request: DeviceChannelAction) => void;
};

export function DeviceTestActionPanel({
  selectedState,
  channels,
  actionStatus,
  onSend
}: DeviceTestActionPanelProps) {
  const t = useI18n();
  const outputChannels = useMemo(
    () => channels.filter((channel) => (channel.direction ?? 'output') === 'output' && channel.supportedActions.length > 0),
    [channels]
  );
  const [channelId, setChannelId] = useState(outputChannels[0]?.id ?? '');
  const [action, setAction] = useState<DeviceChannelActionType>('activate');
  const [durationMs, setDurationMs] = useState('1000');
  const [intervalMs, setIntervalMs] = useState('500');
  const [dutyPercent, setDutyPercent] = useState('50');
  const [frequencyHz, setFrequencyHz] = useState('2000');
  const [color, setColor] = useState('#33cc99');
  const [brightnessPercent, setBrightnessPercent] = useState('40');
  const [pattern, setPattern] = useState<DeviceBuzzerPattern>('notice');

  const selectedChannel = useMemo(
    () => outputChannels.find((channel) => channel.id === channelId) ?? null,
    [channelId, outputChannels]
  );
  const actionOptions = selectedChannel?.supportedActions ?? [];
  const selectedChannelExists = Boolean(selectedChannel);
  const connected = selectedState?.status === 'connected';

  useEffect(() => {
    if (selectedChannel && !selectedChannel.supportedActions.includes(action)) {
      applyActionDefaults(selectedChannel.supportedActions[0] ?? 'clear');
    }
  }, [action, selectedChannel]);

  useEffect(() => {
    if (selectedChannel) {
      return;
    }
    setChannelId(outputChannels[0]?.id ?? '');
  }, [outputChannels, selectedChannel]);

  function applyActionDefaults(nextAction: DeviceChannelActionType) {
    const defaults = defaultParametersForDeviceChannelAction(nextAction);
    setAction(nextAction);
    if (nextAction === 'breathe') {
      setDurationMs(String(defaults.durationMs ?? deviceChannelParameterConstraints.durationMs.defaultValue));
      setIntervalMs(String(defaults.intervalMs ?? deviceChannelParameterConstraints.breatheIntervalMs.defaultValue));
    }
    if (nextAction === 'pattern') {
      setPattern((defaults.pattern as DeviceBuzzerPattern | null | undefined) ?? 'notice');
    }
  }

  function handleSend() {
    if (!selectedState?.deviceId || !selectedChannelExists) {
      return;
    }

    onSend({
      deviceId: selectedState.deviceId,
      channelId,
      action,
      durationMs: durationMs === '0' ? null : Number(durationMs),
      intervalMs: action === 'blink' || action === 'breathe' ? Number(intervalMs) : null,
      dutyPercent: action === 'set-duty' ? Number(dutyPercent) : null,
      frequencyHz: action === 'beep' || action === 'tone' ? Number(frequencyHz) : null,
      color: action === 'set-color' ? color : null,
      brightnessPercent: action === 'set-color' ? Number(brightnessPercent) : null,
      pattern: action === 'pattern' ? pattern : null,
      priority: 50
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('devices.testAction.title')}</CardTitle>
        <CardDescription>{t('devices.testAction.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label>{t('devices.testAction.channel')}</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger aria-label={t('devices.testAction.channel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {outputChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.label} · {t(`devices.channelKind.${channel.kind}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('devices.testAction.action')}</Label>
            <Select
              value={action}
              onValueChange={(value) => applyActionDefaults(value as DeviceChannelActionType)}
            >
              <SelectTrigger aria-label={t('devices.testAction.action')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {actionOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`devices.channelAction.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('devices.testAction.duration')}</Label>
            <Select value={durationMs} onValueChange={setDurationMs}>
              <SelectTrigger aria-label={t('devices.testAction.duration')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durationOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === '0' ? t('devices.testAction.forever') : t('devices.testAction.ms', { ms: option })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('devices.testAction.interval')}</Label>
            <Select
              value={intervalMs}
              onValueChange={setIntervalMs}
              disabled={action !== 'blink' && action !== 'breathe'}
            >
              <SelectTrigger aria-label={t('devices.testAction.interval')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {intervalOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t('devices.testAction.ms', { ms: option })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {action === 'set-duty' ? (
          <ParameterSelect
            label={t('devices.testAction.dutyPercent')}
            value={dutyPercent}
            options={['10', '25', '50', '75', '100']}
            format={(value) => t('devices.testAction.percent', { value })}
            onChange={setDutyPercent}
          />
        ) : null}
        {action === 'beep' || action === 'tone' ? (
          <ParameterSelect
            label={t('devices.testAction.frequency')}
            value={frequencyHz}
            options={['1000', '2000', '2400', '3000']}
            format={(value) => t('devices.testAction.hz', { value })}
            onChange={setFrequencyHz}
          />
        ) : null}
        {action === 'pattern' ? (
          <ParameterSelect
            label={t('devices.deviceExtension.buzzerPatterns')}
            value={pattern}
            options={buzzerPatternOptions}
            format={(value) => t(`devices.deviceExtension.pattern.${value}`)}
            onChange={(value) => setPattern(value as DeviceBuzzerPattern)}
          />
        ) : null}
        {action === 'set-color' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <ParameterSelect
              label={t('devices.testAction.color')}
              value={color}
              options={['#ff3b30', '#ffd60a', '#33cc99', '#0a84ff']}
              format={(value) => value}
              onChange={setColor}
            />
            <ParameterSelect
              label={t('devices.testAction.brightness')}
              value={brightnessPercent}
              options={['10', '30', '40', '60', '100']}
              format={(value) => t('devices.testAction.percent', { value })}
              onChange={setBrightnessPercent}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleSend}
            disabled={!selectedState?.deviceId || !selectedChannelExists || actionStatus === 'sending'}
          >
            <Send className="mr-2 h-4 w-4" />
            {actionStatus === 'sending' ? t('devices.testAction.sending') : t('devices.testAction.send')}
          </Button>
          <p className="text-sm text-muted-foreground">
            {statusText(actionStatus, connected, t)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type ParameterSelectProps = {
  label: string;
  value: string;
  options: string[];
  format: (value: string) => string;
  onChange: (value: string) => void;
};

function ParameterSelect({ label, value, options, format, onChange }: ParameterSelectProps) {
  return (
    <div className="max-w-xs space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {format(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function statusText(actionStatus: DeviceActionStatus, connected: boolean, t: ReturnType<typeof useI18n>) {
  if (actionStatus === 'skipped' || !connected) {
    return t('devices.testAction.skipped');
  }
  if (actionStatus === 'sent') {
    return t('devices.testAction.sent');
  }
  if (actionStatus === 'failed') {
    return t('devices.testAction.failed');
  }
  return t('devices.testAction.ready');
}
