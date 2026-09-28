// 全部"用户可配置"的类型集中在这里。
//
// 存储划分（重要）：
//   storage.sync  → config     全局偏好，体积小
//   storage.local → nav        导航树（分组/页面/磁贴），可能很大
//                   iconStore  上传图标的 data URL
// sync 单条目上限 8KB，一张裁剪后的图标就可能超；所以导航树必须放 local。
// 见 lib/nav.ts / lib/icon-store.ts。

export type ThemeMode = 'system' | 'light' | 'dark';
export type SearchEngine = 'bing' | 'baidu' | 'google' | 'duckduckgo';

/* ---------- 图标 ---------- */

/** online = 自动取站点图标；upload = 用户上传并裁剪；text = 文字首字；color = 纯色块 */
export type IconKind = 'online' | 'upload' | 'text' | 'color';

export interface IconSpec {
  kind: IconKind;
  /** upload: iconStore 里的 key；text: 显示的文字；color: 背景色 */
  value?: string;
  /** 文字/纯色图标的底色 */
  bg?: string;
  /** 文字图标的前景色 */
  fg?: string;
}

/* ---------- 磁贴 ---------- */

export interface LinkTile {
  id: string;
  type: 'link';
  title: string;
  url: string;
  icon: IconSpec;
  /** 右上角角标，如 "2"、"新" */
  badge?: string;
}

export interface FolderTile {
  id: string;
  type: 'folder';
  title: string;
  children: LinkTile[];
}

export type WidgetSize = 'sm' | 'md' | 'lg';

export interface WidgetTile {
  id: string;
  type: 'widget';
  widget: WidgetId;
  size: WidgetSize;
  /** 该磁贴实例的参数（城市、标题、目标日期…），由小组件的 PropsEditor 读写 */
  props?: Record<string, unknown>;
}

export type Tile = LinkTile | FolderTile | WidgetTile;

/* ---------- 导航树 ---------- */

export interface NavPage {
  id: string;
  title: string;
  /** 页面列表里显示的图标，用 emoji */
  icon: string;
  tiles: Tile[];
}

export interface NavGroup {
  id: string;
  title: string;
  /** 分组轨里的图标，用 emoji */
  icon: string;
  pages: NavPage[];
}

export interface NavState {
  groups: NavGroup[];
  activeGroupId: string;
  /** 每个分组各自记住停在第几页 */
  activePageByGroup: Record<string, string>;
}

/* ---------- 小组件 ---------- */

export type WidgetId =
  | 'clock'
  | 'weather'
  | 'todo'
  | 'notes'
  | 'bookmarks'
  | 'calendar'
  | 'countdown'
  | 'quote';

/* ---------- 全局偏好（存 storage.sync） ---------- */

/**
 * 壁纸来源。
 *   gradient  内置渐变（CSS 值）
 *   color     纯色
 *   image     用户上传的图（data URL 存 storage.local 的 bgImage，避免塞爆 sync）
 *   photo     精选图片 / 在线图片链接（见 lib/wallpaper.ts）
 *   animated  动态壁纸预设 key（纯 CSS 动画，见 ANIMATED_PRESETS）
 *   video     动态壁纸：视频链接（mp4 / webm）
 *   dynamic   动态壁纸：assets/videos 里的本地视频，值 = 文件名（见 lib/dynamic-wallpapers.ts）
 */
export type BackgroundStyle =
  | { type: 'gradient'; value: string }
  | { type: 'color'; value: string }
  | { type: 'image' }
  | { type: 'photo'; value: string }
  | { type: 'animated'; value: string }
  | { type: 'video'; value: string }
  | { type: 'dynamic'; value: string };

export type SidebarVisibility = 'always' | 'scroll' | 'hidden';
export type ScreenSide = 'left' | 'right';
export type OpenMode = 'newTab' | 'selfTab';
export type TileSize = 'sm' | 'md' | 'lg';

export interface UserConfig {
  theme: ThemeMode;
  searchEngine: SearchEngine;
  background: BackgroundStyle;
  /** 问候语中显示的名字，空则不显示 */
  userName: string;
  weather: { city: string; lat: number; lon: number };

  /* 控制栏 */
  /** 侧边栏：一直显示 / 滚动时隐藏（贴边才出现）/ 一直隐藏 */
  sidebarVisibility: SidebarVisibility;
  /** 侧边栏停靠的那一侧 */
  sidebarSide: ScreenSide;
  /** 侧栏折叠：只留一级分组图标；展开后才出现二级页面 */
  sidebarCollapsed: boolean;

  /* 图标 */
  /** 磁贴左键的打开方式 */
  tileOpenMode: OpenMode;
  /** 图标尺寸：小 / 中 / 大，决定网格列宽与行高 */
  tileSize: TileSize;
  /** 隐藏网格末尾那个虚线「+」 */
  hideAddTile: boolean;
  /** 隐藏图标名称，只留方块 */
  hideTileLabel: boolean;
  /** 滚到内容区上下边界继续滚 = 翻到上一页 / 下一页 */
  scrollPaging: boolean;

  /* 壁纸参数 */
  /** 背景遮罩浓度 0–0.7，越大字越清楚 */
  overlay: number;
  /** 背景模糊 px */
  blur: number;
  /** 动态壁纸视频的本地服务地址（npm run media），只有换端口时才需要改 */
  mediaBaseUrl: string;
  /** 主内容区最大宽度 px */
  iconAreaWidth: number;
  /** 锁死最大宽度（关闭则随窗口拉伸） */
  lockMaxWidth: boolean;

  /* 搜索框 */
  showSearch: boolean;
  /** 搜索框不透明度 0.1–1，界面上按百分比显示 */
  searchOpacity: number;
  /** 搜索框宽度，占内容区的百分比 30–100 */
  searchWidth: number;
  /** 搜索结果与直接输入网址时的打开方式 */
  searchOpenMode: OpenMode;
  /** 边输边给建议（离线匹配本地图标名称与网址） */
  searchSuggestions: boolean;
  /** 记录搜索历史，空输入框聚焦时列出来 */
  searchHistory: boolean;
  /** 输入框里按 Tab 切到下一个搜索引擎 */
  tabSwitchEngine: boolean;
  /** 下次打开新标签页时把上次没搜的内容留在框里 */
  keepSearchText: boolean;

  /* 其他 */
  /** 翻页灵敏度 1–100，越大越容易翻 */
  pageSensitivity: number;
  /** 用系统默认字体，不走 SF Pro / PingFang 那套 */
  systemFont: boolean;
  /** 浏览器工具栏扩展图标上右键时，出现「打开 WeTab 侧边栏」 */
  contextMenuSidebar: boolean;
}

export const DEFAULT_CONFIG: UserConfig = {
  theme: 'dark',
  searchEngine: 'bing',
  background: { type: 'photo', value: '/wallpapers/nature-1.svg' },
  userName: '',
  weather: { city: '上海', lat: 31.2304, lon: 121.4737 },
  sidebarVisibility: 'always',
  sidebarSide: 'left',
  sidebarCollapsed: true,
  tileOpenMode: 'newTab',
  tileSize: 'md',
  hideAddTile: false,
  hideTileLabel: false,
  scrollPaging: true,
  overlay: 0.28,
  blur: 0,
  // 写成字面量，和 scripts/serve-media.mjs 默认端口一致；不引 dynamic-wallpapers.ts，
  // 免得 types → wallpaper → storage → types 绕成循环依赖
  mediaBaseUrl: 'http://127.0.0.1:4321',
  iconAreaWidth: 1280,
  lockMaxWidth: true,
  showSearch: true,
  searchOpacity: 1,
  searchWidth: 59,
  searchOpenMode: 'newTab',
  searchSuggestions: true,
  searchHistory: false,
  tabSwitchEngine: true,
  keepSearchText: true,
  pageSensitivity: 41,
  systemFont: false,
  contextMenuSidebar: true,
};

/** 新标签页可选的渐变 / 径向背景预设（设置面板的「渐变背景」标签页） */
export const BG_PRESETS: { key: string; css: string }[] = [
  { key: 'violet', css: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)' },
  { key: 'pink', css: 'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)' },
  { key: 'ocean', css: 'linear-gradient(135deg,#4facfe 0%,#00f2fe 100%)' },
  { key: 'mint', css: 'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)' },
  { key: 'sunset', css: 'linear-gradient(135deg,#fa709a 0%,#fee140 100%)' },
  { key: 'night', css: 'linear-gradient(135deg,#30cfd0 0%,#330867 100%)' },
  { key: 'berry', css: 'radial-gradient(circle at 30% 30%,#355c7d,#6c5b7b,#c06c84)' },
  { key: 'deepsea', css: 'radial-gradient(circle at 70% 20%,#0f2027,#203a43,#2c5364)' },
  { key: 'forest', css: 'linear-gradient(160deg,#134e5e 0%,#2f7336 55%,#a8e063 100%)' },
  { key: 'dusk', css: 'linear-gradient(200deg,#2c3e50 0%,#4b6cb7 60%,#b06ab3 100%)' },
  { key: 'ember', css: 'radial-gradient(circle at 20% 80%,#3a1c71,#d76d77,#ffaf7b)' },
  { key: 'slate', css: 'linear-gradient(180deg,#232526 0%,#414345 100%)' },
];
