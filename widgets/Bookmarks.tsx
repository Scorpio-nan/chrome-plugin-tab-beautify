// 书签小组件：按需申请 bookmarks 权限后展示 Chrome 书签。
// 支持任意层级（带文件夹路径）与即时搜索（上游 F23）。
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Pencil, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface BMItem {
  title: string;
  url: string;
  /** 所在文件夹路径，如「书签栏 / 技术 / 前端」 */
  path: string;
  /** chrome.bookmarks 的节点 id，编辑/删除要用 */
  id: string;
}
interface BMGroup {
  folder: string;
  items: BMItem[];
}

function collect(
  nodes: chrome.bookmarks.BookmarkTreeNode[] | undefined,
  out: BMItem[],
  path: string,
) {
  if (!nodes) return;
  for (const n of nodes) {
    if (n.url) {
      out.push({ id: n.id, title: n.title || n.url, url: n.url, path });
    } else {
      // 层级不设上限：深层书签也要能搜到
      const title = n.title || '未命名';
      collect(n.children, out, path ? path + ' / ' + title : title);
    }
  }
}

async function loadGroups(limit: number): Promise<BMGroup[]> {
  const tree = await browser.bookmarks.getTree();
  const root = tree[0];
  const groups: BMGroup[] = [];
  for (const folderNode of root.children ?? []) {
    const items: BMItem[] = [];
    collect(folderNode.children, items, folderNode.title || '');
    if (items.length > 0) {
      groups.push({ folder: folderNode.title, items });
    }
  }
  return groups;
}

export default function Bookmarks({ limit = 12 }: { limit?: number }) {
  const available = typeof browser.bookmarks !== 'undefined';
  const [granted, setGranted] = useState(available);
  const [groups, setGroups] = useState<BMGroup[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    loadGroups(limit).then(setGroups).catch((e) => setError(String(e)));
  }, [limit]);

  useEffect(() => {
    if (granted) load();
  }, [granted, load]);

  const enable = async () => {
    const ok = await browser.permissions.request({ permissions: ['bookmarks'] });
    if (ok) {
      setGranted(true);
      load();
    }
  };

  /** 编辑书签（上游 F23 的「编辑书签」）：只改名，不动层级 */
  const rename = async (item: BMItem) => {
    const next = window.prompt('重命名书签', item.title);
    if (next === null) return;
    const title = next.trim();
    if (!title || title === item.title) return;
    try {
      await browser.bookmarks.update(item.id, { title });
      setGroups((prev) =>
        (prev ?? []).map((g) => ({
          ...g,
          items: g.items.map((x) => (x.id === item.id ? { ...x, title } : x)),
        })),
      );
      setError('');
    } catch {
      setError('重命名失败');
    }
  };

  const remove = async (item: BMItem) => {
    if (!window.confirm('删除书签「' + item.title + '」？会同时删掉浏览器的这条书签。')) {
      return;
    }
    try {
      await browser.bookmarks.remove(item.id);
      setGroups((prev) =>
        (prev ?? [])
          .map((g) => ({ ...g, items: g.items.filter((x) => x.id !== item.id) }))
          .filter((g) => g.items.length > 0),
      );
      setError('');
    } catch {
      setError('删除失败');
    }
  };

  if (!granted) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-3 text-center">
        <p className="text-[11px] text-muted-foreground">
          书签功能需要额外授权（可按需单独开启）
        </p>
        <Button size="sm" variant="secondary" onClick={enable}>
          启用书签权限
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-2 text-[11px] text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!groups) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
        读取书签中…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
        书签夹是空的
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = groups
    .map((g) => ({
      folder: g.folder,
      items: (q
        ? g.items.filter((it) =>
            (it.title + ' ' + it.url + ' ' + it.path).toLowerCase().includes(q),
          )
        : g.items
      ).slice(0, limit),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full w-full flex-col gap-1.5 text-foreground">
      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary/50 px-2 py-1">
        <Search className="size-3 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索书签"
          className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-hidden placeholder:text-muted-foreground"
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

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && (
          <p className="py-4 text-center text-[11px] text-muted-foreground">
            没有匹配的书签
          </p>
        )}
        {shown.map((g) => (
          <div key={g.folder} className="mb-2 last:mb-0">
            <div className="mb-1 truncate text-[10px] text-muted-foreground">
              📁 {g.folder}
            </div>
            <div className="flex flex-wrap gap-1">
              {g.items.map((it) => (
                <span
                  key={it.id}
                  className="group/bm inline-flex max-w-[12rem] items-center gap-0.5 rounded-full bg-secondary/70 pr-0.5 pl-2 transition-colors hover:bg-secondary"
                >
                  <a
                    title={it.title + '\n' + it.url + '\n' + it.path}
                    href={it.url}
                    className="min-w-0 truncate py-0.5 text-[11px] text-foreground"
                  >
                    {it.title}
                  </a>
                  <button
                    type="button"
                    title="重命名"
                    onClick={() => void rename(it)}
                    className="shrink-0 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/bm:opacity-100 focus-visible:opacity-100 hover:text-foreground"
                  >
                    <Pencil className="size-2.5" />
                    <span className="sr-only">重命名</span>
                  </button>
                  <button
                    type="button"
                    title="删除书签"
                    onClick={() => void remove(it)}
                    className="shrink-0 rounded-full p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/bm:opacity-100 focus-visible:opacity-100 hover:text-destructive"
                  >
                    <X className="size-2.5" />
                    <span className="sr-only">删除</span>
                  </button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
