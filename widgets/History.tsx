// 历史记录（上游 F24）：
//   与浏览器本地历史一致（只用 chrome.history，不做任何云端动作），支持搜索、单条删除、
//   以及「只看最近 N 天」；上游那句「系统仅保留近 30 天的记录」在这里体现为默认窗口 30 天。
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Search, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface Hit {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

const WINDOW_DAYS = 30;

export default function History({ limit = 30 }: { limit?: number }) {
  const available = typeof browser.history !== 'undefined';
  const [granted, setGranted] = useState(available);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(
    async (text: string) => {
      if (!granted) return;
      try {
        const startTime = Date.now() - WINDOW_DAYS * 86400000;
        const items = await browser.history.search({
          text: text.trim(),
          startTime,
          maxResults: limit,
        });
        setHits(
          items
            .filter((i) => i.url)
            .map((i) => ({
              id: i.id ?? String(i.url),
              title: i.title || i.url || '',
              url: i.url ?? '',
              visitedAt: i.lastVisitTime ?? 0,
            })),
        );
        setNote('');
      } catch {
        setNote('历史记录读取失败');
        setHits([]);
      }
    },
    [granted, limit],
  );

  useEffect(() => {
    void load(query);
  }, [load, query]);

  const enable = async () => {
    try {
      const ok = await browser.permissions.request({ permissions: ['history'] });
      if (ok) setGranted(true);
    } catch {
      setNote('权限申请失败');
    }
  };

  const removeOne = async (url: string) => {
    try {
      await browser.history.deleteUrl({ url });
      setHits((prev) => (prev ?? []).filter((h) => h.url !== url));
    } catch {
      setNote('删除失败');
    }
  };

  if (!granted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
        <p className="text-[11px] text-muted-foreground">
          历史记录需要额外授权；数据只在本机读取，不会上传
        </p>
        <Button size="sm" variant="secondary" onClick={enable}>
          启用历史权限
        </Button>
        {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-1.5 text-foreground">
      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary/50 px-2 py-1">
        <Search className="size-3 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={'搜索最近 ' + WINDOW_DAYS + ' 天的历史'}
          className="min-w-0 flex-1 bg-transparent text-[11px] outline-hidden placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            title="清空"
            onClick={() => setQuery('')}
            className="grid size-4 place-items-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="thin-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {hits === null && (
          <p className="py-3 text-center text-[11px] text-muted-foreground">
            读取中…
          </p>
        )}
        {hits?.length === 0 && (
          <p className="py-3 text-center text-[11px] text-muted-foreground">
            没有匹配的历史记录
          </p>
        )}
        {hits?.map((h) => (
          <div key={h.id} className="group/hist flex items-center gap-1.5">
            <a
              href={h.url}
              title={h.title + '\n' + h.url}
              className="min-w-0 flex-1 truncate text-[11px] hover:underline"
            >
              {h.title}
            </a>
            <button
              type="button"
              title="从历史记录里删除这一条"
              onClick={() => void removeOne(h.url)}
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/hist:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 className="size-3" />
              <span className="sr-only">删除</span>
            </button>
          </div>
        ))}
      </div>

      {note && <p className="text-[10px] text-muted-foreground">{note}</p>}
    </div>
  );
}
