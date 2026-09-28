import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 事件目标是不是可编辑控件（输入框 / 文本域 / contenteditable）。
 *
 * 新标签页里屏蔽了浏览器默认右键菜单，但输入框里的「粘贴 / 全选」必须留着，
 * 否则用户往 URL、待办、备忘录里打字就没法粘贴了——所有 contextmenu 拦截都用它做豁免。
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return el.closest('input, textarea, select, [contenteditable="true"]') !== null;
}
