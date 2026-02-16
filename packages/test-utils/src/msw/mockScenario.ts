import type { MockScenario } from './scenarios';

const MOCK_SCENARIO_KEY = 'MOCK_SCENARIO';

/**
 * 目的: シナリオ名をブラウザ側の共通キーへ保存する。
 * 用途: Storybookやテストで、APIモックの応答パターンを切り替える時に使う。
 */
export function setMockScenario(scenario: MockScenario): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(MOCK_SCENARIO_KEY, scenario);
}

/**
 * 目的: シナリオ指定を解除してデフォルト応答へ戻す。
 * 用途: テスト後処理やStory切替時のクリーンアップに使う。
 */
export function clearMockScenario(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(MOCK_SCENARIO_KEY);
}

/**
 * 目的: 現在有効なモックシナリオを取得する。
 * 用途: HTTPクライアントが`x-mock-scenario`ヘッダを付与する前に参照する。
 */
export function getMockScenario(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  // defaultは「シナリオ未指定」と同義で扱う。
  const scenario = localStorage.getItem(MOCK_SCENARIO_KEY);
  if (!scenario || scenario === 'default') {
    return null;
  }
  return scenario;
}

/**
 * 目的: 指定シナリオを一時適用し、処理後に必ず解除する。
 * 用途: 単一テストケース内でのみ特殊シナリオを有効化したい時に使う。
 */
export async function withMockScenario<T>(
  scenario: MockScenario,
  action: () => Promise<T> | T,
): Promise<T> {
  // テスト実行中だけシナリオを有効化し、後始末漏れを防ぐ。
  setMockScenario(scenario);
  try {
    return await action();
  } finally {
    clearMockScenario();
  }
}
