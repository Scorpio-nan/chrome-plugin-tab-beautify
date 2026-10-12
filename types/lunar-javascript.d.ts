// lunar-javascript（MIT）没有自带类型声明，这里只声明本项目用到的部分。
// 上游 WeTab 用的也是同一个库（黄历/农历/宜忌），所以数据结构能对上。
declare module 'lunar-javascript' {
  export interface LunarLike {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getMonthInChinese(): string;
    getDayInChinese(): string;
    getYearInGanZhi(): string;
    getMonthInGanZhi(): string;
    getDayInGanZhi(): string;
    getYearShengXiao(): string;
    getJieQi(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    getDayYi(): string[];
    getDayJi(): string[];
    getPengZuGan(): string;
    getPengZuZhi(): string;
    getDayChongDesc(): string;
    getDaySha(): string;
    getDayNaYin(): string;
    getXiu(): string;
    getZheng(): string;
    getAnimal(): string;
    getZhiXing(): string;
    getDayTianShen(): string;
    getDayTianShenType(): string;
    getDayPositionXiDesc(): string;
    getDayPositionFuDesc(): string;
    getDayPositionCaiDesc(): string;
  }

  export interface SolarLike {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getWeekInChinese(): string;
    getXingZuo(): string;
    getFestivals(): string[];
    getOtherFestivals(): string[];
    getLunar(): LunarLike;
  }

  export const Solar: {
    fromDate(date: Date): SolarLike;
    fromYmd(year: number, month: number, day: number): SolarLike;
  };
}
