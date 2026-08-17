import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { HardwareOutput } from '../../api/tauriApi';
import { WebhookOutputFields } from './WebhookOutputFields';

const output: HardwareOutput = {
  type: 'webhook',
  durationMs: null,
  text: null,
  notificationLevel: null,
  notificationTitle: null,
  notificationBody: null,
  notificationTitleMaxChars: null,
  notificationBodyMaxChars: null,
  notificationThrottleSeconds: null,
  webhookMethod: 'POST',
  webhookUrl: 'https://example.test/hooks',
  webhookHeaders: '{\n  "Content-Type": "application/json"\n}',
  webhookBody: '{\n  "event": "{{internalEvent}}"\n}',
  webhookBodyMaxChars: 8000
};

describe('WebhookOutputFields', () => {
  test('renders variable helper as popover and body length limit', () => {
    render(
      <WebhookOutputFields
        internalEvent="agent.completed"
        output={output}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('请求体最大字符数')).toHaveValue(8000);
    expect(screen.getByText('Webhook 会把配置的请求头和请求体发送到外部地址。插入 prompt、工具响应、工作目录等变量前，请确认目标服务可信。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开变量助手' })).toBeInTheDocument();
    expect(screen.queryByText('变量助手')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开变量助手' }));

    expect(screen.getByText('变量助手')).toBeInTheDocument();
    expect(screen.getByText('{{internalEvent}}')).toBeInTheDocument();
    expect(screen.getAllByText('{{last_assistant_message}}').length).toBeGreaterThan(0);
  });

  test('inserts selected variable into webhook body', () => {
    const onChange = vi.fn();
    render(
      <WebhookOutputFields
        internalEvent="agent.completed"
        output={output}
        onChange={onChange}
      />
    );

    const bodyInput = screen.getByLabelText('请求体（JSON 格式，可选）') as HTMLTextAreaElement;
    fireEvent.focus(bodyInput);
    bodyInput.setSelectionRange(output.webhookBody?.length ?? 0, output.webhookBody?.length ?? 0);
    fireEvent.click(screen.getByRole('button', { name: '打开变量助手' }));
    fireEvent.click(screen.getByRole('button', { name: '插入 模型 变量' }));

    expect(onChange).toHaveBeenCalledWith({
      ...output,
      webhookBody: '{\n  "event": "{{internalEvent}}"\n}{{model}}'
    });
  });

  test('hides body settings when method is GET', () => {
    render(
      <WebhookOutputFields
        internalEvent="agent.completed"
        output={{ ...output, webhookMethod: 'GET' }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('请求体（JSON 格式，可选）')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('请求体最大字符数')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/请求头/)).toBeInTheDocument();
  });

  test('keeps partial number input editable before committing a valid value', () => {
    const onChange = vi.fn();
    render(
      <WebhookOutputFields
        internalEvent="agent.completed"
        output={output}
        onChange={onChange}
      />
    );

    const bodyMaxInput = screen.getByLabelText('请求体最大字符数');
    fireEvent.change(bodyMaxInput, { target: { value: '0' } });
    expect(bodyMaxInput).toHaveValue(0);
    expect(onChange).not.toHaveBeenCalledWith({
      ...output,
      webhookBodyMaxChars: 1
    });

    fireEvent.change(bodyMaxInput, { target: { value: '1200' } });
    expect(onChange).toHaveBeenCalledWith({
      ...output,
      webhookBodyMaxChars: 1200
    });
  });
});
