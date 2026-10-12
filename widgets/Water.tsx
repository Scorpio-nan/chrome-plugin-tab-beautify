// 饮水 / 健康（上游 F33）：按天记录杯数，显示目标进度与本周 / 本月达标天数。
import { useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';

import { useLocal } from '@/lib/hooks';
import {
  pruneWaterDays,
  todayKey,
  waterStore,
  type WaterState,
} from '@/lib/local-stores';

const DEFAULT_TARGET = 8;

function withinDays(state: WaterState, days: number): { hit: number; total: number } {
  const now = new Date();
  let hit = 0;
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const cups = state.days[todayKey(d)] ?? 0;
    if (cups >= state.target) hit += 1;
  }
  return { hit, total: days };
}

export default function Water() {
  const state = useLocal<WaterState>('water', () => waterStore.get(), {
    target: DEFAULT_TARGET,
    days: {},
  });

  const today = todayKey();
  const cups = state.days[today] ?? 0;
  const target = state.target || DEFAULT_TARGET;
  const pct = Math.min(100, Math.round((cups / target) * 100));

  const commit = useCallback(
    (next: WaterState) => {
      void waterStore.set({ ...next, days: pruneWaterDays(next.days) });
    },
    [],
  );

  const setCups = (value: number) => {
    const v = Math.max(0, value);
    commit({ ...state, days: { ...state.days, [today]: v } });
  };

  const week = withinDays(state, 7);
  const month = withinDays(state, 30);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-3 py-2 text-foreground">
      <span className="text-[10px] text-muted-foreground">今日饮水</span>

      <span className="text-[clamp(1.4rem,2.4vw,2.2rem)] leading-none font-light tabular-nums">
        {cups}
        <span className="text-[0.5em] text-muted-foreground"> / {target} 杯</span>
      </span>

      <span className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-secondary/60">
        <span
          className="block h-full rounded-full bg-sky-400 transition-[width] duration-300"
          style={{ width: pct + '%' }}
        />
      </span>

      <div className="flex items-center gap-2">
        <button
          type="button"
          title="少一杯"
          onClick={() => setCups(cups - 1)}
          className="grid size-6 place-items-center rounded-full bg-secondary/70 text-muted-foreground hover:text-foreground"
        >
          <Minus className="size-3" />
          <span className="sr-only">少一杯</span>
        </button>
        <button
          type="button"
          title="多一杯"
          onClick={() => setCups(cups + 1)}
          className="grid size-6 place-items-center rounded-full bg-sky-500/80 text-white hover:bg-sky-500"
        >
          <Plus className="size-3" />
          <span className="sr-only">多一杯</span>
        </button>
        <button
          type="button"
          title="调整目标杯数"
          onClick={() =>
            commit({ ...state, target: target >= 12 ? 4 : target + 2 })
          }
          className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          目标 {target}
        </button>
      </div>

      <p className="text-[10px] tabular-nums text-muted-foreground">
        本周达标 {week.hit}/{week.total} · 本月 {month.hit}/{month.total}
      </p>
    </div>
  );
}
