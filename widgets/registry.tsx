// 小组件注册表：新标签页的「小组件库」和「小组件磁贴」都只读这一张表。
//
// 后期要做扩展插件注入新小组件，只需要在页面里调一次 registerWidget()，
// 库列表和磁贴渲染会自动跟着更新（内部走 useSyncExternalStore 订阅）。
import { useSyncExternalStore } from 'react';

import type { UserConfig, WidgetId, WidgetSize, WidgetTile } from '@/lib/types';
import Bookmarks from '@/widgets/Bookmarks';
import Calendar from '@/widgets/Calendar';
import Clock from '@/widgets/Clock';
import Countdown from '@/widgets/Countdown';
import Notes from '@/widgets/Notes';
import Quote from '@/widgets/Quote';
import Todo from '@/widgets/Todo';
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
  desc: '当前温度与天气，城市在设置里改',
  icon: '🌤️',
  defaultSize: 'sm',
  sizes: ['sm', 'md'],
  Component: ({ config }) => (
    <Weather
      city={config.weather.city}
      lat={config.weather.lat}
      lon={config.weather.lon}
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
  fields: [{ key: 'title', label: '标题', type: 'text', placeholder: '待办事项' }],
  Component: ({ tile }) => <Todo title={prop(tile, 'title', undefined)} />,
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
  desc: '月视图，可翻月',
  icon: '📅',
  defaultSize: 'md',
  sizes: ['md', 'lg'],
  Component: () => <Calendar />,
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
  ],
  Component: ({ tile }) => (
    <Countdown title={prop(tile, 'title', '倒计时')} date={prop(tile, 'date', '')} />
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