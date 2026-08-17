import { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Keyboard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeviceChannel, DeviceInputBinding, DeviceInputEvent, DeviceRuntimeState } from '@/api/tauriApi';
import { ShortcutKeyboardPanel } from '@/components/shortcut/ShortcutKeyboardPanel';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const DEVICE_INPUT_EVENT = 'cc-notice://device-input-event';

type DeviceInputTestPanelProps = {
  selectedState: DeviceRuntimeState | null;
  channels: DeviceChannel[];
  inputBindings: DeviceInputBinding[];
};

export function DeviceInputTestPanel({
  selectedState,
  channels,
  inputBindings
}: DeviceInputTestPanelProps) {
  const t = useI18n();
  const inputChannels = useMemo(
    () => channels.filter((channel) => (channel.direction ?? 'output') === 'input'),
    [channels]
  );
  const inputChannelIds = useMemo(
    () => new Set(inputChannels.map((channel) => channel.id)),
    [inputChannels]
  );
  const [recentInputEvent, setRecentInputEvent] = useState<DeviceInputEvent | null>(null);
  const inputRows = useMemo(
    () =>
      inputChannels.map((channel) => {
        const binding = findInputBinding(
          inputBindings,
          selectedState?.deviceId ?? null,
          channel.id
        );
        return {
          channel,
          binding,
          shortcutKeys: binding?.enabled ? binding.action.shortcut.keys : [],
          configuredShortcutKeys: binding?.action.shortcut.keys ?? [],
          disabled: Boolean(binding && !binding.enabled)
        };
      }),
    [inputBindings, inputChannels, selectedState?.deviceId]
  );
  const firstConfiguredChannelId =
    inputRows.find((row) => row.shortcutKeys.length > 0)?.channel.id ?? inputRows[0]?.channel.id ?? '';
  const [selectedChannelId, setSelectedChannelId] = useState(firstConfiguredChannelId);
  useEffect(() => {
    if (selectedChannelId && inputRows.some((row) => row.channel.id === selectedChannelId)) {
      return;
    }
    setSelectedChannelId(firstConfiguredChannelId);
  }, [firstConfiguredChannelId, inputRows, selectedChannelId]);
  useEffect(() => {
    const deviceId = selectedState?.deviceId;
    if (!deviceId || inputChannelIds.size === 0) {
      setRecentInputEvent(null);
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;
    void listen<DeviceInputEvent>(DEVICE_INPUT_EVENT, (event) => {
      const inputEvent = event.payload;
      if (
        inputEvent.deviceId !== deviceId ||
        !inputChannelIds.has(inputEvent.channelId)
      ) {
        return;
      }
      setRecentInputEvent(inputEvent);
      setSelectedChannelId(inputEvent.channelId);
    })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        unlisten = dispose;
      })
      .catch((error) => {
        console.warn('failed to initialize device input listener', error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [inputChannelIds, selectedState?.deviceId]);
  const selectedRow =
    inputRows.find((row) => row.channel.id === selectedChannelId) ??
    inputRows.find((row) => row.shortcutKeys.length > 0) ??
    inputRows[0] ??
    null;

  if (inputChannels.length === 0) {
    return null;
  }

  return (
    <Card data-testid="device-input-test-panel">
      <CardHeader>
        <CardTitle>{t('devices.inputTest.title')}</CardTitle>
        <CardDescription>{t('devices.inputTest.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-2">
          {inputRows.map((row) => (
            <Button
              key={row.channel.id}
              type="button"
              variant="outline"
              data-selected={row.channel.id === selectedRow?.channel.id ? 'true' : 'false'}
              className={cn(
                'h-auto justify-between gap-3 px-3 py-2 text-left',
                row.channel.id === selectedRow?.channel.id
                  ? 'border-primary bg-primary/25 text-foreground shadow-sm ring-1 ring-primary/60 hover:bg-primary/30'
                  : null,
                recentInputEvent?.channelId === row.channel.id
                  ? 'border-amber-500 bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/60 hover:bg-amber-500/20 dark:text-amber-200'
                  : row.disabled
                    ? 'border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-muted'
                  : null
              )}
              onClick={() => setSelectedChannelId(row.channel.id)}
            >
              <span>
                <span className="block font-medium">{row.channel.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {row.channel.input?.control ?? '-'}
                </span>
              </span>
              <Badge variant={row.shortcutKeys.length > 0 ? 'secondary' : 'outline'}>
                <Keyboard className="mr-1 h-3 w-3" />
                {row.disabled
                  ? t('devices.inputBinding.disabled')
                  : formatShortcutKeys(row.shortcutKeys, t)}
              </Badge>
            </Button>
          ))}
        </div>
        {selectedRow?.disabled ? (
          <p className="rounded-md border border-muted bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t('devices.inputTest.disabledHint', {
              shortcut: formatShortcutKeys(selectedRow.configuredShortcutKeys, t)
            })}
          </p>
        ) : null}
        {recentInputEvent ? (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            <span className="font-medium">{t('devices.inputTest.recentEvent')}</span>
            <span className="ml-2">
              {recentInputEvent.control} · {recentInputEvent.action} · #{recentInputEvent.seq}
            </span>
          </div>
        ) : null}
        {selectedRow?.disabled ? null : selectedRow?.shortcutKeys.length ? (
          <ShortcutKeyboardPanel
            selectedKey=""
            highlightedKeys={selectedRow.shortcutKeys}
            onSelectKey={() => undefined}
          />
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            {t('devices.inputTest.unconfiguredHint')}
          </p>
        )}
      </CardContent>
    </Card>
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

function formatShortcutKeys(keys: string[], t: ReturnType<typeof useI18n>) {
  if (keys.length === 0) {
    return t('devices.inputBinding.unconfigured');
  }
  return keys.join(' + ');
}
