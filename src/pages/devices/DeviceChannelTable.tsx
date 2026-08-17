import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { DeviceChannel, DeviceInputBinding } from '@/api/tauriApi';
import { HardwareGuideButton } from '@/components/hardware-guides/HardwareGuideButton';
import { supportsRp2040PicoGpioInput } from '@/domain/boards/rp2040PicoChannels';
import { DeviceRuntimeError } from '@/hooks/useDeviceRuntimeRegistry';
import { useI18n } from '@/i18n';
import { useEffect, useMemo, useState } from 'react';

type DeviceChannelTableProps = {
  boardId?: string | null;
  deviceId?: string | null;
  channels: DeviceChannel[];
  availableChannels: DeviceChannel[];
  inputBindings: DeviceInputBinding[];
  error?: DeviceRuntimeError | null;
  onAddChannel: (channel: DeviceChannel) => void;
  onRemoveChannel: (channelId: string) => void;
  onUpdateChannelMode: (channelId: string, direction: 'output' | 'input') => void;
  onConfigureInput: (channel: DeviceChannel) => void;
  onRefreshCapabilities: () => void;
  onOpenRulesPage?: () => void;
};

export function DeviceChannelTable({
  boardId,
  deviceId,
  channels,
  availableChannels,
  inputBindings,
  error,
  onAddChannel,
  onRemoveChannel,
  onUpdateChannelMode,
  onConfigureInput,
  onRefreshCapabilities,
  onOpenRulesPage
}: DeviceChannelTableProps) {
  const t = useI18n();
  const [selectedChannelId, setSelectedChannelId] = useState(availableChannels[0]?.id ?? '');
  const [pendingModeChannelId, setPendingModeChannelId] = useState<string | null>(null);
  const selectedChannel = useMemo(
    () => availableChannels.find((channel) => channel.id === selectedChannelId) ?? null,
    [availableChannels, selectedChannelId]
  );

  useEffect(() => {
    if (selectedChannelId && availableChannels.some((channel) => channel.id === selectedChannelId)) {
      return;
    }
    setSelectedChannelId(availableChannels[0]?.id ?? '');
  }, [availableChannels, selectedChannelId]);

  useEffect(() => {
    if (!pendingModeChannelId) {
      return;
    }
    if (channels.some((channel) => channel.id === pendingModeChannelId)) {
      return;
    }
    setPendingModeChannelId(null);
  }, [channels, pendingModeChannelId]);

  useEffect(() => {
    setPendingModeChannelId(null);
  }, [deviceId]);

  function addSelectedChannel() {
    if (!selectedChannel) {
      return;
    }
    onAddChannel(selectedChannel);
  }

  return (
    <Card data-testid="device-channel-panel">
      <CardHeader>
        <CardTitle>{t('devices.channels.title')}</CardTitle>
        <CardDescription>{t('devices.channels.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error?.code === 'device-channel-referenced-by-output-rule' ? (
          <ChannelReferencedAlert error={error} onOpenRulesPage={onOpenRulesPage} />
        ) : null}
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="w-full md:max-w-xs">
            <Select
              value={selectedChannelId}
              onValueChange={setSelectedChannelId}
              disabled={availableChannels.length === 0}
            >
              <SelectTrigger aria-label={t('devices.channels.newChannel')}>
                <SelectValue placeholder={t('devices.channels.addChannelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {availableChannels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {formatChannelOption(boardId, channel, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={addSelectedChannel} disabled={!selectedChannel}>
            {t('devices.channels.addChannel')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onRefreshCapabilities}
            disabled={channels.length === 0}
          >
            {t('devices.channels.refreshCapabilities')}
          </Button>
          {availableChannels.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('devices.channels.emptyAvailable')}</p>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('devices.channels.channel')}</TableHead>
              <TableHead>{t('devices.channels.mode')}</TableHead>
              <TableHead>{t('devices.channels.kind')}</TableHead>
              <TableHead>{t('devices.channels.pin')}</TableHead>
              <TableHead>{t('devices.channels.activeLevel')}</TableHead>
              <TableHead>{t('devices.channels.defaultLevel')}</TableHead>
              <TableHead>{t('devices.channels.guide')}</TableHead>
              <TableHead className="w-[96px] text-right">
                {t('devices.channels.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel) => {
              const inputBinding = findInputBinding(inputBindings, deviceId ?? null, channel.id);
              return (
                <TableRow key={channel.id}>
                  <TableCell className="font-medium">{channel.label}</TableCell>
                  <TableCell>
                    <Badge variant={isInputChannel(channel) ? 'outline' : 'secondary'}>
                      {formatChannelMode(channel, t)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{t(`devices.channelKind.${channel.kind}`)}</Badge>
                  </TableCell>
                  <TableCell>{formatChannelPin(boardId, channel)}</TableCell>
                  <TableCell>{formatLevel(channel.digitalOutput?.activeLevel)}</TableCell>
                  <TableCell>{formatLevel(channel.digitalOutput?.defaultLevel)}</TableCell>
                  <TableCell>
                    {isInputChannel(channel) ? (
                      <div className="space-y-1 text-sm">
                        <div className="text-muted-foreground">{channel.input?.control ?? '-'}</div>
                        <div className="inline-flex max-w-full rounded-md border bg-muted px-2 py-1 font-medium text-foreground">
                          <span className="truncate">
                            {formatInputBindingShortcut(inputBinding, t)}
                          </span>
                        </div>
                        {inputBinding && !inputBinding.enabled ? (
                          <Badge variant="outline" className="text-muted-foreground">
                            {t('devices.inputBinding.disabled')}
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      <HardwareGuideButton
                        guideId={channel.hardwareGuideId}
                        boardId={boardId}
                        channelLabel={channel.label}
                        channel={channel}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {supportsGpioModeSwitch(boardId, channel) ? (
                        pendingModeChannelId === channel.id ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPendingModeChannelId(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                onUpdateChannelMode(
                                  channel.id,
                                  isInputChannel(channel) ? 'output' : 'input'
                                );
                                setPendingModeChannelId(null);
                              }}
                            >
                              {t('devices.channels.confirmModeSwitch')}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingModeChannelId(channel.id)}
                          >
                            {isInputChannel(channel)
                              ? t('devices.channels.switchToOutput')
                              : t('devices.channels.switchToInput')}
                          </Button>
                        )
                      ) : null}
                      {isInputChannel(channel) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={t('devices.channels.configureInput', { channel: channel.label })}
                          onClick={() => onConfigureInput(channel)}
                        >
                          {t('devices.channels.configureInputShort')}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t('devices.channels.removeChannel', { channel: channel.label })}
                        onClick={() => onRemoveChannel(channel.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ChannelReferencedAlert({
  error,
  onOpenRulesPage
}: {
  error: DeviceRuntimeError;
  onOpenRulesPage?: () => void;
}) {
  const t = useI18n();

  return (
    <Alert variant="destructive">
      <AlertTitle>{t('devices.channels.modeSwitchBlockedTitle')}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{t('devices.channels.modeSwitchBlockedDescription')}</p>
        {error.channelId ? (
          <p className="break-all">
            {t('devices.channels.referencedChannel', { channel: error.channelId })}
          </p>
        ) : null}
        {error.ruleId ? (
          <p className="break-all">
            {t('devices.channels.referencedRule', { rule: error.ruleId })}
          </p>
        ) : null}
        {onOpenRulesPage ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpenRulesPage}>
            {t('devices.list.openRules')}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function findInputBinding(
  bindings: DeviceInputBinding[],
  deviceId: string | null,
  channelId: string
) {
  if (!deviceId) {
    return null;
  }
  return (
    bindings.find((binding) => binding.deviceId === deviceId && binding.channelId === channelId) ??
    null
  );
}

function formatInputBindingShortcut(
  binding: DeviceInputBinding | null,
  t: ReturnType<typeof useI18n>
) {
  const keys = binding?.action.shortcut.keys ?? [];
  if (keys.length === 0) {
    return t('devices.inputBinding.unconfigured');
  }
  if (!binding?.enabled) {
    return t('devices.inputBinding.disabledShortcut', { shortcut: keys.join(' + ') });
  }
  return keys.join(' + ');
}

function formatLevel(level?: string | null) {
  return level ? level.toUpperCase() : '-';
}

function formatChannelPin(boardId: string | null | undefined, channel: DeviceChannel) {
  if (isInputChannel(channel) && !channel.digitalOutput) {
    return channel.input?.control ?? '-';
  }
  const gpio = getChannelGpio(channel);
  if (gpio === null) {
    return '-';
  }
  if (!isRp2040Board(boardId)) {
    return channel.label;
  }
  if (!channel.physicalPin) {
    return `GP${gpio}`;
  }
  return `GP${gpio} · Pin ${channel.physicalPin}`;
}

function supportsGpioModeSwitch(boardId: string | null | undefined, channel: DeviceChannel) {
  return isRp2040Board(boardId) && supportsRp2040PicoGpioInput(channel);
}

function formatChannelOption(
  boardId: string | null | undefined,
  channel: DeviceChannel,
  t: ReturnType<typeof useI18n>
) {
  return `${formatChannelPin(boardId, channel)} · ${t(`devices.channelKind.${channel.kind}`)}`;
}

function formatChannelMode(channel: DeviceChannel, t: ReturnType<typeof useI18n>) {
  if (isInputChannel(channel) && channel.input?.fixed) {
    return t('devices.channels.modeFixedInput');
  }
  return t(`devices.channels.modeValue.${channel.direction ?? 'output'}`);
}

function isInputChannel(channel: DeviceChannel) {
  return (channel.direction ?? 'output') === 'input';
}

function isRp2040Board(boardId: string | null | undefined) {
  return boardId?.startsWith('rp2040-pico') ?? false;
}

function getChannelGpio(channel: DeviceChannel) {
  return (
    channel.digitalOutput?.pin ??
    channel.pwmOutput?.pin ??
    channel.buzzer?.pin ??
    channel.addressableLed?.pin ??
    null
  );
}
