import { useEffect, useRef, useState } from 'react';
import { Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateVariableHelper } from './TemplateVariableHelper';
import { TemplateVariable } from './templateVariables';
import { useI18n } from '@/i18n';

type TemplateVariablePopoverProps = {
  variables: TemplateVariable[];
  onInsert: (token: string) => void;
  onCopy: (token: string) => void;
};

export function TemplateVariablePopover({
  variables,
  onInsert,
  onCopy
}: TemplateVariablePopoverProps) {
  const t = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={t('rules.variables.openHelper')}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Braces className="h-4 w-4" />
        {t('rules.variables.button')}
      </Button>
      {open ? (
        <div className="absolute right-0 top-10 z-40 w-[min(520px,calc(100vw-3rem))]">
          <TemplateVariableHelper
            variables={variables}
            onInsert={onInsert}
            onCopy={onCopy}
          />
        </div>
      ) : null}
    </div>
  );
}
