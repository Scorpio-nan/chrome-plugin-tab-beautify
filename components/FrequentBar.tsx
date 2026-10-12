// 常访栏：搜索框下面那条常用网站（上游 F08）。
//
// 数据存在导航树的 nav.frequent 里（storage.local），所以多个新标签页实时同步。
// 平时点击直接打开；右键内容区菜单里能「编辑常访栏 / 隐藏常访栏 / 添加常访图标」，
// 编辑模式下每个图标右上角出现 ×，两侧出现左右移动按钮。
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import TileIcon from '@/components/TileIcon';
import type { LinkTile } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  items: LinkTile[];
  /** 编辑模式：显示 × 与左右移动 */
  editing: boolean;
  /** 跟随「隐藏图标名称」设置 */
  hideLabel: boolean;
  maxWidth: number;
  onOpen: (item: LinkTile) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
}

export default function FrequentBar({
  items,
  editing,
  hideLabel,
  maxWidth,
  onOpen,
  onRemove,
  onMove,
}: Props) {
  if (items.length === 0) return null;

  return (
    <div className="flex shrink-0 justify-center px-6 pb-[70px]">
      <div
        className={cn(
          'thin-scroll flex max-w-full items-start gap-1 overflow-x-auto rounded-2xl p-1',
          editing && 'bg-black/25 ring-1 ring-white/15 backdrop-blur-sm',
        )}
        style={{ width: 'min(100%, ' + maxWidth + 'px)' }}
      >
        {items.map((item) => (
          <div key={item.id} className="relative flex shrink-0 flex-col items-center">
            <button
              type="button"
              title={item.title + '\n' + item.url}
              onClick={() => {
                if (editing) return;
                onOpen(item);
              }}
              className={cn(
                'grid size-12 place-items-center overflow-hidden rounded-xl transition-[scale] duration-150 ease-ios',
                editing ? 'cursor-default' : 'hover:scale-105',
              )}
            >
              <TileIcon icon={item.icon} title={item.title} url={item.url} />
            </button>

            {!hideLabel && (
              <span className="mt-1 w-14 truncate text-center text-[11px] leading-tight text-white/85">
                {item.title}
              </span>
            )}

            {editing && (
              <>
                <button
                  type="button"
                  title="移出常访栏"
                  onClick={() => onRemove(item.id)}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-zinc-800 text-white shadow-md ring-1 ring-white/25"
                >
                  <X className="size-3" />
                </button>
                <div className="mt-1 flex items-center gap-1">
                  <button
                    type="button"
                    title="左移"
                    onClick={() => onMove(item.id, -1)}
                    className="grid size-5 place-items-center rounded-md bg-black/40 text-white/80 hover:bg-black/60"
                  >
                    <ChevronLeft className="size-3" />
                  </button>
                  <button
                    type="button"
                    title="右移"
                    onClick={() => onMove(item.id, 1)}
                    className="grid size-5 place-items-center rounded-md bg-black/40 text-white/80 hover:bg-black/60"
                  >
                    <ChevronRight className="size-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
