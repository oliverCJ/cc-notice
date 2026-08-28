import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { CustomFaceTimeline } from './CustomFaceTimeline';

test('shows frame duration badges and total duration', () => {
  render(<CustomFaceTimeline frames={[{ durationMs: 200, packedPixels: [0] }, { durationMs: 400, packedPixels: [1] }]} selectedIndex={0} onSelect={() => undefined} onAdd={() => undefined} onDelete={() => undefined} />);
  expect(screen.getByText('200 ms')).toBeInTheDocument();
  expect(screen.getByText('400 ms')).toBeInTheDocument();
  expect(screen.getByText('总时长 600 ms')).toBeInTheDocument();
});
