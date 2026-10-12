// 纪念日 / 生日（上游 F31）：本地记录，支持每年重复与一次性，按剩余天数排序。
import { useCallback, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';

import { useLocal } from '@/lib/hooks';
import { anniversaryStore, type AnniversaryItem } from '@/lib/local-stores';
import { cn } from '@/lib/utils';

const DAY = 86400000;

function startOfToday(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** 距离下一次还有多少天；已过去返回负数（一次性事件用） */
export function daysTo(item: AnniversaryItem): number {
  const today = startOfToday();
  const base = new Date(item.date + 'T00:00:00');
  if (Number.isNaN(base.getTime())) return 0;
  if (!item.yearly) return Math.round((base.getTime() - today) / DAY);

  // 每年重复：今年的那天过了就顺延到明年
  const now = new Date();
  let next = new Date(now.getFullYear(), base.getMonth(), base.getDate()).getTime();
  if (next < today) {
    next = new Date(now.getFullYear() + 1, base.getMonth(), base.getDate()).getTime();
  }
  return Math.round((next - today) / DAY);
}

export default function Anniversary() {
  const items = useLocal<AnniversaryItem[]>(
    'anniversaries',
    () => anniversaryStore.get(),
    [],
  );
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [yearly, setYearly] = useState(true);

  const save = useCallback((next: AnniversaryItem[]) => {
    void anniversaryStore.set(next);
  }, []);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    save([
      ...items,
      { id: Math.random().toString(36).slice(2, 9), title: title.trim(), date, yearly },
    ]);
    setTitle('');
    setDate('');
  };

  const sorted = [...items].sort((a, b) => daysTo(a) - daysTo(b));

  return (
    <div className="flex h-full w-full flex-col gap-1.5 text-foreground">
      <form onSubmit={add} className="flex shrink-0 flex-col gap-1">
        <div className="flex items-center gap-1">
          <input
            className="min-w-0 flex-1 rounded-md bg-secondary/60 px-2 py-1 text-xs outline-hidden placeholder:text-muted-foreground focus-visible:ring-[2px] focus-visible:ring-ring/50"
            placeholder="纪念日名称"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            type="submit"
            title="添加"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="size-3.5" />
            <span className="sr-only">添加</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 rounded-md bg-secondary/60 px-2 py-1 text-[11px] outline-hidden"
          />
          <button
            type="button"
            onClick={() => setYearly((v) => !v)}
            className={cn(
              'shrink-0 rounded-md px-2 py-1 text-[10px]',
              yearly ? 'bg-primary/80 text-primary-foreground' : 'bg-secondary/60 text-muted-foreground',
            )}
          >
            {yearly ? '每年' : '一次'}
          </button>
        </div>
      </form>

      <div className="thin-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="py-2 text-center text-[11px] text-muted-foreground">
            还没有纪念日，上面加一个吧
          </p>
        )}
        {sorted.map((it) => {
          const d = daysTo(it);
          return (
            <div key={it.id} className="group/ann flex items-center gap-1.5 text-[11px]">
              <span className="min-w-0 flex-1 truncate">{it.title}</span>
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  d === 0 ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {d === 0 ? '今天' : d > 0 ? d + ' 天' : Math.abs(d) + ' 天前'}
              </span>
              <button
                type="button"
                title="删除"
                onClick={() => save(items.filter((x) => x.id !== it.id))}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/ann:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
                <span className="sr-only">删除</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
