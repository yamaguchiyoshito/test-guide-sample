export interface FrozenTimeController {
  readonly fixedTimestamp: number;
  restore: () => void;
}

/**
 * 目的: `Date.now()` の返値を固定し、時刻依存テストを安定化する。
 * 用途: 有効期限・経過時間・ID生成時刻などの検証で、テスト前後に固定/復元して使う。
 */
export function freezeTime(value: Date | number | string): FrozenTimeController {
  // 文字列/Date/epochをすべてミリ秒へ正規化する。
  const fixedTimestamp = new Date(value).getTime();
  const originalNow = Date.now;

  Date.now = () => fixedTimestamp;

  return {
    fixedTimestamp,
    restore: () => {
      Date.now = originalNow;
    },
  };
}
