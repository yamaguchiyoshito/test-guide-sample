export type PresetMap<T> = Record<string, Partial<T>>;

/**
 * 目的: Factoryプリセット定義を型付きで固定化する。
 * 用途: `admin` や `invalidEmail` などの再利用パターンを1か所で管理する時に使う。
 */
export function defineFactoryPresets<T>(presets: PresetMap<T>): PresetMap<T> {
  return presets;
}

/**
 * 目的: プリセットと任意overrideを合成してテストデータを生成する。
 * 用途: テストごとに最小差分だけ上書きし、冗長なオブジェクト記述を減らす時に使う。
 */
export function applyFactoryPreset<T>(
  seed: T,
  presets: PresetMap<T>,
  presetName: keyof PresetMap<T>,
  overrides: Partial<T> = {},
): T {
  return {
    ...seed,
    ...(presets[String(presetName)] ?? {}),
    ...overrides,
  };
}

/**
 * 目的: 複数プリセットを順序つきで連結して適用する。
 * 用途: `inactive` + `admin` のように状態を組み合わせるテストケースで使う。
 */
export function applyFactoryPresetChain<T>(
  seed: T,
  presets: PresetMap<T>,
  presetNames: Array<keyof PresetMap<T>>,
  overrides: Partial<T> = {},
): T {
  const merged = presetNames.reduce<Partial<T>>((acc, presetName) => {
    return {
      ...acc,
      ...(presets[String(presetName)] ?? {}),
    };
  }, {});

  return {
    ...seed,
    ...merged,
    ...overrides,
  };
}
