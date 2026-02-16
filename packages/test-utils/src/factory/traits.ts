export type Trait<T> = (seed: T) => T;

/**
 * 目的: 複数traitを順序つきで適用し、テストデータのバリエーションを合成する。
 * 用途: Factoryの`build`前に`asAdmin`や`invalidEmail`などを組み合わせる時に使う。
 */
export function applyTraits<T>(seed: T, traits: Trait<T>[] = []): T {
  // traitを左から順に適用し、最後のtraitが最終値を上書きする。
  return traits.reduce((current, trait) => trait(current), seed);
}

/**
 * 目的: traitに識別名を持たせ、適用セットを追跡可能にする。
 * 用途: テスト失敗時のデバッグで、どのtraitを適用したかを可視化するために使う。
 */
export function createTrait<T>(name: string, handler: Trait<T>): Trait<T> & { traitName: string } {
  // trait名をメタ情報として保持し、デバッグ時に適用セットを追跡できるようにする。
  const trait = ((seed: T) => handler(seed)) as Trait<T> & { traitName: string };
  trait.traitName = name;
  return trait;
}
