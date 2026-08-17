import {
  CreateCustomInternalEventRequest,
  EnabledHookEvent,
  HookEventDefinition,
  InternalEventDefinition,
  NoticeProfile,
  ProfilePackageDeviceBinding,
  ProfilePackageImportPreview,
  ProfileTemplate,
  UpdateCustomInternalEventRequest
} from '../../api/tauriApi';
import type { DesktopNoticeInstance } from '@/domain/desktopNotice';
import { open, save } from '@tauri-apps/plugin-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ProfileCreateDialog } from '../settings/ProfileCreateDialog';
import { ProfileDeleteDialog } from '../settings/ProfileDeleteDialog';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { InternalEventCatalogSection } from './InternalEventCatalogSection';
import { ProfileManagementSection } from './ProfileManagementSection';
import { RuleConfigurationTabs } from './RuleConfigurationTabs';
import { ProfilePackageImportDialog } from './ProfilePackageImportDialog';
import { selectedHookEventsFromSelections } from '../hook-settings/hookEventSelectionUtils';
import { useI18n } from '@/i18n';

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'duplicate'; sourceProfileId: string; sourceProfileName: string }
  | { type: 'delete'; profileId: string; profileName: string };

type RulesPageProps = {
  profile: NoticeProfile | null;
  profiles: Array<{ id: string; name: string; active: boolean }>;
  activeProfileId: string;
  profileError?: string;
  hookCatalog: HookEventDefinition[];
  hookEventSelections: { bySource: Record<string, string[]> };
  internalEvents: InternalEventDefinition[];
  desktopNoticeInstances: DesktopNoticeInstance[];
  error?: string;
  customInternalEventError?: string;
  onActivateProfile: (profileId: string) => void;
  onClearCustomInternalEventError: () => void;
  onCreateProfile: (profileId: string, profileName: string, template?: ProfileTemplate) => void;
  onCreateCustomInternalEvent: (request: CreateCustomInternalEventRequest) => Promise<void>;
  onDeleteProfile: (profileId: string) => void;
  onDeleteCustomInternalEvent: (eventId: string) => Promise<void>;
  onDuplicateProfile: (sourceProfileId: string, profileId: string, profileName: string) => void;
  onExportProfilePackage: (path: string) => Promise<void>;
  onImportProfilePackage: (
    packagePath: string,
    bindings: ProfilePackageDeviceBinding[],
    activate: boolean
  ) => Promise<unknown>;
  onOpenHookSettings: () => void;
  onPreviewProfilePackageImport: (path: string) => Promise<ProfilePackageImportPreview>;
  onSaveProfile: (profile: NoticeProfile) => void;
  onUpdateCustomInternalEvent: (request: UpdateCustomInternalEventRequest) => Promise<void>;
};

export function RulesPage({
  profile,
  profiles,
  activeProfileId,
  profileError,
  hookCatalog,
  hookEventSelections,
  internalEvents,
  desktopNoticeInstances,
  error,
  customInternalEventError,
  onActivateProfile,
  onClearCustomInternalEventError,
  onCreateProfile,
  onCreateCustomInternalEvent,
  onDeleteProfile,
  onDeleteCustomInternalEvent,
  onDuplicateProfile,
  onExportProfilePackage,
  onImportProfilePackage,
  onOpenHookSettings,
  onPreviewProfilePackageImport,
  onSaveProfile,
  onUpdateCustomInternalEvent
}: RulesPageProps) {
  const t = useI18n();
  const [dialogState, setDialogState] = useState<DialogState>({ type: 'none' });
  const [importPackagePath, setImportPackagePath] = useState('');
  const [importPreview, setImportPreview] = useState<ProfilePackageImportPreview | null>(null);
  const [profilePackageBusy, setProfilePackageBusy] = useState(false);
  const { toast } = useToast();
  const activeProfile = profiles.find((p) => p.id === activeProfileId || p.active);
  const enabledHookEvents: EnabledHookEvent[] = selectedHookEventsFromSelections(
    hookEventSelections,
    hookCatalog
  );

  function handleCreateProfile(profileName: string, template?: ProfileTemplate) {
    onCreateProfile('', profileName, template);
    setDialogState({ type: 'none' });
    toast({
      title: t('rules.toast.createTitle'),
      description: t('rules.toast.createDescription', { name: profileName })
    });
  }

  function handleDuplicateProfile(profileName: string) {
    if (dialogState.type !== 'duplicate') return;
    onDuplicateProfile(dialogState.sourceProfileId, '', profileName);
    setDialogState({ type: 'none' });
    toast({
      title: t('rules.toast.duplicateTitle'),
      description: t('rules.toast.createDescription', { name: profileName })
    });
  }

  function handleActivateProfile(profileId: string) {
    const targetProfile = profiles.find((p) => p.id === profileId);
    onActivateProfile(profileId);
    toast({
      title: t('rules.toast.activateTitle'),
      description: t('rules.toast.activateDescription', { name: targetProfile?.name ?? profileId })
    });
  }

  function handleDeleteProfile() {
    if (dialogState.type !== 'delete') return;
    onDeleteProfile(dialogState.profileId);
    setDialogState({ type: 'none' });
    toast({
      title: t('rules.toast.deleteTitle'),
      description: t('rules.toast.deleteDescription', { name: dialogState.profileName })
    });
  }

  async function handleExportCurrentProfilePackage() {
    if (!activeProfile) return;
    setProfilePackageBusy(true);
    try {
      const selectedPath = await save({
        defaultPath: `cc-notice-profile-${safeProfileFilePart(activeProfile.id)}.json`,
        filters: [{ name: 'CC Notice Profile', extensions: ['json'] }]
      });
      if (!selectedPath) return;
      await onExportProfilePackage(selectedPath);
      toast({
        title: t('rules.profilePackage.exportSuccessTitle'),
        description: t('rules.profilePackage.exportSuccessDescription')
      });
    } catch (error) {
      toast({
        title: t('rules.profilePackage.exportFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setProfilePackageBusy(false);
    }
  }

  async function handleOpenProfilePackageImport() {
    setProfilePackageBusy(true);
    try {
      const selectedPath = await open({
        multiple: false,
        directory: false,
        filters: [{ name: 'CC Notice Profile', extensions: ['json'] }]
      });
      if (!selectedPath || Array.isArray(selectedPath)) return;
      const preview = await onPreviewProfilePackageImport(selectedPath);
      setImportPackagePath(selectedPath);
      setImportPreview(preview);
    } catch (error) {
      toast({
        title: t('rules.profilePackage.previewFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setProfilePackageBusy(false);
    }
  }

  async function handleConfirmProfilePackageImport(
    bindings: ProfilePackageDeviceBinding[],
    activate: boolean
  ) {
    if (!importPackagePath) return;
    setProfilePackageBusy(true);
    try {
      await onImportProfilePackage(importPackagePath, bindings, activate);
      const importedName = importPreview?.importedProfileName ?? '';
      setImportPackagePath('');
      setImportPreview(null);
      toast({
        title: t('rules.profilePackage.importSuccessTitle'),
        description: t('rules.profilePackage.importSuccessDescription', { name: importedName })
      });
    } catch (error) {
      toast({
        title: t('rules.profilePackage.importFailedTitle'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive'
      });
    } finally {
      setProfilePackageBusy(false);
    }
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('rules.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('rules.loadingProfile')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('rules.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('rules.description')}</p>
      </div>

      <ProfileManagementSection
        activeProfile={activeProfile}
        profileError={profileError}
        profiles={profiles}
        onActivateProfile={handleActivateProfile}
        onCreateProfile={() => setDialogState({ type: 'create' })}
        onDeleteProfile={(profileId, profileName) =>
          setDialogState({
            type: 'delete',
            profileId,
            profileName
          })
        }
        onDuplicateActiveProfile={() =>
          activeProfile &&
          setDialogState({
            type: 'duplicate',
            sourceProfileId: activeProfile.id,
            sourceProfileName: activeProfile.name
          })
        }
        onDuplicateProfile={(profileId, profileName) =>
          setDialogState({
            type: 'duplicate',
            sourceProfileId: profileId,
            sourceProfileName: profileName
          })
        }
        onExportProfilePackage={handleExportCurrentProfilePackage}
        onImportProfilePackage={handleOpenProfilePackageImport}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <RuleConfigurationTabs
        enabledHookEvents={enabledHookEvents}
        hookCatalog={hookCatalog}
        internalEvents={internalEvents}
        desktopNoticeInstances={desktopNoticeInstances}
        profile={profile}
        onOpenHookSettings={onOpenHookSettings}
        onSaveProfile={onSaveProfile}
      />

      <Separator />

      <InternalEventCatalogSection
        customEventError={customInternalEventError}
        internalEvents={internalEvents}
        onClearCustomEventError={onClearCustomInternalEventError}
        onCreateCustomEvent={onCreateCustomInternalEvent}
        onDeleteCustomEvent={onDeleteCustomInternalEvent}
        onUpdateCustomEvent={onUpdateCustomInternalEvent}
      />

      {/* 对话框 */}
      <ProfileCreateDialog
        open={dialogState.type === 'create' || dialogState.type === 'duplicate'}
        mode={dialogState.type === 'create' ? 'create' : 'duplicate'}
        sourceProfileName={
          dialogState.type === 'duplicate' ? dialogState.sourceProfileName : undefined
        }
        onClose={() => setDialogState({ type: 'none' })}
        onCreate={dialogState.type === 'create' ? handleCreateProfile : handleDuplicateProfile}
      />
      <ProfileDeleteDialog
        open={dialogState.type === 'delete'}
        profileName={dialogState.type === 'delete' ? dialogState.profileName : ''}
        onClose={() => setDialogState({ type: 'none' })}
        onConfirm={handleDeleteProfile}
      />
      <ProfilePackageImportDialog
        open={Boolean(importPreview)}
        packagePath={importPackagePath}
        preview={importPreview}
        importing={profilePackageBusy}
        onClose={() => {
          if (profilePackageBusy) return;
          setImportPackagePath('');
          setImportPreview(null);
        }}
        onConfirm={handleConfirmProfilePackageImport}
      />
    </div>
  );
}

function safeProfileFilePart(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'profile';
}
