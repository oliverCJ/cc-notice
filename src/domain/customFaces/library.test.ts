import { beforeEach, describe, expect, test, vi } from 'vitest';

const getCustomFaceGroups = vi.hoisted(() => vi.fn());
const getCustomFaceGroup = vi.hoisted(() => vi.fn());

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    getCustomFaceGroups,
    getCustomFaceGroup,
  };
});

import { filterCustomFaceGroupSummariesForDisplay, loadCustomFaceLibraryEntries } from './library';
import type {
  CustomFaceGroup,
  CustomFaceGroupSummary,
  DeviceDisplayCapabilities,
} from '@/api/tauriApi';

const summaryA = {
  groupId: 'group-a',
  name: 'A',
  displayProfileId: 'custom-mono-320x240-v1',
  revision: 1,
  defaultFaceId: 'face-a',
  faceCount: 1,
  libraryHash: 'hash-a',
} as CustomFaceGroupSummary;

const summaryB = {
  groupId: 'group-b',
  name: 'B',
  displayProfileId: 'custom-mono-320x240-v1',
  revision: 1,
  defaultFaceId: 'face-b',
  faceCount: 1,
  libraryHash: 'hash-b',
} as CustomFaceGroupSummary;

const groupA = {
  schemaVersion: 1,
  groupId: 'group-a',
  name: 'A',
  displayProfileId: 'custom-mono-320x240-v1',
  revision: 1,
  defaultFaceId: 'face-a',
  faces: [
    {
      faceId: 'face-a',
      name: '默认',
      color: { red: 255, green: 255, blue: 255 },
      frames: [{ durationMs: 200, packedPixels: [] }],
    },
  ],
} as CustomFaceGroup;

describe('customFaces/library', () => {
  beforeEach(() => {
    getCustomFaceGroups.mockReset();
    getCustomFaceGroup.mockReset();
  });

  test('keeps healthy groups when one custom face group detail fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getCustomFaceGroups.mockResolvedValue([summaryA, summaryB]);
    getCustomFaceGroup.mockImplementation(async (groupId: string) => {
      if (groupId === 'group-a') {
        return groupA;
      }
      throw new Error('broken group');
    });

    const entries = await loadCustomFaceLibraryEntries();

    expect(entries.groups.map((group) => group.groupId)).toEqual(['group-a']);
    expect(entries.groupById).toEqual({ 'group-a': groupA });
    expect(warn).toHaveBeenCalledWith(
      'failed to load custom face group detail',
      expect.objectContaining({ groupId: 'group-b' })
    );
    warn.mockRestore();
  });

  test('filters custom face groups by matching display resolution', () => {
    const groups = [
      {
        groupId: 'a',
        name: 'A',
        displayProfileId: 'custom-mono-128x32-v1',
        revision: 1,
        defaultFaceId: 'face-a',
        faceCount: 1,
        libraryHash: 'hash-a'
      },
      {
        groupId: 'b',
        name: 'B',
        displayProfileId: 'custom-mono-320x240-v1',
        revision: 1,
        defaultFaceId: 'face-b',
        faceCount: 1,
        libraryHash: 'hash-b'
      },
      {
        groupId: 'c',
        name: 'C',
        displayProfileId: 'custom-mono-128x64-v1',
        revision: 1,
        defaultFaceId: 'face-c',
        faceCount: 1,
        libraryHash: 'hash-c'
      }
    ] as CustomFaceGroupSummary[];

    const display = {
      face: true,
      pixelWidth: 128,
      pixelHeight: 32,
      sizeClass: 'small',
      textEncoding: 'ascii',
      status: true,
      faceTemplates: [],
      clear: true,
      statuses: [],
      titleMaxChars: 39,
      messageMaxChars: 95
    } as DeviceDisplayCapabilities;
    expect(
      filterCustomFaceGroupSummariesForDisplay(groups, { display }).map((group) => group.groupId)
    ).toEqual(['a']);
  });

  test('filters custom resolution groups by matching display resolution', () => {
    const groups = [
      {
        groupId: 'custom',
        name: 'Custom',
        displayProfileId: 'custom-128x32-v1',
        revision: 1,
        defaultFaceId: 'face-custom',
        faceCount: 1,
        libraryHash: 'hash-custom'
      }
    ] as CustomFaceGroupSummary[];

    const display = {
      face: true,
      pixelWidth: 128,
      pixelHeight: 32,
      sizeClass: 'small',
      textEncoding: 'ascii',
      status: true,
      faceTemplates: [],
      clear: true,
      statuses: [],
      titleMaxChars: 39,
      messageMaxChars: 95
    } as DeviceDisplayCapabilities;

    expect(
      filterCustomFaceGroupSummariesForDisplay(groups, { display }).map((group) => group.groupId)
    ).toEqual(['custom']);
  });

  test('rejects groups when display face is unsupported or size is missing', () => {
    const groups = [
      {
        groupId: 'a',
        name: 'A',
        displayProfileId: 'custom-mono-128x32-v1',
        revision: 1,
        defaultFaceId: 'face-a',
        faceCount: 1,
        libraryHash: 'hash-a'
      }
    ] as CustomFaceGroupSummary[];

    const unsupportedDisplay = {
      face: false,
      pixelWidth: 128,
      pixelHeight: 32,
      sizeClass: 'small',
      textEncoding: 'ascii',
      status: true,
      faceTemplates: [],
      clear: true,
      statuses: [],
      titleMaxChars: 39,
      messageMaxChars: 95
    } as DeviceDisplayCapabilities;
    expect(filterCustomFaceGroupSummariesForDisplay(groups, { display: unsupportedDisplay })).toEqual([]);
    expect(
      filterCustomFaceGroupSummariesForDisplay(groups, {
        display: null
      })
    ).toEqual([]);
  });
});
