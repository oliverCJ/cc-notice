import { Circle, Eraser, Minus, MousePointer2, PanelLeftClose, PanelLeftOpen, Pencil, PenTool, Redo2, RotateCcw, Square, Triangle } from 'lucide-react';
import type { ToolId } from '@/domain/customFaces/editor/types';

type Props = { collapsed: boolean; selectedTool: ToolId; canUndo: boolean; canRedo: boolean; onCollapsedChange: (value: boolean) => void; onToolChange: (tool: ToolId) => void; onUndo: () => void; onRedo: () => void };
const tools: Array<{ id: ToolId; label: string; hint: string; icon: typeof Pencil; group: '选区' | '绘制' | '形状' }> = [
  { id: 'select', label: '框选', hint: '拖拽建立选区，再执行复制、粘贴或清空', icon: MousePointer2, group: '选区' },
  { id: 'brush', label: '画笔', hint: '点击像素切换高亮状态', icon: Pencil, group: '绘制' },
  { id: 'eraser', label: '橡皮擦', hint: '拖动擦除工具属性中设置的区域', icon: Eraser, group: '绘制' },
  { id: 'line', label: '直线', hint: '拖拽预览，释放后提交', icon: Minus, group: '形状' },
  { id: 'rectangle', label: '矩形', hint: '拖拽预览，属性区选择空心或实心', icon: Square, group: '形状' },
  { id: 'circle', label: '圆形', hint: '拖拽外接框，预览与最终结果一致', icon: Circle, group: '形状' },
  { id: 'triangle', label: '三角形', hint: '拖拽边界框绘制三角形', icon: Triangle, group: '形状' },
  { id: 'pen', label: '钢笔', hint: '逐点建立路径，双击或属性区按钮完成', icon: PenTool, group: '形状' }
];

export function CustomFaceToolbar({ collapsed, selectedTool, canUndo, canRedo, onCollapsedChange, onToolChange, onUndo, onRedo }: Props) {
  return <aside className={collapsed ? 'w-12 shrink-0 border-r border-border p-1' : 'w-40 shrink-0 border-r border-border p-2'} aria-label="表情编辑工具条"><IconButton label={collapsed ? '展开工具条' : '收起工具条'} icon={collapsed ? PanelLeftOpen : PanelLeftClose} onClick={() => onCollapsedChange(!collapsed)} showLabel={!collapsed} />{(['选区', '绘制', '形状'] as const).map((group) => <div key={group} className="mt-3">{!collapsed ? <div className="mb-1 px-1 text-[11px] text-muted-foreground">{group}</div> : null}{tools.filter((tool) => tool.group === group).map((tool) => <IconButton key={tool.id} label={tool.label} hint={tool.hint} icon={tool.icon} active={selectedTool === tool.id} onClick={() => onToolChange(tool.id)} showLabel={!collapsed} />)}</div>)}<div className="mt-3 border-t border-border pt-2">{!collapsed ? <div className="mb-1 px-1 text-[11px] text-muted-foreground">历史</div> : null}<IconButton label="撤销" hint="撤销最近一次完整操作" icon={RotateCcw} disabled={!canUndo} onClick={onUndo} showLabel={!collapsed} /><IconButton label="重做" hint="恢复最近一次已撤销操作" icon={Redo2} disabled={!canRedo} onClick={onRedo} showLabel={!collapsed} /></div></aside>;
}

function IconButton({ label, hint, icon: Icon, active = false, disabled = false, showLabel, onClick }: { label: string; hint?: string; icon: typeof Pencil; active?: boolean; disabled?: boolean; showLabel: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} title={hint ? `${label}：${hint}` : label} disabled={disabled} className={`mb-1 flex h-9 w-full items-center gap-2 border px-2 text-left text-xs ${active ? 'border-primary bg-primary/15 text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent'} disabled:cursor-not-allowed disabled:opacity-35`} onClick={onClick}><Icon className="h-4 w-4 shrink-0" />{showLabel ? <span>{label}</span> : null}</button>;
}
