// 分组 / 页面的 emoji 图标选择器。
//
// 它现在被塞进右键菜单（ContextMenu 的 extra 槽），所以刻意不依赖 Radix
// DropdownMenuItem——那套东西脱离菜单上下文就没有样式也没有行为。
import { cn } from '@/lib/utils';

const ICONS = [
  '🏠', '📄', '⭐', '🔧', '🛠️', '🧪',
  '🎬', '📚', '💼', '📝', '🎵', '🎮',
  '📊', '🔍', '☁️', '🚀', '💡', '🎨',
  '🗂️', '🍀', '🔥', '🌐', '📌', '🧩',
];

interface Props {
  value?: string;
  onPick: (icon: string) => void;
}

export default function EmojiGrid({ value, onPick }: Props) {
  return (
    <div className="px-1 pt-1 pb-1.5">
      <p className="px-1.5 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
        图标
      </p>
      <div className="grid grid-cols-6 gap-0.5">
        {ICONS.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => onPick(icon)}
            className={cn(
              'grid size-6 place-items-center rounded-md text-[15px] leading-none transition-colors',
              'hover:bg-accent',
              icon === value && 'bg-accent',
            )}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}