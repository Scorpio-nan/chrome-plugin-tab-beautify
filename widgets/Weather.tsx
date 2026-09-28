// 天气小组件：走 background 拉 open-meteo（绕 CORS + 20 分钟缓存）
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { describeWeather, fetchWeather, type WeatherData } from '@/lib/weather';
import { cn } from '@/lib/utils';

interface Props {
  city: string;
  lat: number;
  lon: number;
}

export default function Weather({ city, lat, lon }: Props) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    fetchWeather(lat, lon)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '天气获取失败'));
  }, [lat, lon]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
        加载天气中…
      </div>
    );
  }

  const desc = describeWeather(data.code);

  return (
    <div className="group/wx flex h-full w-full flex-col justify-center gap-1 px-2 text-foreground">
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none">{desc.icon}</span>
        <span className="text-[clamp(1.1rem,1.8vw,1.9rem)] leading-none font-light tabular-nums">
          {Math.round(data.temp)}°
        </span>
        <button
          type="button"
          onClick={load}
          title="刷新天气"
          className={cn(
            'ml-auto rounded-md p-1 text-muted-foreground opacity-0 transition-opacity',
            'hover:text-foreground group-hover/wx:opacity-100 focus-visible:opacity-100',
          )}
        >
          <RefreshCw className="size-3.5" />
          <span className="sr-only">刷新天气</span>
        </button>
      </div>
      <div className="truncate text-[11px] leading-tight text-muted-foreground">
        {city} · {desc.text} · 风 {Math.round(data.windSpeed)} km/h
      </div>
    </div>
  );
}