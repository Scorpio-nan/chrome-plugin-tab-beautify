// 待办小组件：数据存 storage.local，跨页面（新标签页/侧边栏）实时同步。
// 支持分组、置顶、优先级（上游 F20）。
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { Flag, Pin, Plus, X } from 'lucide-react';

import { getTodoList, setTodoList, uid, type TodoItem } from '@/lib/storage';
import { useLocal } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const KEY = 'todos';

/** 默认分组在界面上显示的名字 */
const DEFAULT_GROUP = '默认';
/** 优先级循环顺序：无 → 高 → 中 → 低 → 无 */
const PRIORITY_CYCLE: Record<string, number> = { '0': 3, '3': 2, '2': 1, '1': 0 };
const PRIORITY_COLOR: Record<number, string> = {
  3: 'text-rose-400',
  2: 'text-amber-400',
  1: 'text-sky-400',
};
const PRIORITY_LABEL: Record<number, string> = {
  3: '高',
  2: '中',
  1: '低',
};

interface Group {
  name: string;
  items: TodoItem[];
}

/** 置顶在前，其余保持插入顺序；再按分组切段 */
function groupItems(items: TodoItem[]): Group[] {
  const map = new Map<string, TodoItem[]>();
  for (const it of items) {
    const key = (it.group ?? '').trim() || DEFAULT_GROUP;
    const list = map.get(key);
    if (list) list.push(it);
    else map.set(key, [it]);
  }
  const sort = (a: TodoItem, b: TodoItem) =>
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  return [...map.entries()].map(([name, list]) => ({
    name,
    items: [...list].sort(sort),
  }));
}

export default function Todo({
  title,
  defaultGroup = '',
}: {
  title?: string;
  /** 该磁贴实例配置的默认分组（新建的待办落到这里） */
  defaultGroup?: string;
}) {
  const items = useLocal<TodoItem[]>(KEY, () => getTodoList(), []);
  const [text, setText] = useState('');
  const [group, setGroup] = useState(defaultGroup);

  const save = useCallback((next: TodoItem[]) => {
    void setTodoList(next);
  }, []);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    save([
      { id: uid(), text: t, done: false, group: group.trim() },
      ...items,
    ]);
    setText('');
  };

  const toggle = (id: string) => {
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };
  const remove = (id: string) => {
    save(items.filter((i) => i.id !== id));
  };
  const togglePin = (id: string) => {
    save(items.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i)));
  };
  const cyclePriority = (id: string) => {
    save(
      items.map((i) =>
        i.id === id
          ? { ...i, priority: PRIORITY_CYCLE[String(i.priority ?? 0)] ?? 0 }
          : i,
      ),
    );
  };
  /** 删分组连带删掉组里的所有待办（上游文案就是这么写的，先确认一下） */
  const removeGroup = (name: string, count: number) => {
    if (!window.confirm(`删除分组「${name}」将同时删除组里 ${count} 条待办，继续？`)) {
      return;
    }
    save(items.filter((i) => ((i.group ?? '').trim() || DEFAULT_GROUP) !== name));
  };

  const done = items.filter((i) => i.done).length;
  const groups = useMemo(() => groupItems(items), [items]);

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
          className="w-14 shrink-0 rounded-md bg-secondary/40 px-1.5 py-1 text-[10px] text-foreground outline-hidden placeholder:text-muted-foreground focus-visible:ring-[2px] focus-visible:ring-ring/50"
          placeholder="分组"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
        />
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

      <div className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {items.length === 0 && (
          <div className="py-2 text-center text-[11px] text-muted-foreground">
            暂无待办
          </div>
        )}
        {groups.map((g) => (
          <div key={g.name}>
            {groups.length > 1 && (
              <div className="group/grp mb-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="truncate">{g.name}</span>
                <span className="tabular-nums opacity-60">{g.items.length}</span>
                <button
                  type="button"
                  title={'删除分组「' + g.name + '」及其待办'}
                  onClick={() => removeGroup(g.name, g.items.length)}
                  className="ml-auto rounded p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover/grp:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-3" />
                  <span className="sr-only">删除分组</span>
                </button>
              </div>
            )}
            <div className="space-y-0.5">
              {g.items.map((i) => (
                <div key={i.id} className="group/todo flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={i.done}
                    onChange={() => toggle(i.id)}
                    aria-label="完成"
                    className="size-3.5 shrink-0 accent-primary"
                  />
                  {Boolean(i.priority) && (
                    <span
                      title={'优先级：' + (PRIORITY_LABEL[i.priority ?? 0] ?? '无')}
                      className={cn(
                        'shrink-0 text-[9px] leading-none',
                        PRIORITY_COLOR[i.priority ?? 0] ?? '',
                      )}
                    >
                      ●
                    </span>
                  )}
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
                    title="优先级（高 / 中 / 低）"
                    onClick={() => cyclePriority(i.id)}
                    className={cn(
                      'shrink-0 rounded p-0.5 transition-opacity',
                      i.priority
                        ? PRIORITY_COLOR[i.priority] ?? 'text-muted-foreground'
                        : 'text-muted-foreground opacity-0 group-hover/todo:opacity-100 focus-visible:opacity-100',
                    )}
                  >
                    <Flag className="size-3" />
                    <span className="sr-only">优先级</span>
                  </button>
                  <button
                    type="button"
                    title={i.pinned ? '取消置顶' : '置顶'}
                    onClick={() => togglePin(i.id)}
                    className={cn(
                      'shrink-0 rounded p-0.5',
                      i.pinned
                        ? 'text-primary'
                        : 'text-muted-foreground opacity-0 transition-opacity group-hover/todo:opacity-100 focus-visible:opacity-100',
                    )}
                  >
                    <Pin className="size-3" />
                    <span className="sr-only">置顶</span>
                  </button>
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
