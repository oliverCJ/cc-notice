import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { HookConfigPreviewDialog } from './HookConfigPreviewDialog';
import type { HookConfigWritePreview } from '@/api/tauriApi';

const diffViewerProps: Array<{ useDarkTheme?: boolean }> = [];

vi.mock('react-diff-viewer-continued', () => ({
  default: (props: { useDarkTheme?: boolean }) => {
    diffViewerProps.push({ useDarkTheme: props.useDarkTheme });
    return <div data-testid="diff-viewer" />;
  },
  DiffMethod: {
    WORDS: 'words'
  }
}));

const preview: HookConfigWritePreview = {
  targetId: 'project-codex',
  source: 'codex',
  configPath: '/tmp/settings.json',
  configExists: true,
  originalJson: '{"hooks":[]}',
  previewJson: '{"hooks":["Stop"]}',
  eventCount: 1,
  inlineHooksWarning: null
};

function renderDialog() {
  return render(
    <I18nProvider language="zh-CN">
      <HookConfigPreviewDialog
        preview={preview}
        targetLabel="Project Codex"
        onClose={vi.fn()}
        onWrite={vi.fn()}
      />
    </I18nProvider>
  );
}

describe('HookConfigPreviewDialog', () => {
  beforeEach(() => {
    diffViewerProps.length = 0;
    document.documentElement.classList.remove('dark');
  });

  test('updates diff viewer theme when the document dark class changes', async () => {
    renderDialog();

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(diffViewerProps[diffViewerProps.length - 1]?.useDarkTheme).toBe(false);

    document.documentElement.classList.add('dark');

    await waitFor(() => {
      expect(diffViewerProps[diffViewerProps.length - 1]?.useDarkTheme).toBe(true);
    });
  });
});
