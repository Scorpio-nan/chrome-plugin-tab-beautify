// 壁纸系统：精选图片（本地 SVG，离线可用）、动态壁纸（本地视频库 + CSS 动画预设 + 视频链接）、渐变预设。
//
// 精选图片走 public/wallpapers/*.svg（由 scripts/gen_wallpapers.py 生成），
// 不依赖任何外部图床，所以不需要 host_permissions，断网也能用。
import { browser } from 'wxt/browser';
import {
  DEFAULT_MEDIA_BASE,
  dynamicCoverSrc,
  dynamicVideoSrc,
  dynamicWallpaperLabel,
} from './dynamic-wallpapers';
import { getBgImage } from './storage';
import type { BackgroundStyle } from './types';

/* ---------- 精选图片 ---------- */

export interface WallpaperImage {
  id: string;
  label: string;
  /** public/ 下的相对路径，或用户粘贴的在线图片链接 */
  src: string;
}

export interface WallpaperCategory {
  id: string;
  label: string;
  images: WallpaperImage[];
}

const img = (id: string, label: string): WallpaperImage => ({
  id,
  label,
  src: `/wallpapers/${id}.svg`,
});

export const WALLPAPER_CATEGORIES: WallpaperCategory[] = [
  { id: 'nature', label: '自然', images: [img('nature-1', '晨雾丘陵'), img('nature-2', '苔原湖泊')] },
  { id: 'forest', label: '森林', images: [img('forest-1', '云杉夜色'), img('forest-2', '晨光林间')] },
  { id: 'city', label: '建筑', images: [img('city-1', '暮色天际线'), img('city-2', '霓虹都市')] },
  { id: 'travel', label: '旅行', images: [img('travel-1', '落日沙丘'), img('travel-2', '海岸公路')] },
  { id: 'ocean', label: '海洋', images: [img('ocean-1', '叠浪'), img('ocean-2', '深海微光')] },
  { id: 'starry', label: '星空', images: [img('starry-1', '银河'), img('starry-2', '极光之夜')] },
  { id: 'anime', label: '动漫', images: [img('anime-1', '粉色天空'), img('anime-2', '夏日晚霞')] },
  { id: 'tech', label: '技术', images: [img('tech-1', '网格地平线'), img('tech-2', '流体色块')] },
];

export const ALL_WALLPAPERS: WallpaperImage[] = WALLPAPER_CATEGORIES.flatMap(
  (c) => c.images,
);

/* ---------- 动态壁纸（纯 CSS 动画预设） ---------- */

export interface AnimatedPreset {
  key: string;
  label: string;
  /** 底色：一层渐变天空 */
  sky: string;
  /** 漂移光斑的颜色（3 个，各自错开相位） */
  blobs: [string, string, string];
  /** 一轮动画的秒数 */
  duration: number;
}

export const ANIMATED_PRESETS: AnimatedPreset[] = [
  {
    key: 'aurora',
    label: '极光',
    sky: 'linear-gradient(160deg,#050b1d 0%,#0b2340 55%,#04101f 100%)',
    blobs: ['#3ef2c6', '#4f8cff', '#a56bff'],
    duration: 22,
  },
  {
    key: 'dawn',
    label: '晨曦',
    sky: 'linear-gradient(180deg,#1b1035 0%,#43205a 45%,#b1556a 100%)',
    blobs: ['#ffb36b', '#ff6f91', '#8e7cc3'],
    duration: 26,
  },
  {
    key: 'lagoon',
    label: '潟湖',
    sky: 'linear-gradient(165deg,#012a3a 0%,#0a5c6e 60%,#04384c 100%)',
    blobs: ['#41d1c4', '#2f9ddb', '#b6f2d8'],
    duration: 24,
  },
  {
    key: 'ember',
    label: '余烬',
    sky: 'linear-gradient(170deg,#1a0b12 0%,#3d1220 50%,#12060a 100%)',
    blobs: ['#ff7a45', '#ff3d68', '#ffc46b'],
    duration: 20,
  },
  {
    key: 'violet',
    label: '紫电',
    sky: 'linear-gradient(150deg,#0b0620 0%,#241056 55%,#080418 100%)',
    blobs: ['#8b5cf6', '#22d3ee', '#f472b6'],
    duration: 28,
  },
  {
    key: 'moss',
    label: '青苔',
    sky: 'linear-gradient(160deg,#07160f 0%,#123a26 55%,#050f0a 100%)',
    blobs: ['#7ee081', '#2fa36b', '#d7f36b'],
    duration: 25,
  },
];

export function getAnimatedPreset(key: string): AnimatedPreset | undefined {
  return ANIMATED_PRESETS.find((p) => p.key === key);
}

/* ---------- 工具 ---------- */

/** public/ 资源要转成扩展自身的 URL；已经是 http(s)/data 的原样返回 */
export function resolveAssetSrc(src: string): string {
  if (!src.startsWith('/')) return src;
  try {
    const getURL = browser.runtime.getURL as (path: string) => string;
    return getURL(src);
  } catch {
    return src;
  }
}

/** 把壁纸描述翻译成 CSS background 值（图片/渐变/纯色用得上） */
export function wallpaperCss(style: BackgroundStyle, uploadedDataUrl = ''): string {
  switch (style.type) {
    case 'gradient':
    case 'color':
      return style.value;
    case 'photo':
      return `url("${resolveAssetSrc(style.value)}") center center / cover no-repeat`;
    // 动态壁纸在「缩略图 / 快照」这类只能画静态图的场合，就画它的封面
    case 'dynamic': {
      const cover = dynamicCoverSrc(style.value);
      return cover
        ? `url("${cover}") center center / cover no-repeat`
        : 'linear-gradient(135deg,#1f2937 0%,#0b1220 100%)';
    }
    case 'image':
      return uploadedDataUrl
        ? `url("${uploadedDataUrl}") center center / cover no-repeat`
        : 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)';
    default:
      return 'transparent';
  }
}

/** 设置面板里显示用的壁纸名字 */
export function wallpaperLabel(style: BackgroundStyle): string {
  switch (style.type) {
    case 'photo': {
      const hit = ALL_WALLPAPERS.find((w) => w.src === style.value);
      return hit ? hit.label : '在线图片';
    }
    case 'animated':
      return `${getAnimatedPreset(style.value)?.label ?? '动态'} · 动态`;
    case 'video':
      return '视频壁纸';
    case 'dynamic':
      return dynamicWallpaperLabel(style.value);
    case 'gradient':
      return '渐变背景';
    case 'color':
      return '纯色背景';
    case 'image':
      return '自定义上传';
  }
}

/* ---------- 光斑位置（渲染与快照共用） ---------- */

/**
 * 动态壁纸三团光斑的起始位置（占容器的 %），与预设里 blobs 的顺序一一对应。
 * WallpaperLayer 渲染用它，下载壁纸画快照也用同一份，保证「看到的」和「存下来的」一致。
 */
export const ANIMATED_BLOB_SPOTS: [number, number][] = [
  [12, 18],
  [58, 34],
  [30, 70],
];


/* ---------- 最近使用（storage.local） ---------- */

const RECENT_KEY = 'recentWallpapers';
const RECENT_MAX = 8;

/** 上传图（data URL 巨大）不进历史，只记可复用的描述 */
export type WallpaperRef = Exclude<BackgroundStyle, { type: 'image' }>;

export async function getRecentWallpapers(): Promise<WallpaperRef[]> {
  const r = (await browser.storage.local.get(RECENT_KEY)) as {
    recentWallpapers?: WallpaperRef[];
  };
  return Array.isArray(r[RECENT_KEY]) ? r[RECENT_KEY]!.slice(0, RECENT_MAX) : [];
}

export async function pushRecentWallpaper(ref: WallpaperRef): Promise<void> {
  const list = await getRecentWallpapers();
  const key = JSON.stringify(ref);
  const next = [ref, ...list.filter((x) => JSON.stringify(x) !== key)].slice(
    0,
    RECENT_MAX,
  );
  await browser.storage.local.set({ [RECENT_KEY]: next });
}

export function onRecentWallpapersChanged(cb: (list: WallpaperRef[]) => void): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area === 'local' && changes[RECENT_KEY]) {
      getRecentWallpapers().then(cb);
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/* ---------- 右键菜单：随机壁纸 / 下载壁纸 ---------- */

const sameStyle = (a: BackgroundStyle, b: BackgroundStyle) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * 从系统预设里随机挑一张壁纸（精选图片 + 动态壁纸各算一格）。
 * 排除当前正在用的那个，避免"点了随机结果画面没变"。
 */
export function randomPresetWallpaper(current: BackgroundStyle): WallpaperRef {
  const pool: WallpaperRef[] = [
    ...ALL_WALLPAPERS.map<WallpaperRef>((w) => ({ type: 'photo', value: w.src })),
    ...ANIMATED_PRESETS.map<WallpaperRef>((p) => ({ type: 'animated', value: p.key })),
  ];
  const rest = pool.filter((x) => !sameStyle(x, current));
  const list = rest.length > 0 ? rest : pool;
  return list[Math.floor(Math.random() * list.length)];
}

/** 只认顶层逗号——括号里的（rgba(0, 0, 0, .5)）不能拆 */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of input) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** 色标拆成「颜色 + 可选位置」，位置只在括号外面才算 */
function splitStop(raw: string): { color: string; at: number | null } {
  let depth = 0;
  let lastSpace = -1;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if ((ch === ' ' || ch === '\t') && depth === 0) lastSpace = i;
  }
  if (lastSpace < 0) return { color: raw, at: null };
  const tail = raw.slice(lastSpace + 1);
  const pct = /^(-?[\d.]+)%$/.exec(tail);
  if (!pct) return { color: raw, at: null };
  return { color: raw.slice(0, lastSpace).trim(), at: Number(pct[1]) / 100 };
}

/** 没标位置的色标按等距铺开（一个就是 0） */
function fillStops(raw: string[]) {
  const stops = raw.map(splitStop);
  return stops.map((s, i) => ({
    color: s.color,
    at: s.at ?? (stops.length <= 1 ? 0 : i / (stops.length - 1)),
  }));
}

/** CSS 角度约定：0deg 朝上、90deg 朝右；转成单位向量 */
function angleOf(first: string): number | null {
  const deg = /^(-?[\d.]+)deg$/.exec(first);
  if (deg) return (Number(deg[1]) * Math.PI) / 180;
  const dir = /^to\s+(.+)$/.exec(first);
  if (!dir) return null;
  const compass: Record<string, number> = {
    top: 0,
    'top right': 45,
    right: 90,
    'bottom right': 135,
    bottom: 180,
    'bottom left': 225,
    left: 270,
    'top left': 315,
  };
  const key = dir[1].trim().replace(/\s+/g, ' ');
  return key in compass ? (compass[key] * Math.PI) / 180 : null;
}

type ParsedCss =
  | { kind: 'solid'; color: string }
  | { kind: 'linear'; angle: number; stops: { color: string; at: number }[] }
  | { kind: 'radial'; cx: number; cy: number; stops: { color: string; at: number }[] };

/**
 * 极简 CSS 背景解析：只覆盖本项目会写进 config 的三种形态（纯色 / 线性渐变 / 径向渐变）。
 * 设置面板里的 BG_PRESETS 和动态壁纸的天空底色都在这个范围内。
 */
function parseCss(css: string): ParsedCss {
  const value = css.trim();
  const fn = /^([a-z-]+)-gradient\((.*)\)$/is.exec(value);
  if (!fn) return { kind: 'solid', color: value || '#0b1220' };

  const [, name, inner] = fn;
  const parts = splitTopLevel(inner);

  if (name === 'radial') {
    let cx = 0.5;
    let cy = 0.5;
    let rest = parts;
    const at = /^(?:circle|ellipse)?\s*at\s+([\d.]+)%\s+([\d.]+)%\s*$/i.exec(parts[0] ?? '');
    if (at) {
      cx = Number(at[1]) / 100;
      cy = Number(at[2]) / 100;
      rest = parts.slice(1);
    } else if (/^(circle|ellipse)\b/i.test(parts[0] ?? '')) {
      rest = parts.slice(1);
    }
    return { kind: 'radial', cx, cy, stops: fillStops(rest) };
  }

  // linear / conic 一律按线性画——conic 预设目前不存在，别为它加复杂度
  const angle = parts.length > 1 ? angleOf(parts[0]) : null;
  return {
    kind: 'linear',
    angle: angle ?? Math.PI, // CSS 缺省是 to bottom
    stops: fillStops(angle === null ? parts : parts.slice(1)),
  };
}

function paintCss(ctx: CanvasRenderingContext2D, css: string, w: number, h: number) {
  const addStops = (g: CanvasGradient, stops: { color: string; at: number }[]) => {
    for (const s of stops) {
      try {
        g.addColorStop(Math.min(1, Math.max(0, s.at)), s.color);
      } catch {
        // 认不出的颜色写法就跳过这个色标，宁可少一档渐变也不要整体失败
      }
    }
  };

  const parsed = parseCss(css);
  if (parsed.kind === 'solid') {
    ctx.fillStyle = parsed.color;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (parsed.kind === 'linear') {
    const dx = Math.sin(parsed.angle);
    const dy = -Math.cos(parsed.angle);
    const len = Math.abs(w * dx) + Math.abs(h * dy);
    const g = ctx.createLinearGradient(
      w / 2 - (dx * len) / 2,
      h / 2 - (dy * len) / 2,
      w / 2 + (dx * len) / 2,
      h / 2 + (dy * len) / 2,
    );
    addStops(g, parsed.stops);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const cx = parsed.cx * w;
  const cy = parsed.cy * h;
  // 半径取最远角，跟 CSS 默认的 farthest-corner 对齐
  const r = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(w - cx, cy),
    Math.hypot(cx, h - cy),
    Math.hypot(w - cx, h - cy),
  );
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  addStops(g, parsed.stops);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** 2K 快照：渐变 / 纯色直接铺；动态壁纸按当前预设"拍一张"静态图 */
async function snapshot(css: string, animatedKey?: string): Promise<Blob> {
  const w = 2560;
  const h = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持画布导出，换一张在线图片试试');

  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, w, h);

  const preset = animatedKey ? getAnimatedPreset(animatedKey) : undefined;
  paintCss(ctx, preset ? preset.sky : css, w, h);

  if (preset) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    try {
      ctx.filter = 'blur(' + Math.round(h * 0.05) + 'px)';
    } catch {
      // 老版本不支持 ctx.filter，那就靠光斑本身的柔和边缘，不影响导出
    }
    preset.blobs.forEach((color, i) => {
      const spot = ANIMATED_BLOB_SPOTS[i % ANIMATED_BLOB_SPOTS.length];
      // 容器里的光斑是 size-[55%]，圆心 = 起始位置 + 半径
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(
        ((spot[0] + 27.5) / 100) * w,
        ((spot[1] + 27.5) / 100) * h,
        w * 0.275,
        h * 0.275,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
    ctx.restore();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('壁纸导出失败，请重试');
  return blob;
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

/** 同一个格式的各种写法，统一收成浏览器认的那个后缀 */
const EXT_ALIAS: Record<string, string> = {
  jpeg: 'jpg',
  jfif: 'jpg',
  svgz: 'svg',
};

/** 后缀优先信 MIME，其次猜链接路径，最后兜 png */
function extOf(src: string, mime: string): string {
  const byMime = MIME_EXT[mime.split(';')[0].trim().toLowerCase()];
  if (byMime) return byMime;
  const path = src.split('?')[0].split('#')[0];
  const hit = /\.([a-z0-9]{2,4})$/i.exec(path);
  const guess = hit ? hit[1].toLowerCase() : '';
  if (EXT_ALIAS[guess]) return EXT_ALIAS[guess];
  if (guess && Object.values(MIME_EXT).includes(guess)) return guess;
  return 'png';
}

async function fetchBlob(src: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(src);
  } catch {
    throw new Error('这张壁纸是跨域在线图，浏览器不允许直接拉取，改选一张系统预设吧');
  }
  if (!res.ok) throw new Error('壁纸下载失败（HTTP ' + res.status + '）');
  return res.blob();
}

/** 用 <a download> 存盘——新标签页就是扩展自己的页面，同源 blob 不需要 downloads 权限 */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface DownloadedWallpaper {
  /** 实际存盘的文件名，用来提示用户 */
  fileName: string;
  /** file = 原图 / 视频；snapshot = 渐变或动态壁纸导出的 PNG 快照 */
  kind: 'file' | 'snapshot';
}

/**
 * 把当前壁纸保存到本地。
 *
 * 图片和视频走 fetch + <a download>；渐变、纯色、动态壁纸本身不是位图，
 * 就按同一套参数在 canvas 上画一张 2560×1440 的 PNG 快照，做到"存下来跟屏幕上一样"。
 */
export async function downloadWallpaper(
  style: BackgroundStyle,
  /** 动态壁纸的视频从这个本地服务取（npm run media），拿不到就只存封面 */
  mediaBaseUrl = DEFAULT_MEDIA_BASE,
): Promise<DownloadedWallpaper> {
  let blob: Blob;
  let kind: 'file' | 'snapshot' = 'snapshot';
  let ext = 'png';

  if (style.type === 'image') {
    const dataUrl = await getBgImage();
    if (!dataUrl) throw new Error('当前没有已上传的壁纸，先在设置里传一张');
    blob = await fetchBlob(dataUrl);
    ext = extOf('', blob.type);
    kind = 'file';
  } else if (style.type === 'photo' || style.type === 'video') {
    const src = resolveAssetSrc(style.value);
    blob = await fetchBlob(src);
    ext = extOf(src, blob.type);
    kind = 'file';
  } else if (style.type === 'dynamic') {
    const cover = dynamicCoverSrc(style.value);
    if (!cover) throw new Error('这张动态壁纸已经不在列表里了，换一张试试');
    try {
      // 优先存视频本体（需要 npm run media 在跑），服务不在就退回存封面
      blob = await fetchBlob(dynamicVideoSrc(mediaBaseUrl, style.value));
      ext = 'mp4';
    } catch {
      blob = await fetchBlob(cover);
      ext = extOf(cover, blob.type);
    }
    kind = 'file';
  } else {
    blob = await snapshot(
      style.type === 'animated' ? '' : style.value,
      style.type === 'animated' ? style.value : undefined,
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  // 标签里出现 \ / : * ? " < > | 会让 Windows 存不下，一律换成 -
  const safeLabel = wallpaperLabel(style).replace(/[\\/:*?"<>|]+/g, '-');
  const fileName = 'wetab-' + safeLabel + '-' + stamp + '.' + ext;
  saveBlob(blob, fileName);
  return { fileName, kind };
}
