import {
  type CustomFaceGroup,
  type CustomFaceGroupSummary,
  type DeviceDisplayCapabilities,
  getCustomFaceGroup,
  getCustomFaceGroups
} from '@/api/tauriApi';
import { editorProfileFromId } from './editor/profile';

export type CustomFaceLibraryEntries = {
  groups: CustomFaceGroupSummary[];
  groupById: Record<string, CustomFaceGroup>;
};

type CustomFaceDisplayTarget = {
  display: DeviceDisplayCapabilities | null;
};

export async function loadCustomFaceLibraryEntries(): Promise<CustomFaceLibraryEntries> {
  const groups = await getCustomFaceGroups();
  if (!Array.isArray(groups) || groups.length === 0) {
    return { groups: [], groupById: {} };
  }
  const entries = await Promise.all(
    groups.map(async (group) => {
      try {
        return [group, await getCustomFaceGroup(group.groupId)] as const;
      } catch (error) {
        console.warn('failed to load custom face group detail', {
          groupId: group.groupId,
          error,
        });
        return null;
      }
    })
  );
  const validEntries = entries.filter((entry): entry is readonly [CustomFaceGroupSummary, CustomFaceGroup] =>
    entry !== null
  );
  return {
    groups: validEntries.map(([group]) => group),
    groupById: Object.fromEntries(
      validEntries.map(([group, detail]) => [group.groupId, detail])
    ),
  };
}

export function filterCustomFaceGroupSummariesForDisplay(
  groups: CustomFaceGroupSummary[],
  target: CustomFaceDisplayTarget
): CustomFaceGroupSummary[] {
  const display = target.display;
  if (!display?.face || !isPositiveInteger(display.pixelWidth) || !isPositiveInteger(display.pixelHeight)) {
    return [];
  }

  return groups.filter((group) => {
    const profile = editorProfileFromId(group.displayProfileId);
    if (!profile) {
      return false;
    }
    return profile.width === display.pixelWidth && profile.height === display.pixelHeight;
  });
}

export function resolveCustomFaceGroupFaceCount(group: CustomFaceGroupSummary | CustomFaceGroup) {
  return 'faceCount' in group ? group.faceCount : group.faces.length;
}

function isPositiveInteger(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}
