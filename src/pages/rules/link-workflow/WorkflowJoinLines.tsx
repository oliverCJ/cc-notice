type WorkflowJoinLinesProps = {
  toolCount?: number;
  variant?: 'fan-in' | 'single';
};

export function WorkflowJoinLines({
  toolCount = 2,
  variant = 'fan-in'
}: WorkflowJoinLinesProps) {
  const sourcePoints =
    variant === 'single' ? [120] : sourceYPositions(Math.max(1, Math.min(toolCount, 4)));

  return (
    <div data-testid="workflow-join-lines" aria-hidden="true" className="h-56">
      <svg className="h-full w-full overflow-visible" viewBox="0 0 76 224" preserveAspectRatio="none">
        {sourcePoints.map((sourceY) => (
          <path
            key={`${variant}-${sourceY}`}
            d={`M 0 ${sourceY} C 28 ${sourceY}, 40 112, 76 112`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-border"
          />
        ))}
        {variant === 'fan-in' && (
          <circle cx="76" cy="112" r="3.5" className="fill-background stroke-border" />
        )}
      </svg>
    </div>
  );
}

function sourceYPositions(count: number) {
  if (count === 1) {
    return [112];
  }
  if (count === 2) {
    return [72, 152];
  }
  if (count === 3) {
    return [48, 112, 176];
  }
  return [36, 88, 140, 188];
}
