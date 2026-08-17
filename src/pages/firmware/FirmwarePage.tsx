import { useI18n } from '@/i18n';
import { useFirmwareCatalog } from '@/hooks/useFirmwareCatalog';
import { useFirmwareFlash } from '@/hooks/useFirmwareFlash';
import { FirmwareCatalogPanel } from './FirmwareCatalogPanel';
import { FirmwareDetailPanel } from './FirmwareDetailPanel';
import { FirmwareFlashPanel } from './FirmwareFlashPanel';

export function FirmwarePage() {
  const t = useI18n();
  const catalog = useFirmwareCatalog();
  const flash = useFirmwareFlash(catalog.selectedArtifact?.artifactId ?? null);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('firmware.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('firmware.description')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <FirmwareCatalogPanel
          artifacts={catalog.artifacts}
          selectedArtifactId={catalog.selectedArtifact?.artifactId ?? catalog.selectedArtifactId}
          loading={catalog.loading}
          error={catalog.error}
          onSelect={catalog.setSelectedArtifactId}
        />
        <div className="space-y-4">
          <FirmwareDetailPanel artifact={catalog.selectedArtifact} />
          <FirmwareFlashPanel artifact={catalog.selectedArtifact} flash={flash} />
        </div>
      </div>
    </div>
  );
}
