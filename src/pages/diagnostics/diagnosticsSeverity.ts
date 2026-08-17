import { DiagnosticSeverity, DiagnosticStatus } from '@/api/tauriApi';

export function diagnosticStatusBadgeVariant(status: DiagnosticStatus) {
  if (status === 'error') {
    return 'destructive' as const;
  }
  if (status === 'ok') {
    return 'default' as const;
  }
  return 'secondary' as const;
}

export function diagnosticSeverityBadgeVariant(severity: DiagnosticSeverity) {
  return severity === 'error' ? ('destructive' as const) : ('secondary' as const);
}

export function diagnosticStatusBorderClass(status: DiagnosticStatus) {
  switch (status) {
    case 'ok':
      return 'border-l-emerald-500';
    case 'error':
      return 'border-l-red-500';
    case 'warning':
      return 'border-l-amber-500';
    case 'not-configured':
      return 'border-l-slate-400';
    default:
      return 'border-l-blue-500';
  }
}
