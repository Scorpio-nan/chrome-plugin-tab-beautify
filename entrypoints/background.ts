// 后台服务工作线程：天气代理（含缓存）、右键菜单、空心消息路由
import { appendTile, currentPage, getNav, link, setNav } from '../lib/nav';
import { searchUrl } from '../lib/search';
import { getConfig } from '../lib/storage';
import { describeWeather } from '../lib/weather';

// ---- 天气代理（页面发消息，这里 fetch，绕开页面 CORS）+ 20 分钟缓存 ----
interface WeatherCache {
  temp: number;
  windSpeed: number;
  code: number;
  isDay: boolean;
  updatedAt: number;
  humidity?: number;
  precipitation?: number;
  pressure?: number;
  apparent?: number;
  hours?: { time: string; temp: number; code: number }[];
  days?: { date: string; min: number; max: number; code: number }[];
  sunrise?: string;
  sunset?: string;
}
const CACHE_KEY = 'weatherCache';
const CACHE_TTL = 20 * 60 * 1000;

async function weatherFetch(lat: number, lon: number) {
  try {
    const cached = (await browser.storage.local.get(CACHE_KEY))[CACHE_KEY] as
      | WeatherCache
      | undefined;
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL) {
      return { ok: true, data: cached };
    }
    // current 取实况，hourly 取未来 24 小时，daily 取未来 7 天（上游「24小时预报、未来7天预报」）
    const params = [
      `latitude=${lat}`,
      `longitude=${lon}`,
      'current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,surface_pressure',
      'hourly=temperature_2m,weather_code',
      'daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
      'forecast_days=7',
      'timezone=auto',
    ].join('&');
    const url = `https://api.open-meteo.com/v1/forecast?${params}`;
    const res = await fetch(url);
    const data = await res.json();
    const cur = data?.current;
    if (!cur) return { ok: false, error: '天气服务暂无数据' };

    // 从整点序列里切出「现在开始」的 24 小时
    const hourlyTime: string[] = data?.hourly?.time ?? [];
    const hourlyTemp: number[] = data?.hourly?.temperature_2m ?? [];
    const hourlyCode: number[] = data?.hourly?.weather_code ?? [];
    const stamp = String(cur.time ?? '').slice(0, 13);
    let start = hourlyTime.findIndex((t) => t.slice(0, 13) >= stamp);
    if (start < 0) start = 0;
    const hours = hourlyTime
      .slice(start, start + 24)
      .map((time, i) => ({
        time,
        temp: hourlyTemp[start + i],
        code: hourlyCode[start + i],
      }))
      .filter((h) => typeof h.temp === 'number');

    const daily = data?.daily;
    const days = Array.isArray(daily?.time)
      ? (daily.time as string[]).map((date, i) => ({
          date,
          min: daily.temperature_2m_min?.[i],
          max: daily.temperature_2m_max?.[i],
          code: daily.weather_code?.[i],
        }))
      : [];

    const out: WeatherCache = {
      temp: cur.temperature_2m,
      windSpeed: cur.wind_speed_10m,
      code: cur.weather_code,
      isDay: cur.is_day === 1,
      humidity: cur.relative_humidity_2m,
      precipitation: cur.precipitation,
      pressure: cur.surface_pressure,
      apparent: cur.apparent_temperature,
      hours,
      days,
      sunrise: String(daily?.sunrise?.[0] ?? '').slice(11, 16),
      sunset: String(daily?.sunset?.[0] ?? '').slice(11, 16),
      updatedAt: Date.now(),
    };
    void browser.storage.local.set({ [CACHE_KEY]: out });
    return { ok: true, data: out };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function geocode(city: string) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`,
    );
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return { ok: false, error: `未找到城市「${city}」` };
    return {
      ok: true,
      data: { lat: hit.latitude, lon: hit.longitude, name: hit.name },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 热搜/资讯数据源（F25/F36）：地址由用户在磁贴里填，可能是任意站点，
 * 所以走可选主机权限：拿到权限才 fetch，拿不到就明确回错，由组件提示去授权。
 */
async function trendingFetch(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return { ok: false, error: '数据源必须是 http(s) 地址' };
    }
    const origin = url.origin + '/*';
    const perm = { origins: [origin] } as unknown as Parameters<
      typeof browser.permissions.contains
    >[0];
    const has = await browser.permissions.contains(perm);
    if (!has) return { ok: false, error: 'needs-origin' };

    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    const text = await res.text();
    if (text.length > 2_000_000) return { ok: false, error: '返回内容过大' };
    try {
      return { ok: true, data: JSON.parse(text) };
    } catch {
      return { ok: false, error: '数据源不是 JSON' };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- 右键菜单 ----
function setupMenus() {
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: 'wetab-search-selection',
      title: '用「新标签页」搜索“%s”',
      contexts: ['selection'],
    });
    browser.contextMenus.create({
      id: 'wetab-add-tile',
      title: '添加到新标签页主页',
      contexts: ['link'],
    });
    // contexts: 'action' = 右键扩展图标那一下的菜单
    browser.contextMenus.create({
      id: 'wetab-open-sidepanel',
      title: '打开 WeTab 侧边栏',
      contexts: ['action'],
    });
    void syncSidebarMenu();
  });
}

/** 「右键打开 WeTab 侧边栏」这一项跟着 config.contextMenuSidebar 走 */
async function syncSidebarMenu() {
  const config = await getConfig();
  try {
    await browser.contextMenus.update('wetab-open-sidepanel', {
      visible: config.contextMenuSidebar,
    });
  } catch {
    // 菜单还没建好（首次安装的时序），下一次 onChanged 会补上
  }
}

async function openSidePanel(rawWindowId?: number) {
  try {
    // WXT 的 OnClickData 未必带 windowId，拿不到就退回最近聚焦的窗口
    const windowId =
      typeof rawWindowId === 'number'
        ? rawWindowId
        : (await browser.windows.getLastFocused()).id;
    if (typeof windowId !== 'number') return;
    await (
      browser as unknown as {
        sidePanel?: { open(target: { windowId: number }): Promise<void> };
      }
    ).sidePanel?.open({ windowId });
  } catch {
    // 非 Chrome 内核没有 sidePanel API，忽略即可
  }
}

async function openSearch(query: string) {
  const config = await getConfig();
  await browser.tabs.create({ url: searchUrl(config.searchEngine, query) });
}

/**
 * 把链接磁贴加到"当前正在看的那一页"。
 * 在后台直接改导航树，不依赖新标签页是否开着——storage 变化会推给所有打开的页面。
 */
async function addTileToCurrentPage(url: string, title: string) {
  const nav = await getNav();
  const page = currentPage(nav);
  if (!page) return { ok: false, error: '还没有可用的页面' };
  await setNav(appendTile(nav, nav.activeGroupId, page.id, link(title || url, url)));
  return { ok: true };
}

/** popup 和新标签页发过来的消息形状 */
interface BgMessage {
  type?: string;
  lat?: unknown;
  lon?: unknown;
  city?: unknown;
  url?: unknown;
  title?: unknown;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    setupMenus();
  });

  browser.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'wetab-search-selection' && info.selectionText) {
      void openSearch(info.selectionText);
    } else if (info.menuItemId === 'wetab-add-tile' && info.linkUrl) {
      void addTileToCurrentPage(info.linkUrl, info.linkUrl);
    } else if (info.menuItemId === 'wetab-open-sidepanel') {
      void openSidePanel((info as { windowId?: number }).windowId);
    }
  });

  // 设置面板里改「右键打开 WeTab 侧边栏」时，菜单要立刻跟着出现/消失
  browser.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') void syncSidebarMenu();
  });

  // 消息路由（MV3：直接 return Promise 即可）。
  // 监听器参数类型是 unknown，收窄成自己约定的形状再用。
  browser.runtime.onMessage.addListener((raw: unknown) => {
    const msg = (raw ?? {}) as BgMessage;
    switch (msg.type) {
      case 'weather:fetch':
        return weatherFetch(Number(msg.lat), Number(msg.lon));
      case 'weather:geocode':
        return geocode(String(msg.city));
      case 'trending:fetch':
        return trendingFetch(String(msg.url));
      case 'tile:add':
        return addTileToCurrentPage(
          String(msg.url),
          String(msg.title ?? msg.url),
        );
      default:
        return undefined;
    }
  });
});
