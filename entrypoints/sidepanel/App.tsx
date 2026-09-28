// 侧边栏：便签 + 待办（与新标签页同一份存储，实时同步）
import Notes from '@/widgets/Notes';
import Todo from '@/widgets/Todo';
import { useConfig, useTheme } from '@/lib/hooks';

export default function SidePanel() {
  const { config } = useConfig();
  useTheme(config);

  return (
    <div className="flex h-full flex-col gap-4 bg-background p-4 text-foreground">
      <div>
        <div className="text-base font-semibold">WeTab Lite 侧边栏</div>
        <div className="text-xs text-muted-foreground">
          便签与待办同步自新标签页
        </div>
      </div>

      <section className="flex min-h-[8rem] flex-1 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground">
        <h2 className="text-sm font-medium">便签</h2>
        <div className="flex min-h-0 flex-1 flex-col">
          <Notes />
        </div>
      </section>

      <section className="flex max-h-[42%] flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground">
        <h2 className="text-sm font-medium">待办</h2>
        <Todo />
      </section>
    </div>
  );
}