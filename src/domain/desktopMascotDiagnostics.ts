import type { CustomMascotDiagnostic, DesktopMascotRuntimePack } from './desktopMascot';

const knownDiagnosticCodes = new Set([
  'MANIFEST_READ_FAILED',
  'MANIFEST_INVALID_JSON',
  'MANIFEST_TOO_LARGE',
  'INVALID_ID',
  'INVALID_RENDERER',
  'INVALID_ANIMATION_PATH',
  'MISSING_ANIMATION_FILE',
  'INVALID_GIF_FILE',
  'ANIMATION_FILE_TOO_LARGE',
  'PACK_TOO_LARGE',
  'TOO_MANY_PACKS',
  'TOO_MANY_ANIMATIONS',
  'TOO_MANY_ACTIONS',
  'MISSING_REQUIRED_ACTION',
  'UNKNOWN_ACTION_ANIMATION',
  'INVALID_INTERACTION_ACTION'
]);

export type CustomMascotLoadedPackView = {
  id: string;
  name: string;
  version: string;
  renderer: string;
  actionCount: number;
  animationCount: number;
};

export type CustomMascotDiagnosticIssueView = {
  code: string;
  path: string;
  rawMessage: string;
  titleKey: string;
  impactKey: string;
  suggestionKey: string;
};

export type CustomMascotDiagnosticGroupView = {
  key: string;
  title: string;
  path: string;
  issueCount: number;
  issues: CustomMascotDiagnosticIssueView[];
};

export type CustomMascotDiagnosticSummaryView = {
  loadedPacks: CustomMascotLoadedPackView[];
  issueGroups: CustomMascotDiagnosticGroupView[];
  loadedCount: number;
  issueCount: number;
};

export function buildCustomMascotDiagnosticGroups(
  packs: DesktopMascotRuntimePack[],
  diagnostics: CustomMascotDiagnostic[],
  translate: (key: string) => string
): CustomMascotDiagnosticSummaryView {
  const loadedPacks = packs.map((pack) => ({
    id: pack.id,
    name: pack.nameKey ? translate(pack.nameKey) : pack.name ?? pack.id,
    version: pack.version,
    renderer: pack.renderer,
    actionCount: pack.actions.length,
    animationCount: Object.keys(pack.animations).length
  }));
  const groups = new Map<string, CustomMascotDiagnosticGroupView>();
  for (const item of diagnostics) {
    const key = item.packId?.trim() || item.path;
    const group =
      groups.get(key) ??
      ({
        key,
        title: item.packId?.trim() || basename(item.path),
        path: item.path,
        issueCount: 0,
        issues: []
      } satisfies CustomMascotDiagnosticGroupView);
    group.issues.push(toIssueView(item));
    group.issueCount = group.issues.length;
    groups.set(key, group);
  }
  return {
    loadedPacks,
    issueGroups: [...groups.values()],
    loadedCount: loadedPacks.length,
    issueCount: diagnostics.length
  };
}

function toIssueView(item: CustomMascotDiagnostic): CustomMascotDiagnosticIssueView {
  const code = knownDiagnosticCodes.has(item.code) ? item.code : 'UNKNOWN';
  return {
    code: item.code,
    path: item.path,
    rawMessage: item.message,
    titleKey: `desktopNotice.mascot.diagnostics.codes.${code}.title`,
    impactKey: `desktopNotice.mascot.diagnostics.codes.${code}.impact`,
    suggestionKey: `desktopNotice.mascot.diagnostics.codes.${code}.suggestion`
  };
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.split('/').filter(Boolean).pop() || path;
}
