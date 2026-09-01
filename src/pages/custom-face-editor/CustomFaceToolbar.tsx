import { Circle, Eraser, Minus, MousePointer2, PanelLeftClose, PanelLeftOpen, Pencil, PenTool, Redo2, RotateCcw, Square, Triangle } from 'lucide-react';
import type { ToolId } from '@/domain/customFaces/editor/types';
import { useI18n } from '@/i18n';

type Props = { collapsed: boolean; selectedTool: ToolId; canUndo: boolean; canRedo: boolean; onCollapsedChange: (value: boolean) => void; onToolChange: (tool: ToolId) => void; onUndo: () => void; onRedo: () => void };
const toolDefinitions: Array<{ id: ToolId; labelKey: string; hintKey: string; icon: typeof Pencil; group: 'selection' | 'drawing' | 'shapes' }> = [
  { id: 'select', labelKey: 'select', hintKey: 'select', icon: MousePointer2, group: 'selection' },
  { id: 'brush', labelKey: 'brush', hintKey: 'brush', icon: Pencil, group: 'drawing' },
  { id: 'eraser', labelKey: 'eraser', hintKey: 'eraser', icon: Eraser, group: 'drawing' },
  { id: 'line', labelKey: 'line', hintKey: 'line', icon: Minus, group: 'shapes' },
  { id: 'rectangle', labelKey: 'rectangle', hintKey: 'rectangle', icon: Square, group: 'shapes' },
  { id: 'circle', labelKey: 'circle', hintKey: 'circle', icon: Circle, group: 'shapes' },
  { id: 'triangle', labelKey: 'triangle', hintKey: 'triangle', icon: Triangle, group: 'shapes' },
  { id: 'pen', labelKey: 'pen', hintKey: 'pen', icon: PenTool, group: 'shapes' }
];

export function CustomFaceToolbar({ collapsed, selectedTool, canUndo, canRedo, onCollapsedChange, onToolChange, onUndo, onRedo }: Props) {
  const t = useI18n();
  const groups = ['selection', 'drawing', 'shapes'] as const;
  return <aside className={collapsed ? 'w-12 shrink-0 border-r border-border p-1' : 'w-40 shrink-0 border-r border-border p-2'} aria-label={t('customFaceEditor.toolbar.ariaLabel')}><IconButton label={collapsed ? t('customFaceEditor.toolbar.expand') : t('customFaceEditor.toolbar.collapse')} icon={collapsed ? PanelLeftOpen : PanelLeftClose} onClick={() => onCollapsedChange(!collapsed)} showLabel={!collapsed} />{groups.map((group) => <div key={group} className="mt-3">{!collapsed ? <div className="mb-1 px-1 text-[11px] text-muted-foreground">{t(`customFaceEditor.toolbar.groups.${group}`)}</div> : null}{toolDefinitions.filter((tool) => tool.group === group).map((tool) => <IconButton key={tool.id} label={t(`customFaceEditor.toolbar.tools.${tool.labelKey}.label`)} hint={t(`customFaceEditor.toolbar.tools.${tool.hintKey}.hint`)} icon={tool.icon} active={selectedTool === tool.id} onClick={() => onToolChange(tool.id)} showLabel={!collapsed} />)}</div>)}<div className="mt-3 border-t border-border pt-2">{!collapsed ? <div className="mb-1 px-1 text-[11px] text-muted-foreground">{t('customFaceEditor.toolbar.groups.history')}</div> : null}<IconButton label={t('customFaceEditor.toolbar.undo')} hint={t('customFaceEditor.toolbar.undoHint')} icon={RotateCcw} disabled={!canUndo} onClick={onUndo} showLabel={!collapsed} /><IconButton label={t('customFaceEditor.toolbar.redo')} hint={t('customFaceEditor.toolbar.redoHint')} icon={Redo2} disabled={!canRedo} onClick={onRedo} showLabel={!collapsed} /></div></aside>;
}

function IconButton({ label, hint, icon: Icon, active = false, disabled = false, showLabel, onClick }: { label: string; hint?: string; icon: typeof Pencil; active?: boolean; disabled?: boolean; showLabel: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} title={hint ? `${label}: ${hint}` : label} disabled={disabled} className={`mb-1 flex h-9 w-full items-center gap-2 border px-2 text-left text-xs ${active ? 'border-primary bg-primary/15 text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent'} disabled:cursor-not-allowed disabled:opacity-35`} onClick={onClick}><Icon className="h-4 w-4 shrink-0" />{showLabel ? <span>{label}</span> : null}</button>;
}
