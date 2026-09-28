import type { SearchEngine } from './types';

const SEARCH_URLS: Record<SearchEngine, (q: string) => string> = {
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  baidu: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
};

export const SEARCH_ENGINES: { id: SearchEngine; label: string }[] = [
  { id: 'bing', label: '必应' },
  { id: 'baidu', label: '百度' },
  { id: 'google', label: 'Google' },
  { id: 'duckduckgo', label: 'DuckDuckGo' },
];

export function searchUrl(engine: SearchEngine, query: string): string {
  return SEARCH_URLS[engine](query);
}

/** 搜索引擎的小标志，用于搜索框左侧那个圆标 */
export const ENGINE_BADGE: Record<SearchEngine, string> = {
  bing: 'b',
  baidu: '百',
  google: 'G',
  duckduckgo: 'D',
};

/** 标志底色，搜索框和设置面板共用 */
export const ENGINE_COLOR: Record<SearchEngine, string> = {
  bing: '#0f7c66',
  baidu: '#2932e1',
  google: '#4285f4',
  duckduckgo: '#de5833',
};
