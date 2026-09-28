// iOS 风格的侧边导航：一条悬浮的毛玻璃胶囊。
//
// 交互约定（和磁贴那套保持一致）：
//   · 默认折叠，只露一级分组图标；点头像或底部箭头展开后才出现二级页面；
//   · 行尾不摆「···」按钮，重命名 / 换图标 / 排序 / 删除全收进长按或右键菜单；
//   · 折叠状态记在 config.sidebarCollapsed（storage.sync，一个布尔不会撑爆 8KB）。
import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';

import EmojiGrid from '@/components/nav/EmojiGrid';
import ContextMenu, { type MenuItem } from '@/components/ui/context-menu';
import {
  addGroup,
  addPage,
  removeGroup,
  removePage,
  reorderPage,
  setActiveGroup,
  setActivePage,
  updateGroup,
  updatePage,
} from '@/lib/nav';
import type { NavState } from '@/lib/types';
import { cn } from '@/lib/utils';

type Level = 'group' | 'page';

interface Target {
  level: Level;
  id: string;
  title: string;
}

interface MenuState extends Target {
  x: number;
  y: number;
}

interface Props {
  nav: NavState;
  update: (fn: (prev: NavState) => NavState) => void;
  /** true = 折叠，只显示一级分组图标 */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenSettings: () => void;
  /** 头像里显示的字，取用户名首字母 */
  initial?: string;
}

/** 分组题头：小字号 + 字距，模仿系统设置里的那种 section caption */
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="shrink-0 truncate px-4 pt-4 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-white/35">
      {children}
    </p>
  );
}

export default function Sidebar({
  nav,
  update,
  collapsed,
  onToggleCollapsed,
  onOpenSettings,
  initial = 'U',
}: Props) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editing, setEditing] = useState<{
    level: Level;
    id: string;
    value: string;
  } | null>(null);

  const timer = useRef<number | null>(null);
  /** 长按已经呼出菜单了，紧随其后的那次 click 要作废 */
  const blocked = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  /* ---------- 长按 / 右键 ---------- */

  const press = (target: Target) => ({
    onPointerDown: (e: React.PointerEvent) => {
      blocked.current = false;
      clearTimer();
      if (e.button !== 0) return;
      const { clientX: x, clientY: y } = e;
      timer.current = window.setTimeout(() => {
        blocked.current = true;
        setMenu({ ...target, x, y });
      }, 480);
    },
    onPointerUp: clearTimer,
    onPointerLeave: clearTimer,
    onPointerCancel: clearTimer,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      clearTimer();
      setMenu({ ...target, x: e.clientX, y: e.clientY });
    },
  });

  const swallow = () => {
    if (!blocked.current) return false;
    blocked.current = false;
    return true;
  };

  const group =
    nav.groups.find((g) => g.id === nav.activeGroupId) ?? nav.groups[0];
  if (!group) return null;

  const activePageId =
    nav.activePageByGroup[group.id] ?? group.pages[0]?.id ?? '';

  /* ---------- 重命名 ---------- */

  const commit = () => {
    if (!editing) return;
    const title = editing.value.trim();
    const { level, id } = editing;
    if (title) {
      update((n) =>
        level === 'group'
          ? updateGroup(n, id, { title })
          : updatePage(n, group.id, id, { title }),
      );
    }
    setEditing(null);
  };

  const onEditKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(null);
  };

  /* ---------- 操作列表 ---------- */

  const menuItems = (m: MenuState): MenuItem[] => {
    const rename: MenuItem = {
      id: 'rename',
      label: '重命名',
      icon: <Pencil className="size-4" />,
      onSelect: () => setEditing({ level: m.level, id: m.id, value: m.title }),
    };
    const remove: MenuItem = {
      id: 'remove',
      label: m.level === 'group' ? '删除分组' : '删除页面',
      danger: true,
      separatorBefore: true,
      icon: <Trash2 className="size-4" />,
      onSelect: () =>
        update((n) =>
          m.level === 'group' ? removeGroup(n, m.id) : removePage(n, group.id, m.id),
        ),
    };

    if (m.level === 'group') return [rename, remove];

    return [
      rename,
      {
        id: 'up',
        label: '上移',
        icon: <ArrowUp className="size-4" />,
        onSelect: () => update((n) => reorderPage(n, group.id, m.id, -1)),
      },
      {
        id: 'down',
        label: '下移',
        icon: <ArrowDown className="size-4" />,
        onSelect: () => update((n) => reorderPage(n, group.id, m.id, 1)),
      },
      remove,
    ];
  };

  /** 菜单底部直接摆一排 emoji，省一层弹窗 */
  const iconPicker = (m: MenuState) => {
    if (m.level === 'group') {
      const g = nav.groups.find((x) => x.id === m.id);
      if (!g) return null;
      return (
        <EmojiGrid
          value={g.icon}
          onPick={(icon) => update((n) => updateGroup(n, g.id, { icon }))}
        />
      );
    }
    const p = group.pages.find((x) => x.id === m.id);
    if (!p) return null;
    return (
      <EmojiGrid
        value={p.icon}
        onPick={(icon) => update((n) => updatePage(n, group.id, p.id, { icon }))}
      />
    );
  };

  /* ---------- 行 ---------- */

  /** 折叠态：纯图标方块 */
  const iconRow = (level: Level, id: string, title: string, icon: string, active: boolean) => {
    if (editing && editing.level === level && editing.id === id) {
      return (
        <input
          key={id}
          autoFocus
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={commit}
          onKeyDown={onEditKey}
          className="size-11 shrink-0 rounded-[14px] bg-white/20 text-center text-[11px] text-white ring-1 ring-white/25 outline-hidden"
        />
      );
    }
    return (
      <button
        key={id}
        type="button"
        title={title}
        {...press({ level, id, title })}
        onClick={() => {
          if (swallow()) return;
          update((n) =>
            level === 'group'
              ? setActiveGroup(n, id)
              : setActivePage(n, group.id, id),
          );
        }}
        onDoubleClick={() => setEditing({ level, id, value: title })}
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-[14px] text-[19px] leading-none',
          'transition-all duration-200 ease-ios active:scale-95',
          active
            ? 'bg-white/20 text-white ring-1 ring-white/15'
            : 'text-white/70 hover:bg-white/10',
        )}
      >
        {icon}
      </button>
    );
  };

  /** 展开态：药丸行，图标 + 标题 */
  const pillRow = (
    level: Level,
    id: string,
    title: string,
    icon: string,
    active: boolean,
    trailing?: React.ReactNode,
  ) => {
    if (editing && editing.level === level && editing.id === id) {
      return (
        <input
          key={id}
          autoFocus
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={commit}
          onKeyDown={onEditKey}
          className="h-9 w-full shrink-0 rounded-full bg-white/20 px-3 text-[13px] text-white ring-1 ring-white/25 outline-hidden"
        />
      );
    }
    return (
      <button
        key={id}
        type="button"
        {...press({ level, id, title })}
        onClick={() => {
          if (swallow()) return;
          update((n) =>
            level === 'group'
              ? setActiveGroup(n, id)
              : setActivePage(n, group.id, id),
          );
        }}
        onDoubleClick={() => setEditing({ level, id, value: title })}
        className={cn(
          'flex h-9 w-full shrink-0 items-center gap-2.5 rounded-full py-0 pr-2.5 pl-1.5 text-left',
          'transition-colors duration-200 ease-ios',
          active
            ? 'bg-white/[0.18] text-white'
            : 'text-white/65 hover:bg-white/[0.08] hover:text-white',
        )}
      >
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-[9px] text-[15px] leading-none',
            level === 'group' ? 'bg-white/10' : 'bg-transparent text-[13px]',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {title}
        </span>
        {trailing}
      </button>
    );
  };

  const addRow = (label: string, onClick: () => void) =>
    collapsed ? (
      <button
        type="button"
        title={label}
        onClick={onClick}
        className="grid size-11 shrink-0 place-items-center rounded-[14px] text-white/45 transition-colors hover:bg-white/10 hover:text-white/85"
      >
        <Plus className="size-4" />
      </button>
    ) : (
      <button
        type="button"
        onClick={onClick}
        className="flex h-9 w-full shrink-0 items-center gap-2.5 rounded-full py-0 pr-2.5 pl-1.5 text-left text-[13px] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-[9px] border border-dashed border-white/20">
          <Plus className="size-3.5" />
        </span>
        <span className="truncate">{label}</span>
      </button>
    );

  const ghostBtn =
    'grid size-8 shrink-0 place-items-center rounded-full text-white/55 transition-colors duration-200 ease-ios hover:bg-white/12 hover:text-white active:scale-95';

  return (
    <aside className="flex h-full shrink-0 p-3">
      <div
        className={cn(
          'flex w-[68px] shrink-0 flex-col overflow-hidden rounded-[28px]',
          'border border-white/10 bg-black/30 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl',
          'transition-[width] duration-[420ms] ease-ios',
          !collapsed && 'w-[232px]',
        )}
      >
        {/* 头部：头像就是展开 / 收起开关 */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-2.5 px-3 pt-3.5 pb-3',
            collapsed && 'justify-center',
          )}
        >
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? '展开侧栏' : '收起侧栏'}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/[0.12] text-[13px] font-semibold text-white/90 ring-1 ring-white/15 transition-transform duration-200 ease-ios hover:bg-white/20 active:scale-95"
          >
            {initial}
          </button>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                导航
              </p>
              <p className="truncate text-[11px] text-white/40">
                {nav.groups.length} 个分组
              </p>
            </div>
          )}
        </div>

        <div className="mx-3 h-px shrink-0 bg-white/10" />

        <nav className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-2 pb-2">
          {collapsed ? (
            <div className="flex flex-1 flex-col items-center gap-1 py-2">
              {nav.groups.map((g) =>
                iconRow('group', g.id, g.title, g.icon, g.id === group.id),
              )}
              {addRow('新建分组', () => update((n) => addGroup(n)))}
            </div>
          ) : (
            <>
              <Caption>分组</Caption>
              {nav.groups.map((g) =>
                pillRow(
                  'group',
                  g.id,
                  g.title,
                  g.icon,
                  g.id === group.id,
                  g.id === group.id ? (
                    <ChevronRight className="size-3.5 shrink-0 text-white/30" />
                  ) : undefined,
                ),
              )}
              {addRow('新建分组', () => update((n) => addGroup(n)))}

              <Caption>{group.title}</Caption>
              {group.pages.map((p) =>
                pillRow('page', p.id, p.title, p.icon, p.id === activePageId, p.tiles.length > 0 && (
                  <span className="shrink-0 text-[11px] tabular-nums text-white/30">
                    {p.tiles.length}
                  </span>
                )),
              )}
              {addRow('新建页面', () => update((n) => addPage(n, group.id)))}
            </>
          )}
        </nav>

        <div className="mx-3 h-px shrink-0 bg-white/10" />

        {/* 底部：齿轮 + 折叠箭头 */}
        <div
          className={cn(
            'flex shrink-0 items-center py-2.5',
            collapsed ? 'flex-col gap-1 px-2' : 'justify-between px-3',
          )}
        >
          <button
            type="button"
            title="设置"
            onClick={onOpenSettings}
            className={ghostBtn}
          >
            <Settings className="size-4" />
          </button>
          <button
            type="button"
            title={collapsed ? '展开侧栏' : '收起侧栏'}
            onClick={onToggleCollapsed}
            className={ghostBtn}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        </div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu)}
          extra={iconPicker(menu)}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  );
}