// 壁纸分区（图稿三）：精选图片 / 动态壁纸 / 渐变背景 三段 + 右边缘那根浮动工具条。
//
// 数据来源全部本地：精选图片是 scripts/gen_wallpapers.py 生成的 SVG（public/wallpapers/），
// 动态壁纸是 assets/videos 里的本地视频（封面取 assets/thumbnails，视频由 npm run media
// 这个本地服务串流）+ 纯 CSS 漂移光斑，渐变背景是内置 CSS 值；
// 「自定义」再给两个出口——上传本地图片、粘贴在线图片/视频链接。不请求任何壁纸 API。
import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  Clock,
  CloudUpload,
  Images,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';

import { AnimatedWallpaper } from '@/components/WallpaperLayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider, Segmented } from '@/components/settings/panes';
import {
  DYNAMIC_WALLPAPERS,
  DEFAULT_MEDIA_BASE,
  dynamicCoverSrc,
  dynamicWallpaperLabel,
  probeMediaServer,
} from '@/lib/dynamic-wallpapers';
import { useConfig } from '@/lib/hooks';
import { setBgImage } from '@/lib/storage';
import type { BackgroundStyle } from '@/lib/types';
import { BG_PRESETS } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ALL_WALLPAPERS,
  ANIMATED_PRESETS,
  getRecentWallpapers,
  onRecentWallpapersChanged,
  pushRecentWallpaper,
  resolveAssetSrc,
  WALLPAPER_CATEGORIES,
  wallpaperCss,
  wallpaperLabel,
  type WallpaperCategory,
  type WallpaperRef,
} from '@/lib/wallpaper';

type Tab = 'photo' | 'animated' | 'gradient';
type Tool = 'params' | 'recent' | 'custom';

const TABS: { id: Tab; label: string }[] = [
  { id: 'photo', label: '精选图片' },
  { id: 'animated', label: '动态壁纸' },
  { id: 'gradient', label: '渐变背景' },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('读取失败'));
    r.readAsDataURL(file);
  });
}

/** 小节标题 + 内容：动态壁纸那一栏里分「视频壁纸 / 呼吸光效 / 在线链接」三截 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** 分类封面是否就是当前壁纸（当前 photo 的 src 落在该分类里） */
function categorySrc(photoSrc: string, c: WallpaperCategory): boolean {
  return c.images.some((i) => i.src === photoSrc);
}

/** 一张壁纸卡片：缩略图 + 居中标签，选中描白圈 */
function Thumb({
  label,
  active,
  background,
  children,
  onClick,
}: {
  label: string;
  active: boolean;
  background?: string;
  children?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        'relative aspect-[16/10] overflow-hidden rounded-xl border-2 transition-transform hover:scale-[1.02]',
        active ? 'border-white' : 'border-transparent',
      )}
    >
      {background ? (
        <span
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: background }}
        />
      ) : (
        children
      )}
      <span className="absolute inset-0 grid place-items-center bg-black/15 text-[15px] font-semibold text-white tile-label">
        {label}
      </span>
    </button>
  );
}

export default function WallpaperPane() {
  const { config, update } = useConfig();
  const [tab, setTab] = useState<Tab>(
    config.background.type === 'animated' ||
      config.background.type === 'video' ||
      config.background.type === 'dynamic'
      ? 'animated'
      : config.background.type === 'photo' || config.background.type === 'image'
        ? 'photo'
        : 'gradient',
  );
  /** 精选图片下钻到的分类，null = 只看分类封面 */
  const [category, setCategory] = useState<WallpaperCategory | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [onlineUrl, setOnlineUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  /** 本地视频服务的探活结果：null = 还没结果，数字 = 在线视频段数 */
  const [mediaOnline, setMediaOnline] = useState<number | null>(null);
  const [mediaDraft, setMediaDraft] = useState(config.mediaBaseUrl);
  const [note, setNote] = useState('');
  const [recent, setRecent] = useState<WallpaperRef[]>([]);
  const toolRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void getRecentWallpapers().then((list) => alive && setRecent(list));
    const off = onRecentWallpapersChanged(setRecent);
    return () => {
      alive = false;
      off();
    };
  }, []);

  /* 只有停在「动态壁纸」这一栏时才探本地视频服务，切走不打扰 */
  useEffect(() => {
    if (tab !== 'animated') return;
    let alive = true;
    setMediaOnline(null);
    void probeMediaServer(config.mediaBaseUrl).then(
      (n) => alive && setMediaOnline(n),
    );
    return () => {
      alive = false;
    };
  }, [tab, config.mediaBaseUrl]);

  /* 别的标签页改了服务地址，这边的输入框跟着同步 */
  useEffect(() => setMediaDraft(config.mediaBaseUrl), [config.mediaBaseUrl]);

  /* 点工具条外面就收起浮层 */
  useEffect(() => {
    if (!tool) return;
    const onDown = (e: PointerEvent) => {
      if (!toolRef.current?.contains(e.target as Node)) setTool(null);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [tool]);

  const pick = (style: BackgroundStyle) => {
    update({ background: style });
    setNote('');
    if (style.type !== 'image') void pushRecentWallpaper(style);
  };

  const isCurrent = (style: BackgroundStyle) =>
    JSON.stringify(style) === JSON.stringify(config.background);

  /** 地址留空就回落到默认端口，改完立刻重新探活并让背景层换源 */
  const commitMediaBase = () => {
    const next = mediaDraft.trim() || DEFAULT_MEDIA_BASE;
    setMediaDraft(next);
    if (next !== config.mediaBaseUrl) update({ mediaBaseUrl: next });
  };

  /** 当前壁纸是精选图片时给出它的 src，否则 null（回调里拿不到联合类型收窄） */
  const photoSrc =
    config.background.type === 'photo' ? config.background.value : null;

  const onUploadBg = async (file?: File) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setNote('图片请小于 3MB');
      return;
    }
    await setBgImage(await readFileAsDataUrl(file));
    update({ background: { type: 'image' } });
    setNote('已设为壁纸');
  };

  /* ---------- 三段内容 ---------- */

  const photoBody = category ? (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setCategory(null)}
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        返回分类
      </button>
      <div className="grid grid-cols-2 gap-3">
        {category.images.map((img) => (
          <Thumb
            key={img.src}
            label={img.label}
            active={isCurrent({ type: 'photo', value: img.src })}
            background={`url("${resolveAssetSrc(img.src)}")`}
            onClick={() => pick({ type: 'photo', value: img.src })}
          />
        ))}
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {WALLPAPER_CATEGORIES.map((c) => (
          <Thumb
            key={c.id}
            label={c.label}
            active={photoSrc === null ? false : categorySrc(photoSrc, c)}
            background={`url("${resolveAssetSrc(c.images[0].src)}")`}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
        <span className="text-xs text-muted-foreground">在线图片链接</span>
        <div className="flex gap-2">
          <Input
            value={onlineUrl}
            onChange={(e) => setOnlineUrl(e.target.value)}
            placeholder="https://…/a.jpg"
            spellCheck={false}
            className="h-8"
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-8 shrink-0"
            disabled={!onlineUrl.trim()}
            onClick={() => pick({ type: 'photo', value: onlineUrl.trim() })}
          >
            应用
          </Button>
        </div>
      </div>
    </div>
  );

  const animatedBody = (
    <div className="flex flex-col gap-4">
      <Section title="视频壁纸">
        <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                mediaOnline === null
                  ? 'bg-muted-foreground/40'
                  : mediaOnline > 0
                    ? 'bg-emerald-400'
                    : 'bg-rose-400',
              )}
            />
            <span className="truncate text-[11px] text-muted-foreground">
              {mediaOnline === null
                ? '正在连接本地视频服务…'
                : mediaOnline > 0
                  ? `视频服务在线 · ${mediaOnline} 段`
                  : '服务没起来，背景停在封面'}
            </span>
            <Input
              value={mediaDraft}
              onChange={(e) => setMediaDraft(e.target.value)}
              onBlur={commitMediaBase}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              aria-label="本地视频服务地址"
              spellCheck={false}
              className="ml-auto h-7 w-44 shrink-0 text-[11px]"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            封面来自 assets/thumbnails；点一下就把 assets/videos 里的同名视频铺满整个背景、
            静音循环。视频近 2GB 不进扩展包，先在终端跑一句 npm run media。
          </p>
        </div>

        {DYNAMIC_WALLPAPERS.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            assets/thumbnails 下没有封面，动态壁纸暂时用不了。
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {DYNAMIC_WALLPAPERS.map((w) => {
              const active = isCurrent({ type: 'dynamic', value: w.id });
              return (
                <button
                  key={w.id}
                  type="button"
                  title={dynamicWallpaperLabel(w.id)}
                  aria-label={dynamicWallpaperLabel(w.id)}
                  onClick={() => pick({ type: 'dynamic', value: w.id })}
                  className={cn(
                    'relative aspect-[16/10] overflow-hidden rounded-xl border-2 transition-transform hover:scale-[1.03]',
                    active ? 'border-white' : 'border-transparent',
                  )}
                >
                  <img
                    src={dynamicCoverSrc(w.id)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover"
                  />
                  {active && (
                    <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-white text-black">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="呼吸光效">
        <div className="grid grid-cols-2 gap-3">
          {ANIMATED_PRESETS.map((p) => (
            <Thumb
              key={p.key}
              label={p.label}
              active={isCurrent({ type: 'animated', value: p.key })}
              onClick={() => pick({ type: 'animated', value: p.key })}
            >
              <AnimatedWallpaper presetKey={p.key} />
            </Thumb>
          ))}
        </div>
      </Section>

      <Section title="在线视频链接">
        <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
          <span className="text-xs text-muted-foreground">
            粘贴 mp4 / webm 链接，同样自动静音循环
          </span>
          <div className="flex gap-2">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…/loop.mp4"
              spellCheck={false}
              className="h-8"
            />
            <Button
              size="sm"
              variant="secondary"
              className="h-8 shrink-0"
              disabled={!videoUrl.trim()}
              onClick={() => pick({ type: 'video', value: videoUrl.trim() })}
            >
              应用
            </Button>
          </div>
          {config.background.type === 'video' && (
            <p className="text-xs text-muted-foreground">
              当前：{config.background.value.slice(0, 46)}
            </p>
          )}
        </div>
      </Section>
    </div>
  );

  const gradientBody = (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2.5">
        {BG_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            title={p.key}
            aria-label={`渐变 ${p.key}`}
            onClick={() => pick({ type: 'gradient', value: p.css })}
            className={cn(
              'aspect-[4/3] rounded-xl border-2 transition-transform hover:scale-[1.03]',
              isCurrent({ type: 'gradient', value: p.css })
                ? 'border-white'
                : 'border-transparent',
            )}
            style={{ background: p.css }}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
        <input
          type="color"
          aria-label="纯色背景"
          value={
            config.background.type === 'color'
              ? config.background.value
              : '#5b8def'
          }
          onChange={(e) => pick({ type: 'color', value: e.target.value })}
          className="h-9 w-14 cursor-pointer rounded-md border bg-transparent"
        />
        <span className="text-xs text-muted-foreground">纯色背景</span>
        <Sparkles className="ml-auto size-4 text-muted-foreground" />
      </div>
    </div>
  );

  /* ---------- 右边缘工具条 ---------- */

  const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
    { id: 'params', label: '壁纸参数', icon: <SlidersHorizontal className="size-4" /> },
    { id: 'recent', label: '最近使用', icon: <Clock className="size-4" /> },
    { id: 'custom', label: '自定义', icon: <CloudUpload className="size-4" /> },
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-5 pt-5 pb-3">
        <Segmented value={tab} options={TABS} onChange={setTab} />
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {tab === 'photo' ? photoBody : tab === 'animated' ? animatedBody : gradientBody}
      </div>

      <div
        ref={toolRef}
        className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
      >
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={() => setTool(tool === t.id ? null : t.id)}
            className={cn(
              'grid size-8 place-items-center rounded-xl transition-colors',
              tool === t.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {tool && (
        <div className="absolute right-12 top-1/2 z-20 w-60 -translate-y-1/2 rounded-xl border border-border bg-card p-3 text-card-foreground shadow-2xl">
          {tool === 'params' && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium text-muted-foreground">壁纸参数</p>
              <Slider
                label="遮罩浓度"
                value={config.overlay}
                min={0}
                max={0.7}
                step={0.02}
                onChange={(v) => update({ overlay: v })}
              />
              <Slider
                label="背景模糊"
                value={config.blur}
                min={0}
                max={24}
                suffix=" px"
                onChange={(v) => update({ blur: v })}
              />
            </div>
          )}

          {tool === 'recent' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">最近使用</p>
              {recent.length === 0 ? (
                <p className="text-xs text-muted-foreground">还没有记录</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {recent.map((r) => (
                    <button
                      key={JSON.stringify(r)}
                      type="button"
                      onClick={() => pick(r)}
                      className={cn(
                        'relative aspect-[16/10] overflow-hidden rounded-lg border-2',
                        isCurrent(r) ? 'border-white' : 'border-transparent',
                      )}
                    >
                      {r.type === 'animated' ? (
                        <AnimatedWallpaper presetKey={r.value} />
                      ) : (
                        <span
                          className="absolute inset-0 bg-center bg-cover"
                          style={{
                            background: wallpaperCss(r),
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                最多记 8 条，跨标签页同步。
              </p>
            </div>
          )}

          {tool === 'custom' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                自定义壁纸
              </p>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent/60">
                <CloudUpload className="size-4" />
                选择本地图片（≤3MB）
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void onUploadBg(e.target.files?.[0])}
                />
              </label>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                图片存 storage.local，不进同步盘；在线链接请优先用「精选图片 →
                在线图片链接」。
              </p>
              {config.background.type === 'image' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onClick={() =>
                    update({
                      background: { type: 'gradient', value: BG_PRESETS[0].css },
                    })
                  }
                >
                  移除自定义图片
                </Button>
              )}
              {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
            </div>
          )}
        </div>
      )}

      <div className="shrink-0 border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
        <Images className="mr-1 inline size-3.5" />
        当前壁纸：{wallpaperLabel(config.background)}
      </div>
    </div>
  );
}
