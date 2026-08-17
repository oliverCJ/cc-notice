import { useState } from 'react';
import { AlertCircle, Grid3X3, List, Search } from 'lucide-react';
import { HookEventDefinition } from '@/api/tauriApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { hookEventDescription, hookEventScenario, hookEventTitle } from '@/lib/hookEventText';
import { AiToolId, aiTools } from '@/state/appStore';
import { filterHookEvents } from './hookEventSelectionUtils';
import { HookSettingsAlert } from './HookSettingsAlert';
import { useI18n } from '@/i18n';

type ViewMode = 'grid' | 'list';

type HookEventSelectionPanelProps = {
  onApplyRecommended: () => void;
  onToggleEvent: (eventName: string) => void;
  selectedEvents: string[];
  selectedToolId: AiToolId;
  visibleEvents: HookEventDefinition[];
};

export function HookEventSelectionPanel({
  onApplyRecommended,
  onToggleEvent,
  selectedEvents,
  selectedToolId,
  visibleEvents
}: HookEventSelectionPanelProps) {
  const t = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const filteredEvents = filterHookEvents(visibleEvents, searchQuery, t);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t('hookSettings.events.title')}</CardTitle>
            <CardDescription className="mt-1.5">
              {t('hookSettings.events.description', {
                toolName: aiTools.find((tool) => tool.id === selectedToolId)?.name ?? selectedToolId
              })}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onApplyRecommended}>
              {t('hookSettings.events.applyRecommended')}
            </Button>
            <Badge variant="secondary" className="h-8">
              {t('hookSettings.events.selectedCount', {
                selected: selectedEvents.length,
                total: visibleEvents.length
              })}
            </Badge>
            <div className="flex rounded-lg border">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('hookSettings.events.searchPlaceholder')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-9"
          />
        </div>

        {visibleEvents.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            {t('hookSettings.events.loading')}
          </p>
        ) : filteredEvents.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            {t('hookSettings.events.empty')}
          </p>
        ) : (
          <div
            className={cn(
              'grid gap-3',
              viewMode === 'grid' && 'md:grid-cols-2 xl:grid-cols-3',
              viewMode === 'list' && 'grid-cols-1'
            )}
          >
            {filteredEvents.map((event) => {
              const isSelected = selectedEvents.includes(event.event);
              const title = hookEventTitle(event, t);
              const description = hookEventDescription(event, t);
              const scenario = hookEventScenario(event, t);
              return (
                <div
                  key={`${event.source}-${event.event}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent',
                    isSelected && 'border-primary bg-primary/5'
                  )}
                  onClick={() => onToggleEvent(event.event)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleEvent(event.event)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium leading-none">{title}</p>
                      {event.defaultSelected && (
                        <Badge variant="secondary" className="text-xs">
                          {t('hookSettings.events.recommended')}
                        </Badge>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground">{event.event}</code>
                    {viewMode === 'grid' && (
                      <>
                        <p className="text-sm text-muted-foreground">{description}</p>
                        <p className="text-xs text-muted-foreground">{scenario}</p>
                      </>
                    )}
                    {viewMode === 'list' && (
                      <p className="text-sm text-muted-foreground">
                        {description} · {scenario}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedEvents.length === 0 && (
          <HookSettingsAlert icon={AlertCircle} tone="destructive">
            {t('hookSettings.events.requireOne')}
          </HookSettingsAlert>
        )}
      </CardContent>
    </Card>
  );
}
