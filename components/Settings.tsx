// 完整设置页（entrypoints/options）用的长表单：把各个分区顺序堆起来。
//
// 新标签页里那个左下角浮层用的是 components/settings/SettingsPanel.tsx，
// 两者共用 components/settings/panes.tsx + WallpaperPane，避免两套实现。
import {
  AboutPane,
  DataPane,
  GeneralPane,
  SearchPane,
  ThemePane,
} from '@/components/settings/panes';
import { SearchStyleLayer } from '@/components/settings/SearchStylePopover';
import WallpaperPane from '@/components/settings/WallpaperPane';

export default function Settings() {
  return (
    <div className="flex flex-col gap-8">
      <GeneralPane />

      {/* 壁纸分区是为浮层设计的满高布局，这里给它一个固定高度的盒子 */}
      <div className="h-[600px] overflow-hidden rounded-xl border bg-card">
        <WallpaperPane />
      </div>

      <ThemePane />
      <SearchPane />
      <DataPane />
      <AboutPane />

      {/* 「搜索框样式」那一行点开的是同一张浮层，这里没有主页搜索框，退化成底部居中 */}
      <SearchStyleLayer />
    </div>
  );
}
