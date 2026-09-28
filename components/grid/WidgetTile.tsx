import { getWidget } from '@/widgets/registry';
import type { UserConfig, WidgetTile as WidgetTileType } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  tile: WidgetTileType;
  config: UserConfig;
  className?: string;
}

export default function WidgetTile({ tile, config, className }: Props) {
  const def = getWidget(tile.widget);

  if (!def) {
    return (
      <div className="grid h-full w-full place-items-center rounded-2xl bg-black/25 p-3 text-center text-[11px] text-white/60">
        未注册的小组件：{tile.widget}
      </div>
    );
  }

  const { Component } = def;

  return (
    <div
      data-theme="dark"
      className={cn(
        'h-full w-full overflow-hidden rounded-2xl',
        'border border-white/12 bg-black/30 backdrop-blur-md',
        'transition-colors hover:bg-black/35',
        className,
      )}
    >
      <Component tile={tile} config={config} />
    </div>
  );
}