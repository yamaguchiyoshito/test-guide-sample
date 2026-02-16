import { z } from 'zod';
import { normalizeHeaderValue } from '@/lib/securityUtils';
import type { SafeJsonParseResult } from '@/lib/utils';
import {
  isAbortError,
  omitNil,
  parseRetryAfterMs,
  safeJsonParse,
  safeJsonStringify,
  serializeError,
  toQueryString,
} from '@/lib/utils';
import type { ApiError, ApiErrorCode } from './apiError';
import { createApiError } from './apiError';
import { ensureValidToken, forceRefreshToken } from './auth';
import { logger } from './logger';
import { getMockScenario, generateRequestId, type RequestContext } from './requestContext';
import {
  DEFAULT_RETRYABLE_STATUSES,
  calculateBackoffDelay,
  shouldRetryStatus,
  sleep,
  type RetryOptions,
} from './retry';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: TBody;
  signal?: AbortSignal;
  timeoutMs?: number;
  retry?: RetryOptions;
  debugContext?: RequestContext;
  withAuth?: boolean;
  withCsrf?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const CSRF_CACHE_TTL_MS = 55 * 60 * 1000;

interface CachedCsrfToken {
  token: string;
  expiresAt: number;
}

let csrfTokenCache: CachedCsrfToken | null = null;

function getCachedCsrfToken(): string | null {
  if (!csrfTokenCache) {
    return null;
  }

  if (Date.now() >= csrfTokenCache.expiresAt) {
    csrfTokenCache = null;
    return null;
  }

  return csrfTokenCache.token;
}

function setCachedCsrfToken(token: string): string {
  csrfTokenCache = {
    token,
    expiresAt: Date.now() + CSRF_CACHE_TTL_MS,
  };
  return token;
}

function clearCachedCsrfToken(): void {
  csrfTokenCache = null;
}

/**
 * 目的: テスト実行時にCSRFトークンキャッシュを初期化する。
 * 用途: ユニットテスト間での状態リークを防ぎ、再現性を担保する。
 */
export function __resetCsrfTokenCacheForTest(): void {
  clearCachedCsrfToken();
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || '';
}

function mapStatusToCode(status: number): ApiErrorCode {
  // HTTPステータスをUI/再試行判定で扱いやすいエラーコードへ変換する。
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'AUTH_ERROR';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 408) return 'TIMEOUT_ERROR';
  if (status === 422) return 'BUSINESS_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN_ERROR';
}

async function getCsrfToken(baseUrl: string): Promise<string | null> {
  // 同一セッション内ではCSRFトークンをキャッシュして往復を減らす。
  const cachedToken = getCachedCsrfToken();
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const response = await fetch(`${baseUrl}/api/csrf-token`, {
      credentials: 'include',
    });

    if (!response.ok) {
      clearCachedCsrfToken();
      return null;
    }

    const data = (await response.json()) as { csrfToken?: string };
    if (!data.csrfToken) {
      clearCachedCsrfToken();
      return null;
    }

    return setCachedCsrfToken(data.csrfToken);
  } catch {
    clearCachedCsrfToken();
    return null;
  }
}

function buildUrl(path: string, query: RequestOptions['query'], baseUrl: string): string {
  return `${baseUrl}${path}${toQueryString(query ?? {})}`;
}

function toTimeoutError(): ApiError {
  return createApiError({
    code: 'TIMEOUT_ERROR',
    message: 'Request timeout',
    retryable: true,
  });
}

function toNetworkError(): ApiError {
  return createApiError({
    code: 'NETWORK_ERROR',
    message: 'Network error',
    retryable: true,
  });
}

function toFieldErrors(detail: unknown): Record<string, string[]> | undefined {
  if (!detail || typeof detail !== 'object') {
    return undefined;
  }

  const value = (detail as { fieldErrors?: unknown }).fieldErrors;
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const result: Record<string, string[]> = {};

  for (const [key, candidate] of Object.entries(value)) {
    if (Array.isArray(candidate)) {
      const messages = candidate.filter((item): item is string => typeof item === 'string');
      if (messages.length > 0) {
        result[key] = messages;
      }
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail: unknown;

  try {
    detail = await response.json();
  } catch {
    detail = undefined;
  }

  let retryAfterMs: number | undefined;
  if (response.status === 429) {
    // Retry-Afterの秒指定/日時指定を共通ユーティリティで正規化する。
    retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
  }

  return createApiError({
    code: mapStatusToCode(response.status),
    message: response.statusText || 'API request failed',
    statusCode: response.status,
    retryable: shouldRetryStatus(response.status),
    retryAfterMs,
    fieldErrors: toFieldErrors(detail),
    detail,
  });
}

async function executeRequest<TRes, TBody>(
  path: string,
  opts: RequestOptions<TBody>,
  requestId: string,
  allowAuthRetry = true,
  allowCsrfRetry = true,
): Promise<ApiResponse<TRes>> {
  const baseUrl = getBaseUrl();
  const method = opts.method || 'GET';
  const withAuth = opts.withAuth !== false;
  const withCsrf = opts.withCsrf ?? method !== 'GET';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': requestId,
    ...(opts.headers || {}),
  };

  if (opts.debugContext) {
    // 呼び出し元画面/操作をサーバーログと突き合わせるためにヘッダ化する。
    const contextHeader = omitNil({
      page: opts.debugContext.page,
      action: opts.debugContext.action,
    });
    headers['X-Request-Context'] = normalizeHeaderValue(
      safeJsonStringify(contextHeader, '{}'),
      512,
    );
  }

  const scenario = getMockScenario();
  if (scenario) {
    headers['x-mock-scenario'] = normalizeHeaderValue(scenario, 64);
  }

  if (withAuth) {
    const token = await ensureValidToken(baseUrl);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (withCsrf) {
    const csrfToken = await getCsrfToken(baseUrl);
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const controller = new AbortController();
  const signal = opts.signal ?? controller.signal;
  // 呼び出し元signal未指定時のみ内部タイムアウト制御を有効化する。
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const url = buildUrl(path, opts.query, baseUrl);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal,
      credentials: 'include',
    });

    if (response.status === 401 && withAuth && allowAuthRetry) {
      // refresh成功時だけ1回だけ透過リトライする（無限ループ防止）。
      const refreshed = await forceRefreshToken(baseUrl);
      if (refreshed) {
        return executeRequest(path, opts, requestId, false, allowCsrfRetry);
      }
    }

    if (response.status === 403 && withCsrf && allowCsrfRetry) {
      // CSRF期限切れ時はトークンを再取得して1回だけ再送する。
      clearCachedCsrfToken();
      const refreshedToken = await getCsrfToken(baseUrl);
      if (refreshedToken) {
        return executeRequest(path, opts, requestId, allowAuthRetry, false);
      }
    }

    if (!response.ok) {
      throw await toApiError(response);
    }

    const text = [204, 205, 304].includes(response.status) ? '' : await response.text();
    const parsed: SafeJsonParseResult<TRes> = text
      ? safeJsonParse<TRes>(text)
      : { ok: true, data: {} as TRes };
    if (!parsed.ok) {
      throw createApiError({
        code: 'VALIDATION_ERROR',
        message: 'Response JSON parse failed',
        retryable: false,
        detail: {
          cause: parsed.error.message,
        },
      });
    }

    const data = parsed.data;
    return {
      data,
      status: response.status,
      headers: response.headers,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw toTimeoutError();
    }

    if (error instanceof TypeError) {
      throw toNetworkError();
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * 目的: API通信を型安全・再試行制御付きで統一実行する。
 * 用途: ドメインクライアントから呼び出し、認証/CSRF/タイムアウト/エラー正規化を共通化する。
 */
export async function requestJson<TRes, TBody = unknown>(
  path: string,
  opts: RequestOptions<TBody> = {},
  schema?: z.ZodSchema<TRes>,
): Promise<ApiResponse<TRes>> {
  const requestId = generateRequestId();
  const startedAt = Date.now();

  // 個別指定を許容しつつ、retry既定値はここで一元管理する。
  const retryConfig = {
    maxAttempts: opts.retry?.maxAttempts ?? 3,
    enableBackoff: opts.retry?.enableBackoff ?? true,
    retryableStatuses: opts.retry?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt += 1) {
    try {
      if (attempt > 0 && retryConfig.enableBackoff) {
        await sleep(calculateBackoffDelay(attempt - 1));
      }

      const response = await executeRequest<TRes, TBody>(path, opts, requestId);

      if (schema) {
        // 生成型だけでは検知できない実レスポンス不整合を実行時に検証する。
        const parsed = schema.safeParse(response.data);

        if (!parsed.success) {
          throw createApiError({
            code: 'VALIDATION_ERROR',
            message: 'Response validation failed',
            retryable: false,
            detail: parsed.error.issues,
          });
        }

        response.data = parsed.data;
      }

      logger.debug('API request succeeded', {
        event: 'http.client.request.succeeded',
        path,
        method: opts.method || 'GET',
        requestId,
        durationMs: Date.now() - startedAt,
        attempt: attempt + 1,
        context: opts.debugContext,
      });

      return response;
    } catch (error) {
      lastError = error;

      const apiError = error as Partial<ApiError>;
      const isRetryable =
        apiError.retryable === true &&
        (shouldRetryStatus(apiError.statusCode, retryConfig.retryableStatuses) ||
          apiError.code === 'NETWORK_ERROR' ||
          apiError.code === 'TIMEOUT_ERROR');

      // 最終試行、または非再試行エラーはここで打ち切る。
      if (!isRetryable || attempt === retryConfig.maxAttempts - 1) {
        logger.error('API request failed', {
          event: 'http.client.request.failed',
          path,
          method: opts.method || 'GET',
          requestId,
          durationMs: Date.now() - startedAt,
          attempt: attempt + 1,
          statusCode: apiError.statusCode,
          code: apiError.code,
          context: opts.debugContext,
          error: serializeError(error),
        });
        throw error;
      }

      logger.warn('API request failed and will retry', {
        event: 'http.client.request.retry',
        path,
        method: opts.method || 'GET',
        requestId,
        attempt: attempt + 1,
        error: serializeError(error),
      });
    }
  }

  throw lastError;
}
