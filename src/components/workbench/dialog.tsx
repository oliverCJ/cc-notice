import { ReactNode, useEffect } from 'react';
import { WorkbenchButton } from './controls';
import { useI18n } from '@/i18n';

type DialogProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
};

export function Dialog({ title, description, children, footer, onClose }: DialogProps) {
  const t = useI18n();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section
        aria-label={title}
        aria-modal="true"
        className="w-full max-w-xl rounded-lg border border-border bg-card p-5 text-card-foreground shadow-xl"
        role="dialog"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <WorkbenchButton aria-label={t('common.close')} onClick={onClose} variant="ghost">
            {t('common.close')}
          </WorkbenchButton>
        </div>
        <div className="grid gap-4">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
      </section>
    </div>
  );
}
