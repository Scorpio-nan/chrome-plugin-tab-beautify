// 网格末尾那个虚线「+」磁贴：点一下开抽屉，也是拖拽排序的「放到最后」投放区。
// 小组件不在这里加——抽屉里的类型切换已经覆盖了图标 / 文件夹 / 小组件三种。
//
// drop 事件不在这里处理，统一由网格结算（指针落在末尾这块 = 追加到末尾）；
// 这里只负责在「正拖着东西、并且指针没落在别的磁贴上」时把自己点亮。
// 虚线框用的是共用的 drop-frame（assets/global.css），所以它和拖拽时的
// 起点空槽、可合并目标长得一模一样，不会出现两套投放区样式。
import { Plus } from 'lucide-react';

import type { TileMetrics } from '@/components/grid/tileMetrics';
import { cn } from '@/lib/utils';

interface Props {
  onAddIcon: () => void;
  /** 方块边长跟着「图标尺寸」走 */
  metrics: TileMetrics;
  /** 有磁贴正被拖着 */
  dragging: boolean;
  /** 此刻松手就会落到末尾 */
  active: boolean;
  onDragEnter: () => void;
}

export default function AddTiles({
  onAddIcon,
  metrics,
  dragging,
  active,
  onDragEnter,
}: Props) {
  return (
    <button
      type="button"
      title="添加图标"
      onClick={onAddIcon}
      onDragEnter={onDragEnter}
      // 尺寸和外面的图标方块对齐（名称那一格留空）
      className={cn(
        'drop-frame group/add relative mt-0 grid aspect-square w-full shrink-0 self-start place-items-center rounded-2xl text-white/70',
        metrics.box,
        'transition-[background-color,color,scale] duration-200 ease-ios',
        'hover:bg-white/16 hover:text-white active:scale-[0.97]',
        dragging && 'text-white/85',
        active && 'scale-[1.03] bg-white/22 text-white',
      )}
    >
      <Plus
        className="size-7 transition-[scale] duration-200 ease-ios group-hover/add:scale-110"
        strokeWidth={1.5}
      />
    </button>
  );
}
