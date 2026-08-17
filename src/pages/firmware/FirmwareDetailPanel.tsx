import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FirmwareCatalogArtifact } from '@/api/tauriApi';
import { useI18n } from '@/i18n';
import { getBoardDisplayName } from '@/domain/boards/boardCatalog';
import { getFirmwareDisplayMetadata } from '@/domain/firmware/firmwareDisplayMetadata';
import { getFirmwareWiringGuide } from '@/domain/firmware/firmwareWiringGuides';

type FirmwareDetailPanelProps = {
  artifact: FirmwareCatalogArtifact | null;
};

export function FirmwareDetailPanel({ artifact }: FirmwareDetailPanelProps) {
  const t = useI18n();
  const boardDisplayName = artifact ? resolveBoardDisplayName(artifact) : '';
  const metadata = artifact ? getFirmwareDisplayMetadata(artifact.boardId) : null;
  const wiringGuide = getFirmwareWiringGuide(artifact);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('firmware.currentFirmware')}</CardTitle>
        <CardDescription>{t('firmware.firmwareDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!artifact ? (
          <p className="text-sm text-muted-foreground">{t('firmware.noSelectedFirmware')}</p>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label={t('firmware.boardName')} value={boardDisplayName} />
              <DetailItem label={t('firmware.boardId')} value={artifact.boardId} mono />
              {metadata && (
                <>
                  <DetailItem label={t('firmware.boardFamily')} value={t(metadata.familyLabelKey)} />
                  <DetailItem
                    label={t('firmware.capabilityTier')}
                    value={t(metadata.capabilityTierLabelKey)}
                  />
                  <DetailItem
                    label={t('firmware.capabilityDescription')}
                    value={t(metadata.capabilityTierDescriptionKey)}
                  />
                  <DetailItem
                    label={t('firmware.recommendationStatus')}
                    value={
                      metadata.recommended
                        ? t('firmware.recommendedBadge')
                        : t('firmware.notRecommendedBadge')
                    }
                  />
                  {metadata.recommendationReasonKey && (
                    <DetailItem
                      label={t('firmware.recommendationReasonTitle')}
                      value={t(metadata.recommendationReasonKey)}
                    />
                  )}
                </>
              )}
              <DetailItem label={t('firmware.artifactId')} value={artifact.artifactId} mono />
              <DetailItem label={t('firmware.bundledFirmwareVersion')} value={artifact.firmwareVersion} />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('firmware.protocolVersion')}
                </p>
                <Badge variant="secondary" className="mt-1">
                  v{artifact.protocolVersion}
                </Badge>
              </div>
              <DetailItem label={t('firmware.firmwareFile')} value={artifact.artifactName} mono />
              <DetailItem label={t('firmware.artifactType')} value={artifact.artifactType} />
              {artifact.targetId && <DetailItem label={t('firmware.targetId')} value={artifact.targetId} mono />}
              {artifact.toolchain && <DetailItem label={t('firmware.toolchain')} value={artifact.toolchain} mono />}
              <DetailItem label={t('firmware.flashStrategy')} value={artifact.flashStrategy} mono />
              <DetailItem label={t('firmware.flashVolumeName')} value={artifact.flashVolumeName} mono />
              {artifact.upload && (
                <>
                  <DetailItem label={t('firmware.uploadFqbn')} value={artifact.upload.fqbn} mono />
                  <DetailItem label={t('firmware.uploadProtocol')} value={artifact.upload.protocol} mono />
                  <DetailItem label={t('firmware.uploadSpeed')} value={`${artifact.upload.speed} bps`} />
                  <DetailItem
                    label={t('firmware.uploadReset')}
                    value={
                      artifact.upload.requires1200bpsReset
                        ? t('firmware.uploadResetRequired')
                        : t('firmware.uploadResetNotRequired')
                    }
                  />
                  <DetailItem
                    label={t('firmware.bootloaderWait')}
                    value={`${artifact.upload.bootloaderWaitMs} ms`}
                  />
                  <DetailItem
                    label={t('firmware.boardOptions')}
                    value={formatBoardOptions(artifact.upload.boardOptions)}
                    mono
                  />
                </>
              )}
              <DetailItem label={t('firmware.firmwareSource')} value={artifact.source} />
              <DetailItem label={t('firmware.relativePath')} value={artifact.relativePath} mono />
            </div>
            {wiringGuide && <FirmwareWiringGuidePanel artifact={artifact} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FirmwareWiringGuidePanel({ artifact }: { artifact: FirmwareCatalogArtifact }) {
  const t = useI18n();
  const guide = getFirmwareWiringGuide(artifact);
  if (!guide) {
    return null;
  }

  return (
    <section className="rounded-md border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold">{t(guide.titleKey)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t(guide.summaryKey)}</p>
      </div>
      <div className="mt-3 overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">{t('firmware.wiring.pin')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('firmware.wiring.function')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('firmware.wiring.connection')}</th>
            </tr>
          </thead>
          <tbody>
            {guide.pinRows.map((row) => (
              <tr key={`${row.label}-${row.functionKey}`} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{row.label}</td>
                <td className="px-3 py-2">{t(row.functionKey)}</td>
                <td className="px-3 py-2 text-muted-foreground">{t(row.wiringKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <GuideList title={t('firmware.wiring.reservedPins')} items={guide.reservedPinKeys.map((key) => t(key))} />
        <GuideList title={t('firmware.wiring.noticeTitle')} items={guide.noticeKeys.map((key) => t(key))} />
      </div>
    </section>
  );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function resolveBoardDisplayName(artifact: FirmwareCatalogArtifact): string {
  const catalogName = getBoardDisplayName(artifact.boardId);
  return catalogName === artifact.boardId ? artifact.boardName : catalogName;
}

function formatBoardOptions(boardOptions: Record<string, string>): string {
  const entries = Object.entries(boardOptions);
  if (entries.length === 0) {
    return '-';
  }

  return entries.map(([key, value]) => `${key}=${value}`).join(', ');
}

type DetailItemProps = {
  label: string;
  value: string;
  mono?: boolean;
};

function DetailItem({ label, value, mono = false }: DetailItemProps) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 break-all text-sm ${mono ? 'font-mono' : 'font-medium'}`}>{value}</p>
    </div>
  );
}
