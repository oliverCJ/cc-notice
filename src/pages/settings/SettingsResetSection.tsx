import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ResetConfigurationScope } from '@/api/tauriApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';
import { SettingsResetConfirmDialog } from './SettingsResetConfirmDialog';

type SettingsResetSectionProps = {
  onReset: (scope: ResetConfigurationScope) => Promise<void>;
};

const resetScopes: ResetConfigurationScope[] = [
  'app-settings',
  'hook-settings',
  'profile-mappings',
  'devices',
  'all'
];

export function SettingsResetSection({ onReset }: SettingsResetSectionProps) {
  const t = useI18n();
  const { toast } = useToast();
  const [selectedScope, setSelectedScope] = useState<ResetConfigurationScope | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirm(scope: ResetConfigurationScope) {
    setBusy(true);
    try {
      await onReset(scope);
      setSelectedScope(null);
      toast({
        title: t('settings.reset.successTitle'),
        description: t(`settings.reset.scopes.${scope}.success`)
      });
    } catch (error) {
      toast({
        title: t('settings.reset.failedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t('settings.reset.title')}
          </CardTitle>
          <CardDescription>{t('settings.reset.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {resetScopes.map((scope) => (
            <Button
              key={scope}
              variant={scope === 'all' ? 'destructive' : 'outline'}
              onClick={() => setSelectedScope(scope)}
            >
              {t(`settings.reset.scopes.${scope}.button`)}
            </Button>
          ))}
        </CardContent>
      </Card>

      <SettingsResetConfirmDialog
        scope={selectedScope}
        busy={busy}
        onClose={() => !busy && setSelectedScope(null)}
        onConfirm={handleConfirm}
      />
    </>
  );
}
