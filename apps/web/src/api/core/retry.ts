export interface RetryOptions {
  maxAttempts?: number;
  enableBackoff?: boolean;
  retryableStatuses?: number[];
}

export const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

/**
 * 目的: 再試行間隔を指数バックオフ + ジッターで計算する。
 * 用途: 同時多発リトライの衝突を避けつつ、負荷を段階的に下げるために使う。
 */
export function calculateBackoffDelay(attempt: number): number {
  // 1s,2s,4s... の指数バックオフに±20%ジッターを加えて同時再試行を分散する。
  const baseDelay = Math.pow(2, attempt) * 1000;
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
  return Math.min(baseDelay + jitter, 30_000);
}

/**
 * 目的: ステータスコードが再試行対象かを判定する。
 * 用途: リトライループ内で継続/打ち切りを決める条件式として使う。
 */
export function shouldRetryStatus(
  statusCode: number | undefined,
  retryableStatuses: number[] = DEFAULT_RETRYABLE_STATUSES,
): boolean {
  // statusCode未取得（ネットワーク断など）はここでは再試行対象にしない。
  if (!statusCode) {
    return false;
  }
  return retryableStatuses.includes(statusCode);
}

/**
 * 目的: 指定ミリ秒だけ非同期で待機する。
 * 用途: バックオフ待機やテスト用遅延の共通ヘルパとして使う。
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
