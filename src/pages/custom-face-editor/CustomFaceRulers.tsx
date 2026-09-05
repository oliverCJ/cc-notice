import { useState } from 'react';
import { Columns3, Rows3, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';

export type CanvasGuide = { id: string; orientation: 'horizontal' | 'vertical'; position: number };

type Props = {
  width: number;
  height: number;
  scale: number;
  guides: CanvasGuide[];
  onGuidesChange: (guides: CanvasGuide[]) => void;
  children: React.ReactNode;
};

export function CustomFaceRulers({
  width,
  height,
  scale,
  guides,
  onGuidesChange,
  children,
}: Props) {
  const t = useI18n();
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const minorStep = width > 128 ? 10 : 4;
  const majorStep = width > 128 ? 20 : 8;
  const createGuide = (orientation: CanvasGuide['orientation']) => {
    const position = orientation === 'horizontal' ? Math.floor(height / 2) : Math.floor(width / 2);
    onGuidesChange([...guides, { id: createGuideId(), orientation, position }]);
  };
  const updateGuide = (id: string, position: number) =>
    onGuidesChange(
      guides.map((guide) =>
        guide.id === id
          ? { ...guide, position: clampGuide(guide.orientation, position, width, height) }
          : guide
      )
    );
  const deleteGuide = (id: string) => {
    onGuidesChange(guides.filter((guide) => guide.id !== id));
    setActiveGuideId(null);
  };
  const activeGuide = guides.find((guide) => guide.id === activeGuideId) ?? null;
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `34px ${width * scale}px`,
        gridTemplateRows: activeGuide
          ? `${height * scale}px 32px 38px`
          : `${height * scale}px 32px`,
      }}
    >
      <div
        aria-label={t('customFaceEditor.rulers.vertical')}
        className="relative border-r border-border bg-muted/30 text-[9px] text-muted-foreground"
      >
        {ticks(height, minorStep).map((position) => (
          <div
            key={position}
            className="absolute right-0 flex items-center"
            style={{ top: `${position * scale}px` }}
          >
            <span className={position % majorStep === 0 ? 'mr-1' : 'sr-only'}>{position}</span>
            <span
              className={
                position % majorStep === 0
                  ? 'block w-3 border-t border-muted-foreground/70'
                  : 'block w-1.5 border-t border-muted-foreground/40'
              }
            />
          </div>
        ))}
        {guides
          .filter((guide) => guide.orientation === 'horizontal')
          .map((guide) => (
            <button
              key={guide.id}
              type="button"
              aria-label={`${t('customFaceEditor.rulers.horizontalGuide')} ${guide.position}`}
              className="absolute right-0 z-20 h-3 w-4 -translate-y-1/2 border border-cyan-400 bg-cyan-400/30"
              style={{ top: `${(guide.position + 0.5) * scale}px` }}
              onClick={() => setActiveGuideId(guide.id)}
              onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
              onPointerMove={(event) => {
                if (event.buttons !== 1) return;
                const rect = event.currentTarget.parentElement!.getBoundingClientRect();
                updateGuide(guide.id, Math.floor((event.clientY - rect.top) / scale));
              }}
            />
          ))}
      </div>
      <div
        className="relative"
        style={{ width: `${width * scale}px`, height: `${height * scale}px` }}
      >
        {children}
        <div className="pointer-events-none absolute inset-0 z-10">
          {guides.map((guide) =>
            guide.orientation === 'horizontal' ? (
              <div
                key={guide.id}
                className="absolute left-0 right-0 border-t border-dashed border-cyan-400/90"
                style={{ top: `${(guide.position + 0.5) * scale}px` }}
              />
            ) : (
              <div
                key={guide.id}
                className="absolute bottom-0 top-0 border-l border-dashed border-cyan-400/90"
                style={{ left: `${(guide.position + 0.5) * scale}px` }}
              />
            )
          )}
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 border-r border-t border-border bg-muted/30">
        <button
          type="button"
          aria-label={t('customFaceEditor.rulers.addHorizontal')}
          title={t('customFaceEditor.rulers.addHorizontal')}
          onClick={() => createGuide('horizontal')}
        >
          <Rows3 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={t('customFaceEditor.rulers.addVertical')}
          title={t('customFaceEditor.rulers.addVertical')}
          onClick={() => createGuide('vertical')}
        >
          <Columns3 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        aria-label={t('customFaceEditor.rulers.horizontal')}
        className="relative border-t border-border bg-muted/30 text-[9px] text-muted-foreground"
      >
        {ticks(width, minorStep).map((position) => (
          <div key={position} className="absolute top-0" style={{ left: `${position * scale}px` }}>
            <span
              className={
                position % majorStep === 0
                  ? 'block h-3 border-l border-muted-foreground/70 pl-1'
                  : 'block h-1.5 border-l border-muted-foreground/40'
              }
            >
              {position % majorStep === 0 ? position : ''}
            </span>
          </div>
        ))}
        {guides
          .filter((guide) => guide.orientation === 'vertical')
          .map((guide) => (
            <button
              key={guide.id}
              type="button"
              aria-label={`${t('customFaceEditor.rulers.verticalGuide')} ${guide.position}`}
              className="absolute top-0 z-20 h-4 w-3 -translate-x-1/2 border border-cyan-400 bg-cyan-400/30"
              style={{ left: `${(guide.position + 0.5) * scale}px` }}
              onClick={() => setActiveGuideId(guide.id)}
              onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
              onPointerMove={(event) => {
                if (event.buttons !== 1) return;
                const rect = event.currentTarget.parentElement!.getBoundingClientRect();
                updateGuide(guide.id, Math.floor((event.clientX - rect.left) / scale));
              }}
            />
          ))}
      </div>
      {activeGuide ? (
        <div
          data-testid="guide-editor-outside"
          className="col-span-2 flex items-center justify-end gap-2 border-t border-border bg-popover px-2 text-xs text-popover-foreground"
        >
          <span>
            {activeGuide.orientation === 'horizontal'
              ? t('customFaceEditor.rulers.horizontalRow')
              : t('customFaceEditor.rulers.verticalColumn')}
          </span>
          <input
            aria-label={t('customFaceEditor.rulers.coordinate')}
            type="number"
            min="0"
            max={activeGuide.orientation === 'horizontal' ? height - 1 : width - 1}
            className="w-16 border border-border bg-background px-1 py-0.5"
            value={activeGuide.position}
            onChange={(event) => updateGuide(activeGuide.id, Number(event.target.value))}
          />
          <button
            type="button"
            aria-label={t('customFaceEditor.rulers.delete')}
            title={t('customFaceEditor.rulers.delete')}
            onClick={() => deleteGuide(activeGuide.id)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="border border-border px-2 py-0.5"
            onClick={() => setActiveGuideId(null)}
          >
            {t('customFaceEditor.rulers.close')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ticks(length: number, step: number) {
  const values = [];
  for (let value = 0; value < length; value += step) values.push(value);
  return values;
}
function clampGuide(
  orientation: CanvasGuide['orientation'],
  position: number,
  width: number,
  height: number
) {
  return Math.min(
    (orientation === 'horizontal' ? height : width) - 1,
    Math.max(0, Math.trunc(position) || 0)
  );
}
function createGuideId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `guide-${Date.now()}-${Math.random()}`;
}
