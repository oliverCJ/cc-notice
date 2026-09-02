import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, test, expect, vi } from 'vitest';
import { CustomFaceTimeline } from './CustomFaceTimeline';

const onAdd = vi.fn();

beforeEach(() => onAdd.mockReset());

test('shows frame duration badges and total duration', () => {
  render(<CustomFaceTimeline frames={[{ durationMs: 200, packedPixels: [0] }, { durationMs: 400, packedPixels: [1] }]} selectedIndex={0} onSelect={() => undefined} onAdd={() => undefined} onDelete={() => undefined} />);
  expect(screen.getByText('200 ms')).toBeInTheDocument();
  expect(screen.getByText('400 ms')).toBeInTheDocument();
  expect(screen.getByText('总时长 600 ms')).toBeInTheDocument();
});

test('uses the main add button to copy the current frame and exposes a blank-frame option', async () => {
  render(<CustomFaceTimeline frames={[{ durationMs: 200, packedPixels: [0] }]} selectedIndex={0} onSelect={() => undefined} onAdd={onAdd} onDelete={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: '新增帧' }));
  expect(onAdd).toHaveBeenCalledWith('duplicate');
  const optionsButton = screen.getByRole('button', { name: '选择新增帧方式' });
  fireEvent.keyDown(optionsButton, { key: 'Enter' });
  await waitFor(() => expect(screen.getByRole('menuitem', { name: '复制当前帧' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('menuitem', { name: '创建空白帧' }));
  expect(onAdd).toHaveBeenLastCalledWith('blank');
});

test('disables both frame-add controls during playback', () => {
  render(<CustomFaceTimeline frames={[{ durationMs: 200, packedPixels: [0] }]} selectedIndex={0} onSelect={() => undefined} onAdd={onAdd} onDelete={() => undefined} />);
  fireEvent.click(screen.getByRole('button', { name: /预览全部/ }));
  expect(screen.getByRole('button', { name: '新增帧' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '选择新增帧方式' })).toBeDisabled();
});

test('renders actual frame pixels in each timeline item', () => {
  render(<CustomFaceTimeline frames={[{ durationMs: 200, packedPixels: [1, ...Array(511).fill(0)] }]} selectedIndex={0} onSelect={() => undefined} onAdd={() => undefined} onDelete={() => undefined} />);

  expect(screen.getByRole('img', { name: '第 1 帧预览' })).toBeInTheDocument();
  expect(screen.queryByTestId('custom-face-frame-placeholder')).not.toBeInTheDocument();
});

test('shows the insertion target while dragging a frame card', () => {
  render(<CustomFaceTimeline frames={[{ durationMs: 200, packedPixels: [0] }, { durationMs: 400, packedPixels: [1] }]} selectedIndex={0} onSelect={() => undefined} onAdd={() => undefined} onDelete={() => undefined} onMove={() => undefined} />);
  const target = screen.getByTestId('frame-card-2');
  fireEvent.dragEnter(target);
  expect(screen.getByLabelText('插入位置')).toHaveClass('-left-1.5');
});

test('raises the dragged frame card while sorting', () => {
  render(<CustomFaceTimeline frames={[{ durationMs: 200, packedPixels: [0] }]} selectedIndex={0} onSelect={() => undefined} onAdd={() => undefined} onDelete={() => undefined} onMove={() => undefined} />);
  const card = screen.getByTestId('frame-card-1');
  fireEvent.pointerDown(card, { pointerId: 1, clientX: 10, clientY: 10 });
  expect(card).toHaveStyle({ transform: 'scale(1.05)', opacity: '0.8' });
});
