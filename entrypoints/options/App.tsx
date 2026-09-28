// 完整设置页（chrome://extensions → 详细信息 → 扩展程序选项）
import Settings from '@/components/Settings';
import { useConfig, useTheme } from '@/lib/hooks';

export default function OptionsPage() {
  const { config } = useConfig();
  useTheme(config);

  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-20 text-foreground">
      <h1 className="mb-5 text-xl font-semibold">WeTab Lite 设置</h1>
      <div className="rounded-xl border bg-card p-5 text-card-foreground">
        <Settings />
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        提示：同一套设置也会出现在新标签页左下角的齿轮图标里。数据都存在浏览器的扩展存储中（配置在
        sync，分组磁贴与上传图标在 local）。
      </p>
    </div>
  );
}