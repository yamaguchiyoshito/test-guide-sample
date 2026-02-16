export type ApiErrorCode =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'BUSINESS_ERROR'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

export interface ApiError extends Error {
  name: 'ApiError';
  code: ApiErrorCode;
  statusCode?: number;
  retryable: boolean;
  retryAfterMs?: number;
  fieldErrors?: Record<string, string[]>;
  detail?: unknown;
}

export interface CreateApiErrorParams {
  code: ApiErrorCode;
  message?: string;
  statusCode?: number;
  retryable: boolean;
  retryAfterMs?: number;
  fieldErrors?: Record<string, string[]>;
  detail?: unknown;
}

/**
 * 目的: API通信エラーを共通フォーマットへ正規化する。
 * 用途: HTTPクライアントやバリデーション処理で、UIが扱える統一エラーを生成する時に使う。
 */
export function createApiError(params: CreateApiErrorParams): ApiError {
  // 標準Errorをベースにして、通信エラー制御に必要な属性を付与する。
  const error = new Error(params.message || 'API request failed') as ApiError;
  error.name = 'ApiError';
  error.code = params.code;
  error.statusCode = params.statusCode;
  error.retryable = params.retryable;
  error.retryAfterMs = params.retryAfterMs;
  error.fieldErrors = params.fieldErrors;
  error.detail = params.detail;
  return error;
}

/**
 * 目的: unknownな例外がApiErrorかを型安全に判定する。
 * 用途: `catch`節で分岐し、再試行可否やエラーコード別表示を行う時に使う。
 */
export function isApiError(error: unknown): error is ApiError {
  // nameとcodeの両方で判定し、一般Errorとの誤判定を避ける。
  return (
    error instanceof Error &&
    'name' in error &&
    error.name === 'ApiError' &&
    'code' in error
  );
}
