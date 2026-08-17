import { ReactNode } from 'react';

type PageFrameProps = {
  title: string;
  description?: string;
  children?: ReactNode;
};

type PanelProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
};

export function PageFrame({ title, description, children }: PageFrameProps) {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Panel({ title, children, className = '' }: PanelProps) {
  return (
    <section className={`rounded-lg border border-border bg-card p-5 text-card-foreground ${className}`.trim()}>
      {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
      {children}
    </section>
  );
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

export function PanelGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}
