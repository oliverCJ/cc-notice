import { useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  isSupportedShortcutPrimaryKey,
  shortcutModifierKeys,
  ShortcutKeyboardPanel
} from '@/components/shortcut/ShortcutKeyboardPanel';
import { DeviceChannel, DeviceInputBinding } from '@/api/tauriApi';
import { useI18n } from '@/i18n';

const modifierKeys = shortcutModifierKeys;

type DeviceInputBindingDialogProps = {
  open: boolean;
  deviceId: string | null;
  channel: DeviceChannel | null;
  binding: DeviceInputBinding | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (binding: DeviceInputBinding) => void;
};

export function DeviceInputBindingDialog({
  open,
  deviceId,
  channel,
  binding,
  saving,
  onOpenChange,
  onSave
}: DeviceInputBindingDialogProps) {
  const t = useI18n();
  const initialState = createInitialDialogState(binding);
  const [enabled, setEnabled] = useState(initialState.enabled);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>(initialState.selectedModifiers);
  const [primaryKey, setPrimaryKey] = useState(initialState.primaryKey);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  useEffect(() => {
    const nextState = createInitialDialogState(binding);
    setEnabled(nextState.enabled);
    setSelectedModifiers(nextState.selectedModifiers);
    setPrimaryKey(nextState.primaryKey);
    setCapturing(false);
    setCaptureError(null);
  }, [binding, open]);

  useEffect(() => {
    if (!capturing) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();

      const modifiers = modifiersFromEvent(event);
      setSelectedModifiers(modifiers);
      const nextPrimaryKey = normalizeKeyboardEventPrimaryKey(event);
      if (!nextPrimaryKey) {
        return;
      }
      if (!isSupportedShortcutPrimaryKey(nextPrimaryKey)) {
        setCaptureError(t('devices.inputBinding.unsupportedKey'));
        return;
      }
      setPrimaryKey(nextPrimaryKey);
      setCaptureError(null);
      setCapturing(false);
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [capturing, t]);

  const keys = useMemo(
    () => [...modifierKeys.filter((key) => selectedModifiers.includes(key)), primaryKey].filter(Boolean),
    [primaryKey, selectedModifiers]
  );
  const validationError = validateShortcutKeys(keys, t);

  function toggleModifier(key: string) {
    setSelectedModifiers((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function handleSave() {
    if (!deviceId || !channel || validationError) {
      return;
    }
    onSave({
      id: binding?.id ?? `${deviceId}:${channel.id}:press`,
      enabled,
      deviceId,
      channelId: channel.id,
      trigger: 'press',
      action: {
        type: 'keyboard-shortcut',
        shortcut: { keys }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" role="dialog" aria-label={t('devices.inputBinding.title')}>
        <DialogHeader>
          <DialogTitle>{t('devices.inputBinding.title')}</DialogTitle>
          <DialogDescription>
            {channel
              ? t('devices.inputBinding.descriptionForChannel', { channel: channel.label })
              : t('devices.inputBinding.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>{t('devices.inputBinding.enabled')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('devices.inputBinding.enabledDescription')}
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label>{t('devices.inputBinding.primaryKey')}</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('devices.inputBinding.keyboardHint')}
                </p>
              </div>
              <Button
                type="button"
                variant={capturing ? 'default' : 'outline'}
                onClick={() => {
                  setCaptureError(null);
                  setCapturing((current) => !current);
                }}
              >
                {capturing ? t('devices.inputBinding.stopCapture') : t('devices.inputBinding.captureShortcut')}
              </Button>
            </div>
            {capturing ? (
              <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                {t('devices.inputBinding.captureHint')}
              </p>
            ) : null}
            {captureError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {captureError}
              </p>
            ) : null}
            <ShortcutKeyboardPanel
              selectedKey={primaryKey}
              selectedModifiers={selectedModifiers}
              highlightedKeys={capturing ? keys : []}
              onSelectKey={(key) => {
                setCaptureError(null);
                setPrimaryKey(key);
              }}
              onToggleModifier={toggleModifier}
            />
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Keyboard className="h-4 w-4" />
              {keys.join(' + ')}
            </div>
            <p className="mt-1 text-muted-foreground">
              {t('devices.inputBinding.focusScopeHint')}
            </p>
            {validationError ? (
              <p className="mt-2 text-destructive">{validationError}</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!deviceId || !channel || saving || Boolean(validationError)}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createInitialDialogState(binding: DeviceInputBinding | null) {
  const keys = binding?.action.shortcut.keys ?? ['Command', 'Enter'];
  return {
    enabled: binding?.enabled ?? true,
    selectedModifiers: keys.filter((key) => modifierKeys.includes(key)),
    primaryKey: keys.find((key) => !modifierKeys.includes(key)) ?? 'Enter'
  };
}

function modifiersFromEvent(event: KeyboardEvent): string[] {
  return modifierKeys.filter((key) => {
    if (key === 'Command') {
      return event.metaKey;
    }
    if (key === 'Control') {
      return event.ctrlKey;
    }
    if (key === 'Alt') {
      return event.altKey;
    }
    if (key === 'Shift') {
      return event.shiftKey;
    }
    if (key === 'Win') {
      return false;
    }
    return false;
  });
}

function normalizeKeyboardEventPrimaryKey(event: KeyboardEvent): string | null {
  if (modifierKeys.includes(normalizeModifierKey(event.key))) {
    return null;
  }
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.replace('Key', '');
  }
  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.replace('Digit', '');
  }
  if (/^F([1-9]|1[0-2])$/.test(event.key)) {
    return event.key;
  }
  const keyMap: Record<string, string> = {
    Escape: 'Escape',
    Esc: 'Escape',
    Enter: 'Enter',
    ' ': 'Space',
    Spacebar: 'Space',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight'
  };
  return keyMap[event.key] ?? null;
}

function normalizeModifierKey(key: string): string {
  if (key === 'Meta' || key === 'OS') {
    return 'Command';
  }
  if (key === 'Control' || key === 'Alt' || key === 'Shift') {
    return key;
  }
  return key;
}

function validateShortcutKeys(keys: string[], t: ReturnType<typeof useI18n>) {
  const primaryCount = keys.filter((key) => !modifierKeys.includes(key)).length;
  if (keys.length === 0 || primaryCount === 0) {
    return t('devices.inputBinding.validation.primaryRequired');
  }
  if (keys.length > 1 && primaryCount !== 1) {
    return t('devices.inputBinding.validation.comboNeedsOnePrimary');
  }
  if (keys.length > 1 && !keys.some((key) => modifierKeys.includes(key))) {
    return t('devices.inputBinding.validation.comboNeedsModifier');
  }
  return null;
}
