// 书签小组件：按需申请 bookmarks 权限后，展示 Chrome 书签（两级）
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

import { Button } from '@/components/ui/button';

interface BMItem {
  title: string;
  url: string;
}
interface BMGroup {
  folder: string;
  items: BMItem[];
}

function collect(
  nodes: chrome.bookmarks.BookmarkTreeNode[] | undefined,
  out: BMItem[],
  depth: number,
) {
  if (!nodes) return;
  for (const n of nodes) {
    if (n.url) {
      out.push({ title: n.title || n.url, url: n.url });
    } else if (depth < 2) {
      collect(n.children, out, depth + 1);
    }
  }
}

async function loadGroups(limit: number): Promise<BMGroup[]> {
  const tree = await browser.bookmarks.getTree();
  const root = tree[0];
  const groups: BMGroup[] = [];
  for (const folderNode of root.children ?? []) {
    const items: BMItem[] = [];
    collect(folderNode.children, items, 0);
    if (items.length > 0) {
      groups.push({ folder: folderNode.title, items: items.slice(0, limit) });
    }
  }
  return groups;
}

export default function Bookmarks({ limit = 12 }: { limit?: number }) {
  const available = typeof browser.bookmarks !== 'undefined';
  const [granted, setGranted] = useState(available);
  const [groups, setGroups] = useState<BMGroup[] | null>(null);
  const [error, setError] = useState('');

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

  return (
    <div className="thin-scroll h-full w-full overflow-y-auto text-foreground">
      {groups.map((g) => (
        <div key={g.folder} className="mb-2 last:mb-0">
          <div className="mb-1 truncate text-[10px] text-muted-foreground">
            📁 {g.folder}
          </div>
          <div className="flex flex-wrap gap-1">
            {g.items.map((it) => (
              <a
                key={it.url}
                title={it.title}
                href={it.url}
                className="max-w-[10rem] truncate rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-secondary"
              >
                {it.title}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}