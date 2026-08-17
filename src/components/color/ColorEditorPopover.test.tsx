import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { I18nProvider } from '@/i18n';
import { ColorEditorPopover, type ColorEditorPopoverProps } from './ColorEditorPopover';

function renderEditor(overrides: Partial<ColorEditorPopoverProps> = {}) {
  const props: ColorEditorPopoverProps = {
    title: '编辑颜色',
    color: '#22C55E',
    open: true,
    onDraftColorChange: vi.fn(),
    onApply: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
  render(
    <I18nProvider language="zh-CN">
      <ColorEditorPopover {...props} />
    </I18nProvider>
  );
  return props;
}

describe('ColorEditorPopover', () => {
  test('does not render when closed', () => {
    renderEditor({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('applies valid hex draft', () => {
    const props = renderEditor();

    fireEvent.change(screen.getByLabelText('HEX 色号'), { target: { value: '#ef4444' } });
    expect(props.onDraftColorChange).toHaveBeenCalledWith('#EF4444');
    fireEvent.click(screen.getByRole('button', { name: '应用颜色' }));

    expect(props.onApply).toHaveBeenCalled();
  });

  test('disables eyedropper when unsupported', () => {
    renderEditor();

    expect(screen.getByRole('button', { name: '从屏幕吸取颜色' })).toBeDisabled();
    expect(screen.getByText('当前运行环境不支持屏幕吸色')).toBeInTheDocument();
  });

  test('uses preset color as draft', () => {
    const props = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: '预设颜色 #EF4444' }));

    expect(props.onDraftColorChange).toHaveBeenCalledWith('#EF4444');
  });

  test('uses the saturation area to pick a concrete color without opening native color input', () => {
    const props = renderEditor({ color: '#FF0000' });
    const saturationArea = screen.getByLabelText('颜色明度和饱和度');
    vi.spyOn(saturationArea, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      top: 0,
      right: 100,
      bottom: 100,
      left: 0,
      toJSON: () => ({})
    });

    fireEvent.mouseDown(saturationArea, { clientX: 50, clientY: 50 });

    expect(props.onDraftColorChange).toHaveBeenCalledWith('#804040');
    expect(screen.queryByLabelText('可视化选色')).not.toBeInTheDocument();
  });

  test('uses the hue rail to change the active hue', () => {
    const props = renderEditor({ color: '#FF0000' });
    const hueRail = screen.getByLabelText('色相');
    vi.spyOn(hueRail, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 24,
      height: 120,
      top: 0,
      right: 24,
      bottom: 120,
      left: 0,
      toJSON: () => ({})
    });

    fireEvent.mouseDown(hueRail, { clientY: 40 });

    expect(props.onDraftColorChange).toHaveBeenCalledWith('#00FF00');
  });

  test('renders a native color input for quick direct editing', () => {
    renderEditor({ color: '#22C55E' });

    expect(screen.getByLabelText('原生颜色选择')).toHaveValue('#22c55e');
  });
});
