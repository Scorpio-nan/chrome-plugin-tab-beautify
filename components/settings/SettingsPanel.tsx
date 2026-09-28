// 新标签页的设置浮层（图稿三）：点左下角齿轮弹出，贴在齿轮上方。
//
// 刻意不做成全屏抽屉——主页要一直看得见，选壁纸时才能立刻看到效果。
// 左列是分区菜单，右侧一次只渲染一个分区。滚动由各分区自己负责
// （壁纸区的浮动工具条要 absolute 定位，外层再套 overflow 会被裁掉）。
import { useEffect, useState } from 'react';
import {
  Download,
  Image as ImageIcon,
  Info,
  Palette,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import {
  AboutPane,
  DataPane,
  GeneralPane,
  SearchPane,
  ThemePane,
  extensionVersion,
} from '@/components/settings/panes';
import WallpaperPane from '@/components/settings/WallpaperPane';
import { useConfig } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export type SettingsPaneId =
  | 'general'
  | 'wallpaper'
  | 'theme'
  | 'search'
  | 'data'
  | 'about';

const PANES: {
  id: SettingsPaneId;
  label: string;
  icon: React.ReactNode;
  /** 该分区是否自己管滚动（WallpaperPane 是满高 flex 列） */
  selfScroll?: boolean;
}[] = [
  { id: 'general', label: '常规设置', icon: <SlidersHorizontal className="size-4" /> },
  { id: 'wallpaper', label: '壁纸', icon: <ImageIcon className="size-4" />, selfScroll: true },
  { id: 'theme', label: '主题切换', icon: <Palette className="size-4" /> },
  { id: 'search', label: '搜索引擎', icon: <Search className="size-4" /> },
  { id: 'data', label: '数据', icon: <Download className="size-4" /> },
  { id: 'about', label: '关于', icon: <Info className="size-4" /> },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 每次打开时停在哪个分区 */
  defaultTab?: SettingsPaneId;
  className?: string;
}

export default function SettingsPanel({
  open,
  onOpenChange,
  defaultTab = 'wallpaper',
  className,
}: Props) {
  const { config } = useConfig();
  const [pane, setPane] = useState<SettingsPaneId>(defaultTab);

  /* 打开时回到默认分区，并支持 Esc 关闭 */
  useEffect(() => {
    if (!open) return;
    setPane(defaultTab);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, defaultTab, onOpenChange]);

  if (!open) return null;

  const active = PANES.find((p) => p.id === pane) ?? PANES[0];

  const renderPane = () => {
    switch (pane) {
      case 'wallpaper':
        return <WallpaperPane />;
      case 'theme':
        return <ThemePane />;
      case 'search':
        return <SearchPane />;
      case 'data':
        return <DataPane />;
      case 'about':
        return <AboutPane />;
      default:
        return <GeneralPane />;
    }
  };

  return (
    <>
      {/* 透明背板：只负责点外面关闭，不遮挡主页 */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />

      <div
        role="dialog"
        aria-label="设置"
        className={cn(
          'fixed bottom-14 left-4 z-50 flex',
          'h-[min(660px,calc(100vh-96px))] w-[min(740px,calc(100vw-32px))]',
          'overflow-hidden rounded-2xl border border-white/12 bg-background/95 text-foreground',
          'shadow-2xl backdrop-blur-xl',
          'animate-in fade-in-0 slide-in-from-bottom-3 duration-150',
          className,
        )}
      >
        {/* 左列：身份 + 分区菜单 + 版本 */}
        <aside className="flex w-[196px] shrink-0 flex-col border-r border-border">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {(config.userName || 'U').slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-sm font-medium">
              {config.userName || 'USER'}
            </span>
          </div>

          <nav className="thin-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2">
            {PANES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPane(p.id)}
                className={cn(
                  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors',
                  p.id === pane
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                {p.icon}
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </nav>

          <div className="px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <p>V{extensionVersion()}</p>
            <p className="mt-1 flex gap-3">
              <span>用户协议</span>
              <span>隐私政策</span>
            </p>
          </div>
        </aside>

        {/* 右侧：当前分区 */}
        <div className="relative min-h-0 flex-1">
          {active.selfScroll ? (
            renderPane()
          ) : (
            <div className="thin-scroll h-full min-h-0 overflow-y-auto p-5">
              {renderPane()}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
