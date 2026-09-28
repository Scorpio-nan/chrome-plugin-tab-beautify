// 工具栏弹出窗：快速搜索 + 当前页操作 + 打开入口
import { useState, type FormEvent } from 'react';
import { browser } from 'wxt/browser';
import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEARCH_ENGINES, searchUrl } from '@/lib/search';
import { useConfig, useTheme } from '@/lib/hooks';

export default function App() {
  const { config, update } = useConfig();
  useTheme(config);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  const isDark =
    config.theme === 'dark' ||
    (config.theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    void browser.tabs.create({ url: searchUrl(config.searchEngine, q.trim()) });
  };

  const addCurrentTab = async () => {
    setMsg('');
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https?:\/\//.test(tab.url)) {
      setMsg('当前页面不支持添加');
      return;
    }
    const res = (await browser.runtime.sendMessage({
      type: 'tile:add',
      url: tab.url,
      title: tab.title ?? tab.url,
    })) as { ok?: boolean; error?: string };
    setMsg(res?.ok ? '已添加到新标签页主页 ✓' : (res?.error ?? '添加失败'));
  };

  const openSidePanel = async () => {
    const sp = (globalThis as Record<string, unknown>).chrome as
      | { sidePanel?: { open?: (o: { windowId?: number }) => Promise<void> } }
      | undefined;
    if (!sp?.sidePanel?.open) {
      setMsg('当前浏览器不支持侧边栏');
      return;
    }
    try {
      const win = await browser.windows.getCurrent();
      await sp.sidePanel.open({ windowId: win.id });
    } catch {
      setMsg('打开侧边栏失败');
    }
  };

  return (
    <div className="flex w-[320px] flex-col gap-3 bg-background p-4 text-foreground">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl leading-tight font-light tabular-nums">
            {new Date().toLocaleTimeString('zh-CN', { hour12: false })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {new Date().toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          title="切换主题"
          onClick={() => update({ theme: isDark ? 'light' : 'dark' })}
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>

      <form className="flex gap-1.5" onSubmit={search}>
        <select
          aria-label="搜索引擎"
          value={config.searchEngine}
          onChange={(e) =>
            update({ searchEngine: e.target.value as typeof config.searchEngine })
          }
          className="h-9 shrink-0 rounded-md border border-input bg-transparent px-1.5 text-xs"
        >
          {SEARCH_ENGINES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <Input
          placeholder="快速搜索…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" className="shrink-0 px-3">
          搜
        </Button>
      </form>

      <div className="flex flex-col gap-1.5">
        <Button variant="secondary" className="w-full" onClick={addCurrentTab}>
          将当前页面添加到主页
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void browser.runtime.openOptionsPage()}
        >
          打开设置页
        </Button>
        <Button variant="secondary" className="w-full" onClick={openSidePanel}>
          打开侧边栏（便签 & 待办）
        </Button>
      </div>

      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <button
          type="button"
          className="hover:underline"
          onClick={() => void browser.tabs.create({ url: 'https://wxt.dev' })}
        >
          WXT + React
        </button>
        <span>右键选中文字可搜索</span>
      </div>
    </div>
  );
}