// 当前页的磁贴网格。除了排版，这里管四件事：
//   1. 拖拽排序（仿 iOS）：拖起来时原位留一个虚线空槽，指针停在哪个磁贴上就用一条
//      插入线标出落点（靠左半 = 插到它前面，靠右半 = 插到它后面），松手才真的换位；
//      换位后的位移用 FLIP 补间（lib/flip.ts），图标是互相「滑」开让路的。
//      跟手那张图是自己画的：先把浏览器默认的拖拽快照换成一张 1×1 透明图。
//   2. 叠成分组（仿 iOS 把两个 App 叠成一摞）：在另一个链接图标上停 500ms，进度环
//      走满后松手 = 两者合并成一个新的分组；停在文件夹上停 320ms = 直接收进那个分组。
//      小组件装不了图标，所以对它只有排序，进度环永远不会亮；文件夹浮层里的子图标
//      在 FolderTile 内部各排一次序，用的是同一套 FLIP。
//      三处投放提示（起点空槽、落点、末尾「+」）统一走 assets/global.css 的
//      drop-frame 虚线框；名称一律摆在图标方块下方，不进容器，免得看着被挤。
//   3. 右键菜单：磁贴表面不摆悬浮操作按钮，所有操作收进 ContextMenu，其中「移动到」
//      走 分组 → 页面 两级级联，不把全树铺平成一条长列表。
//   4. 编辑主页：页面级编辑模式（图标抖动 + 右上角 ×），模仿 iOS 长按主屏的手感。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  FolderInput,
  FolderOpen,
  Layers,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Trash2,
  Ungroup,
  X,
} from 'lucide-react';

import AddTiles from '@/components/grid/AddTiles';
import ContextMenu, { type MenuItem } from '@/components/ui/context-menu';
import FolderTile from '@/components/grid/FolderTile';
import LinkTile from '@/components/grid/LinkTile';
import TileIcon from '@/components/TileIcon';
import WidgetTile from '@/components/grid/WidgetTile';
import { gridClasses, metricsOf } from '@/components/grid/tileMetrics';
import { captureRects, playReflow, type FlipSnapshot } from '@/lib/flip';
import type { PageOption } from '@/lib/nav';
import type { Tile, UserConfig, WidgetSize } from '@/lib/types';
import { cn, isEditableTarget } from '@/lib/utils';
import { getWidget } from '@/widgets/registry';

const WIDGET_SPAN: Record<WidgetSize, string> = {
  sm: 'col-span-2 row-span-2',
  md: 'col-span-4 row-span-2',
  lg: 'col-span-4 row-span-4',
};

const FALLBACK_SIZES: WidgetSize[] = ['sm', 'md', 'lg'];

/**
 * 停在目标上多久算「要叠起来」。链接要合并成新分组，慢一点防误触；
 * 文件夹本来就等着被塞东西，快一点。
 */
const DWELL = { link: 500, folder: 320 } as const;

/** 落点：插到锚点前面还是后面（锚点为 null = 本页末尾） */
export type DropSide = 'before' | 'after';

/** 指针停在某个磁贴上的状态；ms 为 null 表示这个磁贴不能叠 */
interface Hold {
  id: string;
  ms: number;
  armed: boolean;
  /** 每次重新计时 +1，用来强制重启进度环那段 CSS 动画 */
  nonce: number;
}

interface Props {
  tiles: Tile[];
  config: UserConfig;
  /** 页面编辑模式：图标抖动、可点 × 移除，左键不再跳转 */
  editMode: boolean;
  /** 「移动到」候选页面（全部分组） */
  pages: PageOption[];
  /** 当前页 id，用于把「移动到」里的自己置灰 */
  activePageId: string;
  /** focus：content = 改名称/链接，icon = 只改图标 */
  onEditTile: (tile: Tile, focus?: 'content' | 'icon') => void;
  onRemoveTile: (tileId: string) => void;
  onResizeTile: (tileId: string, size: WidgetSize) => void;
  onMoveTile: (tileId: string, groupId: string, pageId: string) => void;
  /** 把折叠在文件夹里的图标摊回本页 */
  onReleaseTile: (tileId: string) => void;
  onEnterEditMode: () => void;
  onAddIcon: () => void;
  onRemoveChild: (folderId: string, childId: string) => void;
  /** 文件夹浮层里给子图标排序 */
  onReorderChild: (
    folderId: string,
    dragId: string,
    anchorId: string | null,
    side?: DropSide,
  ) => void;
  /** 排序：anchorId 为 null = 放到末尾 */
  onReorder: (dragId: string, anchorId: string | null, side?: DropSide) => void;
  /** 两个链接图标叠成新分组，返回新分组 id（给落点一个 pop 反馈） */
  onFoldTiles: (sourceId: string, targetId: string) => string | null;
  /** 把链接图标收进已有分组，返回该分组 id */
  onFoldInto: (childId: string, folderId: string) => string | null;
}

/**
 * 起点是不是小组件自己的可交互区域。
 *
 * 小组件里塞满了输入框、按钮和能滚的列表（待办、便签、书签…），
 * 从这些地方起手会被当成整块拖动，所以一律放行给控件本身。
 */
function isWidgetControl(el: HTMLElement, root: HTMLElement): boolean {
  const control = el.closest(
    'input, textarea, select, button, a[href], [contenteditable="true"]',
  );
  if (control && root.contains(control)) return true;

  for (let n: HTMLElement | null = el; n && n !== root; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
      return true;
    }
  }
  return false;
}

/** 1×1 透明画布：用它当拖拽快照，就能把浏览器那张默认缩略图换成自绘的「抬起」预览 */
let blankSnapshot: HTMLCanvasElement | null = null;
function blankDragImage() {
  if (!blankSnapshot) {
    blankSnapshot = document.createElement('canvas');
    blankSnapshot.width = 1;
    blankSnapshot.height = 1;
  }
  return blankSnapshot;
}

/** 磁贴的可读名字：小组件没有 title，取注册表里的 label */
function tileLabel(tile: Tile): string {
  return tile.type === 'widget'
    ? getWidget(tile.widget)?.label ?? tile.widget
    : tile.title;
}

export default function TileGrid({
  tiles,
  config,
  editMode,
  pages,
  activePageId,
  onEditTile,
  onRemoveTile,
  onResizeTile,
  onMoveTile,
  onReleaseTile,
  onEnterEditMode,
  onAddIcon,
  onRemoveChild,
  onReorderChild,
  onReorder,
  onFoldTiles,
  onFoldInto,
}: Props) {
  /* 图标尺寸 / 是否显示名称：整个网格和每块磁贴共用同一份度量 */
  const metrics = metricsOf(config.tileSize);
  const noLabel = config.hideTileLabel;
  const [dragId, setDragId] = useState<string | null>(null);
  /** 落点预览 */
  const [slot, setSlot] = useState<{ id: string; side: DropSide } | null>(null);
  /** 停留计时 / 是否可以叠 */
  const [hold, setHold] = useState<Hold | null>(null);
  /** 刚合并出来的分组：弹一下当作反馈 */
  const [popId, setPopId] = useState<string | null>(null);
  /** 指针是否在网格内：决定末尾那个「+」要不要亮成投放区 */
  const [overGrid, setOverGrid] = useState(false);
  const [menu, setMenu] = useState<{ tile: Tile; x: number; y: number } | null>(
    null,
  );

  const gridRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const rects = useRef<FlipSnapshot>(null);

  const armedId = hold?.armed ? hold.id : null;
  const dragged = dragId ? (tiles.find((t) => t.id === dragId) ?? null) : null;
  const target = armedId ? (tiles.find((t) => t.id === armedId) ?? null) : null;

  /* ---------- 落位补间（FLIP）：顺序一变，磁贴滑进新位置 ---------- */

  const order = tiles.map((t) => t.id).join('|');
  useLayoutEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    playReflow(root, rects.current);
    rects.current = captureRects(root);
  }, [order]);

  // 侧栏折叠、窗口缩放这类没改顺序的重排：只记新位置，不补间
  useEffect(() => {
    const root = gridRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      rects.current = captureRects(root);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!popId) return;
    const t = window.setTimeout(() => setPopId(null), 400);
    return () => window.clearTimeout(t);
  }, [popId]);

  /* ---------- 右键菜单：磁贴表面不摆操作按钮，操作全在这里 ---------- */

  const openMenu = (tile: Tile) => (e: React.MouseEvent) => {
    // 小组件内部的输入框保留浏览器原生右键（粘贴 / 全选），别抢它的菜单
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({ tile, x: e.clientX, y: e.clientY });
  };

  /**
   * 「移动到」的候选目标：先把铺平的全树按分组归堆（按首次出现的顺序），
   * 菜单里就能走 分组 → 页面 两级，而不是几十条页面拉成一条长列表。
   */
  const pageGroups = useMemo(() => {
    const out: {
      id: string;
      title: string;
      icon: string;
      pages: PageOption[];
    }[] = [];
    for (const p of pages) {
      let g = out.find((x) => x.id === p.groupId);
      if (!g) {
        g = { id: p.groupId, title: p.groupTitle, icon: p.groupIcon, pages: [] };
        out.push(g);
      }
      g.pages.push(p);
    }
    return out;
  }, [pages]);

  /** 三类磁贴通用的两块：进编辑模式 + 跨页移动 */
  const shared = (tile: Tile) => {
    const editHome: MenuItem = {
      id: 'edit-home',
      label: '编辑主页',
      icon: <Pencil className="size-4" />,
      separatorBefore: true,
      onSelect: onEnterEditMode,
    };
    /*
     * 两级级联：第一级只列分组，第二级列该分组下的页面。
     * 全树铺平的话十几条「分组 · 页面」会把菜单撑成一屏，也看不出层级。
     */
    const moveTo: MenuItem = {
      id: 'move-to',
      label: '移动到',
      icon: <FolderInput className="size-4" />,
      submenu: pageGroups.map<MenuItem>((g) => ({
        id: 'move-group-' + g.id,
        label: g.title,
        icon: (
          <span className="w-4 shrink-0 text-center text-[13px] leading-none">
            {g.icon}
          </span>
        ),
        hint: g.pages.length + ' 页',
        submenu: g.pages.map<MenuItem>((p) => {
          const here = p.pageId === activePageId;
          return {
            id: 'move-' + p.groupId + '-' + p.pageId,
            label: p.pageTitle,
            icon: (
              <span className="w-4 shrink-0 text-center text-[13px] leading-none">
                {p.pageIcon}
              </span>
            ),
            hint: here ? '当前' : String(p.count),
            disabled: here,
            onSelect: () => onMoveTile(tile.id, p.groupId, p.pageId),
          };
        }),
      })),
    };
    const remove: MenuItem = {
      id: 'remove',
      label: '删除',
      danger: true,
      separatorBefore: true,
      icon: <Trash2 className="size-4" />,
      onSelect: () => onRemoveTile(tile.id),
    };
    return { editHome, moveTo, remove };
  };
  const menuItems = (tile: Tile): MenuItem[] => {
    const { editHome, moveTo, remove } = shared(tile);

    if (tile.type === 'link') {
      return [
        {
          id: 'open-self',
          label: '当前页面打开',
          icon: <Layers className="size-4" />,
          onSelect: () => window.location.assign(tile.url),
        },
        {
          id: 'open-blank',
          label: '新页签打开',
          icon: <ExternalLink className="size-4" />,
          onSelect: () => window.open(tile.url, '_blank', 'noopener'),
        },
        editHome,
        {
          id: 'edit-icon',
          label: '编辑图标',
          icon: <Pencil className="size-4" />,
          onSelect: () => onEditTile(tile, 'content'),
        },
        moveTo,
        remove,
      ];
    }

    if (tile.type === 'folder') {
      const n = tile.children.length;
      return [
        {
          id: 'open-all',
          label: '全部打开' + (n ? '（' + n + '）' : ''),
          icon: <FolderOpen className="size-4" />,
          disabled: n === 0,
          onSelect: () =>
            tile.children.forEach((c) =>
              window.open(c.url, '_blank', 'noopener'),
            ),
        },
        {
          id: 'release',
          label: '释放' + (n ? '（' + n + ' 个图标）' : ''),
          icon: <Ungroup className="size-4" />,
          hint: n ? undefined : '空的',
          onSelect: () => onReleaseTile(tile.id),
        },
        editHome,
        {
          id: 'edit-icon',
          label: '编辑文件夹',
          icon: <Pencil className="size-4" />,
          onSelect: () => onEditTile(tile, 'content'),
        },
        moveTo,
        remove,
      ];
    }

    const sizes = getWidget(tile.widget)?.sizes ?? FALLBACK_SIZES;
    const at = Math.max(0, sizes.indexOf(tile.size));
    const smallest = at <= 0;
    const largest = at >= sizes.length - 1;
    return [
      {
        id: 'size-down',
        label: '小',
        icon: <Minimize2 className="size-4" />,
        disabled: smallest,
        hint: smallest ? '已是最小' : undefined,
        onSelect: () => onResizeTile(tile.id, sizes[at - 1]),
      },
      {
        id: 'size-up',
        label: '大',
        icon: <Maximize2 className="size-4" />,
        disabled: largest,
        hint: largest ? '已是最大' : undefined,
        onSelect: () => onResizeTile(tile.id, sizes[at + 1]),
      },
      editHome,
      moveTo,
      remove,
    ];
  };

  /* ---------- 拖拽：落点、停留合并、跟手预览 ---------- */

  /** 只有「链接 → 链接 / 文件夹」能叠：文件夹不能套文件夹，小组件装不了图标 */
  const stackable = (tile: Tile) =>
    !!dragged &&
    dragged.type === 'link' &&
    tile.id !== dragged.id &&
    (tile.type === 'link' || tile.type === 'folder');

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  /** 重新起表：停在这个磁贴上，ms 后武装；不能叠的磁贴直接把状态清掉 */
  const startHold = (tile: Tile) => {
    clearTimer();
    if (!stackable(tile)) {
      setHold(null);
      return;
    }
    const ms = tile.type === 'folder' ? DWELL.folder : DWELL.link;
    setHold((prev) => ({ id: tile.id, ms, armed: false, nonce: (prev?.nonce ?? 0) + 1 }));
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHold((h) => (h && h.id === tile.id ? { ...h, armed: true } : h));
      // 武装之后插入线就没意义了，只留合并的视觉
      setSlot(null);
    }, ms);
  };

  const dropState = () => {
    clearTimer();
    setHold(null);
    setSlot(null);
  };

  const endDrag = () => {
    dropState();
    setOverGrid(false);
    setDragId(null);
  };

  /** dragenter 会从子元素一路冒泡上来，只有「真的从外面进到这个磁贴」才重新计时 */
  const enteredFromOutside = (e: React.DragEvent) => {
    const from = e.relatedTarget as Node | null;
    return !from || !(e.currentTarget as HTMLElement).contains(from);
  };

  const movePreview = (x: number, y: number) => {
    const el = previewRef.current;
    if (el) el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
  };

  const onTileDragStart = (tile: Tile) => (e: React.DragEvent) => {
    const from = e.target as HTMLElement;
    // 从磁贴内部的控件（输入框、× 徽章…）起手时不启动排序
    if (from.closest('[data-no-drag]')) {
      e.preventDefault();
      return;
    }
    // 小组件整块都是能用的控件：在它自己的输入框 / 按钮 / 滚动列表上起手，
    // 意思是「操作组件」而不是「搬走组件」
    if (
      tile.type === 'widget' &&
      isWidgetControl(from, e.currentTarget as HTMLElement)
    ) {
      e.preventDefault();
      return;
    }
    setDragId(tile.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tile.id);
    e.dataTransfer.setDragImage(blankDragImage(), 0, 0);
  };

  const onTileDragEnter = (tile: Tile) => (e: React.DragEvent) => {
    if (!dragId) return;
    // 拖回自己那一格 = 取消：落点线和停留计时都得收掉，不然停在别处算出来的
    // 状态会一直挂着，松手明明回到了起点却把两个图标合了组
    if (tile.id === dragId) {
      if (slot || hold) dropState();
      return;
    }
    if (!enteredFromOutside(e)) return;
    startHold(tile);
  };

  const onTileDragOver = (tile: Tile) => (e: React.DragEvent) => {
    if (!dragId) return;
    // 先答应接收：磁贴（含起点那一格）不 preventDefault 就收不到 drop 事件
    e.preventDefault();
    movePreview(e.clientX, e.clientY);
    if (tile.id === dragId) return;
    if (hold?.armed && hold.id === tile.id) return;
    const r = e.currentTarget.getBoundingClientRect();
    const side: DropSide = e.clientX - r.left < r.width / 2 ? 'before' : 'after';
    if (!slot || slot.id !== tile.id || slot.side !== side) {
      setSlot({ id: tile.id, side });
      // 换了落点说明还在对位置，倒计数重新来一遍
      if (hold && hold.id === tile.id) startHold(tile);
    }
  };

  /** 整块网格都是投放区，松手时按「合并 → 落点 → 末尾」的优先级结算 */
  const onGridDrop = (e: React.DragEvent) => {
    if (!dragId) return;
    e.preventDefault();
    const sourceId = dragId;
    const armed = armedId;
    const at = slot;
    endDrag();

    const src = tiles.find((t) => t.id === sourceId);
    const tgt = armed ? tiles.find((t) => t.id === armed) : null;
    if (tgt && src && src.type === 'link' && tgt.type !== 'widget') {
      const id =
        tgt.type === 'folder'
          ? onFoldInto(src.id, tgt.id)
          : onFoldTiles(src.id, tgt.id);
      if (id) setPopId(id);
      return;
    }

    if (at && at.id !== sourceId) onReorder(sourceId, at.id, at.side);
    else if (!at) onReorder(sourceId, null);
  };

  /** 编辑模式下左键只留给 ×，其余一律吞掉：不跳转、不打开文件夹 */
  const swallowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-edit-remove]')) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const tileDragProps = (tile: Tile) => ({
    draggable: true,
    onDragStart: onTileDragStart(tile),
    onDragEnter: onTileDragEnter(tile),
    onDragOver: onTileDragOver(tile),
    /** 松手落在起点那一格上就是取消；不拦下来会冒到网格，被当成「放到末尾」 */
    onDrop:
      tile.id === dragId
        ? (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            endDrag();
          }
        : undefined,
  });

  return (
    <>
      <div
        ref={gridRef}
        className={cn('grid content-start gap-4', gridClasses(config))}
        onDragOver={(e) => {
          if (!dragId) return;
          // 整块网格都是投放区：空白处松手 = 放到末尾
          e.preventDefault();
          setOverGrid(true);
          movePreview(e.clientX, e.clientY);
        }}
        onDragLeave={(e) => {
          // 在磁贴之间穿行时 relatedTarget 还落在网格内，不算离开
          if (gridRef.current?.contains(e.relatedTarget as Node | null)) return;
          setOverGrid(false);
          dropState();
        }}
        onDragEnd={endDrag}
        onDrop={onGridDrop}
      >
        {tiles.map((tile) => {
          const isSource = dragId === tile.id;
          const isHold = hold?.id === tile.id;
          const isArmed = !!armedId && armedId === tile.id;
          // 合并环亮起来之后落点线就没意义了，两种提示互斥
          const slotSide = !isArmed && slot?.id === tile.id ? slot.side : null;

          return (
            <div
              key={tile.id}
              data-flip-id={tile.id}
              {...tileDragProps(tile)}
              onContextMenu={openMenu(tile)}
              onClickCapture={editMode ? swallowClick : undefined}
              className={cn(
                'relative rounded-2xl',
                'transition-[scale,opacity,box-shadow] duration-200 ease-ios',
                tile.type === 'folder' && 'col-span-2 row-span-2',
                tile.type === 'widget' && WIDGET_SPAN[tile.size],
                editMode && 'editing-tile',
                // 被拖走的那格不清空，留作「松手回原位」的落点
                isSource && 'opacity-30',
                isArmed && 'scale-[1.06]',
                !!slotSide && 'scale-[1.03]',
                // 别的磁贴稍微压暗，让指针底下的那块成为焦点
                dragId && !isSource && !isHold && 'opacity-70',
                popId === tile.id && 'animate-in zoom-in-75 duration-300 ease-out',
              )}
            >
              {tile.type === 'link' && (
                <LinkTile
                  tile={tile}
                  metrics={metrics}
                  hideLabel={noLabel}
                  openMode={config.tileOpenMode}
                />
              )}
              {tile.type === 'folder' && (
                <FolderTile
                  tile={tile}
                  metrics={metrics}
                  hideLabel={noLabel}
                  openMode={config.tileOpenMode}
                  onRemoveChild={onRemoveChild}
                  onReorderChild={onReorderChild}
                />
              )}
              {tile.type === 'widget' && <WidgetTile tile={tile} config={config} />}

              {editMode && (
                <button
                  type="button"
                  title="从这一页移除"
                  data-edit-remove
                  data-no-drag
                  onClick={() => onRemoveTile(tile.id)}
                  className="absolute -right-1 -top-1 z-10 grid size-5 place-items-center rounded-full bg-black/70 text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-destructive"
                >
                  <X className="size-3" />
                </button>
              )}

              {/* 起点：虚线空槽，告诉用户「松手在这儿就回原位」 */}
              {isSource && (
                <span className="drop-frame pointer-events-none absolute inset-0 rounded-2xl text-white" />
              )}

              {/* 落点指示线：靠左半插到前面，靠右半插到后面 */}
              {slotSide && (
                <span
                  className={cn(
                    'wetab-slot wetab-slot-x pointer-events-none absolute w-[6px]',
                    // 只盖住图标方块，别把下方名称那一格也算进去
                    tile.type === 'widget'
                      ? 'top-1.5 bottom-1.5'
                      : noLabel
                        ? metrics.slotNoLabel
                        : metrics.slot,
                    'rounded-[3px] border border-dashed border-white/60 bg-white/25 text-white',
                    slotSide === 'before' ? '-left-2' : '-right-2',
                  )}
                />
              )}

              {/* 停留计时：一圈虚线 + 框内逐渐填满，填满 = 再松手就叠起来 */}
              {isHold && hold && (
                <svg
                  key={hold.nonce}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                  style={
                    { '--wetab-dwell': hold.ms + 'ms' } as React.CSSProperties
                  }
                  className="pointer-events-none absolute -inset-1"
                >
                  <rect
                    x={1}
                    y={1}
                    width={98}
                    height={98}
                    rx={14}
                    data-armed={isArmed ? 'true' : 'false'}
                    className="wetab-dwell-ring"
                  />
                </svg>
              )}

              {/* 武装状态：只留文字提示，虚线本身已经提亮了，不再叠第二层框 */}
              {isArmed && (
                <span className="tile-label pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-black/75 px-2 py-0.5 text-[11px] text-white shadow-lg backdrop-blur-sm">
                  {tile.type === 'folder'
                    ? '松手收进「' + tile.title + '」'
                    : '松手合并成分组'}
                </span>
              )}
            </div>
          );
        })}

        {!config.hideAddTile && (
          <AddTiles
            onAddIcon={onAddIcon}
            metrics={metrics}
            dragging={dragId !== null}
            active={dragId !== null && overGrid && !slot && !hold}
            onDragEnter={dropState}
          />
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.tile)}
          onClose={() => setMenu(null)}
        />
      )}

      {/* 跟手的「抬起」预览：浏览器默认那张拖拽快照已经被换成 1×1 透明图 */}
      {dragged && (
        <div
          ref={previewRef}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[90] will-change-transform"
          style={{ transform: 'translate3d(-9999px,-9999px,0)' }}
        >
          <div
            className={cn(
              'relative -translate-x-1/2 -translate-y-1/2 rounded-2xl',
              'border border-white/20 bg-black/55 p-2 shadow-2xl backdrop-blur-md',
              // Tailwind v4 的 scale / rotate 是独立属性，别写 transition-transform
              'transition-[scale,rotate] duration-200 ease-ios',
              // 停到位就摆正、缩回原尺寸，表示「现在松手是合并，不是换位」
              armedId ? 'scale-100' : 'rotate-[-4deg] scale-110',
            )}
          >
            {dragged.type === 'link' && (
              <div className={cn('flex flex-col items-center gap-1.5', metrics.preview)}>
                <span className={cn('grid place-items-center overflow-hidden rounded-2xl', metrics.previewIcon)}>
                  <TileIcon
                    icon={dragged.icon}
                    title={dragged.title}
                    url={dragged.url}
                    className="rounded-2xl"
                    glyphClass="text-2xl"
                  />
                </span>
                {!noLabel && (
                  <span className="tile-label line-clamp-1 w-full text-[11px] leading-tight text-white/90">
                    {dragged.title}
                  </span>
                )}
              </div>
            )}

            {dragged.type === 'folder' && (
              <div className={cn('flex flex-col items-center gap-1.5', metrics.previewFolder)}>
                <span className="grid aspect-square w-full grid-cols-2 grid-rows-2 gap-2 rounded-2xl bg-black/45 p-3">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const child = dragged.children[i];
                    return (
                      <span
                        key={child?.id ?? i}
                        className="grid min-h-0 place-items-center overflow-hidden rounded-xl"
                      >
                        {child ? (
                          <TileIcon
                            icon={child.icon}
                            title={child.title}
                            url={child.url}
                            className="rounded-xl"
                            glyphClass="text-base"
                          />
                        ) : (
                          <span className="size-full rounded-xl bg-white/10" />
                        )}
                      </span>
                    );
                  })}
                </span>
                {!noLabel && (
                  <span className="tile-label line-clamp-1 w-full text-[11px] leading-tight text-white/90">
                    {dragged.title}
                  </span>
                )}
              </div>
            )}

            {dragged.type === 'widget' && (
              <span className="flex items-center gap-1.5 px-1 py-1.5 text-xs text-white/90">
                <span className="grid size-7 place-items-center rounded-lg bg-white/12 text-sm">
                  {getWidget(dragged.widget)?.icon ?? '🧩'}
                </span>
                {tileLabel(dragged)}
              </span>
            )}

            {armedId && (
              <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-white text-black shadow">
                <Plus className="size-3.5" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* 拖拽期间常驻的一行提示，别让用户猜松手会发生什么 */}
      {dragged && (
        <div className="animate-in fade-in fixed bottom-6 left-1/2 z-[75] -translate-x-1/2 rounded-full border border-white/15 bg-popover/85 px-3.5 py-1.5 text-xs text-popover-foreground shadow-xl backdrop-blur-md duration-200">
          {target
            ? target.type === 'folder'
              ? '松手把「' + tileLabel(dragged) + '」收进「' + target.title + '」'
              : '松手把这两个图标合并成分组'
            : dragged.type === 'widget'
              ? `松手换位（小组件不能叠成分组）`
              : '松手换位；在图标上停一下即可叠成分组'}
        </div>
      )}
    </>
  );
}