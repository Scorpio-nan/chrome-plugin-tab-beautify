// 跨页面共享的 React hooks
import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { DEFAULT_CONFIG, type ThemeMode, type UserConfig } from './types';
import { getConfig, onConfigChanged, setConfig } from './storage';
import { getNav, onNavChanged, setNav } from './nav';
import { getIconStore, type IconStore } from './icon-store';
import type { NavState } from './types';

/** 全局偏好：初始为默认值，加载后与 storage 同步，update() 会立即本地生效并落盘 */
export function useConfig() {
  const [config, setState] = useState<UserConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let mounted = true;
    getConfig().then((c) => {
      if (mounted) setState(c);
    });
    const off = onConfigChanged((c) => setState(c));
    return () => {
      mounted = false;
      off();
    };
  }, []);

  const update = useCallback((patch: Partial<UserConfig>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      void setConfig(next);
      return next;
    });
  }, []);

  return { config, update };
}

/**
 * 导航树。update(fn) 接收纯函数 reducer（见 lib/nav.ts 的 addPage/removeTile 等），
 * 本地立即生效并异步落盘，storage 变化会反向同步回来。
 */
export function useNav() {
  const [nav, setState] = useState<NavState | null>(null);

  useEffect(() => {
    let mounted = true;
    getNav().then((n) => {
      if (mounted) setState(n);
    });
    const off = onNavChanged((n) => setState(n));
    return () => {
      mounted = false;
      off();
    };
  }, []);

  const update = useCallback((fn: (prev: NavState) => NavState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      void setNav(next);
      return next;
    });
  }, []);

  return { nav, update, ready: nav !== null };
}

/** 上传图标的 data URL 表，key → dataURL */
export function useIconStore(): IconStore {
  const [store, setStore] = useState<IconStore>({});

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getIconStore().then((s) => {
        if (mounted) setStore(s);
      });
    };
    reload();
    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area === 'local' && changes.iconStore) reload();
    };
    browser.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);

  return store;
}

function resolveDark(theme: ThemeMode): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

/**
 * 文档级外观开关，全部由 config 投影到 <html>：
 *   data-theme = 深/浅色（跟随系统时由 matchMedia 决定）
 *   data-font  = 「使用系统默认字体」（见 assets/global.css）
 */
export function useTheme(config: UserConfig) {
  const { theme, systemFont } = config;

  useEffect(() => {
    document.documentElement.dataset.font = systemFont ? 'system' : '';
  }, [systemFont]);

  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.theme = resolveDark(theme)
        ? 'dark'
        : 'light';
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [theme]);
}

/**
 * 订阅 storage.local 指定 key 的变化。
 * load：从 storage 读数据并 setState。返回 data。
 */
export function useLocal<T>(
  key: string,
  loadFn: () => Promise<T>,
  initial: T,
) {
  const [data, setData] = useState<T>(initial);
  const loadRef = useRef(loadFn);
  loadRef.current = loadFn;

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      loadRef.current().then((v) => {
        if (mounted) setData(v);
      });
    };
    reload();
    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area === 'local' && changes[key]) reload();
    };
    browser.storage.onChanged.addListener(listener);
    return () => {
      mounted = false;
      browser.storage.onChanged.removeListener(listener);
    };
  }, [key]);

  return data;
}