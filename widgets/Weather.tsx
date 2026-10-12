// 天气小组件：走 background 拉 open-meteo（绕 CORS + 20 分钟缓存）
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { describeWeather, fetchWeather, type WeatherData } from '@/lib/weather';
import type { WidgetSize } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  city: string;
  lat: number;
  lon: number;
  /** 尺寸决定展示多少：大尺寸才给 24 小时横向条 */
  size: WidgetSize;
}

export default function Weather({ city, lat, lon, size }: Props) {
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
  const hours = data.hours ?? [];
  const days = data.days ?? [];
  const showHourly = size !== 'sm' && hours.length > 0;
  const showDaily = size !== 'sm' && days.length > 0;

  return (
    <div className="thin-scroll group/wx flex h-full w-full flex-col gap-1.5 overflow-y-auto px-2 py-1.5 text-foreground">
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
        {city} · {desc.text}
        {typeof data.apparent === 'number' &&
          ' · 体感 ' + Math.round(data.apparent) + '°'}
      </div>

      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>风 {Math.round(data.windSpeed)} km/h</span>
        {typeof data.humidity === 'number' && <span>湿度 {data.humidity}%</span>}
        {typeof data.precipitation === 'number' && (
          <span>降水 {data.precipitation} mm</span>
        )}
        {typeof data.pressure === 'number' && (
          <span>气压 {Math.round(data.pressure)} hPa</span>
        )}
      </div>

      {showHourly && (
        <div className="thin-scroll -mx-0.5 flex shrink-0 gap-1 overflow-x-auto px-0.5 pb-0.5">
          {hours.slice(0, 24).map((h) => (
            <span
              key={h.time}
              className="flex shrink-0 flex-col items-center gap-0.5 rounded-md bg-secondary/50 px-1.5 py-1"
            >
              <span className="text-[9px] text-muted-foreground">
                {h.time.slice(11, 13)}时
              </span>
              <span className="text-[10px]">{describeWeather(h.code).icon}</span>
              <span className="text-[10px] tabular-nums">
                {Math.round(h.temp)}°
              </span>
            </span>
          ))}
        </div>
      )}

      {showDaily && (
        <div className="flex shrink-0 flex-col gap-0.5">
          {days.slice(0, 7).map((d, i) => (
            <div key={d.date} className="flex items-center gap-1.5 text-[10px]">
              <span className="w-9 shrink-0 text-muted-foreground">
                {i === 0 ? '今天' : d.date.slice(5)}
              </span>
              <span>{describeWeather(d.code).icon}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {Math.round(d.min)}°
              </span>
              <span className="tabular-nums">{Math.round(d.max)}°</span>
            </div>
          ))}
        </div>
      )}

      {(data.sunrise || data.sunset) && (
        <p className="shrink-0 text-[10px] text-muted-foreground">
          日出 {data.sunrise || '—'} · 日落 {data.sunset || '—'}
        </p>
      )}
    </div>
  );
}
