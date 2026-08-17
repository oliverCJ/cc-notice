import { render } from '@testing-library/react';
import { useThemeMode } from './useThemeMode';

type ThemeMode = 'system' | 'light' | 'dark';

type TestMatchMedia = ((query: string) => MediaQueryList) & {
  setDark: (matches: boolean) => void;
};

function createMatchMedia(initialDark: boolean): TestMatchMedia {
  let dark = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const matchMedia = ((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? dark : false,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    dispatchEvent: () => true
  })) as unknown as TestMatchMedia;

  matchMedia.setDark = (matches: boolean) => {
    dark = matches;
    listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
  };

  return matchMedia;
}

function ThemeModeProbe({ mode }: { mode: ThemeMode }) {
  useThemeMode(mode);
  return null;
}

describe('useThemeMode', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
  });

  test('applies dark class when configured to dark', () => {
    render(<ThemeModeProbe mode="dark" />);

    expect(document.documentElement).toHaveClass('dark');
  });

  test('removes dark class when configured to light', () => {
    document.documentElement.classList.add('dark');

    render(<ThemeModeProbe mode="light" />);

    expect(document.documentElement).not.toHaveClass('dark');
  });

  test('follows system dark preference and updates when it changes', () => {
    const matchMedia = createMatchMedia(false);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia
    });

    render(<ThemeModeProbe mode="system" />);

    expect(document.documentElement).not.toHaveClass('dark');

    matchMedia.setDark(true);

    expect(document.documentElement).toHaveClass('dark');
  });
});
