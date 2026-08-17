import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ProfileCreateDialog } from './ProfileCreateDialog';

vi.mock('@/api/tauriApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/tauriApi')>();
  return {
    ...actual,
    getProfileTemplateList: vi.fn().mockResolvedValue([
      {
        id: 'basic',
        name: '基础映射方案',
        description: '预设常用 AI Hook 到内部事件的映射和基础输出规则，不启用任何 Hook。',
        recommended: true
      }
    ])
  };
});

describe('ProfileCreateDialog', () => {
  test('renders template description from active language', async () => {
    render(
      <I18nProvider language="en-US">
        <ProfileCreateDialog
          open={true}
          mode="create"
          onClose={vi.fn()}
          onCreate={vi.fn()}
        />
      </I18nProvider>
    );

    expect(await screen.findByText('Basic Mapping Profile')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Preset common AI Hook mappings and basic output rules without enabling any Hook event.')).toBeInTheDocument();
    });
    expect(screen.queryByText('预设常用 AI Hook 到内部事件的映射和基础输出规则，不启用任何 Hook。')).not.toBeInTheDocument();
  });
});
