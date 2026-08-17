import { ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { navItems, PageId } from '@/state/appStore';
import { AppSidebarInfo } from './AppSidebarInfo';

const appLogoUrl = new URL('../../assets/app-logo.png', import.meta.url).href;

type AppShellProps = {
  activePage: PageId;
  children: ReactNode;
  onPageChange: (pageId: PageId) => void;
};

export function AppShell({ activePage, children, onPageChange }: AppShellProps) {
  const t = useI18n();

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 flex h-screen flex-col overflow-hidden border-r border-border bg-card p-5">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-6 flex shrink-0 items-center gap-2">
            <img
              alt="CC Notice"
              className="h-14 w-14 rounded-lg object-cover"
              src={appLogoUrl}
            />
            <span className="text-lg font-semibold text-foreground">CC Notice</span>
          </div>
          <nav
            aria-label={t('nav.ariaLabel')}
            className="grid min-h-0 flex-1 content-start gap-1.5 overflow-y-auto pr-1"
          >
            {navItems.filter((item) => !item.isHidden).map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              const label = t(item.labelKey);
              return (
                <button
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto pt-6">
          <AppSidebarInfo />
        </div>
      </aside>
      <section className="p-5 md:p-8">{children}</section>
      <Toaster />
    </main>
  );
}
