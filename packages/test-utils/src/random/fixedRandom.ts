export interface FixedRandomController {
  readonly value: number;
  restore: () => void;
}

/**
 * 目的: `Math.random` を固定値へ差し替え、乱数依存テストを決定的にする。
 * 用途: 乱数分岐やID生成ロジックのテスト前に呼び、終了時に`restore`で戻す。
 */
export function fixedRandom(value = 0.5): FixedRandomController {
  const originalRandom = Math.random;
  // 0〜1へ丸めて、Math.randomの契約を破らない値に限定する。
  const normalized = Math.max(0, Math.min(1, value));

  Math.random = () => normalized;

  return {
    value: normalized,
    restore: () => {
      Math.random = originalRandom;
    },
  };
}
