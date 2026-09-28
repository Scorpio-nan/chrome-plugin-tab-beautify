// 自定义添加抽屉：从左边滑进来（图稿二），宽 400px，标题栏左边返回、右边「完成」。
//
// 三种类型共用一个抽屉：
//   图标   → 链接 / 名称 两张卡片 + IconPicker（在线 / 纯色 / 本地上传）
//   文件夹 → 只有名称，子图标进磁贴浮层里再加
//   小组件 → 预设库 + 参数 + 实时预览
// focus='icon' 时（右键「编辑图标」）滚到图标区，focus='content' 时聚焦链接输入框。
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Link2, RefreshCw, Tag } from 'lucide-react';

import IconPicker from '@/components/drawer/IconPicker';
import WidgetLibrary from '@/components/drawer/WidgetLibrary';
import WidgetPropsEditor from '@/components/drawer/WidgetPropsEditor';
import WidgetTile from '@/components/grid/WidgetTile';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { normalizeUrl } from '@/lib/favicon';
import { useIconStore } from '@/lib/hooks';
import { putIcon } from '@/lib/icon-store';
import { uid } from '@/lib/storage';
import type {
  FolderTile,
  IconSpec,
  LinkTile,
  Tile,
  UserConfig,
  WidgetId,
  WidgetSize,
  WidgetTile as WidgetTileType,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { getWidget } from '@/widgets/registry';

const SIZE_LABEL: Record<WidgetSize, string> = { sm: '小', md: '中', lg: '大' };

/** 抽屉里的小标题卡片：标签在上、控件在下，整块半透明底 */
function Card({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/6 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-white/50">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

/** 卡片里的无边框输入框，靠卡片本身当边界 */
function BareInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <input
      {...props}
      className={cn(
        'h-8 w-full min-w-0 bg-transparent text-sm text-white outline-hidden',
        'placeholder:text-white/35',
        className,
      )}
    />
  );
}

/* ---------- 小组件表单（新建和编辑共用） ---------- */

interface WidgetFormProps {
  widgetId: WidgetId;
  size: WidgetSize;
  props: Record<string, unknown>;
  config: UserConfig;
  onPick: (id: WidgetId) => void;
  onSize: (size: WidgetSize) => void;
  onProps: (props: Record<string, unknown>) => void;
}

function WidgetForm({
  widgetId,
  size,
  props,
  config,
  onPick,
  onSize,
  onProps,
}: WidgetFormProps) {
  const def = getWidget(widgetId);

  return (
    <div className="flex flex-col gap-4">
      <WidgetLibrary value={widgetId} onPick={onPick} />

      <Card label="尺寸">
        <div className="flex gap-1">
          {(def?.sizes ?? ['sm', 'md', 'lg']).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSize(s)}
              className={cn(
                'rounded-md border px-3 py-1 text-xs transition-colors',
                s === size
                  ? 'border-transparent bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      </Card>

      {def && (
        <>
          <WidgetPropsEditor def={def} value={props} onChange={onProps} />

          <Card label="预览">
            <div
              className={cn(
                'rounded-xl bg-[linear-gradient(135deg,#667eea,#764ba2)] p-2',
                size === 'sm' ? 'h-32' : 'h-40',
              )}
            >
              <WidgetTile
                tile={{
                  id: 'preview',
                  type: 'widget',
                  widget: widgetId,
                  size,
                  props,
                }}
                config={config}
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------- 抽屉本体 ---------- */

type Kind = 'link' | 'folder' | 'widget';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Tile | null;
  /** 新建时默认停在哪个类型；编辑时以 editing 为准 */
  createKind: Kind;
  /** 打开后先聚焦内容区还是图标区 */
  focus: 'content' | 'icon';
  config: UserConfig;
  onSave: (tile: Tile) => void;
}

export default function AddTileDrawer({
  open,
  onOpenChange,
  editing,
  createKind,
  focus,
  config,
  onSave,
}: Props) {
  const store = useIconStore();

  const [kind, setKind] = useState<Kind>('link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState<IconSpec>({ kind: 'online' });
  /** 新裁好但还没落 iconStore 的图 */
  const [pendingUpload, setPendingUpload] = useState('');
  /** 换 key 重挂 IconPicker，等于「重新抓一次站点图标」 */
  const [retryKey, setRetryKey] = useState(0);

  const [widgetId, setWidgetId] = useState<WidgetId>('clock');
  const [widgetProps, setWidgetProps] = useState<Record<string, unknown>>({});
  const [widgetSize, setWidgetSize] = useState<WidgetSize>('md');

  const urlRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  /* 每次打开时按 editing 回填 */
  useEffect(() => {
    if (!open) return;
    setPendingUpload('');
    setRetryKey(0);

    if (editing?.type === 'link') {
      setKind('link');
      setTitle(editing.title);
      setUrl(editing.url);
      setIcon(editing.icon);
      return;
    }
    if (editing?.type === 'folder') {
      setKind('folder');
      setTitle(editing.title);
      setUrl('');
      setIcon({ kind: 'online' });
      return;
    }
    if (editing?.type === 'widget') {
      const d = getWidget(editing.widget);
      setKind('widget');
      setWidgetId(editing.widget);
      setWidgetSize(editing.size);
      setWidgetProps({ ...d?.defaults, ...editing.props });
      return;
    }

    // 新建
    const d = getWidget('clock');
    setKind(createKind);
    setTitle('');
    setUrl('');
    setIcon({ kind: 'online' });
    setWidgetId('clock');
    setWidgetSize(d?.defaultSize ?? 'md');
    setWidgetProps({ ...d?.defaults });
  }, [open, editing, createKind]);

  /* 右键「编辑图标」直接滚到图标区，「编辑主页」聚焦链接 */
  useEffect(() => {
    if (!open || kind !== 'link') return;
    if (focus === 'content') urlRef.current?.focus();
    else iconRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, focus, kind, retryKey]);

  const storedUpload =
    icon.kind === 'upload' && icon.value ? store[icon.value] : '';
  const uploadPreview = pendingUpload || storedUpload || '';

  const titleOk = title.trim().length > 0;
  const canSave =
    kind === 'widget' ? true : kind === 'folder' ? titleOk : titleOk && url.trim().length > 0;

  const close = () => onOpenChange(false);

  const pickWidget = (id: WidgetId) => {
    const d = getWidget(id);
    setWidgetId(id);
    setWidgetSize(d?.defaultSize ?? 'md');
    setWidgetProps({ ...d?.defaults });
  };

  const save = async () => {
    if (!canSave) return;

    if (kind === 'widget') {
      const tile: WidgetTileType = {
        id: editing?.type === 'widget' ? editing.id : uid(),
        type: 'widget',
        widget: widgetId,
        size: widgetSize,
        props: widgetProps,
      };
      onSave(tile);
      close();
      return;
    }

    if (kind === 'folder') {
      const tile: FolderTile = {
        id: editing?.type === 'folder' ? editing.id : uid(),
        type: 'folder',
        title: title.trim(),
        children: editing?.type === 'folder' ? editing.children : [],
      };
      onSave(tile);
      close();
      return;
    }

    let spec: IconSpec = icon;
    if (icon.kind === 'upload') {
      if (pendingUpload) {
        // 新裁的图这时才落库，避免用户中途关掉抽屉留下没人引用的图标
        spec = { ...icon, value: await putIcon(pendingUpload) };
      } else if (!icon.value) {
        spec = { kind: 'online' };
      }
    }

    const tile: LinkTile = {
      id: editing?.type === 'link' ? editing.id : uid(),
      type: 'link',
      title: title.trim(),
      url: normalizeUrl(url),
      icon: spec,
      badge: editing?.type === 'link' ? editing.badge : undefined,
    };
    onSave(tile);
    close();
  };

  const heading =
    editing?.type === 'widget'
      ? '编辑小组件'
      : editing?.type === 'link'
        ? '编辑图标'
        : editing?.type === 'folder'
          ? '编辑文件夹'
          : '自定义添加';

  const linkForm = (
    <div className="flex flex-col gap-3">
      <Card label="链接" icon={<Link2 className="size-3.5" />}>
        <div className="flex items-center gap-2">
          <BareInput
            ref={urlRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="zhihu.com"
            spellCheck={false}
          />
          <button
            type="button"
            title="重新获取站点图标"
            onClick={() => setRetryKey((k) => k + 1)}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </Card>

      <Card label="名称" icon={<Tag className="size-3.5" />}>
        <BareInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="比如 知乎"
        />
      </Card>

      <div ref={iconRef}>
        <IconPicker
          key={retryKey}
          spec={icon}
          fallbackTitle={title}
          fallbackUrl={url}
          uploadedPreview={uploadPreview}
          hasStoredUpload={Boolean(storedUpload)}
          onChange={setIcon}
          onUpload={setPendingUpload}
        />
      </div>
    </div>
  );

  const folderForm = (
    <div className="flex flex-col gap-3">
      <Card label="名称" icon={<Tag className="size-3.5" />}>
        <BareInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="比如 AI工具"
        />
      </Card>
      <p className="text-xs leading-relaxed text-white/45">
        文件夹会显示成 2×2 的方块，最多预览 4 个子图标；
        点开磁贴可以继续添加或移除。
      </p>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        hideClose
        overlayClassName="bg-black/25 backdrop-blur-[1px]"
        className="w-[400px] gap-0 border-r-0 p-0 sm:max-w-[400px]"
      >
        <SheetHeader className="h-14 flex-row items-center gap-1 border-b border-white/8 p-0 pr-3 pl-3">
          <button
            type="button"
            title="关闭"
            onClick={close}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="size-5" />
          </button>
          <SheetTitle className="min-w-0 flex-1 truncate text-[15px]">
            {heading}
          </SheetTitle>
          {/* 图稿里的主操作是品牌蓝，不跟随主题令牌 */}
          <Button
            size="sm"
            onClick={save}
            disabled={!canSave}
            className="h-8 shrink-0 rounded-lg bg-blue-600 px-3.5 text-white hover:bg-blue-500"
          >
            完成
          </Button>
        </SheetHeader>
        <SheetDescription className="sr-only">
          给主页添加或修改一个磁贴
        </SheetDescription>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {!editing && (
            <div className="mb-3 flex gap-1 rounded-xl bg-white/8 p-1">
              {(['link', 'folder', 'widget'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    'h-8 flex-1 rounded-lg text-[13px] transition-colors',
                    kind === k
                      ? 'bg-white font-medium text-neutral-900'
                      : 'text-white/65 hover:text-white',
                  )}
                >
                  {k === 'link' ? '图标' : k === 'folder' ? '文件夹' : '小组件'}
                </button>
              ))}
            </div>
          )}

          {kind === 'widget' ? (
            <WidgetForm
              widgetId={widgetId}
              size={widgetSize}
              props={widgetProps}
              config={config}
              onPick={pickWidget}
              onSize={setWidgetSize}
              onProps={setWidgetProps}
            />
          ) : kind === 'folder' ? (
            folderForm
          ) : (
            linkForm
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
