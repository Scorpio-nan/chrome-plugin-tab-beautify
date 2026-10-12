// 底部栏 / 控制栏（上游 F09）。
//
// 浮在内容区底部的一条胶囊：左边选「布局优先 / 大小优先」，中间「一键整理」，
// 右边两个快捷键（添加图标、添加小组件）。显示与否在常规设置里控制。
import { LayoutDashboard, Plus, Rows3, Sparkles, StretchHorizontal } from 'lucide-react';

import type { ArrangeMode } from '@/lib/nav';
import { cn } from '@/lib/utils';

interface Props {
  mode: ArrangeMode;
  onModeChange: (mode: ArrangeMode) => void;
  onArrange: () => void;
  onAddIcon: () => void;
  onAddWidget: () => void;
}

const MODES: { id: ArrangeMode; label: string; icon: React.ReactNode }[] = [
  { id: 'layout', label: '布局优先', icon: <Rows3 className="size-3.5" /> },
  { id: 'size', label: '大小优先', icon: <StretchHorizontal className="size-3.5" /> },
];

export default function BottomBar({
  mode,
  onModeChange,
  onArrange,
  onAddIcon,
  onAddWidget,
}: Props) {
  return (
    <div className="pointer-events-none flex shrink-0 justify-center pb-5">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/12 bg-black/35 p-1 shadow-xl backdrop-blur-md">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            title={
              m.id === 'layout'
                ? '布局优先：小图标先填满空位，减少空洞'
                : '大小优先：大块先摆，同尺寸保持原顺序'
            }
            onClick={() => onModeChange(m.id)}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors',
              m.id === mode
                ? 'bg-white/90 text-zinc-900'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}

        <span className="mx-0.5 h-4 w-px bg-white/15" />

        <button
          type="button"
          title="一键整理布局"
          onClick={onArrange}
          className="flex items-center gap-1 rounded-full bg-primary/90 px-3 py-1 text-[11px] text-primary-foreground transition-colors hover:bg-primary"
        >
          <Sparkles className="size-3.5" />
          一键整理
        </button>

        <span className="mx-0.5 h-4 w-px bg-white/15" />

        <button
          type="button"
          title="添加图标"
          onClick={onAddIcon}
          className="grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          <Plus className="size-3.5" />
          <span className="sr-only">添加图标</span>
        </button>
        <button
          type="button"
          title="添加小组件"
          onClick={onAddWidget}
          className="grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
        >
          <LayoutDashboard className="size-3.5" />
          <span className="sr-only">添加小组件</span>
        </button>
      </div>
    </div>
  );
}
