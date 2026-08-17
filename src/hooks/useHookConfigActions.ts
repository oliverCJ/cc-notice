import { Dispatch, SetStateAction, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import {
  addHookProjectTarget,
  HookConfigWritePreview,
  HookConfigWriteResult,
  HookEventFrontendState,
  HookEventSelections,
  getHookEventState,
  previewHookConfigTarget,
  previewRestoreHookConfigTarget,
  removeHookConfigTarget,
  restoreHookConfigTarget,
  saveHookEventSelections,
  writeHookConfigTarget
} from '@/api/tauriApi';
import { withoutRecordKey } from '@/lib/record';
import { defaultTargetDebugEnabled } from '@/pages/hook-settings/hookTargetDebugMode';
import { AiToolId } from '@/state/appStore';

type UseHookConfigActionsParams = {
  hookEventState: HookEventFrontendState | null;
  selectedToolId: AiToolId;
  setHookEventState: Dispatch<SetStateAction<HookEventFrontendState | null>>;
};

const HOOK_TARGET_WRITE_RESULT_VISIBLE_MS = 10_000;
const HOOK_TARGET_ERROR_VISIBLE_MS = 10_000;

export function useHookConfigActions({
  hookEventState,
  selectedToolId,
  setHookEventState
}: UseHookConfigActionsParams) {
  const [hookConfigPreviewDialog, setHookConfigPreviewDialog] =
    useState<HookConfigWritePreview | null>(null);
  const [hookConfigPreviewMode, setHookConfigPreviewMode] = useState<'write' | 'restore'>(
    'write'
  );
  const [hookTargetWriteResults, setHookTargetWriteResults] =
    useState<Record<string, HookConfigWriteResult>>({});
  const [hookTargetErrors, setHookTargetErrors] = useState<Record<string, string>>({});
  const [hookTargetBusy, setHookTargetBusy] =
    useState<Record<string, 'preview' | 'write' | 'restore'>>({});
  const [hookTargetDebugModes, setHookTargetDebugModes] = useState<Record<string, boolean>>({});
  const [hookConfigError, setHookConfigError] = useState<string>();
  const [hookTargetError, setHookTargetError] = useState<string>();
  const hookSelectionSequence = useRef(0);
  const hookConfigArtifactSequence = useRef(0);
  const hookTargetWriteResultTimers = useRef<Record<string, number>>({});
  const hookTargetErrorTimer = useRef<number>();

  function currentTargetDebugMode(targetId: string) {
    return (
      hookTargetDebugModes[targetId] ??
      defaultTargetDebugEnabled(hookEventState?.targets, targetId)
    );
  }

  async function handleHookSelectionChange(nextSelections: HookEventSelections) {
    const selectionSequence = hookSelectionSequence.current + 1;
    hookSelectionSequence.current = selectionSequence;
    clearHookConfigArtifacts();
    setHookEventState((current) =>
      current ? { ...current, selected: nextSelections } : current
    );
    await saveHookEventSelections(nextSelections);
    const nextHookState = await getHookEventState();
    if (selectionSequence === hookSelectionSequence.current) {
      setHookEventState(nextHookState);
    }
  }

  async function handlePreviewHookConfigTarget(targetId: string) {
    const artifactSequence = hookConfigArtifactSequence.current;
    setHookConfigError(undefined);
    setHookTargetErrors((current) => withoutRecordKey(current, targetId));
    setHookTargetBusy((current) => ({ ...current, [targetId]: 'preview' }));
    try {
      const preview = await previewHookConfigTarget(targetId, currentTargetDebugMode(targetId));
      if (artifactSequence === hookConfigArtifactSequence.current) {
        setHookConfigPreviewDialog(preview);
        setHookConfigPreviewMode('write');
      }
    } catch (error) {
      if (artifactSequence === hookConfigArtifactSequence.current) {
        setHookTargetErrors((current) => ({
          ...current,
          [targetId]: error instanceof Error ? error.message : String(error)
        }));
      }
    } finally {
      setHookTargetBusy((current) => withoutRecordKey(current, targetId));
    }
  }

  async function handleWriteHookConfigTarget(targetId: string) {
    const artifactSequence = hookConfigArtifactSequence.current;
    setHookConfigError(undefined);
    setHookTargetErrors((current) => withoutRecordKey(current, targetId));
    setHookTargetBusy((current) => ({ ...current, [targetId]: 'write' }));
    try {
      const result = await writeHookConfigTarget(targetId, currentTargetDebugMode(targetId));
      const nextHookState = await getHookEventState();
      if (artifactSequence === hookConfigArtifactSequence.current) {
        setHookEventState(nextHookState);
        showHookTargetWriteResult(targetId, result);
        setHookConfigPreviewDialog((current) =>
          current?.targetId === targetId ? null : current
        );
      }
    } catch (error) {
      if (artifactSequence === hookConfigArtifactSequence.current) {
        setHookTargetErrors((current) => ({
          ...current,
          [targetId]: error instanceof Error ? error.message : String(error)
        }));
      }
    } finally {
      setHookTargetBusy((current) => withoutRecordKey(current, targetId));
    }
  }

  async function handlePreviewRestoreHookConfigTarget(targetId: string) {
    const artifactSequence = hookConfigArtifactSequence.current;
    setHookConfigError(undefined);
    setHookTargetErrors((current) => withoutRecordKey(current, targetId));
    setHookTargetBusy((current) => ({ ...current, [targetId]: 'preview' }));
    try {
      const preview = await previewRestoreHookConfigTarget(targetId);
      if (artifactSequence === hookConfigArtifactSequence.current) {
        setHookConfigPreviewDialog(preview);
        setHookConfigPreviewMode('restore');
      }
    } catch (error) {
      if (artifactSequence === hookConfigArtifactSequence.current) {
        setHookTargetErrors((current) => ({
          ...current,
          [targetId]: error instanceof Error ? error.message : String(error)
        }));
      }
    } finally {
      setHookTargetBusy((current) => withoutRecordKey(current, targetId));
    }
  }

  async function handleConfirmRestoreHookConfigTarget(targetId: string) {
    const artifactSequence = hookConfigArtifactSequence.current;
    setHookConfigError(undefined);
    setHookTargetErrors((current) => withoutRecordKey(current, targetId));
    setHookTargetBusy((current) => ({ ...current, [targetId]: 'restore' }));
    try {
      const result = await restoreHookConfigTarget(targetId);
      const nextHookState = await getHookEventState();
      if (artifactSequence === hookConfigArtifactSequence.current) {
        setHookEventState(nextHookState);
        clearHookTargetWriteResult(targetId);
        setHookConfigPreviewDialog((current) =>
          current?.targetId === targetId ? null : current
        );
      }
    } catch (error) {
      if (artifactSequence === hookConfigArtifactSequence.current) {
        setHookTargetErrors((current) => ({
          ...current,
          [targetId]: error instanceof Error ? error.message : String(error)
        }));
      }
    } finally {
      setHookTargetBusy((current) => withoutRecordKey(current, targetId));
    }
  }

  async function handleAddProjectTarget() {
    clearHookTargetError();
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected === null) {
        return;
      }
      if (typeof selected !== 'string' || selected.trim().length === 0) {
        showHookTargetError('hookSettings.errors.invalidProjectDirectory');
        return;
      }
      const nextState = await addHookProjectTarget(selectedToolId, selected);
      setHookEventState(nextState);
      clearHookConfigArtifacts();
    } catch (error) {
      showHookTargetError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleRemoveHookConfigTarget(targetId: string) {
    clearHookTargetError();
    try {
      const nextState = await removeHookConfigTarget(targetId);
      setHookEventState(nextState);
      clearHookTargetArtifacts(targetId);
    } catch (error) {
      showHookTargetError(error instanceof Error ? error.message : String(error));
    }
  }

  function clearHookConfigArtifacts() {
    hookConfigArtifactSequence.current += 1;
    setHookConfigPreviewDialog(null);
    setHookConfigPreviewMode('write');
    setHookTargetWriteResults({});
    setHookTargetErrors({});
    setHookTargetBusy({});
    setHookConfigError(undefined);
    clearHookTargetError();
    Object.values(hookTargetWriteResultTimers.current).forEach((timerId) =>
      window.clearTimeout(timerId)
    );
    hookTargetWriteResultTimers.current = {};
  }

  function handleTargetDebugModeChange(targetId: string, enabled: boolean) {
    setHookTargetDebugModes((current) => ({ ...current, [targetId]: enabled }));
    setHookTargetWriteResults((current) => withoutRecordKey(current, targetId));
    setHookConfigPreviewDialog((current) => (current?.targetId === targetId ? null : current));
  }

  function clearHookTargetArtifacts(targetId: string) {
    hookConfigArtifactSequence.current += 1;
    setHookConfigPreviewDialog((current) => (current?.targetId === targetId ? null : current));
    setHookTargetWriteResults((current) => withoutRecordKey(current, targetId));
    setHookTargetErrors((current) => withoutRecordKey(current, targetId));
    setHookTargetBusy((current) => withoutRecordKey(current, targetId));
    setHookConfigError(undefined);
    clearHookTargetError();
    if (hookTargetWriteResultTimers.current[targetId] !== undefined) {
      window.clearTimeout(hookTargetWriteResultTimers.current[targetId]);
      delete hookTargetWriteResultTimers.current[targetId];
    }
  }

  function showHookTargetWriteResult(targetId: string, result: HookConfigWriteResult) {
    clearHookTargetWriteResult(targetId);
    setHookTargetWriteResults((current) => ({ ...current, [targetId]: result }));
    hookTargetWriteResultTimers.current[targetId] = window.setTimeout(() => {
      clearHookTargetWriteResult(targetId);
    }, HOOK_TARGET_WRITE_RESULT_VISIBLE_MS);
  }

  function clearHookTargetWriteResult(targetId: string) {
    const timerId = hookTargetWriteResultTimers.current[targetId];
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      delete hookTargetWriteResultTimers.current[targetId];
    }
    setHookTargetWriteResults((current) => withoutRecordKey(current, targetId));
  }

  function showHookTargetError(message: string) {
    clearHookTargetError();
    setHookTargetError(message);
    hookTargetErrorTimer.current = window.setTimeout(() => {
      clearHookTargetError();
    }, HOOK_TARGET_ERROR_VISIBLE_MS);
  }

  function clearHookTargetError() {
    if (hookTargetErrorTimer.current !== undefined) {
      window.clearTimeout(hookTargetErrorTimer.current);
      hookTargetErrorTimer.current = undefined;
    }
    setHookTargetError(undefined);
  }

  return {
    clearHookConfigArtifacts,
    handleAddProjectTarget,
    handleConfirmRestoreHookConfigTarget,
    handleHookSelectionChange,
    handlePreviewHookConfigTarget,
    handlePreviewRestoreHookConfigTarget,
    handleRemoveHookConfigTarget,
    handleTargetDebugModeChange,
    handleWriteHookConfigTarget,
    hookConfigError,
    hookConfigPreviewDialog,
    hookConfigPreviewMode,
    hookTargetBusy,
    hookTargetError,
    hookTargetErrors,
    hookTargetDebugModes,
    hookTargetWriteResults,
    setHookConfigPreviewDialog
  };
}
