// 便签小组件：textarea 自动保存（500ms 防抖），跨页面同步
import { useEffect, useRef, useState } from 'react';

import { getNotes, setNotes } from '@/lib/storage';
import { useLocal } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const KEY = 'notes';

export default function Notes({ className }: { className?: string }) {
  const saved = useLocal<string>(KEY, () => getNotes(), '');
  const [value, setValue] = useState('');
  const editing = useRef(false);
  const lastSaved = useRef('');

  // storage 外部变化时，如果本地没在输入，则同步（包含清空场景）
  useEffect(() => {
    if (!editing.current && value !== saved) {
      setValue(saved);
      lastSaved.current = saved;
    }
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  // 输入防抖保存（空字符串也要能保存）
  useEffect(() => {
    if (value === lastSaved.current) return;
    editing.current = true;
    const t = setTimeout(() => {
      void setNotes(value).then(() => {
        lastSaved.current = value;
        editing.current = false;
      });
    }, 500);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <textarea
      className={cn(
        'thin-scroll h-full w-full resize-none rounded-md bg-secondary/60 p-2 text-xs leading-relaxed text-foreground outline-hidden',
        'placeholder:text-muted-foreground focus-visible:ring-[2px] focus-visible:ring-ring/50',
        className,
      )}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="随手记点什么…"
      spellCheck={false}
    />
  );
}