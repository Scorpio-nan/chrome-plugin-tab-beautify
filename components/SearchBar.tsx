// 页面级搜索框（原型图里顶部居中那一条），不是小组件。
//
// 表面不摆任何操作按钮：外观和行为的开关全部来自 config（见 lib/types.ts 的「搜索框」段），
// 右键这条搜索框会弹出「搜索框样式」浮层，拖滑杆主页这条实时跟着变。
//   · 宽度：config.searchWidth 是内容区的百分比，浮层靠 data-search-bar 定位；
//   · 建议：离线匹配本地图标名称 / 网址，不联网；
//   · 历史：空输入框聚焦时列出，最近一次改动存 storage.local；
//   · Tab：按配置循环搜索引擎，配合 ↑↓ 选建议。
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Clock, Trash2 } from 'lucide-react';

import TileIcon from '@/components/TileIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { normalizeUrl } from '@/lib/favicon';
import type { IconEntry } from '@/lib/nav';
import {
  ENGINE_BADGE,
  ENGINE_COLOR,
  SEARCH_ENGINES,
  searchUrl,
} from '@/lib/search';
import {
  clearSearchHistory,
  getSearchDraft,
  getSearchHistory,
  pushSearchHistory,
  setSearchDraft,
} from '@/lib/storage';
import type { SearchEngine, UserConfig } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  config: UserConfig;
  /** 搜索建议的数据源：整棵导航树里的链接图标（含折叠进分组的） */
  icons: IconEntry[];
  onEngineChange: (engine: SearchEngine) => void;
  /** 右键 → 弹出「搜索框样式」浮层 */
  onStyleRequest: () => void;
  className?: string;
}

/** 一次最多给这么多条建议，再多就盖住主页了 */
const MAX_SUGGEST = 6;

/** 像域名的输入直接当网址打开，否则交给搜索引擎 */
function looksLikeUrl(q: string) {
  return /^[^\s]+\.[^\s]{2,}/.test(q) && !q.includes(' ');
}

/** 下拉里两种行：本地图标 / 历史词 */
type Row =
  | { kind: 'icon'; key: string; entry: IconEntry }
  | { kind: 'history'; key: string; text: string }
  | { kind: 'clear'; key: string };

export default function SearchBar({
  config,
  icons,
  onEngineChange,
  onStyleRequest,
  className,
}: Props) {
  const engine = config.searchEngine;
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  /** 草稿只回填一次，别在用户已经打字之后再覆盖 */
  const restored = useRef(false);

  /* 上次的未提交内容：keepSearchText 关了就把它抹掉 */
  useEffect(() => {
    if (!config.keepSearchText) {
      restored.current = true;
      void setSearchDraft('');
      return;
    }
    if (restored.current) return;
    restored.current = true;
    void getSearchDraft().then((draft) => {
      if (draft) setValue(draft);
    });
  }, [config.keepSearchText]);

  /* 搜索历史关掉时连记录一起清，不留隐式数据 */
  useEffect(() => {
    if (config.searchHistory) {
      void getSearchHistory().then(setHistory);
      return;
    }
    setHistory([]);
    void clearSearchHistory();
  }, [config.searchHistory]);

  const rows = useMemo<Row[]>(() => {
    if (!focused) return [];
    const q = value.trim().toLowerCase();
    if (q) {
      if (!config.searchSuggestions) return [];
      return icons
        .filter((e) => (e.title + ' ' + e.url).toLowerCase().includes(q))
        .slice(0, MAX_SUGGEST)
        .map((entry) => ({ kind: 'icon' as const, key: entry.id, entry }));
    }
    if (!config.searchHistory || history.length === 0) return [];
    return [
      ...history.map((text) => ({ kind: 'history' as const, key: text, text })),
      { kind: 'clear' as const, key: 'clear' },
    ];
  }, [config.searchHistory, config.searchSuggestions, focused, history, icons, value]);

  /* 列表变了就把高亮复位，避免停在一条已经不存在的数据上 */
  useEffect(() => setActive(-1), [rows.length]);

  const open = (url: string) => {
    if (config.searchOpenMode === 'newTab') {
      window.open(url, '_blank', 'noopener');
    } else {
      window.location.assign(url);
    }
  };

  const run = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    open(looksLikeUrl(q) ? normalizeUrl(q) : searchUrl(engine, q));
    if (config.searchHistory) void pushSearchHistory(q).then(setHistory);
    inputRef.current?.blur();
  };

  const onChange = (text: string) => {
    setValue(text);
    if (config.keepSearchText) void setSearchDraft(text);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey && config.tabSwitchEngine) {
      e.preventDefault();
      const i = SEARCH_ENGINES.findIndex((x) => x.id === engine);
      const step = e.shiftKey ? -1 : 1;
      const next = (i + step + SEARCH_ENGINES.length) % SEARCH_ENGINES.length;
      onEngineChange(SEARCH_ENGINES[next].id);
      return;
    }
    if (rows.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((prev) => (prev + delta + rows.length + 1) % (rows.length + 1));
      return;
    }
    if (e.key === 'Enter') {
      const hit = rows[active];
      if (hit && hit.kind === 'icon') {
        e.preventDefault();
        open(hit.entry.url);
        return;
      }
      if (hit && hit.kind === 'history') {
        e.preventDefault();
        onChange(hit.text);
        run(hit.text);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (value) onChange('');
      else inputRef.current?.blur();
    }
  };

  return (
    <div
      data-search-bar=""
      className={cn('relative', className)}
      style={{ width: config.searchWidth + '%' }}
      onContextMenu={(e) => {
        // 主页的空白处右键是「页面操作菜单」，这里要的是样式浮层
        e.preventDefault();
        e.stopPropagation();
        onStyleRequest();
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(value);
        }}
        className={cn(
          'flex h-[52px] w-full items-center gap-2 rounded-2xl px-3',
          'border border-white/10 bg-black/35 shadow-lg backdrop-blur-xl',
          'transition-colors duration-200 focus-within:border-white/25 focus-within:bg-black/45',
        )}
        style={{ opacity: config.searchOpacity }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="切换搜索引擎"
              className="flex shrink-0 items-center gap-1 rounded-lg px-1 py-1 outline-hidden transition-colors hover:bg-white/10"
            >
              <span
                className="grid size-6 place-items-center rounded-md text-[13px] leading-none font-bold text-white"
                style={{ background: ENGINE_COLOR[engine] }}
              >
                {ENGINE_BADGE[engine]}
              </span>
              <ChevronDown className="size-3.5 text-white/45" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuLabel>搜索引擎</DropdownMenuLabel>
            {SEARCH_ENGINES.map((e) => (
              <DropdownMenuItem
                key={e.id}
                onSelect={() => onEngineChange(e.id)}
                className={cn(e.id === engine && 'font-medium')}
              >
                <span
                  className="grid size-4 place-items-center rounded text-[10px] font-bold text-white"
                  style={{ background: ENGINE_COLOR[e.id] }}
                >
                  {ENGINE_BADGE[e.id]}
                </span>
                {e.label}
                <span className="ml-auto text-[11px] opacity-45">Tab</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="输入搜索内容"
          spellCheck={false}
          className="h-full min-w-0 flex-1 bg-transparent px-1 text-[15px] text-white caret-white outline-hidden placeholder:text-white/45"
        />
      </form>

      {rows.length > 0 && (
        <div className="animate-in fade-in-0 zoom-in-95 absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/85 p-1.5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          {rows.map((row, i) => {
            if (row.kind === 'clear') {
              return (
                <button
                  key={row.key}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void clearSearchHistory().then(() => setHistory([]))}
                  className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[12px] text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="size-3.5" />
                  清除搜索历史
                </button>
              );
            }
            const label =
              row.kind === 'icon' ? row.entry.title : row.text;
            const sub = row.kind === 'icon' ? row.entry.url : '最近搜索';
            return (
              <button
                key={row.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(label)}
                className={cn(
                  'flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors',
                  i === active ? 'bg-white/12' : 'hover:bg-white/[0.07]',
                )}
              >
                {row.kind === 'icon' ? (
                  <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-md">
                    <TileIcon
                      icon={row.entry.icon}
                      title={row.entry.title}
                      url={row.entry.url}
                      glyphClass="text-[11px]"
                    />
                  </span>
                ) : (
                  <Clock className="size-4 shrink-0 text-white/40" />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
                <span className="max-w-[45%] shrink-0 truncate text-[11px] text-white/35">
                  {sub}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

