// 上传图标的本地仓库。
//
// 存 data URL 字符串而不是 blob: URL —— blob URL 只活在当前页面里，
// 刷新就失效。MV3 默认 CSP 不含 img-src，所以 data URL 不会被拦。
import { browser } from 'wxt/browser';
import { uid } from './storage';

export type IconStore = Record<string, string>;

const KEY = 'iconStore';

export async function getIconStore(): Promise<IconStore> {
  const r = await browser.storage.local.get(KEY);
  return (r[KEY] as IconStore) ?? {};
}

/** 存入一张 data URL，返回可写进 IconSpec.value 的 key */
export async function putIcon(dataUrl: string): Promise<string> {
  const store = await getIconStore();
  const key = uid();
  store[key] = dataUrl;
  await browser.storage.local.set({ [KEY]: store });
  return key;
}

export async function removeIcon(key: string): Promise<void> {
  const store = await getIconStore();
  if (!(key in store)) return;
  delete store[key];
  await browser.storage.local.set({ [KEY]: store });
}

/** 清理不再被任何磁贴引用的图标，避免 local 越攒越大 */
export async function pruneIcons(usedKeys: string[]): Promise<void> {
  const store = await getIconStore();
  const used = new Set(usedKeys);
  const kept: IconStore = {};
  let changed = false;
  for (const [k, v] of Object.entries(store)) {
    if (used.has(k)) kept[k] = v;
    else changed = true;
  }
  if (changed) await browser.storage.local.set({ [KEY]: kept });
}