// 黄历/农历（上游 F18 的能力来源）。
//
// 上游 WeTab 内嵌的是 lunar-javascript（MIT），这里直接用同一个 npm 包，
// 所以「农历、干支、生肖、节气、节日、宜忌、彭祖百忌、冲煞、星宿、建除十二值星、
// 喜神/福神/财神方位」这些字段都能和上游对上，不用自己造历法。
import { Solar, type LunarLike, type SolarLike } from 'lunar-javascript';

export interface AlmanacInfo {
  /** 公历 2026年10月12日 */
  solarText: string;
  /** 农历 九月初二 */
  lunarText: string;
  /** 干支纪年 / 月 / 日 */
  ganZhi: { year: string; month: string; day: string };
  /** 生肖 */
  zodiac: string;
  /** 当日节气，非节气日为空串 */
  jieQi: string;
  /** 公历 + 农历 + 其他节日 */
  festivals: string[];
  /** 宜 / 忌 */
  yi: string[];
  ji: string[];
  /** 冲煞 */
  chong: string;
  sha: string;
  /** 星宿与建除十二值星 */
  xiu: string;
  zhiXing: string;
  /** 值日天神 + 黄道/黑道 */
  tianShen: string;
  tianShenType: string;
  /** 彭祖百忌 */
  pengZu: string;
  /** 喜神 / 福神 / 财神方位 */
  positions: { xi: string; fu: string; cai: string };
  /** 星期与星座 */
  week: string;
  xingZuo: string;
  naYin: string;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

function toInfo(solar: SolarLike): AlmanacInfo {
  const lunar: LunarLike = solar.getLunar();
  const month = safe(() => lunar.getMonthInChinese(), '');
  const day = safe(() => lunar.getDayInChinese(), '');
  const jieQi = safe(() => lunar.getJieQi(), '');
  const festivals = [
    ...safe(() => solar.getFestivals(), [] as string[]),
    ...safe(() => lunar.getFestivals(), [] as string[]),
    ...safe(() => lunar.getOtherFestivals(), [] as string[]),
  ];

  return {
    solarText:
      solar.getYear() + '年' + (solar.getMonth() + 1) + '月' + solar.getDay() + '日',
    lunarText: (month ? month + '月' : '') + day,
    ganZhi: {
      year: safe(() => lunar.getYearInGanZhi(), ''),
      month: safe(() => lunar.getMonthInGanZhi(), ''),
      day: safe(() => lunar.getDayInGanZhi(), ''),
    },
    zodiac: safe(() => lunar.getYearShengXiao(), ''),
    jieQi,
    festivals: Array.from(new Set(festivals)).slice(0, 3),
    yi: safe(() => lunar.getDayYi(), [] as string[]).slice(0, 6),
    ji: safe(() => lunar.getDayJi(), [] as string[]).slice(0, 6),
    chong: safe(() => lunar.getDayChongDesc(), ''),
    sha: safe(() => lunar.getDaySha(), ''),
    xiu: safe(() => lunar.getXiu(), ''),
    zhiXing: safe(() => lunar.getZhiXing(), ''),
    tianShen: safe(() => lunar.getDayTianShen(), ''),
    tianShenType: safe(() => lunar.getDayTianShenType(), ''),
    pengZu: safe(() => lunar.getPengZuGan() + ' ' + lunar.getPengZuZhi(), ''),
    positions: {
      xi: safe(() => lunar.getDayPositionXiDesc(), ''),
      fu: safe(() => lunar.getDayPositionFuDesc(), ''),
      cai: safe(() => lunar.getDayPositionCaiDesc(), ''),
    },
    week: '周' + safe(() => solar.getWeekInChinese(), ''),
    xingZuo: safe(() => solar.getXingZuo(), ''),
    naYin: safe(() => lunar.getDayNaYin(), ''),
  };
}

export function getAlmanac(date: Date): AlmanacInfo {
  return toInfo(Solar.fromDate(date));
}

/** 日历格子里的农历小字：节气 > 节日 > 农历日，跟上游月视图一致 */
export function getDayBadge(date: Date): string {
  const lunar = Solar.fromDate(date).getLunar();
  const jieQi = safe(() => lunar.getJieQi(), '');
  if (jieQi) return jieQi;
  const festival = safe(() => lunar.getFestivals(), [] as string[])[0];
  if (festival) return festival;
  if (safe(() => lunar.getDay(), 1) === 1) {
    return safe(() => lunar.getMonthInChinese(), '') + '月';
  }
  return safe(() => lunar.getDayInChinese(), '');
}

/** 农历几号（数字），初一 = 1 */
export function getLunarDay(date: Date): number {
  return safe(() => Solar.fromDate(date).getLunar().getDay(), 1);
}
