// 轻量右键菜单：磁贴、侧栏行、内容区空白处共用一个操作列表。
//
// 不用 Radix DropdownMenu——它锚定在触发元素上，而这里要求菜单出现在鼠标点位，
// 并且点别处 / 按 Esc / 页面一滚动就立刻消失。手写一个 portal 更直接。
//
// 级联菜单走 MenuItem.submenu，支持任意层级（「移动到」就是 分组 → 页面 两级）。
// 点父项不关菜单，在原地推进一级并留下 › 面包屑，Esc 一级一级退回、退到头才关。
// 比再弹一个浮层省位置，长列表也不用铺满整屏。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** 删除这类破坏性操作 */
  danger?: boolean;
  disabled?: boolean;
  /** 右侧灰色提示，例如「3 个图标」「已是最小」 */
  hint?: string;
  /** 下一级菜单；带了它就点不关整个菜单，onSelect 也不会被调用 */
  submenu?: MenuItem[];
  /** 画一条分隔线，用来分组（例如「尺寸」下面那排） */
  separatorBefore?: boolean;
  onSelect?: () => void;
}

interface Props {
  /** 触发时的鼠标坐标（clientX / clientY） */
  x: number;
  y: number;
  items: MenuItem[];
  /** 列表下方追加的控件（例如图标选择器），点它不会关掉菜单 */
  extra?: React.ReactNode;
  onClose: () => void;
}

const MENU_WIDTH = 176;
/** 子菜单项带页面名 + 数量提示，宽一点 */
const SUB_WIDTH = 208;
const EDGE = 8;

/**
 * path 里只存「每一级停在哪个父项 id 上」，下一级列表永远从当前 items 里现取，
 * 所以菜单项刚被别处改动（比如某个页面被删了）也不会拿着过期闭包不放。
 */
export default function ContextMenu({ x, y, items, extra, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [path, setPath] = useState<string[]>([]);

  /* 换了触发点位（右键了别的东西）就退回第一级 */
  useEffect(() => setPath([]), [x, y]);

  /* 逐级解析级联栈：某一级失效（父项没了或不再有子菜单）就自动截断到还能走到的深度 */
  const trail: MenuItem[] = [];
  let list = items;
  for (const key of path) {
    const hit = list.find((i) => i.id === key);
    if (!hit?.submenu) break;
    trail.push(hit);
    list = hit.submenu;
  }
  const keys = trail.map((t) => t.id);
  const inSub = keys.length > 0;
  /** Esc 的处理器只挂一次，靠这个 ref 读到当前深度 */
  const keysRef = useRef<string[]>(keys);
  keysRef.current = keys;

  /* 贴边时反向展开：右边界放不下就向左挪，下边界放不下就向上翻 */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.min(Math.max(EDGE, x), Math.max(EDGE, window.innerWidth - width - EDGE)),
      top:
        y + height + EDGE > window.innerHeight
          ? Math.max(EDGE, y - height)
          : y,
    });
  }, [x, y, keys.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 先退一级，已经在第一级才关整个菜单
      if (keysRef.current.length) setPath(keysRef.current.slice(0, -1));
      else onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    // 菜单不跟着内容区一起滚动，一动就关
    const onScroll = () => onClose();

    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('wheel', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  const pick = (item: MenuItem) => {
    if (item.submenu) {
      setPath([...keys, item.id]);
      return;
    }
    item.onSelect?.();
    onClose();
  };

  const row = (item: MenuItem) => (
    <div key={item.id}>
      {item.separatorBefore && <div className="my-1 h-px bg-border" />}
      <button
        type="button"
        role="menuitem"
        disabled={item.disabled}
        aria-haspopup={item.submenu ? 'menu' : undefined}
        onClick={() => pick(item)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm outline-hidden',
          item.danger
            ? 'text-destructive hover:bg-destructive/15'
            : 'hover:bg-accent hover:text-accent-foreground',
          // 已经推进过的那一级留个底色，一眼看出当前停在哪条支上
          keys.includes(item.id) && 'bg-accent/60',
          item.disabled && 'pointer-events-none opacity-45',
        )}
      >
        {item.icon}
        <span className="truncate">{item.label}</span>
        {item.hint && (
          <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">
            {item.hint}
          </span>
        )}
        {item.submenu && (
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-muted-foreground',
              !item.hint && 'ml-auto',
            )}
          />
        )}
      </button>
    </div>
  );

  return createPortal(
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        left: pos.left,
        top: pos.top,
        width: inSub ? SUB_WIDTH : MENU_WIDTH,
      }}
      className={cn(
        'fixed z-[60] rounded-xl border border-white/10 bg-popover p-1 text-popover-foreground shadow-2xl',
        'animate-in fade-in-0 zoom-in-95 duration-100',
      )}
    >
      {/* 面包屑：整条支路都在这一行里，点左边的箭头退回上一级 */}
      {inSub && (
        <div className="mb-1 flex items-center gap-1 border-b border-border pb-1">
          <button
            type="button"
            aria-label="返回上一级"
            onClick={() => setPath(keys.slice(0, -1))}
            className="shrink-0 rounded-lg p-1 text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {trail.map((t) => t.label).join(' › ')}
          </p>
        </div>
      )}

      {/* 页面多的时候限高内部滚，别让菜单顶出屏幕；换级时重挂一次，做出推进去的手感 */}
      <div
        key={keys.join('/')}
        className="thin-scroll animate-in fade-in-0 slide-in-from-right-2 duration-150 max-h-[min(58vh,420px)] overflow-y-auto"
      >
        {list.map(row)}
      </div>

      {!inSub && extra && (
        <div className="mt-1 border-t border-border pt-1">{extra}</div>
      )}
    </div>,
    document.body,
  );
}
