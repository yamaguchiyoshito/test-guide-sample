type MinimalApiError = {
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  retryAfterMs?: number;
  fieldErrors?: Record<string, string[]>;
  message?: string;
};

function toReadableError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * 目的: 期待したApiErrorコードで失敗していることを明示的に検証する。
 * 用途: 例外ハンドリング分岐のテストで、`code`判定を1行で書くために使う。
 */
export function expectApiErrorCode(
  error: unknown,
  expectedCode: string,
): asserts error is MinimalApiError & { code: string } {
  // errorが素のErrorやunknownでも壊れないように防御的に抽出する。
  const actualCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as MinimalApiError).code)
      : undefined;

  if (actualCode !== expectedCode) {
    throw new Error(
      `Expected ApiError code "${expectedCode}" but got "${actualCode ?? 'undefined'}": ${toReadableError(error)}`,
    );
  }
}

/**
 * 目的: エラーが再試行可能かどうかの判定結果を検証する。
 * 用途: retry戦略のテストで、`retryable`フラグの期待値を固定するために使う。
 */
export function expectRetryableError(
  error: unknown,
  expected = true,
): asserts error is MinimalApiError & { retryable: boolean } {
  // 真偽値比較を明示し、undefinedとの曖昧な一致を防ぐ。
  const retryable =
    typeof error === 'object' && error !== null && 'retryable' in error
      ? Boolean((error as MinimalApiError).retryable)
      : undefined;

  if (retryable !== expected) {
    throw new Error(
      `Expected retryable=${expected} but got ${String(retryable)}: ${toReadableError(error)}`,
    );
  }
}

/**
 * 目的: HTTPステータス起点のエラー分類が正しいかを検証する。
 * 用途: 400/404/429/500等のレスポンス変換テストで利用する。
 */
export function expectApiStatusCode(
  error: unknown,
  expectedStatusCode: number,
): asserts error is MinimalApiError & { statusCode: number } {
  // 文字列混入ケースも吸収するため、いったんNumberに寄せる。
  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as MinimalApiError).statusCode)
      : undefined;

  if (statusCode !== expectedStatusCode) {
    throw new Error(
      `Expected statusCode=${expectedStatusCode} but got ${String(statusCode)}: ${toReadableError(error)}`,
    );
  }
}

/**
 * 目的: `Retry-After`変換結果（ms）が期待値どおりかを検証する。
 * 用途: 429エラーの再試行待機時間に関するテストで利用する。
 */
export function expectRetryAfterMs(
  error: unknown,
  expectedRetryAfterMs: number,
): asserts error is MinimalApiError & { retryAfterMs: number } {
  // Retry-After相当値は比較前に数値へ正規化する。
  const retryAfterMs =
    typeof error === 'object' && error !== null && 'retryAfterMs' in error
      ? Number((error as MinimalApiError).retryAfterMs)
      : undefined;

  if (retryAfterMs !== expectedRetryAfterMs) {
    throw new Error(
      `Expected retryAfterMs=${expectedRetryAfterMs} but got ${String(retryAfterMs)}: ${toReadableError(error)}`,
    );
  }
}

/**
 * 目的: フィールドエラーのキー集合が期待どおりかを検証する。
 * 用途: バリデーションエラーの表示テストで、項目単位の欠落を検知するために使う。
 */
export function expectFieldErrors(
  error: unknown,
  expectedKeys: string[],
): asserts error is MinimalApiError & { fieldErrors: Record<string, string[]> } {
  const fieldErrors =
    typeof error === 'object' && error !== null && 'fieldErrors' in error
      ? (error as MinimalApiError).fieldErrors
      : undefined;

  if (!fieldErrors) {
    throw new Error(`Expected fieldErrors but got undefined: ${toReadableError(error)}`);
  }

  const actualKeys = Object.keys(fieldErrors).sort();
  const expected = [...expectedKeys].sort();

  // キー順に依存しない比較にして、期待値の記述順を自由にする。
  if (actualKeys.length !== expected.length || actualKeys.some((k, i) => k !== expected[i])) {
    throw new Error(
      `Expected fieldErrors keys [${expected.join(', ')}] but got [${actualKeys.join(', ')}]: ${toReadableError(error)}`,
    );
  }
}
