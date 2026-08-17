import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { HardwareOutput } from '../../api/tauriApi';
import { SoundOutputFields } from './SoundOutputFields';

const mocks = vi.hoisted(() => ({
  soundAssets: vi.fn(),
  previewSound: vi.fn(),
  open: vi.fn()
}));

vi.mock('../../api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/tauriApi')>(
    '../../api/tauriApi'
  );
  return {
    ...actual,
    getSoundAssets: mocks.soundAssets,
    previewSound: mocks.previewSound
  };
});

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mocks.open
}));

const output: HardwareOutput = {
  type: 'sound',
  durationMs: null,
  text: null,
  notificationLevel: null,
  notificationTitle: null,
  notificationBody: null,
  notificationTitleMaxChars: null,
  notificationBodyMaxChars: null,
  notificationThrottleSeconds: null,
  notificationSound: null,
  webhookMethod: null,
  webhookUrl: null,
  webhookHeaders: null,
  webhookBody: null,
  webhookBodyMaxChars: null,
  soundFilePath: '',
  soundVolumePercent: 80,
  soundMaxDurationMs: 3000,
  soundThrottleSeconds: 30
};

describe('SoundOutputFields', () => {
  beforeEach(() => {
    mocks.soundAssets.mockReset();
    mocks.previewSound.mockReset();
    mocks.open.mockReset();
  });

  test('loads built-in and user sound assets and selects one into sound file path', async () => {
    mocks.soundAssets.mockResolvedValueOnce([
      { id: 'builtin:done.wav', label: 'done', path: '/app/sounds/done.wav', source: 'built-in' },
      { id: 'user:soft.mp3', label: 'soft', path: '/home/.cc-notice/sounds/soft.mp3', source: 'user' }
    ]);
    const onChange = vi.fn();

    render(
      <SoundOutputFields internalEvent="agent.completed" output={output} onChange={onChange} />
    );

    await waitFor(() => expect(mocks.soundAssets).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('combobox', { name: '音频来源' }));
    fireEvent.click(screen.getByRole('option', { name: '用户目录' }));
    fireEvent.click(screen.getByRole('combobox', { name: '用户目录音频' }));
    fireEvent.click(screen.getByRole('option', { name: 'soft' }));

    expect(onChange).toHaveBeenCalledWith({
      ...output,
      soundFilePath: '/home/.cc-notice/sounds/soft.mp3'
    });
  });

  test('previews selected sound with current volume and duration', async () => {
    mocks.soundAssets.mockResolvedValueOnce([]);
    mocks.previewSound.mockResolvedValueOnce(undefined);

    render(
      <SoundOutputFields
        internalEvent="agent.completed"
        output={{ ...output, soundFilePath: '/tmp/notice.wav' }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '预览' }));

    await waitFor(() =>
      expect(mocks.previewSound).toHaveBeenCalledWith('/tmp/notice.wav', 80, 3000)
    );
  });

  test('hides windows verbatim prefix when showing current sound path', async () => {
    mocks.soundAssets.mockResolvedValueOnce([]);
    mocks.previewSound.mockResolvedValueOnce(undefined);
    const rawPath = String.raw`\\?\C:\Program Files\CC Notice\assets\sounds\done.mp3`;

    render(
      <SoundOutputFields
        internalEvent="agent.completed"
        output={{ ...output, soundFilePath: rawPath }}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getAllByDisplayValue(String.raw`C:\Program Files\CC Notice\assets\sounds\done.mp3`)
    ).toHaveLength(2);
    expect(screen.queryByDisplayValue(rawPath)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '预览' }));

    await waitFor(() => expect(mocks.previewSound).toHaveBeenCalledWith(rawPath, 80, 3000));
  });

  test('custom source keeps file picker available', async () => {
    mocks.soundAssets.mockResolvedValueOnce([]);
    mocks.open.mockResolvedValueOnce('/tmp/custom.wav');
    const onChange = vi.fn();

    render(
      <SoundOutputFields internalEvent="agent.completed" output={output} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole('combobox', { name: '音频来源' }));
    fireEvent.click(screen.getByRole('option', { name: '自定义路径' }));
    fireEvent.click(screen.getByRole('button', { name: '选择' }));

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        ...output,
        soundFilePath: '/tmp/custom.wav'
      })
    );
  });

  test('keeps partial number input editable before committing a valid value', async () => {
    mocks.soundAssets.mockResolvedValueOnce([]);
    const onChange = vi.fn();

    render(
      <SoundOutputFields internalEvent="agent.completed" output={output} onChange={onChange} />
    );

    await waitFor(() => expect(mocks.soundAssets).toHaveBeenCalled());
    const durationInput = screen.getByLabelText('最长播放毫秒');
    fireEvent.change(durationInput, { target: { value: '0' } });
    expect(durationInput).toHaveValue(0);
    expect(onChange).not.toHaveBeenCalledWith({
      ...output,
      soundMaxDurationMs: 1
    });

    fireEvent.change(durationInput, { target: { value: '1000' } });
    expect(onChange).toHaveBeenCalledWith({
      ...output,
      soundMaxDurationMs: 1000
    });
  });
});
