// 图标尺寸的唯一真相。
//
// Tailwind v4 只认源码里出现的字面量类名，所以三档尺寸全部写死在这里，
// 由 TileGrid / LinkTile / FolderTile / AddTiles 共同索引，避免四处数字对不上。
// 行高 = 图标方块 + 名称那一行（约 22px）；隐藏名称时换成紧凑行高，格子不会被拉长。
import type { TileSize, UserConfig } from '@/lib/types';

export interface TileMetrics {
  /** 网格容器的列宽 */
  cols: string;
  /** 行高：显示名称 / 隐藏名称 */
  rows: string;
  rowsNoLabel: string;
  /** 单个图标方块的最大边长 */
  box: string;
  /** 分组方块（占 2×2 格）的最大边长 */
  folderBox: string;
  /** 落点插入线的纵向范围，别把名称那一格也算进去 */
  slot: string;
  slotNoLabel: string;
  /** 跟手预览：整块宽 / 图标边长 / 分组预览宽 */
  preview: string;
  previewIcon: string;
  previewFolder: string;
}

export const TILE_METRICS: Record<TileSize, TileMetrics> = {
  sm: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(84px,104px))]',
    rows: 'auto-rows-[112px]',
    rowsNoLabel: 'auto-rows-[92px]',
    box: 'max-w-[92px]',
    folderBox: 'max-w-[200px]',
    slot: 'top-1 bottom-[22px]',
    slotNoLabel: 'top-1 bottom-1',
    preview: 'w-[76px]',
    previewIcon: 'size-[52px]',
    previewFolder: 'w-[96px]',
  },
  md: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(104px,128px))]',
    rows: 'auto-rows-[134px]',
    rowsNoLabel: 'auto-rows-[112px]',
    box: 'max-w-[112px]',
    folderBox: 'max-w-[248px]',
    slot: 'top-1 bottom-[26px]',
    slotNoLabel: 'top-1 bottom-1',
    preview: 'w-[92px]',
    previewIcon: 'size-14',
    previewFolder: 'w-[112px]',
  },
  lg: {
    cols: 'grid-cols-[repeat(auto-fill,minmax(124px,152px))]',
    rows: 'auto-rows-[158px]',
    rowsNoLabel: 'auto-rows-[136px]',
    box: 'max-w-[136px]',
    folderBox: 'max-w-[292px]',
    slot: 'top-1 bottom-[30px]',
    slotNoLabel: 'top-1 bottom-1',
    preview: 'w-[112px]',
    previewIcon: 'size-[68px]',
    previewFolder: 'w-[136px]',
  },
};

/** 网格容器用的那串类名（列宽 + 按是否显示名称挑行高） */
export function gridClasses(config: Pick<UserConfig, 'tileSize' | 'hideTileLabel'>) {
  const m = TILE_METRICS[config.tileSize] ?? TILE_METRICS.md;
  return [m.cols, config.hideTileLabel ? m.rowsNoLabel : m.rows].join(' ');
}

export function metricsOf(size: TileSize): TileMetrics {
  return TILE_METRICS[size] ?? TILE_METRICS.md;
}
