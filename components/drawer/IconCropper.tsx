import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const SIZE = 128;

interface Props {
  file: File;
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function IconCropper({ file, onDone, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => setImg(image);
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }, [file]);

  /** 按当前 zoom/offset 把图片居中铺满 SIZE×SIZE，并夹住不露出底色 */
  const paint = useCallback(
    (target: HTMLCanvasElement | null, forExport = false) => {
      if (!target || !img) return;
      const ctx = target.getContext('2d');
      if (!ctx) return;

      const scale = Math.max(SIZE / img.width, SIZE / img.height) * zoom;
      const w = img.width * scale;
      const h = img.height * scale;
      const maxX = Math.max(0, (w - SIZE) / 2);
      const maxY = Math.max(0, (h - SIZE) / 2);
      const ox = forExport ? Math.min(maxX, Math.max(-maxX, offset.x)) : offset.x;
      const oy = forExport ? Math.min(maxY, Math.max(-maxY, offset.y)) : offset.y;

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, (SIZE - w) / 2 + ox, (SIZE - h) / 2 + oy, w, h);
    },
    [img, zoom, offset],
  );

  useEffect(() => {
    paint(canvasRef.current);
  }, [paint]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    // 画布按 css 放大显示了，位移要按显示比例折算回画布坐标
    const shown = canvasRef.current?.clientWidth ?? SIZE;
    const k = SIZE / shown;
    setOffset({
      x: d.ox + (e.clientX - d.x) * k,
      y: d.oy + (e.clientY - d.y) * k,
    });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const confirm = () => {
    if (!img) return;
    // 用一张离屏画布按夹住后的位移导出，避免预览和结果不一致
    const out = document.createElement('canvas');
    out.width = SIZE;
    out.height = SIZE;
    paint(out, true);
    onDone(out.toDataURL('image/png'));
  };

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="size-40 cursor-move touch-none self-center rounded-xl border"
        style={{
          // 透明区域用棋盘格垫底，方便看清裁剪边界
          backgroundImage:
            'repeating-conic-gradient(#88888833 0% 25%, transparent 0% 50%)',
          backgroundSize: '16px 16px',
        }}
      />

      <div className="flex items-center gap-2">
        <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
        <Label className="sr-only">缩放</Label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-1.5 flex-1 accent-primary"
        />
        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {zoom.toFixed(2)}×
        </span>
      </div>

      <p className="text-xs text-muted-foreground">拖动图片调整位置</p>

      <div className="flex gap-2">
        <Button size="sm" onClick={confirm} disabled={!img}>
          用这张
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          重新选择
        </Button>
      </div>
    </div>
  );
}