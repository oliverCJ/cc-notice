import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { getBuiltinCustomFaceAssets } from '@/domain/customFaces/assets/builtinAssets';
import { CustomFaceAssetLibrary } from './CustomFaceAssetLibrary';

test('shows built-in assets and applies a selected read-only asset', () => {
  const onApply = vi.fn();
  const asset = getBuiltinCustomFaceAssets({ id: 'custom-mono-128x32-v1', width: 128, height: 32, framebufferBytes: 512 })[0];
  render(<CustomFaceAssetLibrary assets={[asset]} onApply={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: /微笑/ }));
  expect(onApply).toHaveBeenCalledWith(asset);
  expect(screen.getByText('只读素材')).toBeInTheDocument();
});
