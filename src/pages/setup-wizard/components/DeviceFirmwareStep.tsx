import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';

type DeviceFirmwareStepProps = {
  onOpenDevices: () => void;
  onOpenFirmware: () => void;
};

export function DeviceFirmwareStep({
  onOpenDevices,
  onOpenFirmware
}: DeviceFirmwareStepProps) {
  const t = useI18n();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('setup.deviceFirmware.deviceTitle')}</CardTitle>
          <CardDescription>{t('setup.deviceFirmware.deviceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" onClick={onOpenDevices} className="w-full">
            {t('setup.deviceFirmware.openDevices')}
          </Button>
          <Button variant="outline" onClick={onOpenFirmware} className="w-full">
            {t('setup.deviceFirmware.openFirmware')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
