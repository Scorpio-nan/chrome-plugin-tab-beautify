// 单个链接磁贴：图标方块在上、名称摆在方块外面，整块可点。
// 方块边长跟着「图标尺寸」走，名称可以被「隐藏图标名称」收掉。
// 编辑 / 删除等操作一律走右键菜单（见 TileGrid 的 ContextMenu），表面不摆按钮。
import TileIcon from '@/components/TileIcon';
import type { TileMetrics } from '@/components/grid/tileMetrics';
import type { LinkTile as LinkTileType, OpenMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  tile: LinkTileType;
  metrics: TileMetrics;
  /** 隐藏图标名称：只留方块，行高由网格那边收紧 */
  hideLabel?: boolean;
  /** 左键落在新标签页还是当前标签页 */
  openMode?: OpenMode;
  className?: string;
}

export default function LinkTile({
  tile,
  metrics,
  hideLabel = false,
  openMode = 'newTab',
  className,
}: Props) {
  return (
    <a
      href={tile.url}
      target={openMode === 'newTab' ? '_blank' : '_self'}
      rel="noreferrer noopener"
      title={tile.url}
      draggable={false}
      className={cn(
        'group/tile flex h-full w-full flex-col items-center text-center',
        className,
      )}
    >
      {/* 方块才是容器：悬停高亮只跟着图标走，不把名称一起圈进去 */}
      <span
        className={cn(
          'relative grid aspect-square w-full shrink-0 place-items-center',
          metrics.box,
          'overflow-hidden rounded-2xl bg-white/8 text-white',
          'transition-[background-color,scale] duration-200 ease-ios',
          'hover:bg-white/16 active:scale-[0.97]',
        )}
      >
        <TileIcon
          icon={tile.icon}
          title={tile.title}
          url={tile.url}
          className="size-[68%] rounded-xl transition-[scale] duration-200 ease-ios group-hover/tile:scale-[1.06]"
          glyphClass="text-[26px]"
        />
        {tile.badge && (
          <span className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[10px] leading-4 text-white">
            {tile.badge}
          </span>
        )}
      </span>
      {!hideLabel && (
        <span className="tile-label mt-1 line-clamp-1 w-full text-xs leading-tight break-all text-white/90">
          {tile.title}
        </span>
      )}
    </a>
  );
}
