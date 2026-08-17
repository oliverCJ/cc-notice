import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { HardwareOutput } from '../../api/tauriApi';
import { SystemNotificationOutputFields } from './SystemNotificationOutputFields';

const output: HardwareOutput = {
  type: 'system-notification',
  durationMs: null,
  text: null,
  notificationLevel: 'info',
  notificationTitle: '{{source}} · {{internalEvent}}',
  notificationBody: '{{last_assistant_message}}',
  notificationTitleMaxChars: 80,
  notificationBodyMaxChars: 300,
  notificationThrottleSeconds: 30,
  notificationSound: 'default',
  webhookMethod: null,
  webhookUrl: null,
  webhookHeaders: null,
  webhookBody: null,
  webhookBodyMaxChars: null
};

describe('SystemNotificationOutputFields', () => {
  test('renders length limits and supported variables without unstable fields', () => {
    render(
      <SystemNotificationOutputFields
        internalEvent="agent.completed"
        output={output}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('标题最大字符数')).toHaveValue(80);
    expect(screen.getByLabelText('内容最大字符数')).toHaveValue(300);
    expect(screen.getByRole('button', { name: '打开变量助手' })).toBeInTheDocument();
    expect(screen.queryByText('变量助手')).not.toBeInTheDocument();
    expect(screen.queryByText('{{ai工具名称}}')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开变量助手' }));
    expect(screen.getByText('变量助手')).toBeInTheDocument();
    expect(screen.queryByText('{{ai工具名称}}')).not.toBeInTheDocument();
    expect(screen.getAllByText('{{prompt}}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{{tool_response}}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{{last_assistant_message}}').length).toBeGreaterThan(0);
    expect(screen.queryByText('{{title}}')).not.toBeInTheDocument();
    expect(screen.queryByText('{{reason}}')).not.toBeInTheDocument();
    expect(screen.queryByText('{{error}}')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开变量助手' }).compareDocumentPosition(screen.getByLabelText('通知标题'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByLabelText('通知限流秒数')).toHaveValue(30);
    expect(screen.getByRole('combobox', { name: '通知声音' })).toBeInTheDocument();
    const platformNotice = screen.getByRole('alert');
    expect(platformNotice).toHaveTextContent('系统通知可能受通知权限、专注模式或勿扰模式影响而不显示。');
    expect(platformNotice.compareDocumentPosition(screen.getByLabelText('通知级别'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByText('通知预览')).toBeInTheDocument();
    expect(screen.getByText('codex · agent.completed')).toBeInTheDocument();
    expect(screen.getByText('已完成代码修改和验证。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: '通知声音' }));
    expect(screen.getByRole('option', { name: '系统默认' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '静音' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /macOS/ })).not.toBeInTheDocument();
  });

  test('updates title body length limits and throttle seconds', () => {
    const onChange = vi.fn();
    render(
      <SystemNotificationOutputFields
        internalEvent="agent.completed"
        output={output}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('标题最大字符数'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('内容最大字符数'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('通知限流秒数'), { target: { value: '0' } });

    expect(onChange).toHaveBeenCalledWith({
      ...output,
      notificationTitleMaxChars: 120
    });
    expect(onChange).toHaveBeenCalledWith({
      ...output,
      notificationBodyMaxChars: 500
    });
    expect(onChange).toHaveBeenCalledWith({
      ...output,
      notificationThrottleSeconds: 0
    });
  });

  test('keeps partial number input editable before committing a valid value', () => {
    const onChange = vi.fn();
    render(
      <SystemNotificationOutputFields
        internalEvent="agent.completed"
        output={output}
        onChange={onChange}
      />
    );

    const titleMaxInput = screen.getByLabelText('标题最大字符数');
    fireEvent.change(titleMaxInput, { target: { value: '0' } });
    expect(titleMaxInput).toHaveValue(0);
    expect(onChange).not.toHaveBeenCalledWith({
      ...output,
      notificationTitleMaxChars: 1
    });

    fireEvent.change(titleMaxInput, { target: { value: '120' } });
    expect(onChange).toHaveBeenCalledWith({
      ...output,
      notificationTitleMaxChars: 120
    });
  });

  test('inserts selected variable into the active notification field', () => {
    const onChange = vi.fn();
    render(
      <SystemNotificationOutputFields
        internalEvent="agent.completed"
        output={output}
        onChange={onChange}
      />
    );

    const bodyInput = screen.getByLabelText('通知内容') as HTMLTextAreaElement;
    fireEvent.focus(bodyInput);
    bodyInput.setSelectionRange(output.notificationBody?.length ?? 0, output.notificationBody?.length ?? 0);
    fireEvent.click(screen.getByRole('button', { name: '打开变量助手' }));
    fireEvent.click(screen.getByRole('button', { name: '插入 模型 变量' }));

    expect(onChange).toHaveBeenCalledWith({
      ...output,
      notificationBody: '{{last_assistant_message}}{{model}}'
    });
  });
});
