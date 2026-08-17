import { Check } from 'lucide-react';
import {
  AiToolId,
  LocalHookServerStatusView,
  aiTools
} from '../../state/appStore';
import { DiagnosticsSnapshot, NoticeProfile } from '../../api/tauriApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DeviceFirmwareStep } from './components/DeviceFirmwareStep';
import { EventMappingStep } from './components/EventMappingStep';
import { HookServiceStep } from './components/HookServiceStep';
import { HookSetupStep } from './components/HookSetupStep';
import { SetupDiagnosticsStep } from './components/SetupDiagnosticsStep';
import { setupFlowSteps, SetupStepId } from './setupFlow';
import { useI18n } from '@/i18n';

type SetupWizardPageProps = {
  activeStepId: SetupStepId;
  selectedToolId: AiToolId;
  hookServerStatus: LocalHookServerStatusView;
  profile: NoticeProfile | null;
  diagnosticsSnapshot: DiagnosticsSnapshot | null;
  diagnosticsLoading: boolean;
  diagnosticsError: string | null;
  onActiveStepChange: (stepId: SetupStepId) => void;
  onOpenDebug: () => void;
  onOpenDevices: () => void;
  onOpenFirmware: () => void;
  onOpenHookSettings: () => void;
  onOpenDiagnosticsCenter: () => void;
  onOpenRulesPage: () => void;
  onRefreshDiagnostics: () => Promise<void> | void;
  onSelectTool: (toolId: AiToolId) => void;
};

export function SetupWizardPage({
  activeStepId,
  selectedToolId,
  hookServerStatus,
  profile,
  diagnosticsSnapshot,
  diagnosticsLoading,
  diagnosticsError,
  onActiveStepChange,
  onOpenDebug,
  onOpenDevices,
  onOpenFirmware,
  onOpenHookSettings,
  onOpenDiagnosticsCenter,
  onOpenRulesPage,
  onRefreshDiagnostics,
  onSelectTool
}: SetupWizardPageProps) {
  const t = useI18n();
  const selectedTool = aiTools.find((tool) => tool.id === selectedToolId) ?? aiTools[0];
  const activeStepIndex = setupFlowSteps.findIndex((step) => step.id === activeStepId);

  function goToPreviousStep() {
    const previous = setupFlowSteps[Math.max(activeStepIndex - 1, 0)];
    onActiveStepChange(previous.id);
  }

  function goToNextStep() {
    const next = setupFlowSteps[Math.min(activeStepIndex + 1, setupFlowSteps.length - 1)];
    onActiveStepChange(next.id);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('setup.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('setup.description')}</p>
      </div>

      {/* 步骤指示器 */}
      <Card>
        <CardContent className="pt-6">
          <nav aria-label={t('setup.progressAria')} className="flex items-center justify-between">
            {setupFlowSteps.map((step, index) => {
              const isActive = step.id === activeStepId;
              const isCompleted = index < activeStepIndex;
              const isLast = index === setupFlowSteps.length - 1;

              return (
                <div key={step.id} className="flex flex-1 items-center">
                  <button
                    onClick={() => onActiveStepChange(step.id)}
                    className={cn(
                      'flex items-center gap-3 text-left transition-colors',
                      isActive && 'text-primary',
                      !isActive && !isCompleted && 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-colors',
                        isActive && 'border-primary bg-primary text-primary-foreground',
                        isCompleted &&
                          !isActive &&
                          'border-primary bg-primary text-primary-foreground',
                        !isActive && !isCompleted && 'border-muted-foreground'
                      )}
                    >
                      {isCompleted && !isActive ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <div className="hidden md:block">
                      <p className="text-sm font-medium">{t(step.titleKey)}</p>
                      {step.descriptionKey && (
                        <p className="text-xs text-muted-foreground">{t(step.descriptionKey)}</p>
                      )}
                    </div>
                  </button>
                  {!isLast && (
                    <Separator
                      className={cn(
                        'mx-4 flex-1',
                        isCompleted && 'bg-primary',
                        !isCompleted && 'bg-muted'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {/* 步骤内容 */}
      <Card>
        <CardContent className="space-y-6 pt-6">
          {activeStepId === 'hook-service' && (
            <HookServiceStep hookServerStatus={hookServerStatus} onOpenDebug={onOpenDebug} />
          )}
          {activeStepId === 'hook-settings' && (
            <HookSetupStep
              selectedToolId={selectedToolId}
              selectedToolName={selectedTool.name}
              onOpenHookSettings={onOpenHookSettings}
              onSelectTool={onSelectTool}
            />
          )}
          {activeStepId === 'event-mapping' && (
            <EventMappingStep profile={profile} onOpenRulesPage={onOpenRulesPage} />
          )}
          {activeStepId === 'device-firmware' && (
            <DeviceFirmwareStep
              onOpenDevices={onOpenDevices}
              onOpenFirmware={onOpenFirmware}
            />
          )}
          {activeStepId === 'diagnostics-check' && (
            <SetupDiagnosticsStep
              snapshot={diagnosticsSnapshot}
              loading={diagnosticsLoading}
              error={diagnosticsError}
              onOpenDiagnosticsCenter={onOpenDiagnosticsCenter}
              onRefresh={onRefreshDiagnostics}
            />
          )}

          {/* 导航按钮 */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={activeStepIndex === 0}
            >
              {t('setup.previous')}
            </Button>
            <Button onClick={goToNextStep} disabled={activeStepIndex === setupFlowSteps.length - 1}>
              {t('setup.next')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
