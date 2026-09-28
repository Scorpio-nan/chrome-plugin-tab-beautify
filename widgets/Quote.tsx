// 每日一言：内置文案，不发网络请求；按天取，可手动换一句
import { useState } from 'react';
import { Shuffle } from 'lucide-react';

const QUOTES = [
  '种一棵树最好的时间是十年前，其次是现在。',
  '简单的代码比聪明的代码更难写。',
  '过早优化是万恶之源。',
  '任何足够先进的技术都与魔法无异。',
  '把复杂留给自己，把简单留给用户。',
  '先让它跑起来，再让它跑对，最后让它跑快。',
  '你不是没有时间，你是没把它放在优先级上。',
  '做减法比做加法更需要勇气。',
  '清晰的思考会带来清晰的代码。',
  '慢就是快，稳就是远。',
  '问题定义清楚了，答案就完成了一半。',
  '持续的小改进胜过罕见的大跃进。',
  '能被测量的，才能被改进。',
  '保持饥饿，保持愚蠢。',
  '值得做的事，值得认真做。',
];

function dayIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

export default function Quote() {
  const [offset, setOffset] = useState(0);
  const quote = QUOTES[(dayIndex() + offset) % QUOTES.length];

  return (
    <div className="group/q flex h-full w-full flex-col justify-center gap-2 px-3 text-foreground">
      <p className="text-[clamp(0.75rem,1vw,0.95rem)] leading-relaxed">{quote}</p>
      <button
        type="button"
        title="换一句"
        onClick={() => setOffset((o) => o + 1)}
        className="flex items-center gap-1 self-start rounded-md px-1 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/q:opacity-100 focus-visible:opacity-100"
      >
        <Shuffle className="size-3" />
        换一句
      </button>
    </div>
  );
}