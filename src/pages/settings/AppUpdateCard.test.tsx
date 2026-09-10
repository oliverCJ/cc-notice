import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import type { AppUpdateState } from '@/domain/appUpdate';
import { AppUpdateCard } from './AppUpdateCard';

const availableState: AppUpdateState = {
  status: 'update-available',
  result: {
    currentVersion: '1.1.1',
    latestVersion: '1.2.0',
    status: 'update-available',
    releaseName: 'CC Notice 1.2.0',
    releaseBody: '修复设备连接问题\n新增版本检测。',
    publishedAt: '2026-09-09T00:00:00Z',
    releaseUrl: 'https://github.com/oliverCJ/cc-notice/releases/tag/v1.2.0',
  },
  error: null,
  lastCheckedAt: Date.parse('2026-09-09T01:00:00Z'),
  checking: false,
};

function renderCard(state: AppUpdateState = availableState) {
  return render(
    <I18nProvider language="zh-CN">
      <AppUpdateCard onCheck={vi.fn()} onOpenDownload={vi.fn()} state={state} />
    </I18nProvider>
  );
}

describe('AppUpdateCard', () => {
  test('shows release notes and opens the release download page', () => {
    const onOpenDownload = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <AppUpdateCard onCheck={vi.fn()} onOpenDownload={onOpenDownload} state={availableState} />
      </I18nProvider>
    );

    expect(screen.getByText('发布版本：CC Notice 1.2.0')).toBeInTheDocument();
    expect(screen.getByText(/修复设备连接问题/)).toBeInTheDocument();
    expect(screen.getByText(/新增版本检测/)).toBeInTheDocument();
    const notesLabel = screen.getByText('发布说明', { exact: true });
    expect(notesLabel).toBeInTheDocument();
    expect(notesLabel.nextElementSibling).toHaveClass('max-h-56');

    fireEvent.click(screen.getByRole('button', { name: '打开下载页面' }));
    expect(onOpenDownload).toHaveBeenCalledWith(availableState.result?.releaseUrl);
  });

  test('shows an empty release note fallback and disables the check button while checking', () => {
    renderCard({
      ...availableState,
      checking: true,
      result: { ...availableState.result!, releaseBody: '' },
    });

    expect(screen.getByText('暂无发布说明。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '检查中...' })).toBeDisabled();
  });

  test('shows an error without hiding the previous release result', () => {
    renderCard({ ...availableState, status: 'error', error: '网络不可用' });

    expect(screen.getByText('检查新版本失败：网络不可用')).toBeInTheDocument();
    expect(screen.getByText('发布版本：CC Notice 1.2.0')).toBeInTheDocument();
  });
});
