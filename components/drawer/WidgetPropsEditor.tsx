import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { WidgetDef } from '@/widgets/registry';

interface Props {
  def: WidgetDef;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}

export default function WidgetPropsEditor({ def, value, onChange }: Props) {
  const fields = def.fields ?? [];

  if (fields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        这个小组件没有可调参数
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((f) => {
        const id = `wp-${def.id}-${f.key}`;
        const raw = value[f.key];

        if (f.type === 'switch') {
          return (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <Label htmlFor={id} className="text-sm">
                {f.label}
              </Label>
              <Switch
                id={id}
                checked={Boolean(raw)}
                onCheckedChange={(checked) =>
                  onChange({ ...value, [f.key]: checked })
                }
              />
            </div>
          );
        }

        return (
          <div key={f.key} className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="text-sm">
              {f.label}
            </Label>
            <Input
              id={id}
              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
              value={raw === undefined || raw === null ? '' : String(raw)}
              placeholder={f.placeholder}
              onChange={(e) =>
                onChange({
                  ...value,
                  [f.key]:
                    f.type === 'number'
                      ? e.target.value === ''
                        ? undefined
                        : Number(e.target.value)
                      : e.target.value,
                })
              }
            />
            {f.hint && (
              <span className="text-xs text-muted-foreground">{f.hint}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}