// 动态壁纸目录：封面来自 assets/thumbnails，视频来自 assets/videos，同名配对。
//
// 两者体积差着三个数量级，处理方式因此不同：
//   封面 58 张共 1.5MB —— 用 import.meta.glob 在构建期打进扩展包，断网也能显示；
//   视频 58 段近 2GB（单段最大 90MB）—— 绝不能进扩展包（build 会整份复制、zip
//   会撑爆、chrome://extensions 加载会卡死），改由 npm run media 起的本地静态
//   服务按需取用。服务没起来时背景退回显示封面，不会黑屏。
import { resolveAssetSrc } from './wallpaper';

/** 本地媒体服务的默认地址，和 scripts/serve-media.mjs 保持一致 */
export const DEFAULT_MEDIA_BASE = 'http://127.0.0.1:4321';

/** 构建期解析出来的封面表：'../assets/thumbnails/<id>.jpg' -> 打包后的 URL */
const COVER_URLS = import.meta.glob('../assets/thumbnails/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export interface DynamicWallpaper {
  /** assets/thumbnails/<id>.jpg 里的 <id>，同时也是视频文件名 */
  id: string;
  /** 打进扩展包的封面 URL，渲染前还要过一遍 resolveAssetSrc */
  cover: string;
  /** 1 起的序号。文件名是一串无意义的 id，界面上靠它给出可读的名字 */
  index: number;
}

/** 按 id 字典序排好，保证每次打开扩展看到的顺序一致 */
export const DYNAMIC_WALLPAPERS: DynamicWallpaper[] = Object.entries(COVER_URLS)
  .map(([path, cover]) => ({
    id: /([^/]+)\.jpg$/.exec(path)?.[1] ?? '',
    cover,
  }))
  .filter((w) => w.id !== '')
  .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  .map((w, i) => ({ ...w, index: i + 1 }));

export function getDynamicWallpaper(id: string): DynamicWallpaper | undefined {
  return DYNAMIC_WALLPAPERS.find((w) => w.id === id);
}

/** 封面的完整 URL（扩展内资源），找不到返回空串 */
export function dynamicCoverSrc(id: string): string {
  const hit = getDynamicWallpaper(id);
  return hit ? resolveAssetSrc(hit.cover) : '';
}

/** 视频地址 = 本地媒体服务 + /videos/<id>.mp4 */
export function dynamicVideoSrc(baseUrl: string, id: string): string {
  const base = (baseUrl || DEFAULT_MEDIA_BASE).trim().replace(/\/+$/, '');
  return base + '/videos/' + id + '.mp4';
}

/** 设置面板与「当前壁纸」里显示的名字 */
export function dynamicWallpaperLabel(id: string): string {
  const hit = getDynamicWallpaper(id);
  return hit ? '动态壁纸 ' + String(hit.index).padStart(2, '0') : '动态壁纸';
}

/**
 * 探一下本地视频服务在不在，返回视频段数；离线或超时返回 null。
 * 服务回了 Access-Control-Allow-Origin: *，所以扩展页面能直接 fetch。
 */
export async function probeMediaServer(
  baseUrl: string,
  timeoutMs = 1200,
): Promise<number | null> {
  const base = (baseUrl || DEFAULT_MEDIA_BASE).trim().replace(/\/+$/, '');
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(base + '/__health', {
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { videos?: number };
    return typeof data.videos === 'number' ? data.videos : 0;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
