import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { HookEventSelectionPanel } from './HookEventSelectionPanel';

describe('HookEventSelectionPanel', () => {
  test('renders hook event text from active language', () => {
    render(
      <I18nProvider language="en-US">
        <HookEventSelectionPanel
          onApplyRecommended={vi.fn()}
          onToggleEvent={vi.fn()}
          selectedEvents={['UserPromptSubmit']}
          selectedToolId="codex"
          visibleEvents={[
            {
              source: 'codex',
              event: 'UserPromptSubmit',
              title: '用户提交提示',
              description: '用户向 Codex 提交新提示时触发。',
              scenario: '用于提示新一轮 AI 工作即将开始。',
              defaultSelected: true,
              mappedNoticeEvent: 'agent.started'
            }
          ]}
        />
      </I18nProvider>
    );

    expect(screen.getByText('User Prompt Submitted')).toBeInTheDocument();
    expect(
      screen.getByText('Triggered when the user submits a new prompt to Codex.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Use it to indicate that a new AI work cycle is about to begin.')
    ).toBeInTheDocument();
    expect(screen.queryByText('用户提交提示')).not.toBeInTheDocument();
  });
});
