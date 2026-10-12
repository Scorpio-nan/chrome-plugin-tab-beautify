// 黄历小组件（上游 F18 的「农历 / 宜忌」部分）。
//
// 数据全部来自 lib/almanac.ts（lunar-javascript，本地计算，不联网）：
// 农历日期、干支、生肖、节气、节日、宜忌、冲煞、星宿、建除十二值星、彭祖百忌、喜福财方位。
import { useMemo } from 'react';

import { getAlmanac } from '@/lib/almanac';

export default function Almanac() {
  // 每次挂载算一次就够；跨零点重开新标签页会自然刷新
  const a = useMemo(() => getAlmanac(new Date()), []);

  return (
    <div className="thin-scroll h-full w-full overflow-y-auto px-2.5 py-2 text-foreground">
      <div className="flex items-baseline gap-2">
        <span className="text-[clamp(1.3rem,2vw,1.8rem)] leading-none font-light">
          {a.lunarText}
        </span>
        <span className="truncate text-[10px] text-muted-foreground">
          {a.ganZhi.year}年 · {a.zodiac} · {a.week}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
        {a.jieQi && (
          <span className="rounded bg-primary/20 px-1.5 py-0.5 text-foreground">
            {a.jieQi}
          </span>
        )}
        {a.festivals.map((f) => (
          <span key={f} className="rounded bg-secondary/70 px-1.5 py-0.5">
            {f}
          </span>
        ))}
        <span className="rounded bg-secondary/40 px-1.5 py-0.5">
          {a.ganZhi.month}月 {a.ganZhi.day}日
        </span>
      </div>

      <div className="mt-2 flex flex-col gap-1">
        <div className="flex gap-1.5">
          <span className="grid size-4 shrink-0 place-items-center rounded bg-emerald-500/25 text-[10px] text-emerald-200">
            宜
          </span>
          <span className="min-w-0 flex-1 text-[10px] leading-4">
            {a.yi.length > 0 ? a.yi.join(' · ') : '诸事不宜'}
          </span>
        </div>
        <div className="flex gap-1.5">
          <span className="grid size-4 shrink-0 place-items-center rounded bg-rose-500/25 text-[10px] text-rose-200">
            忌
          </span>
          <span className="min-w-0 flex-1 text-[10px] leading-4">
            {a.ji.length > 0 ? a.ji.join(' · ') : '百无禁忌'}
          </span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        <span className="truncate">冲 {a.chong || '—'}</span>
        <span className="truncate">煞{a.sha || '—'}</span>
        <span className="truncate">值星 {a.zhiXing || '—'}</span>
        <span className="truncate">
          {a.tianShen || '—'}
          {a.tianShenType ? ' · ' + a.tianShenType : ''}
        </span>
        <span className="truncate">星宿 {a.xiu || '—'}</span>
        <span className="truncate">纳音 {a.naYin || '—'}</span>
      </div>

      {a.pengZu && (
        <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
          彭祖百忌：{a.pengZu}
        </p>
      )}
      <p className="mt-1 truncate text-[10px] text-muted-foreground">
        喜神 {a.positions.xi || '—'} · 福神 {a.positions.fu || '—'} · 财神{' '}
        {a.positions.cai || '—'}
      </p>
    </div>
  );
}
