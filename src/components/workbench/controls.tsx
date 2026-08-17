import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

type WorkbenchButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
  danger: 'border-transparent bg-transparent text-destructive hover:text-destructive/80',
  ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
};

export function WorkbenchButton({
  selected = false,
  variant = 'secondary',
  className = '',
  children,
  ...props
}: WorkbenchButtonProps) {
  const selectedClass = selected
    ? 'selected border-primary bg-primary text-primary-foreground hover:bg-primary/90'
    : variantClasses[variant];

  return (
    <button
      className={`rounded-md border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${selectedClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export const inputClass =
  'min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30';

export const fieldClass = 'grid gap-1.5 text-sm text-foreground';
