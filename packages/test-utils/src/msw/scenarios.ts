export const mockScenarios = [
  'default',
  'success',
  'timeout',
  'rate-limited',
  'server-error',
  'validation-error',
  'not-found',
] as const;

export type MockScenario = (typeof mockScenarios)[number];

export const mockScenarioHeaderName = 'x-mock-scenario';

/**
 * 目的: シナリオ文字列が定義済み値かを判定する。
 * 用途: URLパラメータやglobal設定など外部入力を安全に取り込む時に使う。
 */
export function isMockScenario(value: string | null): value is MockScenario {
  if (!value) {
    return false;
  }
  // 文字列比較だけで判定できるよう、定義済み配列を唯一の真実にする。
  return (mockScenarios as readonly string[]).includes(value);
}

/**
 * 目的: リクエストヘッダから有効なシナリオを抽出する。
 * 用途: MSWハンドラ内部で分岐条件を統一するために使う。
 */
export function getRequestScenario(headers: Headers): MockScenario {
  // 不正値や未指定時はdefaultへフォールバックする。
  const raw = headers.get(mockScenarioHeaderName);
  return isMockScenario(raw) ? raw : 'default';
}

/**
 * 目的: 任意のヘッダセットへシナリオヘッダを注入する。
 * 用途: fetchやテストクライアント作成時にシナリオを明示したい場合に使う。
 */
export function withScenarioHeader(
  headers: Record<string, string> = {},
  scenario: MockScenario,
): Record<string, string> {
  return {
    ...headers,
    [mockScenarioHeaderName]: scenario,
  };
}
