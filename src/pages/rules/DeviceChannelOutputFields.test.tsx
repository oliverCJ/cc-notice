import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DeviceChannelRuleAction, HardwareOutput } from '../../api/tauriApi';
import { DeviceChannelOutputFields } from './DeviceChannelOutputFields';
import { getBoardAvailableChannels } from '@/domain/boards/boardCatalog';
import { toChannelSelectOption } from './deviceChannelOptions';

const output: HardwareOutput = {
  type: 'device-channel',
  durationMs: null,
  channelActions: [baseAction()],
  text: null
};

function baseAction(): DeviceChannelRuleAction {
  return {
    id: 'action-1',
    deviceId: 'rp2040-pico-default',
    channelId: 'pin.gp2',
    channelAction: 'activate',
    durationMs: 5000,
    intervalMs: null,
    dutyPercent: null,
    frequencyHz: null,
    color: null,
    brightnessPercent: null
  };
}

function outputWithAction(patch: Partial<DeviceChannelRuleAction>): HardwareOutput {
  return {
    ...output,
    channelActions: [{ ...baseAction(), ...patch }]
  };
}

describe('DeviceChannelOutputFields', () => {
  test('locks device and channel fields when editing an existing rule', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        lockIdentityFields={true}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: '设备' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '通道' })).toBeDisabled();
  });

  test('allows action changes while identity fields are locked', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        lockIdentityFields={true}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));
    fireEvent.click(screen.getByRole('option', { name: '闪烁' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'device-channel',
        channelActions: [
          expect.objectContaining({
            deviceId: 'rp2040-pico-default',
            channelId: 'pin.gp2',
            channelAction: 'blink'
          })
        ]
      })
    );
  });

  test('uses board channel capabilities instead of fixed three channels', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '通道' }));

    expect(screen.getByRole('option', { name: 'GP28 · Pin 34' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'GP16 WS2812' })).not.toBeInTheDocument();
  });

  test('uses configured device channels when provided instead of all board pins', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        deviceOptions={[
          {
            value: 'rp2040-pico-default',
            label: 'RP2040 默认设备',
            channels: [
              {
                value: 'pin.gp2',
                label: 'GP2 · Pin 4',
                kind: 'digital-output',
                supportedActions: ['activate', 'deactivate', 'blink', 'pulse'],
                hardwareGuideId: 'digital-output'
              }
            ]
          }
        ]}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '通道' }));

    expect(screen.getByRole('option', { name: 'GP2 · Pin 4' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'GP28' })).not.toBeInTheDocument();
  });

  test('formats configured Pro Micro channels with board pin labels', () => {
    const proMicroChannels = getBoardAvailableChannels('sparkfun-pro-micro-32u4')
      .filter((channel) => channel.id === 'pin.a0' || channel.id === 'pin.d3')
      .map((channel) => toChannelSelectOption(channel, 'sparkfun-pro-micro-32u4'));

    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          deviceId: 'desk-pro-micro',
          channelId: 'pin.a0'
        })}
        deviceOptions={[
          {
            value: 'desk-pro-micro',
            label: 'Desk Pro Micro',
            boardId: 'sparkfun-pro-micro-32u4',
            channels: proMicroChannels
          }
        ]}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '通道' }));

    expect(screen.getByRole('option', { name: 'A0' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /GP18/ })).not.toBeInTheDocument();
  });

  test('does not fall back to all board pins when configured device has no channels', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({ channelId: '' })}
        deviceOptions={[
          {
            value: 'rp2040-pico-default',
            label: 'RP2040 默认设备',
            channels: []
          }
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('option', { name: 'GP28 · Pin 34' })).not.toBeInTheDocument();
    expect(screen.getByText('当前设备尚未启用可用通道，请先到设备页添加通道。')).toBeInTheDocument();
  });

  test('hides pwm and ws2812 channel types from default board capabilities', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '通道类型' }));

    expect(screen.queryByRole('option', { name: 'PWM 输出' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '可寻址 LED' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '数字输出' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '蜂鸣器' })).toBeInTheDocument();
  });

  test('filters channels and actions by selected channel type', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '通道类型' }));
    fireEvent.click(screen.getByRole('option', { name: '蜂鸣器' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'device-channel',
        channelActions: [
          expect.objectContaining({
            channelId: 'buzzer.gp18',
            channelAction: 'beep'
          })
        ]
      })
    );
  });

  test('preserves compatible channel action parameters when switching devices', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          channelAction: 'blink',
          durationMs: 20000,
          intervalMs: 800
        })}
        deviceOptions={[
          {
            value: 'desk-pico',
            label: '桌面 Pico',
            channels: [
              {
                value: 'pin.gp2',
                label: 'GP2 · Pin 4',
                kind: 'digital-output',
                supportedActions: ['activate', 'blink', 'pulse'],
                hardwareGuideId: 'digital-output'
              }
            ]
          },
          {
            value: 'lab-pico',
            label: '实验 Pico',
            channels: [
              {
                value: 'pin.gp4',
                label: 'GP4 · Pin 6',
                kind: 'digital-output',
                supportedActions: ['activate', 'blink', 'pulse'],
                hardwareGuideId: 'digital-output'
              }
            ]
          }
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '设备' }));
    fireEvent.click(screen.getByRole('option', { name: '实验 Pico' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'device-channel',
        channelActions: [
          expect.objectContaining({
            deviceId: 'lab-pico',
            channelId: 'pin.gp4',
            channelAction: 'blink',
            durationMs: 20000,
            intervalMs: 800
          })
        ]
      })
    );
  });

  test('resets action parameters only when the target device does not support the current action', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          channelAction: 'blink',
          durationMs: 20000,
          intervalMs: 800
        })}
        deviceOptions={[
          {
            value: 'desk-pico',
            label: '桌面 Pico',
            channels: [
              {
                value: 'pin.gp2',
                label: 'GP2 · Pin 4',
                kind: 'digital-output',
                supportedActions: ['activate', 'blink', 'pulse'],
                hardwareGuideId: 'digital-output'
              }
            ]
          },
          {
            value: 'relay-board',
            label: '继电器板',
            channels: [
              {
                value: 'pin.gp6',
                label: 'GP6 · Pin 9',
                kind: 'digital-output',
                supportedActions: ['activate', 'deactivate'],
                hardwareGuideId: 'digital-output'
              }
            ]
          }
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '设备' }));
    fireEvent.click(screen.getByRole('option', { name: '继电器板' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'device-channel',
        channelActions: [
          expect.objectContaining({
            deviceId: 'relay-board',
            channelId: 'pin.gp6',
            channelAction: 'activate',
            durationMs: 5000,
            intervalMs: null
          })
        ]
      })
    );
  });

  test('hides explicit legacy pwm channels from rule channel options', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          channelId: 'pwm.gp15',
          channelAction: 'set-duty',
          dutyPercent: 50
        })}
        deviceOptions={[
          {
            value: 'rp2040-pico-default',
            label: 'RP2040 默认设备',
            channels: [
              {
                value: 'pwm.gp15',
                label: 'GP15 PWM',
                kind: 'pwm-output',
                supportedActions: ['set-duty', 'pulse', 'clear'],
                hardwareGuideId: 'pwm-output'
              }
            ]
          }
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('当前设备尚未启用可用通道，请先到设备页添加通道。')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: '占空比（%）' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'PWM 输出' })).not.toBeInTheDocument();
  });

  test('hides ambiguous clear action for digital output channels', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));

    expect(screen.getByRole('option', { name: '激活' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '停用' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '清除' })).not.toBeInTheDocument();
  });

  test('hides explicit legacy addressable led channels from rule channel options', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          channelId: 'ws2812.gp16',
          channelAction: 'set-color',
          color: '#33ccff',
          brightnessPercent: 30
        })}
        deviceOptions={[
          {
            value: 'rp2040-pico-default',
            label: 'RP2040 默认设备',
            channels: [
              {
                value: 'ws2812.gp16',
                label: 'GP16 · Pin 21',
                kind: 'addressable-led',
                supportedActions: ['set-color', 'clear'],
                hardwareGuideId: 'addressable-led'
              }
            ]
          }
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('当前设备尚未启用可用通道，请先到设备页添加通道。')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '可寻址 LED' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '设置颜色' })).not.toBeInTheDocument();
  });

  test('adds pattern action for legacy Wio buzzer channel from device extension capability', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          deviceId: 'desk-wio',
          channelId: 'buzzer.onboard',
          channelAction: 'beep',
          frequencyHz: 2000
        })}
        deviceOptions={[
          {
            value: 'desk-wio',
            label: 'Desk Wio',
            boardId: 'seeed-wio-terminal',
            deviceExtensions: {
              display: null,
              buzzer: { patterns: ['notice', 'success', 'warning', 'error', 'working'] },
              inputs: null
            },
            channels: [
              {
                value: 'buzzer.onboard',
                label: 'Onboard buzzer',
                kind: 'buzzer',
                supportedActions: ['beep', 'tone', 'clear'],
                hardwareGuideId: 'buzzer'
              }
            ]
          }
        ]}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));

    expect(screen.getByRole('option', { name: '提示音模式' })).toBeInTheDocument();
  });

  test('shows pattern action for Pico channelized buzzer', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          deviceId: 'desk-pico',
          channelId: 'buzzer.gp19',
          channelAction: 'beep',
          frequencyHz: 2000
        })}
        deviceOptions={[
          {
            value: 'desk-pico',
            label: 'Desk Pico',
            boardId: 'rp2040-pico',
            deviceExtensions: {
              display: null,
              buzzer: null,
              inputs: null
            },
            channels: [
              {
                value: 'buzzer.gp19',
                label: 'GP19 Buzzer',
                kind: 'buzzer',
                supportedActions: ['beep', 'tone', 'pattern', 'clear'],
                hardwareGuideId: 'buzzer'
              }
            ]
          }
        ]}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));

    expect(screen.getByRole('option', { name: '提示音模式' })).toBeInTheDocument();
  });

  test('shows display status action only for devices with display capability', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          deviceId: 'desk-wio',
          channelId: 'display',
          channelAction: 'display-status',
          displayStatus: 'notice',
          displayTitleTemplate: '{{source}}',
          displayMessageTemplate: '{{last_assistant_message}}'
        })}
        deviceOptions={[
          {
            value: 'desk-wio',
            label: 'Desk Wio',
            boardId: 'seeed-wio-terminal',
            deviceExtensions: {
              display: {
                status: true,
                clear: true,
                statuses: ['notice', 'working', 'success', 'warning', 'error'],
                titleMaxChars: 39,
                messageMaxChars: 95
              },
              buzzer: null,
              inputs: null
            },
            channels: []
          }
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '通道类型' }));
    fireEvent.click(screen.getByRole('option', { name: '显示屏' }));

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));
    fireEvent.click(screen.getByRole('option', { name: '显示状态' }));

    expect(screen.getByRole('button', { name: '打开变量助手' })).toBeInTheDocument();
  });

  test('shows display status action for Pico OLED 0.91 display devices', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          deviceId: 'desk-oled',
          channelId: 'display',
          channelAction: 'display-status',
          displayStatus: 'notice',
          displayTitleTemplate: '{{display.title}}',
          displayMessageTemplate: '{{display.lines}}'
        })}
        deviceOptions={[
          {
            value: 'desk-oled',
            label: 'Desk OLED 0.91',
            boardId: 'rp2040-pico-oled-091',
            deviceExtensions: {
              display: {
                status: true,
                clear: true,
                statuses: ['notice', 'working', 'success', 'warning', 'error'],
                titleMaxChars: 16,
                messageMaxChars: 16
              },
              buzzer: null,
              inputs: null
            },
            channels: []
          }
        ]}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '通道类型' }));
    expect(screen.getByRole('option', { name: '显示屏' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: '显示屏' }));
    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));

    expect(screen.getByRole('option', { name: '显示状态' })).toBeInTheDocument();
  });

  test('uses selected small display capability for display text limits', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          deviceId: 'desk-oled',
          channelId: 'display',
          channelAction: 'display-status',
          displayStatus: 'notice',
          displayTitleTemplate: '{{source}}',
          displayMessageTemplate: '{{last_assistant_message}}',
          displayTitleMaxChars: 39,
          displayMessageMaxChars: 95
        })}
        deviceOptions={[
          {
            value: 'desk-oled',
            label: 'Desk OLED',
            boardId: 'rp2040-pico-oled-096',
            deviceExtensions: {
              display: {
                status: true,
                clear: true,
                statuses: ['notice', 'working', 'success', 'warning', 'error'],
                titleMaxChars: 16,
                messageMaxChars: 16
              },
              buzzer: null,
              inputs: null
            },
            channels: []
          }
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('标题最大字符数')).toHaveValue(16);
    expect(screen.getByLabelText('内容最大字符数')).toHaveValue(16);
  });

  test('normalizes saved display text limits when selected display capability is smaller', async () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          deviceId: 'desk-oled',
          channelId: 'display',
          channelAction: 'display-status',
          displayStatus: 'notice',
          displayTitleTemplate: '{{source}}',
          displayMessageTemplate: '{{last_assistant_message}}',
          displayTitleMaxChars: 39,
          displayMessageMaxChars: 95
        })}
        deviceOptions={[
          {
            value: 'desk-oled',
            label: 'Desk OLED',
            boardId: 'rp2040-pico-oled-096',
            deviceExtensions: {
              display: {
                status: true,
                clear: true,
                statuses: ['notice', 'working', 'success', 'warning', 'error'],
                titleMaxChars: 16,
                messageMaxChars: 16
              },
              buzzer: null,
              inputs: null
            },
            channels: []
          }
        ]}
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          channelActions: [
            expect.objectContaining({
              displayTitleMaxChars: 16,
              displayMessageMaxChars: 16
            })
          ]
        })
      );
    });
  });

  test('allows selecting a display template for screen output actions', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          deviceId: 'desk-wio',
          channelId: 'display',
          channelAction: 'display-status',
          displayTemplateId: 'task-success',
          displayStatus: 'success',
          displayTitleTemplate: '{{display.title}}',
          displayMessageTemplate: '{{display.lines}}',
          displayTitleMaxChars: 39,
          displayMessageMaxChars: 95
        })}
        deviceOptions={[
          {
            value: 'desk-wio',
            label: 'Desk Wio',
            boardId: 'seeed-wio-terminal',
            deviceExtensions: {
              display: {
                status: true,
                clear: true,
                statuses: ['notice', 'working', 'success', 'warning', 'error'],
                titleMaxChars: 39,
                messageMaxChars: 95
              },
              buzzer: null,
              inputs: null
            },
            channels: []
          }
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: '显示场景' })).toHaveTextContent('任务完成');
    fireEvent.click(screen.getByRole('button', { name: '高级自定义显示内容' }));
    expect(screen.getByDisplayValue('{{display.title}}')).toBeInTheDocument();
    expect(screen.getByDisplayValue('{{display.lines}}')).toBeInTheDocument();
  });

  test('hides free display title and message fields in standard mode', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.completed"
        output={outputWithAction({
          deviceId: 'desk-wio',
          channelId: 'display',
          channelAction: 'display-status',
          displayTemplateId: 'task-success',
          displayStatus: 'success',
          displayTitleTemplate: '{{display.title}}',
          displayMessageTemplate: '{{display.lines}}',
          displayLinesTemplate: ['{{source}}', 'Finished'],
          displayTitleMaxChars: 39,
          displayMessageMaxChars: 95
        })}
        deviceOptions={[
          {
            value: 'desk-wio',
            label: 'Desk Wio',
            boardId: 'seeed-wio-terminal',
            deviceExtensions: {
              display: {
                status: true,
                clear: true,
                statuses: ['notice', 'working', 'success', 'warning', 'error'],
                titleMaxChars: 39,
                messageMaxChars: 95
              },
              buzzer: null,
              inputs: null
            },
            channels: []
          }
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: '显示场景' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '显示状态' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('标题模板')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('内容模板')).not.toBeInTheDocument();
    expect(screen.getByText('高级自定义显示内容')).toBeInTheDocument();
  });

  test('syncs display status and copy when display scene changes', () => {
    const onChange = vi.fn();

    render(
      <DeviceChannelOutputFields
        internalEvent="agent.working"
        output={outputWithAction({
          deviceId: 'desk-wio',
          channelId: 'display',
          channelAction: 'display-status',
          displayTemplateId: 'task-warning',
          displayStatus: 'warning',
          displayTitleTemplate: '{{display.title}}',
          displayMessageTemplate: '{{display.lines}}',
          displayLinesTemplate: ['{{source}}', 'Check status'],
          displayTitleMaxChars: 39,
          displayMessageMaxChars: 95
        })}
        deviceOptions={[
          {
            value: 'desk-wio',
            label: 'Desk Wio',
            boardId: 'seeed-wio-terminal',
            deviceExtensions: {
              display: {
                status: true,
                clear: true,
                statuses: ['notice', 'working', 'success', 'warning', 'error'],
                titleMaxChars: 39,
                messageMaxChars: 95
              },
              buzzer: null,
              inputs: null
            },
            channels: []
          }
        ]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '显示场景' }));
    fireEvent.click(screen.getByRole('option', { name: '处理中' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        channelActions: [
          expect.objectContaining({
            displayTemplateId: 'task-running',
            displayStatus: 'working',
            displayTitleTemplate: '{{display.title}}',
            displayMessageTemplate: '{{display.lines}}',
            displayLinesTemplate: ['{{source}}', 'Running']
          })
        ]
      })
    );
  });

  test('shows ascii validation for advanced display custom text', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.completed"
        output={outputWithAction({
          deviceId: 'desk-wio',
          channelId: 'display',
          channelAction: 'display-status',
          displayTemplateId: 'task-success',
          displayStatus: 'success',
          displayTitleTemplate: '任务完成',
          displayMessageTemplate: '{{display.lines}}',
          displayLinesTemplate: ['{{source}}', 'Finished'],
          displayTitleMaxChars: 39,
          displayMessageMaxChars: 95
        })}
        deviceOptions={[
          {
            value: 'desk-wio',
            label: 'Desk Wio',
            boardId: 'seeed-wio-terminal',
            deviceExtensions: {
              display: {
                status: true,
                clear: true,
                statuses: ['notice', 'working', 'success', 'warning', 'error'],
                titleMaxChars: 39,
                messageMaxChars: 95
              },
              buzzer: null,
              inputs: null
            },
            channels: []
          }
        ]}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '高级自定义显示内容' }));

    expect(screen.getByText('当前屏幕暂不支持中文，请使用英文、数字、符号或变量。')).toBeInTheDocument();
  });

  test('fills safe defaults when action changes to blink', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));
    fireEvent.click(screen.getByRole('option', { name: '闪烁' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'device-channel',
        channelActions: [
          expect.objectContaining({
            channelAction: 'blink',
            durationMs: 5000,
            intervalMs: 500
          })
        ]
      })
    );
  });

  test('fills safe defaults when action changes to breathe', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '动作' }));
    fireEvent.click(screen.getByRole('option', { name: '呼吸' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'device-channel',
        channelActions: [
          expect.objectContaining({
            channelAction: 'breathe',
            durationMs: 5000,
            intervalMs: 1200
          })
        ]
      })
    );
  });

  test('keeps numeric parameter drafts editable and clamps them on blur', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          channelAction: 'blink',
          durationMs: 5000,
          intervalMs: 500
        })}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: '持续时间（毫秒）' }), {
      target: { value: '9999999' }
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: '闪烁间隔（毫秒）' }), {
      target: { value: '1' }
    });

    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({
        channelActions: [expect.objectContaining({ durationMs: 600000 })]
      })
    );
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({
        channelActions: [expect.objectContaining({ intervalMs: 100 })]
      })
    );
    fireEvent.blur(screen.getByRole('spinbutton', { name: '持续时间（毫秒）' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        channelActions: [expect.objectContaining({ durationMs: 600000 })]
      })
    );
    fireEvent.blur(screen.getByRole('spinbutton', { name: '闪烁间隔（毫秒）' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        channelActions: [expect.objectContaining({ intervalMs: 100 })]
      })
    );
  });

  test('warns when another output type reuses the same physical pin without blocking edits', () => {
    const onChange = vi.fn();
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={outputWithAction({
          channelId: 'pwm.gp2',
          channelAction: 'set-duty',
          dutyPercent: 50
        })}
        channelOptions={[
          {
            value: 'pin.gp2',
            label: 'GP2 · Pin 4',
            kind: 'digital-output',
            supportedActions: ['activate', 'deactivate', 'blink', 'pulse'],
            hardwareGuideId: 'digital-output',
            sourceChannel: {
              id: 'pin.gp2',
              label: 'GP2',
              kind: 'digital-output',
              physicalPin: 4,
              digitalOutput: {
                pin: 2,
                activeLevel: 'high',
                defaultLevel: 'low',
                allowBlink: true
              },
              pwmOutput: null,
              buzzer: null,
              addressableLed: null,
              supportedActions: ['activate', 'deactivate', 'blink', 'pulse'],
              hardwareGuideId: 'digital-output'
            }
          },
          {
            value: 'pwm.gp2',
            label: 'GP2 PWM · Pin 4',
            kind: 'pwm-output',
            supportedActions: ['set-duty', 'pulse', 'clear'],
            hardwareGuideId: 'pwm-output',
            sourceChannel: {
              id: 'pwm.gp2',
              label: 'GP2 PWM',
              kind: 'pwm-output',
              physicalPin: 4,
              digitalOutput: null,
              pwmOutput: {
                pin: 2,
                frequencyHz: 1000,
                defaultDutyPercent: 0,
                maxDutyPercent: 100
              },
              buzzer: null,
              addressableLed: null,
              supportedActions: ['set-duty', 'pulse', 'clear'],
              hardwareGuideId: 'pwm-output'
            }
          }
        ]}
        onChange={onChange}
      />
    );

    expect(screen.getByText(/当前引脚已在 GP2 · Pin 4 中配置/)).toBeInTheDocument();
    expect(screen.getByText(/重复配置会按触发顺序相互覆盖硬件动作/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '动作' })).toBeEnabled();
  });

  test('opens hardware guide for selected rule channel', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        deviceOptions={[
          {
            value: 'rp2040-pico-default',
            label: 'RP2040 默认设备',
            channels: [
              {
                value: 'pin.gp2',
                label: 'GP2 · Pin 4',
                kind: 'digital-output',
                supportedActions: ['activate', 'deactivate', 'blink', 'pulse'],
                hardwareGuideId: 'digital-output'
              }
            ]
          }
        ]}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '查看 GP2 · Pin 4 连接说明' }));

    expect(screen.getByRole('dialog', { name: '数字输出连接助手' })).toBeInTheDocument();
    expect(screen.getByText('适合普通 LED、继电器输入和低压数字触发模块。')).toBeInTheDocument();
  });

  test('shows fallback guide for unknown guide id', () => {
    render(
      <DeviceChannelOutputFields
        internalEvent="agent.running"
        output={output}
        channelOptions={[
          {
            value: 'custom.gp9',
            label: 'GP9 Custom',
            kind: 'digital-output',
            supportedActions: ['activate'],
            hardwareGuideId: 'missing-guide'
          }
        ]}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '查看 GP9 Custom 连接说明' }));

    expect(screen.getByRole('dialog', { name: '硬件连接助手' })).toBeInTheDocument();
    expect(screen.getByText('当前通道没有专用连接说明。')).toBeInTheDocument();
  });
});
