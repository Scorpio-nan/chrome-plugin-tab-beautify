// 导航树（分组 / 页面 / 磁贴）的读写与纯函数编辑。
//
// 存 storage.local 的 `nav`，不放 sync：sync 单条目上限 8KB，
// 而一个页面塞几十个图标就会超，用户上传的图标更是必然超。
import { browser } from 'wxt/browser';
import {
  type FolderTile,
  type IconSpec,
  type LinkTile,
  type NavGroup,
  type NavPage,
  type NavState,
  type Tile,
  type WidgetId,
  type WidgetSize,
  type WidgetTile,
} from './types';
import { uid } from './storage';

const NAV_KEY = 'nav';

/* ---------- 构造小工具（写默认数据时用） ---------- */

const online: IconSpec = { kind: 'online' };

export function link(title: string, url: string, badge?: string): LinkTile {
  return { id: uid(), type: 'link', title, url, icon: online, badge };
}

export function folder(title: string, children: LinkTile[]): FolderTile {
  return { id: uid(), type: 'folder', title, children };
}

export function widgetTile(
  widget: WidgetId,
  size: WidgetSize = 'md',
  props?: Record<string, unknown>,
): WidgetTile {
  return { id: uid(), type: 'widget', widget, size, props };
}

function page(title: string, icon: string, tiles: Tile[]): NavPage {
  return { id: uid(), title, icon, tiles };
}

/* ---------- 默认数据 ---------- */

function defaultNav(): NavState {
  const 常用 = {
    id: uid(),
    title: '常用',
    icon: '🏠',
    pages: [
      page('主页', '🏠', [
        folder('AI工具', [
          link('DeepSeek', 'https://chat.deepseek.com'),
          link('Claude', 'https://claude.ai'),
          link('ChatGPT', 'https://chatgpt.com'),
          link('通义千问', 'https://tongyi.aliyun.com'),
        ]),
        link('GitHub', 'https://github.com'),
        link('npm', 'https://www.npmjs.com'),
        link('MDN', 'https://developer.mozilla.org/zh-CN/'),
        link('哔哩哔哩', 'https://www.bilibili.com'),
        link('知乎', 'https://www.zhihu.com'),
        link('百度翻译', 'https://fanyi.baidu.com'),
        link('和风天气', 'https://www.qweather.com'),
        link('Docker Hub', 'https://hub.docker.com'),
        widgetTile('clock', 'sm'),
        widgetTile('weather', 'sm'),
      ]),
      page('在线工具', '🧰', [
        link('百度翻译', 'https://fanyi.baidu.com'),
        link('DeepL 翻译', 'https://www.deepl.com/translator'),
        link('TinyPNG', 'https://tinypng.com'),
        link('Excalidraw', 'https://excalidraw.com'),
        link('Regex101', 'https://regex101.com'),
        link('Carbon', 'https://carbon.now.sh'),
      ]),
      page('研发工具', '⚙️', [
        link('GitHub', 'https://github.com'),
        link('Gitee', 'https://gitee.com'),
        link('npm', 'https://www.npmjs.com'),
        link('MDN', 'https://developer.mozilla.org/zh-CN/'),
        link('Stack Overflow', 'https://stackoverflow.com'),
        link('Can I use', 'https://caniuse.com'),
        link('Vercel', 'https://vercel.com'),
        link('Docker Hub', 'https://hub.docker.com'),
      ]),
      page('实用工具', '🧭', [
        link('和风天气', 'https://www.qweather.com'),
        link('中国天气网', 'https://www.weather.com.cn'),
        link('快递100', 'https://www.kuaidi100.com'),
        link('12306', 'https://www.12306.cn'),
        link('高德地图', 'https://www.amap.com'),
      ]),
      page('影音', '🎬', [
        link('哔哩哔哩', 'https://www.bilibili.com'),
        link('腾讯视频', 'https://v.qq.com'),
        link('爱奇艺', 'https://www.iqiyi.com'),
        link('网易云音乐', 'https://music.163.com'),
        link('YouTube', 'https://www.youtube.com'),
      ]),
      page('面试题', '📄', [
        link('牛客网', 'https://www.nowcoder.com'),
        link('LeetCode', 'https://leetcode.cn'),
        link('掘金', 'https://juejin.cn'),
        link('SegmentFault', 'https://segmentfault.com'),
        link('Stack Overflow', 'https://stackoverflow.com'),
      ]),
      page('文档', '📚', [
        link('MDN', 'https://developer.mozilla.org/zh-CN/'),
        link('菜鸟教程', 'https://www.runoob.com'),
        link('ES6 入门教程', 'https://es6.ruanyifeng.com'),
        link('TypeScript 手册', 'https://www.typescriptlang.org/docs/'),
        link('React 文档', 'https://react.dev'),
        link('Tailwind CSS', 'https://tailwindcss.com/docs'),
        link('Vue 文档', 'https://cn.vuejs.org'),
      ]),
      page('github', '🐙', [
        link('GitHub', 'https://github.com'),
        link('GitHub Trending', 'https://github.com/trending'),
        link('GitHub Explore', 'https://github.com/explore'),
        link('Gist', 'https://gist.github.com'),
      ]),
      page('实用网站', '🌐', [
        link('知乎', 'https://www.zhihu.com'),
        link('少数派', 'https://sspai.com'),
        link('豆瓣', 'https://www.douban.com'),
        link('微博', 'https://weibo.com'),
        link('小红书', 'https://www.xiaohongshu.com'),
      ]),
      page('开发框架', '⚛️', [
        link('React', 'https://react.dev'),
        link('Vue', 'https://cn.vuejs.org'),
        link('Svelte', 'https://svelte.dev'),
        link('Next.js', 'https://nextjs.org'),
        link('Vite', 'https://cn.vitejs.dev'),
        link('Astro', 'https://astro.build'),
        link('WXT', 'https://wxt.dev'),
      ]),
    ],
  };

  const 学习 = {
    id: uid(),
    title: '学习',
    icon: '📚',
    pages: [
      page('课程', '🎓', [
        link('慕课网', 'https://www.imooc.com'),
        link('freeCodeCamp', 'https://www.freecodecamp.org/chinese/'),
        link('Coursera', 'https://www.coursera.org'),
        link('B 站学习区', 'https://www.bilibili.com/v/knowledge/'),
      ]),
      page('论文', '📜', [
        link('arXiv', 'https://arxiv.org'),
        link('Google Scholar', 'https://scholar.google.com'),
        link('知网', 'https://www.cnki.net'),
      ]),
      page('英语', '🔤', [
        link('欧路词典', 'https://dict.eudic.net'),
        link('Vocabulary.com', 'https://www.vocabulary.com'),
        link('BBC Learning English', 'https://www.bbc.co.uk/learningenglish'),
      ]),
    ],
  };

  const 工作 = {
    id: uid(),
    title: '工作',
    icon: '💼',
    pages: [
      page('项目', '📋', [
        link('GitHub', 'https://github.com'),
        link('Linear', 'https://linear.app'),
        link('Notion', 'https://www.notion.so'),
        link('Figma', 'https://www.figma.com'),
      ]),
      page('协作', '💬', [
        link('飞书', 'https://www.feishu.cn'),
        link('钉钉', 'https://www.dingtalk.com'),
        link('Slack', 'https://slack.com'),
      ]),
    ],
  };

  return {
    groups: [常用, 学习, 工作],
    activeGroupId: 常用.id,
    activePageByGroup: {
      [常用.id]: 常用.pages[0].id,
      [学习.id]: 学习.pages[0].id,
      [工作.id]: 工作.pages[0].id,
    },
  };
}

/* ---------- 读写 ---------- */

/** 补齐缺失字段，容忍历史数据 / 半损坏数据 */
export function mergeNav(partial: unknown): NavState {
  const fallback = defaultNav();
  const raw = (partial ?? {}) as Partial<NavState>;
  if (!Array.isArray(raw.groups) || raw.groups.length === 0) return fallback;

  const groups: NavGroup[] = raw.groups.map((g) => ({
    id: g.id ?? uid(),
    title: g.title ?? '未命名',
    icon: g.icon || '📁',
    pages:
      Array.isArray(g.pages) && g.pages.length > 0
        ? g.pages.map((p) => ({
            id: p.id ?? uid(),
            title: p.title ?? '未命名',
            icon: p.icon || '📄',
            tiles: Array.isArray(p.tiles) ? p.tiles : [],
          }))
        : [{ id: uid(), title: '新页面', icon: '📄', tiles: [] }],
  }));

  const activeGroupId = groups.some((g) => g.id === raw.activeGroupId)
    ? (raw.activeGroupId as string)
    : groups[0].id;

  const activePageByGroup: Record<string, string> = {};
  for (const g of groups) {
    const want = raw.activePageByGroup?.[g.id];
    activePageByGroup[g.id] = g.pages.some((p) => p.id === want)
      ? (want as string)
      : g.pages[0].id;
  }

  return { groups, activeGroupId, activePageByGroup };
}

/** 首次运行时把旧的 quickdock 数据搬过来，避免用户白配置一场 */
async function migrateLegacy(): Promise<NavState | null> {
  const r = await browser.storage.sync.get('config');
  const legacy = (r.config as { dock?: { title?: string; url: string }[] } | undefined)
    ?.dock;
  if (!Array.isArray(legacy) || legacy.length === 0) return null;

  const nav = defaultNav();
  const home = nav.groups[0].pages[0];
  const migrated = legacy
    .filter((d) => typeof d?.url === 'string')
    .map((d) => link(d.title || d.url, d.url));
  if (migrated.length === 0) return null;

  // 迁移来的快捷方式放在最前面，原默认图标留在后面
  home.tiles = [...migrated, ...home.tiles];
  return nav;
}

export async function getNav(): Promise<NavState> {
  const r = await browser.storage.local.get(NAV_KEY);
  if (r[NAV_KEY]) return mergeNav(r[NAV_KEY]);

  const migrated = await migrateLegacy();
  const nav = migrated ?? defaultNav();
  await browser.storage.local.set({ [NAV_KEY]: nav });
  return nav;
}

export async function setNav(nav: NavState): Promise<void> {
  await browser.storage.local.set({ [NAV_KEY]: nav });
}

/** 订阅导航树变化（多个新标签页之间实时同步） */
export function onNavChanged(cb: (nav: NavState) => void): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area === 'local' && changes[NAV_KEY]) {
      cb(mergeNav(changes[NAV_KEY].newValue));
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/* ---------- 查询 ---------- */

export function currentPage(nav: NavState): NavPage | undefined {
  const group = nav.groups.find((g) => g.id === nav.activeGroupId);
  if (!group) return undefined;
  const pageId = nav.activePageByGroup[group.id];
  return group.pages.find((p) => p.id === pageId) ?? group.pages[0];
}

export function collectIconKeys(nav: NavState): string[] {
  const keys: string[] = [];
  const visit = (t: Tile) => {
    if (t.type === 'link') {
      if (t.icon.kind === 'upload' && t.icon.value) keys.push(t.icon.value);
    } else if (t.type === 'folder') {
      t.children.forEach(visit);
    }
  };
  for (const g of nav.groups) for (const p of g.pages) p.tiles.forEach(visit);
  return keys;
}

/* ---------- 纯函数编辑（配合 React state 使用） ---------- */

function mapGroup(
  nav: NavState,
  groupId: string,
  fn: (g: NavGroup) => NavGroup,
): NavState {
  return {
    ...nav,
    groups: nav.groups.map((g) => (g.id === groupId ? fn(g) : g)),
  };
}

export function addGroup(nav: NavState, title = '新分组'): NavState {
  const g: NavGroup = {
    id: uid(),
    title,
    icon: '📁',
    pages: [{ id: uid(), title: '新页面', icon: '📄', tiles: [] }],
  };
  return {
    groups: [...nav.groups, g],
    activeGroupId: g.id,
    activePageByGroup: { ...nav.activePageByGroup, [g.id]: g.pages[0].id },
  };
}

export function updateGroup(
  nav: NavState,
  groupId: string,
  patch: Partial<Pick<NavGroup, 'title' | 'icon'>>,
): NavState {
  return mapGroup(nav, groupId, (g) => ({ ...g, ...patch }));
}

/** 删掉最后一个分组时保留一个空分组，避免界面塌掉 */
export function removeGroup(nav: NavState, groupId: string): NavState {
  const groups = nav.groups.filter((g) => g.id !== groupId);
  if (groups.length === 0) return addGroup(nav);

  const activePageByGroup = { ...nav.activePageByGroup };
  delete activePageByGroup[groupId];
  const activeGroupId =
    nav.activeGroupId === groupId ? groups[0].id : nav.activeGroupId;

  return { groups, activeGroupId, activePageByGroup };
}

export function addPage(nav: NavState, groupId: string, title = '新页面'): NavState {
  const p: NavPage = { id: uid(), title, icon: '📄', tiles: [] };
  const next = mapGroup(nav, groupId, (g) => ({ ...g, pages: [...g.pages, p] }));
  return {
    ...next,
    activePageByGroup: { ...next.activePageByGroup, [groupId]: p.id },
  };
}

export function updatePage(
  nav: NavState,
  groupId: string,
  pageId: string,
  patch: Partial<Pick<NavPage, 'title' | 'icon'>>,
): NavState {
  return mapGroup(nav, groupId, (g) => ({
    ...g,
    pages: g.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
  }));
}

export function removePage(
  nav: NavState,
  groupId: string,
  pageId: string,
): NavState {
  const group = nav.groups.find((g) => g.id === groupId);
  if (!group) return nav;

  // 只剩一页时清空内容而不是删掉页面
  if (group.pages.length <= 1) {
    return mapGroup(nav, groupId, (g) => ({
      ...g,
      pages: g.pages.map((p) => (p.id === pageId ? { ...p, tiles: [] } : p)),
    }));
  }

  const pages = group.pages.filter((p) => p.id !== pageId);
  const next = mapGroup(nav, groupId, (g) => ({ ...g, pages }));
  return {
    ...next,
    activePageByGroup: {
      ...next.activePageByGroup,
      [groupId]:
        next.activePageByGroup[groupId] === pageId
          ? pages[0].id
          : next.activePageByGroup[groupId],
    },
  };
}

export function reorderPage(
  nav: NavState,
  groupId: string,
  pageId: string,
  dir: -1 | 1,
): NavState {
  return mapGroup(nav, groupId, (g) => {
    const idx = g.pages.findIndex((p) => p.id === pageId);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= g.pages.length) return g;
    const pages = [...g.pages];
    [pages[idx], pages[to]] = [pages[to], pages[idx]];
    return { ...g, pages };
  });
}

export function setActiveGroup(nav: NavState, groupId: string): NavState {
  return { ...nav, activeGroupId: groupId };
}

export function setActivePage(
  nav: NavState,
  groupId: string,
  pageId: string,
): NavState {
  return {
    ...nav,
    activePageByGroup: { ...nav.activePageByGroup, [groupId]: pageId },
  };
}

/** 往指定页面追加一个磁贴 */
export function appendTile(
  nav: NavState,
  groupId: string,
  pageId: string,
  tile: Tile,
): NavState {
  return mapGroup(nav, groupId, (g) => ({
    ...g,
    pages: g.pages.map((p) =>
      p.id === pageId ? { ...p, tiles: [...p.tiles, tile] } : p,
    ),
  }));
}

export function upsertTile(
  nav: NavState,
  groupId: string,
  pageId: string,
  tile: Tile,
): NavState {
  return mapGroup(nav, groupId, (g) => ({
    ...g,
    pages: g.pages.map((p) => {
      if (p.id !== pageId) return p;
      const exists = p.tiles.some((t) => t.id === tile.id);
      return {
        ...p,
        tiles: exists
          ? p.tiles.map((t) => (t.id === tile.id ? tile : t))
          : [...p.tiles, tile],
      };
    }),
  }));
}

/** 磁贴可能在任何页面里（文件夹子项也可能），全树查找 */
export function findTile(
  nav: NavState,
  tileId: string,
): { groupId: string; pageId: string; tile: Tile } | null {
  for (const g of nav.groups) {
    for (const p of g.pages) {
      for (const t of p.tiles) {
        if (t.id === tileId) return { groupId: g.id, pageId: p.id, tile: t };
        if (t.type === 'folder') {
          const child = t.children.find((c) => c.id === tileId);
          if (child) return { groupId: g.id, pageId: p.id, tile: child };
        }
      }
    }
  }
  return null;
}

export function removeTile(nav: NavState, tileId: string): NavState {
  return {
    ...nav,
    groups: nav.groups.map((g) => ({
      ...g,
      pages: g.pages.map((p) => {
        if (p.tiles.some((t) => t.id === tileId)) {
          return { ...p, tiles: p.tiles.filter((t) => t.id !== tileId) };
        }
        if (
          p.tiles.some(
            (t) => t.type === 'folder' && t.children.some((c) => c.id === tileId),
          )
        ) {
          return {
            ...p,
            tiles: p.tiles.map((t) =>
              t.type === 'folder'
                ? { ...t, children: t.children.filter((c) => c.id !== tileId) }
                : t,
            ),
          };
        }
        return p;
      }),
    })),
  };
}

/**
 * 同列表内换位：把 dragId 摘出来插到 anchorId 前面或后面，anchorId 传 null（或找不到）
 * = 挪到末尾。锚点索引是摘掉 moved 之后算的，所以「插到它后面」就是 +1。
 * 返回 null 表示这次不该动数据：dragId 不在这个列表里，或者锚点就是自己
 * （把某一项插到它自己旁边等于没挪）。
 */
function moveInList<T extends { id: string }>(
  list: T[],
  dragId: string,
  anchorId: string | null,
  position: 'before' | 'after',
): T[] | null {
  if (dragId === anchorId) return null;
  const from = list.findIndex((t) => t.id === dragId);
  if (from < 0) return null;

  const out = [...list];
  const [moved] = out.splice(from, 1);
  const anchor = anchorId ? out.findIndex((t) => t.id === anchorId) : -1;
  const at = anchor < 0 ? out.length : anchor + (position === 'after' ? 1 : 0);
  out.splice(Math.min(Math.max(at, 0), out.length), 0, moved);
  return out;
}

/**
 * 拖拽排序：把 dragId 这个磁贴挪到 targetId 的前面或后面。
 * targetId 传 null（或找不到）= 挪到末尾，对应拖到末尾那个虚线「+」磁贴，
 * 也对应松手时指针落在网格空白处。
 * 只在当前页内部排序，不跨页——跨页走 moveTileToPage（右键菜单里的「移动到」）。
 * 链接图标、分组、小组件都走这一条：小组件只是不能叠，排序一视同仁。
 */
export function moveTile(
  nav: NavState,
  groupId: string,
  pageId: string,
  dragId: string,
  targetId: string | null,
  position: 'before' | 'after' = 'before',
): NavState {
  return mapGroup(nav, groupId, (g) => ({
    ...g,
    pages: g.pages.map((p) => {
      if (p.id !== pageId) return p;
      const tiles = moveInList(p.tiles, dragId, targetId, position);
      return tiles ? { ...p, tiles } : p;
    }),
  }));
}

/**
 * 文件夹浮层里的子图标排序：只在同一个文件夹内换位，不涉及跨分组/跨页。
 * 语义和 moveTile 一致（anchorId 为 null = 挪到子项末尾）。
 */
export function reorderChild(
  nav: NavState,
  folderId: string,
  dragId: string,
  anchorId: string | null,
  position: 'before' | 'after' = 'before',
): NavState {
  const hit = findTile(nav, folderId);
  if (!hit || hit.tile.type !== 'folder') return nav;
  const children = moveInList(hit.tile.children, dragId, anchorId, position);
  if (!children) return nav;
  return upsertTile(nav, hit.groupId, hit.pageId, { ...hit.tile, children });
}

/* ---------- 拖拽合并：仿 iOS 把两个图标叠成一摞 ---------- */

/** 新分组的自动命名：两个图标同域名就用域名，否则「新分组」 */
function autoFolderTitle(children: LinkTile[]): string {
  const hosts = new Set(
    children.map((c) => {
      try {
        return new URL(c.url).hostname.replace(/^www\./, '');
      } catch {
        return '';
      }
    }),
  );
  if (hosts.size === 1) {
    const only = [...hosts][0];
    if (only) return only;
  }
  return '新分组';
}

/**
 * 把 sourceId 叠到 targetId 上：两者都是本页的顶级链接图标时，在 targetId
 * 原来的位置上生成一个同时包含两者的新分组（被拖的那个排在前）。
 *
 * 文件夹不能套文件夹、小组件也装不了图标，所以这两种情况原样返回。
 * folderId 由调用方生成——useNav().update 的 reducer 会被 StrictMode 重复执行，
 * id 放在 reducer 外面才能保证两次算出同一个。
 */
export function foldIntoFolder(
  nav: NavState,
  groupId: string,
  pageId: string,
  sourceId: string,
  targetId: string,
  folderId: string,
): NavState {
  if (sourceId === targetId) return nav;
  return mapGroup(nav, groupId, (g) => ({
    ...g,
    pages: g.pages.map((p) => {
      if (p.id !== pageId) return p;
      const source = p.tiles.find((t) => t.id === sourceId);
      const target = p.tiles.find((t) => t.id === targetId);
      if (!source || !target) return p;
      if (source.type !== 'link' || target.type !== 'link') return p;

      const merged: FolderTile = {
        id: folderId,
        type: 'folder',
        title: autoFolderTitle([source, target]),
        children: [source, target],
      };
      const tiles: Tile[] = [];
      for (const t of p.tiles) {
        if (t.id === sourceId) continue;
        tiles.push(t.id === targetId ? merged : t);
      }
      return { ...p, tiles };
    }),
  }));
}

/**
 * 把 childId 这个链接图标收进 folderId 分组，落在子项末尾。
 *
 * childId 也可以是别的分组里的子图标——那种情况等于「从一个分组挪到另一个分组」。
 * 已经在目标分组里、或者拖来的不是链接图标，一律原样返回（防御性兜底，
 * 网格那边本来就不会给这两种组合点亮合并环）。
 */
export function addChildToFolder(
  nav: NavState,
  folderId: string,
  childId: string,
): NavState {
  if (folderId === childId) return nav;
  const hit = findTile(nav, folderId);
  if (!hit || hit.tile.type !== 'folder') return nav;
  const child = findTile(nav, childId)?.tile;
  if (!child || child.type !== 'link') return nav;
  if (hit.tile.children.some((c) => c.id === child.id)) return nav;

  const stripped = removeTile(nav, childId);
  const where = findTile(stripped, folderId);
  if (!where || where.tile.type !== 'folder') return nav;
  return upsertTile(stripped, where.groupId, where.pageId, {
    ...where.tile,
    children: [...where.tile.children, child],
  });
}

/* ---------- 页面清单与跨页移动 ---------- */

/** 「移动到」子菜单的数据源：把所有页面拉平成一维列表 */
export interface PageOption {
  groupId: string;
  groupTitle: string;
  groupIcon: string;
  pageId: string;
  pageTitle: string;
  pageIcon: string;
  /** 目标页已有多少磁贴，菜单里当提示 */
  count: number;
}

export function listPages(nav: NavState): PageOption[] {
  const out: PageOption[] = [];
  for (const g of nav.groups) {
    for (const p of g.pages) {
      out.push({
        groupId: g.id,
        groupTitle: g.title,
        groupIcon: g.icon,
        pageId: p.id,
        pageTitle: p.title,
        pageIcon: p.icon,
        count: p.tiles.length,
      });
    }
  }
  return out;
}

/**
 * 跨页移动：把磁贴挪到目标页面末尾。
 *
 * 传进来的 tileId 也可能是文件夹里的子图标——那种情况会先把它摘出文件夹，
 * 到目标页后升级为独立磁贴（子图标本身也是 LinkTile，结构上直接可用）。
 * 已经在目标页就原样返回，菜单那边同时会禁用这一项。
 */
export function moveTileToPage(
  nav: NavState,
  tileId: string,
  targetGroupId: string,
  targetPageId: string,
): NavState {
  const hit = findTile(nav, tileId);
  if (!hit) return nav;
  if (hit.groupId === targetGroupId && hit.pageId === targetPageId) return nav;

  const stripped = removeTile(nav, tileId);
  return appendTile(stripped, targetGroupId, targetPageId, hit.tile);
}

/**
 * 释放文件夹：把折叠在里面的图标全部倒回该页末尾，文件夹本身消失。
 * 空文件夹就等于直接删除。
 */
export function releaseFolder(nav: NavState, folderId: string): NavState {
  const hit = findTile(nav, folderId);
  if (!hit || hit.tile.type !== 'folder') return nav;

  const removed = removeTile(nav, folderId);
  return hit.tile.children.reduce(
    (n, child) => appendTile(n, hit.groupId, hit.pageId, child),
    removed,
  );
}

/** 「搜索图标」的数据源：全树里的链接图标，带页面归属 */
export interface IconEntry {
  id: string;
  title: string;
  url: string;
  icon: IconSpec;
  groupId: string;
  pageId: string;
  pageTitle: string;
  pageIcon: string;
  /** 折叠在哪个文件夹里；顶级图标没有这个字段 */
  folderTitle?: string;
}

export function listLinkIcons(nav: NavState): IconEntry[] {
  const out: IconEntry[] = [];
  for (const g of nav.groups) {
    for (const p of g.pages) {
      for (const t of p.tiles) {
        const base = {
          groupId: g.id,
          pageId: p.id,
          pageTitle: p.title,
          pageIcon: p.icon,
        };
        if (t.type === 'link') {
          out.push({ ...base, id: t.id, title: t.title, url: t.url, icon: t.icon });
        } else if (t.type === 'folder') {
          for (const c of t.children) {
            out.push({
              ...base,
              id: c.id,
              title: c.title,
              url: c.url,
              icon: c.icon,
              folderTitle: t.title,
            });
          }
        }
      }
    }
  }
  return out;
}

export { defaultNav };
