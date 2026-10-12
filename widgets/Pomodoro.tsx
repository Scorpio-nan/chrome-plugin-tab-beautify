// 专注·番茄钟（上游 F32）：
//   一个番茄 25 分钟，不可分割；中途「跳过」视为烂番茄；
//   专注/休息交替（5 分钟小休、每 4 个番茄 15 分钟大休），统计按天记。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';

import { useLocal } from '@/lib/hooks';
import {
  pomodoroStore,
  pruneWaterDays,
  todayKey,
  type PomodoroStats,
} from '@/lib/local-stores';
import { cn } from '@/lib/utils';

const FOCUS_SEC = 25 * 60;
const SHORT_BREAK = 5 * 60;
const LONG_BREAK = 15 * 60;
const LONG_EVERY = 4;

type Phase = 'focus' | 'short' | 'long';

const PHASE_LABEL: Record<Phase, string> = {
  focus: '专注',
  short: '小休息',
  long: '大休息',
};

function mmss(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export default function Pomodoro() {
  const stored = useLocal<PomodoroStats>('pomodoro', () => pomodoroStore.get(), {
    date: '',
    sessions: 0,
    rotten: 0,
    minutes: 0,
  });
  const today = todayKey();
  // 跨天自动从零开始（不写盘，等真正产生行为时再落）
  const stats: PomodoroStats =
    stored.date === today
      ? stored
      : { date: today, sessions: 0, rotten: 0, minutes: 0, days: stored.days };

  const [phase, setPhase] = useState<Phase>('focus');
  const [left, setLeft] = useState(FOCUS_SEC);
  const [running, setRunning] = useState(false);
  const tick = useRef(0);

  const save = useCallback((next: PomodoroStats) => {
    void pomodoroStore.set(next);
  }, []);

  /** 换到下一段；skip = 手动跳过，算烂番茄 */
  const advance = useCallback(
    (skipped: boolean) => {
      if (phase === 'focus') {
        const nextSessions = skipped ? stats.sessions : stats.sessions + 1;
        const days = { ...(stats.days ?? {}) };
        if (!skipped) days[today] = (days[today] ?? 0) + 1;
        save({
          date: today,
          sessions: nextSessions,
          rotten: stats.rotten + (skipped ? 1 : 0),
          minutes: stats.minutes + (skipped ? 0 : 25),
          days: pruneWaterDays(days),
        });
        const long = !skipped && nextSessions % LONG_EVERY === 0;
        setPhase(long ? 'long' : 'short');
        setLeft(long ? LONG_BREAK : SHORT_BREAK);
      } else {
        setPhase('focus');
        setLeft(FOCUS_SEC);
      }
      setRunning(false);
    },
    [phase, save, stats.minutes, stats.rotten, stats.sessions, today],
  );

  /** 本周 / 本月达标天数：一天做满 4 个番茄算达标 */
  const achievements = useMemo(() => {
    const days = stats.days ?? {};
    const now = new Date();
    const hit = (start: Date) => {
      let n = 0;
      const cursor = new Date(start);
      while (cursor.getTime() <= now.getTime()) {
        if ((days[todayKey(cursor)] ?? 0) >= LONG_EVERY) n += 1;
        cursor.setDate(cursor.getDate() + 1);
      }
      return n;
    };
    const weekStart = new Date(now);
    // 以周一为一周开始
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { week: hit(weekStart), month: hit(monthStart) };
  }, [stats.days]);

  useEffect(() => {
    if (!running) return;
    tick.current = window.setInterval(() => {
      // 只在 reducer 里做纯减法：到点后的换段交给下面的 effect，
      // 避免在 setState 更新函数里跑副作用（StrictMode 下会被执行两次）
      setLeft((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(tick.current);
  }, [running]);

  /** 一段走完：正常结束，不计烂番茄 */
  useEffect(() => {
    if (!running || left > 0) return;
    advance(false);
  }, [running, left, advance]);

  const total = phase === 'focus' ? FOCUS_SEC : phase === 'short' ? SHORT_BREAK : LONG_BREAK;
  const progress = 1 - left / total;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 py-1.5 text-foreground">
      <span className="text-[10px] tracking-[0.08em] text-muted-foreground">
        {PHASE_LABEL[phase]}
        {phase === 'focus' && ' · 25 分钟不可分割'}
      </span>

      <span className="text-[clamp(1.5rem,2.6vw,2.6rem)] leading-none font-light tabular-nums">
        {mmss(left)}
      </span>

      <span className="h-1 w-4/5 overflow-hidden rounded-full bg-secondary/60">
        <span
          className={cn(
            'block h-full rounded-full transition-[width] duration-500',
            phase === 'focus' ? 'bg-primary' : 'bg-emerald-400',
          )}
          style={{ width: Math.round(progress * 100) + '%' }}
        />
      </span>

      <div className="mt-0.5 flex items-center gap-1.5">
        <button
          type="button"
          title={running ? '暂停' : '开始专注'}
          onClick={() => setRunning((v) => !v)}
          className="grid size-7 place-items-center rounded-full bg-primary/85 text-primary-foreground hover:bg-primary"
        >
          {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          <span className="sr-only">{running ? '暂停' : '开始'}</span>
        </button>
        <button
          type="button"
          title="跳过当前时间段（记一个烂番茄）"
          onClick={() => advance(true)}
          className="grid size-7 place-items-center rounded-full bg-secondary/70 text-muted-foreground hover:text-foreground"
        >
          <SkipForward className="size-3.5" />
          <span className="sr-only">跳过</span>
        </button>
        <button
          type="button"
          title="重新开始这一段"
          onClick={() => {
            setRunning(false);
            setLeft(total);
          }}
          className="grid size-7 place-items-center rounded-full bg-secondary/70 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          <span className="sr-only">重来</span>
        </button>
      </div>

      <p className="text-[10px] tabular-nums text-muted-foreground">
        今日 {stats.sessions} 个番茄 · {stats.minutes} 分钟
        {stats.rotten > 0 && ' · 烂番茄 ' + stats.rotten}
      </p>
      <p className="text-[10px] tabular-nums text-muted-foreground">
        达标（≥{LONG_EVERY} 个/天）：本周 {achievements.week} 天 · 本月{' '}
        {achievements.month} 天
      </p>
    </div>
  );
}
