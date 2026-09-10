import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { AppSidebarInfo } from './AppSidebarInfo';

describe('AppSidebarInfo', () => {
  test('keeps the normal version card when no update is available', () => {
    render(
      <I18nProvider language="zh-CN">
        <AppSidebarInfo />
      </I18nProvider>
    );

    expect(screen.getByText('v1.1.1')).toBeInTheDocument();
    expect(screen.getByText('OliverCJ')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('makes the whole version card clickable when an update is available', () => {
    const onOpenUpdate = vi.fn();
    render(
      <I18nProvider language="zh-CN">
        <AppSidebarInfo latestVersion="1.2.0" onOpenUpdate={onOpenUpdate} updateAvailable />
      </I18nProvider>
    );

    const button = screen.getByRole('button', {
      name: '发现新版本 1.2.0，点击打开下载页面',
    });
    expect(button).toHaveClass('bg-amber-100');
    expect(screen.getByText('发现新版本：v1.2.0')).toBeInTheDocument();

    fireEvent.click(button);
    expect(onOpenUpdate).toHaveBeenCalledTimes(1);
  });
});
