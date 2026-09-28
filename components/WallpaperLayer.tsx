// 背景层：把 config.background 翻译成画面。
//
// 六类来源（见 lib/types.ts 的 BackgroundStyle）：
//   gradient / color / photo / image → 一个 CSS background 值，静态
//   animated → 天空渐变 + 三团漂移光斑（纯 CSS，见 assets/global.css 的 wetab-drift）
//   video    → 用户给的 mp4/webm 链接，自动播放静音循环
//   dynamic  → assets/videos 里的本地视频（npm run media 提供），同名封面兜底
// 模糊只作用在这一层，上面的遮罩和磁贴不受影响；有模糊时放大 6% 避免出现透明边。
import { useEffect, useState } from 'react';
import {
  DEFAULT_MEDIA_BASE,
  dynamicCoverSrc,
  dynamicVideoSrc,
} from '@/lib/dynamic-wallpapers';
import { useLocal } from '@/lib/hooks';
import { getBgImage } from '@/lib/storage';
import type { BackgroundStyle } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  ANIMATED_BLOB_SPOTS,
  ANIMATED_PRESETS,
  getAnimatedPreset,
  resolveAssetSrc,
  wallpaperCss,
} from '@/lib/wallpaper';

/** 光斑位置和 lib/wallpaper 共用一份：导出的快照才能和屏幕上画的一致 */
const BLOB_SPOTS = ANIMATED_BLOB_SPOTS;

export function AnimatedWallpaper({
  presetKey,
  className,
}: {
  presetKey: string;
  className?: string;
}) {
  const preset = getAnimatedPreset(presetKey) ?? ANIMATED_PRESETS[0];

  return (
    <div
      className={cn('absolute inset-0 overflow-hidden', className)}
      style={{ background: preset.sky }}
      aria-hidden
    >
      {preset.blobs.map((color, i) => (
        <span
          key={color}
          className="wetab-blob absolute size-[55%] rounded-full opacity-60"
          style={{
            left: `${BLOB_SPOTS[i][0]}%`,
            top: `${BLOB_SPOTS[i][1]}%`,
            background: color,
            filter: 'blur(70px)',
            animationDuration: `${preset.duration}s`,
            animationDelay: `${(-preset.duration / 3) * i}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 动态壁纸：封面先铺底，视频加载出来后盖在上面静音循环。
 *
 * 视频近 2GB 不可能打进扩展包，走本地静态服务（npm run media）。服务没起时 <video>
 * 直接报错，我们就不再渲染它，画面停在封面上——不会黑屏，也不会一遍遍重试。
 */
export function DynamicWallpaper({
  id,
  baseUrl,
}: {
  id: string;
  baseUrl: string;
}) {
  const cover = dynamicCoverSrc(id);
  const src = dynamicVideoSrc(baseUrl, id);
  const [broken, setBroken] = useState(false);

  // 换视频、换服务地址都重新给一次机会
  useEffect(() => setBroken(false), [src]);

  if (!cover) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <span
        className="absolute inset-0 bg-center bg-cover"
        style={{ backgroundImage: `url("${cover}")` }}
      />
      {!broken && (
        <video
          key={src}
          className="absolute inset-0 size-full object-cover"
          src={src}
          poster={cover}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
        />
      )}
    </div>
  );
}

interface Props {
  background: BackgroundStyle;
  /** 背景模糊 px */
  blur?: number;
  /** 动态壁纸视频的服务地址（config.mediaBaseUrl） */
  mediaBaseUrl?: string;
  className?: string;
}

export default function WallpaperLayer({
  background,
  blur = 0,
  mediaBaseUrl = DEFAULT_MEDIA_BASE,
  className,
}: Props) {
  // 上传的壁纸体积大，单独存 storage.local 的 bgImage（sync 单条目只有 8KB）
  const uploaded = useLocal('bgImage', getBgImage, '');

  return (
    <div
      className={cn('absolute inset-0', className)}
      style={{
        filter: blur ? `blur(${blur}px)` : undefined,
        transform: blur ? 'scale(1.06)' : undefined,
      }}
      aria-hidden
    >
      {background.type === 'animated' ? (
        <AnimatedWallpaper presetKey={background.value} />
      ) : background.type === 'dynamic' ? (
        <DynamicWallpaper id={background.value} baseUrl={mediaBaseUrl} />
      ) : background.type === 'video' ? (
        <video
          className="absolute inset-0 size-full object-cover"
          src={resolveAssetSrc(background.value)}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: wallpaperCss(background, uploaded) }}
        />
      )}
    </div>
  );
}
