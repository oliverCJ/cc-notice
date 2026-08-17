import {
  ProfilePackageDeviceBinding,
  ProfilePackageDeviceBindingStatus,
  ProfilePackageDeviceGroupPreview
} from '@/api/tauriApi';

export type ProfilePackageBindingSelection = Record<string, string>;

export function initialProfilePackageBindingSelection(
  deviceGroups: ProfilePackageDeviceGroupPreview[]
): ProfilePackageBindingSelection {
  return Object.fromEntries(
    deviceGroups.map((group) => [
      group.sourceDeviceKey,
      group.candidates.find((candidate) => candidate.status === 'full-match')?.deviceId ?? ''
    ])
  );
}

export function buildProfilePackageBindings(
  selection: ProfilePackageBindingSelection
): ProfilePackageDeviceBinding[] {
  return Object.entries(selection).map(([sourceDeviceKey, targetDeviceId]) => ({
    sourceDeviceKey,
    targetDeviceId: targetDeviceId || null
  }));
}

export function selectedCandidateStatus(
  group: ProfilePackageDeviceGroupPreview,
  targetDeviceId: string
): ProfilePackageDeviceBindingStatus {
  if (!targetDeviceId) {
    return 'unbound';
  }
  return (
    group.candidates.find((candidate) => candidate.deviceId === targetDeviceId)?.status ??
    'unbound'
  );
}

