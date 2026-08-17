import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DeviceChannel, DeviceInputBinding } from '@/api/tauriApi';
import { I18nProvider } from '@/i18n';
import { DeviceInputBindingDialog } from './DeviceInputBindingDialog';

describe('DeviceInputBindingDialog', () => {
  test('captures a real keyboard shortcut and saves it as device input binding keys', () => {
    const onSave = vi.fn();

    renderDialog({ onSave });

    fireEvent.click(screen.getByRole('button', { name: '监听按键' }));
    fireEvent.keyDown(window, {
      key: 'Enter',
      code: 'Enter',
      metaKey: true,
      shiftKey: true
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        action: {
          type: 'keyboard-shortcut',
          shortcut: {
            keys: ['Command', 'Shift', 'Enter']
          }
        }
      })
    );
  });

  test('uses visual keyboard buttons for primary key selection', () => {
    const onSave = vi.fn();

    renderDialog({ onSave });

    fireEvent.click(screen.getByRole('button', { name: 'Escape' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          shortcut: {
            keys: ['Command', 'Escape']
          }
        })
      })
    );
  });

  test('opens directly with saved shortcut keys when a binding already exists', () => {
    renderDialog({
      onSave: vi.fn(),
      binding: {
        id: 'wio-terminal-1:button.a:press',
        enabled: true,
        deviceId: 'wio-terminal-1',
        channelId: 'button.a',
        trigger: 'press',
        action: {
          type: 'keyboard-shortcut',
          shortcut: { keys: ['Control', 'Shift', 'Escape'] }
        }
      }
    });

    expect(screen.getByRole('button', { name: 'Control' })).toHaveAttribute(
      'data-key-state',
      'selected'
    );
    expect(screen.getByRole('button', { name: 'Shift' })).toHaveAttribute(
      'data-key-state',
      'selected'
    );
    expect(screen.getByRole('button', { name: 'Escape' })).toHaveAttribute(
      'data-key-state',
      'selected'
    );
    expect(screen.getByText('Control + Shift + Escape')).toBeInTheDocument();
    expect(screen.queryByText('Command + Enter')).not.toBeInTheDocument();
  });
});

function renderDialog({
  onSave,
  binding = null
}: {
  onSave: (binding: DeviceInputBinding) => void;
  binding?: DeviceInputBinding | null;
}) {
  return render(
    <I18nProvider language="zh-CN">
      <DeviceInputBindingDialog
        open
        deviceId="wio-terminal-1"
        channel={createInputChannel()}
        binding={binding}
        saving={false}
        onOpenChange={() => undefined}
        onSave={onSave}
      />
    </I18nProvider>
  );
}

function createInputChannel(): DeviceChannel {
  return {
    id: 'button.a',
    label: 'Button A',
    kind: 'button-input',
    direction: 'input',
    description: null,
    physicalPin: null,
    digitalOutput: null,
    pwmOutput: null,
    buzzer: null,
    addressableLed: null,
    input: {
      control: 'BUTTON_A',
      inputKind: 'button',
      fixed: true
    },
    supportedActions: [],
    hardwareGuideId: null
  };
}
