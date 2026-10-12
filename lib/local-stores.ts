// 后加的几个小组件共用的本地数据（storage.local）：纪念日 / 番茄钟统计 / 饮水记录。
//
// 规则和 lib/icon-store.ts 一致：组件只调 get/set，storage key 和形状集中在这里，
// 免得散落各处对不上。
import { browser } from 'wxt/browser';

interface Store<T> {
  get(): Promise<T>;
  set(value: T): Promise<void>;
}

function makeStore<T>(key: string, fallback: T): Store<T> {
  return {
    async get(): Promise<T> {
      const r = (await browser.storage.local.get(key)) as Record<string, T>;
      return r[key] ?? fallback;
    },
    async set(value: T): Promise<void> {
      await browser.storage.local.set({ [key]: value });
    },
  };
}

/* ---------- 纪念日 / 生日 ---------- */

export interface AnniversaryItem {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** true = 每年重复 */
  yearly: boolean;
}

export const anniversaryStore = makeStore<AnniversaryItem[]>('anniversaries', []);

/* ---------- 番茄钟 ---------- */

export interface PomodoroStats {
  /** YYYY-MM-DD */
  date: string;
  /** 已完成的正经番茄数 */
  sessions: number;
  /** 「烂番茄」数：一个番茄时间里去干别的、或手动跳过 */
  rotten: number;
  /** 累计专注分钟 */
  minutes: number;
  /** 日期 → 当天完成的番茄数，用于本周/本月达标统计 */
  days?: Record<string, number>;
}

export const pomodoroStore = makeStore<PomodoroStats>('pomodoro', {
  date: '',
  sessions: 0,
  rotten: 0,
  minutes: 0,
  days: {},
});

/* ---------- 饮水 ---------- */

export interface WaterState {
  /** 目标杯数 */
  target: number;
  /** 日期 → 当天完成杯数，用于本周/本月达标统计 */
  days: Record<string, number>;
}

export const waterStore = makeStore<WaterState>('water', { target: 8, days: {} });

/** 只留最近 90 天，别让记录无限长大 */
export function pruneWaterDays(days: Record<string, number>): Record<string, number> {
  const keys = Object.keys(days).sort().reverse().slice(0, 90);
  const out: Record<string, number> = {};
  for (const k of keys) out[k] = days[k];
  return out;
}

/* ---------- 思维导图 ---------- */

export interface MapNode {
  id: string;
  text: string;
  children: MapNode[];
  collapsed?: boolean;
}

export function newMapNode(text: string): MapNode {
  return {
    id: Math.random().toString(36).slice(2, 9) + Date.now().toString(36),
    text,
    children: [],
  };
}

export const mindMapStore = makeStore<MapNode>('mindmap', newMapNode('中心主题'));

/** YYYY-MM-DD（本地时区） */
export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
