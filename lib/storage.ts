// 类型安全 + 响应式的配置读写。
// 规则：所有 "状态" 只存 storage（sync=小配置 / local=大数据），页面只是投影。
import { browser } from 'wxt/browser';
import { DEFAULT_CONFIG, type UserConfig } from './types';

export async function getConfig(): Promise<UserConfig> {
  const obj = await browser.storage.sync.get('config');
  return mergeConfig(obj.config);
}

export async function setConfig(config: UserConfig): Promise<void> {
  await browser.storage.sync.set({ config });
}

/** 只处理全局偏好；导航树在 lib/nav.ts，绝不要合并进来（sync 单条目 8KB 会爆） */
export function mergeConfig(partial: unknown): UserConfig {
  return { ...DEFAULT_CONFIG, ...((partial as Partial<UserConfig>) ?? {}) };
}

/** 订阅配置变化（其他页面/后台改了声，这里同步刷新） */
export function onConfigChanged(cb: (config: UserConfig) => void): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area === 'sync' && changes.config) {
      cb(mergeConfig(changes.config.newValue));
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/* ---------- 大数据放 storage.local ---------- */

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  /** 分组名，空 = 默认分组（上游「分组 / 删除分组将同时删除分组下的所有待办事项」） */
  group?: string;
  /** 置顶 */
  pinned?: boolean;
  /** 优先级：0 无 · 1 低 · 2 中 · 3 高 */
  priority?: number;
}

const TODO_KEY = 'todos';
const NOTES_KEY = 'notes';
const BG_IMAGE_KEY = 'bgImage';

export async function getTodoList(): Promise<TodoItem[]> {
  const r = (await browser.storage.local.get(TODO_KEY)) as {
    todos?: TodoItem[];
  };
  return r.todos ?? [];
}
export async function setTodoList(list: TodoItem[]): Promise<void> {
  await browser.storage.local.set({ [TODO_KEY]: list });
}
export async function getNotes(): Promise<string> {
  const r = (await browser.storage.local.get(NOTES_KEY)) as { notes?: string };
  return r.notes ?? '';
}
export async function setNotes(text: string): Promise<void> {
  await browser.storage.local.set({ [NOTES_KEY]: text });
}
export async function getBgImage(): Promise<string> {
  const r = (await browser.storage.local.get(BG_IMAGE_KEY)) as {
    bgImage?: string;
  };
  return r.bgImage ?? '';
}
export async function setBgImage(dataUrl: string): Promise<void> {
  await browser.storage.local.set({ [BG_IMAGE_KEY]: dataUrl });
}

/* ---------- 搜索历史 / 搜索框草稿（都是本机数据，不进 sync） ---------- */

const HISTORY_KEY = 'searchHistory';
const DRAFT_KEY = 'searchDraft';
/** 历史最多留这么多条，多了从最旧的开始挤掉 */
export const SEARCH_HISTORY_LIMIT = 10;

export async function getSearchHistory(): Promise<string[]> {
  const r = (await browser.storage.local.get(HISTORY_KEY)) as {
    searchHistory?: string[];
  };
  return Array.isArray(r.searchHistory) ? r.searchHistory : [];
}

/** 同一个词只留一条，新词顶到最前面 */
export async function pushSearchHistory(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return getSearchHistory();
  const rest = (await getSearchHistory()).filter((x) => x !== q);
  const next = [q, ...rest].slice(0, SEARCH_HISTORY_LIMIT);
  await browser.storage.local.set({ [HISTORY_KEY]: next });
  return next;
}

export async function clearSearchHistory(): Promise<void> {
  await browser.storage.local.remove(HISTORY_KEY);
}

export async function getSearchDraft(): Promise<string> {
  const r = (await browser.storage.local.get(DRAFT_KEY)) as { searchDraft?: string };
  return r.searchDraft ?? '';
}

export async function setSearchDraft(text: string): Promise<void> {
  await browser.storage.local.set({ [DRAFT_KEY]: text });
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

/* ---------- 数据导出 / 导入 ---------- */

/** 备份文件格式：带版本号与导出时间，导入时好做校验 */
export interface BackupFile {
  version: number;
  exportedAt: string;
  sync: Record<string, unknown>;
  local: Record<string, unknown>;
}

export async function exportAll(): Promise<string> {
  const [sync, local] = await Promise.all([
    browser.storage.sync.get(null),
    browser.storage.local.get(null),
  ]);
  const payload: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sync,
    local,
  };
  return JSON.stringify(payload, null, 2);
}

/** 导入并返回写入了多少条 key（调用方拿去做「导入完成」提示） */
export async function importAll(
  json: string,
): Promise<{ sync: number; local: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }
  const p = (parsed ?? {}) as Partial<BackupFile>;
  const sync = p.sync && typeof p.sync === 'object' ? p.sync : null;
  const local = p.local && typeof p.local === 'object' ? p.local : null;
  if (!sync && !local) throw new Error('不是 WeTab Lite 的备份文件');

  if (sync) await browser.storage.sync.set(sync);
  if (local) await browser.storage.local.set(local);
  return {
    sync: sync ? Object.keys(sync).length : 0,
    local: local ? Object.keys(local).length : 0,
  };
}
