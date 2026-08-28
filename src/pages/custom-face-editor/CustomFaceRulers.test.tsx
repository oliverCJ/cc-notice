import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { CustomFaceRulers } from './CustomFaceRulers';

test('renders left and bottom rulers and creates horizontal and vertical guides', () => {
  const change = vi.fn();
  render(<CustomFaceRulers width={128} height={32} scale={6} guides={[]} onGuidesChange={change}><div>canvas</div></CustomFaceRulers>);
  expect(screen.getByLabelText('纵向刻度')).toBeInTheDocument();
  expect(screen.getByLabelText('横向刻度')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '新增横向辅助线' }));
  expect(change).toHaveBeenCalledWith([{ id: expect.any(String), orientation: 'horizontal', position: 16 }]);
  fireEvent.click(screen.getByRole('button', { name: '新增纵向辅助线' }));
  expect(change).toHaveBeenLastCalledWith([{ id: expect.any(String), orientation: 'vertical', position: 64 }]);
});

test('renders guide editor below the rulers instead of over the canvas', () => {
  render(<CustomFaceRulers width={128} height={32} scale={6} guides={[{ id: 'guide-1', orientation: 'horizontal', position: 8 }]} onGuidesChange={vi.fn()}><div>canvas</div></CustomFaceRulers>);
  fireEvent.click(screen.getByRole('button', { name: '横向辅助线 8' }));
  expect(screen.getByTestId('guide-editor-outside')).toBeInTheDocument();
  expect(screen.getByLabelText('辅助线坐标')).toHaveValue(8);
});
