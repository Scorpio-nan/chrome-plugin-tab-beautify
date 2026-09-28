// 拖拽落位后的「滑进新位置」动画（FLIP：First → Last → Invert → Play）。
//
// HTML5 拖放不会给 DOM 移动补帧，网格一重排图标就是硬跳。这里在顺序变化前记下
// 每个磁贴的位置，重排后用 Web Animations API 把差值反向补间回来——视觉上就是
// 图标互相让位，跟 iOS 主屏一致。坐标取 offsetLeft / offsetTop / offsetWidth，
// 它们是布局结果而不是视觉结果：页面滚动不算位移，补间动画正跑着时重新记快照
// 也不会把「动画中的位置」当成起点。
// 用法见 components/grid/TileGrid.tsx：磁贴根节点标 data-flip-id。

export interface FlipRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FlipSnapshot = Map<string, FlipRect> | null;

/** 参与补间的元素 */
const MARK = '[data-flip-id]';
const DURATION = 260;
const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
/** 小于这个位移 / 缩放就不值得动画，免得亚像素抖动 */
const EPS = 1;
const EPS_SCALE = 0.02;

/** 元素的布局盒（相对 offsetParent）；不受 transform 影响 */
function boxOf(el: HTMLElement): FlipRect {
  return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
}

function prefersStill(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** 记下容器里每个磁贴当前的布局位置 */
export function captureRects(root: HTMLElement | null): FlipSnapshot {
  if (!root) return null;
  const out: FlipSnapshot = new Map();
  root.querySelectorAll<HTMLElement>(MARK).forEach((el) => {
    const id = el.dataset.flipId;
    if (!id) return;
    out.set(id, boxOf(el));
  });
  return out;
}

/**
 * 拿上一帧快照和现在比，把挪了位（或换了大小）的磁贴补间回去。
 * prev 为 null（首帧）或系统要求减少动效时什么都不做。
 */
export function playReflow(root: HTMLElement | null, prev: FlipSnapshot): void {
  if (!root || !prev || prefersStill()) return;

  root.querySelectorAll<HTMLElement>(MARK).forEach((el) => {
    const id = el.dataset.flipId;
    if (!id) return;
    const before = prev.get(id);
    if (!before) return;

    // 同一个参照系（offsetParent）里相减，常数偏移自动抵消，量出来的就是纯位移
    const now = boxOf(el);
    const dx = before.x - now.x;
    const dy = before.y - now.y;
    const sx = before.w > 0 ? before.w / now.w : 1;
    const sy = before.h > 0 ? before.h / now.h : 1;
    if (
      Math.abs(dx) < EPS &&
      Math.abs(dy) < EPS &&
      Math.abs(sx - 1) < EPS_SCALE &&
      Math.abs(sy - 1) < EPS_SCALE
    ) {
      return;
    }

    // 只碰 transform：磁贴自身的悬停 / 选中态用的是 Tailwind 的 scale / translate 属性，互不打架
    el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transformOrigin: 'top left',
        },
        { transform: 'none', transformOrigin: 'top left' },
      ],
      { duration: DURATION, easing: EASING },
    );
  });
}