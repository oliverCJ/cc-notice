import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

type DeferredNumberInputProps = {
  id: string;
  min: number;
  max: number;
  value?: number | null;
  placeholder?: string;
  className?: string;
  allowEmpty?: boolean;
  onCommit: (value: number | null) => void;
};

export function DeferredNumberInput({
  id,
  min,
  max,
  value,
  placeholder,
  className,
  allowEmpty = false,
  onCommit
}: DeferredNumberInputProps) {
  const normalizedValue = normalizeNumberValue(value, min, max, allowEmpty);
  const [draft, setDraft] = useState(formatNumberValue(normalizedValue));

  useEffect(() => {
    setDraft(formatNumberValue(normalizedValue));
  }, [normalizedValue]);

  function handleChange(nextDraft: string) {
    setDraft(nextDraft);
    const parsedValue = parseNumberDraft(nextDraft);
    if (parsedValue == null || parsedValue < min || parsedValue > max) {
      return;
    }
    onCommit(Math.round(parsedValue));
  }

  function handleBlur() {
    const parsedValue = parseNumberDraft(draft);
    const committedValue = normalizeNumberValue(parsedValue, min, max, allowEmpty);
    setDraft(formatNumberValue(committedValue));
    if (committedValue !== normalizedValue) {
      onCommit(committedValue);
    }
  }

  return (
    <Input
      id={id}
      type="number"
      min={min}
      max={max}
      value={draft}
      placeholder={placeholder}
      className={className}
      onBlur={handleBlur}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}

function normalizeNumberValue(
  value: number | null | undefined,
  min: number,
  max: number,
  allowEmpty: boolean
): number | null {
  if (allowEmpty && value == null) {
    return null;
  }
  if (value == null || !Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function formatNumberValue(value: number | null) {
  return value == null ? '' : String(value);
}

function parseNumberDraft(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}
