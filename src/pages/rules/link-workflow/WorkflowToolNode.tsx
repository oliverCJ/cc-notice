import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { LinkWorkflowToolNode } from './types';

type WorkflowToolNodeProps = {
  node: LinkWorkflowToolNode;
  selected: boolean;
  onSelect: (source: string) => void;
};

export function WorkflowToolNode({ node, selected, onSelect }: WorkflowToolNodeProps) {
  const t = useI18n();
  const visibleHooks = node.hookEventSummaries.slice(0, 2);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => onSelect(node.source)}
      className={cn(
        'h-auto min-h-24 w-full max-w-full justify-start overflow-hidden rounded-lg bg-background p-3 text-left shadow-sm whitespace-normal',
        selected && 'border-primary ring-2 ring-primary/20'
      )}
    >
      <div className="min-w-0 w-full space-y-2 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate font-semibold">{node.title}</span>
          <Badge
            variant={node.mappedHookCount === node.enabledHookCount ? 'secondary' : 'outline'}
            className="max-w-[4.5rem] shrink-0 truncate px-1.5"
          >
            {t('rules.linkWorkflow.toolNode.mappedCount', {
              mapped: node.mappedHookCount,
              total: node.enabledHookCount
            })}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {t('rules.linkWorkflow.toolNode.enabledCount', {
            count: node.enabledHookCount
          })}
        </p>
        <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
          {visibleHooks.map((hook) => (
            <Badge
              key={`${hook.source}-${hook.event}`}
              variant="secondary"
              className="max-w-full truncate"
            >
              {hook.event}
            </Badge>
          ))}
        </div>
      </div>
    </Button>
  );
}
