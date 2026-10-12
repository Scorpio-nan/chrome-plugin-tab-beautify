// 极简 HTML → Markdown：只覆盖便签工具栏能产出的标签。
// 上游笔记支持「导出为 Markdown / 导出备份数据」，这里给便签补上导出这一半。
const BLOCK_INLINE_SKIP = new Set(['UL', 'OL', 'PRE', 'HR', 'BLOCKQUOTE']);

function inline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const inner = Array.from(el.childNodes).map(inline).join('');
  switch (el.tagName) {
    case 'B':
    case 'STRONG':
      return inner.trim() ? '**' + inner + '**' : inner;
    case 'I':
    case 'EM':
      return inner.trim() ? '*' + inner + '*' : inner;
    case 'U':
      return inner.trim() ? '<u>' + inner + '</u>' : inner;
    case 'CODE':
      return '`' + inner + '`';
    case 'A':
      return '[' + inner + '](' + (el.getAttribute('href') ?? '') + ')';
    case 'BR':
      return '  \n';
    default:
      return inner;
  }
}

function block(node: Node, out: string[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent ?? '').trim();
    if (t) out.push(t);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;

  if (el.tagName === 'UL' || el.tagName === 'OL') {
    let i = 1;
    for (const li of Array.from(el.children)) {
      const mark = el.tagName === 'UL' ? '- ' : String(i++) + '. ';
      out.push(mark + inline(li).trim());
    }
    return;
  }
  if (el.tagName === 'PRE') {
    out.push('```\n' + (el.textContent ?? '').replace(/\n+$/, '') + '\n```');
    return;
  }
  if (el.tagName === 'HR') {
    out.push('---');
    return;
  }
  const heading = /^H([1-6])$/.exec(el.tagName);
  if (heading) {
    out.push('#'.repeat(Number(heading[1])) + ' ' + inline(el).trim());
    return;
  }
  if (el.tagName === 'BLOCKQUOTE') {
    out.push('> ' + inline(el).trim());
    return;
  }

  const text = inline(el).trim();
  if (text) out.push(text);
  for (const child of Array.from(el.children)) {
    if (BLOCK_INLINE_SKIP.has(child.tagName) || /^H[1-6]$/.test(child.tagName)) {
      block(child, out);
    }
  }
}

export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: string[] = [];
  for (const node of Array.from(doc.body.childNodes)) block(node, out);
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** 老数据是纯文本时，转成可编辑的段落，别把换行吃掉 */
export function plainTextToHtml(value: string): string {
  if (!value) return '';
  return value
    .split(/\r?\n/)
    .map((line) => {
      const esc = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return '<div>' + (esc || '<br>') + '</div>';
    })
    .join('');
}

/** 存储里的内容可能是老纯文本，也可能是新 HTML */
export function notesToHtml(stored: string): string {
  if (!stored) return '';
  return /<\/?[a-z][\s\S]*>/i.test(stored)
    ? stored
    : plainTextToHtml(stored);
}
