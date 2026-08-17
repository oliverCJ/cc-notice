import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { LinkWorkflowNodeStatus } from './types';

type WorkflowOverviewNodeProps = {
  titleKey: string;
  descriptionKey: string;
  status: LinkWorkflowNodeStatus;
  badges: string[];
  selected: boolean;
  onSelect: () => void;
};

export function WorkflowOverviewNode({
  titleKey,
  descriptionKey,
  status,
  badges,
  selected,
  onSelect
}: WorkflowOverviewNodeProps) {
  const t = useI18n();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onSelect}
      className={cn(
        'h-auto min-h-36 w-full max-w-full justify-start overflow-hidden rounded-lg bg-background p-3 text-left shadow-sm whitespace-normal',
        selected && 'border-primary ring-2 ring-primary/20'
      )}
    >
      <div className="min-w-0 w-full space-y-2 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate font-semibold">{t(titleKey)}</span>
          <Badge
            variant={status === 'warning' ? 'destructive' : 'secondary'}
            className="max-w-[4.5rem] shrink-0 truncate px-1.5"
          >
            {t(`rules.linkWorkflow.status.${status}`)}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">{t(descriptionKey)}</p>
        <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
          {badges.slice(0, 4).map((badge) => (
            <Badge key={badge} variant="secondary" className="max-w-full truncate">
              {badge}
            </Badge>
          ))}
        </div>
      </div>
    </Button>
  );
}
