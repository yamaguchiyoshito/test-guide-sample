interface HttpErrorLike {
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  retryAfterMs?: number;
}

export interface HttpErrorExpectation {
  code?: string;
  statusCode?: number;
  retryable?: boolean;
  retryAfterMs?: number;
}

function formatUnknown(error: unknown): string {
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
 * 目的: HTTP系エラーの主要属性をまとめて検証する。
 * 用途: ステータス・コード・再試行可否を複数行書かずに一括アサートしたい時に使う。
 */
export function expectHttpError(
  error: unknown,
  expectation: HttpErrorExpectation,
): asserts error is HttpErrorLike {
  const target = (error ?? {}) as HttpErrorLike;
  const failures: string[] = [];

  if (typeof expectation.code !== 'undefined' && target.code !== expectation.code) {
    failures.push(`code expected=${expectation.code} actual=${String(target.code)}`);
  }
  if (
    typeof expectation.statusCode !== 'undefined' &&
    Number(target.statusCode) !== expectation.statusCode
  ) {
    failures.push(
      `statusCode expected=${expectation.statusCode} actual=${String(target.statusCode)}`,
    );
  }
  if (
    typeof expectation.retryable !== 'undefined' &&
    Boolean(target.retryable) !== expectation.retryable
  ) {
    failures.push(
      `retryable expected=${expectation.retryable} actual=${String(target.retryable)}`,
    );
  }
  if (
    typeof expectation.retryAfterMs !== 'undefined' &&
    Number(target.retryAfterMs) !== expectation.retryAfterMs
  ) {
    failures.push(
      `retryAfterMs expected=${expectation.retryAfterMs} actual=${String(target.retryAfterMs)}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`HTTP error assertion failed: ${failures.join(' | ')}; source=${formatUnknown(error)}`);
  }
}
