import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DesktopNoticeInstanceLibrary } from './DesktopNoticeInstanceLibrary';
import {
  createDefaultDesktopNoticeInstance,
  createDefaultMascotInstance
} from '@/domain/desktopNotice';

const eventListeners = new Map<string, (event: { payload: unknown }) => void>();
const getDesktopMascotAssetPacksMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ rootDir: '~/.cc-notice/mascots', packs: [], diagnostics: [] })
);
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/tauriApi', async () => {
  const actual = await vi.importActual<typeof import('@/api/tauriApi')>('@/api/tauriApi');
  return {
    ...actual,
    getDesktopMascotAssetPacks: getDesktopMascotAssetPacksMock
  };
});

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, handler: (event: { payload: unknown }) => void) => {
    eventListeners.set(eventName, handler);
    return Promise.resolve(vi.fn());
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock })
}));

describe('DesktopNoticeInstanceLibrary', () => {
  afterEach(() => {
    vi.useRealTimers();
    getDesktopMascotAssetPacksMock.mockClear();
    toastMock.mockClear();
  });

  test('creates custom lightbar by default and shows type label', async () => {
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '新建桌面提示' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'custom-lightbar',
          customLightbar: expect.any(Object),
          edgeLightbar: null
        })
      )
    );
  });

  test('switches to edge lightbar after confirmation', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('实例类型'));
    fireEvent.click(screen.getByText('固定屏幕边缘灯条'));
    fireEvent.click(screen.getByRole('button', { name: '确认切换' }));

    expect(screen.getByText('显示边')).toBeInTheDocument();
  });

  test('switches to desktop mascot after confirmation and shows mascot fields', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('实例类型'));
    fireEvent.click(screen.getByText('桌面精灵'));
    fireEvent.click(screen.getByRole('button', { name: '确认切换' }));

    expect(screen.getByLabelText('资源包')).toBeInTheDocument();
    expect(screen.getByLabelText('舞台宽度')).toHaveValue(260);
    expect(screen.getByLabelText('舞台高度')).toHaveValue(260);
    expect(screen.getByLabelText('气泡字号')).toHaveValue(14);
    expect(screen.getByLabelText('气泡字体')).toBeInTheDocument();
    expect(screen.getByLabelText('气泡')).toBeInTheDocument();
    expect(screen.queryByLabelText('圆角')).not.toBeInTheDocument();
  });

  test('only exposes polished mascot packs in the instance editor', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('实例类型'));
    fireEvent.click(screen.getByText('桌面精灵'));
    fireEvent.click(screen.getByRole('button', { name: '确认切换' }));
    fireEvent.click(screen.getByLabelText('资源包'));

    expect(screen.getAllByText('G7 精灵').length).toBeGreaterThan(0);
    expect(screen.queryByText('暖萌机器人')).not.toBeInTheDocument();
  });

  test('shows scanned local custom mascot packs in the asset pack selector', async () => {
    getDesktopMascotAssetPacksMock.mockResolvedValueOnce({
      rootDir: '~/.cc-notice/mascots',
      packs: [
        {
          id: 'my-mascot',
          name: '我的精灵',
          version: '1.0.0',
          renderer: 'gif',
          source: 'local',
          animations: {},
          states: ['idle'],
          actions: [],
          interactions: {
            hoverActionId: 'idle.sleep',
            clickActionId: 'idle.sleep'
          }
        }
      ],
      diagnostics: []
    });
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    await waitFor(() => expect(getDesktopMascotAssetPacksMock).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('资源包'));

    expect(screen.getByText('我的精灵 · 本地自定义')).toBeInTheDocument();
  });

  test('separates mascot asset scanning from display settings', async () => {
    getDesktopMascotAssetPacksMock.mockResolvedValueOnce({
      rootDir: '/Users/test/.cc-notice/mascots',
      packs: [],
      diagnostics: []
    });
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    const resourceRegion = await screen.findByRole('region', { name: '资源包与扫描' });
    const displayRegion = screen.getByRole('region', { name: '显示设置' });

    expect(resourceRegion).toContainElement(screen.getByLabelText('资源包'));
    expect(resourceRegion).toContainElement(screen.getByText('资源包放置目录：/Users/test/.cc-notice/mascots'));
    expect(displayRegion).toContainElement(screen.getByLabelText('舞台宽度'));
    expect(displayRegion).toContainElement(screen.getByLabelText('气泡字体'));
    expect(resourceRegion).not.toContainElement(screen.getByLabelText('舞台宽度'));
  });

  test('shows grouped custom mascot diagnostics with fix hints', async () => {
    getDesktopMascotAssetPacksMock.mockResolvedValueOnce({
      rootDir: '/Users/test/.cc-notice/mascots',
      packs: [],
      diagnostics: [
        {
          packId: 'broken-pack',
          path: '/Users/test/.cc-notice/mascots/broken-pack',
          code: 'MISSING_ANIMATION_FILE',
          message: 'missing animation file'
        }
      ]
    });
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    expect(await screen.findByText('发现 1 个问题')).toBeInTheDocument();
    expect(screen.getByText('broken-pack')).toBeInTheDocument();
    expect(screen.getByText('缺少 GIF 文件')).toBeInTheDocument();
    expect(screen.getByText(/请检查 animations 路径/)).toBeInTheDocument();
  });

  test('keeps loaded custom mascot packs visible when rescan fails', async () => {
    getDesktopMascotAssetPacksMock
      .mockResolvedValueOnce({
        rootDir: '/Users/test/.cc-notice/mascots',
        packs: [
          {
            id: 'local-good',
            name: '本地精灵',
            version: '1.0.0',
            renderer: 'gif',
            source: 'local',
            animations: { idle: '/packs/local-good/idle.gif' },
            states: ['idle'],
            actions: [
              {
                id: 'idle.sleep',
                state: 'idle',
                animation: 'idle',
                loop: true,
                interruptible: true
              }
            ],
            interactions: { hoverActionId: 'idle.sleep', clickActionId: 'idle.sleep' }
          }
        ],
        diagnostics: []
      })
      .mockRejectedValueOnce(new Error('scan failed'));
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    expect(await screen.findByText('本地精灵')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新扫描' }));
    expect(await screen.findByText(/扫描失败/)).toBeInTheDocument();
    expect(screen.getByText('本地精灵')).toBeInTheDocument();
  });

  test('saves mascot instance with selected local custom asset pack', async () => {
    getDesktopMascotAssetPacksMock.mockResolvedValueOnce({
      rootDir: '~/.cc-notice/mascots',
      packs: [
        {
          id: 'my-mascot',
          name: '我的精灵',
          version: '1.0.0',
          renderer: 'gif',
          source: 'local',
          animations: {},
          states: ['idle', 'task-received', 'working', 'success', 'error'],
          actions: [],
          interactions: {
            hoverActionId: 'idle.sleep',
            clickActionId: 'idle.sleep'
          }
        }
      ],
      diagnostics: []
    });
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    await waitFor(() => expect(getDesktopMascotAssetPacksMock).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('资源包'));
    fireEvent.click(screen.getByText('我的精灵 · 本地自定义'));

    expect(screen.queryByText('桌面精灵资源包不存在。')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          mascot: expect.objectContaining({
            assetPackId: 'my-mascot'
          })
        })
      )
    );
  });

  test('shows success toast after saving desktop notice instance', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.name = '主灯条';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: '保存成功',
        description: '桌面提示实例「主灯条」已保存。'
      })
    );
  });

  test('shows restore toast after resetting desktop notice visual settings', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '还原默认设置' }));

    expect(toastMock).toHaveBeenCalledWith({
      title: '已还原默认设置',
      description: '当前实例视觉设置已还原，点击保存后生效。'
    });
  });

  test('resets mascot visual settings to the current hidden idle default', async () => {
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';
    instance.idleBehavior = 'dim-placeholder';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '还原默认设置' }));
    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'mascot',
          idleBehavior: 'hidden'
        })
      )
    );
  });

  test('shows delete toast after deleting desktop notice instance', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.name = '主灯条';
    const onDeleteInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={onDeleteInstance}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '删除当前实例' }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith({
        title: '删除成功',
        description: '桌面提示实例「主灯条」已删除。'
      })
    );
  });

  test('opens custom mascot guide from the asset pack field', async () => {
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '自定义精灵资源说明' })).toHaveTextContent(
      '自定义说明'
    );
    fireEvent.click(screen.getByRole('button', { name: '自定义精灵资源说明' }));

    expect(screen.getByRole('dialog', { name: '自定义 GIF 精灵资源包' })).toBeInTheDocument();
    expect(screen.getByText('~/.cc-notice/mascots/<pack-id>/')).toBeInTheDocument();
    expect(screen.getByText('manifest.json')).toBeInTheDocument();
    let clickedDownload = '';
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedDownload = this.download;
      });
    fireEvent.click(screen.getByRole('button', { name: '下载模板包' }));

    expect(anchorClick).toHaveBeenCalled();
    expect(clickedDownload).toBe('cc-notice-custom-mascot-template.zip');
    expect(toastMock).toHaveBeenCalledWith({
      title: '模板包下载已开始',
      description: '请在浏览器或系统下载记录中查看 cc-notice-custom-mascot-template.zip。'
    });
    anchorClick.mockRestore();
  });

  test('keeps mascot settings separate from lightbar settings when saving', async () => {
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('舞台宽度'), { target: { value: '320' } });
    fireEvent.change(screen.getByLabelText('气泡字号'), { target: { value: '18' } });
    fireEvent.click(screen.getByLabelText('气泡字体'));
    fireEvent.click(screen.getByText('圆润可爱'));
    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'mascot',
          customLightbar: null,
          edgeLightbar: null,
          mascot: expect.objectContaining({
            stageSize: expect.objectContaining({ width: 320 }),
            bubbleFontSizePx: 18,
            bubbleFontId: 'round-cute'
          })
        })
      )
    );
  });

  test('shows resident idle behavior for mascot instead of lightbar idle labels', async () => {
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-main';
    instance.idleBehavior = 'keep-last';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('空闲态'));

    expect(screen.getAllByText('常驻').length).toBeGreaterThan(0);
    expect(screen.queryByText('低亮占位')).not.toBeInTheDocument();
    expect(screen.queryByText('保留最后状态')).not.toBeInTheDocument();

    const residentOptions = screen.getAllByText('常驻');
    fireEvent.click(residentOptions[residentOptions.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'mascot',
          idleBehavior: 'dim-placeholder'
        })
      )
    );
  });

  test('saves draft before opening preview so preview uses latest configuration', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.name = '旧名称';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);
    const onPreviewInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={onPreviewInstance}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '新名称' } });
    fireEvent.click(screen.getByRole('button', { name: '显示预览' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(expect.objectContaining({ name: '新名称' }))
    );
    expect(onPreviewInstance).toHaveBeenCalledWith('desktop-notice-main');
  });

  test('uses one preview toggle button to show and hide preview', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    const onPreviewInstance = vi.fn().mockResolvedValue(undefined);
    const onHidePreview = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={onPreviewInstance}
        onHidePreview={onHidePreview}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '显示预览' }));
    await waitFor(() => expect(onPreviewInstance).toHaveBeenCalledWith('desktop-notice-main'));

    fireEvent.click(screen.getByRole('button', { name: '隐藏预览' }));
    await waitFor(() => expect(onHidePreview).toHaveBeenCalledWith('desktop-notice-main'));
  });

  test('cleans up preview window when opening preview fails', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    const onPreviewInstance = vi.fn().mockRejectedValue(new Error('WINDOW_UPDATE_FAILED'));
    const onHidePreview = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={onPreviewInstance}
        onHidePreview={onHidePreview}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '显示预览' }));

    await waitFor(() => expect(onPreviewInstance).toHaveBeenCalledWith('desktop-notice-main'));
    await waitFor(() => expect(onHidePreview).toHaveBeenCalledWith('desktop-notice-main'));
    expect(screen.getByRole('button', { name: '显示预览' })).toBeInTheDocument();
  });

  test('keeps selected instance and shows guidance when deleting a referenced instance', async () => {
    vi.useFakeTimers();
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    const onDeleteInstance = vi.fn().mockRejectedValue(new Error('DESKTOP_NOTICE_TARGET_IN_USE'));

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={onDeleteInstance}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '删除当前实例' }));
      await Promise.resolve();
    });

    expect(screen.getByText('该桌面提示实例已被输出规则引用，请先移除相关桌面提示输出配置。')).toBeInTheDocument();
    expect(screen.getByLabelText('名称')).toHaveValue(instance.name);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('该桌面提示实例已被输出规则引用，请先移除相关桌面提示输出配置。')).not.toBeInTheDocument();
  });

  test('does not expose a separate direction control because size defines orientation', () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    expect(screen.queryByText('显示方向')).not.toBeInTheDocument();
  });

  test('auto saves draft changes while preview is visible', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.name = '旧名称';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '显示预览' }));
    await waitFor(() => expect(onSaveInstance).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('名称'), { target: { value: '实时名称' } });

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: '实时名称' })
      )
    );
  });

  test('auto saves corner radius changes while preview is visible', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.customLightbar = {
      ...instance.customLightbar!,
      cornerRadiusPercent: 0
    };
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '显示预览' }));
    await waitFor(() => expect(onSaveInstance).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('圆角'), { target: { value: '45' } });

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenLastCalledWith(
        expect.objectContaining({
          customLightbar: expect.objectContaining({ cornerRadiusPercent: 45 })
        })
      )
    );
  });

  test('does not show corner radius control for edge lightbar instances', () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.variant = 'edge-lightbar';
    instance.customLightbar = null;
    instance.edgeLightbar = {
      enabledEdges: ['top'],
      thicknessPx: 18,
      insetPx: 0,
      opacityPercent: 100
    };

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('圆角')).not.toBeInTheDocument();
    expect(screen.getByLabelText('透明度')).toBeInTheDocument();
  });

  test('shows custom position for instances saved from dragged preview bounds', () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.customLightbar = {
      ...instance.customLightbar!,
      presetPosition: 'custom',
      boundsOverride: { x: 120, y: 160, width: 640, height: 40 }
    };

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    expect(screen.getByText('自定义位置')).toBeInTheDocument();
  });

  test('clears custom bounds when user switches back to a preset position', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.customLightbar = {
      ...instance.customLightbar!,
      presetPosition: 'custom',
      boundsOverride: { x: 120, y: 160, width: 640, height: 40 }
    };
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('自定义位置'));
    fireEvent.click(screen.getByText('顶部居中'));
    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          customLightbar: expect.objectContaining({
            presetPosition: 'top-center',
            boundsOverride: null
          })
        })
      )
    );
  });

  test('saves opacity percentage from the instance editor', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('透明度'), { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          customLightbar: expect.objectContaining({
            opacityPercent: 60
          })
        })
      )
    );
  });

  test('shows idle behavior instead of default visual controls', () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    expect(screen.getByLabelText('空闲态')).toBeInTheDocument();
    expect(screen.queryByLabelText('默认状态')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('默认颜色')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('亮度')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('呼吸周期')).not.toBeInTheDocument();
  });

  test('saves corner radius and idle behavior settings', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('圆角'), { target: { value: '45' } });
    fireEvent.click(screen.getByLabelText('空闲态'));
    fireEvent.click(screen.getByText('低亮占位'));
    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          customLightbar: expect.objectContaining({
            cornerRadiusPercent: 45
          }),
          idleBehavior: 'dim-placeholder'
        })
      )
    );
  });

  test('resets visual settings without changing identity fields', async () => {
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    instance.name = '自定义提示';
    instance.customLightbar = {
      ...instance.customLightbar!,
      opacityPercent: 50,
      cornerRadiusPercent: 70,
      size: { width: 100, height: 100 }
    };
    const onSaveInstance = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={onSaveInstance}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '还原默认设置' }));
    fireEvent.click(screen.getByRole('button', { name: '保存当前实例' }));

    await waitFor(() =>
      expect(onSaveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'desktop-notice-main',
          name: '自定义提示',
          customLightbar: expect.objectContaining({
            size: { width: 720, height: 32 },
            opacityPercent: 100,
            cornerRadiusPercent: 0
          })
        })
      )
    );
  });

  test('fills size fields from preview resize events', async () => {
    eventListeners.clear();
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    act(() => {
      eventListeners.get('cc-notice://desktop-notice-window-bounds-changed')?.({
        payload: { instanceId: 'desktop-notice-main', width: 320, height: 24 }
      });
    });

    await waitFor(() => expect(screen.getByLabelText('宽度')).toHaveValue(320));
    expect(screen.getByLabelText('高度')).toHaveValue(24);
  });

  test('ignores programmatic preview window moves from preset changes', async () => {
    eventListeners.clear();
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    const onSaveWindowBounds = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={onSaveWindowBounds}
      />
    );

    act(() => {
      eventListeners.get('cc-notice://desktop-notice-window-bounds-changed')?.({
        payload: { instanceId: 'desktop-notice-main', x: 320, y: 24, userInitiated: false }
      });
    });

    expect(onSaveWindowBounds).not.toHaveBeenCalled();
    expect(screen.getByText('顶部居中')).toBeInTheDocument();
    expect(screen.queryByText('自定义位置')).not.toBeInTheDocument();
  });

  test('marks position as custom when preview window is moved by the user', async () => {
    eventListeners.clear();
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={vi.fn()}
      />
    );

    expect(screen.getByText('顶部居中')).toBeInTheDocument();

    act(() => {
      eventListeners.get('cc-notice://desktop-notice-window-bounds-changed')?.({
        payload: { instanceId: 'desktop-notice-main', x: 120, y: 80, userInitiated: true }
      });
    });

    await waitFor(() => expect(screen.getByText('自定义位置')).toBeInTheDocument());
    expect(screen.getByLabelText('宽度')).toHaveValue(720);
    expect(screen.getByLabelText('高度')).toHaveValue(32);
  });

  test('auto saves preview bounds after the preview window is moved', async () => {
    eventListeners.clear();
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    const onSaveWindowBounds = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={onSaveWindowBounds}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '显示预览' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '隐藏预览' })).toBeInTheDocument());

    act(() => {
      eventListeners.get('cc-notice://desktop-notice-window-bounds-changed')?.({
        payload: { instanceId: 'desktop-notice-main', x: 120, y: 80, userInitiated: true }
      });
    });

    await waitFor(() => expect(onSaveWindowBounds).toHaveBeenCalledWith('desktop-notice-main'));
    expect(screen.queryByRole('button', { name: '保存当前位置' })).not.toBeInTheDocument();
  });

  test('auto saves user moved bounds even when local preview visibility is stale', async () => {
    eventListeners.clear();
    const instance = createDefaultDesktopNoticeInstance();
    instance.id = 'desktop-notice-main';
    const onSaveWindowBounds = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={onSaveWindowBounds}
      />
    );

    act(() => {
      eventListeners.get('cc-notice://desktop-notice-window-bounds-changed')?.({
        payload: { instanceId: 'desktop-notice-main', x: 120, y: 80, userInitiated: true }
      });
    });

    await waitFor(() => expect(onSaveWindowBounds).toHaveBeenCalledWith('desktop-notice-main'));
  });

  test('marks mascot position as custom when mascot preview window is moved by the user', async () => {
    eventListeners.clear();
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-mascot';
    const onSaveWindowBounds = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={onSaveWindowBounds}
      />
    );

    act(() => {
      eventListeners.get('cc-notice://desktop-notice-window-bounds-changed')?.({
        payload: { instanceId: 'desktop-notice-mascot', x: 240, y: 180, userInitiated: true }
      });
    });

    await waitFor(() => expect(onSaveWindowBounds).toHaveBeenCalledWith('desktop-notice-mascot'));
    expect(screen.getByText('自定义位置')).toBeInTheDocument();
  });

  test('fills mascot stage size fields from user resize events and saves bounds', async () => {
    eventListeners.clear();
    const instance = createDefaultMascotInstance();
    instance.id = 'desktop-notice-mascot';
    const onSaveWindowBounds = vi.fn().mockResolvedValue(undefined);

    render(
      <DesktopNoticeInstanceLibrary
        instances={[instance]}
        onSaveInstance={vi.fn().mockResolvedValue(undefined)}
        onDeleteInstance={vi.fn()}
        onPreviewInstance={vi.fn().mockResolvedValue(undefined)}
        onHidePreview={vi.fn()}
        onSaveWindowBounds={onSaveWindowBounds}
      />
    );

    act(() => {
      eventListeners.get('cc-notice://desktop-notice-window-bounds-changed')?.({
        payload: {
          instanceId: 'desktop-notice-mascot',
          width: 320,
          height: 280,
          userInitiated: false
        }
      });
    });

    await waitFor(() => expect(screen.getByLabelText('舞台宽度')).toHaveValue(320));
    expect(screen.getByLabelText('舞台高度')).toHaveValue(280);
    await waitFor(() => expect(onSaveWindowBounds).toHaveBeenCalledWith('desktop-notice-mascot'));
  });
});
