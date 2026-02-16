import { logger } from '@/api/core/logger';
import { generateRequestId } from '@/api/core/requestContext';
import { sanitizeLogContext } from './securityUtils';
import { safeJsonStringify, serializeError } from './utils';
import { collectClientEnvironment, type ClientEnvironmentSnapshot } from './clientEnvironment';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const CORRELATION_ID_HEADER = 'X-Correlation-ID';

export interface ClientEnvironmentLogPayload {
  event: 'client_environment';
  requestId: string;
  source: string;
  environment: ClientEnvironmentSnapshot;
}

export interface LogClientEnvironmentOptions {
  endpoint?: string;
  source?: string;
  transport?: 'auto' | 'beacon' | 'fetch';
  environment?: ClientEnvironmentSnapshot | null;
  fetchImpl?: FetchLike;
}

export interface LogClientEnvironmentResult {
  sent: boolean;
  transport: 'none' | 'beacon' | 'fetch';
  status?: number;
}

function canUseSendBeacon(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';
}

function toSafeLogContext(context: Record<string, unknown>): Record<string, unknown> {
  return sanitizeLogContext(context);
}

function sendByBeacon(endpoint: string, body: string): boolean {
  if (!canUseSendBeacon()) {
    return false;
  }

  try {
    const blob = new Blob([body], { type: 'application/json' });
    return navigator.sendBeacon(endpoint, blob);
  } catch {
    return false;
  }
}

async function sendByFetch(
  endpoint: string,
  body: string,
  requestId: string,
  fetchImpl: FetchLike,
): Promise<{ sent: boolean; status?: number }> {
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [CORRELATION_ID_HEADER]: requestId,
    },
    body,
    keepalive: true,
    credentials: 'include',
  });

  return {
    sent: response.ok,
    status: response.status,
  };
}

/**
 * 目的: 収集したクライアント環境情報をサーバーへ非同期送信する。
 * 用途: ブラウザ差異の分析や障害調査向けに、画面表示を阻害せず実行環境ログを記録する。
 */
export async function logClientEnvironment(
  options: LogClientEnvironmentOptions = {},
): Promise<LogClientEnvironmentResult> {
  const endpoint = options.endpoint ?? '/api/client-env';
  const source = options.source ?? 'app_boot';
  const transport = options.transport ?? 'auto';
  const requestId = generateRequestId();
  const snapshot =
    Object.prototype.hasOwnProperty.call(options, 'environment')
      ? options.environment ?? null
      : collectClientEnvironment();

  if (!snapshot) {
    logger.debug(
      'Client environment logging skipped',
      toSafeLogContext({
        event: 'client.environment.skipped',
        requestId,
        reason: 'client-runtime-unavailable',
      }),
    );
    return { sent: false, transport: 'none' };
  }

  const payload: ClientEnvironmentLogPayload = {
    event: 'client_environment',
    requestId,
    source,
    environment: snapshot,
  };

  logger.debug(
    'Client environment captured',
    toSafeLogContext({
      event: 'client.environment.captured',
      requestId,
      source,
      endpoint,
      environment: snapshot,
    }),
  );

  const body = safeJsonStringify(payload, '{}');

  if (transport !== 'fetch') {
    const beaconSent = sendByBeacon(endpoint, body);
    if (beaconSent) {
      logger.debug(
        'Client environment sent by beacon',
        toSafeLogContext({
          event: 'client.environment.sent',
          requestId,
          endpoint,
          source,
          transport: 'beacon',
        }),
      );
      return { sent: true, transport: 'beacon' };
    }

    if (transport === 'beacon') {
      logger.warn(
        'Client environment beacon transport failed',
        toSafeLogContext({
          event: 'client.environment.skipped',
          requestId,
          endpoint,
          source,
          transport: 'beacon',
          reason: 'beacon-failed',
        }),
      );
      return { sent: false, transport: 'beacon' };
    }
  }

  const fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  if (!fetchImpl) {
    logger.warn(
      'Client environment logging skipped',
      toSafeLogContext({
        event: 'client.environment.skipped',
        requestId,
        reason: 'fetch-unavailable',
        endpoint,
        source,
      }),
    );
    return { sent: false, transport: 'none' };
  }

  try {
    const result = await sendByFetch(endpoint, body, requestId, fetchImpl);
    if (!result.sent) {
      logger.warn(
        'Client environment endpoint returned non-success',
        toSafeLogContext({
          event: 'client.environment.skipped',
          requestId,
          endpoint,
          source,
          transport: 'fetch',
          reason: 'non-success-status',
          status: result.status,
        }),
      );
      return { sent: false, transport: 'fetch', status: result.status };
    }

    logger.debug(
      'Client environment sent by fetch',
      toSafeLogContext({
        event: 'client.environment.sent',
        requestId,
        endpoint,
        source,
        transport: 'fetch',
        status: result.status,
      }),
    );
    return { sent: true, transport: 'fetch', status: result.status };
  } catch (error) {
    logger.warn(
      'Client environment fetch transport failed',
      toSafeLogContext({
        event: 'client.environment.skipped',
        requestId,
        endpoint,
        source,
        transport: 'fetch',
        reason: 'fetch-error',
        error: serializeError(error),
      }),
    );
    return { sent: false, transport: 'fetch' };
  }
}
