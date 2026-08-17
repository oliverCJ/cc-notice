import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';
import type { DebugLogDeviceResultView } from '@/state/appStore';
import type { DesktopNoticeRuleTarget } from '@/domain/desktopNotice';
import {
  isOnceMascotPlayMode,
  normalizeDesktopMascotPlaybackWindowMs
} from '@/domain/desktopNotice';
import { builtInMascotPacks, desktopMascotActionLabel } from '@/domain/desktopMascot';
import type { DebugLifecycleOutputGroup } from './debugEventLifecycleViewModel';

type DebugOutputExecutionGroupProps = {
  outputGroups: DebugLifecycleOutputGroup[];
  deviceResults: DebugLogDeviceResultView[];
};

export function DebugOutputExecutionGroup({
  outputGroups,
  deviceResults
}: DebugOutputExecutionGroupProps) {
  const t = useI18n();

  return (
    <div className="mt-3 space-y-3">
      {outputGroups.map((group) => (
        <section key={group.id} className="rounded-md border bg-background/70 p-2">
          <h4 className="text-xs font-semibold">
            {t(`debug.lifecycle.outputGroups.${group.id}`)}
          </h4>
          <div className="mt-2 grid gap-2">
            {group.outputs.map((output) => (
              <div
                key={`${output.ruleId}-${output.type}`}
                className="rounded border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{output.type}</Badge>
                  <code className="break-all text-xs">{output.ruleId}</code>
                </div>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {output.commandSummary ?? t('debug.lifecycle.outputGroups.plan')}
                </p>
                {group.id === 'desktop-notice' && (
                  <DesktopNoticeTargetDetails targets={output.desktopNoticeTargets ?? []} />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {deviceResults.length > 0 && (
        <section className="rounded-md border bg-background/70 p-2">
          <h4 className="text-xs font-semibold">{t('debug.deviceResults')}</h4>
          <div className="mt-2 grid gap-2">
            {deviceResults.map((result) => (
              <div
                key={`${result.deviceId}-${result.channelId}-${result.status}-${
                  result.errorCode ?? ''
                }`}
                className="rounded border bg-muted/20 p-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={result.status === 'failed' ? 'destructive' : 'outline'}>
                    {result.status}
                  </Badge>
                  <code className="break-all text-xs">{result.deviceId}</code>
                  <code className="break-all text-xs">{result.channelId}</code>
                </div>
                {result.errorCode && (
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {t('debug.lifecycle.outputGroups.deviceErrorCode')}: {result.errorCode}
                  </p>
                )}
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {result.error
                    ? `${t('debug.lifecycle.outputGroups.deviceError')}: ${result.error}`
                    : `${t('debug.lifecycle.outputGroups.deviceAck')}: ${
                        result.ack ?? t('debug.lifecycle.outputGroups.emptyAck')
                      }`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DesktopNoticeTargetDetails({ targets }: { targets: DesktopNoticeRuleTarget[] }) {
  const t = useI18n();

  if (targets.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {t('debug.lifecycle.outputGroups.desktopNoticeNoTargets')}
      </p>
    );
  }

  return (
    <div className="mt-2 grid gap-2">
      {targets.map((target) => (
        <div
          key={target.targetId}
          className="rounded border border-dashed bg-background/70 p-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t('debug.lifecycle.outputGroups.desktopNoticeTarget')}</Badge>
            <code className="break-all">{target.targetId}</code>
          </div>
          <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
            <DesktopNoticeTargetFact
              label={t('debug.lifecycle.outputGroups.desktopNoticeDuration')}
              value={`${target.durationMs} ms`}
            />
            {hasMascotRuleMetadata(target) ? (
              <>
                {target.mascotState && (
                  <DesktopNoticeTargetFact
                    label={t('debug.lifecycle.outputGroups.desktopNoticeMascotState')}
                    value={t(`desktopNotice.mascot.states.${target.mascotState}`)}
                  />
                )}
                {target.mascotActionId && (
                  <DesktopNoticeTargetFact
                    label={t('debug.lifecycle.outputGroups.desktopNoticeMascotAction')}
                    value={formatMascotAction(target.mascotActionId, t)}
                  />
                )}
                {isOnceMascotPlayMode(target.mascotPlayMode) && (
                  <DesktopNoticeTargetFact
                    label={t('debug.lifecycle.outputGroups.desktopNoticeMascotPlaybackWindow')}
                    value={t('rules.desktopNotice.mascotPlaybackWindowSummary', {
                      seconds: (
                        normalizeDesktopMascotPlaybackWindowMs(target.mascotPlaybackWindowMs) / 1000
                      ).toFixed(1)
                    })}
                  />
                )}
                {target.mascotBubbleTemplate && (
                  <DesktopNoticeTargetFact
                    label={t('debug.lifecycle.outputGroups.desktopNoticeMascotBubble')}
                    value={target.mascotBubbleTemplate}
                  />
                )}
              </>
            ) : (
              <>
                <DesktopNoticeTargetFact
                  label={t('debug.lifecycle.outputGroups.desktopNoticeEffect')}
                  value={target.effect}
                />
                <DesktopNoticeTargetFact
                  label={t('debug.lifecycle.outputGroups.desktopNoticeColorMode')}
                  value={target.colorMode}
                />
                <DesktopNoticeTargetFact
                  label={t('debug.lifecycle.outputGroups.desktopNoticeAnimationPeriod')}
                  value={formatDesktopNoticePeriod(target)}
                />
                {target.edge && (
                  <DesktopNoticeTargetFact
                    label={t('debug.lifecycle.outputGroups.desktopNoticeEdge')}
                    value={target.edge}
                  />
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DesktopNoticeTargetFact({ label, value }: { label: string; value: string }) {
  return (
    <p className="break-all">
      {label}: {value}
    </p>
  );
}

function formatDesktopNoticePeriod(target: DesktopNoticeRuleTarget): string {
  const periodMs = target.animationPeriodMs ?? target.breathingPeriodMs;

  return periodMs == null ? '-' : `${periodMs} ms`;
}

function hasMascotRuleMetadata(target: DesktopNoticeRuleTarget): boolean {
  return Boolean(target.mascotState || target.mascotActionId || target.mascotBubbleTemplate);
}

function formatMascotAction(actionId: string, t: (key: string) => string): string {
  const action = builtInMascotPacks
    .flatMap((pack) => pack.actions)
    .find((item) => item.id === actionId);
  return action ? desktopMascotActionLabel(action, t) : actionId;
}
