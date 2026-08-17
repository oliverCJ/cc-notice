import { HTMLAttributes, ReactNode } from 'react';

export function DataList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">{children}</div>
  );
}

export function DataRow({
  children,
  columns = 'grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_auto]'
}: {
  children: ReactNode;
  columns?: string;
}) {
  return (
    <div className={`grid gap-3 border-b border-border p-3 last:border-b-0 ${columns}`}>
      {children}
    </div>
  );
}

export function RuleList({ children }: { children: ReactNode }) {
  return (
    <div className="grid overflow-hidden rounded-lg border border-border">{children}</div>
  );
}

export function RuleRow({
  children,
  columns = 'grid-cols-1 xl:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_88px_56px]',
  compact = false,
  ...props
}: {
  children: ReactNode;
  columns?: string;
  compact?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const spacing = compact ? 'gap-2 p-2.5' : 'gap-3 p-3';

  return (
    <div
      className={`grid ${spacing} border-b border-border last:border-b-0 ${columns}`}
      {...props}
    >
      {children}
    </div>
  );
}
