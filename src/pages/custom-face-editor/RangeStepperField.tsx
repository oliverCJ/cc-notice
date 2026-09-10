import { useEffect, useRef, useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';

type RangeStepperFieldProps = {
  label: string;
  description?: string;
  ariaLabel: string;
  decreaseLabel: string;
  increaseLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  defaultValue?: number;
  disabled?: boolean;
  resetLabel?: string;
  onReset?: () => void;
  onChange: (value: number) => void;
  onStep?: (delta: number) => void;
  formatValue?: (value: number) => string;
};

type TooltipPosition = {
  x: number;
  y: number;
};

export function RangeStepperField({
  label,
  description,
  ariaLabel,
  decreaseLabel,
  increaseLabel,
  min,
  max,
  step,
  value,
  defaultValue,
  disabled = false,
  resetLabel,
  onReset,
  onChange,
  onStep,
  formatValue,
}: RangeStepperFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftValue, setDraftValue] = useState(() => formatValue ? formatValue(value) : String(value));
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setDraftValue(formatValue ? formatValue(value) : String(value));
  }, [formatValue, value]);

  const commitDraftValue = () => {
    const next = Number(draftValue);
    const normalized = Number.isFinite(next) ? normalizeRangeValue(next, min, max, step) : value;
    onChange(normalized);
    setDraftValue(formatValue ? formatValue(normalized) : String(normalized));
  };

  const handleStep = (delta: number) => {
    if (onStep) {
      onStep(delta);
      return;
    }
    onChange(normalizeRangeValue(value + delta, min, max, step));
  };

  return (
    <div className={`grid gap-1 text-xs ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1">
          <span>{label}</span>
          {description ? (
            <button
              type="button"
              className="inline-flex cursor-help items-center text-muted-foreground outline-none"
              aria-label={description}
              title={description}
              onBlur={() => setTooltipPosition(null)}
              onFocus={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setTooltipPosition({ x: rect.left, y: rect.bottom + 6 });
              }}
              onMouseEnter={(event) => setTooltipPosition({ x: event.clientX + 10, y: event.clientY + 10 })}
              onMouseLeave={() => setTooltipPosition(null)}
            >
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              {tooltipPosition ? (
                <span
                  role="tooltip"
                  className="fixed z-50 w-56 border border-border bg-popover px-2 py-1 text-left text-[11px] leading-4 text-popover-foreground shadow-lg"
                  style={{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }}
                >
                  {description}
                </span>
              ) : null}
            </button>
          ) : null}
        </span>
        {onReset ? (
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center border border-border text-[11px] text-muted-foreground disabled:opacity-30"
            disabled={disabled || (defaultValue !== undefined && value === defaultValue)}
            aria-label={resetLabel ?? '重置'}
            title={resetLabel ?? '重置'}
            onClick={onReset}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="mt-1 grid grid-cols-[auto_1fr_auto_5.25rem] items-center gap-2">
        <button
          type="button"
          className="inline-flex h-7 min-w-7 items-center justify-center border border-border px-2 text-xs text-muted-foreground disabled:opacity-30"
          disabled={disabled || value <= min}
          aria-label={decreaseLabel}
          title={decreaseLabel}
          onClick={() => handleStep(-step)}
        >
          -
        </button>
        <input
          aria-label={ariaLabel}
          className="h-8 w-full accent-primary"
          max={max}
          min={min}
          step={step}
          type="range"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(normalizeRangeValue(Number(event.target.value), min, max, step))}
        />
        <button
          type="button"
          className="inline-flex h-7 min-w-7 items-center justify-center border border-border px-2 text-xs text-muted-foreground disabled:opacity-30"
          disabled={disabled || value >= max}
          aria-label={increaseLabel}
          title={increaseLabel}
          onClick={() => handleStep(step)}
        >
          +
        </button>
        <input
          ref={inputRef}
          aria-label={`${ariaLabel}数值`}
          className="h-8 border border-border bg-background px-2 py-1 text-sm"
          disabled={disabled}
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          type="text"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commitDraftValue}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
        />
      </div>
    </div>
  );
}

export function normalizeRangeValue(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value));
  const steps = Math.round((clamped - min) / step);
  return Number((min + steps * step).toFixed(2));
}
