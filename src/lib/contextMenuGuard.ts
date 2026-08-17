const ALLOW_NATIVE_CONTEXT_MENU_ATTRIBUTE = 'data-allow-native-context-menu';

export function installDefaultContextMenuGuard(target: Document = document): () => void {
  function handleContextMenu(event: MouseEvent) {
    if (isNativeContextMenuAllowed(event.target)) {
      return;
    }
    event.preventDefault();
  }

  target.addEventListener('contextmenu', handleContextMenu, true);
  console.info('default browser context menu guard installed');

  return () => {
    target.removeEventListener('contextmenu', handleContextMenu, true);
  };
}

function isNativeContextMenuAllowed(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest(`[${ALLOW_NATIVE_CONTEXT_MENU_ATTRIBUTE}="true"]`) !== null;
}
