// 文件夹磁贴：占 2×2 格，深色圆角方块里排 2×2 子图标，名称摆在方块外面（不挤占图标）。
// 左键点开浮层，浮层里的子图标同样可以拖拽排序；增删走右键菜单和网格拖放——
// 往文件夹上停一下就收进去（见 TileGrid），浮层里只保留「移除」。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import TileIcon from '@/components/TileIcon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { captureRects, playReflow, type FlipSnapshot } from '@/lib/flip';
import type { DropSide } from '@/components/grid/TileGrid';
import type { TileMetrics } from '@/components/grid/tileMetrics';
import type {
  FolderTile as FolderTileType,
  OpenMode,
} from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  tile: FolderTileType;
  metrics: TileMetrics;
  /** 隐藏分组名称 */
  hideLabel?: boolean;
  /** 浮层里左键落在新标签页还是当前标签页 */
  openMode?: OpenMode;
  onRemoveChild: (folderId: string, childId: string) => void;
  /** 浮层内排序：anchorId 为 null = 放到末尾 */
  onReorderChild: (
    folderId: string,
    dragId: string,
    anchorId: string | null,
    side?: DropSide,
  ) => void;
}

export default function FolderTile({
  tile,
  metrics,
  hideLabel = false,
  openMode = 'newTab',
  onRemoveChild,
  onReorderChild,
}: Props) {
  const [open, setOpen] = useState(false);
  const [dragChild, setDragChild] = useState<string | null>(null);
  const [childSlot, setChildSlot] = useState<{ id: string; side: DropSide } | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const rects = useRef<FlipSnapshot>(null);
  const preview = tile.children.slice(0, 4);

  /* 浮层内的落位补间，和外面网格用的是同一套 FLIP */
  const order = tile.children.map((c) => c.id).join('|');
  useLayoutEffect(() => {
    const root = listRef.current;
    if (!root) return;
    playReflow(root, rects.current);
    rects.current = captureRects(root);
  }, [order]);

  useEffect(() => {
    const root = listRef.current;
    if (!root || !open || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      rects.current = captureRects(root);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [open]);

  const endChildDrag = () => {
    setDragChild(null);
    setChildSlot(null);
  };

  /* Radix 把浮层 portal 到 body，但 React 仍按组件树冒泡：
     这里每个拖拽事件都必须 stopPropagation，否则会被外面那一格的
     拖拽处理器接走，把整个文件夹磁贴一起拖起来。 */
  const onChildDragStart = (childId: string) => (e: React.DragEvent) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).closest('[data-no-drag]')) {
      e.preventDefault();
      return;
    }
    setDragChild(childId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', childId);
  };

  /** 只需要拦住冒泡：外面的网格一旦收到这个事件，会把整只文件夹当成被拖的那一块 */
  const onChildDragEnter = (e: React.DragEvent) => {
    e.stopPropagation();
  };

  const onChildDragOver = (childId: string) => (e: React.DragEvent) => {
    e.stopPropagation();
    if (!dragChild) return;
    e.preventDefault();
    if (childId === dragChild) return;
    const r = e.currentTarget.getBoundingClientRect();
    const side: DropSide = e.clientX - r.left < r.width / 2 ? 'before' : 'after';
    setChildSlot((prev) =>
      prev && prev.id === childId && prev.side === side ? prev : { id: childId, side },
    );
  };

  /** 松手在起点那一格 = 取消；落在别处 = 插到那条虚线胶囊的位置 */
  const onChildDrop = (childId: string) => (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (childId === dragChild) {
      endChildDrag();
      return;
    }
    finishChildDrop();
  };

  const finishChildDrop = () => {
    if (!dragChild) return;
    if (childSlot && childSlot.id !== dragChild) {
      onReorderChild(tile.id, dragChild, childSlot.id, childSlot.side);
    } else if (!childSlot) {
      onReorderChild(tile.id, dragChild, null);
    }
    endChildDrag();
  };

  return (
    <>
      <button
        type="button"
        title={tile.title}
        onClick={() => setOpen(true)}
        className="flex h-full w-full flex-col items-center text-center"
      >
        <span
          className={cn(
            'grid aspect-square w-full shrink-0 grid-cols-2 grid-rows-2',
            metrics.folderBox,
            'gap-2 rounded-2xl bg-black/45 p-3 backdrop-blur-sm',
            'transition-[background-color,scale] duration-200 ease-ios',
            'hover:bg-black/55 active:scale-[0.97]',
          )}
        >
          {Array.from({ length: 4 }).map((_, i) => {
            const child = preview[i];
            return (
              <span
                key={child?.id ?? i}
                className="grid min-h-0 overflow-hidden rounded-xl"
              >
                {child ? (
                  <TileIcon
                    icon={child.icon}
                    title={child.title}
                    url={child.url}
                    className="size-full rounded-xl"
                    glyphClass="text-lg"
                  />
                ) : (
                  <span className="size-full rounded-xl bg-white/8" />
                )}
              </span>
            );
          })}
        </span>
        {!hideLabel && (
          <span className="tile-label mt-1 line-clamp-1 w-full text-xs leading-tight break-all text-white/90">
            {tile.title}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tile.title}</DialogTitle>
            <DialogDescription>
              共 {tile.children.length} 个图标，拖动即可排序
            </DialogDescription>
          </DialogHeader>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
            {tile.children.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                这个文件夹还是空的，把图标拖到它上面就能收进来
              </p>
            ) : (
              <div
                ref={listRef}
                className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-3 py-1"
                onDragOver={(e) => {
                  if (!dragChild) return;
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!dragChild) return;
                  e.stopPropagation();
                  e.preventDefault();
                  finishChildDrop();
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  endChildDrag();
                }}
              >
                {tile.children.map((child) => {
                  const isSource = dragChild === child.id;
                  const slotSide =
                    !isSource && childSlot?.id === child.id ? childSlot.side : null;
                  return (
                    <div
                      key={child.id}
                      data-flip-id={child.id}
                      draggable
                      onDragStart={onChildDragStart(child.id)}
                      onDragEnter={onChildDragEnter}
                      onDragOver={onChildDragOver(child.id)}
                      onDrop={onChildDrop(child.id)}
                      className={cn(
                        'group/fi relative flex flex-col items-center transition-[opacity,scale] duration-200 ease-ios',
                        isSource && 'opacity-30',
                        !!slotSide && 'scale-[1.03]',
                      )}
                    >
                      <span
                        className={cn(
                          'relative grid aspect-square w-full max-w-[88px] place-items-center',
                          'rounded-xl bg-secondary text-secondary-foreground',
                          'transition-[background-color] duration-200 group-hover/fi:bg-accent',
                        )}
                      >
                        <a
                          href={child.url}
                          target={openMode === 'newTab' ? '_blank' : '_self'}
                          rel="noreferrer noopener"
                          title={child.url}
                          draggable={false}
                          className="size-full"
                        >
                          <TileIcon
                            icon={child.icon}
                            title={child.title}
                            url={child.url}
                            className="size-full rounded-xl"
                            glyphClass="text-lg"
                          />
                        </a>

                        {/* 起点：虚线空槽 */}
                        {isSource && (
                          <span className="drop-frame pointer-events-none absolute inset-0 rounded-xl" />
                        )}

                        {/* 落点：一条竖着的虚线胶囊 */}
                        {slotSide && (
                          <span
                            className={cn(
                              'wetab-slot wetab-slot-x pointer-events-none absolute inset-y-1 w-[6px]',
                              'rounded-[3px] border border-dashed border-foreground/60 bg-foreground/20',
                              slotSide === 'before' ? '-left-1.5' : '-right-1.5',
                            )}
                          />
                        )}

                        <button
                          type="button"
                          title="从文件夹移除"
                          data-no-drag
                          onClick={() => onRemoveChild(tile.id, child.id)}
                          className="absolute -top-1 -right-1 z-10 hidden size-5 place-items-center rounded-full bg-destructive text-white shadow transition-colors hover:bg-destructive group-hover/fi:grid"
                        >
                          <X className="size-3" />
                        </button>
                      </span>

                      <span className="mt-1 line-clamp-1 w-full text-center text-[11px] leading-tight break-all text-muted-foreground">
                        {child.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
