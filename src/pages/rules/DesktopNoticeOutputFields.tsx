import { useEffect, useState, type CSSProperties } from 'react';
import { HardwareOutput, getDesktopMascotAssetPacks, previewDesktopNoticeRuleEffect } from '@/api/tauriApi';
import {
  ColorEditorPopover,
  isValidHexColor,
  normalizeHexColor
} from '@/components/color/ColorEditorPopover';
import {
  DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID,
  DESKTOP_MASCOT_BUBBLE_LIMITS,
  DESKTOP_MASCOT_STATES,
  DesktopMascotPlayMode,
  DesktopMascotRuntimePack,
  DesktopMascotState,
  createDefaultMascotSettings,
  desktopMascotActionLabel,
  desktopMascotActionsForState,
  desktopMascotRuntimePackById,
  validateMascotBubbleText
} from '@/domain/desktopMascot';
import {
  DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS,
  DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS,
  DESKTOP_NOTICE_RULE_DURATION_LIMITS,
  DesktopNoticeColorMode,
  DesktopNoticeColorStop,
  DesktopNoticeEdge,
  DesktopNoticeInstance,
  DesktopNoticeWindowPayload,
  DesktopNoticeRestoreBehavior,
  DesktopNoticeRuleTarget,
  DesktopNoticeRuleEffect,
  defaultDesktopNoticeAnimationPeriod,
  isDesktopNoticeAnimatedEffect,
  isOnceMascotPlayMode,
  normalizeDesktopMascotPlaybackWindowMs,
  normalizeDesktopNoticeAnimationPeriod
} from '@/domain/desktopNotice';
import { MascotStageRenderer } from '@/pages/desktop-notice/MascotStageRenderer';
import {
  edgeBreathingHaloStyle as buildEdgeBreathingHaloStyle,
  edgeBreathingLineStyle as buildEdgeBreathingLineStyle,
  edgeOrientationForEdge,
  resolveDesktopNoticeEdge,
  rgbFromHex,
  type ResolvedDesktopNoticeEdge
} from '@/domain/desktopNoticeVisuals';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type DesktopNoticeOutputFieldsProps = {
  output: HardwareOutput;
  instances: DesktopNoticeInstance[];
  onChange: (output: HardwareOutput) => void;
};

type ColorEditorState =
  | { open: false }
  | {
      open: true;
      target: 'solid' | 'gradient-stop';
      stopIndex: number;
      draftColor: string;
    };

const effectOptions: Array<{ value: DesktopNoticeRuleEffect; labelKey: string }> = [
  { value: 'solid', labelKey: 'rules.desktopNotice.effects.solid' },
  { value: 'breathing', labelKey: 'rules.desktopNotice.effects.breathing' },
  { value: 'blink', labelKey: 'rules.desktopNotice.effects.blink' },
  { value: 'scan', labelKey: 'rules.desktopNotice.effects.scan' },
  { value: 'fade', labelKey: 'rules.desktopNotice.effects.fade' },
  { value: 'edge-breathing', labelKey: 'rules.desktopNotice.effects.edgeBreathing' }
];

const restoreBehaviorOptions: Array<{ value: DesktopNoticeRestoreBehavior; labelKey: string }> = [
  {
    value: 'use-instance-idle',
    labelKey: 'rules.desktopNotice.restoreBehaviors.useInstanceIdle'
  },
  { value: 'hide', labelKey: 'rules.desktopNotice.restoreBehaviors.hide' },
  { value: 'keep-last', labelKey: 'rules.desktopNotice.restoreBehaviors.keepLast' }
];

const edgeOptions: Array<{ value: DesktopNoticeEdge; labelKey: string }> = [
  { value: 'auto', labelKey: 'rules.desktopNotice.edges.auto' },
  { value: 'top', labelKey: 'rules.desktopNotice.edges.top' },
  { value: 'bottom', labelKey: 'rules.desktopNotice.edges.bottom' },
  { value: 'left', labelKey: 'rules.desktopNotice.edges.left' },
  { value: 'right', labelKey: 'rules.desktopNotice.edges.right' }
];

const mascotPlayModeOptions: Array<{ value: DesktopMascotPlayMode; labelKey: string }> = [
  { value: 'default', labelKey: 'rules.desktopNotice.mascotPlayModes.default' },
  { value: 'loop', labelKey: 'rules.desktopNotice.mascotPlayModes.loop' },
  { value: 'once-then-hold', labelKey: 'rules.desktopNotice.mascotPlayModes.onceThenHold' },
  { value: 'once-then-idle', labelKey: 'rules.desktopNotice.mascotPlayModes.onceThenIdle' }
];

const palette = ['#22C55E', '#38BDF8', '#3B82F6', '#A855F7', '#EF4444', '#F97316', '#FACC15', '#F8FAFC'];

function mascotBubbleTextForTarget(
  target: DesktopNoticeRuleTarget | null | undefined,
  instance: DesktopNoticeInstance | null | undefined
): string | null {
  if (!instance?.mascot?.bubbleEnabled) {
    return null;
  }
  return target?.mascotBubbleTemplate ?? null;
}

export function DesktopNoticeOutputFields({
  output,
  instances,
  onChange
}: DesktopNoticeOutputFieldsProps) {
  const t = useI18n();
  const enabledInstances = instances.filter((instance) => instance.enabled);
  const targets = normalizedTargets(output.desktopNoticeTargets);
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);
  const selectedTarget = targets[selectedTargetIndex] ?? targets[0] ?? null;
  const selectedInstance = selectedTarget
    ? enabledInstances.find((instance) => instance.id === selectedTarget.targetId) ?? null
    : null;
  const selectedTargetVariant = selectedInstance?.variant ?? 'custom-lightbar';
  const colorMode = selectedTarget?.colorMode ?? 'solid';
  const colors = normalizedColors(colorMode, selectedTarget?.colors);
  const effect = selectedTarget?.effect ?? 'solid';
  const durationMs = selectedTarget?.durationMs ?? 3000;
  const animationPeriodMs = normalizeDesktopNoticeAnimationPeriod(
    effect,
    selectedTarget?.animationPeriodMs ?? selectedTarget?.breathingPeriodMs
  );
  const previewAnimationPeriodMs = isDesktopNoticeAnimatedEffect(effect)
    ? animationPeriodMs
    : undefined;
  const breathingPeriodMs =
    effect === 'breathing' || effect === 'edge-breathing' ? animationPeriodMs : undefined;
  const opacityPercent = selectedTarget?.opacityPercent ?? 100;
  const brightnessPercent = selectedTarget?.brightnessPercent ?? 100;
  const edge = selectedTarget?.edge ?? 'auto';
  const selectedPreviewTargetIds =
    selectedTarget && enabledInstances.some((instance) => instance.id === selectedTarget.targetId)
      ? [selectedTarget.targetId]
      : [];
  const actualPreviewDisabled = selectedPreviewTargetIds.length === 0;
  const [selectedStopIndex, setSelectedStopIndex] = useState(0);
  const [colorEditorState, setColorEditorState] = useState<ColorEditorState>({ open: false });
  const [actualPreviewBusy, setActualPreviewBusy] = useState(false);
  const [actualPreviewError, setActualPreviewError] = useState<string | null>(null);
  const [durationDraft, setDurationDraft] = useState(String(durationMs));
  const [animationPeriodDraft, setAnimationPeriodDraft] = useState(String(animationPeriodMs));
  const [customMascotPacks, setCustomMascotPacks] = useState<DesktopMascotRuntimePack[]>([]);

  useEffect(() => {
    if (selectedTargetIndex >= targets.length) {
      setSelectedTargetIndex(Math.max(0, targets.length - 1));
    }
  }, [selectedTargetIndex, targets.length]);

  useEffect(() => {
    if (selectedStopIndex >= colors.length) {
      setSelectedStopIndex(Math.max(0, colors.length - 1));
    }
  }, [colors.length, selectedStopIndex]);

  useEffect(() => {
    setDurationDraft(String(durationMs));
  }, [durationMs, selectedTarget?.targetId]);

  useEffect(() => {
    setAnimationPeriodDraft(String(animationPeriodMs));
  }, [animationPeriodMs, selectedTarget?.targetId, effect]);

  useEffect(() => {
    let disposed = false;
    void getDesktopMascotAssetPacks()
      .then((result) => {
        if (!disposed) {
          setCustomMascotPacks(result.packs);
        }
      })
      .catch((error) => console.warn('failed to scan custom mascot packs for rule editor', error));
    return () => {
      disposed = true;
    };
  }, []);

  function patchTargets(nextTargets: DesktopNoticeRuleTarget[]) {
    onChange({ ...output, desktopNoticeTargets: nextTargets });
  }

  function patchSelectedTarget(patchValue: Partial<DesktopNoticeRuleTarget>) {
    if (!selectedTarget) {
      return;
    }
    patchTargets(
      targets.map((target, index) =>
        index === selectedTargetIndex ? { ...target, ...patchValue } : target
      )
    );
  }

  function addTarget(instanceId: string) {
    const instance = enabledInstances.find((item) => item.id === instanceId);
    if (!instance || targets.some((target) => target.targetId === instanceId)) {
      return;
    }
    const nextTargets = [...targets, defaultDesktopNoticeTarget(instanceId)];
    patchTargets(nextTargets);
    setSelectedTargetIndex(nextTargets.length - 1);
  }

  function removeTarget(index: number) {
    const nextTargets = targets.filter((_, targetIndex) => targetIndex !== index);
    patchTargets(nextTargets);
    setSelectedTargetIndex(Math.max(0, Math.min(index, nextTargets.length - 1)));
  }

  function changeColorMode(nextMode: DesktopNoticeColorMode) {
    patchSelectedTarget({
      colorMode: nextMode,
      colors: normalizedColors(nextMode, colors)
    });
    setSelectedStopIndex(0);
  }

  function changeColor(index: number, color: string) {
    patchSelectedTarget({
      colors: colors.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, color: normalizeHexColor(color) } : stop
      )
    });
  }

  function changeStopPosition(index: number, position: number) {
    const normalizedPosition = Math.min(100, Math.max(0, Math.round(position)));
    patchSelectedTarget({
      colors: colors.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, position: normalizedPosition } : stop
      )
    });
  }

  function addGradientStop() {
    if (colors.length >= 4) {
      return;
    }
    const nextPosition = Math.min(100, Math.round((colors.length / (colors.length + 1)) * 100));
    const nextStop = { color: palette[colors.length % palette.length], position: nextPosition };
    const nextColors = [...colors, nextStop].sort((left, right) => left.position - right.position);
    patchSelectedTarget({
      colors: nextColors
    });
    setSelectedStopIndex(nextColors.findIndex((stop) => stop === nextStop));
  }

  function removeGradientStop(index: number) {
    if (colors.length <= 2) {
      return;
    }
    patchSelectedTarget({
      colors: colors.filter((_, stopIndex) => stopIndex !== index)
    });
    setSelectedStopIndex(Math.max(0, Math.min(index, colors.length - 2)));
  }

  function selectGradientStop(index: number) {
    setSelectedStopIndex(index);
    setColorEditorState({ open: false });
  }

  function openColorEditor(target: 'solid' | 'gradient-stop', stopIndex: number) {
    const stop = colors[stopIndex] ?? colors[0] ?? { color: '#22C55E', position: 0 };
    setColorEditorState({
      open: true,
      target,
      stopIndex,
      draftColor: stop.color
    });
  }

  function applyColorEditorDraft() {
    if (!colorEditorState.open || !isValidHexColor(colorEditorState.draftColor)) {
      return;
    }
    changeColor(colorEditorState.stopIndex, colorEditorState.draftColor);
    setColorEditorState({ open: false });
  }

  async function previewActualEffect() {
    if (actualPreviewDisabled || actualPreviewBusy) {
      return;
    }
    setActualPreviewBusy(true);
    setActualPreviewError(null);
    try {
      if (selectedTargetVariant === 'mascot' && selectedTarget) {
        await Promise.all(
          selectedPreviewTargetIds.map((targetId) =>
            previewDesktopNoticeRuleEffect({
              targetId,
              effect: 'solid',
              colorMode: 'solid',
              colors: [{ color: '#38BDF8', position: 0 }],
              durationMs,
              breathingPeriodMs: undefined,
              animationPeriodMs: undefined,
              opacityPercent,
              brightnessPercent,
              restoreBehavior: normalizeRestoreBehavior(selectedTarget.restoreBehavior),
              edge: null,
              mascotState: selectedTarget.mascotState ?? 'task-received',
              mascotActionId: selectedTarget.mascotActionId ?? null,
              mascotPlayMode: selectedTarget.mascotPlayMode ?? 'default',
              mascotPlaybackWindowMs: isOnceMascotPlayMode(selectedTarget.mascotPlayMode)
                ? normalizeDesktopMascotPlaybackWindowMs(selectedTarget.mascotPlaybackWindowMs)
                : null,
              mascotBubbleText: mascotBubbleTextForTarget(selectedTarget, selectedInstance)
            })
          )
        );
        return;
      }
      await Promise.all(
        selectedPreviewTargetIds.map((targetId) =>
          previewDesktopNoticeRuleEffect({
            targetId,
            effect,
            colorMode,
            colors,
            durationMs,
            breathingPeriodMs,
            animationPeriodMs: previewAnimationPeriodMs,
            opacityPercent,
            brightnessPercent,
            restoreBehavior: normalizeRestoreBehavior(selectedTarget?.restoreBehavior),
            edge
          })
        )
      );
    } catch (error) {
      console.warn('failed to preview desktop notice rule effect', error);
      setActualPreviewError(t('rules.desktopNotice.actualPreviewFailed'));
    } finally {
      setActualPreviewBusy(false);
    }
  }

  const colorEditorTitle =
    colorEditorState.open && colorEditorState.target === 'gradient-stop'
      ? t('rules.desktopNotice.colorEditorStopTitle', { index: colorEditorState.stopIndex + 1 })
      : t('rules.desktopNotice.colorEditorSolidTitle');

  return (
    <div className="col-span-full grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('rules.desktopNotice.targets')}</Label>
          {enabledInstances.length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {t('rules.desktopNotice.noEnabledInstances')}
            </p>
          ) : (
            <div className="space-y-3">
              {targets.length === 0 ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  {t('rules.desktopNotice.actualPreviewDisabledHint')}
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {targets.map((target, index) => {
                    const instance = enabledInstances.find((item) => item.id === target.targetId);
                    const selected = index === selectedTargetIndex;
                    return (
                      <button
                        key={`${target.targetId}-${index}`}
                        type="button"
                        className={`rounded-md border p-3 text-left text-sm transition-colors ${
                          selected
                            ? 'border-primary bg-primary/15 text-primary'
                            : 'border-border bg-background hover:bg-muted/60'
                        }`}
                        onClick={() => setSelectedTargetIndex(index)}
                      >
                        <span className="block truncate font-medium">
                          {instance?.name ?? target.targetId}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {t(effectLabelKey(target.effect))} · {Math.round(target.durationMs / 1000)}s
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {enabledInstances
                  .filter((instance) => !targets.some((target) => target.targetId === instance.id))
                  .map((instance) => (
                    <Button
                      key={instance.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addTarget(instance.id)}
                    >
                      添加 {instance.name}
                    </Button>
                  ))}
                {selectedTarget ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeTarget(selectedTargetIndex)}
                  >
                    移除当前实例
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {selectedTarget ? (
          selectedTargetVariant === 'mascot' ? (
            <MascotTargetFields
              target={selectedTarget}
              instance={selectedInstance}
              customPacks={customMascotPacks}
              onPatch={patchSelectedTarget}
            />
          ) : (
          <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('rules.desktopNotice.effect')}</Label>
            <Select
              value={effect}
              onValueChange={(value) =>
                patchSelectedTarget(
                  nextEffectPatch(
                    value as DesktopNoticeRuleEffect
                  )
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {effectOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('rules.desktopNotice.durationMs')}</Label>
            <Input
              type="number"
              min={DESKTOP_NOTICE_RULE_DURATION_LIMITS.min}
              max={DESKTOP_NOTICE_RULE_DURATION_LIMITS.max}
              value={durationDraft}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDurationDraft(nextValue);
                const parsed = parseIntegerDraft(nextValue);
                if (isWithinRange(parsed, DESKTOP_NOTICE_RULE_DURATION_LIMITS)) {
                  patchSelectedTarget({ durationMs: parsed });
                }
              }}
              onBlur={() => setDurationDraft(String(durationMs))}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('rules.desktopNotice.colorMode')}</Label>
            <Select
              value={colorMode}
              onValueChange={(value) => changeColorMode(value as DesktopNoticeColorMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">{t('rules.desktopNotice.colorModes.solid')}</SelectItem>
                <SelectItem value="gradient">
                  {t('rules.desktopNotice.colorModes.gradient')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('rules.desktopNotice.restoreBehavior')}</Label>
            <Select
              value={normalizeRestoreBehavior(selectedTarget.restoreBehavior)}
              onValueChange={(value) =>
                patchSelectedTarget({ restoreBehavior: value as DesktopNoticeRestoreBehavior })
              }
            >
              <SelectTrigger aria-label={t('rules.desktopNotice.restoreBehavior')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {restoreBehaviorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isDesktopNoticeAnimatedEffect(effect) ? (
            <div className="space-y-2">
              <Label>{t(animationPeriodLabelKey(effect))}</Label>
              <Input
                aria-label={t(animationPeriodLabelKey(effect))}
                type="number"
                min={DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect].min}
                max={DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect].max}
                value={animationPeriodDraft}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setAnimationPeriodDraft(nextValue);
                  const parsed = parseIntegerDraft(nextValue);
                  if (isWithinRange(parsed, DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect])) {
                    patchSelectedTarget(animationPeriodPatch(effect, parsed));
                  }
                }}
                onBlur={() => setAnimationPeriodDraft(String(animationPeriodMs))}
              />
              <p className="text-xs text-muted-foreground">
                {t('rules.desktopNotice.animationPeriodHint', {
                  min: DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect].min,
                  max: DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect].max,
                  defaultValue: DESKTOP_NOTICE_ANIMATION_PERIOD_LIMITS[effect].defaultValue
                })}
              </p>
            </div>
          ) : null}

          {effect === 'edge-breathing' ? (
            <div className="space-y-2">
              <Label>{t('rules.desktopNotice.edge')}</Label>
              <Select
                value={edge}
                onValueChange={(value) => patchSelectedTarget({ edge: value as DesktopNoticeEdge })}
              >
                <SelectTrigger aria-label={t('rules.desktopNotice.edge')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {edgeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <PercentSlider
              label={t('rules.desktopNotice.opacityPercent')}
              value={opacityPercent}
              onChange={(value) => patchSelectedTarget({ opacityPercent: value })}
            />
          </div>

          <div className="space-y-2">
            <PercentSlider
              label={t('rules.desktopNotice.brightnessPercent')}
              value={brightnessPercent}
              onChange={(value) => patchSelectedTarget({ brightnessPercent: value })}
            />
          </div>
        </div>

        <div className="relative space-y-3 rounded-lg border bg-background p-3">
          <Label>{t('rules.desktopNotice.colors')}</Label>
          {colorMode === 'solid' ? (
            <SolidColorEditor
              color={colors[0]?.color ?? '#22C55E'}
              onPickPreset={(color) => changeColor(0, color)}
              onOpenColorEditor={() => openColorEditor('solid', 0)}
            />
          ) : (
            <GradientColorEditor
              colors={colors}
              selectedStopIndex={selectedStopIndex}
              onSelectStop={selectGradientStop}
              onPickPreset={(color) => changeColor(selectedStopIndex, color)}
              onOpenColorEditor={(index) => {
                setSelectedStopIndex(index);
                openColorEditor('gradient-stop', index);
              }}
              onChangeStopPosition={changeStopPosition}
              onRemoveStop={removeGradientStop}
              onAddStop={addGradientStop}
            />
          )}
          <ColorEditorPopover
            open={colorEditorState.open}
            title={colorEditorTitle}
            color={colorEditorState.open ? colorEditorState.draftColor : '#22C55E'}
            onDraftColorChange={(draftColor) =>
              setColorEditorState((currentState) =>
                currentState.open ? { ...currentState, draftColor } : currentState
              )
            }
            onApply={applyColorEditorDraft}
            onClose={() => setColorEditorState({ open: false })}
          />
        </div>
          </>
          )
        ) : null}
      </div>

      <DesktopNoticeRulePreview
        target={selectedTarget}
        instance={selectedInstance}
        selectedTargetVariant={selectedTargetVariant}
        customPacks={customMascotPacks}
        effect={effect}
        colorMode={colorMode}
        colors={colors}
        durationMs={durationMs}
        animationPeriodMs={animationPeriodMs}
        opacityPercent={opacityPercent}
        brightnessPercent={brightnessPercent}
        edge={edge}
        actualPreviewDisabled={actualPreviewDisabled}
        actualPreviewBusy={actualPreviewBusy}
        actualPreviewError={actualPreviewError}
        onActualPreview={previewActualEffect}
      />
    </div>
  );
}

function PercentSlider({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const normalizedValue = clampPercent(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="tabular-nums text-xs text-muted-foreground">{normalizedValue}%</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={10}
        max={100}
        value={normalizedValue}
        className="desktop-notice-range w-full"
        onChange={(event) => onChange(clampPercent(Number(event.target.value) || 0))}
      />
    </div>
  );
}

function MascotTargetFields({
  target,
  instance,
  customPacks,
  onPatch
}: {
  target: DesktopNoticeRuleTarget;
  instance: DesktopNoticeInstance | null;
  customPacks: DesktopMascotRuntimePack[];
  onPatch: (patch: Partial<DesktopNoticeRuleTarget>) => void;
}) {
  const t = useI18n();
  const state = target.mascotState ?? 'task-received';
  const pack = desktopMascotRuntimePackById(
    instance?.mascot?.assetPackId ?? DEFAULT_DESKTOP_MASCOT_ASSET_PACK_ID,
    customPacks
  );
  const availableStates =
    pack && pack.states.length > 0
      ? DESKTOP_MASCOT_STATES.filter((item) => pack.states.includes(item))
      : DESKTOP_MASCOT_STATES;
  const effectiveState = availableStates.includes(state) ? state : availableStates[0] ?? state;
  const actions = pack ? desktopMascotActionsForState(pack, effectiveState) : [];
  const selectedActionId = target.mascotActionId ?? actions[0]?.id ?? '';
  const playMode = target.mascotPlayMode ?? 'default';
  const showPlaybackWindow = isOnceMascotPlayMode(playMode);
  const playbackWindowMs = normalizeDesktopMascotPlaybackWindowMs(target.mascotPlaybackWindowMs);
  const [playbackWindowDraft, setPlaybackWindowDraft] = useState(String(playbackWindowMs));
  const bubbleEnabled = instance?.mascot?.bubbleEnabled ?? false;
  const bubbleTemplate = target.mascotBubbleTemplate ?? '';
  const bubbleValidation = bubbleEnabled ? validateMascotBubbleText(bubbleTemplate) : { valid: true };

  useEffect(() => {
    if (effectiveState !== state) {
      const nextActions = pack ? desktopMascotActionsForState(pack, effectiveState) : [];
      onPatch({
        mascotState: effectiveState,
        mascotActionId: nextActions[0]?.id ?? null
      });
    }
  }, [effectiveState, onPatch, pack, state]);

  useEffect(() => {
    setPlaybackWindowDraft(String(playbackWindowMs));
  }, [playbackWindowMs, target.targetId, playMode]);

  function changeState(nextState: DesktopMascotState) {
    const nextActions = pack ? desktopMascotActionsForState(pack, nextState) : [];
    onPatch({
      mascotState: nextState,
      mascotActionId: nextActions[0]?.id ?? null
    });
  }

  function changePlayMode(nextPlayMode: DesktopMascotPlayMode) {
    onPatch({
      mascotPlayMode: nextPlayMode,
      mascotPlaybackWindowMs: isOnceMascotPlayMode(nextPlayMode)
        ? normalizeDesktopMascotPlaybackWindowMs(target.mascotPlaybackWindowMs)
        : null
    });
  }

  function commitPlaybackWindowDraft() {
    const parsed = parseIntegerDraft(playbackWindowDraft);
    const normalized = normalizeDesktopMascotPlaybackWindowMs(parsed);
    setPlaybackWindowDraft(String(normalized));
    onPatch({ mascotPlaybackWindowMs: normalized });
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-background p-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="desktop-mascot-rule-state">{t('rules.desktopNotice.mascotState')}</Label>
        <Select
          value={effectiveState}
          onValueChange={(value) => changeState(value as DesktopMascotState)}
        >
          <SelectTrigger
            id="desktop-mascot-rule-state"
            aria-label={t('rules.desktopNotice.mascotState')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableStates.map((item) => (
              <SelectItem key={item} value={item}>
                {t(`desktopNotice.mascot.states.${item}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="desktop-mascot-rule-action">{t('rules.desktopNotice.mascotAction')}</Label>
        <Select value={selectedActionId} onValueChange={(value) => onPatch({ mascotActionId: value })}>
          <SelectTrigger
            id="desktop-mascot-rule-action"
            aria-label={t('rules.desktopNotice.mascotAction')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {actions.map((action) => (
              <SelectItem key={action.id} value={action.id}>
                {desktopMascotActionLabel(action, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('rules.desktopNotice.durationMs')}</Label>
        <Input
          type="number"
          min={DESKTOP_NOTICE_RULE_DURATION_LIMITS.min}
          max={DESKTOP_NOTICE_RULE_DURATION_LIMITS.max}
          value={target.durationMs ?? 3000}
          onChange={(event) => {
            const parsed = parseIntegerDraft(event.target.value);
            if (isWithinRange(parsed, DESKTOP_NOTICE_RULE_DURATION_LIMITS)) {
              onPatch({ durationMs: parsed });
            }
          }}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('rules.desktopNotice.restoreBehavior')}</Label>
        <Select
          value={normalizeRestoreBehavior(target.restoreBehavior)}
          onValueChange={(value) =>
            onPatch({ restoreBehavior: value as DesktopNoticeRestoreBehavior })
          }
        >
          <SelectTrigger aria-label={t('rules.desktopNotice.restoreBehavior')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {restoreBehaviorOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="desktop-mascot-rule-play-mode">
          {t('rules.desktopNotice.mascotPlayMode')}
        </Label>
        <Select
          value={playMode}
          onValueChange={(value) => changePlayMode(value as DesktopMascotPlayMode)}
        >
          <SelectTrigger
            id="desktop-mascot-rule-play-mode"
            aria-label={t('rules.desktopNotice.mascotPlayMode')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mascotPlayModeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t('rules.desktopNotice.mascotPlayModeHint')}
        </p>
      </div>

      {showPlaybackWindow ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="desktop-mascot-playback-window-ms">
            {t('rules.desktopNotice.mascotPlaybackWindowMs')}
          </Label>
          <Input
            id="desktop-mascot-playback-window-ms"
            type="number"
            min={DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.min}
            max={DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.max}
            value={playbackWindowDraft}
            onChange={(event) => {
              const nextValue = event.target.value;
              setPlaybackWindowDraft(nextValue);
              const parsed = parseIntegerDraft(nextValue);
              if (isWithinRange(parsed, DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS)) {
                onPatch({ mascotPlaybackWindowMs: parsed });
              }
            }}
            onBlur={commitPlaybackWindowDraft}
          />
          <p className="text-xs text-muted-foreground">
            {t('rules.desktopNotice.mascotPlaybackWindowHint', {
              min: DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.min,
              max: DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.max,
              defaultValue: DESKTOP_MASCOT_PLAYBACK_WINDOW_LIMITS.defaultValue
            })}
          </p>
        </div>
      ) : null}

      {bubbleEnabled ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="desktop-mascot-bubble-template">
            {t('rules.desktopNotice.mascotBubbleTemplate')}
          </Label>
          <textarea
            id="desktop-mascot-bubble-template"
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={bubbleTemplate}
            onChange={(event) => onPatch({ mascotBubbleTemplate: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            {t('rules.desktopNotice.mascotBubbleHint', {
              lines: DESKTOP_MASCOT_BUBBLE_LIMITS.maxLines,
              chars: DESKTOP_MASCOT_BUBBLE_LIMITS.maxCharsPerLine
            })}
          </p>
          {!bubbleValidation.valid ? (
            <p className="text-xs text-destructive">
              {t('rules.desktopNotice.mascotBubbleInvalid')}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PresetColorButtons({
  hint,
  onPick
}: {
  hint: string;
  onPick: (color: string) => void;
}) {
  const t = useI18n();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          {t('rules.desktopNotice.presetColors')}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            className="h-7 w-7 rounded-md border border-border shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: color }}
            aria-label={`${t('rules.desktopNotice.presetColors')} ${color}`}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
    </div>
  );
}

function SolidColorEditor({
  color,
  onPickPreset,
  onOpenColorEditor
}: {
  color: string;
  onPickPreset: (color: string) => void;
  onOpenColorEditor: () => void;
}) {
  const t = useI18n();

  return (
    <div className="space-y-3">
      <PresetColorButtons
        hint={t('rules.desktopNotice.presetColorsSolidHint')}
        onPick={onPickPreset}
      />
      <button
        type="button"
        aria-label={t('rules.desktopNotice.editSolidColor', { color })}
        className="grid w-full grid-cols-[44px_1fr] items-center gap-3 rounded-md border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
        onClick={onOpenColorEditor}
      >
        <span
          className="h-9 w-9 rounded-md border border-border"
          style={{ backgroundColor: color }}
        />
        <span>
          <span className="block text-sm font-medium">{color}</span>
          <span className="text-xs text-muted-foreground">
            {t('rules.desktopNotice.solidEditHint')}
          </span>
        </span>
      </button>
    </div>
  );
}

function DesktopNoticeRulePreview({
  target,
  instance,
  selectedTargetVariant,
  customPacks,
  effect,
  colorMode,
  colors,
  durationMs,
  animationPeriodMs,
  opacityPercent,
  brightnessPercent,
  edge,
  actualPreviewDisabled,
  actualPreviewBusy,
  actualPreviewError,
  onActualPreview
}: {
  target: DesktopNoticeRuleTarget | null;
  instance: DesktopNoticeInstance | null;
  selectedTargetVariant: DesktopNoticeInstance['variant'];
  customPacks: DesktopMascotRuntimePack[];
  effect: DesktopNoticeRuleEffect;
  colorMode: DesktopNoticeColorMode;
  colors: DesktopNoticeColorStop[];
  durationMs: number;
  animationPeriodMs: number;
  opacityPercent: number;
  brightnessPercent: number;
  edge: DesktopNoticeEdge;
  actualPreviewDisabled: boolean;
  actualPreviewBusy: boolean;
  actualPreviewError: string | null;
  onActualPreview: () => void;
}) {
  const t = useI18n();
  if (selectedTargetVariant === 'mascot') {
    return (
      <DesktopMascotRulePreview
        target={target}
        instance={instance}
        customPacks={customPacks}
        actualPreviewDisabled={actualPreviewDisabled}
        actualPreviewBusy={actualPreviewBusy}
        actualPreviewError={actualPreviewError}
        onActualPreview={onActualPreview}
      />
    );
  }
  const previewOpacity = previewEffectOpacity(opacityPercent, brightnessPercent);
  const resolvedEdge = resolvePreviewEdge(edge);
  const edgeOrientation = edgeOrientationForEdge(resolvedEdge);
  const isEdgeBreathing = effect === 'edge-breathing';

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t('rules.desktopNotice.preview')}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={actualPreviewDisabled || actualPreviewBusy}
          onClick={onActualPreview}
        >
          {actualPreviewBusy
            ? t('rules.desktopNotice.actualPreviewRunning')
            : t('rules.desktopNotice.actualPreview')}
        </Button>
      </div>
      <div className="relative h-36 overflow-hidden rounded-md border bg-slate-950 p-5">
        {isEdgeBreathing ? (
          <div
            data-testid="desktop-notice-rule-preview-effect-frame"
            className={`absolute overflow-hidden ${previewEffectFrameClass(resolvedEdge)}`}
          >
            <div
              data-testid="desktop-notice-rule-preview-lightbar"
              className="absolute inset-0 overflow-hidden rounded-full"
              style={{
                background: previewEffectSurfaceBackground(effect, colorMode, colors),
                opacity: previewOpacity,
                animationDuration: `${previewAnimationDuration(effect, durationMs, animationPeriodMs)}ms`
              }}
            />
            <div
              aria-hidden="true"
              data-testid="desktop-notice-rule-preview-edge-breathing-halo"
              className={`desktop-notice-rule-preview-edge-breathing-halo ${previewEdgeBreathingAnimationClass(resolvedEdge)} absolute ${previewEdgeBreathingHaloClass(resolvedEdge)}`}
              style={previewEdgeBreathingLayerStyle(
                previewEdgeBreathingHaloStyle(colorMode, colors, resolvedEdge),
                previewOpacity,
                animationPeriodMs,
                resolvedEdge
              )}
            />
            <div
              aria-hidden="true"
              data-testid="desktop-notice-rule-preview-edge-breathing-line"
              className={`desktop-notice-rule-preview-edge-breathing-line ${previewEdgeBreathingAnimationClass(resolvedEdge)} absolute ${previewEdgeBreathingLineClass(resolvedEdge)}`}
              style={previewEdgeBreathingLayerStyle(
                previewEdgeBreathingLineStyle(colorMode, colors, resolvedEdge),
                previewOpacity,
                animationPeriodMs,
                resolvedEdge
              )}
            />
          </div>
        ) : (
          <>
            <div className="absolute inset-x-5 top-5 h-2 rounded-full bg-white/10" />
            <div
              data-testid="desktop-notice-rule-preview-lightbar"
              className={`absolute inset-x-5 top-5 h-2 overflow-hidden rounded-full shadow-[0_0_24px_rgba(255,255,255,0.35)] ${previewEffectClass(effect, edgeOrientation)}`}
              style={{
                background: previewEffectSurfaceBackground(effect, colorMode, colors),
                opacity: previewOpacity,
                animationDuration: `${previewAnimationDuration(effect, durationMs, animationPeriodMs)}ms`
              }}
            >
              {effect === 'scan' ? (
                <div
                  aria-hidden="true"
                  data-testid="desktop-notice-rule-preview-scan-overlay"
                  className={previewScanOverlayClass(edgeOrientation)}
                  style={{
                    background: previewScanOverlayBackground(colors, edgeOrientation),
                    animationDuration: `${animationPeriodMs}ms`
                  }}
                />
              ) : null}
            </div>
          </>
        )}
        <div className="absolute inset-x-5 bottom-5 space-y-1">
          <p className="text-xs font-medium text-slate-100">
            {t(effectLabelKey(effect))}
          </p>
          <p className="text-xs text-slate-400">{t('rules.desktopNotice.previewHint')}</p>
        </div>
      </div>
      {actualPreviewDisabled ? (
        <p className="text-xs text-muted-foreground">
          {t('rules.desktopNotice.actualPreviewDisabledHint')}
        </p>
      ) : null}
      {actualPreviewError ? <p className="text-xs text-destructive">{actualPreviewError}</p> : null}
    </div>
  );
}

function DesktopMascotRulePreview({
  target,
  instance,
  customPacks,
  actualPreviewDisabled,
  actualPreviewBusy,
  actualPreviewError,
  onActualPreview
}: {
  target: DesktopNoticeRuleTarget | null;
  instance: DesktopNoticeInstance | null;
  customPacks: DesktopMascotRuntimePack[];
  actualPreviewDisabled: boolean;
  actualPreviewBusy: boolean;
  actualPreviewError: string | null;
  onActualPreview: () => void;
}) {
  const t = useI18n();
  const mascot = instance?.mascot ?? createDefaultMascotSettings();
  const pack = desktopMascotRuntimePackById(mascot.assetPackId, customPacks);
  const mascotState = target?.mascotState ?? 'task-received';
  const fallbackActionId = pack ? desktopMascotActionsForState(pack, mascotState)[0]?.id : null;
  const payload: DesktopNoticeWindowPayload = {
    instanceId: instance?.id ?? 'desktop-mascot-preview',
    name: instance?.name ?? t('desktopNotice.instance.variants.mascot'),
    variant: 'mascot',
    direction: 'horizontal',
    defaultState: 'solid',
    size: mascot.stageSize,
    opacityPercent: 100,
    cornerRadiusPercent: 0,
    idleBehavior: instance?.idleBehavior ?? 'dim-placeholder',
    defaultStateConfig: { brightnessPercent: 100, breathingPeriodMs: 1600 },
    appearance: { colorMode: 'solid', colors: [{ color: '#38BDF8', position: 0 }] },
    customLightbar: null,
    edgeLightbar: null,
    mascot,
    resolvedMascotPack: pack?.source === 'local' ? pack : null,
    mascotState,
    mascotActionId: target?.mascotActionId ?? fallbackActionId ?? null,
    mascotPlayMode: target?.mascotPlayMode ?? 'default',
    mascotPlaybackWindowMs: isOnceMascotPlayMode(target?.mascotPlayMode)
      ? normalizeDesktopMascotPlaybackWindowMs(target?.mascotPlaybackWindowMs)
      : null,
    mascotBubbleText: mascotBubbleTextForTarget(target, instance),
    previewMode: true
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t('rules.desktopNotice.preview')}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={actualPreviewDisabled || actualPreviewBusy}
          onClick={onActualPreview}
        >
          {actualPreviewBusy
            ? t('rules.desktopNotice.actualPreviewRunning')
            : t('rules.desktopNotice.actualPreview')}
        </Button>
      </div>
      <div className="flex h-56 items-center justify-center overflow-hidden rounded-md border bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.18),rgba(15,23,42,0.96)_72%)] p-3">
        <div className="h-48 w-48">
          <MascotStageRenderer payload={payload} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">
          {t(`desktopNotice.mascot.states.${mascotState}`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {payload.mascotActionId
            ? actionLabelForPreview(
                pack?.actions.find((action) => action.id === payload.mascotActionId),
                t
              )
            : t('rules.desktopNotice.previewHint')}
        </p>
      </div>
      {actualPreviewDisabled ? (
        <p className="text-xs text-muted-foreground">
          {t('rules.desktopNotice.actualPreviewDisabledHint')}
        </p>
      ) : null}
      {actualPreviewError ? <p className="text-xs text-destructive">{actualPreviewError}</p> : null}
    </div>
  );
}

function actionLabelForPreview(
  action: Parameters<typeof desktopMascotActionLabel>[0] | undefined,
  translate: (key: string, params?: Record<string, string | number>) => string
): string {
  return action ? desktopMascotActionLabel(action, translate) : translate('rules.desktopNotice.previewHint');
}

function GradientColorEditor({
  colors,
  selectedStopIndex,
  onSelectStop,
  onPickPreset,
  onOpenColorEditor,
  onChangeStopPosition,
  onRemoveStop,
  onAddStop
}: {
  colors: DesktopNoticeColorStop[];
  selectedStopIndex: number;
  onSelectStop: (index: number) => void;
  onPickPreset: (color: string) => void;
  onOpenColorEditor: (index: number) => void;
  onChangeStopPosition: (index: number, position: number) => void;
  onRemoveStop: (index: number) => void;
  onAddStop: () => void;
}) {
  const t = useI18n();

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-md border bg-muted/10 p-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {t('rules.desktopNotice.gradientPreview')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('rules.desktopNotice.gradientPreviewHint')}
          </p>
        </div>
        <div
          className="relative mx-3 mt-6 h-6 rounded-full border border-border"
          style={{ background: previewBackground('gradient', colors) }}
        >
          {colors.map((stop, index) => {
            const selected = index === selectedStopIndex;
            return (
              <button
                key={`${stop.color}-${index}`}
                type="button"
                aria-label={t('rules.desktopNotice.selectGradientPreviewStop', {
                  index: index + 1
                })}
                className={`absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected ? 'scale-110 ring-2 ring-primary' : 'hover:scale-105'
                }`}
                style={{ left: `${stop.position}%`, backgroundColor: stop.color }}
                onClick={() => onSelectStop(index)}
              />
            );
          })}
        </div>
      </div>

      <PresetColorButtons
        hint={t('rules.desktopNotice.presetColorsGradientHint', {
          index: selectedStopIndex + 1
        })}
        onPick={onPickPreset}
      />

      <div className="space-y-2">
        {colors.map((stop, index) => {
          const selected = index === selectedStopIndex;
          return (
            <div
              key={`${stop.color}-${index}`}
              className={`grid grid-cols-[32px_minmax(0,1fr)_44px_auto] items-center gap-2 rounded-md border p-2 ${
                selected ? 'border-primary bg-primary/10' : 'bg-muted/10'
              }`}
            >
              <button
                type="button"
                aria-label={t('rules.desktopNotice.editColorStop', {
                  index: index + 1,
                  color: stop.color
                })}
                className="h-7 w-7 rounded-md border border-border"
                style={{ backgroundColor: stop.color }}
                onClick={() => {
                  onSelectStop(index);
                  onOpenColorEditor(index);
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                value={stop.position}
                aria-label={t('rules.desktopNotice.colorStopPositionLabel', {
                  index: index + 1
                })}
                className="w-full accent-primary"
                onChange={(event) => onChangeStopPosition(index, Number(event.target.value))}
              />
              <span className="text-right text-xs text-muted-foreground">{stop.position}%</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={colors.length <= 2}
                aria-label={t('rules.desktopNotice.removeColorStop', { index: index + 1 })}
                onClick={() => onRemoveStop(index)}
              >
                {t('common.delete')}
              </Button>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={colors.length >= 4}
        onClick={onAddStop}
      >
        {t('rules.desktopNotice.addColorStop')}
      </Button>

    </div>
  );
}

function effectLabelKey(effect: DesktopNoticeRuleEffect) {
  return (
    effectOptions.find((option) => option.value === effect)?.labelKey ??
    'rules.desktopNotice.effects.solid'
  );
}

function normalizedColors(
  colorMode: DesktopNoticeColorMode,
  colors: DesktopNoticeColorStop[] | null | undefined
): DesktopNoticeColorStop[] {
  const fallback = [{ color: '#22C55E', position: 0 }];
  const normalized = colors?.length ? colors : fallback;
  if (colorMode === 'solid') {
    return [{ color: normalized[0]?.color ?? '#22C55E', position: 0 }];
  }
  if (normalized.length >= 2) {
    return normalized.slice(0, 4);
  }
  return [
    { color: normalized[0]?.color ?? '#22C55E', position: 0 },
    { color: '#38BDF8', position: 100 }
  ];
}

function defaultDesktopNoticeTarget(targetId: string): DesktopNoticeRuleTarget {
  return {
    targetId,
    effect: 'solid',
    colorMode: 'solid',
    colors: [{ color: '#22C55E', position: 0 }],
    durationMs: 3000,
    animationPeriodMs: undefined,
    breathingPeriodMs: undefined,
    opacityPercent: 100,
    brightnessPercent: 100,
    restoreBehavior: 'use-instance-idle',
    edge: 'auto',
    mascotState: null,
    mascotActionId: null,
    mascotPlayMode: 'default',
    mascotPlaybackWindowMs: null,
    mascotBubbleTemplate: null
  };
}

function normalizedTargets(
  targets: DesktopNoticeRuleTarget[] | null | undefined
): DesktopNoticeRuleTarget[] {
  return (targets ?? []).map((target) => {
    const colorMode = target.colorMode ?? 'solid';
    const normalizedAnimationPeriodMs = isDesktopNoticeAnimatedEffect(target.effect)
      ? normalizeDesktopNoticeAnimationPeriod(
          target.effect,
          target.animationPeriodMs ?? target.breathingPeriodMs
        )
      : undefined;
    return {
      ...defaultDesktopNoticeTarget(target.targetId),
      ...target,
      colorMode,
      colors: normalizedColors(colorMode, target.colors),
      durationMs: target.durationMs ?? 3000,
      animationPeriodMs: normalizedAnimationPeriodMs,
      breathingPeriodMs:
        target.effect === 'breathing' || target.effect === 'edge-breathing'
          ? normalizedAnimationPeriodMs
          : undefined,
      opacityPercent: target.opacityPercent ?? 100,
      brightnessPercent: target.brightnessPercent ?? 100,
      restoreBehavior: normalizeRestoreBehavior(target.restoreBehavior),
      edge: target.edge ?? 'auto',
      mascotState: target.mascotState ?? null,
      mascotActionId: target.mascotActionId ?? null,
      mascotPlayMode: target.mascotPlayMode ?? 'default',
      mascotPlaybackWindowMs: isOnceMascotPlayMode(target.mascotPlayMode)
        ? normalizeDesktopMascotPlaybackWindowMs(target.mascotPlaybackWindowMs)
        : null,
      mascotBubbleTemplate: target.mascotBubbleTemplate ?? null
    };
  });
}

function nextEffectPatch(
  effect: DesktopNoticeRuleEffect
): Partial<DesktopNoticeRuleTarget> {
  return animationPeriodPatch(effect, defaultDesktopNoticeAnimationPeriod(effect), { effect });
}

function animationPeriodPatch(
  effect: DesktopNoticeRuleEffect,
  value: number,
  extraPatch: Partial<DesktopNoticeRuleTarget> = {}
): Partial<DesktopNoticeRuleTarget> {
  const animationPeriodMs = normalizeDesktopNoticeAnimationPeriod(effect, value);
  if (!isDesktopNoticeAnimatedEffect(effect)) {
    return {
      ...extraPatch,
      animationPeriodMs: undefined,
      breathingPeriodMs: undefined
    };
  }
  return {
    ...extraPatch,
    animationPeriodMs,
    breathingPeriodMs:
      effect === 'breathing' || effect === 'edge-breathing' ? animationPeriodMs : undefined
  };
}

function animationPeriodLabelKey(effect: DesktopNoticeRuleEffect) {
  return effect === 'breathing' || effect === 'edge-breathing'
    ? 'rules.desktopNotice.breathingPeriodMs'
    : 'rules.desktopNotice.animationPeriodMs';
}

function parseIntegerDraft(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  return Number(value);
}

function isWithinRange(
  value: number | null,
  limits: { min: number; max: number }
): value is number {
  return value != null && value >= limits.min && value <= limits.max;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(10, Math.round(value)));
}

function previewBackground(colorMode: DesktopNoticeColorMode, colors: DesktopNoticeColorStop[]) {
  if (colorMode === 'gradient' && colors.length > 1) {
    return `linear-gradient(90deg, ${colors
      .map((stop) => `${stop.color} ${stop.position}%`)
      .join(', ')})`;
  }
  return colors[0]?.color ?? '#22C55E';
}

function previewEffectSurfaceBackground(
  effect: DesktopNoticeRuleEffect,
  colorMode: DesktopNoticeColorMode,
  colors: DesktopNoticeColorStop[]
) {
  if (effect === 'scan' || effect === 'edge-breathing') {
    return 'transparent';
  }
  return previewBackground(colorMode, colors);
}

function previewEffectOpacity(opacityPercent: number, brightnessPercent: number) {
  return Math.round((clampPercent(opacityPercent) / 100) * (clampPercent(brightnessPercent) / 100) * 1000) / 1000;
}

function previewScanOverlayBackground(
  colors: DesktopNoticeColorStop[],
  orientation: 'horizontal' | 'vertical'
) {
  const { r, g, b } = rgbFromHex(colors[0]?.color ?? '#22C55E');
  const angle = orientation === 'vertical' ? 180 : 90;
  return `linear-gradient(${angle}deg, rgba(${r},${g},${b},0), rgba(${r},${g},${b},0.88) 50%, rgba(${r},${g},${b},0))`;
}

function previewScanOverlayClass(orientation: 'horizontal' | 'vertical') {
  if (orientation === 'vertical') {
    return 'desktop-notice-rule-preview-scan-overlay desktop-notice-rule-preview-scan-overlay-vertical absolute inset-x-0 top-[-30%] h-1/3 skew-y-[-18deg] rounded-full blur-sm';
  }
  return 'desktop-notice-rule-preview-scan-overlay absolute inset-y-0 left-[-30%] w-1/3 skew-x-[-18deg] rounded-full blur-sm';
}

function previewEdgeBreathingHaloStyle(
  colorMode: DesktopNoticeColorMode,
  colors: DesktopNoticeColorStop[],
  edge: ResolvedDesktopNoticeEdge
): CSSProperties {
  return buildEdgeBreathingHaloStyle(colorMode, colors, edge);
}

function previewEdgeBreathingLineStyle(
  colorMode: DesktopNoticeColorMode,
  colors: DesktopNoticeColorStop[],
  edge: ResolvedDesktopNoticeEdge
): CSSProperties {
  return buildEdgeBreathingLineStyle(colorMode, colors, edge);
}

function previewEdgeBreathingLayerStyle(
  style: CSSProperties,
  opacity: number,
  animationPeriodMs: number,
  edge: ResolvedDesktopNoticeEdge
): CSSProperties {
  const orientation = edgeOrientationForEdge(edge);
  return {
    ...style,
    '--desktop-notice-opacity': String(opacity),
    '--desktop-notice-breathing-dim-opacity': String(Math.round(opacity * 0.32 * 1000) / 1000),
    animationName: `desktop-notice-edge-breathing-${orientation}`,
    animationDuration: `${animationPeriodMs}ms`,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite'
  } as CSSProperties;
}

function previewAnimationDuration(
  effect: DesktopNoticeRuleEffect,
  durationMs: number,
  animationPeriodMs: number
) {
  return isDesktopNoticeAnimatedEffect(effect) ? animationPeriodMs : Math.max(500, durationMs);
}

function previewEdgeBreathingAnimationClass(edge: ResolvedDesktopNoticeEdge) {
  return `desktop-notice-rule-preview-edge-breathing desktop-notice-rule-preview-edge-breathing-${edgeOrientationForEdge(edge)}`;
}

function resolvePreviewEdge(edge: DesktopNoticeEdge): ResolvedDesktopNoticeEdge {
  return resolveDesktopNoticeEdge(edge, { width: 260, height: 80 });
}

function previewEffectFrameClass(edge: ResolvedDesktopNoticeEdge) {
  if (edge === 'left') {
    return 'left-5 top-5 bottom-16 w-10';
  }
  if (edge === 'right') {
    return 'right-5 top-5 bottom-16 w-10';
  }
  return 'left-5 right-5 top-5 h-10';
}

function previewEdgeBreathingHaloClass(edge: ResolvedDesktopNoticeEdge) {
  if (edge === 'top') {
    return 'left-[-18%] right-[-18%] top-0 h-[30px]';
  }
  if (edge === 'left') {
    return 'bottom-[-18%] top-[-18%] left-0 w-[30px]';
  }
  if (edge === 'right') {
    return 'bottom-[-18%] top-[-18%] right-0 w-[30px]';
  }
  return 'left-[-18%] right-[-18%] bottom-0 h-[30px]';
}

function previewEdgeBreathingLineClass(edge: ResolvedDesktopNoticeEdge) {
  if (edge === 'top') {
    return 'left-[-18%] right-[-18%] top-[1px] h-[2px]';
  }
  if (edge === 'left') {
    return 'bottom-[-18%] top-[-18%] left-[1px] w-[2px]';
  }
  if (edge === 'right') {
    return 'bottom-[-18%] top-[-18%] right-[1px] w-[2px]';
  }
  return 'left-[-18%] right-[-18%] bottom-[1px] h-[2px]';
}


function previewEffectClass(
  effect: DesktopNoticeRuleEffect,
  edgeOrientation: 'horizontal' | 'vertical' = 'horizontal'
): string {
  if (effect === 'breathing') {
    return 'desktop-notice-rule-preview-breathing';
  }
  if (effect === 'blink') {
    return 'desktop-notice-rule-preview-blink';
  }
  if (effect === 'scan') {
    return 'desktop-notice-rule-preview-scan';
  }
  if (effect === 'edge-breathing') {
    return `desktop-notice-rule-preview-edge-breathing desktop-notice-rule-preview-edge-breathing-${edgeOrientation}`;
  }
  if (effect === 'fade') {
    return 'desktop-notice-rule-preview-fade';
  }
  return '';
}

function normalizeRestoreBehavior(
  behavior: DesktopNoticeRestoreBehavior | null | undefined
): DesktopNoticeRestoreBehavior {
  return !behavior || behavior === 'restore-default' || behavior === 'dim-placeholder'
    ? 'use-instance-idle'
    : behavior;
}
