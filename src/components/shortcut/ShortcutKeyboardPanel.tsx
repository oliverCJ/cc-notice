import { cn } from '@/lib/utils';

export const shortcutModifierKeys = ['Command', 'Control', 'Alt', 'Shift', 'Win'];

export const supportedShortcutPrimaryKeys = [
  'Escape',
  ...Array.from({ length: 12 }, (_, index) => `F${index + 1}`),
  ...'1234567890'.split(''),
  'Backspace',
  ...'QWERTYUIOP'.split(''),
  'Tab',
  ...'ASDFGHJKL'.split(''),
  'Enter',
  ...'ZXCVBNM'.split(''),
  'Space',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight'
];

const keyboardRows: string[][] = [
  ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Backspace'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Enter'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Delete'],
  ['Home', 'End', 'PageUp', 'PageDown', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'],
  ['Space']
];

const modifierRows: string[][] = [['Command', 'Control', 'Alt', 'Shift', 'Win']];

const keyFlexWeight: Record<string, string> = {
  Backspace: 'flex-[1.9]',
  Enter: 'flex-[1.7]',
  Space: 'flex-[7]',
  PageUp: 'flex-[1.5]',
  PageDown: 'flex-[1.7]'
};

type ShortcutKeyboardPanelProps = {
  selectedKey: string;
  selectedModifiers?: string[];
  highlightedKeys?: string[];
  onSelectKey: (key: string) => void;
  onToggleModifier?: (key: string) => void;
};

export function ShortcutKeyboardPanel({
  selectedKey,
  selectedModifiers = [],
  highlightedKeys = [],
  onSelectKey,
  onToggleModifier
}: ShortcutKeyboardPanelProps) {
  const highlightedSet = new Set(highlightedKeys);
  const selectedModifierSet = new Set(selectedModifiers);
  const showModifierRows =
    Boolean(onToggleModifier) ||
    selectedModifiers.length > 0 ||
    highlightedKeys.some((key) => shortcutModifierKeys.includes(key));

  return (
    <div className="rounded-md border bg-muted/30 p-3" data-testid="shortcut-keyboard-panel">
      <div className="space-y-1.5">
        {showModifierRows ? (
          <>
            {modifierRows.map((row, rowIndex) => (
              <div key={`modifier-${rowIndex}`} className="flex justify-center gap-1.5">
                {row.map((key) => (
                  <ShortcutKeyButton
                    key={key}
                    shortcutKey={key}
                    selected={selectedModifierSet.has(key)}
                    highlighted={highlightedSet.has(key)}
                    flexClass={keyFlexWeight[key]}
                    onClick={() => onToggleModifier?.(key)}
                  />
                ))}
              </div>
            ))}
            <div
              aria-hidden="true"
              className="my-2 h-px bg-border"
              data-testid="shortcut-keyboard-modifier-divider"
            />
          </>
        ) : null}
        {keyboardRows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-1.5">
            {row.map((key) => (
              <ShortcutKeyButton
                key={key}
                shortcutKey={key}
                selected={key === selectedKey}
                highlighted={highlightedSet.has(key)}
                flexClass={keyFlexWeight[key]}
                onClick={() => onSelectKey(key)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function isSupportedShortcutPrimaryKey(key: string): boolean {
  return supportedShortcutPrimaryKeys.includes(key);
}

function ShortcutKeyButton({
  shortcutKey,
  selected,
  highlighted,
  flexClass,
  onClick
}: {
  shortcutKey: string;
  selected: boolean;
  highlighted: boolean;
  flexClass?: string;
  onClick: () => void;
}) {
  const state = selected ? 'selected' : highlighted ? 'highlighted' : 'idle';
  return (
    <button
      type="button"
      aria-label={shortcutKey}
      aria-pressed={selected}
      data-key-state={state}
      className={cn(
        'h-8 min-w-0 flex-1 rounded-md border bg-background px-1 text-xs font-medium text-foreground shadow-sm transition-colors',
        'hover:border-primary/70 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        flexClass,
        state === 'selected'
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
          : null,
        state === 'highlighted'
          ? 'border-amber-500 bg-amber-500/15 text-amber-900 hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-200'
          : null
      )}
      onClick={onClick}
    >
      <span className="block truncate">{formatShortcutKeyLabel(shortcutKey)}</span>
    </button>
  );
}

function formatShortcutKeyLabel(key: string): string {
  switch (key) {
    case 'ArrowUp':
      return 'Up';
    case 'ArrowDown':
      return 'Down';
    case 'ArrowLeft':
      return 'Left';
    case 'ArrowRight':
      return 'Right';
    default:
      return key;
  }
}
