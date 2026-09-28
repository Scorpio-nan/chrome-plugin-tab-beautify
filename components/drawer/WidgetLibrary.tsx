import { useWidgets } from '@/widgets/registry';
import type { WidgetId } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  value?: WidgetId;
  onPick: (id: WidgetId) => void;
}

export default function WidgetLibrary({ value, onPick }: Props) {
  const widgets = useWidgets();

  return (
    <div className="grid grid-cols-2 gap-2">
      {widgets.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onPick(w.id)}
          className={cn(
            'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
            w.id === value
              ? 'border-primary bg-accent'
              : 'hover:bg-accent/60',
          )}
        >
          <span className="text-xl leading-none">{w.icon}</span>
          <span className="text-sm font-medium">{w.label}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {w.desc}
          </span>
        </button>
      ))}
    </div>
  );
}