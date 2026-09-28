// 「搜索框样式」浮层：一张深色小卡片，拖滑杆时主页那条搜索框实时跟着变。
//
// 两个入口：常规设置里的「搜索框样式」行、主页搜索框上右键（表面不摆按钮）。
// 实时生效靠的是配置本身——update() 写进 storage.sync，useConfig 的订阅把新值
// 推回所有视图，所以卡片里没有「应用」按钮，「完成」只是关掉浮层。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/** 设置面板和主页之间隔得太远，用一个 window 事件把「打开样式卡」递过去 */
export const SEARCH_STYLE_EVENT = 'wetab:search-style';

export function requestSearchStyle() {
  window.dispatchEvent(new Event(SEARCH_STYLE_EVENT));
}

/** 主页那条搜索框的锚点，浮层按它的位置摆，宽度一变就重新居中 */
export const SEARCH_BAR_ANCHOR = '[data-search-bar]';

interface Props {
  onClose: () => void;
}

function Bar({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-[13px] text-white/70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 min-w-0 flex-1 accent-white"
      />
      <span className="w-12 shrink-0 text-right text-[13px] tabular-nums text-white">
        {value}
        <span className="ml-0.5 text-[11px] text-white/45">%</span>
      </span>
    </div>
  );
}

function SearchStylePopover({ onClose }: Props) {
  const { config, update } = useConfig();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  /* 贴在搜索框下面：宽度滑杆一动、窗口一 resize，卡片就跟着重新居中。
     设置窗口里没有主页那条搜索框，退化成底部居中，功能照样能用。 */
  useLayoutEffect(() => {
    const place = () => {
      const card = ref.current?.getBoundingClientRect();
      if (!card) return;
      const bar = document.querySelector(SEARCH_BAR_ANCHOR)?.getBoundingClientRect();
      const half = card.width / 2;
      const centerX = bar ? bar.left + bar.width / 2 : window.innerWidth / 2;
      const bottom = bar ? bar.bottom + 14 : window.innerHeight - 24;
      setPos({
        left: Math.min(Math.max(centerX, half + 12), window.innerWidth - half - 12),
        top: Math.min(bottom, window.innerHeight - card.height - 12),
      });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [config.searchOpacity, config.searchWidth, config.showSearch]);

  /* 点外面 / Esc 都直接关掉：改动早就落盘了，不需要确认 */
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node | null)) onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="搜索框样式"
      className={cn(
        'fixed z-[60] w-[320px] -translate-x-1/2 overflow-hidden rounded-2xl',
        'border border-white/12 bg-neutral-900/92 text-white shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl',
        'animate-in fade-in-0 zoom-in-95 duration-150',
        !pos && 'invisible',
      )}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0 }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="flex flex-col gap-4 px-5 pt-4 pb-5">
        <h3 className="text-[15px] font-semibold">搜索框样式</h3>
        <Bar
          label="宽度"
          value={config.searchWidth}
          min={30}
          max={100}
          onChange={(v) => update({ searchWidth: v })}
        />
        {/* 不透明度内部存 0–1，这里只按百分比展示 */}
        <Bar
          label="透明度"
          value={Math.round(config.searchOpacity * 100)}
          min={10}
          max={100}
          onChange={(v) => update({ searchOpacity: v / 100 })}
        />
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-[13px] text-white/70">显示搜索框</span>
          <Switch
            checked={config.showSearch}
            onCheckedChange={(v) => update({ showSearch: v })}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-0.5 text-[13px] text-white/60 transition-colors hover:text-white"
        >
          <ChevronLeft className="size-3.5" />
          返回
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-0.5 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
        >
          完成
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * 谁挂这个浮层谁就负责监听 SEARCH_STYLE_EVENT——新标签页（右键搜索框 / 常规设置）
 * 和完整设置页（只有常规设置那一行）共用同一个入口，不需要层层传回调。
 */
export function SearchStyleLayer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onRequest = () => setOpen(true);
    window.addEventListener(SEARCH_STYLE_EVENT, onRequest);
    return () => window.removeEventListener(SEARCH_STYLE_EVENT, onRequest);
  }, []);

  return open ? <SearchStylePopover onClose={() => setOpen(false)} /> : null;
}

export default SearchStylePopover;
