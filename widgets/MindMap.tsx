// 思维导图（上游 F46 的可离线部分）：
//   树形节点编辑（加子节点 / 同级节点、改名、删除、折叠）、导出 JSON 与 Markdown 大纲。
//   上游的鱼骨图/组织架构/AI 生成节点、XMind 导出都不做（AI 与付费插件的部分已列入「不做」）。
import { useCallback, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Download,
  Plus,
  Trash2,
} from 'lucide-react';

import { useLocal } from '@/lib/hooks';
import { mindMapStore, newMapNode, type MapNode } from '@/lib/local-stores';
import { cn } from '@/lib/utils';

/** 在树里按 id 替换节点，返回新树（纯函数，和 lib/nav.ts 的写法一致） */
function updateNode(
  node: MapNode,
  id: string,
  fn: (n: MapNode) => MapNode,
): MapNode {
  if (node.id === id) return fn(node);
  return { ...node, children: node.children.map((c) => updateNode(c, id, fn)) };
}

function removeNode(node: MapNode, id: string): MapNode {
  return {
    ...node,
    children: node.children
      .filter((c) => c.id !== id)
      .map((c) => removeNode(c, id)),
  };
}

function findNode(node: MapNode, id: string): MapNode | null {
  if (node.id === id) return node;
  for (const c of node.children) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

/** 同级节点：插在父节点的孩子列表里、当前节点之后 */
function insertSibling(
  node: MapNode,
  id: string,
  fresh: MapNode,
): { tree: MapNode; done: boolean } {
  const idx = node.children.findIndex((c) => c.id === id);
  if (idx >= 0) {
    const children = [...node.children];
    children.splice(idx + 1, 0, fresh);
    return { tree: { ...node, children }, done: true };
  }
  for (const c of node.children) {
    const r = insertSibling(c, id, fresh);
    if (r.done) {
      return {
        tree: {
          ...node,
          children: node.children.map((x) => (x.id === c.id ? r.tree : x)),
        },
        done: true,
      };
    }
  }
  return { tree: node, done: false };
}

function outline(node: MapNode, depth = 0): string {
  const line = '  '.repeat(depth) + (depth === 0 ? '# ' : '- ') + node.text;
  const kids = node.children.map((c) => outline(c, depth + 1)).join('\n');
  return kids ? line + '\n' + kids : line;
}

export default function MindMap() {
  const root = useLocal<MapNode>('mindmap', () => mindMapStore.get(), newMapNode('中心主题'));
  const [selected, setSelected] = useState('');
  const [renaming, setRenaming] = useState('');
  const [draft, setDraft] = useState('');

  const save = useCallback((next: MapNode) => {
    void mindMapStore.set(next);
  }, []);

  const current = useMemo(() => findNode(root, selected), [root, selected]);

  const addChild = () => {
    const target = selected || root.id;
    const fresh = newMapNode('新节点');
    save(
      updateNode(root, target, (n) => ({
        ...n,
        collapsed: false,
        children: [...n.children, fresh],
      })),
    );
    setSelected(fresh.id);
  };

  const addSibling = () => {
    if (!selected || selected === root.id) {
      addChild();
      return;
    }
    const fresh = newMapNode('新节点');
    const r = insertSibling(root, selected, fresh);
    if (r.done) {
      save(r.tree);
      setSelected(fresh.id);
    }
  };

  const removeSelected = () => {
    if (!selected || selected === root.id) return;
    save(removeNode(root, selected));
    setSelected('');
  };

  const commitRename = () => {
    if (!renaming) return;
    const text = draft.trim();
    if (text) save(updateNode(root, renaming, (n) => ({ ...n, text })));
    setRenaming('');
  };

  const download = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const render = (node: MapNode, depth: number): React.ReactNode => (
    <div key={node.id} className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setSelected(node.id)}
        onDoubleClick={() => {
          setRenaming(node.id);
          setDraft(node.text);
        }}
        className={cn(
          'flex max-w-[9rem] items-center gap-1 rounded-lg px-1.5 py-0.5 text-left text-[11px] transition-colors',
          depth === 0
            ? 'bg-primary/85 text-primary-foreground'
            : 'bg-secondary/70 text-foreground hover:bg-secondary',
          selected === node.id && 'ring-1 ring-ring',
        )}
      >
        {node.children.length > 0 && (
          <span
            role="presentation"
            title={node.collapsed ? '展开' : '折叠'}
            onClick={(e) => {
              e.stopPropagation();
              save(
                updateNode(root, node.id, (n) => ({
                  ...n,
                  collapsed: !n.collapsed,
                })),
              );
            }}
          >
            {node.collapsed ? (
              <ChevronRight className="size-3 opacity-70" />
            ) : (
              <ChevronDown className="size-3 opacity-70" />
            )}
          </span>
        )}
        <span className="min-w-0 truncate">{node.text}</span>
      </button>

      {renaming === node.id && (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenaming('');
          }}
          className="w-24 rounded bg-secondary px-1 py-0.5 text-[11px] outline-hidden"
        />
      )}

      {!node.collapsed && node.children.length > 0 && (
        <div className="flex flex-col gap-0.5 border-l border-white/15 pl-2">
          {node.children.map((c) => render(c, depth + 1))}
        </div>
      )}
    </div>
  );

  const tool =
    'flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary/70 hover:text-foreground';

  return (
    <div className="flex h-full w-full flex-col gap-1 text-foreground">
      <div className="flex shrink-0 flex-wrap items-center gap-0.5">
        <button type="button" className={tool} title="给选中节点加子节点" onClick={addChild}>
          <Plus className="size-3" />
          子节点
        </button>
        <button type="button" className={tool} title="加同级节点（根节点时等同于加子节点）" onClick={addSibling}>
          <CornerDownRight className="size-3" />
          同级
        </button>
        <button
          type="button"
          className={cn(tool, 'hover:text-destructive')}
          title="删除选中节点及其子树"
          disabled={!selected || selected === root.id}
          onClick={removeSelected}
        >
          <Trash2 className="size-3" />
          删除
        </button>
        <button
          type="button"
          className={cn(tool, 'ml-auto')}
          title="导出 Markdown 大纲"
          onClick={() =>
            download('wetab-lite-mindmap.md', outline(root), 'text/markdown')
          }
        >
          <Download className="size-3" />
          MD
        </button>
        <button
          type="button"
          className={tool}
          title="导出 JSON"
          onClick={() =>
            download(
              'wetab-lite-mindmap.json',
              JSON.stringify(root, null, 2),
              'application/json',
            )
          }
        >
          <Download className="size-3" />
          JSON
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-lg bg-black/15 p-2">
        {render(root, 0)}
      </div>

      <p className="shrink-0 text-[10px] text-muted-foreground">
        {current ? '已选：' + current.text + ' · ' : ''}单击选中，双击改名
      </p>
    </div>
  );
}
