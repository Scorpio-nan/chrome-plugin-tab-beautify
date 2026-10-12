// 电池 / 系统状态（上游 F37）。
//
// 浏览器对这两类能力限制很大，所以按「能用就用、不能用就说清楚」来写：
//   电量 —— Battery Status API（navigator.getBattery），不支持的浏览器直接说明；
//   内存 —— chrome.system.memory 需要可选权限（system.memory），桌面版多数拿不到，
//          所以先读权限状态，失败就显示提示而不是报错。
import { useCallback, useEffect, useState } from 'react';
import { Battery, BatteryCharging, RefreshCw } from 'lucide-react';
import { browser } from 'wxt/browser';

import { cn } from '@/lib/utils';

interface BatteryLike {
  level: number;
  charging: boolean;
  addEventListener(type: string, cb: () => void): void;
}

interface MemoryInfo {
  capacity: number;
  availableCapacity: number;
}

const NO_BATTERY =
  '这个浏览器没有提供电量接口（Chrome 桌面版多数情况下拿不到）';

/**
 * WXT 的类型里 system.memory 不在可选权限联合里（Chrome 桌面版也确实少见），
 * 这里显式收窄一次，运行时行为由 try/catch 兜底。
 */
type PermRequest = Parameters<typeof browser.permissions.request>[0];
const MEMORY_PERMISSION = {
  permissions: ['system.memory'],
} as unknown as PermRequest;

export default function SystemStatus() {
  const [level, setLevel] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const [batteryNote, setBatteryNote] = useState('');
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [memoryNote, setMemoryNote] = useState('');

  const readBattery = useCallback(() => {
    const getBattery = (
      navigator as unknown as {
        getBattery?: () => Promise<BatteryLike>;
      }
    ).getBattery;
    if (typeof getBattery !== 'function') {
      setBatteryNote(NO_BATTERY);
      return;
    }
    getBattery
      .call(navigator)
      .then((b) => {
        const sync = () => {
          setLevel(b.level);
          setCharging(b.charging);
        };
        sync();
        b.addEventListener('levelchange', sync);
        b.addEventListener('chargingchange', sync);
      })
      .catch(() => setBatteryNote(NO_BATTERY));
  }, []);

  const readMemory = useCallback(async () => {
    const api = (
      browser as unknown as {
        system?: { memory?: { getInfo(): Promise<MemoryInfo> } };
      }
    ).system?.memory;
    if (!api) {
      setMemoryNote('当前浏览器不支持 system.memory');
      return;
    }
    try {
      const has = await browser.permissions.contains(MEMORY_PERMISSION);
      if (!has) {
        setMemoryNote('需要「系统内存」权限（点右侧按钮申请）');
        return;
      }
      setMemory(await api.getInfo());
      setMemoryNote('');
    } catch {
      setMemoryNote('系统内存读取失败');
    }
  }, []);

  useEffect(() => {
    readBattery();
    void readMemory();
  }, [readBattery, readMemory]);

  const requestMemory = async () => {
    try {
      const ok = await browser.permissions.request(MEMORY_PERMISSION);
      if (ok) await readMemory();
    } catch {
      setMemoryNote('权限申请失败');
    }
  };

  const pct = level === null ? null : Math.round(level * 100);
  const used =
    memory && memory.capacity > 0
      ? Math.round(
          ((memory.capacity - memory.availableCapacity) / memory.capacity) * 100,
        )
      : null;

  return (
    <div className="flex h-full w-full flex-col gap-2 px-2.5 py-2 text-foreground">
      <div className="flex items-center gap-2">
        {charging ? (
          <BatteryCharging className="size-5 shrink-0 text-emerald-400" />
        ) : (
          <Battery className="size-5 shrink-0 text-muted-foreground" />
        )}
        <span className="text-[clamp(1.1rem,1.8vw,1.7rem)] leading-none font-light tabular-nums">
          {pct === null ? '—' : pct + '%'}
        </span>
        <button
          type="button"
          title="重新读取"
          onClick={() => {
            readBattery();
            void readMemory();
          }}
          className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-3.5" />
          <span className="sr-only">重新读取</span>
        </button>
      </div>

      <p className="text-[10px] leading-tight text-muted-foreground">
        {charging ? '正在充电' : pct === null ? '电量不可用' : '未充电'}
      </p>
      {batteryNote && (
        <p className="text-[10px] leading-tight text-muted-foreground/80">
          {batteryNote}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>内存</span>
          <span className="ml-auto tabular-nums">{used === null ? '—' : used + '%'}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
          <span
            className={cn('block h-full rounded-full bg-primary')}
            style={{ width: (used ?? 0) + '%' }}
          />
        </div>
        {memoryNote && (
          <button
            type="button"
            onClick={() => void requestMemory()}
            className="mt-0.5 self-start rounded text-[10px] text-muted-foreground underline decoration-dotted hover:text-foreground"
          >
            {memoryNote}
          </button>
        )}
      </div>
    </div>
  );
}
