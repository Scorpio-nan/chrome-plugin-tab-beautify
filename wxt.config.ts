import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 所有入口都在 entrypoints/ 目录，wxt 会自动生成 manifest 并处理各种 entry 类型
export default defineConfig({
  /**
   * 开发模式（npm run dev）下，产物里的 <script src> 会指向 dev server，
   * 而 WXT 默认 hostname 是 localhost —— Node 17+ 在 Windows 上把 localhost
   * 解析成 ::1，于是服务只监听 IPv6，浏览器按 IPv4 回连 127.0.0.1 直接吃
   * ERR_CONNECTION_REFUSED，新标签页就成了白屏。固定成 127.0.0.1：既能被
   * 浏览器直连，也落在系统代理的 127.* 免代理名单里（代理会回 502）。
   */
  dev: {
    server: { hostname: '127.0.0.1' },
  },
  // wxt 会把这里的插件合并进每一个 build；四个 UI 入口同属一个 esm 构建组，
  // 所以 global.css 只会产出一份，不会按入口重复打包 Tailwind
  vite: () => ({
    plugins: [react(), tailwindcss()],
  }),
  manifest: {
    name: 'WeTab Lite 新标签页',
    description: '侧边栏 + 磁贴网格的新标签页：链接、文件夹、小组件都能自定义（WXT + React 复刻版）',
    // 权限最小化原则：只用真正需要的权限
    // favicon：用 chrome.runtime.getURL('/_favicon/…') 取站点图标，离线可用且不需要 host_permissions
    permissions: ['storage', 'activeTab', 'contextMenus', 'sidePanel', 'favicon'],
    // 书签这种重权限按需申请（首次使用时弹窗请求）
    optional_permissions: ['bookmarks'],
    // 天气数据通过 background fetch，避免 CORS
    host_permissions: [
      'https://api.open-meteo.com/*',
      'https://geocoding-api.open-meteo.com/*',
    ],
    chrome_url_overrides: {
      // 接管新标签页
      newtab: '/newtab.html',
    },
    action: {
      default_popup: '/popup.html',
      default_title: 'WeTab Lite',
    },
    side_panel: {
      default_path: '/sidepanel.html',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});