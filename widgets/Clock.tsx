// 时钟小组件：时间 + 日期 + 问候语
import { useEffect, useState } from 'react';

interface Props {
  userName?: string;
  showSeconds?: boolean;
  showDate?: boolean;
  hour12?: boolean;
}

export default function Clock({
  userName,
  showSeconds = false,
  showDate = true,
  hour12 = false,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // 不显示秒就不必每秒重渲染
    const t = setInterval(() => setNow(new Date()), showSeconds ? 1000 : 15000);
    return () => clearInterval(t);
  }, [showSeconds]);

  const h = now.getHours();
  const greet = h < 6 ? '夜深了' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
  const time = now.toLocaleTimeString('zh-CN', {
    hour12,
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {}),
  });
  const date = now.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-foreground">
      <div className="text-[clamp(1.4rem,2.4vw,2.6rem)] leading-none font-light tracking-wide tabular-nums">
        {time}
      </div>
      {showDate && (
        <div className="text-center text-[11px] leading-tight text-muted-foreground">
          {greet}
          {userName ? `，${userName}` : ''} · {date}
        </div>
      )}
    </div>
  );
}