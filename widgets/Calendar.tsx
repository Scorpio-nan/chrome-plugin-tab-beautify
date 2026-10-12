// 日历小组件：月视图 + 农历（上游 F18）。农历/节气/节日走 lib/almanac.ts。
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { getAlmanac, getDayBadge } from '@/lib/almanac';
import { cn } from '@/lib/utils';

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  // JS 里 0 = 周日，这里换算成"周一开头"
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function Calendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const cells = buildMonth(cursor.getFullYear(), cursor.getMonth());
  const almanac = getAlmanac(cursor);
  const isThisMonth =
    cursor.getFullYear() === today.getFullYear() &&
    cursor.getMonth() === today.getMonth();

  const shift = (dir: -1 | 1) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));

  return (
    <div className="flex h-full w-full flex-col gap-1 px-1.5 py-1 text-foreground">
      <div className="flex shrink-0 items-center justify-between px-0.5">
        <span className="flex min-w-0 flex-col">
          <span className="text-[11px] font-medium tabular-nums">
            {cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月
          </span>
          <span className="truncate text-[9px] text-muted-foreground">
            {almanac.ganZhi.year}年 · 属{almanac.zodiac}
          </span>
        </span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            title="上个月"
            onClick={() => shift(-1)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            title="下个月"
            onClick={() => shift(1)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </span>
      </div>

      <div className="grid shrink-0 grid-cols-7 gap-px text-center text-[9px] text-muted-foreground">
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px text-center tabular-nums">
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />;
          const date = new Date(
            cursor.getFullYear(),
            cursor.getMonth(),
            d,
          );
          const badge = getDayBadge(date);
          const today_ = isThisMonth && d === today.getDate();
          return (
            <span
              key={i}
              className={cn(
                'flex min-h-0 flex-col items-center justify-center overflow-hidden rounded leading-none',
                today_ && 'bg-primary text-primary-foreground',
              )}
            >
              <span className="text-[10px]">{d}</span>
              <span
                className={cn(
                  'w-full truncate text-[8px]',
                  today_ ? 'opacity-90' : 'text-muted-foreground',
                )}
              >
                {badge}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
