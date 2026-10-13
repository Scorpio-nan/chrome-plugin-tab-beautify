// 批量操作（上游 F15）：把当前页的磁贴列出来勾选，然后批量删除 / 批量移动到别的页。
import { useEffect, useMemo, useState } from 'react';

import TileIcon from '@/components/TileIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PageOption } from '@/lib/nav';
import type { Tile } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tiles: Tile[];
  pages: PageOption[];
  /** 当前页，移动目标里要排除它自己 */
  currentPageId: string;
  onRemove: (ids: string[]) => void;
  onMove: (ids: string[], groupId: string, pageId: string) => void;
}

function iconOf(tile: Tile): { icon: React.ComponentProps<typeof TileIcon>['icon'] } {
  if (tile.type === 'link') return { icon: tile.icon };
  return { icon: { kind: 'text', value: tile.type === 'folder' ? '夹' : '件' } };
}

function labelOf(tile: Tile): string {
  if (tile.type === 'link') return tile.title;
  if (tile.type === 'folder') return tile.title;
  return '小组件';
}

export default function BatchPanel({
  open,
  onOpenChange,
  tiles,
  pages,
  currentPageId,
  onRemove,
  onMove,
}: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (open) {
      setPicked([]);
      setTarget('');
    }
  }, [open]);

  const options = useMemo(
    () => pages.filter((p) => p.pageId !== currentPageId),
    [pages, currentPageId],
  );

  const toggle = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const settled = () => {
    setPicked([]);
    onOpenChange(false);
  };

  const links = tiles.filter((t): t is Extract<Tile, { type: 'link' }> => t.type === 'link');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,40rem)]">
        <DialogHeader>
          <DialogTitle>批量操作</DialogTitle>
          <DialogDescription>
            本页共 {tiles.length} 个磁贴 · 已选 {picked.length} 个
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setPicked(picked.length === tiles.length ? [] : tiles.map((t) => t.id))
            }
          >
            {picked.length === tiles.length ? '取消全选' : '全选'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={picked.length === 0}
            onClick={() =>
              setPicked(links.filter((l) => !picked.includes(l.id)).map((l) => l.id))
            }
          >
            只选链接
          </Button>

          <span className="mx-1 h-4 w-px bg-border" />

          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-md bg-muted px-2 py-1 text-xs"
          >
            <option value="">移动到…</option>
            {options.map((p) => (
              <option key={p.pageId} value={p.pageId}>
                {p.groupIcon} {p.groupTitle} / {p.pageTitle}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            disabled={picked.length === 0 || !target}
            onClick={() => {
              const hit = options.find((p) => p.pageId === target);
              if (!hit) return;
              onMove(picked, hit.groupId, hit.pageId);
              settled();
            }}
          >
            移动
          </Button>

          <Button
            size="sm"
            variant="secondary"
            disabled={picked.length === 0}
            className="text-destructive"
            onClick={() => {
              onRemove(picked);
              settled();
            }}
          >
            删除所选
          </Button>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pt-2">
          {tiles.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              这一页还没有磁贴
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {tiles.map((t) => {
              const on = picked.includes(t.id);
              const { icon } = iconOf(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                    on ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center rounded border',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    {on && '✓'}
                  </span>
                  <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded">
                    <TileIcon
                      icon={icon}
                      title={labelOf(t)}
                      url={t.type === 'link' ? t.url : ''}
                      glyphClass="text-xs"
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {labelOf(t)}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {t.type === 'link' ? '链接' : t.type === 'folder' ? '文件夹' : '小组件'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
