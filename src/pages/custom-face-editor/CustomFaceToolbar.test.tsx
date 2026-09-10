import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { CustomFaceToolbar } from './CustomFaceToolbar';

test('renders collapsed icon toolbar and expanded labels', () => {
  const props = {
    canUndo: false,
    canRedo: false,
    onUndo: () => undefined,
    onRedo: () => undefined,
  };
  const { rerender } = render(
    <CustomFaceToolbar
      {...props}
      collapsed
      onCollapsedChange={() => undefined}
      selectedTool="brush"
      onToolChange={() => undefined}
    />
  );
  expect(screen.getByRole('button', { name: /展开工具条/ })).toBeInTheDocument();
  rerender(
    <CustomFaceToolbar
      {...props}
      collapsed={false}
      onCollapsedChange={() => undefined}
      selectedTool="brush"
      onToolChange={() => undefined}
    />
  );
  expect(screen.getByText('画笔')).toBeInTheDocument();
  expect(screen.getByText('撤销')).toBeInTheDocument();
});
