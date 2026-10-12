// 单位换算（上游 F28）：长度 / 面积 / 体积 / 质量 / 速度 / 压强 / 力 / 功率 / 温度 / 数据。
// 全部本地换算，不联网。
import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

interface Unit {
  id: string;
  label: string;
  /** 相对基准单位的系数；温度单独处理 */
  factor: number;
}

interface Category {
  id: string;
  label: string;
  units: Unit[];
}

const u = (id: string, label: string, factor: number): Unit => ({
  id,
  label,
  factor,
});

const CATEGORIES: Category[] = [
  {
    id: 'length',
    label: '长度',
    units: [
      u('mm', '毫米', 0.001),
      u('cm', '厘米', 0.01),
      u('m', '米', 1),
      u('km', '千米', 1000),
      u('inch', '英寸', 0.0254),
      u('foot', '英尺', 0.3048),
      u('mile', '英里', 1609.344),
      u('li', '里', 500),
      u('zhang', '丈', 3.3333),
      u('chi', '尺', 0.3333),
      u('cun', '寸', 0.0333),
      u('nm', '纳米', 1e-9),
      u('um', '微米', 1e-6),
      u('mil', '密耳', 2.54e-5),
      u('fathom', '英寻', 1.8288),
      u('furlong', '弗隆', 201.168),
      u('au', '天文单位', 1.495978707e11),
      u('ly', '光年', 9.4607304725808e15),
    ],
  },
  {
    id: 'area',
    label: '面积',
    units: [
      u('cm2', '平方厘米', 0.0001),
      u('m2', '平方米', 1),
      u('km2', '平方千米', 1e6),
      u('mu', '亩', 666.6667),
      u('hectare', '公顷', 10000),
      u('ft2', '平方英尺', 0.092903),
      u('are', '公亩', 100),
      u('qing', '顷', 66666.67),
      u('in2', '平方英寸', 0.00064516),
      u('mi2', '平方英里', 2589988.11),
    ],
  },
  {
    id: 'volume',
    label: '体积',
    units: [
      u('ml', '毫升', 0.001),
      u('l', '升', 1),
      u('m3', '立方米', 1000),
      u('gal', '加仑(美)', 3.785412),
      u('galuk', '加仑(英)', 4.546092),
      u('ft3', '立方英尺', 28.31685),
      u('in3', '立方英寸', 0.0163871),
    ],
  },
  {
    id: 'mass',
    label: '质量',
    units: [
      u('mg', '毫克', 1e-6),
      u('g', '克', 0.001),
      u('kg', '千克', 1),
      u('t', '吨', 1000),
      u('jin', '斤', 0.5),
      u('lb', '磅', 0.453592),
      u('oz', '盎司', 0.0283495),
      u('ct', '克拉', 0.0002),
      u('stone', '英石', 6.350293),
      u('carat-g', '格令', 6.479891e-5),
      u('longton', '长吨', 1016.047),
      u('shortton', '短吨', 907.1847),
    ],
  },
  {
    id: 'speed',
    label: '速度',
    units: [
      u('ms', '米/秒', 1),
      u('kmh', '千米/时', 0.277778),
      u('mph', '英里/时', 0.44704),
      u('knot', '节', 0.514444),
      u('fts', '英尺/秒', 0.3048),
      u('mach', '马赫', 340.29),
    ],
  },
  {
    id: 'pressure',
    label: '压强',
    units: [
      u('pa', '帕斯卡', 1),
      u('kpa', '千帕', 1000),
      u('bar', '巴', 100000),
      u('atm', '标准大气压', 101325),
      u('mmhg', '毫米汞柱', 133.322),
      u('kgfcm2', '公斤力/平方厘米', 98066.5),
      u('hpa', '百帕', 100),
    ],
  },
  {
    id: 'force',
    label: '力',
    units: [
      u('n', '牛顿', 1),
      u('kn', '千牛', 1000),
      u('kgf', '千克力', 9.80665),
      u('lbf', '磅力', 4.448222),
      u('dyn', '达因', 1e-5),
    ],
  },
  {
    id: 'power',
    label: '功率',
    units: [
      u('w', '瓦特', 1),
      u('kw', '千瓦', 1000),
      u('hp', '米制马力', 735.4988),
      u('hpuk', '英制马力', 745.6999),
      u('jps', '焦耳/秒', 1),
      u('kcals', '千卡/秒', 4184),
    ],
  },
  {
    id: 'energy',
    label: '能量',
    units: [
      u('j', '焦耳', 1),
      u('kj', '千焦', 1000),
      u('cal', '卡', 4.184),
      u('kcal', '千卡', 4184),
      u('kwh', '千瓦时', 3600000),
      u('btu', '英热单位', 1055.056),
    ],
  },
  {
    id: 'data',
    label: '数据',
    units: [
      u('b', '字节', 1),
      u('kb', 'KB', 1024),
      u('mb', 'MB', 1048576),
      u('gb', 'GB', 1073741824),
      u('tb', 'TB', 1099511627776),
    ],
  },
  {
    id: 'temp',
    label: '温度',
    units: [u('c', '摄氏度', 1), u('f', '华氏度', 1), u('k', '开尔文', 1)],
  },
];

/** 温度要单独换算，不能只乘系数 */
function toBase(categoryId: string, unitId: string, value: number): number {
  if (categoryId !== 'temp') return value;
  if (unitId === 'f') return (value - 32) * (5 / 9);
  if (unitId === 'k') return value - 273.15;
  return value;
}

function fromBase(categoryId: string, unitId: string, base: number): number {
  if (categoryId !== 'temp') return base;
  if (unitId === 'f') return base * (9 / 5) + 32;
  if (unitId === 'k') return base + 273.15;
  return base;
}

/** 保留 6 位有效数字，避免 0.30000000000000004 这种尾巴 */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12 || abs < 1e-6) return n.toExponential(4);
  const digits = Math.max(0, 6 - Math.floor(Math.log10(abs)) - 1);
  return Number(n.toFixed(Math.min(digits, 8))).toString();
}

export default function Converter() {
  const [catId, setCatId] = useState('length');
  const [fromId, setFromId] = useState('m');
  const [toId, setToId] = useState('cm');
  const [raw, setRaw] = useState('1');

  const cat = useMemo(
    () => CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0],
    [catId],
  );

  const pickCategory = (id: string) => {
    const next = CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
    setCatId(id);
    setFromId(next.units[0].id);
    setToId((next.units[1] ?? next.units[0]).id);
  };

  const value = Number(raw.replace(/,/g, ''));
  const unitOf = (id: string) => cat.units.find((x) => x.id === id) ?? cat.units[0];
  const from = unitOf(fromId);
  const to = unitOf(toId);
  const base = Number.isFinite(value) ? toBase(cat.id, from.id, value) : NaN;
  const result = Number.isFinite(base)
    ? fromBase(cat.id, to.id, cat.id === 'temp' ? base : base * (from.factor / to.factor))
    : NaN;

  const select =
    'min-w-0 flex-1 rounded-md bg-secondary/60 px-1.5 py-1 text-[11px] text-foreground outline-hidden';

  return (
    <div className="flex h-full w-full flex-col gap-1.5 px-2 py-1.5 text-foreground">
      <div className="thin-scroll flex shrink-0 gap-1 overflow-x-auto pb-0.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pickCategory(c.id)}
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] transition-colors',
              c.id === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/60 text-muted-foreground hover:text-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-md bg-secondary/60 px-2 py-1 text-xs tabular-nums text-foreground outline-hidden focus-visible:ring-[2px] focus-visible:ring-ring/50"
          placeholder="数值"
        />
        <select
          value={from.id}
          onChange={(e) => setFromId(e.target.value)}
          className={select}
        >
          {cat.units.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="min-w-0 flex-1 truncate rounded-md bg-secondary/40 px-2 py-1 text-xs tabular-nums">
          {fmt(result)}
        </span>
        <select
          value={to.id}
          onChange={(e) => setToId(e.target.value)}
          className={select}
        >
          {cat.units.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => {
          setFromId(to.id);
          setToId(from.id);
        }}
        className="shrink-0 self-start rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      >
        ⇅ 交换单位
      </button>
    </div>
  );
}
