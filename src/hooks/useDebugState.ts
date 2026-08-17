import { useState } from 'react';
import {
  clearDebugLog,
  getDebugLogEntries,
  getSoftwareNoticeState,
  submitRelayEvent
} from '@/api/tauriApi';
import { summarizeNoticeCommand } from '@/lib/noticeCommand';
import { currentLocalIsoString } from '@/lib/time';
import { DebugLogEntryView, DebugTestEventRequestView, SoftwareNoticeStateView } from '@/state/appStore';

export function useDebugState() {
  const [debugEntries, setDebugEntries] = useState<DebugLogEntryView[]>([]);
  const [softwareNoticeState, setSoftwareNoticeState] = useState<SoftwareNoticeStateView>({});

  async function handleSendTestEvent(testEvent: DebugTestEventRequestView) {
    const occurredAt = currentLocalIsoString();
    try {
      await submitRelayEvent({
        source: testEvent.source,
        event: testEvent.event,
        payload: testEvent.payload,
        occurredAt
      });
    } catch (error) {
      // submit_relay_event 会在后端记录映射错误，Debug 页面只负责刷新并展示日志。
      console.info(
        'debug test event rejected; refreshing debug log',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      await refreshDebugState();
    }
  }

  async function handleClearDebugLog() {
    await clearDebugLog();
    setDebugEntries([]);
  }

  async function refreshDebugState() {
    try {
      const [entries, state] = await Promise.all([getDebugLogEntries(), getSoftwareNoticeState()]);
      setDebugEntries(
        (entries ?? []).map((entry) => ({
          debugEntryId: entry.debugEntryId,
          source: entry.source,
          event: entry.event,
          payload: entry.payload,
          rawPayload: entry.rawPayload ?? undefined,
          result: entry.result,
          internalEvent: entry.internalEvent ?? undefined,
          mappingStage: entry.mappingStage ?? undefined,
          commandSummary: summarizeNoticeCommand(entry.noticeCommand ?? undefined),
          outputs: (entry.outputs ?? []).map((output) => ({
            type: output.type,
            ruleId: output.ruleId,
            commandSummary: summarizeNoticeCommand(output.command),
            desktopNoticeTargets: output.desktopNoticeTargets ?? undefined
          })),
          deviceResults: (entry.deviceResults ?? []).map((result) => ({
            deviceId: result.deviceId,
            channelId: result.channelId,
            outputType: result.outputType,
            status: result.status,
            ack: result.ack ?? undefined,
            errorCode: result.errorCode ?? undefined,
            error: result.error ?? undefined
          })),
          error: entry.error ?? undefined,
          occurredAt: entry.occurredAt ?? '',
          requestReceivedAt: entry.requestReceivedAt ?? undefined,
          httpReadElapsedMs: entry.httpReadElapsedMs ?? undefined,
          prepareElapsedMs: entry.prepareElapsedMs ?? undefined,
          queueDelayMs: entry.queueDelayMs ?? undefined,
          responseElapsedMs: entry.responseElapsedMs ?? undefined,
          processingElapsedMs: entry.processingElapsedMs ?? undefined,
          deviceProcessingElapsedMs: entry.deviceProcessingElapsedMs ?? undefined,
          webhookProcessingElapsedMs: entry.webhookProcessingElapsedMs ?? undefined,
          localProcessingElapsedMs: entry.localProcessingElapsedMs ?? undefined,
          processingCompletedAt: entry.processingCompletedAt ?? undefined,
          processingMode: entry.processingMode ?? undefined
        }))
      );
      setSoftwareNoticeState({
        lastEvent: state.lastEvent ?? undefined,
        lastSource: state.lastSource ?? undefined
      });
    } catch (error) {
      setDebugEntries([
        {
          source: 'cc-notice',
          debugEntryId: 'debug-refresh-failed',
          event: 'debug.refresh_failed',
          payload: '{}',
          result: 'error',
          error: error instanceof Error ? error.message : String(error),
          occurredAt: currentLocalIsoString()
        }
      ]);
    }
  }

  return {
    debugEntries,
    handleClearDebugLog,
    handleSendTestEvent,
    refreshDebugState,
    softwareNoticeState
  };
}
