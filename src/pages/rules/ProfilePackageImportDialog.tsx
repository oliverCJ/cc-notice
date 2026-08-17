import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Link2, Unplug } from 'lucide-react';
import {
  ProfilePackageDeviceBinding,
  ProfilePackageDeviceBindingStatus,
  ProfilePackageImportPreview
} from '@/api/tauriApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useI18n } from '@/i18n';
import {
  buildProfilePackageBindings,
  initialProfilePackageBindingSelection,
  selectedCandidateStatus
} from './profilePackageDeviceBinding';

type ProfilePackageImportDialogProps = {
  open: boolean;
  packagePath: string;
  preview: ProfilePackageImportPreview | null;
  importing: boolean;
  onClose: () => void;
  onConfirm: (bindings: ProfilePackageDeviceBinding[], activate: boolean) => Promise<void>;
};

export function ProfilePackageImportDialog({
  open,
  packagePath,
  preview,
  importing,
  onClose,
  onConfirm
}: ProfilePackageImportDialogProps) {
  const t = useI18n();
  const [bindingSelection, setBindingSelection] = useState<Record<string, string>>({});
  const [activate, setActivate] = useState(false);
  const bindings = useMemo(
    () => buildProfilePackageBindings(bindingSelection),
    [bindingSelection]
  );

  useEffect(() => {
    if (!preview || !open) {
      setBindingSelection({});
      setActivate(false);
      return;
    }
    setBindingSelection(initialProfilePackageBindingSelection(preview.deviceGroups));
    setActivate(false);
  }, [open, preview]);

  if (!preview) {
    return null;
  }

  async function handleConfirm() {
    await onConfirm(bindings, activate);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('rules.profilePackage.importDialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('rules.profilePackage.importDialogDescription', {
              name: preview.importedProfileName
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <PreviewMetric
              label={t('rules.profilePackage.hookEventCount')}
              value={preview.enabledHookEventCount}
            />
            <PreviewMetric
              label={t('rules.profilePackage.aiMappingCount')}
              value={preview.aiMappingCount}
            />
            <PreviewMetric
              label={t('rules.profilePackage.outputRuleCount')}
              value={preview.outputRuleCount}
            />
            <PreviewMetric
              label={t('rules.profilePackage.deviceRuleCount')}
              value={preview.deviceRuleCount}
            />
            <PreviewMetric
              label={t('rules.profilePackage.desktopNoticeInstanceCount')}
              value={preview.desktopNoticeInstanceCount}
            />
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t('rules.profilePackage.hookConfigWarning')}
            </AlertDescription>
          </Alert>

          {preview.customMascotAssetPackIds.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>{t('rules.profilePackage.customMascotWarning')}</p>
                <div className="flex flex-wrap gap-2">
                  {preview.customMascotAssetPackIds.map((assetPackId) => (
                    <Badge key={assetPackId} variant="outline">
                      {assetPackId}
                    </Badge>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{t('rules.profilePackage.sourceProfile')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.sourceProfileName}
                </p>
              </div>
              <div className="min-w-0 text-right">
                <h3 className="font-medium">{t('rules.profilePackage.importedProfile')}</h3>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {preview.importedProfileName}
                </p>
              </div>
            </div>
            <p className="mt-3 break-all text-xs text-muted-foreground">{packagePath}</p>
          </div>

          {preview.deviceGroups.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">{t('rules.profilePackage.deviceBindingTitle')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('rules.profilePackage.deviceBindingDescription')}
                </p>
              </div>
              {preview.deviceGroups.map((group) => {
                const targetDeviceId = bindingSelection[group.sourceDeviceKey] ?? '';
                const status = selectedCandidateStatus(group, targetDeviceId);
                return (
                  <div key={group.sourceDeviceKey} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{group.sourceDeviceKey}</span>
                          {group.boardId && <Badge variant="outline">{group.boardId}</Badge>}
                          <BindingStatusBadge status={status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('rules.profilePackage.requirementCount', {
                            count: group.requirementCount
                          })}
                        </p>
                      </div>
                      <Select
                        value={targetDeviceId || 'none'}
                        onValueChange={(value) =>
                          setBindingSelection((current) => ({
                            ...current,
                            [group.sourceDeviceKey]: value === 'none' ? '' : value
                          }))
                        }
                      >
                        <SelectTrigger className="w-full sm:w-72">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t('rules.profilePackage.noBinding')}
                          </SelectItem>
                          {group.candidates.map((candidate) => (
                            <SelectItem key={candidate.deviceId} value={candidate.deviceId}>
                              {candidate.deviceId}
                              {candidate.boardId ? ` · ${candidate.boardId}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <BindingStatusHelp status={status} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              {t('rules.profilePackage.noDeviceRules')}
            </div>
          )}

          <Separator />

          <div className="flex items-start gap-3 rounded-lg border p-4">
            <Checkbox
              id="activate-imported-profile"
              checked={activate}
              onCheckedChange={(checked) => setActivate(checked === true)}
            />
            <Label htmlFor="activate-imported-profile" className="space-y-1 leading-none">
              <span>{t('rules.profilePackage.activateAfterImport')}</span>
              <span className="block text-sm font-normal text-muted-foreground">
                {t('rules.profilePackage.activateAfterImportDescription')}
              </span>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={importing}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={importing}>
            {importing ? t('rules.profilePackage.importing') : t('rules.profilePackage.import')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function BindingStatusBadge({ status }: { status: ProfilePackageDeviceBindingStatus }) {
  const t = useI18n();
  const variant = status === 'full-match' ? 'default' : status === 'unbound' ? 'secondary' : 'destructive';
  return <Badge variant={variant}>{t(`rules.profilePackage.status.${status}`)}</Badge>;
}

function BindingStatusHelp({ status }: { status: ProfilePackageDeviceBindingStatus }) {
  const t = useI18n();
  const icon =
    status === 'full-match' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : status === 'unbound' ? (
      <Unplug className="h-4 w-4 text-muted-foreground" />
    ) : (
      <Link2 className="h-4 w-4 text-amber-600" />
    );
  return (
    <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{t(`rules.profilePackage.statusHelp.${status}`)}</span>
    </div>
  );
}
