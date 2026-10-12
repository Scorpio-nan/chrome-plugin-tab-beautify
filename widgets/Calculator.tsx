// 计算器（上游 F29）：个人所得税、房贷（等额本息/等额本金）、进制转换。
// 纯本地公式，不联网；口径按中国大陆常见算法，界面上把假设写清楚。
import { useState } from 'react';

import { cn } from '@/lib/utils';

type Tab = 'tax' | 'loan' | 'radix';

const TABS: { id: Tab; label: string }[] = [
  { id: 'tax', label: '个税' },
  { id: 'loan', label: '房贷' },
  { id: 'radix', label: '进制' },
];

/** 综合所得年度税率表（年度应纳税所得额，元） */
const TAX_BRACKETS: { upTo: number; rate: number; quick: number }[] = [
  { upTo: 36000, rate: 0.03, quick: 0 },
  { upTo: 144000, rate: 0.1, quick: 2520 },
  { upTo: 300000, rate: 0.2, quick: 16920 },
  { upTo: 420000, rate: 0.25, quick: 31920 },
  { upTo: 660000, rate: 0.3, quick: 52920 },
  { upTo: 960000, rate: 0.35, quick: 85920 },
  { upTo: Infinity, rate: 0.45, quick: 181920 },
];

function incomeTax(taxable: number) {
  const hit = TAX_BRACKETS.find((b) => taxable <= b.upTo) ?? TAX_BRACKETS[TAX_BRACKETS.length - 1];
  return {
    tax: Math.max(0, taxable * hit.rate - hit.quick),
    rate: hit.rate,
    quick: hit.quick,
  };
}

const n = (v: string) => {
  const x = Number(v.replace(/,/g, ''));
  return Number.isFinite(x) ? x : 0;
};

const yuan = (v: number) =>
  v.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

const field =
  'min-w-0 flex-1 rounded-md bg-secondary/60 px-2 py-1 text-xs tabular-nums text-foreground outline-hidden focus-visible:ring-[2px] focus-visible:ring-ring/50';

export default function Calculator() {
  const [tab, setTab] = useState<Tab>('tax');

  /* 个税 */
  const [income, setIncome] = useState('20000');
  const [social, setSocial] = useState('3000');
  const [special, setSpecial] = useState('2000');
  const taxable = Math.max(
    0,
    n(income) * 12 - n(social) * 12 - n(special) * 12 - 60000,
  );
  const tax = incomeTax(taxable);

  /* 房贷 */
  const [amount, setAmount] = useState('1000000');
  const [years, setYears] = useState('30');
  const [rate, setRate] = useState('3.1');
  const [mode, setMode] = useState<'equal' | 'principal'>('equal');
  const months = Math.max(1, Math.round(n(years) * 12));
  const monthlyRate = n(rate) / 100 / 12;
  const principal = Math.max(0, n(amount));
  const equalPay =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate * (1 + monthlyRate) ** months) /
        ((1 + monthlyRate) ** months - 1);
  const totalEqual = equalPay * months;
  const totalPrincipal =
    principal +
    (principal * monthlyRate * (months + 1)) / 2; // 等额本金总利息

  /* 进制 */
  const [radixValue, setRadixValue] = useState('255');
  const [radixFrom, setRadixFrom] = useState(10);
  const radixNumber = (() => {
    const v = radixValue.trim();
    if (!v) return NaN;
    return parseInt(v, radixFrom);
  })();
  const radixOut = (base: number) =>
    Number.isNaN(radixNumber) ? '—' : radixNumber.toString(base).toUpperCase();

  return (
    <div className="thin-scroll flex h-full w-full flex-col gap-2 overflow-y-auto px-2.5 py-2 text-foreground">
      <div className="flex shrink-0 gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-lg px-2 py-1 text-[11px] transition-colors',
              t.id === tab
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/60 text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'tax' && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-24 shrink-0">税前月薪</span>
            <input className={field} value={income} onChange={(e) => setIncome(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-24 shrink-0">五险一金/月</span>
            <input className={field} value={social} onChange={(e) => setSocial(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-24 shrink-0">专项附加/月</span>
            <input className={field} value={special} onChange={(e) => setSpecial(e.target.value)} />
          </label>
          <div className="mt-0.5 flex flex-col gap-0.5 rounded-lg bg-secondary/40 p-2 text-[11px]">
            <span>
              年应纳税所得额：
              <b className="tabular-nums"> ¥{yuan(taxable)}</b>
            </span>
            <span>
              全年个税：
              <b className="tabular-nums"> ¥{yuan(tax.tax)}</b>
            </span>
            <span className="text-muted-foreground">
              月均 ¥{yuan(tax.tax / 12)} · 适用税率 {(tax.rate * 100).toFixed(0)}% ·
              速算扣除数 {tax.quick}
            </span>
          </div>
          <p className="text-[10px] leading-tight text-muted-foreground">
            按综合所得年度税率表、起征点 6 万/年估算，未含年终奖单独计税等特殊情形。
          </p>
        </div>
      )}

      {tab === 'loan' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex shrink-0 gap-1">
            {(
              [
                { id: 'equal', label: '等额本息' },
                { id: 'principal', label: '等额本金' },
              ] as { id: 'equal' | 'principal'; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={cn(
                  'flex-1 rounded-md px-2 py-0.5 text-[10px]',
                  m.id === mode
                    ? 'bg-primary/80 text-primary-foreground'
                    : 'bg-secondary/60 text-muted-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-24 shrink-0">贷款金额</span>
            <input className={field} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-24 shrink-0">年限（年）</span>
            <input className={field} value={years} onChange={(e) => setYears(e.target.value)} />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-24 shrink-0">年利率 %</span>
            <input className={field} value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <div className="mt-0.5 flex flex-col gap-0.5 rounded-lg bg-secondary/40 p-2 text-[11px]">
            {mode === 'equal' ? (
              <>
                <span>
                  每月还款：<b className="tabular-nums">¥{yuan(equalPay)}</b>
                </span>
                <span className="text-muted-foreground">
                  累计还款 ¥{yuan(totalEqual)} · 利息 ¥
                  {yuan(totalEqual - principal)}
                </span>
              </>
            ) : (
              <>
                <span>
                  首月还款：<b className="tabular-nums">¥{yuan(principal / months + principal * monthlyRate)}</b>
                </span>
                <span className="text-muted-foreground">
                  逐月递减 ¥{yuan((principal / months) * monthlyRate)} · 累计利息 ¥
                  {yuan(totalPrincipal - principal)}
                </span>
              </>
            )}
            <span className="text-muted-foreground">共 {months} 期</span>
          </div>
        </div>
      )}

      {tab === 'radix' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input
              className={field}
              value={radixValue}
              onChange={(e) => setRadixValue(e.target.value)}
              placeholder="输入数值"
            />
            <select
              value={radixFrom}
              onChange={(e) => setRadixFrom(Number(e.target.value))}
              className="rounded-md bg-secondary/60 px-1.5 py-1 text-[11px]"
            >
              {[2, 8, 10, 16].map((b) => (
                <option key={b} value={b}>
                  {b} 进制
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-secondary/40 p-2 text-[11px] tabular-nums">
            <span>二进制：{radixOut(2)}</span>
            <span>八进制：{radixOut(8)}</span>
            <span>十进制：{radixOut(10)}</span>
            <span>十六进制：{radixOut(16)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
