import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import {
  CustomFaceViewport,
  logicalPointFromClientPoint,
  logicalPointFromViewportClientPoint,
  magnifierViewport,
  moveMagnifierViewportOrigin,
} from './CustomFaceViewport';

test('renders one logical screen with grid and rulers', () => {
  render(
    <CustomFaceViewport width={8} height={4} scale={6} guides={[]} onGuidesChange={() => undefined}>
      <div data-testid="viewport-content">内容</div>
    </CustomFaceViewport>
  );
  expect(screen.getByTestId('custom-face-viewport-screen')).toHaveStyle({
    width: '48px',
    height: '24px',
  });
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

test('keeps the magnifier viewport within the canvas at each edge', () => {
  expect(magnifierViewport([0, 0], 320, 240, 16, 12)).toEqual({
    originX: 0,
    originY: 0,
    width: 16,
    height: 12,
  });
  expect(magnifierViewport([319, 239], 320, 240, 16, 12)).toEqual({
    originX: 304,
    originY: 228,
    width: 16,
    height: 12,
  });
  expect(magnifierViewport([1, 1], 8, 4, 16, 12)).toEqual({
    originX: 0,
    originY: 0,
    width: 8,
    height: 4,
  });
});

test('moves a magnifier viewport origin and clamps it to the canvas', () => {
  const viewport = { originX: 10, originY: 8, width: 16, height: 12 };
  expect(moveMagnifierViewportOrigin(viewport, [3, -2], 128, 32)).toEqual({
    ...viewport,
    originX: 13,
    originY: 6,
  });
  expect(moveMagnifierViewportOrigin(viewport, [-100, -100], 128, 32)).toEqual({
    ...viewport,
    originX: 0,
    originY: 0,
  });
  expect(moveMagnifierViewportOrigin(viewport, [1000, 1000], 128, 32)).toEqual({
    ...viewport,
    originX: 112,
    originY: 20,
  });
  expect(
    moveMagnifierViewportOrigin({ originX: 0, originY: 0, width: 8, height: 4 }, [3, 3], 8, 4)
  ).toEqual({ originX: 0, originY: 0, width: 8, height: 4 });
});

test('maps magnifier client coordinates back to full canvas pixels', () => {
  const rect = { left: 3.5, top: 6.25, width: 160, height: 120 } as DOMRect;
  const viewport = { originX: 304, originY: 228, width: 16, height: 12 };
  expect(logicalPointFromViewportClientPoint(rect, 3.5, 6.25, 320, 240, viewport)).toEqual([
    304, 228,
  ]);
  expect(logicalPointFromViewportClientPoint(rect, 163.49, 126.24, 320, 240, viewport)).toEqual([
    319, 239,
  ]);
  expect(logicalPointFromViewportClientPoint(rect, 999, -1, 320, 240, viewport)).toEqual([
    319, 228,
  ]);
});
