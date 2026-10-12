// 倒计时小组件：到某个日期还剩多少天。
// 支持「不重复 / 每年 / 每月」三种（上游 F30 的「不重复 / 每年 / 每月」）。
interface Props {
  title?: string;
  /** YYYY-MM-DD */
  date?: string;
  /** 重复方式：none 一次性 · yearly 每年 · monthly 每月 */
  repeat?: string;
}

function daysUntil(date: string, repeat = 'none') {
  // 按天算，避开时分秒带来的 ±1 误差
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (repeat === 'yearly') {
    let next = new Date(now.getFullYear(), target.getMonth(), target.getDate());
    if (next.getTime() < today.getTime()) {
      next = new Date(now.getFullYear() + 1, target.getMonth(), target.getDate());
    }
    return Math.round((next.getTime() - today.getTime()) / 86400000);
  }
  if (repeat === 'monthly') {
    const day = target.getDate();
    let next = new Date(now.getFullYear(), now.getMonth(), day);
    if (next.getTime() < today.getTime()) {
      next = new Date(now.getFullYear(), now.getMonth() + 1, day);
    }
    return Math.round((next.getTime() - today.getTime()) / 86400000);
  }
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function Countdown({ title = '倒计时', date, repeat = 'none' }: Props) {
  const days = date ? daysUntil(date, repeat) : null;

  if (days === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
        <span className="text-[11px] text-muted-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">
          右键磁贴 → 编辑，设一个日期
        </span>
      </div>
    );
  }

  const passed = days < 0;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-foreground">
      <span className="max-w-full truncate px-2 text-[11px] text-muted-foreground">
        {title}
      </span>
      <span className="text-[clamp(1.5rem,2.6vw,2.6rem)] leading-none font-light tabular-nums">
        {Math.abs(days)}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {days === 0
          ? '就是今天'
          : passed
            ? '天前'
            : repeat === 'yearly'
              ? '天后 · 每年'
              : repeat === 'monthly'
                ? '天后 · 每月'
                : '天后'}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">{date}</span>
    </div>
  );
}
