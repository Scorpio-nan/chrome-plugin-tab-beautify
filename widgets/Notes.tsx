// 便签 / 笔记（上游 F21 + F22 的非 AI 部分）：
//   contentEditable 富文本（标题 / 粗斜下划线 / 有序无序列表 / 引用 / 代码块 / 分割线），
//   500ms 防抖自存，可导出 Markdown；老数据是纯文本也能直接打开。
//   （上游的 AI 写作不在范围内，见开发文档「不做」清单。）
import { useEffect, useRef } from 'react';
import {
  Bold,
  Code,
  Download,
  Heading1,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Underline,
} from 'lucide-react';

import { getNotes, setNotes } from '@/lib/storage';
import { useLocal } from '@/lib/hooks';
import { htmlToMarkdown, notesToHtml } from '@/lib/markdown';
import { cn } from '@/lib/utils';

const KEY = 'notes';

export default function Notes({ className }: { className?: string }) {
  const saved = useLocal<string>(KEY, () => getNotes(), '');
  const ref = useRef<HTMLDivElement>(null);
  const editing = useRef(false);
  const lastSaved = useRef('');
  const saveTimer = useRef(0);

  // 外部变化（别的页面改了）时同步进来；本地正在输入就不打断
  useEffect(() => {
    if (editing.current) return;
    const html = notesToHtml(saved);
    if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html;
    lastSaved.current = saved;
  }, [saved]);

  const scheduleSave = () => {
    const html = ref.current?.innerHTML ?? '';
    editing.current = true;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void setNotes(html).then(() => {
        lastSaved.current = html;
        editing.current = false;
      });
    }, 500);
  };

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  /** execCommand 虽然过时，但在扩展页面里仍然是最省事的富文本方案 */
  const cmd = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    scheduleSave();
  };

  const exportMd = () => {
    const html = ref.current?.innerHTML ?? '';
    const md = htmlToMarkdown(html);
    const url = URL.createObjectURL(
      new Blob([md || '（空白笔记）'], { type: 'text/markdown' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wetab-lite-note-' + new Date().toISOString().slice(0, 10) + '.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const tool =
    'grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground';

  return (
    <div className={cn('flex h-full w-full flex-col gap-1', className)}>
      <div className="flex shrink-0 flex-wrap items-center gap-0.5">
        <button type="button" title="标题" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('formatBlock', 'h2')}>
          <Heading1 className="size-3" />
        </button>
        <button type="button" title="粗体" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('bold')}>
          <Bold className="size-3" />
        </button>
        <button type="button" title="斜体" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('italic')}>
          <Italic className="size-3" />
        </button>
        <button type="button" title="下划线" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('underline')}>
          <Underline className="size-3" />
        </button>
        <button type="button" title="无序列表" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertUnorderedList')}>
          <List className="size-3" />
        </button>
        <button type="button" title="有序列表" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertOrderedList')}>
          <ListOrdered className="size-3" />
        </button>
        <button type="button" title="引用" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('formatBlock', 'blockquote')}>
          <Quote className="size-3" />
        </button>
        <button type="button" title="代码块" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('formatBlock', 'pre')}>
          <Code className="size-3" />
        </button>
        <button type="button" title="分割线" className={tool} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertHorizontalRule')}>
          <Minus className="size-3" />
        </button>
        <button
          type="button"
          title="导出 Markdown"
          className={cn(tool, 'ml-auto')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={exportMd}
        >
          <Download className="size-3" />
        </button>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onInput={scheduleSave}
        data-placeholder="随手记点什么…"
        className={cn(
          'thin-scroll note-editor min-h-0 flex-1 overflow-y-auto rounded-md bg-secondary/60 p-2 text-xs leading-relaxed text-foreground outline-hidden',
          'focus-visible:ring-[2px] focus-visible:ring-ring/50',
          '[&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold',
          '[&_blockquote]:border-l-2 [&_blockquote]:border-white/25 [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground',
          '[&_pre]:whitespace-pre-wrap [&_pre]:rounded [&_pre]:bg-black/30 [&_pre]:p-1.5 [&_pre]:font-mono [&_pre]:text-[11px]',
          '[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4',
          '[&_hr]:my-1.5 [&_hr]:border-white/20',
        )}
      />
    </div>
  );
}
