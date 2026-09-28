// 磁贴图标：把 IconSpec 解析成实际画面。
//
// 四种来源（见 lib/types.ts 的 IconKind）：
//   upload → iconStore 里的 data URL（找不到就退化成文字）
//   text   → 取一个字，配底色
//   color  → 纯色块
//   online → faviconCandidates() 逐个尝试，全挂就退化成文字
import { useEffect, useState } from 'react';

import { faviconCandidates, hostOf, initialOf } from '@/lib/favicon';
import { useIconStore } from '@/lib/hooks';
import type { IconSpec } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  icon: IconSpec;
  title: string;
  url?: string;
  className?: string;
  /** 文字图标用的字号类，随容器尺寸由调用方给 */
  glyphClass?: string;
}

/** 由域名稳定推导一个颜色，让没配图标的站点也有辨识度 */
function hueOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) % 360;
  }
  return h;
}

export default function TileIcon({
  icon,
  title,
  url = '',
  className,
  glyphClass = 'text-lg',
}: Props) {
  const store = useIconStore();
  const [candidate, setCandidate] = useState(0);

  const candidates = icon.kind === 'online' ? faviconCandidates(url) : [];
  useEffect(() => setCandidate(0), [url, icon.kind]);

  const uploaded = icon.kind === 'upload' && icon.value ? store[icon.value] : '';

  if (uploaded) {
    return (
      <img
        src={uploaded}
        alt=""
        draggable={false}
        className={cn('size-full object-contain', className)}
      />
    );
  }

  if (icon.kind === 'online' && candidate < candidates.length) {
    return (
      <img
        src={candidates[candidate]}
        alt=""
        draggable={false}
        className={cn('size-full object-contain', className)}
        onError={() => setCandidate((i) => i + 1)}
      />
    );
  }

  // 文字 / 纯色 / 前面几种都失败的兜底
  const text = icon.kind === 'text' ? icon.value || initialOf(title, url) : '';
  const seed = hostOf(url) || title;
  const hue = hueOf(seed);
  const bg =
    icon.kind === 'color'
      ? icon.value || `hsl(${hue} 55% 45%)`
      : icon.bg || `hsl(${hue} 55% 45%)`;
  const fg = icon.fg || '#fff';

  return (
    <span
      className={cn(
        'grid size-full place-items-center font-medium select-none',
        glyphClass,
        className,
      )}
      style={{ background: bg, color: fg }}
    >
      {text || initialOf(title, url)}
    </span>
  );
}