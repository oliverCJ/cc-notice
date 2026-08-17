import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';
import { I18nProvider } from '@/i18n';

test('hides nav items marked as hidden', () => {
  render(
    <I18nProvider language="zh-CN">
      <AppShell activePage="setup" onPageChange={vi.fn()}>
        <div>content</div>
      </AppShell>
    </I18nProvider>
  );

  expect(screen.getByRole('button', { name: '接入配置' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '设备' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '固件' })).toBeInTheDocument();
});

test('renders nav labels from the active language', () => {
  render(
    <I18nProvider language="en-US">
      <AppShell activePage="setup" onPageChange={vi.fn()}>
        <div>content</div>
      </AppShell>
    </I18nProvider>
  );

  expect(screen.getByRole('button', { name: 'Setup' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hook Settings' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '接入配置' })).not.toBeInTheDocument();
});

test('renders app logo in the brand area', () => {
  render(
    <I18nProvider language="zh-CN">
      <AppShell activePage="setup" onPageChange={vi.fn()}>
        <div>content</div>
      </AppShell>
    </I18nProvider>
  );

  expect(screen.getByAltText('CC Notice')).toBeInTheDocument();
});

test('renders sidebar app version and developer information', () => {
  render(
    <I18nProvider language="zh-CN">
      <AppShell activePage="setup" onPageChange={vi.fn()}>
        <div>content</div>
      </AppShell>
    </I18nProvider>
  );

  expect(screen.getByText('v1.1.1')).toBeInTheDocument();
  expect(screen.getByText('开发者')).toBeInTheDocument();
  expect(screen.getByText('OliverCJ')).toBeInTheDocument();
});

test('keeps sidebar information inside the viewport on long pages', () => {
  render(
    <I18nProvider language="zh-CN">
      <AppShell activePage="hook-settings" onPageChange={vi.fn()}>
        <div style={{ height: 2400 }}>long page content</div>
      </AppShell>
    </I18nProvider>
  );

  const nav = screen.getByRole('navigation', { name: '主导航' });
  const sidebar = nav.closest('aside');

  expect(sidebar).toHaveClass('sticky', 'top-0', 'h-screen', 'overflow-hidden');
  expect(nav).toHaveClass('min-h-0', 'overflow-y-auto');
});

test('keeps sidebar navigation rows content-sized inside the scroll area', () => {
  render(
    <I18nProvider language="zh-CN">
      <AppShell activePage="hook-settings" onPageChange={vi.fn()}>
        <div>content</div>
      </AppShell>
    </I18nProvider>
  );

  expect(screen.getByRole('navigation', { name: '主导航' })).toHaveClass(
    'content-start'
  );
});
