import { fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { HardwareOutput } from '@/api/tauriApi';
import { I18nProvider } from '@/i18n';
import { DisplayOutputFields } from './DisplayOutputFields';

function renderWithI18n(ui: ReactElement) {
  return render(<I18nProvider language="zh-CN">{ui}</I18nProvider>);
}

const output: HardwareOutput = {
  type: 'display',
  durationMs: 5000,
  channelActions: [],
  text: null,
  notificationLevel: null,
  notificationTitle: null,
  notificationBody: null,
  notificationTitleMaxChars: null,
  notificationBodyMaxChars: null,
  notificationThrottleSeconds: null,
  notificationSound: null,
  webhookMethod: null,
  webhookUrl: null,
  webhookHeaders: null,
  webhookBody: null,
  webhookBodyMaxChars: null,
  soundFilePath: null,
  soundVolumePercent: null,
  soundMaxDurationMs: null,
  soundThrottleSeconds: null,
  displayDeviceId: 'desk-wio',
  displayTemplateId: 'task-success',
  displayAccent: 'success',
  displayIcon: 'check',
  displayLinesTemplate: ['{{source}}', 'Finished'],
  displayStatus: 'success',
  displayTitleTemplate: '{{display.title}}',
  displayMessageTemplate: '{{display.lines}}',
  displayTitleMaxChars: 39,
  displayMessageMaxChars: 95,
  displayExpireBehavior: 'restore-status'
};

describe('DisplayOutputFields', () => {
  test('uses display scene instead of a separate status selector in standard mode', () => {
    renderWithI18n(
      <DisplayOutputFields
        output={output}
        displayDeviceOptions={[{ value: 'desk-wio', label: 'Desk Wio' }]}
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
    renderWithI18n(
      <DisplayOutputFields
        output={output}
        displayDeviceOptions={[{ value: 'desk-wio', label: 'Desk Wio' }]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '显示场景' }));
    fireEvent.click(screen.getByRole('option', { name: '处理中' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        displayTemplateId: 'task-running',
        displayAccent: 'working',
        displayIcon: 'spinner',
        displayStatus: 'working',
        displayTitleTemplate: '{{display.title}}',
        displayMessageTemplate: '{{display.lines}}',
        displayLinesTemplate: ['{{source}}', 'Running']
      })
    );
  });

  test('edits display title and message templates', () => {
    const onChange = vi.fn();
    renderWithI18n(
      <DisplayOutputFields
        output={output}
        displayDeviceOptions={[{ value: 'desk-wio', label: 'Desk Wio' }]}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '高级自定义显示内容' }));
    fireEvent.change(screen.getByLabelText('标题模板'), {
      target: { value: '{{source}} done' }
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ displayTitleTemplate: '{{source}} done' })
    );

    fireEvent.change(screen.getByLabelText('内容模板'), {
      target: { value: '{{error}}' }
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ displayMessageTemplate: '{{error}}' })
    );
  });

  test('does not show display duration until firmware protocol supports it', () => {
    renderWithI18n(
      <DisplayOutputFields
        output={output}
        displayDeviceOptions={[{ value: 'desk-wio', label: 'Desk Wio' }]}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('显示时长')).not.toBeInTheDocument();
  });

  test('renders variable helper for display title and message templates', () => {
    renderWithI18n(
      <DisplayOutputFields
        output={output}
        displayDeviceOptions={[{ value: 'desk-wio', label: 'Desk Wio' }]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '打开变量助手' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '高级自定义显示内容' }));
    fireEvent.click(screen.getByRole('button', { name: '打开变量助手' }));
    expect(screen.getByRole('region', { name: '变量助手' })).toBeInTheDocument();
  });

  test('keeps partial number input editable before committing a valid value', () => {
    const onChange = vi.fn();
    renderWithI18n(
      <DisplayOutputFields
        output={output}
        displayDeviceOptions={[{ value: 'desk-wio', label: 'Desk Wio' }]}
        onChange={onChange}
      />
    );

    const titleMaxInput = screen.getByLabelText('标题最大字符数');
    fireEvent.change(titleMaxInput, { target: { value: '0' } });
    expect(titleMaxInput).toHaveValue(0);
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ displayTitleMaxChars: 1 })
    );

    fireEvent.change(titleMaxInput, { target: { value: '20' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ displayTitleMaxChars: 20 })
    );
  });
});
