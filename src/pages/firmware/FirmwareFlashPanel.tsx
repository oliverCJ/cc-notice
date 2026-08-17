import { CheckCircle2, Loader2, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { FirmwareCatalogArtifact } from '@/api/tauriApi';
import { getFirmwareFlashGuide } from '@/domain/firmware/firmwareFlashGuides';
import { useFirmwareFlash } from '@/hooks/useFirmwareFlash';
import { useI18n } from '@/i18n';

type FirmwareFlashPanelProps = {
  artifact: FirmwareCatalogArtifact | null;
  flash: ReturnType<typeof useFirmwareFlash>;
};

export function FirmwareFlashPanel({ artifact, flash }: FirmwareFlashPanelProps) {
  const t = useI18n();
  const flashStatus = flash.flashStatus;
  const isUf2MountCopy = artifact?.flashStrategy === 'uf2_mount_copy';
  const isArduinoCliUpload = artifact?.flashStrategy === 'arduino_cli_upload';
  const targetPath = flash.loadingStatus
    ? t('firmware.detecting')
    : flashStatus?.ready && flashStatus.target
      ? flashStatus.target.mountPath
      : t('firmware.bootselMissing');
  const arduinoCli = flashStatus?.arduinoCli;
  const flashGuide = getFirmwareFlashGuide(artifact);
  const canFlashArduino = Boolean(
    isArduinoCliUpload && arduinoCli?.available && flash.selectedTargetId
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('firmware.updateTitle')}</CardTitle>
        <CardDescription>{t('firmware.updateDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isUf2MountCopy ? t('firmware.bootselStatus') : t('firmware.arduinoCliStatus')}
              </p>
              <p className="break-all text-sm text-muted-foreground">
                {isArduinoCliUpload
                  ? arduinoCli?.available
                    ? t('firmware.arduinoCliAvailable', {
                        version: arduinoCli.version ?? arduinoCli.resolvedPath
                      })
                    : t('firmware.arduinoCliUnavailable')
                  : targetPath}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={flash.refreshFlashStatus}
                disabled={!artifact || flash.loadingStatus || flash.flashing}
              >
                {flash.loadingStatus ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t('firmware.refreshStatus')}
              </Button>
              <Button
                size="sm"
                onClick={flash.runFlash}
                disabled={
                  !artifact ||
                  (isUf2MountCopy && !flashStatus?.ready) ||
                  (isArduinoCliUpload && !canFlashArduino) ||
                  flash.loadingStatus ||
                  flash.flashing
                }
              >
                {flash.flashing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {t('firmware.flashSelected')}
              </Button>
            </div>
          </div>
        </div>

        {isArduinoCliUpload && (
          <div className="rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium">{t('firmware.flashTargetPort')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('firmware.flashTargetPortDescription')}
                  </p>
                </div>
                <Select
                  value={flash.selectedTargetId ?? ''}
                  onValueChange={flash.setSelectedTargetId}
                  disabled={flash.loadingTargets || flash.flashTargets.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('firmware.noFlashTargetPort')} />
                  </SelectTrigger>
                  <SelectContent>
                    {flash.flashTargets.map((target) => (
                      <SelectItem key={target.targetId} value={target.targetId}>
                        {target.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={flash.refreshFlashTargets}
                disabled={!artifact || flash.loadingTargets || flash.flashing}
              >
                {flash.loadingTargets ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t('firmware.refreshFlashTargets')}
              </Button>
            </div>
          </div>
        )}

        {flash.flashResult && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {isArduinoCliUpload ? (
                <>
                  <p className="font-medium">{t('firmware.arduinoCliFlashSuccess')}</p>
                  <p className="mt-1 break-all text-emerald-700 dark:text-emerald-300">
                    {t('firmware.arduinoCliFlashTarget', {
                      target: flash.flashResult.target.mountPath
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">{t('firmware.flashSuccess')}</p>
                  <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                    {t('firmware.copiedBytes', { bytes: flash.flashResult.copiedBytes })}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {flash.error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {flash.error}
          </div>
        )}

        {isArduinoCliUpload ? (
          <>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-medium">{t('firmware.arduinoCliHintTitle')}</p>
              <p className="mt-1">
                {arduinoCli?.available
                  ? t('firmware.arduinoCliHintReady')
                  : t('firmware.arduinoCliHintConfigure')}
              </p>
              {arduinoCli?.error && (
                <p className="mt-2 break-all text-amber-800 dark:text-amber-300">
                  {formatArduinoCliError(arduinoCli.error, t)}
                </p>
              )}
            </div>

            {flashGuide && (
              <div className="rounded-lg border bg-background px-4 py-3 text-sm">
                <p className="font-medium">{t(flashGuide.titleKey)}</p>
                <p className="mt-1 text-muted-foreground">{t(flashGuide.summaryKey)}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {flashGuide.sections.map((section) => (
                    <div key={section.titleKey} className="space-y-2">
                      <p className="font-medium text-foreground">{t(section.titleKey)}</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {section.itemKeys.map((itemKey) => (
                          <li key={itemKey} className="flex gap-2">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                            <span>{t(itemKey)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t('firmware.noteFormat')}</p>
            <p>{t('firmware.noteBootsel')}</p>
            <p>{t('firmware.noteKeepConnected')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatArduinoCliError(error: string, t: ReturnType<typeof useI18n>) {
  if (error === 'arduino_cli_not_found') {
    return t('firmware.arduinoCliNotFound');
  }
  return error;
}
