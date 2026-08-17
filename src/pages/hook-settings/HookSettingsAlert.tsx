import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

type HookSettingsAlertTone = 'default' | 'warning' | 'destructive';

type HookSettingsAlertProps = {
  children: ReactNode;
  icon: LucideIcon;
  tone?: HookSettingsAlertTone;
};

const toneClassNames: Record<HookSettingsAlertTone, string> = {
  default: 'border-border bg-background text-foreground',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  destructive: 'border-destructive/50 text-destructive'
};

const iconClassNames: Record<HookSettingsAlertTone, string> = {
  default: 'text-foreground',
  warning: 'text-amber-600',
  destructive: 'text-destructive'
};

export function HookSettingsAlert({
  children,
  icon: Icon,
  tone = 'default'
}: HookSettingsAlertProps) {
  return (
    <Alert className={cn('flex items-start gap-2 px-4 py-3', toneClassNames[tone])}>
      <span
        className={cn(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center',
          iconClassNames[tone]
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <AlertDescription className="pl-0 leading-5 text-current translate-y-0">
        {children}
      </AlertDescription>
    </Alert>
  );
}
