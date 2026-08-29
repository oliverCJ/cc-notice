import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { CustomFaceViewport, logicalPointFromClientPoint } from './CustomFaceViewport';

test('renders one logical screen with grid and rulers', () => {
  render(<CustomFaceViewport width={8} height={4} scale={6} guides={[]} onGuidesChange={() => undefined}><div data-testid="viewport-content">内容</div></CustomFaceViewport>);
  expect(screen.getByTestId('custom-face-viewport-screen')).toHaveStyle({ width: '48px', height: '24px' });
  expect(screen.getByLabelText('像素网格')).toBeInTheDocument();
  expect(screen.getByLabelText('纵向刻度')).toBeInTheDocument();
  expect(screen.getByLabelText('横向刻度')).toBeInTheDocument();
  expect(screen.getByTestId('viewport-content')).toBeInTheDocument();
});

test('maps client coordinates to bounded logical pixels', () => {
  const rect = { left: 10, top: 20, width: 80, height: 40 } as DOMRect;
  expect(logicalPointFromClientPoint(rect, 10, 20, 8, 4)).toEqual([0, 0]);
  expect(logicalPointFromClientPoint(rect, 89, 59, 8, 4)).toEqual([7, 3]);
  expect(logicalPointFromClientPoint(rect, -10, 100, 8, 4)).toEqual([0, 3]);
});
