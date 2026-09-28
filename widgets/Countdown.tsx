// 倒计时小组件：到某个日期还剩多少天
interface Props {
  title?: string;
  /** YYYY-MM-DD */
  date?: string;
}

function daysUntil(date: string) {
  // 按天算，避开时分秒带来的 ±1 误差
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export default function Countdown({ title = '倒计时', date }: Props) {
  const days = date ? daysUntil(date) : null;

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
        {passed ? '天前' : days === 0 ? '就是今天' : '天后'}
      </span>
      <span className="text-[10px] text-muted-foreground tabular-nums">{date}</span>
    </div>
  );
}