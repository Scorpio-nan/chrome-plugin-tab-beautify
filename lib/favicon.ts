// 站点图标解析。
//
// 原来的实现走 https://www.google.com/s2/favicons，国内网络不可达，换成降级链：
//   1. chrome.runtime.getURL('/_favicon/…')  —— 需要 favicon 权限，离线可用，不占 host_permissions
//   2. 站点自己的 /favicon.ico               —— <img> 加载跨域图片不受 CSP / host_permissions 限制
//   3. 文字首字兜底                          —— 由 <TileIcon> 渲染
//
// getURL 返回的是扩展自身的地址，扩展页面里不需要 host_permissions。
import { browser } from 'wxt/browser';

/** 候选图标地址，按优先级排列；调用方逐个尝试，全部失败就用文字兜底 */
export function faviconCandidates(url: string, size = 64): string[] {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return [];
  }

  const out: string[] = [];

  try {
    // WXT 把 getURL 的类型收窄成"已知的公开路径"联合类型，而 /_favicon/ 是
    // Chrome 内置的特殊路径，不在其中，所以要放宽成 string 再传。
    const getURL = browser.runtime.getURL as (path: string) => string;
    out.push(
      getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`),
    );
  } catch {
    // 极少数环境拿不到 runtime（比如纯 web 预览），跳过这一级
  }

  out.push(`https://${host}/favicon.ico`);
  return out;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** 补全用户输入的网址（没写协议就补 https） */
export function normalizeUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/** 从标题或主机名里取一个适合做"文字图标"的字 */
export function initialOf(title: string, url: string): string {
  const t = title.trim();
  if (t) {
    // 中文取第一个字，英文取首字母大写
    const first = Array.from(t)[0];
    return /[a-zA-Z]/.test(first) ? first.toUpperCase() : first;
  }
  const host = hostOf(url);
  return host ? host[0].toUpperCase() : '?';
}