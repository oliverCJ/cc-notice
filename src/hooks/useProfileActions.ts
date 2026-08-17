import { Dispatch, SetStateAction, useRef, useState } from 'react';
import {
  activateProfile,
  createProfile,
  deleteProfile,
  duplicateProfile,
  exportProfilePackage,
  HookEventFrontendState,
  importProfilePackage,
  NoticeProfile,
  previewProfilePackageImport,
  ProfileFrontendState,
  ProfilePackageDeviceBinding,
  ProfilePackageImportPreview,
  ProfileTemplate,
  saveProfile
} from '@/api/tauriApi';
import { AppConfigView } from '@/state/appStore';

type UseProfileActionsParams = {
  setAppConfig: Dispatch<SetStateAction<AppConfigView>>;
  setHookEventState?: Dispatch<SetStateAction<HookEventFrontendState | null>>;
  setProfileState: Dispatch<SetStateAction<ProfileFrontendState | null>>;
};

export function useProfileActions({
  setAppConfig,
  setHookEventState,
  setProfileState
}: UseProfileActionsParams) {
  const [profileError, setProfileError] = useState<string>();
  const profileSaveSequence = useRef(0);

  async function handleSaveProfile(profile: NoticeProfile) {
    const saveSequence = profileSaveSequence.current + 1;
    profileSaveSequence.current = saveSequence;
    setProfileError(undefined);
    try {
      const nextState = await saveProfile(profile);
      // 多个快速编辑会并发保存，只允许最新一次响应刷新界面状态。
      if (saveSequence === profileSaveSequence.current) {
        setProfileState(nextState);
      }
    } catch (error) {
      if (saveSequence === profileSaveSequence.current) {
        setProfileError(error instanceof Error ? error.message : String(error));
      }
    }
  }

  async function handleActivateProfile(profileId: string) {
    profileSaveSequence.current += 1;
    setProfileError(undefined);
    try {
      const nextState = await activateProfile(profileId);
      setProfileState(nextState);
      setAppConfig((currentConfig) => ({
        ...currentConfig,
        activeProfileId: nextState.activeProfileId
      }));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDeleteProfile(profileId: string) {
    setProfileError(undefined);
    try {
      const nextState = await deleteProfile(profileId);
      setProfileState(nextState);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCreateProfile(
    profileId: string,
    profileName: string,
    template?: ProfileTemplate
  ) {
    setProfileError(undefined);
    try {
      const nextState = await createProfile(profileId, profileName, template);
      setProfileState(nextState);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDuplicateProfile(
    sourceProfileId: string,
    profileId: string,
    profileName: string
  ) {
    setProfileError(undefined);
    try {
      const nextState = await duplicateProfile(sourceProfileId, profileId, profileName);
      setProfileState(nextState);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleExportProfilePackage(path: string) {
    setProfileError(undefined);
    try {
      await exportProfilePackage(path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setProfileError(message);
      throw error;
    }
  }

  async function handlePreviewProfilePackageImport(
    path: string
  ): Promise<ProfilePackageImportPreview> {
    setProfileError(undefined);
    try {
      return await previewProfilePackageImport(path);
    } catch (error) {
      throw error;
    }
  }

  async function handleImportProfilePackage(
    packagePath: string,
    bindings: ProfilePackageDeviceBinding[],
    activate: boolean
  ) {
    profileSaveSequence.current += 1;
    setProfileError(undefined);
    try {
      const importResult = await importProfilePackage({ packagePath, bindings, activate });
      const nextState = importResult.profileState;
      setProfileState(nextState);
      setAppConfig((currentConfig) => ({
        ...currentConfig,
        activeProfileId: nextState.activeProfileId,
        hookEventSelections: importResult.hookEventSelections,
        desktopNoticeInstances: importResult.desktopNoticeInstances
      }));
      setHookEventState?.((currentState) =>
        currentState
          ? {
              ...currentState,
              selected: importResult.hookEventSelections
            }
          : currentState
      );
      return nextState;
    } catch (error) {
      throw error;
    }
  }

  return {
    handleActivateProfile,
    handleCreateProfile,
    handleDeleteProfile,
    handleDuplicateProfile,
    handleExportProfilePackage,
    handleImportProfilePackage,
    handlePreviewProfilePackageImport,
    handleSaveProfile,
    profileError
  };
}
