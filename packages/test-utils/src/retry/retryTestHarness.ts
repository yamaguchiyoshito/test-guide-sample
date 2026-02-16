export interface RetryErrorLike {
  code?: string;
  statusCode?: number;
  retryable?: boolean;
}

export interface RetryHarnessOptions {
  maxAttempts?: number;
  retryableStatuses?: number[];
}

export interface RetrySimulationInput {
  errors: RetryErrorLike[];
  options?: RetryHarnessOptions;
}

export interface RetryStep {
  attempt: number;
  shouldRetry: boolean;
  delayMs: number;
  error: RetryErrorLike;
}

export interface RetrySimulationResult {
  steps: RetryStep[];
  attempts: number;
  retries: number;
  totalDelayMs: number;
  stoppedReason: 'max-attempts' | 'non-retryable' | 'exhausted-errors';
}

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

function calculateDeterministicBackoff(attempt: number): number {
  return Math.min(Math.pow(2, attempt) * 1000, 30_000);
}

function shouldRetryError(
  error: RetryErrorLike,
  retryableStatuses: number[],
): boolean {
  if (error.retryable === true) {
    return true;
  }
  if (typeof error.statusCode === 'number' && retryableStatuses.includes(error.statusCode)) {
    return true;
  }
  return error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR';
}

/**
 * 目的: リトライ判定と待機時間を決定的に再現するテストハーネスを提供する。
 * 用途: `requestJson` 相当の再試行戦略を、実待機なしで検証する時に使う。
 */
export function simulateRetryPlan(input: RetrySimulationInput): RetrySimulationResult {
  const maxAttempts = input.options?.maxAttempts ?? 3;
  const retryableStatuses =
    input.options?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;

  const steps: RetryStep[] = [];
  let retries = 0;
  let totalDelayMs = 0;
  let stoppedReason: RetrySimulationResult['stoppedReason'] = 'exhausted-errors';

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const error = input.errors[attempt];
    if (!error) {
      stoppedReason = 'exhausted-errors';
      break;
    }

    const retryable = shouldRetryError(error, retryableStatuses);
    const hasNextAttempt = attempt < maxAttempts - 1;
    const shouldRetry = retryable && hasNextAttempt;
    const delayMs = shouldRetry ? calculateDeterministicBackoff(attempt) : 0;

    steps.push({
      attempt: attempt + 1,
      shouldRetry,
      delayMs,
      error,
    });

    if (!shouldRetry) {
      stoppedReason = retryable ? 'max-attempts' : 'non-retryable';
      break;
    }

    retries += 1;
    totalDelayMs += delayMs;
  }

  if (steps.length === maxAttempts && steps[steps.length - 1]?.shouldRetry === false) {
    const last = steps[steps.length - 1];
    if (last && shouldRetryError(last.error, retryableStatuses)) {
      stoppedReason = 'max-attempts';
    }
  }

  return {
    steps,
    attempts: steps.length,
    retries,
    totalDelayMs,
    stoppedReason,
  };
}
