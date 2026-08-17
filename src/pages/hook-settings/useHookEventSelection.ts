import { useEffect, useMemo, useRef, useState } from 'react';
import { HookEventFrontendState, HookEventSelections } from '@/api/tauriApi';
import { AiToolId } from '@/state/appStore';
import {
  applyDefaultSelections,
  eventsForTool,
  normalizeSelections,
  updateSelectionsForTool
} from './hookEventSelectionUtils';

type UseHookEventSelectionParams = {
  hookEventState: HookEventFrontendState | null;
  onHookSelectionChange: (selections: HookEventSelections) => void;
  selectedToolId: AiToolId;
};

export function useHookEventSelection({
  hookEventState,
  onHookSelectionChange,
  selectedToolId
}: UseHookEventSelectionParams) {
  const emptySelections = useMemo<HookEventSelections>(() => ({ bySource: {} }), []);
  const [localSelections, setLocalSelections] = useState<HookEventSelections>(emptySelections);
  const localSelectionsRef = useRef<HookEventSelections>(emptySelections);
  const [hasAppliedDefaults, setHasAppliedDefaults] = useState(false);

  useEffect(() => {
    const nextSelections = normalizeSelections(hookEventState?.selected ?? emptySelections);

    if (
      !hasAppliedDefaults &&
      Object.values(nextSelections.bySource).every((events) => events.length === 0) &&
      hookEventState?.catalog &&
      hookEventState.catalog.length > 0
    ) {
      const defaultSelections = applyDefaultSelections(hookEventState.catalog);
      localSelectionsRef.current = defaultSelections;
      setLocalSelections(defaultSelections);
      setHasAppliedDefaults(true);
      onHookSelectionChange(defaultSelections);
      return;
    }

    localSelectionsRef.current = nextSelections;
    setLocalSelections(nextSelections);
  }, [emptySelections, hookEventState, hasAppliedDefaults, onHookSelectionChange]);

  const selectedEvents = eventsForTool(localSelections, selectedToolId);
  const visibleEvents =
    hookEventState?.catalog.filter((event) => event.source === selectedToolId) ?? [];

  function toggleEvent(eventName: string) {
    const currentSelections = localSelectionsRef.current;
    const currentEvents = eventsForTool(currentSelections, selectedToolId);
    const nextEvents = currentEvents.includes(eventName)
      ? currentEvents.filter((event) => event !== eventName)
      : [...currentEvents, eventName];
    const nextSelections = updateSelectionsForTool(currentSelections, selectedToolId, nextEvents);

    localSelectionsRef.current = nextSelections;
    setLocalSelections(nextSelections);
    onHookSelectionChange(nextSelections);
  }

  function applyRecommended() {
    if (!hookEventState?.catalog) {
      return;
    }

    const recommended = hookEventState.catalog
      .filter((event) => event.source === selectedToolId && event.defaultSelected)
      .map((event) => event.event);
    const nextSelections = updateSelectionsForTool(localSelections, selectedToolId, recommended);

    localSelectionsRef.current = nextSelections;
    setLocalSelections(nextSelections);
    onHookSelectionChange(nextSelections);
  }

  return {
    applyRecommended,
    localSelections,
    selectedEvents,
    toggleEvent,
    visibleEvents
  };
}
