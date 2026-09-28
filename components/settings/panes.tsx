// 设置面板的各个分区。每个分区自己调 useConfig()——配置是全局单例，
// 多个实例之间靠 storage.onChanged 同步，所以面板和主页永远一致。
// 颜色一律走 shadcn 令牌，浅色/深色主题都能用。
import { useState } from 'react';
import { browser } from 'wxt/browser';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Upload,
} from 'lucide-react';

import { requestSearchStyle } from '@/components/settings/SearchStylePopover';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useConfig } from '@/lib/hooks';
import { ENGINE_BADGE, ENGINE_COLOR, SEARCH_ENGINES } from '@/lib/search';
import { exportAll, importAll } from '@/lib/storage';
import type {
  OpenMode,
  ScreenSide,
  SidebarVisibility,
  ThemeMode,
  TileSize,
} from '@/lib/types';
import { geocodeCity } from '@/lib/weather';
import { cn } from '@/lib/utils';

/* ---------- 共用小件 ---------- */

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full accent-primary"
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 rounded-xl bg-muted p-1', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'h-8 flex-1 rounded-lg text-[13px] transition-colors',
            o.id === value
              ? 'bg-primary font-medium text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- 行内控件：一行一项，选项收进菜单或下一屏 ---------- */

/** 选择器：标签靠左，当前值 + 箭头靠右，点开是一列候选项（不在行下再摊一排按钮） */
export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const hit = options.find((o) => o.id === value) ?? options[0];
  return (
    <Row label={label}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground"
          >
            {hit ? hit.label : '未设置'}
            <ChevronDown className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {options.map((o) => (
            <DropdownMenuItem
              key={o.id}
              onSelect={() => onChange(o.id)}
              className={cn(o.id === value && 'font-medium')}
            >
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </Row>
  );
}

/** 开关行，系统设置里那种「一行一句说明 + 右边一个开关」 */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label}>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Row>
  );
}

/** 下钻行：需要滑杆的设置占一行，点进去才给滑杆，面板不会越来越长 */
export function DrillRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: string | number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 text-left"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground">
        {value !== undefined && (
          <span className="truncate tabular-nums">{value}</span>
        )}
        <ChevronRight className="size-3.5 shrink-0" />
      </span>
    </button>
  );
}

/** 子设置那一屏：底部「返回 / 完成」只是出口，滑杆本身实时落盘 */
export function SubView({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'animate-in fade-in-0 slide-in-from-right-2 flex flex-col gap-5 duration-150',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">改动即时生效</span>
      </div>
      {children}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          返回
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-0.5 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
        >
          完成
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ---------- 常规设置 ---------- */

const SIDEBAR_VISIBILITY: { id: SidebarVisibility; label: string }[] = [
  { id: 'always', label: '一直显示' },
  { id: 'scroll', label: '滚动时隐藏' },
  { id: 'hidden', label: '一直隐藏' },
];

const SCREEN_SIDE: { id: ScreenSide; label: string }[] = [
  { id: 'left', label: '左侧' },
  { id: 'right', label: '右侧' },
];

const OPEN_MODE: { id: OpenMode; label: string }[] = [
  { id: 'newTab', label: '新标签页' },
  { id: 'selfTab', label: '当前标签页' },
];

const TILE_SIZE: { id: TileSize; label: string }[] = [
  { id: 'sm', label: '小' },
  { id: 'md', label: '中' },
  { id: 'lg', label: '大' },
];

/** 下钻屏的标识，null = 停在总列表 */
type SubPane = 'iconWidth' | 'paging' | null;

export function GeneralPane() {
  const { config, update } = useConfig();
  const [sub, setSub] = useState<SubPane>(null);
  const [city, setCity] = useState(config.weather.city);
  const [cityMsg, setCityMsg] = useState('');

  const applyCity = async () => {
    setCityMsg('查询中…');
    try {
      const hit = await geocodeCity(city.trim());
      update({ weather: { city: hit.name, lat: hit.lat, lon: hit.lon } });
      setCityMsg('已定位到 ' + hit.name);
    } catch (e) {
      setCityMsg(e instanceof Error ? e.message : '未找到该城市');
    }
  };

  if (sub === 'iconWidth') {
    return (
      <SubView title="图标区域宽度" onBack={() => setSub(null)}>
        <Slider
          label="最大宽度"
          value={config.iconAreaWidth}
          min={720}
          max={1920}
          step={20}
          suffix=" px"
          onChange={(v) => update({ iconAreaWidth: v })}
        />
        <Toggle
          label="锁死最大宽度"
          checked={config.lockMaxWidth}
          onChange={(v) => update({ lockMaxWidth: v })}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          关掉后主内容区跟着窗口拉伸，宽屏上会自动多出几列图标。
        </p>
      </SubView>
    );
  }

  if (sub === 'paging') {
    return (
      <SubView title="翻页灵敏度" onBack={() => setSub(null)}>
        <Slider
          label="灵敏度"
          value={config.pageSensitivity}
          min={1}
          max={100}
          onChange={(v) => update({ pageSensitivity: v })}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          需要打开「滚动触发翻页」：内容滚到头之后再继续滚就翻到上一页 / 下一页，
          数字越大越轻的一划也能翻页。
        </p>
      </SubView>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title="控制栏">
        <Picker
          label="侧边栏"
          value={config.sidebarVisibility}
          options={SIDEBAR_VISIBILITY}
          onChange={(v) => update({ sidebarVisibility: v })}
        />
        <Picker
          label="侧边栏位置"
          value={config.sidebarSide}
          options={SCREEN_SIDE}
          onChange={(v) => update({ sidebarSide: v })}
        />
        <Toggle
          label="侧边栏默认折叠"
          checked={config.sidebarCollapsed}
          onChange={(v) => update({ sidebarCollapsed: v })}
        />
      </Section>

      <Section title="图标">
        <Picker
          label="打开方式"
          value={config.tileOpenMode}
          options={OPEN_MODE}
          onChange={(v) => update({ tileOpenMode: v })}
        />
        <Picker
          label="图标尺寸"
          value={config.tileSize}
          options={TILE_SIZE}
          onChange={(v) => update({ tileSize: v })}
        />
        <DrillRow
          label="图标区域宽度"
          value={config.lockMaxWidth ? config.iconAreaWidth + ' px' : '自适应'}
          onClick={() => setSub('iconWidth')}
        />
        <Toggle
          label="隐藏添加图标"
          checked={config.hideAddTile}
          onChange={(v) => update({ hideAddTile: v })}
        />
        <Toggle
          label="隐藏图标名称"
          checked={config.hideTileLabel}
          onChange={(v) => update({ hideTileLabel: v })}
        />
        <Toggle
          label="滚动触发翻页"
          checked={config.scrollPaging}
          onChange={(v) => update({ scrollPaging: v })}
        />
      </Section>

      <Section title="搜索">
        {/* 样式浮层贴在主页那条搜索框下面，拖滑杆时能直接看到效果 */}
        <DrillRow
          label="搜索框样式"
          value={
            config.searchWidth + '% · ' + Math.round(config.searchOpacity * 100) + '%'
          }
          onClick={requestSearchStyle}
        />
        <Picker
          label="打开方式"
          value={config.searchOpenMode}
          options={OPEN_MODE}
          onChange={(v) => update({ searchOpenMode: v })}
        />
        <Toggle
          label="搜索建议"
          checked={config.searchSuggestions}
          onChange={(v) => update({ searchSuggestions: v })}
        />
        <Toggle
          label="搜索历史"
          checked={config.searchHistory}
          onChange={(v) => update({ searchHistory: v })}
        />
        <Toggle
          label="Tab 键切换搜索引擎"
          checked={config.tabSwitchEngine}
          onChange={(v) => update({ tabSwitchEngine: v })}
        />
        <Toggle
          label="保留搜索框内容"
          checked={config.keepSearchText}
          onChange={(v) => update({ keepSearchText: v })}
        />
      </Section>

      <Section title="其他设置">
        <DrillRow
          label="翻页灵敏度"
          value={config.pageSensitivity}
          onClick={() => setSub('paging')}
        />
        <Toggle
          label="使用系统默认字体"
          checked={config.systemFont}
          onChange={(v) => update({ systemFont: v })}
        />
        <Toggle
          label="右键打开 WeTab 侧边栏"
          checked={config.contextMenuSidebar}
          onChange={(v) => update({ contextMenuSidebar: v })}
        />
      </Section>

      <Section title="主页" hint="问候语与天气">
        <div className="flex gap-2">
          <Input
            placeholder="天气城市，如：上海"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Button variant="secondary" onClick={applyCity}>
            应用
          </Button>
        </div>
        {cityMsg && <p className="text-xs text-muted-foreground">{cityMsg}</p>}
        <Input
          placeholder="问候语名字，留空则不显示"
          value={config.userName}
          onChange={(e) => update({ userName: e.target.value })}
        />
      </Section>
    </div>
  );
}

/* ---------- 主题切换 ---------- */

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
];

export function ThemePane() {
  const { config, update } = useConfig();

  return (
    <div className="flex flex-col gap-6">
      <Section title="界面主题" hint="只影响面板和小组件，壁纸不受影响">
        <Segmented
          value={config.theme}
          options={THEMES}
          onChange={(v) => update({ theme: v })}
        />
      </Section>

      <Section title="预览">
        <div className="grid grid-cols-2 gap-3">
          {(['light', 'dark'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => update({ theme: mode })}
              className={cn(
                'overflow-hidden rounded-xl border-2 text-left transition-colors',
                config.theme === mode ? 'border-primary' : 'border-transparent',
              )}
            >
              <div
                className={cn(
                  'flex h-20 flex-col gap-1.5 p-3',
                  mode === 'dark' ? 'bg-neutral-900' : 'bg-neutral-100',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-1/2 rounded-full',
                    mode === 'dark' ? 'bg-neutral-700' : 'bg-neutral-300',
                  )}
                />
                <span
                  className={cn(
                    'h-2 w-1/3 rounded-full',
                    mode === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200',
                  )}
                />
              </div>
              <p className="bg-card px-3 py-2 text-xs text-card-foreground">
                {mode === 'dark' ? '深色' : '浅色'}
              </p>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ---------- 搜索引擎 ---------- */

export function SearchPane() {
  const { config, update } = useConfig();

  return (
    <div className="flex flex-col gap-6">
      <Section title="默认搜索引擎">
        <div className="grid grid-cols-2 gap-2">
          {SEARCH_ENGINES.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => update({ searchEngine: e.id })}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors',
                e.id === config.searchEngine
                  ? 'border-primary bg-accent text-accent-foreground'
                  : 'border-border hover:bg-accent/60',
              )}
            >
              <span
                className="grid size-6 shrink-0 place-items-center rounded-md text-[13px] font-bold text-white"
                style={{ background: ENGINE_COLOR[e.id] }}
              >
                {ENGINE_BADGE[e.id]}
              </span>
              {e.label}
            </button>
          ))}
        </div>
      </Section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        搜索框的显示、宽度、透明度在「常规设置 · 搜索」里，也可以直接右键主页那条搜索框调样式。
      </p>
    </div>
  );
}

/* ---------- 数据 ---------- */

export function DataPane() {
  const [dataMsg, setDataMsg] = useState('');

  const doExport = async () => {
    const json = await exportAll();
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `wetab-lite-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDataMsg('已导出备份');
  };

  const doImport = async (file?: File) => {
    if (!file) return;
    try {
      await importAll(await file.text());
      setDataMsg('导入成功，正在刷新…');
      setTimeout(() => location.reload(), 600);
    } catch {
      setDataMsg('导入失败：不是有效的备份文件');
    }
  };

  const resetAll = () => {
    if (
      !confirm('确定恢复默认？分组、页面、磁贴、壁纸、待办便签都会清空。')
    ) {
      return;
    }
    void browser.storage.sync.clear();
    void browser.storage.local.remove([
      'bgImage',
      'todos',
      'notes',
      'nav',
      'iconStore',
      'weatherCache',
      'recentWallpapers',
      'searchHistory',
      'searchDraft',
    ]);
    location.reload();
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="备份与恢复" hint="换机迁移用">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={doExport}>
            <Download className="size-4" />
            导出备份
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" />
              导入备份
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => doImport(e.target.files?.[0])}
              />
            </label>
          </Button>
          <Button variant="destructive" size="sm" onClick={resetAll}>
            <Trash2 className="size-4" />
            恢复默认
          </Button>
        </div>
        {dataMsg && <p className="text-xs text-muted-foreground">{dataMsg}</p>}
        <p className="text-xs leading-relaxed text-muted-foreground">
          备份含分组、页面、磁贴、上传图标与壁纸，存成 JSON 文件。
        </p>
      </Section>
    </div>
  );
}

/* ---------- 关于 ---------- */

export function extensionVersion(): string {
  try {
    const getManifest = browser.runtime.getManifest as (() => { version?: string }) | undefined;
    return getManifest?.()?.version ?? '0.1.0';
  } catch {
    return '0.1.0';
  }
}

export function AboutPane() {
  return (
    <div className="flex flex-col gap-6">
      <Section title="关于">
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p className="text-base font-semibold text-foreground">WeTab Lite</p>
          <p>版本 V{extensionVersion()}</p>
          <p className="leading-relaxed">
            离线可用的新标签页：分组 / 多页面 / 磁贴 / 文件夹 / 小组件 / 壁纸。
            不上传任何数据，配置存在浏览器 storage 里。
          </p>
        </div>
      </Section>

      <Section title="技术栈">
        <p className="text-sm leading-relaxed text-muted-foreground">
          WXT + React + TypeScript + Tailwind v4 + Radix（shadcn 风格组件）。
          壁纸与图标全部本地生成或按需抓取，无第三方统计。
        </p>
      </Section>
    </div>
  );
}
