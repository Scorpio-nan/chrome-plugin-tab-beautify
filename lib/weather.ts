// 天气模块：页面只通过消息请求 background 拉数据（绕 CORS + 自带缓存）
import { browser } from 'wxt/browser';

export interface WeatherData {
  temp: number; // °C
  windSpeed: number; // km/h
  code: number; // WMO weather code
  isDay: boolean;
  updatedAt: number;
}

/** 结果缓存在 storage.local 里，20 分钟内直接返回，避免每次开新标签都请求 */
const CACHE_KEY = 'weatherCache';
const CACHE_TTL = 20 * 60 * 1000;

/** background 的天气/地理消息统一回 { ok, data } 或 { ok, error } */
interface MsgResult<T> {
  ok?: boolean;
  data?: T;
  error?: string;
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  // 先读缓存
  const c = (await browser.storage.local.get(CACHE_KEY)) as {
    weatherCache?: WeatherData;
  };
  const cached = c.weatherCache;
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL) {
    return cached;
  }
  const res = (await browser.runtime.sendMessage({
    type: 'weather:fetch',
    lat,
    lon,
  })) as MsgResult<WeatherData>;
  if (!res?.ok || !res.data) throw new Error(res?.error ?? '天气获取失败');
  return res.data;
}

export async function geocodeCity(city: string): Promise<{ lat: number; lon: number; name: string }> {
  const res = (await browser.runtime.sendMessage({
    type: 'weather:geocode',
    city,
  })) as MsgResult<{ lat: number; lon: number; name: string }>;
  if (!res?.ok || !res.data) throw new Error(res?.error ?? '城市未找到');
  return res.data;
}

/** WMO 天气代码 → 文案 + emoji */
export function describeWeather(code: number): { text: string; icon: string } {
  const map: Record<number, [string, string]> = {
    0: ['晴', '☀️'],
    1: ['晴间多云', '🌤️'],
    2: ['多云', '⛅'],
    3: ['阴', '☁️'],
    45: ['雾', '🌫️'],
    48: ['雾凇', '🌫️'],
    51: ['毛毛雨', '🌦️'],
    53: ['毛毛雨', '🌦️'],
    55: ['毛毛雨', '🌧️'],
    61: ['小雨', '🌧️'],
    63: ['中雨', '🌧️'],
    65: ['大雨', '🌧️'],
    71: ['小雪', '🌨️'],
    73: ['中雪', '🌨️'],
    75: ['大雪', '❄️'],
    77: ['米雪', '🌨️'],
    80: ['阵雨', '🌦️'],
    81: ['阵雨', '🌧️'],
    82: ['暴雨', '⛈️'],
    95: ['雷阵雨', '⛈️'],
    96: ['雷阵雨伴冰雹', '⛈️'],
    99: ['雷暴伴冰雹', '⛈️'],
  };
  const hit = map[code] ?? ['未知', '🌡️'];
  return { text: hit[0], icon: hit[1] };
}