import { useEffect, useState } from 'react';
import type { ThemeMode } from '@/state/appStore';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function useThemeMode(themeMode: ThemeMode) {
  useEffect(() => {
    const mediaQuery = window.matchMedia?.(DARK_MEDIA_QUERY);

    function applyThemeMode(systemPrefersDark = mediaQuery?.matches ?? false) {
      const shouldUseDark = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);
      document.documentElement.classList.toggle('dark', shouldUseDark);
      document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light';
    }

    applyThemeMode();

    if (themeMode !== 'system' || !mediaQuery) {
      return undefined;
    }

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      applyThemeMode(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }

    mediaQuery.addListener(handleSystemThemeChange);
    return () => mediaQuery.removeListener(handleSystemThemeChange);
  }, [themeMode]);
}

export function useDocumentDarkTheme() {
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    function syncDarkTheme() {
      setIsDarkTheme(document.documentElement.classList.contains('dark'));
    }

    syncDarkTheme();

    const observer = new MutationObserver(syncDarkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  return isDarkTheme;
}
