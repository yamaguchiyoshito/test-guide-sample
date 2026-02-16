export interface SeedableFaker {
  seed: (value: number) => unknown;
}

/**
 * 目的: Fakerの乱数シードを統一し、テストデータを決定的にする。
 * 用途: Factory初期化時に呼び出し、スナップショット差分とFlakyを減らすために使う。
 */
export function seedFaker<T extends SeedableFaker>(faker: T, seed = 123): T {
  // 毎回同一seedを使うことで、スナップショット差分とFlakyを抑える。
  faker.seed(seed);
  return faker;
}
