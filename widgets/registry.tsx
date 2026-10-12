// 小组件注册表：新标签页的「小组件库」和「小组件磁贴」都只读这一张表。
//
// 后期要做扩展插件注入新小组件，只需要在页面里调一次 registerWidget()，
// 库列表和磁贴渲染会自动跟着更新（内部走 useSyncExternalStore 订阅）。
import { useSyncExternalStore } from 'react';

import type { UserConfig, WidgetId, WidgetSize, WidgetTile } from '@/lib/types';
import Almanac from '@/widgets/Almanac';
import Anniversary from '@/widgets/Anniversary';
import Bookmarks from '@/widgets/Bookmarks';
import Calculator from '@/widgets/Calculator';
import Calendar from '@/widgets/Calendar';
import Clock from '@/widgets/Clock';
import Converter from '@/widgets/Converter';
import Countdown from '@/widgets/Countdown';
import History from '@/widgets/History';
import MindMap from '@/widgets/MindMap';
import Notes from '@/widgets/Notes';
import Pomodoro from '@/widgets/Pomodoro';
import Quote from '@/widgets/Quote';
import SystemStatus from '@/widgets/SystemStatus';
import Todo from '@/widgets/Todo';
import Trending from '@/widgets/Trending';
import Water from '@/widgets/Water';
import Weather from '@/widgets/Weather';

/** 参数编辑器里的一个字段；WidgetPropsEditor 按这个声明自动渲染表单 */
export interface WidgetField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'switch';
  placeholder?: string;
  hint?: string;
}

export interface WidgetRenderProps {
  tile: WidgetTile;
  config: UserConfig;
}

export interface WidgetDef {
  id: WidgetId;
  label: string;
  desc: string;
  /** 库列表里的 emoji 图标 */
  icon: string;
  defaultSize: WidgetSize;
  /** 该小组件支持哪些尺寸，磁贴的「改尺寸」只列这些 */
  sizes: WidgetSize[];
  /** 新建磁贴时的初始参数 */
  defaults?: Record<string, unknown>;
  /** 参数编辑器字段声明 */
  fields?: WidgetField[];
  Component: React.ComponentType<WidgetRenderProps>;
}

const registry = new Map<WidgetId, WidgetDef>();
const listeners = new Set<() => void>();
let snapshot: WidgetDef[] = [];

function publish() {
  snapshot = [...registry.values()];
  listeners.forEach((l) => l());
}

/** 扩展注入点：重复注册同一个 id 会覆盖 */
export function registerWidget(def: WidgetDef) {
  registry.set(def.id, def);
  publish();
}

export function getWidget(id: WidgetId): WidgetDef | undefined {
  return registry.get(id);
}

export function listWidgets(): WidgetDef[] {
  return snapshot;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** 库列表用；注册表变化时自动重渲染 */
export function useWidgets(): WidgetDef[] {
  return useSyncExternalStore(subscribe, listWidgets, listWidgets);
}

/* ---------- 参数读取 ---------- */

export function prop<T>(tile: WidgetTile, key: string, fallback: T): T {
  const v = tile.props?.[key];
  return (v === undefined || v === null ? fallback : v) as T;
}

/* ---------- 注册 ---------- */

registerWidget({
  id: 'clock',
  label: '时钟',
  desc: '时间与日期，问候语可自定义',
  icon: '🕐',
  defaultSize: 'md',
  sizes: ['sm', 'md', 'lg'],
  defaults: { showDate: true, showSeconds: false, hour12: false },
  fields: [
    { key: 'showDate', label: '显示日期', type: 'switch' },
    { key: 'showSeconds', label: '显示秒', type: 'switch' },
    { key: 'hour12', label: '12 小时制', type: 'switch' },
  ],
  Component: ({ tile, config }) => (
    <Clock
      userName={config.userName}
      showDate={prop(tile, 'showDate', true)}
      showSeconds={prop(tile, 'showSeconds', false)}
      hour12={prop(tile, 'hour12', false)}
    />
  ),
});

registerWidget({
  id: 'weather',
  label: '天气',
  desc: '实况 + 24 小时 + 7 天预报，城市在设置里改',
  icon: '🌤️',
  defaultSize: 'sm',
  sizes: ['sm', 'md', 'lg'],
  Component: ({ config, tile }) => (
    <Weather
      city={config.weather.city}
      lat={config.weather.lat}
      lon={config.weather.lon}
      size={tile.size}
    />
  ),
});

registerWidget({
  id: 'todo',
  label: '待办',
  desc: '勾选式清单，与侧边栏共用一份数据',
  icon: '✅',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  fields: [
    { key: 'title', label: '标题', type: 'text', placeholder: '待办事项' },
    {
      key: 'group',
      label: '默认分组',
      type: 'text',
      placeholder: '留空 = 默认分组',
      hint: '新建的待办会落到这个分组',
    },
  ],
  Component: ({ tile }) => (
    <Todo
      title={prop(tile, 'title', undefined)}
      defaultGroup={prop(tile, 'group', '')}
    />
  ),
});

registerWidget({
  id: 'notes',
  label: '便签',
  desc: '随手记，输入自动保存',
  icon: '📝',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  Component: () => <Notes />,
});

registerWidget({
  id: 'bookmarks',
  label: '书签',
  desc: '读取浏览器书签（需单独授权）',
  icon: '🔖',
  defaultSize: 'lg',
  sizes: ['md', 'lg'],
  defaults: { limit: 12 },
  fields: [
    {
      key: 'limit',
      label: '每个书签夹显示',
      type: 'number',
      hint: '条数，太多会溢出滚动',
    },
  ],
  Component: ({ tile }) => <Bookmarks limit={prop(tile, 'limit', 12)} />,
});

registerWidget({
  id: 'calendar',
  label: '日历',
  desc: '月视图 + 农历、节气、节日',
  icon: '📅',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  Component: () => <Calendar />,
});

registerWidget({
  id: 'almanac',
  label: '黄历',
  desc: '农历、干支、宜忌、冲煞、彭祖百忌（离线计算）',
  icon: '🀄',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  Component: () => <Almanac />,
});

registerWidget({
  id: 'countdown',
  label: '倒计时',
  desc: '距离某个日子还有多少天',
  icon: '⏳',
  defaultSize: 'sm',
  sizes: ['sm', 'md'],
  defaults: { title: '纪念日' },
  fields: [
    { key: 'title', label: '标题', type: 'text', placeholder: '纪念日' },
    { key: 'date', label: '目标日期', type: 'date' },
    {
      key: 'repeat',
      label: '重复方式',
      type: 'text',
      placeholder: 'none / yearly / monthly',
      hint: 'none=不重复（默认）· yearly=每年 · monthly=每月',
    },
  ],
  Component: ({ tile }) => (
    <Countdown
      title={prop(tile, 'title', '倒计时')}
      date={prop(tile, 'date', '')}
      repeat={prop(tile, 'repeat', 'none')}
    />
  ),
});

registerWidget({
  id: 'quote',
  label: '每日一言',
  desc: '内置文案，不联网',
  icon: '💡',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  Component: () => <Quote />,
});

registerWidget({
  id: 'system',
  label: '电池 / 系统',
  desc: '电量与充电状态；内存需要单独授权（多数桌面版不支持）',
  icon: '🔋',
  defaultSize: 'sm',
  sizes: ['sm', 'md'],
  Component: () => <SystemStatus />,
});

registerWidget({
  id: 'converter',
  label: '单位换算',
  desc: '长度/面积/体积/质量/速度/压强/力/功率/数据/温度，纯离线',
  icon: '📐',
  defaultSize: 'md',
  sizes: ['sm', 'md', 'lg'],
  Component: () => <Converter />,
});

registerWidget({
  id: 'calculator',
  label: '计算器',
  desc: '个人所得税、房贷（等额本息/本金）、进制转换',
  icon: '🧮',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  Component: () => <Calculator />,
});

registerWidget({
  id: 'anniversary',
  label: '纪念日',
  desc: '生日与纪念日，支持每年重复，按剩余天数排序',
  icon: '🎂',
  defaultSize: 'md',
  sizes: ['sm', 'md', 'lg'],
  Component: () => <Anniversary />,
});

registerWidget({
  id: 'pomodoro',
  label: '专注',
  desc: '番茄钟：25 分钟不可分割，跳过记烂番茄，含今日统计',
  icon: '🍅',
  defaultSize: 'sm',
  sizes: ['sm', 'md'],
  Component: () => <Pomodoro />,
});

registerWidget({
  id: 'water',
  label: '喝水',
  desc: '按天记杯数，带本周/本月达标统计',
  icon: '💧',
  defaultSize: 'sm',
  sizes: ['sm', 'md'],
  Component: () => <Water />,
});

registerWidget({
  id: 'history',
  label: '历史记录',
  desc: '最近 30 天的浏览器历史，可搜索、可单条删除（需单独授权）',
  icon: '🕘',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  defaults: { limit: 30 },
  fields: [
    { key: 'limit', label: '最多显示', type: 'number', hint: '条数' },
  ],
  Component: ({ tile }) => <History limit={prop(tile, 'limit', 30)} />,
});

registerWidget({
  id: 'trending',
  label: '热搜 / 资讯',
  desc: '自己填数据源（JSON 数组），带分类与热度；未配置时显示内置示例',
  icon: '🔥',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  fields: [
    {
      key: 'source',
      label: '数据源地址',
      type: 'text',
      placeholder: 'https://…/hot.json',
      hint: '返回 [{ "title": "...", "url": "...", "hot": 123 }]；首次使用要在组件里点「授权域名」',
    },
  ],
  Component: ({ tile }) => <Trending source={prop(tile, 'source', '')} />,
});

registerWidget({
  id: 'mindmap',
  label: '思维导图',
  desc: '树形节点编辑，可导出 Markdown 大纲与 JSON（离线）',
  icon: '🧠',
  defaultSize: 'lg',
  sizes: ['md', 'lg'],
  Component: () => <MindMap />,
});
