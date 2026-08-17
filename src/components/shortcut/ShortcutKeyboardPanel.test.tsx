import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ShortcutKeyboardPanel } from './ShortcutKeyboardPanel';

describe('ShortcutKeyboardPanel', () => {
  test('selects a key from the visual keyboard and exposes selected and highlighted states', () => {
    const onSelectKey = vi.fn();
    const onToggleModifier = vi.fn();

    render(
      <ShortcutKeyboardPanel
        selectedKey="Enter"
        selectedModifiers={['Command']}
        highlightedKeys={['Escape', 'Command']}
        onSelectKey={onSelectKey}
        onToggleModifier={onToggleModifier}
      />
    );

    expect(screen.getByRole('button', { name: 'Enter' })).toHaveAttribute(
      'data-key-state',
      'selected'
    );
    expect(screen.getByRole('button', { name: 'Command' })).toHaveAttribute(
      'data-key-state',
      'selected'
    );
    expect(screen.getByRole('button', { name: 'Escape' })).toHaveAttribute(
      'data-key-state',
      'highlighted'
    );

    fireEvent.click(screen.getByRole('button', { name: 'A' }));

    expect(onSelectKey).toHaveBeenCalledWith('A');

    fireEvent.click(screen.getByRole('button', { name: 'Command' }));

    expect(onToggleModifier).toHaveBeenCalledWith('Command');
  });

  test('keeps selected key colors while hovered', () => {
    render(
      <ShortcutKeyboardPanel selectedKey="Enter" highlightedKeys={[]} onSelectKey={() => undefined} />
    );

    expect(screen.getByRole('button', { name: 'Enter' })).toHaveClass(
      'hover:bg-primary',
      'hover:text-primary-foreground'
    );
  });

  test('renders full keyboard sections needed by shortcut configuration', () => {
    render(
      <ShortcutKeyboardPanel selectedKey="Space" highlightedKeys={[]} onSelectKey={() => undefined} />
    );

    expect(screen.getByRole('button', { name: 'F12' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ArrowUp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Space' })).toHaveAttribute(
      'data-key-state',
      'selected'
    );
  });

  test('highlights modifier keys for shortcut testing views', () => {
    render(
      <ShortcutKeyboardPanel
        selectedKey="A"
        selectedModifiers={[]}
        highlightedKeys={['Shift']}
        onSelectKey={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Shift' })).toHaveAttribute(
      'data-key-state',
      'highlighted'
    );
  });

  test('separates modifier keys from primary keys when modifier row is visible', () => {
    render(
      <ShortcutKeyboardPanel
        selectedKey="Enter"
        selectedModifiers={['Command']}
        highlightedKeys={[]}
        onSelectKey={() => undefined}
        onToggleModifier={() => undefined}
      />
    );

    expect(screen.getByTestId('shortcut-keyboard-modifier-divider')).toBeInTheDocument();
  });
});
