// 热搜 / 资讯（上游 F25 + F36）。
//
// 上游的热榜数据来自 api.wetab.link —— 我们不复刻它，改成「可配置数据源」：
//   · 设置里填一个返回 JSON 数组的地址（[{ "title": "...", "url": "...", "hot": 123 }]）；
//   · 请求走 background（绕 CORS），失败就退回下面这份内置示例，界面不会空着；
//   · 分类（财经/国际/军事/科技/娱乐）按上游的标签组织，示例数据也是这套分类。
import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface TrendItem {
  title: string;
  url?: string;
  hot?: number;
  category?: string;
}

/** 内置示例：数据源没配或拉取失败时用它，保证组件始终可用 */
const SAMPLE: TrendItem[] = [
  { title: '示例：在磁贴「编辑」里填一个数据源地址即可换成实时热榜', category: '说明' },
  { title: '数据源格式：[{ "title": "标题", "url": "链接", "hot": 123 }]', category: '说明' },
  { title: '为什么不用上游接口：api.wetab.link 属于对方服务，本项目不调用', category: '说明' },
];

const CATEGORIES = ['全部', '财经', '国际', '军事', '科技', '娱乐'];

interface MsgResult {
  ok?: boolean;
  data?: unknown;
  error?: string;
}

function normalize(raw: unknown): TrendItem[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
      ? ((raw as { data: unknown[] }).data as unknown[])
      : [];
  return list
    .map((x): TrendItem | null => {
      const o = (x ?? {}) as Record<string, unknown>;
      const title = String(o.title ?? o.name ?? o.word ?? '').trim();
      if (!title) return null;
      const url = o.url ?? o.link ?? o.mobilUrl;
      const hot = Number(o.hot ?? o.hotValue ?? o.num ?? NaN);
      return {
        title,
        url: typeof url === 'string' ? url : undefined,
        hot: Number.isFinite(hot) ? hot : undefined,
        category: typeof o.category === 'string' ? o.category : undefined,
      };
    })
    .filter((x): x is TrendItem => x !== null)
    .slice(0, 30);
}

export default function Trending({ source }: { source?: string }) {
  const [items, setItems] = useState<TrendItem[]>(SAMPLE);
  const [cat, setCat] = useState('全部');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  /** 需要用户授权的数据源地址（可选主机权限只能在点击里申请） */
  const [needsOrigin, setNeedsOrigin] = useState('');

  const load = useCallback(async () => {
    const url = (source ?? '').trim();
    if (!url) {
      setItems(SAMPLE);
      setNote('未配置数据源，显示内置示例');
      return;
    }
    setLoading(true);
    try {
      const res = (await browser.runtime.sendMessage({
        type: 'trending:fetch',
        url,
      })) as MsgResult;
      if (!res?.ok) {
        if (res?.error === 'needs-origin') {
          setItems(SAMPLE);
          setNote('还没授权访问这个数据源，点右边「授权域名」后重试');
          setNeedsOrigin(url);
          return;
        }
        throw new Error(res?.error ?? '拉取失败');
      }
      const list = normalize(res.data);
      if (list.length === 0) throw new Error('数据源没有可用条目');
      setItems(list);
      setNeedsOrigin('');
      setNote('');
    } catch (e) {
      setItems(SAMPLE);
      setNote(
        '拉取失败（' + (e instanceof Error ? e.message : '未知错误') + '），显示内置示例',
      );
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 可选主机权限必须在用户点击里申请，所以这里单独做一个按钮 */
  const grantOrigin = async () => {
    if (!needsOrigin) return;
    try {
      const origin = new URL(needsOrigin).origin + '/*';
      const ok = await browser.permissions.request({
        origins: [origin],
      } as unknown as Parameters<typeof browser.permissions.request>[0]);
      if (ok) {
        setNeedsOrigin('');
        await load();
      } else {
        setNote('授权被拒绝，仍然显示内置示例');
      }
    } catch {
      setNote('授权失败，可能是地址不合法');
    }
  };

  const shown =
    cat === '全部' ? items : items.filter((i) => (i.category ?? '') === cat);

  return (
    <div className="flex h-full w-full flex-col gap-1.5 text-foreground">
      <div className="thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px]',
              c === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/60 text-muted-foreground hover:text-foreground',
            )}
          >
            {c}
          </button>
        ))}
        <button
          type="button"
          title="刷新"
          onClick={() => void load()}
          className="ml-auto shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn('size-3', loading && 'animate-spin')} />
          <span className="sr-only">刷新</span>
        </button>
      </div>

      <div className="thin-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {shown.length === 0 && (
          <p className="py-3 text-center text-[11px] text-muted-foreground">
            这个分类下没有内容
          </p>
        )}
        {shown.map((it, i) => (
          <a
            key={it.title + i}
            href={it.url}
            target={it.url ? '_blank' : undefined}
            rel="noreferrer"
            title={it.title}
            className={cn(
              'flex items-start gap-1.5 rounded px-0.5 py-0.5 text-[11px] leading-tight',
              it.url && 'hover:bg-secondary/50',
            )}
          >
            <span
              className={cn(
                'w-3.5 shrink-0 text-center tabular-nums',
                i < 3 ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">{it.title}</span>
            {typeof it.hot === 'number' && (
              <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                {it.hot > 10000 ? Math.round(it.hot / 10000) + '万' : it.hot}
              </span>
            )}
          </a>
        ))}
      </div>

      {note && (
        <div className="flex shrink-0 items-center gap-1.5">
          <p className="min-w-0 flex-1 text-[10px] leading-tight text-muted-foreground">
            {note}
          </p>
          {needsOrigin && (
            <button
              type="button"
              onClick={() => void grantOrigin()}
              className="shrink-0 rounded-md bg-secondary/70 px-1.5 py-0.5 text-[10px] hover:text-foreground"
            >
              授权域名
            </button>
          )}
        </div>
      )}
    </div>
  );
}
