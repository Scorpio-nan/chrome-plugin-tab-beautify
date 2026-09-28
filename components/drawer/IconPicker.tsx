// 图标选择器：抽屉里那三段「在线图标 / 纯色图标 / 本地上传」。
//
// 与 IconSpec 的映射：
//   在线图标 → kind:'online'，由 faviconCandidates() 自动抓，抓不到退回首字
//   纯色图标 → 填了文字就是 kind:'text'（字 + 底色），没填就是 kind:'color'（纯色块）
//   本地上传 → kind:'upload'，裁成方形后由父组件落 iconStore
import { useRef, useState } from 'react';
import { ImageUp, Search } from 'lucide-react';

import TileIcon from '@/components/TileIcon';
import IconCropper from '@/components/drawer/IconCropper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { initialOf } from '@/lib/favicon';
import type { IconSpec } from '@/lib/types';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'online', label: '在线图标' },
  { id: 'color', label: '纯色图标' },
  { id: 'upload', label: '本地上传' },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** <input type="color"> 只认 #rrggbb，历史数据里可能是 hsl()，兜一下 */
function hexOr(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

interface Props {
  spec: IconSpec;
  fallbackTitle: string;
  fallbackUrl: string;
  /** 上传图标的预览图：新裁的 data URL，或编辑时的已存图标 */
  uploadedPreview: string;
  onChange: (spec: IconSpec) => void;
  onUpload: (dataUrl: string) => void;
  /** 编辑态下再裁一张时，旧图标要不要丢弃由父组件决定 */
  hasStoredUpload?: boolean;
}

export default function IconPicker({
  spec,
  fallbackTitle,
  fallbackUrl,
  uploadedPreview,
  onChange,
  onUpload,
  hasStoredUpload,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);

  const tab: Tab =
    spec.kind === 'upload' ? 'upload' : spec.kind === 'online' ? 'online' : 'color';

  const pickTab = (next: Tab) => {
    if (next === tab) return;
    if (next === 'online') onChange({ kind: 'online' });
    else if (next === 'upload') onChange({ ...spec, kind: 'upload', value: spec.kind === 'upload' ? spec.value : undefined });
    else onChange({ kind: 'color', value: hexOr(spec.value || spec.bg, '#4f46e5') });
  };

  const glyph = spec.kind === 'text' ? spec.value ?? '' : '';
  const solid = hexOr(
    spec.kind === 'color' ? spec.value : spec.bg,
    '#4f46e5',
  );
  const fg = hexOr(spec.fg, '#ffffff');

  /** 纯色 tab 上改文字：空 = 纯色块，非空 = 文字图标 */
  const setGlyph = (v: string) => {
    onChange(
      v.trim()
        ? { kind: 'text', value: v, bg: solid, fg }
        : { kind: 'color', value: solid },
    );
  };
  const setSolid = (v: string) => {
    onChange(glyph ? { kind: 'text', value: glyph, bg: v, fg } : { kind: 'color', value: v });
  };
  const setFg = (v: string) => {
    onChange({ kind: 'text', value: glyph || initialOf(fallbackTitle, fallbackUrl), bg: solid, fg: v });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-white/8 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pickTab(t.id)}
            className={cn(
              'h-8 flex-1 rounded-lg text-[13px] transition-colors',
              tab === t.id
                ? 'bg-white font-medium text-neutral-900 shadow-sm'
                : 'text-white/65 hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'online' &&
        (fallbackUrl.trim() ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/6 p-3">
            <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10">
              <TileIcon
                icon={spec}
                title={fallbackTitle}
                url={fallbackUrl}
                className="rounded-xl"
                glyphClass="text-xl"
              />
            </span>
            <p className="min-w-0 text-xs leading-relaxed text-white/55">
              已自动获取站点图标；
              <br />
              部分网站可能会获取失败
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl py-6 text-center">
            <Search className="size-9 text-white/25" strokeWidth={1.2} />
            <p className="text-xs leading-relaxed text-white/45">
              你输入网址后在线图标将会自动获取
              <br />
              部分网站可能会获取失败
            </p>
          </div>
        ))}

      {tab === 'color' && (
        <div className="flex items-center gap-3">
          <span
            className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl text-lg font-medium"
            style={{ background: solid, color: fg }}
          >
            {glyph || initialOf(fallbackTitle, fallbackUrl)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Input
              value={glyph}
              maxLength={2}
              onChange={(e) => setGlyph(e.target.value)}
              placeholder="文字（留空则为纯色块）"
              className="h-9"
            />
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="底色"
                value={solid}
                onChange={(e) => setSolid(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
              />
              <input
                type="color"
                aria-label="字色"
                value={fg}
                onChange={(e) => setFg(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'upload' && (
        <div className="flex flex-col gap-3">
          {cropping ? (
            <IconCropper
              file={cropping}
              onDone={(dataUrl) => {
                onUpload(dataUrl);
                setCropping(null);
              }}
              onCancel={() => setCropping(null)}
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/8">
                  {uploadedPreview ? (
                    <img
                      src={uploadedPreview}
                      alt=""
                      className="size-full object-contain"
                    />
                  ) : (
                    <TileIcon
                      icon={spec}
                      title={fallbackTitle}
                      url={fallbackUrl}
                      glyphClass="text-xl"
                    />
                  )}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setCropping(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImageUp className="size-4" />
                  {uploadedPreview ? '换一张图' : '选择图片'}
                </Button>
              </div>
              {hasStoredUpload && !uploadedPreview && (
                <p className="text-xs text-white/45">当前用的是已保存的上传图标</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
