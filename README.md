# WeTab Lite 新标签页

用 WXT + React 复刻的 WeTab 风格新标签页插件。接管 Chrome 新标签页，主体是**左侧可折叠的 iOS 风格侧栏 + 竖向滚动的磁贴网格**：磁贴分「链接 / 文件夹 / 小组件」三类，支持拖拽排序、停一下叠成分组与右键操作；另带壁纸系统、弹出窗、侧边栏（便签 & 待办）和完整设置页。

## 快速开始

要求：Node.js 18+、Chrome 浏览器。

```bash
cd C:\workspace\wetab-lite
npm install          # 安装依赖（会自动生成 .wxt 类型）
npm run dev          # 开发模式：自动打开 Chrome 并加载扩展，改动热更新
npm run build        # 生产构建，产物在 .output/chrome-mv3/
npm run media        # 启动本地视频服务（动态壁纸用），默认 http://127.0.0.1:4321
```

不用 `dev` 也可以手动加载：

1. `npm run build`
2. 打开 `chrome://extensions` → 开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择 `C:\workspace\wetab-lite\.output\chrome-mv3`
4. 按 `Ctrl+T` 开新标签页即可看到效果
5. 侧边栏：扩展图标 → “打开侧边栏”（或在扩展详情中把侧边栏固定到工具栏）

> 提示：`node_modules` 目录如果是从其他系统残留的，先删除再 `npm install` 一次。

### 动态壁纸的视频从哪来

设置 → 壁纸 → **动态壁纸**里那 58 张封面来自 `assets/thumbnails/`，构建时打进扩展包（1.5MB，断网也能显示）；点一下封面，整页背景就换成 `assets/videos/` 里的**同名视频**，静音循环播放。

视频近 2GB（单段最大 90MB）**不能进扩展包**，因此由 `npm run media` 这个零依赖静态服务按需串流（支持 Range，可拖动进度）：

```bash
npm run media                 # 默认 127.0.0.1:4321
npm run media -- --port 5000  # 换端口
```

服务没起来时背景**停在封面**，不会黑屏也不会反复重试；设置里那行「本地视频服务地址」（`config.mediaBaseUrl`）只在换端口时才需要改。服务回 `Access-Control-Allow-Origin: *`，所以扩展不用声明 host 权限就能探活与下载。

## 功能一览

| 模块 | 说明 |
|---|---|
| 新标签页 | 接管 `chrome_url_overrides.newtab`，全屏壁纸 + 侧边栏 + 磁贴网格 |
| 侧边栏 | 悬浮毛玻璃胶囊，**默认折叠**只留一级分组图标；点头像或底部箭头展开后出现二级页面列表。长按 / 右键任意一行即可改名、换 emoji、上移下移、删除、新增。常规设置里可选**可见性**（一直显示 / 滚动时隐藏 / 一直隐藏）与**位置**（左侧 / 右侧）；「滚动时隐藏」在滚动时自动收起、鼠标贴屏幕边缘即滑回；「一直隐藏」把设置入口挪进内容区右键菜单 |
| 磁贴网格 | 只渲染当前页，内容超出走**竖向滚动**；拖拽排序全程有反馈：起点留一格虚线空槽、指针所在的磁贴亮起插入线（靠左半=插到它前面，靠右半=插到后面）、其余磁贴压暗、被拖的图标换成一张跟手倾斜的自绘「抬起」预览，松手后用 FLIP 补间滑进新位置。拖到末尾的虚线「+」= 放到最后，拖回起点 = 取消。**链接 / 文件夹 / 小组件都能排**；起点槽、插入线、末尾「+」共用同一种虚线框（`assets/global.css` 的 `drop-frame`），名称一律摆在图标方块下方，不挤占图标 |
| 磁贴右键菜单 | 磁贴表面不摆操作按钮，操作全在右键菜单里。链接：当前页面打开 / 新页签打开 / 编辑主页 / 编辑图标 / 移动到 / 删除；文件夹：全部打开 / 释放 / 编辑主页 / 编辑文件夹 / 移动到 / 删除；小组件：小 / 大 / 编辑主页 / 移动到 / 删除。「移动到」是二级菜单，能落到任意分组下的任意页面，文件夹里的子图标也能单独挪出来 |
| 内容区右键菜单 | 页面空白处右键：添加图标（新图标落在**当前激活页**）/ 添加小组件 / 随机壁纸 / 下载壁纸 / 编辑主页 / 搜索图标。整页屏蔽浏览器默认菜单，只保留输入框内的粘贴 / 全选 |
| 编辑主页 | 仿 iOS 长按主屏：磁贴抖动 + 右上角 × 可移除，左键不再跳转；再点「完成编辑」退出 |
| 搜索图标 | 全树链接图标（含折叠在文件夹里的）摊平在一个浮层里，按名称 / 网址即时过滤，点击直接新标签页打开 |
| 链接磁贴 | 1×1 图标，点击跳转；四种图标来源（在线 / 上传裁剪 / 文字 / 纯色） |
| 文件夹磁贴 | 2×2，聚合一组链接，点开浮层可以点单个链接、也能在浮层里拖动子图标排序（和网格共用同一套 FLIP，浮层内所有拖拽事件都拦冒泡）；浮层里不再有「添加图标到此文件夹」按钮——想加图标就把图标拖到文件夹上停一下。右键「释放」把子图标摊回本页。**叠成分组同样仿 iOS**：把图标拖到另一个图标上停约 0.5s（虚线计时框填满）就合并成一个新分组（同域名自动取域名做名字），拖到文件夹上停约 0.3s 就收进那个分组；小组件装不了图标，对它只有排序（从组件自己的输入框 / 按钮 / 滚动列表起手不算拖组件）|
| 小组件磁贴 | 2×2 / 4×2 / 4×4 三档尺寸，从预设库添加，右键「小 / 大」即时切档，参数可编辑 |
| 搜索框 | 顶部居中的一条（上下间隔合计 180px），点左侧引擎标志即可切换（必应 / 百度 / Google / DuckDuckGo）；输入像域名的内容直接当网址打开。**样式浮层**：右键搜索框或点常规设置里的「搜索框样式」，弹出深色小卡拖滑杆调宽度 / 不透明度 / 是否显示，主页即时跟着变，无需刷新。另有当前页或新标签页打开、搜索建议（离线匹配本地图标）、搜索历史、Tab 键切换引擎、保留输入内容等开关 |
| 壁纸 | 精选图片（本地 SVG，离线可用）/ 动态壁纸（`assets/thumbnails` 封面 + `assets/videos` 同名视频，由 `npm run media` 串流；另有 CSS 漂移光效与在线视频链接）/ 渐变背景，另有遮罩浓度、模糊、自定义上传与最近使用；内容区右键可「随机壁纸」换一张系统预设、「下载壁纸」存到本地（动态壁纸优先存 mp4，服务不在退回封面；渐变与光效导出为 2560×1440 PNG 快照） |
| 天气 | open-meteo 免费接口，20 分钟缓存，城市可配置（走 background，绕 CORS） |
| 待办 / 便签 | 侧边栏页里使用，`storage.local` 持久化，多个页面实时同步 |
| 书签 | 按需申请 `bookmarks` 权限后展示两级书签 |
| 设置 | 新标签页**左下角齿轮**弹出浮动面板（不遮挡主页，选壁纸能立刻跟着变）；`chrome://extensions` → 扩展程序选项 是完整版设置页。**常规设置**按图稿分区：控制栏（侧边栏 / 侧边栏位置 / 默认折叠）、图标（打开方式 / 图标尺寸 小中大 / 图标区域宽度 / 锁死最大宽度 / 隐藏添加图标 / 隐藏图标名称 / 滚动触发翻页）、搜索（样式浮层 / 打开方式 / 建议 / 历史 / Tab 切引擎 / 保留内容）、其他设置（翻页灵敏度 / 系统默认字体 / 右键打开侧边栏）、主页（天气城市 / 问候语）。二级项走 iOS 式下钻页，改动即时生效；图稿的「底部栏」分区本项目没有对应 UI，未实现 |
| 弹出窗 | 快速搜索、把当前页加入主页、打开设置、打开侧边栏 |
| 浏览器右键菜单 | 网页里的「用新标签页搜索选中文字」「把链接加入主页」（`contextMenus` 权限，与新标签页内的自定义菜单无关） |
| 暗黑模式 | 跟随系统 / 浅色 / 深色，三态切换 |

内置小组件：时钟、天气、待办、便签、书签、日历、倒计时、每日一言。

## 技术栈与架构

- **WXT 0.19**：入口即目录，自动生成 manifest，多浏览器构建
- **React 18 + TypeScript**（strict）
- **Tailwind CSS v4**（`@tailwindcss/vite`）+ **手写 vendored 的 shadcn/ui 组件**
  - `assets/global.css` 是唯一的样式来源，设计令牌 + `@theme inline` + 少量 `@utility`
  - 组件放 `components/ui/`，直接改源码即可，不用跑 shadcn CLI
  - 主题走 `html[data-theme="light"|"dark"]`，所以 `global.css` 里暗色令牌块写成 `[data-theme="dark"]` 属性选择器（不是 `.dark` 类），并额外声明了 `@custom-variant dark` 供将来用 `dark:` 工具类
- 数据源规则：**状态只存 `chrome.storage`，页面只是投影**，跨页面靠 `storage.onChanged` 同步

```
wetab-lite/
├── wxt.config.ts            # manifest / 权限 / newtab 接管 声明
├── components.json          # shadcn CLI 配置（留位，当前组件是手写 vendored）
├── entrypoints/             # background / popup / newtab / options / sidepanel
├── components/
│   ├── nav/                 # Sidebar（可折叠二级导航）EmojiGrid
│   ├── grid/                # TileGrid（拖拽 / 停留合并 / 右键菜单）LinkTile FolderTile（浮层内也能排序）WidgetTile AddTiles
│   ├── drawer/              # AddTileDrawer IconPicker IconCropper WidgetLibrary WidgetPropsEditor
│   ├── settings/            # SettingsPanel（新标签页浮层）panes.tsx WallpaperPane
│   ├── ui/                  # vendored shadcn 组件 + context-menu.tsx
│   ├── SearchBar.tsx        # 页面级搜索框
│   ├── IconSearch.tsx       # 「搜索图标」浮层
│   ├── TileIcon.tsx         # 图标渲染 + 多级降级
│   ├── WallpaperLayer.tsx   # 壁纸层（静态 / CSS 光效 / 视频 / 本地动态壁纸）
│   └── Settings.tsx         # 完整设置页用的顺序长表单
├── widgets/                 # 小组件实现 + registry.tsx（注册表）
├── lib/                     # types / nav / flip / storage / icon-store / favicon / search / weather / wallpaper / dynamic-wallpapers / hooks / utils
├── assets/global.css        # 唯一样式来源（Tailwind + 令牌 + 壁纸 / 拖拽反馈关键帧）
├── public/icon/             # 扩展图标（scripts/gen_icons.py 生成）
├── public/wallpapers/       # 精选壁纸 SVG（scripts/gen_wallpapers.py 生成）
├── assets/thumbnails/         # 动态壁纸封面（打包进扩展）
├── assets/videos/             # 动态壁纸视频（git-lfs，**不打包**，走 npm run media）
└── scripts/                 # gen_icons.py / gen_wallpapers.py / serve-media.mjs
```

## 数据模型

分成两处存，这条边界很重要：

| 存放位置 | 内容 | 原因 |
|---|---|---|
| `storage.sync` 的 `config` | 主题、搜索引擎、壁纸参数、天气城市、用户名、侧栏折叠 | 小、需要跨设备同步 |
| `storage.local` 的 `nav` | 分组 / 页面 / 磁贴整棵树 | sync **单条目上限 8KB**，一页几十个图标就超，上传的图标必然超 |
| `storage.local` 的 `iconStore` | 上传图标的 data URL | 同上 |
| `storage.local` 的 `todos` / `notes` / `bgImage` / `weatherCache` / `recentWallpapers` | 待办、便签、上传的壁纸、天气缓存、壁纸最近使用 | 大 |
| `storage.local` 的 `searchHistory` / `searchDraft` | 搜索历史（最多 10 条）、「保留搜索框内容」关掉的未提交输入 | 只在当前设备有意义，也不该占 sync 额度 |

```ts
type Tile = LinkTile | FolderTile | WidgetTile
interface NavState { groups: NavGroup[]; activeGroupId: string; activePageByGroup: Record<string, string> }
```

`lib/nav.ts` 里全是纯函数编辑（`addPage` / `upsertTile` / `removeTile` / `reorderPage` / `moveTile` / `reorderChild` / `foldIntoFolder` / `addChildToFolder` / `moveTileToPage` / `releaseFolder` / `listPages` / `listLinkIcons` …），只返回新树、不碰存储，由调用方 `setNav` 落盘——这样 React 侧可以直接当 reducer 用。新分组的 id 由调用方在外面生成，StrictMode 重复跑 reducer 才算得出同一个结果。`mergeNav()` 会补齐缺失字段，容忍历史数据和半损坏数据。

> 上传的图标只在**保存磁贴时**才写进 `iconStore`（抽屉里裁剪的结果先暂存在组件 state），并且每次导航树变化都会 `pruneIcons(collectIconKeys(nav))` 清掉不再被引用的图标，避免垃圾堆积。

## 如何添加新功能

### 加一个小组件

`widgets/registry.tsx` 是唯一的扩展注入点：

```tsx
import { registerWidget } from '@/widgets/registry';

registerWidget({
  id: 'my-widget',            // 记得同时加进 lib/types.ts 的 WidgetId
  label: '我的小组件',
  desc: '一句话说明',
  icon: '✨',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  defaults: { title: '你好' },  // 磁贴实例的默认参数
  fields: [                    // 参数编辑 UI 由 WidgetPropsEditor 按这个自动渲染
    { key: 'title', label: '标题', type: 'text' },
  ],
  Component: ({ tile, config }) => <div>{/* … */}</div>,
});
```

`WidgetLibrary`（抽屉里的预设库）和 `WidgetTile`（网格上的渲染）都只读这张表，所以注册完就自动出现在「添加小组件」里，不用改别的地方。组件里读参数用 `prop(tile, 'title', '默认值')`。后期做扩展插件注入，就是让注入的脚本调一次 `registerWidget`。

**刻意不支持用户自定义代码执行**——小组件只由「预设 + 参数」构成，扩展注入走的是注册表这条路。

### 加图标来源 / 换 favicon 策略

图标解析的降级链在 `lib/favicon.ts` + `components/TileIcon.tsx`：`上传图标 → chrome.runtime.getURL('/_favicon/…') → https://<host>/favicon.ico → 文字首字`。要换策略就改 `faviconCandidates()` 返回的候选数组。

`TileIcon` 靠 `onError` 逐个推进候选，所以数组顺序即优先级。注意 `_favicon` 只命中本地 favicon 缓存，没访问过的站点会返回通用图标，这是它的已知代价（换取离线可用 + 不需要 host_permissions）。

远程数据统一走 `entrypoints/background.ts` 的消息路由（绕 CORS），新协议在 `BgMessage` 里加字段即可。

## 权限说明（最小化原则）

| 权限 | 用途 |
|---|---|
| `storage` | 用户配置与数据持久化 |
| `activeTab` | 弹出窗读取当前标签页以便“加入主页” |
| `contextMenus` | 右键菜单 |
| `sidePanel` | 侧边栏 |
| `favicon` | `chrome.runtime.getURL('/_favicon/…')` 取站点图标，离线可用且免 host_permissions |
| `bookmarks`（可选） | 书签小组件，首次使用时弹窗申请 |
| host: `open-meteo.com` | 天气数据（仅 background fetch 用） |

## 发布

```bash
npm run build
npm run zip          # 生成可上传 Chrome 应用商店的 zip
```

产物：`.output/wetab-lite-0.1.0-chrome.zip`。