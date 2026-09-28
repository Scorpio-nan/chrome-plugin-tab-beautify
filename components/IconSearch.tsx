// 图标搜索：把整棵导航树里的链接图标摊平展示，输入名称 / 网址即时过滤。
//
// 入口是内容区右键菜单的「搜索图标」。不带查询词时就是"全部图标"的总览，
// 结果按「分组 · 页面」分段，点一下新标签页打开并关掉浮层。
import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

import TileIcon from '@/components/TileIcon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { IconEntry } from '@/lib/nav';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: IconEntry[];
}

interface Section {
  key: string;
  label: string;
  items: IconEntry[];
}

export default function IconSearch({ open, onOpenChange, entries }: Props) {
  const [query, setQuery] = useState('');

  /* 每次重新打开都回到「显示全部」，别留着上次的关键词 */
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      (e.title + ' ' + e.url + ' ' + (e.folderTitle ?? ''))
        .toLowerCase()
        .includes(q),
    );
  }, [entries, query]);

  /* listLinkIcons 是按分组→页面顺序遍历的，同名页天然连续，直接聚段即可 */
  const sections = useMemo(() => {
    const out: Section[] = [];
    for (const e of matched) {
      const key = e.groupId + '/' + e.pageId;
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e);
      else out.push({ key, label: e.pageIcon + ' ' + e.pageTitle, items: [e] });
    }
    return out;
  }, [matched]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,46rem)]">
        <DialogHeader>
          <DialogTitle>搜索图标</DialogTitle>
          <DialogDescription>
            共 {entries.length} 个图标 · 输入名称或网址过滤，点击直接打开
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 ring-1 ring-border focus-within:ring-ring">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索图标名称或网址…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              title="清空"
              onClick={() => setQuery('')}
              className="grid size-5 place-items-center rounded-full text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pt-3">
          {sections.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              没有匹配的图标
            </p>
          ) : (
            sections.map((s) => (
              <section key={s.key} className="pb-3">
                <h3 className="flex items-center gap-1.5 pb-1.5 text-xs font-medium text-muted-foreground">
                  <span>{s.label}</span>
                  <span className="opacity-60">{s.items.length}</span>
                </h3>
                <div className="grid grid-cols-6 gap-1.5">
                  {s.items.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      title={
                        e.folderTitle
                          ? e.folderTitle + ' · ' + e.url
                          : e.url
                      }
                      onClick={() => {
                        window.open(e.url, '_blank', 'noopener');
                        onOpenChange(false);
                      }}
                      className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-2 text-center outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg">
                        <TileIcon
                          icon={e.icon}
                          title={e.title}
                          url={e.url}
                          glyphClass="text-base"
                        />
                      </span>
                      <span className="line-clamp-2 text-[11px] leading-tight break-all">
                        {e.title}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
