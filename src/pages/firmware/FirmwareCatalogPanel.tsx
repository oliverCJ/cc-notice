import { HardDrive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FirmwareCatalogArtifact } from '@/api/tauriApi';
import { useI18n } from '@/i18n';
import { getBoardDisplayName } from '@/domain/boards/boardCatalog';
import {
  FirmwareBoardFamily,
  getFirmwareDisplayMetadata
} from '@/domain/firmware/firmwareDisplayMetadata';

type FirmwareCatalogPanelProps = {
  artifacts: FirmwareCatalogArtifact[];
  selectedArtifactId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (artifactId: string) => void;
};

export function FirmwareCatalogPanel({
  artifacts,
  selectedArtifactId,
  loading,
  error,
  onSelect
}: FirmwareCatalogPanelProps) {
  const t = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          {t('firmware.catalogTitle')}
        </CardTitle>
        <CardDescription>{t('firmware.catalogDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">{t('firmware.catalogLoading')}</p>}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {!loading && artifacts.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {t('firmware.catalogEmpty')}
          </p>
        )}
        {groupFirmwareArtifacts(artifacts).map((group) => (
          <section key={group.family} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                {t(group.labelKey)}
              </h3>
              <span className="text-xs text-muted-foreground">
                {t('firmware.artifactCount', { count: group.artifacts.length })}
              </span>
            </div>
            <div className="space-y-2">
              {group.artifacts.map((artifact) => {
                const selected = artifact.artifactId === selectedArtifactId;
                const boardDisplayName = resolveBoardDisplayName(artifact);
                const metadata = getFirmwareDisplayMetadata(artifact.boardId);
                return (
                  <button
                    key={artifact.artifactId}
                    type="button"
                    aria-label={`${boardDisplayName} ${artifact.firmwareVersion} ${artifact.source}`}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onSelect(artifact.artifactId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{boardDisplayName}</p>
                          {metadata.recommended && (
                            <Badge className="shrink-0">{t('firmware.recommendedBadge')}</Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                          {artifact.boardId} · {artifact.artifactType} · {artifact.source}
                        </p>
                      </div>
                      <Badge variant="secondary">{artifact.firmwareVersion}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{t(metadata.capabilityTierLabelKey)}</Badge>
                      <p className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                        {artifact.artifactName}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

type FirmwareArtifactGroup = {
  family: FirmwareBoardFamily;
  labelKey: string;
  artifacts: FirmwareCatalogArtifact[];
};

const firmwareFamilyOrder: FirmwareBoardFamily[] = [
  'rp2040',
  'arduino-avr',
  'stm32',
  'seeed-samd',
  'unknown'
];

function groupFirmwareArtifacts(artifacts: FirmwareCatalogArtifact[]): FirmwareArtifactGroup[] {
  const groups = new Map<FirmwareBoardFamily, FirmwareArtifactGroup>();

  artifacts.forEach((artifact) => {
    const metadata = getFirmwareDisplayMetadata(artifact.boardId);
    const existing = groups.get(metadata.family);
    if (existing) {
      existing.artifacts.push(artifact);
      return;
    }

    groups.set(metadata.family, {
      family: metadata.family,
      labelKey: metadata.familyLabelKey,
      artifacts: [artifact]
    });
  });

  return Array.from(groups.values()).sort(
    (left, right) =>
      firmwareFamilyOrder.indexOf(left.family) - firmwareFamilyOrder.indexOf(right.family)
  );
}

function resolveBoardDisplayName(artifact: FirmwareCatalogArtifact): string {
  const catalogName = getBoardDisplayName(artifact.boardId);
  return catalogName === artifact.boardId ? artifact.boardName : catalogName;
}
