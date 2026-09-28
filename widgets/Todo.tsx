// 待办小组件：数据存 storage.local，跨页面（新标签页/侧边栏）实时同步
import { useCallback, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';

import { getTodoList, setTodoList, uid, type TodoItem } from '@/lib/storage';
import { useLocal } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const KEY = 'todos';

export default function Todo({ title }: { title?: string }) {
  const items = useLocal<TodoItem[]>(KEY, () => getTodoList(), []);
  const [text, setText] = useState('');

  const save = useCallback((next: TodoItem[]) => {
    void setTodoList(next);
  }, []);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    save([{ id: uid(), text: t, done: false }, ...items]);
    setText('');
  };

  const toggle = (id: string) => {
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };
  const remove = (id: string) => {
    save(items.filter((i) => i.id !== id));
  };

  const done = items.filter((i) => i.done).length;

  return (
    <div className="flex h-full w-full flex-col gap-1.5 text-foreground">
      {title && (
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span className="truncate">{title}</span>
          <span className="tabular-nums">
            {done}/{items.length}
          </span>
        </div>
      )}

      <form onSubmit={add} className="flex shrink-0 items-center gap-1">
        <input
          className="min-w-0 flex-1 rounded-md bg-secondary/60 px-2 py-1 text-xs text-foreground outline-hidden placeholder:text-muted-foreground focus-visible:ring-[2px] focus-visible:ring-ring/50"
          placeholder="添加待办，回车确认"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          title="添加待办"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" />
          <span className="sr-only">添加待办</span>
        </button>
      </form>

      <div className="thin-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {items.length === 0 && (
          <div className="py-2 text-center text-[11px] text-muted-foreground">
            暂无待办
          </div>
        )}
        {items.map((i) => (
          <div key={i.id} className="group/todo flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={i.done}
              onChange={() => toggle(i.id)}
              aria-label="完成"
              className="size-3.5 shrink-0 accent-primary"
            />
            <span
              className={cn(
                'flex-1 truncate text-xs',
                i.done && 'text-muted-foreground line-through',
              )}
            >
              {i.text}
            </span>
            <button
              type="button"
              title="删除"
              onClick={() => remove(i.id)}
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/todo:opacity-100 focus-visible:opacity-100"
            >
              <X className="size-3" />
              <span className="sr-only">删除</span>
            </button>
          </div>
        ))}
      </div>

      {!title && items.length > 0 && (
        <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          已完成 {done}/{items.length}
        </div>
      )}
    </div>
  );
}