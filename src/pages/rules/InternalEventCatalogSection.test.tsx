import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { InternalEventCatalogSection } from './InternalEventCatalogSection';

describe('InternalEventCatalogSection', () => {
  test('renders built-in internal event text from active language', () => {
    render(
      <I18nProvider language="en-US">
        <InternalEventCatalogSection
          internalEvents={[
            {
              id: 'agent.started',
              title: 'AI 开始工作',
              description: '用户提交 prompt 后，AI 开始处理任务。',
              scenario: '用户提交提示',
              builtIn: true
            }
          ]}
        />
      </I18nProvider>
    );

    expect(screen.getByText('AI Started')).toBeInTheDocument();
    expect(screen.getByText('Session start or user prompt submission')).toBeInTheDocument();
    expect(screen.queryByText('AI 开始工作')).not.toBeInTheDocument();
    expect(screen.queryByText('用户提交提示')).not.toBeInTheDocument();
  });

  test('shows custom event actions only for custom events', () => {
    render(
      <I18nProvider language="zh-CN">
        <InternalEventCatalogSection
          internalEvents={[
            {
              id: 'agent.started',
              title: 'AI 开始工作',
              description: '用户提交 prompt 后，AI 开始处理任务。',
              scenario: '用户提交提示',
              builtIn: true
            },
            {
              id: 'review.started.userDefined',
              title: '评审开始',
              description: '代码评审开始',
              scenario: '用户提交 review 请求',
              builtIn: false
            }
          ]}
          onCreateCustomEvent={vi.fn()}
          onUpdateCustomEvent={vi.fn()}
          onDeleteCustomEvent={vi.fn()}
        />
      </I18nProvider>
    );

    expect(screen.getByRole('button', { name: '新增自定义事件' })).toBeInTheDocument();
    expect(screen.getByText('自定义')).toBeInTheDocument();
    expect(screen.getByText('内置')).toBeInTheDocument();
    expect(
      screen.getByTestId('custom-internal-event-edit-review.started.userDefined')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('custom-internal-event-delete-review.started.userDefined')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('custom-internal-event-edit-agent.started')).not.toBeInTheDocument();
    expect(screen.queryByTestId('custom-internal-event-delete-agent.started')).not.toBeInTheDocument();
  });

  test('keeps delete dialog open and shows error when delete is rejected', async () => {
    const onDeleteCustomEvent = vi.fn();
    function TestHarness() {
      const [error, setError] = useState<string>();
      return (
        <I18nProvider language="zh-CN">
          <InternalEventCatalogSection
            internalEvents={[
              {
                id: 'review.started.userDefined',
                title: '评审开始',
                description: '代码评审开始',
                scenario: '用户提交 review 请求',
                builtIn: false
              }
            ]}
            customEventError={error}
            onClearCustomEventError={() => setError(undefined)}
            onCreateCustomEvent={vi.fn()}
            onUpdateCustomEvent={vi.fn()}
            onDeleteCustomEvent={(eventId) => {
              onDeleteCustomEvent(eventId);
              setError('被 工作方案 引用');
              return Promise.reject(new Error('被 工作方案 引用'));
            }}
          />
        </I18nProvider>
      );
    }
    render(<TestHarness />);

    fireEvent.click(screen.getByTestId('custom-internal-event-delete-review.started.userDefined'));
    const dialog = await screen.findByRole('alertdialog', { name: '删除自定义内部事件' });
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => expect(onDeleteCustomEvent).toHaveBeenCalledWith('review.started.userDefined'));
    expect(await screen.findByText('被 工作方案 引用')).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });

  test('clears stale custom event error before opening another dialog', () => {
    const onClearCustomEventError = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <InternalEventCatalogSection
          internalEvents={[
            {
              id: 'review.started.userDefined',
              title: '评审开始',
              description: '代码评审开始',
              scenario: '用户提交 review 请求',
              builtIn: false
            }
          ]}
          customEventError="旧错误"
          onClearCustomEventError={onClearCustomEventError}
          onCreateCustomEvent={vi.fn()}
          onUpdateCustomEvent={vi.fn()}
          onDeleteCustomEvent={vi.fn()}
        />
      </I18nProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '新增自定义事件' }));

    expect(onClearCustomEventError).toHaveBeenCalled();
  });
});
