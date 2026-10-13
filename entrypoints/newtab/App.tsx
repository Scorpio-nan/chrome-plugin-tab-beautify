// 新标签页主应用：壁纸层 + 遮罩 + 侧边栏 + 搜索框 + 磁贴网格 + 浮层。
//
// 布局与交互要点（对齐图稿）：
//   · 主内容区只有当前页，超出高度走竖向滚动；滚到边界继续滚才翻到相邻页；
//   · 侧栏支持常驻 / 滚动收起 / 隐藏三种可见性，也能换到屏幕右侧；
//   · 浏览器默认右键菜单在整页屏蔽，内容区空白处换成自己的操作列表（见 pageMenu）；
//   · 磁贴表面不摆操作按钮，操作全在右键菜单里（见 TileGrid）；
//   · 「编辑主页」是页面级编辑模式：图标抖动 + 右上角 ×，跟 iOS 长按主屏一致；
//   · 设置是左下角齿轮点开的浮层，不是全屏抽屉。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  LayoutGrid,
  Pencil, 
  Plus,
  Search,
  Settings,
  Shuffle,
  Sparkles,
} from 'lucide-react';

import AddTileDrawer from '@/components/drawer/AddTileDrawer';
import BatchPanel from '@/components/BatchPanel';
import BottomBar from '@/components/BottomBar';
import ContextMenu, { type MenuItem } from '@/components/ui/context-menu';
import IconSearch from '@/components/IconSearch';
import SearchBar from '@/components/SearchBar';
import {
  SearchStyleLayer,
  requestSearchStyle,
} from '@/components/settings/SearchStylePopover';
import SettingsPanel from '@/components/settings/SettingsPanel';
import Sidebar from '@/components/nav/Sidebar';
import TileGrid, { type DropSide } from '@/components/grid/TileGrid';
import WallpaperLayer from '@/components/WallpaperLayer';
import {
  addChildToFolder,
  autoArrange,
  collectIconKeys,
  currentPage,
  findTile,
  foldIntoFolder,
  listLinkIcons,
  listPages,
  moveTilesToPage,
  moveTile,
  moveTileToPage,
  releaseFolder,
  removeTiles,
  removeTile,
  reorderChild,
  setActivePage,
  upsertTile,
} from '@/lib/nav';
import { pruneIcons } from '@/lib/icon-store';
import { uid } from '@/lib/storage';
import { useConfig, useNav, useTheme } from '@/lib/hooks';
import { cn, isEditableTarget } from '@/lib/utils';
import type { BackgroundStyle, LinkTile, Tile, WidgetSize } from '@/lib/types';
import {
  downloadWallpaper,
  nextRotateWallpaper,
  pushRecentWallpaper,
  randomPresetWallpaper,
  wallpaperLabel,
} from '@/lib/wallpaper';

interface DrawerState {
  open: boolean;
  editing: Tile | null;
  /** 新建时默认停的类型；编辑时以 editing 为准 */
  createKind: 'link' | 'folder' | 'widget';
  focus: 'content' | 'icon';
}

const CLOSED: DrawerState = {
  open: false,
  editing: null,
  createKind: 'link',
  focus: 'content',
};

/** 底部那条一次性提示，带时间戳保证同样一句话也能重新弹出来 */
interface Note {
  text: string;
  at: number;
}

export default function App() {
  const { config, update } = useConfig();
  useTheme(config);
  const { nav, update: updateNav, ready } = useNav();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(CLOSED);
  /** 页面级「编辑主页」模式 */
  const [homeEdit, setHomeEdit] = useState(false);
  const [iconSearch, setIconSearch] = useState(false);
  /** 批量操作面板（底部栏 / 右键菜单进入） */
  const [batchOpen, setBatchOpen] = useState(false);
  /** 内容区空白处右键弹的菜单 */
  const [pageMenu, setPageMenu] = useState<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  /** 侧栏「滚动时收起」用到的瞬时状态 */
  const [scrollBusy, setScrollBusy] = useState(false);
  /** 鼠标停在侧栏（或屏幕边缘热区）上 */
  const [peek, setPeek] = useState(false);
  const busyTimer = useRef(0);

  /*
   * 侧栏可见性（设置 → 控制栏 → 侧边栏）三种模式：
   *   always 常驻，参与布局宽度；
   *   scroll 默认藏到屏幕外，滚动时收起、鼠标贴边或悬停时探出；
   *   hidden 完全不显示，设置入口改挂到内容区右键菜单里。
   */
  const sidebarInFlow = config.sidebarVisibility === 'always';
  const sidebarRight = config.sidebarSide === 'right';
  const sidebarTucked =
    config.sidebarVisibility === 'scroll' &&
    !peek &&
    (scrollBusy || settingsOpen);

  /** 开始滚动：900ms 内没有新滚动就认为手停了，再把侧栏放回来 */
  const markScrolling = () => {
    setScrollBusy(true);
    window.clearTimeout(busyTimer.current);
    busyTimer.current = window.setTimeout(() => setScrollBusy(false), 900);
  };

  const show = useCallback(
    (text: string) => setNote({ text, at: Date.now() }),
    [],
  );

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 3200);
    return () => window.clearTimeout(t);
  }, [note]);

  /*
   * 整页接管右键：新标签页是"桌面"，浏览器那套「后退/查看网页源代码」只会碍事。
   * 唯一豁免是可编辑控件——输入框里的粘贴/全选得留着，否则没法往 URL、
   * 待办、备忘录里打字。磁贴和侧栏的自定义菜单各自 preventDefault + stopPropagation，
   * 事件不会冒泡到这里，互不干扰。
   */
  useEffect(() => {
    const block = (e: MouseEvent) => {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', block);
    return () => document.removeEventListener('contextmenu', block);
  }, []);

  /* 导航树一变就清理没人引用的上传图标，避免 storage.local 只增不减 */
  useEffect(() => {
    if (!ready || !nav) return;
    void pruneIcons(collectIconKeys(nav));
  }, [nav, ready]);

  const group =
    nav?.groups.find((g) => g.id === nav.activeGroupId) ?? nav?.groups[0];
  const pages = group?.pages ?? [];
  const activePageId = group
    ? (nav?.activePageByGroup[group.id] ?? pages[0]?.id ?? '')
    : '';
  const page = pages.find((p) => p.id === activePageId) ?? pages[0];

  /*
   * 设置浮层的贴靠位置：贴着侧栏右缘（侧栏在右边时贴左缘）。
   * 这些类名必须保持字面量，Tailwind 才会真的生成对应规则。
   */
  const settingsAnchorClass = sidebarInFlow
    ? sidebarRight
      ? config.sidebarCollapsed
        ? 'left-auto right-[96px]'
        : 'left-auto right-[260px]'
      : config.sidebarCollapsed
        ? 'left-[96px]'
        : 'left-[260px]'
    : sidebarRight
      ? 'left-auto right-[24px]'
      : 'left-[24px]';

  /*
   * 翻页手势：内容已经滚到边界还继续滚，攒够位移就翻到相邻页。
   * pageSensitivity 越大越灵敏（阈值越小），和设置里那条滑杆语义一致。
   */
  const scroller = useRef<HTMLDivElement | null>(null);
  /** 内容块：翻页动画直接改它的 transform，不走 state（wheel 事件太密，走 state 会掉帧） */
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pager = useRef({ delta: 0, at: 0, lock: 0, busy: false, y: 0 });

  const stillMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const setContentY = (y: number, ms: number) => {
    const el = contentRef.current;
    if (!el) return;
    // 没有动画且位置没变就别写样式：正常滚动时 wheel 事件很密，省掉这些无谓的重排
    if (ms === 0 && Math.abs(y - pager.current.y) < 0.5) return;
    pager.current.y = y;
    el.style.transition = ms
      ? `transform ${ms}ms cubic-bezier(.32,.72,0,1)`
      : 'none';
    el.style.transform = `translateY(${y.toFixed(1)}px)`;
  };

  const onContentWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    markScrolling();
    if (!config.scrollPaging || !group || pages.length < 2) return;
    if (pager.current.busy) return;
    const el = scroller.current;
    if (!el) return;

    const dir = e.deltaY < 0 ? -1 : 1;

    // 页里内容比屏幕长时，先在页内滚；滚到头再整页切换（Swiper 的 releaseOnEdges 行为）
    const canScrollInner =
      dir === 1
        ? el.scrollTop + el.clientHeight < el.scrollHeight - 1
        : el.scrollTop > 0;
    if (canScrollInner) {
      pager.current.delta = 0;
      setContentY(0, 140);
      return;
    }

    // 阈值触发：滚轮位移一直累计，够了才整页翻一次（Swiper 的 thresholdDelta 思路）
    const now = Date.now();
    // 停手超过 700ms 才清空累计：慢慢滚两格也要能翻，但不能把几分钟前的滚动算进来
    if (now - pager.current.at > 700) pager.current.delta = 0;
    pager.current.at = now;
    pager.current.delta += e.deltaY;

    // 灵敏度 1–100：越大阈值越小（默认 41 → 约 200px，约两格滚轮；
    // 拉到最右 ≈ 不到一格，拉到最左 ≈ 五格）
    const threshold = Math.max(80, 480 - config.pageSensitivity * 6.8);
    if (Math.abs(pager.current.delta) < threshold || now < pager.current.lock) {
      return;
    }
    pager.current.delta = 0;

    const to = pages.findIndex((p) => p.id === activePageId) + dir;
    if (to < 0 || to >= pages.length) {
      // 已经是第一页 / 最后一页：轻轻顶一下再弹回，告诉用户「到头了」
      setContentY(-dir * 16, 0);
      window.setTimeout(() => setContentY(0, 180), 0);
      return;
    }
    const next = pages[to];

    if (stillMotion()) {
      updateNav((n) => setActivePage(n, group.id, next.id));
      show(next.title);
      return;
    }

    const dist = Math.min(el.clientHeight || 420, 620);
    pager.current.busy = true;
    pager.current.lock = now + 360;

    // 整页滑动：旧页滑出（150ms）→ 换页 → 新页滑入（210ms），合成一次连贯的 360ms 切换
    setContentY(-dir * dist, 150);
    window.setTimeout(() => {
      updateNav((n) => setActivePage(n, group.id, next.id));
      scroller.current?.scrollTo({ top: 0 });
      setContentY(dir * dist, 0);
      window.requestAnimationFrame(() => {
        setContentY(0, 210);
        window.setTimeout(() => {
          pager.current.busy = false;
        }, 230);
      });
    }, 150);
    show(next.title);
  };

  /** 换页后回到顶部，别把上一页的滚动位置带过去；翻页动画进行中不要插手 */
  useEffect(() => {
    if (!pager.current.busy) setContentY(0, 0);
    scroller.current?.scrollTo({ top: 0 });
  }, [activePageId]);

  /** 「移动到」子菜单：全部分组下的所有页面 */
  const pageOptions = useMemo(() => (nav ? listPages(nav) : []), [nav]);
  /** 「搜索图标」数据源：含折叠在文件夹里的子图标 */
  const iconEntries = useMemo(() => (nav ? listLinkIcons(nav) : []), [nav]);

  const openDrawer = (patch: Partial<DrawerState>) =>
    setDrawer({ ...CLOSED, ...patch, open: true });

  /** 新建 / 编辑保存：一律落到当前激活页；想进分组就保存之后拖到文件夹上 */
  const saveTile = (tile: Tile) => {
    updateNav((n) => {
      const target = currentPage(n);
      if (!target) return n;
      return upsertTile(n, n.activeGroupId, target.id, tile);
    });
  };

  const removeChild = (folderId: string, childId: string) => {
    updateNav((n) => {
      const hit = findTile(n, folderId);
      if (!hit || hit.tile.type !== 'folder') return n;
      return upsertTile(n, hit.groupId, hit.pageId, {
        ...hit.tile,
        children: hit.tile.children.filter((c) => c.id !== childId),
      });
    });
  };

  const resizeTile = (tileId: string, size: WidgetSize) => {
    updateNav((n) => {
      const hit = findTile(n, tileId);
      if (!hit || hit.tile.type !== 'widget') return n;
      return upsertTile(n, hit.groupId, hit.pageId, { ...hit.tile, size });
    });
  };

  /** 跨页移动：图标 / 文件夹 / 小组件都走这条，落点永远在目标页末尾 */
  const moveTo = (tileId: string, groupId: string, targetPageId: string) => {
    updateNav((n) => moveTileToPage(n, tileId, groupId, targetPageId));
    const hit = pageOptions.find(
      (p) => p.groupId === groupId && p.pageId === targetPageId,
    );
    if (hit) show('已移动到「' + hit.groupTitle + ' · ' + hit.pageTitle + '」');
  };

  /** 释放文件夹：里面的图标摊回本页，文件夹消失 */
  const releaseTile = (tileId: string) => {
    const hit = nav ? findTile(nav, tileId) : null;
    const n = hit && hit.tile.type === 'folder' ? hit.tile.children.length : 0;
    updateNav((prev) => releaseFolder(prev, tileId));
    show(n > 0 ? '已释放 ' + n + ' 个图标到这一页' : '空文件夹已删除');
  };

  /**
   * 拖拽排序只在当前页内进行。
   * anchorId = 落点锚定的磁贴（null = 末尾），side 决定插到它前面还是后面。
   */
  const reorder = (
    dragId: string,
    anchorId: string | null,
    side: DropSide = 'before',
  ) => {
    if (!group || !page) return;
    updateNav((n) => moveTile(n, group.id, page.id, dragId, anchorId, side));
  };

  /** 文件夹浮层内的子图标排序 */
  const reorderFolderChild = (
    folderId: string,
    dragId: string,
    anchorId: string | null,
    side: DropSide = 'before',
  ) => {
    updateNav((n) => reorderChild(n, folderId, dragId, anchorId, side));
  };

  /**
   * 叠成分组：仿 iOS 把两个 App 叠成一摞，落到 targetId 原来的位置上。
   * 新分组的 id 必须在 updateNav 外面生成——dev 下 StrictMode 会把 reducer 跑两遍，
   * 在 reducer 里生成就会算出两个不同的 id。
   */
  const foldTiles = (sourceId: string, targetId: string) => {
    if (!group || !page) return null;
    const source = page.tiles.find((x) => x.id === sourceId);
    const target = page.tiles.find((x) => x.id === targetId);
    if (!source || source.type !== 'link') return null;
    if (!target || target.type !== 'link') return null;

    const folderId = uid();
    updateNav((n) =>
      foldIntoFolder(n, group.id, page.id, sourceId, targetId, folderId),
    );
    show('已把「' + source.title + '」和「' + target.title + '」叠成分组');
    return folderId;
  };

  /** 收进已有分组：把图标拖到文件夹上停一下 */
  const foldInto = (childId: string, folderId: string) => {
    const child = page?.tiles.find((x) => x.id === childId);
    const box = page?.tiles.find((x) => x.id === folderId);
    if (!child || child.type !== 'link') return null;
    if (!box || box.type !== 'folder') return null;

    updateNav((n) => addChildToFolder(n, folderId, childId));
    show('已把「' + child.title + '」收进「' + box.title + '」');
    return folderId;
  };

  /* ---------- 壁纸：随机 / 下载 ---------- */

  const applyWallpaper = (style: BackgroundStyle) => {
    update({ background: style });
    // 上传图（data URL）体积大，不进最近使用
    if (style.type !== 'image') void pushRecentWallpaper(style);
  };

  const randomWallpaper = () => {
    const next = randomPresetWallpaper(config.background);
    applyWallpaper(next);
    show('已换成系统壁纸「' + wallpaperLabel(next) + '」');
  };

  const downloadBg = async () => {
    show('正在导出当前壁纸…');
    try {
      const r = await downloadWallpaper(config.background, config.mediaBaseUrl);
      show(
        r.kind === 'snapshot'
          ? '已保存背景快照 ' + r.fileName
          : '已下载壁纸 ' + r.fileName,
      );
    } catch (e) {
      show(e instanceof Error ? e.message : '壁纸下载失败，请重试');
    }
  };

  /* 自动切换壁纸：开启后按间隔换一张，来源可选「系统精选」或「最近使用」 */
  useEffect(() => {
    if (!config.wallpaperRotate) return;
    const ms = Math.max(1, Math.round(config.wallpaperRotateMinutes)) * 60_000;
    const id = window.setInterval(() => {
      void nextRotateWallpaper(config.background, config.wallpaperRotateSource).then(
        (next) => {
          if (next) applyWallpaper(next);
        },
      );
    }, ms);
    return () => window.clearInterval(id);
  }, [
    config.wallpaperRotate,
    config.wallpaperRotateMinutes,
    config.wallpaperRotateSource,
    config.background,
  ]);

  /* ---------- 一键整理布局 / 批量操作 ---------- */

  const arrangeLayout = () => {
    if (!nav) return;
    const next = autoArrange(nav, config.layoutPriority);
    if (next === nav) {
      show('本页顺序已经整理好了');
      return;
    }
    updateNav(() => next);
    show(
      config.layoutPriority === 'size'
        ? '已按「大小优先」整理本页布局'
        : '已按「布局优先」整理本页布局',
    );
  };

  const batchRemove = (ids: string[]) => {
    updateNav((n) => removeTiles(n, ids));
    show('已删除 ' + ids.length + ' 个磁贴');
  };

  const batchMove = (ids: string[], groupId: string, pageId: string) => {
    if (!nav) return;
    const movable = ids.filter((id) => {
      const hit = findTile(nav, id);
      return hit && !(hit.groupId === groupId && hit.pageId === pageId);
    });
    updateNav((n) => moveTilesToPage(n, movable, groupId, pageId).nav);
    show('已移动 ' + movable.length + ' 个磁贴');
  };

  /* ---------- 内容区右键菜单 ---------- */

  const onPageContextMenu = (e: React.MouseEvent) => {
    // 小组件里的输入框、磁贴自己的菜单都会先拦下事件；这里再兜一层
    if (isEditableTarget(e.target)) return;
    setPageMenu({ x: e.clientX, y: e.clientY });
  };

  const pageMenuItems: MenuItem[] = [
    {
      id: 'add-icon',
      label: '添加图标',
      icon: <Plus className="size-4" />,
      onSelect: () => openDrawer({ createKind: 'link' }),
    },
    {
      id: 'add-widget',
      label: '添加小组件',
      icon: <LayoutGrid className="size-4" />,
      onSelect: () => openDrawer({ createKind: 'widget' }),
    },
    {
      id: 'random-bg',
      label: '随机壁纸',
      separatorBefore: true,
      icon: <Shuffle className="size-4" />,
      onSelect: randomWallpaper,
    },
    {
      id: 'download-bg',
      label: '下载壁纸',
      icon: <Download className="size-4" />,
      onSelect: () => void downloadBg(),
    },
    homeEdit
      ? {
          id: 'edit-home',
          label: '完成编辑',
          separatorBefore: true,
          icon: <Check className="size-4" />,
          onSelect: () => setHomeEdit(false),
        }
      : {
          id: 'edit-home',
          label: '编辑主页',
          separatorBefore: true,
          icon: <Pencil className="size-4" />,
          onSelect: () => setHomeEdit(true),
        },
    {
      id: 'search-icons',
      label: '搜索图标',
      icon: <Search className="size-4" />,
      onSelect: () => setIconSearch(true),
    },
    /* 底部栏与批量操作 */
    {
      id: 'arrange-layout',
      label:
        config.layoutPriority === 'size'
          ? '一键整理布局（大小优先）'
          : '一键整理布局（布局优先）',
      separatorBefore: true,
      icon: <Sparkles className="size-4" />,
      onSelect: arrangeLayout,
    },
    {
      id: 'batch',
      label: '批量操作',
      icon: <LayoutGrid className="size-4" />,
      onSelect: () => setBatchOpen(true),
    },
    {
      id: 'toggle-bottombar',
      label: config.showBottomBar ? '隐藏底部栏' : '显示底部栏',
      icon: <LayoutGrid className="size-4" />,
      onSelect: () => {
        update({ showBottomBar: !config.showBottomBar });
        show(config.showBottomBar ? '已隐藏底部栏' : '已显示底部栏');
      },
    },
    // 侧栏隐藏时页面上没有齿轮，设置入口只能挂在这份菜单里
    ...(config.sidebarVisibility === 'hidden'
      ? [
          {
            id: 'settings',
            label: '设置',
            separatorBefore: true,
            icon: <Settings className="size-4" />,
            onSelect: () => setSettingsOpen(true),
          },
        ]
      : []),
  ];

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <WallpaperLayer
        background={config.background}
        blur={config.blur}
        mediaBaseUrl={config.mediaBaseUrl}
      />
      {config.overlay > 0 && (
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(0, 0, 0, ' + config.overlay + ')' }}
        />
      )}

      <div
        className={cn(
          'relative z-10 flex h-full',
          sidebarRight && 'flex-row-reverse',
        )}
      >
        {nav && group && config.sidebarVisibility !== 'hidden' && (
          <div
            className={
              sidebarInFlow
                ? 'relative z-20'
                : cn(
                    'fixed inset-y-0 z-30 transition-[transform,opacity] duration-[420ms] ease-ios',
                    sidebarRight ? 'right-0' : 'left-0',
                    // 收起时整块滑出屏幕并让出点击，别挡内容区
                    sidebarTucked &&
                      (sidebarRight
                        ? 'pointer-events-none -translate-x-full opacity-0'
                        : 'pointer-events-none translate-x-full opacity-0'),
                  )
            }
            onPointerEnter={() => setPeek(true)}
            onPointerLeave={() => setPeek(false)}
          >
            <Sidebar
              nav={nav}
              update={updateNav}
              collapsed={config.sidebarCollapsed}
              onToggleCollapsed={() =>
                update({ sidebarCollapsed: !config.sidebarCollapsed })
              }
              onOpenSettings={() => setSettingsOpen(true)}
              initial={(config.userName || 'W').slice(0, 1).toUpperCase()}
            />
          </div>
        )}

        {/* scroll 模式下屏幕边缘留一条热区，鼠标贴边就能把侧栏召回来 */}
        {config.sidebarVisibility === 'scroll' && (
          <div
            className={cn('fixed inset-y-0 z-40 w-3', sidebarRight && 'right-0')}
            onPointerEnter={() => setPeek(true)}
            onPointerLeave={() => setPeek(false)}
          />
        )}

        <main
          className="flex min-w-0 flex-1 flex-col"
          onContextMenu={onPageContextMenu}
        >
          {/* 搜索框：上下间隔 90 + 90 = 180px；宽度/透明度右键「搜索框样式」实时调 */}
          <div className="flex shrink-0 justify-center px-6 pt-[90px] pb-[90px]">
            {config.showSearch && (
              <SearchBar
                config={config}
                icons={iconEntries}
                onEngineChange={(e) => update({ searchEngine: e })}
                onStyleRequest={requestSearchStyle}
              />
            )}
          </div>

          {/* 主内容区永远只有竖向滚动；滚到边界继续滚 = 翻页 */}
          <div
            ref={scroller}
            className="thin-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pb-10"
            onScroll={markScrolling}
            onWheel={onContentWheel}
          >
            <div
              ref={contentRef}
              className="mx-auto w-full"
              style={{
                maxWidth: config.lockMaxWidth
                  ? config.iconAreaWidth
                  : undefined,
              }}
            >
              {page && page.tiles.length === 0 && (
                <p className="pt-10 text-center text-sm text-white/50">
                  这一页还是空的：点下面的「+」，或在空白处右键选「添加图标」
                </p>
              )}
              {page && (
                <TileGrid
                  tiles={page.tiles}
                  config={config}
                  editMode={homeEdit}
                  pages={pageOptions}
                  activePageId={activePageId}
                  onEnterEditMode={() => setHomeEdit(true)}
                  onEditTile={(tile, focus = 'content') =>
                    openDrawer({ editing: tile, focus })
                  }
                  onRemoveTile={(id) => updateNav((n) => removeTile(n, id))}
                  onResizeTile={resizeTile}
                  onMoveTile={moveTo}
                  onReleaseTile={releaseTile}
                  onAddIcon={() => openDrawer({ createKind: 'link' })}
                  onRemoveChild={removeChild}
                  onReorder={reorder}
                  onReorderChild={reorderFolderChild}
                  onFoldTiles={foldTiles}
                  onFoldInto={foldInto}
                />
              )}
            </div>
          </div>

          {/* 底部控制栏：布局优先 / 大小优先 + 一键整理 + 两个快捷入口 */}
          {config.showBottomBar && (
            <BottomBar
              mode={config.layoutPriority}
              onModeChange={(m) => update({ layoutPriority: m })}
              onArrange={arrangeLayout}
              onAddIcon={() => openDrawer({ createKind: 'link' })}
              onAddWidget={() => openDrawer({ createKind: 'widget' })}
            />
          )}
        </main>
      </div>

      {pageMenu && (
        <ContextMenu
          x={pageMenu.x}
          y={pageMenu.y}
          items={pageMenuItems}
          onClose={() => setPageMenu(null)}
        />
      )}

      <AddTileDrawer
        open={drawer.open}
        onOpenChange={(open) => setDrawer((d) => ({ ...d, open }))}
        editing={drawer.editing}
        createKind={drawer.createKind}
        focus={drawer.focus}
        config={config}
        onSave={saveTile}
      />

      <IconSearch
        open={iconSearch}
        onOpenChange={setIconSearch}
        entries={iconEntries}
      />

      <BatchPanel
        open={batchOpen}
        onOpenChange={setBatchOpen}
        tiles={page?.tiles ?? []}
        pages={pageOptions}
        currentPageId={page?.id ?? ''}
        onRemove={batchRemove}
        onMove={batchMove}
      />

      {/* 设置浮层贴在侧栏一侧，别让胶囊被盖住 */}
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        defaultTab="wallpaper"
        className={settingsAnchorClass}
      />

      {/* 「搜索框样式」浮层：监听请求事件，挂在搜索框下方 */}
      <SearchStyleLayer />

      {/* 一次性提示：下载结果、移动落点、释放了多少图标 */}
      {note && (
        <div
          key={note.at}
          className="animate-in fade-in slide-in-from-bottom-2 fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-white/15 bg-popover/85 px-4 py-2 text-sm text-popover-foreground shadow-2xl backdrop-blur-md"
        >
          {note.text}
        </div>
      )}
    </div>
  );
}
